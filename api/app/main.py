"""Live Mochatrade risk service.

There are no synthetic accounts, prices, or fallback decisions in this process.  If Supabase has
not been migrated and populated with real market data, endpoints fail closed with a useful 503.
"""
from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager, suppress
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator

from . import db
from .anchor import publisher
from .auth import Principal, SupabaseAuth, get_principal, require_staff
from .config import settings
from .copilot import service as copilot
from .data.alpha_vantage import AlphaVantage, AVError
from .data.loader import load_book
from .data.poller import QuotePoller
from .data.precompute import compute_all
from .engine import calendar as cal
from .engine import leverage as leverage_engine

log = logging.getLogger('mochaguard.api')


class PositionInput(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    qty: float = Field(allow_inf_nan=False)
    avg_price: float | None = Field(default=None, gt=0, allow_inf_nan=False)

    @field_validator('symbol')
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        return value.strip().upper()


class AccountSyncInput(BaseModel):
    auth_user_id: str
    email: str
    display_name: str | None = None
    tz: str = 'UTC'
    cash: float = Field(allow_inf_nan=False)
    positions: list[PositionInput]


class LeverageInput(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    notional: float = Field(gt=0, le=1_000_000_000, allow_inf_nan=False)
    ts: datetime | None = None

    @field_validator('symbol')
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        return value.strip().upper()


class EvaluateInput(BaseModel):
    ts: datetime | None = None


class ReplayInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    symbol: str = Field(min_length=1, max_length=32)
    session_date: date | None = Field(default=None, alias='date')

    @field_validator('symbol')
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        return value.strip().upper()


class AnchorInput(BaseModel):
    run_id: str = Field(default='', max_length=100)


class MarketRefreshInput(BaseModel):
    symbols: list[str] | None = None
    include_earnings: bool = True


class LiveService:
    def __init__(self) -> None:
        self.book = None
        self.latest = None
        self.auth = SupabaseAuth()
        self.av: AlphaVantage | None = None
        self.poller: QuotePoller | None = None
        self.tasks: list[asyncio.Task] = []
        self._reload_lock = asyncio.Lock()
        self._evaluate_lock = asyncio.Lock()
        self._last_fingerprints: dict[str, str] = {}
        self._decision_ids: dict[tuple[str, str], int] = {}

    async def start(self) -> None:
        await db.init()
        if settings.run_migrations_on_start:
            await db.migrate()
        self.book = await load_book()
        if settings.alpha_vantage_api_key:
            self.av = AlphaVantage()
            self.poller = QuotePoller(lambda: self.book, self.av)
        if settings.scheduler_enabled:
            if self.poller:
                self.tasks.append(asyncio.create_task(self.poller.run(), name='quote-poller'))
            self.tasks.append(asyncio.create_task(self._evaluation_loop(), name='risk-evaluator'))

    async def stop(self) -> None:
        for task in self.tasks:
            task.cancel()
        for task in self.tasks:
            with suppress(asyncio.CancelledError):
                await task
        if self.av:
            await self.av.aclose()
        await self.auth.aclose()
        await db.close()

    def require_book(self):
        if self.book is None or not self.book.symbols:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail='Live market data is not loaded. Run scripts/seed_market.py first.')
        return self.book

    async def reload_book(self) -> None:
        async with self._reload_lock:
            self.book = await load_book()
            self.latest = None

    async def _evaluation_loop(self) -> None:
        while True:
            try:
                if self.book and self.book.symbols:
                    await self.evaluate(datetime.now(tz=timezone.utc), record=True)
            except Exception:  # noqa: BLE001
                log.exception('scheduled risk evaluation failed')
            await asyncio.sleep(max(15, settings.engine_evaluate_seconds))

    async def evaluate(self, ts: datetime | None = None, *, record: bool = False):
        book = self.require_book()
        now = (ts or datetime.now(tz=timezone.utc)).astimezone(timezone.utc)
        async with self._evaluate_lock:
            result = book.evaluate(now)
            for decision in result.decisions:
                row = decision.to_dict()
                decision.id = self._decision_ids.get((self._decision_key(row), self._fingerprint(row)))
            self.latest = result
        if record:
            asyncio.create_task(self._persist_evaluation(book, result), name='decision-log')
        return result

    async def _persist_evaluation(self, book, result) -> None:
        try:
            decision_rows = [decision.to_dict() for decision in result.decisions]
            current = {self._decision_key(row): self._fingerprint(row) for row in decision_rows}
            changed = [row for row in decision_rows
                       if self._last_fingerprints.get(self._decision_key(row)) != self._fingerprint(row)]
            ids = await db.log_decisions(changed)
            self._last_fingerprints = current
            for row, decision_id in zip(changed, ids):
                row['id'] = decision_id
                self._decision_ids[(self._decision_key(row), self._fingerprint(row))] = decision_id
            for decision in result.decisions:
                row = decision.to_dict()
                decision.id = self._decision_ids.get((self._decision_key(row), self._fingerprint(row)))
            await db.insert_snapshot(result.ts, result.phase, result.summary)
            if changed:
                await copilot.explain_decisions(book, result, changed)
                await copilot.ops_brief(result)
        except Exception:  # noqa: BLE001
            # An audit/narration failure must never affect the completed decision.
            log.exception('failed to persist downstream decision artifacts')

    @staticmethod
    def _decision_key(row: dict) -> str:
        return '|'.join((str(row.get('account_id') or 'book'), str(row.get('symbol') or 'account'), str(row.get('action'))))

    @staticmethod
    def _fingerprint(row: dict) -> str:
        facts = {'max_leverage': row.get('max_leverage'), 'adverse_move': row.get('adverse_move'),
                 'equity': row.get('equity'), 'margin_required': row.get('margin_required'),
                 'qty_to_reduce': row.get('qty_to_reduce'), 'reason': row.get('reason')}
        return json.dumps(facts, sort_keys=True, default=str, separators=(',', ':'))

    async def current_result(self):
        return await self.evaluate(record=False)

    async def account_for(self, principal: Principal) -> dict:
        if principal.internal:
            raise HTTPException(status_code=400, detail='Internal calls must specify an account')
        account = await db.get_account_by_auth_user(principal.user_id)
        if account is None:
            account = await db.ensure_account(principal.email, principal.display_name, 'UTC', principal.user_id)
            await self.reload_book()
        return account

    async def refresh_market(self, symbols: list[str] | None, include_earnings: bool) -> dict:
        if not self.av:
            raise HTTPException(status_code=503, detail='ALPHA_VANTAGE_API_KEY is not configured')
        requested = [s.upper().strip() for s in (symbols or settings.symbols) if s and s.strip()]
        if not requested:
            raise HTTPException(status_code=422, detail='At least one symbol is required')
        await db.upsert_symbols([{'symbol': symbol, 'asset_type': 'equity'} for symbol in requested])
        bars_count = 0
        earnings_count = 0
        actions_count = 0
        for symbol in requested:
            bars = await self.av.daily(symbol, full=True)
            bars_count += await db.upsert_bars_daily(symbol, bars)
            splits = await self.av.splits(symbol)
            actions_count += len(splits)
            await db.upsert_corporate_actions(symbol, splits)
            if include_earnings:
                earnings = await self.av.earnings_history(symbol)
                earnings_count += len(earnings)
                await db.upsert_earnings(symbol, earnings)
        risks = await compute_all(requested)
        await self.reload_book()
        return {'symbols': requested, 'daily_bars_written': bars_count, 'earnings_written': earnings_count,
                'corporate_actions_written': actions_count, 'risk_rows_computed': len(risks)}


@asynccontextmanager
async def lifespan(app: FastAPI):
    service = LiveService()
    app.state.service = service
    await service.start()
    try:
        yield
    finally:
        await service.stop()


app = FastAPI(title='Mochatrade Risk API', version='1.0.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True,
                   allow_methods=['GET', 'POST', 'PUT'], allow_headers=['Authorization', 'Content-Type', 'X-Internal-Key'])


def service_of(request: Request) -> LiveService:
    return request.app.state.service


async def accessible_account(service: LiveService, principal: Principal, account_id: str | None) -> dict:
    own = await service.account_for(principal) if not principal.internal else None
    if account_id is None:
        if own is None:
            raise HTTPException(status_code=422, detail='account_id is required for internal calls')
        return own
    requested = await db.get_account(account_id)
    if requested is None:
        raise HTTPException(status_code=404, detail='Account not found')
    if not principal.is_staff and (own is None or str(own['id']) != str(requested['id'])):
        raise HTTPException(status_code=403, detail='You may only access your own account')
    return requested


def decision_json(decision) -> dict:
    return decision.to_dict() if hasattr(decision, 'to_dict') else decision


def account_status(result, account_id: str) -> str:
    actions = [d.action for d in result.decisions if d.account_id == account_id]
    if 'close' in actions:
        return 'auto_derisk'
    return 'action_needed' if any(a in {'reduce', 'margin_call'} for a in actions) else 'safe'


@app.get('/health')
async def health(request: Request):
    service = service_of(request)
    return {'ok': True, 'database': settings.db_configured, 'market_loaded': bool(service.book and service.book.symbols),
            'alpha_vantage': bool(service.av), 'chain_configured': settings.chain_configured}


@app.get('/me')
async def me(request: Request, principal: Annotated[Principal, Depends(get_principal)]):
    account = await service_of(request).account_for(principal)
    return {'user_id': principal.user_id, 'email': principal.email, 'is_staff': principal.is_staff,
            'account_id': str(account['id'])}


@app.get('/dashboard/book')
async def dashboard_book(request: Request, _: Annotated[Principal, Depends(require_staff)]):
    service = service_of(request)
    result = await service.current_result()
    brief = await db.latest_ops_brief(datetime.now(tz=timezone.utc) - timedelta(days=1))
    return {'summary': result.summary, 'ops_brief': brief['body'] if brief else None,
            'decisions': [decision_json(d) for d in result.decisions]}


@app.get('/dashboard/accounts')
async def dashboard_accounts(request: Request, principal: Annotated[Principal, Depends(get_principal)]):
    service = service_of(request)
    result = await service.current_result()
    if principal.is_staff:
        accounts = await db.list_accounts()
    else:
        accounts = [await service.account_for(principal)]
    out = []
    for account in accounts:
        account_id = str(account['id'])
        if account_id not in service.require_book().acct_idx:
            continue
        view = service.book.account_view(account_id, result)
        out.append({'id': account_id, 'display_name': view['display_name'], 'tz': view['tz'], 'equity': view['equity'],
                    'status': account_status(result, account_id)})
    return out


@app.get('/tonight/{account_id}')
async def tonight(account_id: str, request: Request, principal: Annotated[Principal, Depends(get_principal)]):
    service = service_of(request)
    account = await accessible_account(service, principal, account_id)
    result = await service.current_result()
    if account_id not in service.require_book().acct_idx:
        raise HTTPException(status_code=404, detail='Account has no live portfolio in the risk book')
    view = service.book.account_view(account_id, result)
    decisions = [decision_json(d) for d in result.decisions if d.account_id == account_id or
                 (d.action == 'freeze' and any(p['symbol'] == d.symbol for p in view['positions']))]
    saved = await db.recent_decisions(datetime.now(tz=timezone.utc) - timedelta(days=1), account_id)
    explanations = await db.explanations_for_decisions([int(d['id']) for d in saved])
    cards = []
    for decision in decisions:
        matching = next((old for old in saved if old.get('symbol') == decision.get('symbol') and old['action'] == decision['action']), None)
        explanation = explanations.get(int(matching['id'])) if matching else None
        if explanation:
            cards.append({'decision_id': explanation['decision_id'], 'symbol': decision.get('symbol'), 'action': decision['action'],
                          'headline': explanation['headline'], 'body': explanation['body'], 'action_hint': explanation['action_hint'],
                          'qty_to_reduce': decision.get('qty_to_reduce'), 'max_leverage': decision.get('max_leverage'),
                          'model': explanation['model']})
    digest = copilot.deterministic_tonight_digest(view, decisions, result)
    return {'account': view, 'as_of': result.ts.isoformat(), 'decisions': decisions, 'cards': cards, **digest}


@app.post('/leverage')
async def leverage(input: LeverageInput, request: Request, _: Annotated[Principal, Depends(get_principal)]):
    service = service_of(request)
    ts = input.ts or datetime.now(tz=timezone.utc)
    if ts.tzinfo is None:
        raise HTTPException(status_code=422, detail='ts must include a timezone offset')
    try:
        result = service.require_book().symbol_leverage(input.symbol, ts, input.notional)
    except KeyError:
        raise HTTPException(status_code=404, detail=f'{input.symbol} is not in the live risk universe') from None
    risk = service.book.symbol_risk(input.symbol)
    return {**result.__dict__, 'ramp': cal.ramp_fraction(ts), 'explanation': None,
            'risk': {'symbol': risk.symbol, 'gap_p99': risk.gap_p99, 'intraday_p99': risk.intraday_p99,
                     'earnings_gap_p99': risk.earnings_gap_p99, 'adv_dollar': risk.adv_dollar}}


@app.post('/evaluate')
async def evaluate(input: EvaluateInput, request: Request, _: Annotated[Principal, Depends(require_staff)]):
    ts = input.ts
    if ts and ts.tzinfo is None:
        raise HTTPException(status_code=422, detail='ts must include a timezone offset')
    result = await service_of(request).evaluate(ts, record=True)
    return {'summary': result.summary, 'decisions': [decision_json(d) for d in result.decisions]}


@app.post('/replay')
async def replay(input: ReplayInput, request: Request, _: Annotated[Principal, Depends(get_principal)]):
    """Apply current rules to persisted, *actual* intraday bars; never creates trades or prices."""
    service = service_of(request)
    book = service.require_book()
    if input.symbol not in book.sym_idx:
        raise HTTPException(status_code=404, detail=f'{input.symbol} is not in the live risk universe')
    session_date = input.session_date or await db.latest_daily_date(input.symbol)
    if session_date is None:
        raise HTTPException(status_code=404, detail='No daily market history is available for this symbol')
    rows = (await db.intraday_between(cal.session_open(session_date), cal.session_close(session_date), [input.symbol])).get(input.symbol, [])
    if not rows:
        raise HTTPException(status_code=404, detail='No persisted real intraday bars exist for this date. Live polling builds this history.')
    risk = book.symbol_risk(input.symbol)
    points = []
    for row in rows:
        ts = row['ts']
        phase = cal.phase_at(ts)
        ramp = cal.ramp_fraction(ts)
        earnings = cal.has_earnings_tonight(input.symbol, ts, book.earnings)
        result = leverage_engine.max_leverage(risk, 10_000.0, phase, ramp, earnings, settings.safety, settings.headline_cap)
        frozen = cal.is_halted(input.symbol, ts, book.halts) or cal.to_et(ts).date() in book.splits.get(input.symbol, set())
        points.append({'ts': ts.isoformat(), 'price': round(float(row['close']), 4), 'max_leverage': result.max_leverage,
                       'phase': phase.value, 'ramp': round(ramp, 3), 'frozen': frozen})
    events = []
    ramp_point = next((point for point in points if point['phase'] == 'closing_ramp'), None)
    if ramp_point:
        events.append({'ts': ramp_point['ts'], 'kind': 'ramp_start', 'symbol': input.symbol, 'account_id': None,
                       'decision_id': None, 'qty': None, 'fill_price': None, 'slippage_bps': None,
                       'note': 'The actual session entered the 3:30 PM ET overnight-risk ramp.'})
    if any(point['frozen'] for point in points):
        first = next(point for point in points if point['frozen'])
        events.append({'ts': first['ts'], 'kind': 'freeze', 'symbol': input.symbol, 'account_id': None,
                       'decision_id': None, 'qty': None, 'fill_price': None, 'slippage_bps': None,
                       'note': 'A recorded halt or corporate action froze risk actions for this symbol.'})
    first, last = points[0], points[-1]
    return {'date': session_date.isoformat(), 'symbol': input.symbol, 'symbols': book.symbols, 'points': points,
            'events': events, 'summary': {'date': session_date.isoformat(), 'bars': len(points),
                                           'open_price': first['price'], 'close_price': last['price'],
                                           'price_change': round(last['price'] / first['price'] - 1, 6) if first['price'] else 0,
                                           'min_allowed_leverage': min(point['max_leverage'] for point in points),
                                           'close_allowed_leverage': last['max_leverage']}}


@app.post('/anchor/{batch_date}')
async def anchor(batch_date: date, input: AnchorInput, _: Annotated[Principal, Depends(require_staff)]):
    try:
        row = await publisher.anchor_day(batch_date, input.run_id)
    except (ValueError, publisher.AnchorUnavailable) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {'batch_id': row['id'], 'batch_date': row['batch_date'].isoformat(), 'merkle_root': row['merkle_root'],
            'tx_hash': row.get('tx_hash'), 'contract_address': row.get('contract_address')}


@app.get('/verify/{decision_id}')
async def verify(decision_id: int, request: Request, principal: Annotated[Principal, Depends(get_principal)]):
    payload = await publisher.verify_decision(decision_id)
    if payload.get('decision', {}).get('account_id') and not principal.is_staff:
        own = await service_of(request).account_for(principal)
        if payload['decision']['account_id'] != str(own['id']):
            raise HTTPException(status_code=403, detail='You may only verify your own decisions')
    return payload


@app.get('/market/symbols')
async def market_symbols(request: Request, _: Annotated[Principal, Depends(get_principal)]):
    return {'symbols': service_of(request).require_book().symbols}


@app.get('/market/{kind}')
async def market(kind: str, request: Request, principal: Annotated[Principal, Depends(get_principal)]):
    service = service_of(request)
    if not service.av:
        raise HTTPException(status_code=503, detail='ALPHA_VANTAGE_API_KEY is not configured')
    query = dict(request.query_params)
    try:
        return {'source': 'alpha_vantage', 'retrieved_at': datetime.now(tz=timezone.utc).isoformat(),
                'data': await service.av.market_query(kind, **query)}
    except (ValueError, AVError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post('/admin/market/refresh')
async def refresh_market(input: MarketRefreshInput, request: Request, _: Annotated[Principal, Depends(require_staff)]):
    return await service_of(request).refresh_market(input.symbols, input.include_earnings)


@app.post('/internal/accounts/sync')
async def sync_account(input: AccountSyncInput, request: Request, x_internal_key: Annotated[str | None, Header()] = None):
    if not settings.internal_api_key or x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail='Valid X-Internal-Key is required')
    account = await db.ensure_account(input.email, input.display_name, input.tz, input.auth_user_id)
    await db.update_account(str(account['id']), cash=input.cash, tz=input.tz, display_name=input.display_name)
    await db.replace_positions(str(account['id']), [position.model_dump() for position in input.positions])
    await service_of(request).reload_book()
    return {'account_id': str(account['id']), 'positions_synced': len(input.positions)}
