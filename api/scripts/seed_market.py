"""Load actual market history, corporate actions, earnings, and risk stats.

Alpha Vantage is preferred for earnings/corporate actions. yfinance is a no-key fallback for
daily price history when the Alpha Vantage quota is exhausted.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db
from app.config import settings
from app.data.alpha_vantage import AVError, AlphaVantage, QuotaExceeded
from app.data.precompute import compute_all
from app.data.yfinance import YFinance


async def main(symbols: list[str], include_earnings: bool) -> None:
    if not settings.alpha_vantage_api_key and not settings.yfinance_enabled:
        raise SystemExit('Configure ALPHA_VANTAGE_API_KEY or set YFINANCE_ENABLED=true')
    await db.init()
    av = AlphaVantage() if settings.alpha_vantage_api_key else None
    yf = YFinance() if settings.yfinance_enabled else None
    try:
        await db.upsert_symbols([{'symbol': symbol, 'asset_type': 'equity'} for symbol in symbols])
        for symbol in symbols:
            try:
                if av is None:
                    raise QuotaExceeded('Alpha Vantage is not configured')
                bars = await av.daily(symbol, full=True)
                splits = await av.splits(symbol)
                source = 'Alpha Vantage'
            except (AVError, QuotaExceeded):
                if yf is None:
                    raise
                bars = await yf.daily(symbol)
                splits = await yf.splits(symbol)
                source = 'Yahoo Finance'
            print(f'Fetching {symbol} daily adjusted history from {source}...')
            await db.upsert_bars_daily(symbol, bars)
            await db.upsert_corporate_actions(symbol, splits)
            if include_earnings and av is not None:
                try:
                    await db.upsert_earnings(symbol, await av.earnings_history(symbol))
                except AVError as exc:
                    print(f'{symbol}: Alpha Vantage earnings unavailable ({exc}); skipped.')
        rows = await compute_all(symbols)
        print(f'Loaded {len(symbols)} live symbols and computed {len(rows)} risk profiles.')
    finally:
        if av:
            await av.aclose()
        await db.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('symbols', nargs='*', help='Tickers to load; default is UNIVERSE from .env')
    parser.add_argument('--no-earnings', action='store_true')
    args = parser.parse_args()
    requested = [symbol.upper() for symbol in args.symbols] or settings.symbols
    asyncio.run(main(requested, not args.no_earnings))
