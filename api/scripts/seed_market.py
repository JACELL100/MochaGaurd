"""Load actual Alpha Vantage history, corporate actions, earnings, and risk stats.

The request budget is controlled centrally by app.data.alpha_vantage.  Start with a small
universe on the free tier; a premium Alpha Vantage key is required for a broad live universe.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db
from app.config import settings
from app.data.alpha_vantage import AlphaVantage
from app.data.precompute import compute_all


async def main(symbols: list[str], include_earnings: bool) -> None:
    if not settings.alpha_vantage_api_key:
        raise SystemExit('ALPHA_VANTAGE_API_KEY is not set in api/.env')
    await db.init()
    av = AlphaVantage()
    try:
        await db.upsert_symbols([{'symbol': symbol, 'asset_type': 'equity'} for symbol in symbols])
        for symbol in symbols:
            print(f'Fetching {symbol} daily adjusted history...')
            await db.upsert_bars_daily(symbol, await av.daily(symbol, full=True))
            await db.upsert_corporate_actions(symbol, await av.splits(symbol))
            if include_earnings:
                await db.upsert_earnings(symbol, await av.earnings_history(symbol))
        rows = await compute_all(symbols)
        print(f'Loaded {len(symbols)} live symbols and computed {len(rows)} risk profiles.')
    finally:
        await av.aclose()
        await db.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('symbols', nargs='*', help='Tickers to load; default is UNIVERSE from .env')
    parser.add_argument('--no-earnings', action='store_true')
    args = parser.parse_args()
    requested = [symbol.upper() for symbol in args.symbols] or settings.symbols
    asyncio.run(main(requested, not args.no_earnings))
