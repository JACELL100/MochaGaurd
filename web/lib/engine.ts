// TypeScript port of api/app/engine/{calendar,leverage,margin}.py.
// Used ONLY for the offline demo fallback and for drawing the leverage-vs-time curve on
// /simulate. The FastAPI engine remains the source of truth for every real decision.

import type { Phase, SymbolRisk } from "./types";

export const SAFETY = 0.8;
export const HEADLINE_CAP = 20;
const BASE_SLIPPAGE = 0.001;
const IMPACT_COEF = 0.1;
const CONC_THRESHOLD = 0.01;
const CONC_FLOOR = 0.25;
const MIN_LEVERAGE = 1.0;
const MAINT_BUFFER = 0.05;

export const ET = "America/New_York";

const etFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ET,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function etParts(ts: Date) {
  const parts: Record<string, string> = {};
  for (const p of etFormatter.formatToParts(ts)) parts[p.type] = p.value;
  return {
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
    weekend: parts.weekday === "Sat" || parts.weekday === "Sun",
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

// "-04:00" during US daylight time, "-05:00" otherwise, for building ET wall-clock timestamps.
export function etIsoOffset(date: string): string {
  const probe = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: ET, timeZoneName: "shortOffset" }).formatToParts(probe);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-4";
  const m = /GMT([+-]\d+)/.exec(tz);
  const h = m ? Number(m[1]) : -4;
  return `${h < 0 ? "-" : "+"}${String(Math.abs(h)).padStart(2, "0")}:00`;
}

export function etWallClock(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00${etIsoOffset(date)}`);
}

const PRE_OPEN = 4 * 60;
const OPEN = 9 * 60 + 30;
const RAMP_START = 15 * 60 + 30;
const CLOSE = 16 * 60;

export function phaseAt(ts: Date): Phase {
  const { minutes, weekend } = etParts(ts);
  if (weekend) return "closed";
  if (minutes < PRE_OPEN || minutes >= CLOSE) return "closed";
  if (minutes < OPEN) return "pre";
  if (minutes < RAMP_START) return "open";
  return "closing_ramp";
}

export function rampFraction(ts: Date): number {
  const phase = phaseAt(ts);
  if (phase === "closing_ramp") {
    const { minutes } = etParts(ts);
    return Math.min(1, Math.max(0, (minutes - RAMP_START) / 30));
  }
  return phase === "open" ? 0 : 1;
}

export function adverseMove(
  risk: SymbolRisk,
  earningsTonight: boolean,
  phase: Phase,
  ramp: number,
): number {
  let overnight = earningsTonight ? risk.earnings_gap_p99 : risk.gap_p99;
  overnight = Math.max(overnight, risk.intraday_p99);
  if (phase === "open") return risk.intraday_p99;
  if (phase === "closing_ramp") return risk.intraday_p99 + ramp * (overnight - risk.intraday_p99);
  return overnight;
}

export function slippage(participation: number): number {
  return BASE_SLIPPAGE + IMPACT_COEF * Math.sqrt(Math.max(participation, 0));
}

export function concentrationHaircut(participation: number): number {
  if (participation <= CONC_THRESHOLD) return 1;
  return Math.max(CONC_FLOOR, 1 - 0.5 * Math.log10(participation / CONC_THRESHOLD));
}

export interface LeverageBreakdown {
  max_leverage: number;
  adverse_move: number;
  slippage: number;
  concentration_haircut: number;
  phase: Phase;
  ramp: number;
  reason: string;
}

export function maxLeverage(
  risk: SymbolRisk,
  notional: number,
  ts: Date,
  earningsTonight: boolean,
  safety = SAFETY,
  cap = HEADLINE_CAP,
): LeverageBreakdown {
  const phase = phaseAt(ts);
  const ramp = rampFraction(ts);
  const adv = adverseMove(risk, earningsTonight, phase, ramp);
  const participation = Math.abs(notional) / Math.max(risk.adv_dollar, 1);
  const slip = slippage(participation);
  const haircut = concentrationHaircut(participation);
  const lev = Math.min(cap, Math.max(MIN_LEVERAGE, (haircut * safety) / (adv + slip)));
  const reason =
    `phase=${phase} ramp=${ramp.toFixed(2)} adverse=${adv.toFixed(3)} slip=${slip.toFixed(4)} ` +
    `conc=${haircut.toFixed(2)} earnings=${earningsTonight} cap=${cap}`;
  return {
    max_leverage: Math.round(lev * 100) / 100,
    adverse_move: adv,
    slippage: slip,
    concentration_haircut: haircut,
    phase,
    ramp,
    reason,
  };
}

// ------------------------------------------------------------------ margin planner

export interface PositionView {
  symbol: string;
  qty: number;
  price: number;
  adverse: number;
  max_leverage: number;
  frozen: boolean;
}

export interface MarginPlan {
  action: "hold" | "reduce" | "margin_call" | "close";
  equity: number;
  margin_required: number;
  worst_case_loss: number;
  reductions: Record<string, number>;
  reason: string;
}

export function plan(cash: number, positions: PositionView[], buffer = MAINT_BUFFER): MarginPlan {
  const gross = positions.reduce((s, p) => s + Math.abs(p.qty * p.price), 0);
  const equity = cash + positions.reduce((s, p) => s + p.qty * p.price, 0);
  const worstBefore = positions.reduce((s, p) => s + Math.abs(p.qty * p.price) * p.adverse, 0);
  const req = positions.reduce((s, p) => s + Math.abs(p.qty * p.price) / p.max_leverage, 0);

  if (gross <= 0) {
    return { action: "hold", equity, margin_required: req, worst_case_loss: worstBefore, reductions: {}, reason: "no positions" };
  }
  if (equity <= 0) {
    const red: Record<string, number> = {};
    for (const p of positions) if (!p.frozen && p.qty) red[p.symbol] = p.qty;
    return {
      action: "close",
      equity,
      margin_required: req,
      worst_case_loss: worstBefore,
      reductions: red,
      reason: `equity=${equity.toFixed(0)}<=0 gross=${gross.toFixed(0)}`,
    };
  }
  if (equity >= req && equity - worstBefore > 0) {
    return {
      action: "hold",
      equity,
      margin_required: req,
      worst_case_loss: worstBefore,
      reductions: {},
      reason: `equity=${equity.toFixed(0)} margin_req=${req.toFixed(0)} worst=${worstBefore.toFixed(0)}`,
    };
  }

  let worst = worstBefore;
  let excess = req - equity / (1 + buffer);
  const reductions: Record<string, number> = {};
  const sorted = [...positions].sort((a, b) => b.adverse - a.adverse);
  for (const p of sorted) {
    if (p.frozen || p.qty === 0) continue;
    if (excess <= 0 && worst < equity * (1 - buffer)) break;
    const perUnitMargin = p.price / p.max_leverage;
    const perUnitWorst = p.price * p.adverse;
    let needUnits = excess > 0 ? excess / perUnitMargin : 0;
    if (worst >= equity * (1 - buffer)) {
      needUnits = Math.max(needUnits, (worst - equity * (1 - buffer)) / perUnitWorst);
    }
    const r = Math.min(Math.abs(p.qty), needUnits);
    if (r <= 0) continue;
    reductions[p.symbol] = p.qty > 0 ? r : -r;
    excess -= r * perUnitMargin;
    worst -= r * perUnitWorst;
  }

  const priceOf = Object.fromEntries(positions.map((p) => [p.symbol, p.price]));
  const reducedNotional = Object.entries(reductions).reduce((s, [sym, q]) => s + Math.abs(q) * priceOf[sym], 0);
  const frac = gross ? reducedNotional / gross : 0;
  let reason = `equity=${equity.toFixed(0)} margin_req=${req.toFixed(0)} worst=${worstBefore.toFixed(0)} reduce_frac=${frac.toFixed(2)}`;
  if (excess > 0) reason += " unresolved=frozen_positions";
  return {
    action: frac >= 0.5 ? "margin_call" : "reduce",
    equity,
    margin_required: req,
    worst_case_loss: worstBefore,
    reductions,
    reason,
  };
}
