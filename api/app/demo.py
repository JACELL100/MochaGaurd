'''Synthetic book used when DATABASE_URL is unset and by the speed test.

DEMO_DAY is 2025-05-28 (NVDA reported after the close). GME carries a synthetic split on
DEMO_DAY so the freeze guard can be demonstrated.
'''
from __future__ import annotations

from datetime import date, timedelta

import numpy as np

from .engine import calendar as cal
from .state import Account, BookState, DailySeries, IntradaySeries

DEMO_DAY = date(2025, 5, 28)
NEXT_DAY = cal.next_trading_day(DEMO_DAY)

# symbol, gap_p99, intraday_p99, earnings_gap_p99, adv_dollar, price
UNIVERSE = [
    ('SPY', 0.020, 0.015, 0.020, 3.0e10, 590.0), ('QQQ', 0.025, 0.018, 0.025, 1.5e10, 520.0),
    ('AAPL', 0.035, 0.025, 0.080, 1.2e10, 200.0), ('MSFT', 0.030, 0.022, 0.070, 9.0e9, 455.0),
    ('NVDA', 0.080, 0.045, 0.180, 3.0e10, 135.0), ('TSLA', 0.090, 0.055, 0.160, 2.5e10, 360.0),
    ('AMZN', 0.045, 0.028, 0.110, 8.0e9, 205.0), ('META', 0.050, 0.030, 0.150, 7.0e9, 640.0),
    ('GOOGL', 0.040, 0.026, 0.090, 6.0e9, 170.0), ('AMD', 0.070, 0.045, 0.150, 4.0e9, 110.0),
    ('COIN', 0.120, 0.070, 0.200, 2.0e9, 250.0), ('MSTR', 0.150, 0.090, 0.220, 3.0e9, 370.0),
    ('PLTR', 0.100, 0.060, 0.220, 3.5e9, 120.0), ('SMCI', 0.180, 0.100, 0.300, 2.0e9, 40.0),
    ('GME', 0.200, 0.120, 0.300, 8.0e8, 30.0), ('CRM', 0.050, 0.030, 0.140, 1.5e9, 275.0),
    ('COST', 0.030, 0.020, 0.070, 2.0e9, 1010.0), ('IWM', 0.028, 0.020, 0.028, 4.0e9, 205.0),
    ('GLD', 0.020, 0.012, 0.020, 2.0e9, 305.0), ('SLV', 0.035, 0.022, 0.035, 6.0e8, 30.0),
    ('USO', 0.050, 0.030, 0.050, 4.0e8, 70.0), ('XBI', 0.045, 0.030, 0.045, 5.0e8, 80.0),
    ('SOFI', 0.090, 0.060, 0.180, 6.0e8, 13.0), ('RIVN', 0.110, 0.070, 0.220, 5.0e8, 15.0),
]

TIMEZONES = ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'Asia/Singapore', 'Asia/Dubai', 'Europe/Berlin']

# Overnight gaps into NEXT_DAY used by the replay (NVDA earnings night).
DEMO_GAPS = {'NVDA': -0.11, 'SMCI': -0.09, 'CRM': -0.06, 'MSTR': -0.05, 'COIN': -0.04}


def _daily(rng, price, gap_p99, days=800, end=NEXT_DAY, gap_next=0.0):
    dates, opens, closes, vols = [], [], [], []
    d = end - timedelta(days=int(days * 1.5))
    p = price * 0.6
    sigma = gap_p99 / 2.6
    while d <= end:
        if cal.is_trading_day(d):
            if d == end:
                o = closes[-1] * (1.0 + gap_next) if closes else p
                c = o * (1.0 + rng.normal(0, sigma / 2))
            else:
                o = p * (1.0 + rng.normal(0, sigma))
                c = o * (1.0 + rng.normal(0, sigma))
            if d == DEMO_DAY:
                c = price
            dates.append(d.toordinal()); opens.append(o); closes.append(c)
            vols.append(max(1e5, rng.lognormal(15, 0.4)))
            p = c
        d += timedelta(days=1)
    return DailySeries(np.array(dates), np.array(opens), np.array(closes), np.array(vols))


def _intraday(rng, prev_close, intraday_p99, day=DEMO_DAY, step_min=5):
    start = cal.session_open(day)
    n = int(390 / step_min) + 1
    ts = np.array([int((start + timedelta(minutes=step_min * k)).timestamp() * 1e9) for k in range(n)], dtype=np.int64)
    sigma = intraday_p99 / 2.6 / np.sqrt(n)
    path = prev_close * np.cumprod(1.0 + rng.normal(0, sigma, n))
    vol = rng.lognormal(11, 0.5, n)
    return IntradaySeries(ts, path, vol)


def demo_book(n_accounts: int = 2000, seed: int = 7) -> BookState:
    rng = np.random.default_rng(seed)
    symbols = [u[0] for u in UNIVERSE]
    risk = {s: {'gap_p50': g / 4, 'gap_p99': g, 'intraday_p99': i, 'earnings_gap_p99': e,
                'adv_dollar': adv, 'adv_shares': adv / px, 'last_close': px}
            for s, g, i, e, adv, px in UNIVERSE}
    prices = {s: px for s, *_, px in UNIVERSE}

    daily = {s: _daily(rng, prices[s], risk[s]['gap_p99'], gap_next=DEMO_GAPS.get(s, rng.normal(0, risk[s]['gap_p99'] / 3)))
             for s in symbols}
    # prev close for intraday path = close of the day before DEMO_DAY
    intraday = {}
    for s in symbols:
        ds = daily[s]
        k = ds.at(cal.prev_trading_day(DEMO_DAY))
        intraday[s] = _intraday(rng, float(ds.close[k]) if k >= 0 else prices[s], risk[s]['intraday_p99'])

    earnings = {'NVDA': [(DEMO_DAY, 'amc')], 'CRM': [(DEMO_DAY, 'amc')], 'SMCI': [(DEMO_DAY, 'amc')],
                'COST': [(NEXT_DAY, 'amc')]}
    splits = {'GME': {DEMO_DAY}}

    accounts, positions = [], []
    for i in range(n_accounts):
        aid = f'acct-{i + 1:04d}'
        tz = TIMEZONES[i % len(TIMEZONES)]
        equity = float(rng.lognormal(np.log(40_000), 0.9))
        lev = float(rng.uniform(1.0, 9.0))
        k = int(rng.integers(1, 5))
        picks = rng.choice(len(UNIVERSE), size=k, replace=False, p=None)
        gross = equity * lev
        for p in picks:
            s = symbols[p]
            positions.append((aid, s, gross / k / prices[s]))
        accounts.append(Account(id=aid, tz=tz, cash=equity - gross, display_name=f'Trader {i + 1}'))

    return BookState(symbols=symbols, risk=risk, accounts=accounts, positions=positions,
                     earnings=earnings, splits=splits, halts={}, daily=daily, intraday=intraday)
