'''symbol_risk from adjusted daily bars. Everything the leverage formula needs, as-of a date.

All returns use split-adjusted prices (``adj_close`` and an adjusted open derived from the same
factor), so a 4-for-1 split never shows up as a -75% gap. Stats are computed strictly from bars
with ``d <= as_of`` so the replay harness can rebuild history without look-ahead.
'''
from __future__ import annotations

from datetime import date, timedelta

import numpy as np

from .. import db

MIN_DAYS = 60
ADV_WINDOW = 60
EARNINGS_FLOOR_MULT = 2.5   # with too few observed earnings gaps, assume 2.5x the normal p99


def _stats(bars: list[dict], earnings: list[tuple[date, str | None]], as_of: date | None = None) -> dict | None:
    rows = [b for b in bars if b['adj_close'] and b['close'] and (as_of is None or b['d'] <= as_of)]
    if len(rows) < MIN_DAYS:
        return None
    d = np.array([b['d'].toordinal() for b in rows])
    close = np.array([b['close'] for b in rows], dtype=float)
    adj = np.array([b['adj_close'] for b in rows], dtype=float)
    factor = adj / close
    open_adj = np.array([b['open'] for b in rows], dtype=float) * factor
    high = np.array([b['high'] if b['high'] else b['close'] for b in rows], dtype=float)
    low = np.array([b['low'] if b['low'] else b['close'] for b in rows], dtype=float)
    vol = np.array([b['volume'] or 0.0 for b in rows], dtype=float)

    gaps = np.abs(open_adj[1:] / adj[:-1] - 1.0)                                   # overnight
    # high/low are unadjusted; ratios within a day are split-invariant, so use the raw open
    raw_open = np.array([b['open'] for b in rows], dtype=float)
    intraday = np.maximum(np.abs(high / raw_open - 1.0), np.abs(low / raw_open - 1.0))
    intraday = intraday[np.isfinite(intraday)]

    # earnings gaps: AMC report on day t -> gap into t+1; BMO/unknown on day t -> gap into t
    ord_index = {int(o): i for i, o in enumerate(d)}
    earn_gaps = []
    for rd, timing in earnings:
        if as_of is not None and rd > as_of:
            continue
        target = rd if (timing or 'bmo') != 'amc' else rd + timedelta(days=1)
        # find first bar on/after target
        k = int(np.searchsorted(d, target.toordinal(), side='left'))
        if 1 <= k < len(d) and d[k] - target.toordinal() <= 4:
            earn_gaps.append(gaps[k - 1])
    earn_gaps = np.array(earn_gaps, dtype=float)

    gap_p99 = float(np.percentile(gaps, 99)) if len(gaps) else 0.05
    gap_p50 = float(np.percentile(gaps, 50)) if len(gaps) else 0.01
    intraday_p99 = float(np.percentile(intraday, 99)) if len(intraday) else 0.03
    if len(earn_gaps) >= 4:
        earnings_gap_p99 = float(max(np.percentile(earn_gaps, 90), earn_gaps.max(), gap_p99))
    elif len(earn_gaps):
        earnings_gap_p99 = float(max(earn_gaps.max(), gap_p99 * EARNINGS_FLOOR_MULT))
    else:
        earnings_gap_p99 = float(gap_p99 * EARNINGS_FLOOR_MULT)

    w = min(ADV_WINDOW, len(rows))
    adv_shares = float(np.mean(vol[-w:])) if w else 1e6
    adv_dollar = float(np.mean(vol[-w:] * close[-w:])) if w else 1e8
    return {
        'as_of': rows[-1]['d'], 'gap_p50': round(gap_p50, 5), 'gap_p99': round(gap_p99, 5),
        'intraday_p99': round(intraday_p99, 5), 'earnings_gap_p99': round(earnings_gap_p99, 5),
        'adv_dollar': round(adv_dollar, 2), 'adv_shares': round(adv_shares, 2),
        'last_close': float(close[-1]), 'n_days': len(rows), 'n_earnings': int(len(earn_gaps)),
    }


async def compute_symbol(symbol: str, as_of: date | None = None) -> dict | None:
    bars = [dict(r) for r in await db.daily_bars(symbol)]
    earnings = [(r['report_date'], r['timing']) for r in await db.earnings_for(symbol)]
    s = _stats(bars, earnings, as_of)
    if s is None:
        return None
    return {'symbol': symbol, **s}


async def compute_all(symbols: list[str] | None = None, as_of: date | None = None, persist: bool = True) -> list[dict]:
    symbols = symbols or await db.list_symbols()
    out = []
    for s in symbols:
        r = await compute_symbol(s, as_of)
        if r:
            out.append(r)
    if persist and out and as_of is None:
        await db.upsert_symbol_risk(out)
    return out
