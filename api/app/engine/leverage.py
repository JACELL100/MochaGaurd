'''Max leverage = SAFETY / (adverse_move + slippage), phase-aware, concentration-haircut, capped.

All statistics must come from split-adjusted prices computed as-of the decision date.
'''
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .calendar import Phase

BASE_SLIPPAGE = 0.001       # 10 bps spread/impact floor
IMPACT_COEF = 0.10          # slippage += coef * sqrt(participation of ADV$)
CONC_THRESHOLD = 0.01       # > 1% of ADV$ starts the concentration haircut
CONC_FLOOR = 0.25
MIN_LEVERAGE = 1.0

# Pre-market books are a fraction of regular-session depth: a 4 AM screen may show a price with
# only a few hundred shares behind it. Charging slippage against *daily* ADV would price that
# tape as if it were midday liquidity, so participation is measured against the share of ADV
# that actually trades pre-market. This is the "thin pre-market" trap: the quote is real, the
# size behind it is not.
PRE_LIQUIDITY_FRACTION = 0.02   # ~2% of a day's dollar volume trades 04:00-09:30
CLOSED_LIQUIDITY_FRACTION = 0.05  # post-close/overnight: thin, but we are not trading anyway


def liquidity_fraction(phase: Phase) -> float:
    '''Share of a normal day's dollar volume reachable in ``phase``.

    Slippage and the concentration haircut are both functions of participation, so shrinking
    the denominator in the thin phases is what makes a pre-market exit correctly expensive.
    '''
    if phase == Phase.PRE:
        return PRE_LIQUIDITY_FRACTION
    if phase == Phase.CLOSED:
        return CLOSED_LIQUIDITY_FRACTION
    return 1.0


@dataclass(frozen=True)
class SymbolRisk:
    symbol: str
    gap_p99: float
    intraday_p99: float
    earnings_gap_p99: float
    adv_dollar: float


@dataclass(frozen=True)
class LeverageResult:
    symbol: str
    max_leverage: float
    adverse_move: float
    slippage: float
    concentration_haircut: float
    phase: str
    earnings_tonight: bool
    reason: str
    frozen: bool = False


def adverse_move(intraday_p99: float, gap_p99: float, earnings_gap_p99: float,
                 earnings_tonight: bool, phase: Phase, ramp: float) -> float:
    overnight = earnings_gap_p99 if earnings_tonight else gap_p99
    overnight = max(overnight, intraday_p99)
    if phase == Phase.OPEN:
        return intraday_p99
    if phase == Phase.CLOSING_RAMP:
        return intraday_p99 + ramp * (overnight - intraday_p99)
    return overnight  # PRE and CLOSED: you are exposed to the gap


def adverse_move_vec(intraday_p99: np.ndarray, gap_p99: np.ndarray, earnings_gap_p99: np.ndarray,
                     earnings_tonight: np.ndarray, phase: Phase, ramp: float) -> np.ndarray:
    overnight = np.where(earnings_tonight, earnings_gap_p99, gap_p99)
    overnight = np.maximum(overnight, intraday_p99)
    if phase == Phase.OPEN:
        return intraday_p99.copy()
    if phase == Phase.CLOSING_RAMP:
        return intraday_p99 + ramp * (overnight - intraday_p99)
    return overnight


def slippage(participation: float) -> float:
    return BASE_SLIPPAGE + IMPACT_COEF * math.sqrt(max(participation, 0.0))


def slippage_vec(participation: np.ndarray) -> np.ndarray:
    return BASE_SLIPPAGE + IMPACT_COEF * np.sqrt(np.maximum(participation, 0.0))


def concentration_haircut(participation: float) -> float:
    if participation <= CONC_THRESHOLD:
        return 1.0
    return max(CONC_FLOOR, 1.0 - 0.5 * math.log10(participation / CONC_THRESHOLD))


def concentration_haircut_vec(participation: np.ndarray) -> np.ndarray:
    ratio = np.maximum(participation / CONC_THRESHOLD, 1.0)
    return np.maximum(CONC_FLOOR, 1.0 - 0.5 * np.log10(ratio))


def _cap(x, cap: float):
    return np.clip(x, MIN_LEVERAGE, cap)


def max_leverage_vec(adverse: np.ndarray, participation: np.ndarray, safety: float, cap: float) -> np.ndarray:
    '''``participation`` must already be divided by the phase's reachable liquidity.'''
    slip = slippage_vec(participation)
    haircut = concentration_haircut_vec(participation)
    return _cap(haircut * safety / (adverse + slip), cap)


def max_leverage(risk: SymbolRisk, notional: float, phase: Phase, ramp: float,
                 earnings_tonight: bool, safety: float, cap: float) -> LeverageResult:
    adv = adverse_move(risk.intraday_p99, risk.gap_p99, risk.earnings_gap_p99, earnings_tonight, phase, ramp)
    reachable = max(risk.adv_dollar * liquidity_fraction(phase), 1.0)
    participation = abs(notional) / reachable
    slip = slippage(participation)
    haircut = concentration_haircut(participation)
    lev = float(_cap(haircut * safety / (adv + slip), cap))
    reason = (f'phase={phase.value} ramp={ramp:.2f} adverse={adv:.3f} slip={slip:.4f} '
              f'conc={haircut:.2f} participation={participation:.5f} '
              f'earnings={str(earnings_tonight).lower()} cap={cap:g}')
    return LeverageResult(symbol=risk.symbol, max_leverage=round(lev, 2), adverse_move=adv, slippage=slip,
                          concentration_haircut=haircut, phase=phase.value,
                          earnings_tonight=earnings_tonight, reason=reason)
