// Offline fallback that mirrors api/app/demo.py (DEMO_DAY = 2025-05-28, NVDA reports AMC,
// GME carries a synthetic split). Used only when FASTAPI_URL is unreachable so every page
// renders during development and demos. Numbers are produced by the same formulas as the
// Python engine via lib/engine.ts.

import {
  adverseMove,
  maxLeverage,
  phaseAt,
  plan,
  rampFraction,
  type PositionView,
} from "./engine";
import { lev, pct, shares, timeIn } from "./format";
import type {
  AccountSummary,
  AccountView,
  BookResponse,
  Decision,
  Explanation,
  LeverageResult,
  PositionRow,
  ReplayEvent,
  ReplayPoint,
  ReplayResult,
  SymbolRisk,
  TonightBriefing,
  TonightStatus,
  VerifyResult,
} from "./types";

export const DEMO_DAY = "2025-05-28";
export const NEXT_DAY = "2025-05-29";
const AS_OF = new Date("2025-05-28T15:30:00-04:00");
const DEADLINE_ET = new Date("2025-05-28T16:00:00-04:00");
// The briefing is issued at 15:30 but must describe the limits that bind once the closing
// ramp completes, so positions are evaluated against the full overnight adverse move.
const EVAL_TS = DEADLINE_ET;
const DERISK_ET = new Date("2025-05-28T15:45:00-04:00");
const DEMO_CONTRACT = "0x7A3f0C1d9B2e4F5a6c8D9e0F1a2B3c4D5e6F7a8B";
const DEMO_MODEL = "template-fallback";

// symbol, gap_p99, intraday_p99, earnings_gap_p99, adv_dollar, price
const UNIVERSE: Array<[string, number, number, number, number, number]> = [
  ["SPY", 0.02, 0.015, 0.02, 3.0e10, 590.0],
  ["QQQ", 0.025, 0.018, 0.025, 1.5e10, 520.0],
  ["AAPL", 0.035, 0.025, 0.08, 1.2e10, 200.0],
  ["MSFT", 0.03, 0.022, 0.07, 9.0e9, 455.0],
  ["NVDA", 0.08, 0.045, 0.18, 3.0e10, 135.0],
  ["TSLA", 0.09, 0.055, 0.16, 2.5e10, 360.0],
  ["AMZN", 0.045, 0.028, 0.11, 8.0e9, 205.0],
  ["META", 0.05, 0.03, 0.15, 7.0e9, 640.0],
  ["GOOGL", 0.04, 0.026, 0.09, 6.0e9, 170.0],
  ["AMD", 0.07, 0.045, 0.15, 4.0e9, 110.0],
  ["COIN", 0.12, 0.07, 0.2, 2.0e9, 250.0],
  ["MSTR", 0.15, 0.09, 0.22, 3.0e9, 370.0],
  ["PLTR", 0.1, 0.06, 0.22, 3.5e9, 120.0],
  ["SMCI", 0.18, 0.1, 0.3, 2.0e9, 40.0],
  ["GME", 0.2, 0.12, 0.3, 8.0e8, 30.0],
  ["CRM", 0.05, 0.03, 0.14, 1.5e9, 275.0],
  ["COST", 0.03, 0.02, 0.07, 2.0e9, 1010.0],
  ["IWM", 0.028, 0.02, 0.028, 4.0e9, 205.0],
  ["GLD", 0.02, 0.012, 0.02, 2.0e9, 305.0],
  ["SLV", 0.035, 0.022, 0.035, 6.0e8, 30.0],
  ["USO", 0.05, 0.03, 0.05, 4.0e8, 70.0],
  ["XBI", 0.045, 0.03, 0.045, 5.0e8, 80.0],
  ["SOFI", 0.09, 0.06, 0.18, 6.0e8, 13.0],
  ["RIVN", 0.11, 0.07, 0.22, 5.0e8, 15.0],
];

export const DEMO_SYMBOLS = UNIVERSE.map((u) => u[0]);
const PRICE: Record<string, number> = Object.fromEntries(UNIVERSE.map((u) => [u[0], u[5]]));
const RISK: Record<string, SymbolRisk> = Object.fromEntries(
  UNIVERSE.map(([symbol, gap_p99, intraday_p99, earnings_gap_p99, adv_dollar]) => [
    symbol,
    { symbol, gap_p99, intraday_p99, earnings_gap_p99, adv_dollar },
  ]),
);
const EARNINGS_TONIGHT = new Set(["NVDA", "CRM", "SMCI"]);
const FROZEN = new Set(["GME"]);

export function demoRisk(symbol: string): SymbolRisk | null {
  return RISK[symbol.toUpperCase()] ?? null;
}

// ------------------------------------------------------------------ accounts

interface DemoAccountDef {
  id: string;
  name: string;
  tz: string;
  equity: number;
  positions: Record<string, number>;
}

const ACCOUNTS: DemoAccountDef[] = [
  { id: "acct-0001", name: "Priya S.", tz: "Asia/Kolkata", equity: 25_000, positions: { NVDA: 1200, AAPL: 100 } },
  { id: "acct-0002", name: "Tom H.", tz: "Europe/London", equity: 80_000, positions: { SPY: 200, QQQ: 150 } },
  { id: "acct-0003", name: "Marcus L.", tz: "America/New_York", equity: 15_000, positions: { SMCI: 2500, COIN: 200 } },
  { id: "acct-0004", name: "Wei C.", tz: "Asia/Singapore", equity: 40_000, positions: { GME: 1500, TSLA: 150 } },
  { id: "acct-0005", name: "Omar A.", tz: "Asia/Dubai", equity: 12_000, positions: { MSTR: 250 } },
  { id: "acct-0006", name: "Lena K.", tz: "Europe/Berlin", equity: 60_000, positions: { AAPL: 150, MSFT: 60, GLD: 50 } },
];

interface Evaluated {
  view: AccountView;
  decisions: Decision[];
  status: TonightStatus;
}

function evaluateAccount(def: DemoAccountDef, index: number, ts = EVAL_TS): Evaluated {
  const gross = Object.entries(def.positions).reduce((s, [sym, q]) => s + q * PRICE[sym], 0);
  const cash = def.equity - gross;
  const views: PositionView[] = [];
  const rows: PositionRow[] = [];

  for (const [symbol, qty] of Object.entries(def.positions)) {
    const price = PRICE[symbol];
    const risk = RISK[symbol];
    const earnings = EARNINGS_TONIGHT.has(symbol);
    const notional = Math.abs(qty * price);
    const br = maxLeverage(risk, notional, ts, earnings);
    const adverse = adverseMove(risk, earnings, phaseAt(ts), rampFraction(ts));
    views.push({ symbol, qty, price, adverse, max_leverage: br.max_leverage, frozen: FROZEN.has(symbol) });
    rows.push({
      symbol,
      qty,
      price,
      notional: round2(notional),
      max_leverage: br.max_leverage,
      adverse_move: round4(adverse),
      earnings_tonight: earnings,
      frozen: FROZEN.has(symbol),
    });
  }

  const p = plan(cash, views);
  const decisions: Decision[] = [];
  let nextId = 1001 + index * 10;
  for (const v of views) {
    if (v.frozen) {
      decisions.push({
        id: nextId++,
        ts: AS_OF.toISOString(),
        account_id: null,
        symbol: v.symbol,
        action: "freeze",
        max_leverage: null,
        adverse_move: null,
        equity: null,
        margin_required: null,
        qty_to_reduce: null,
        reason: "guards=split_effective",
      });
    }
    const q = p.reductions[v.symbol];
    if (!q) continue;
    decisions.push({
      id: nextId++,
      ts: AS_OF.toISOString(),
      account_id: def.id,
      symbol: v.symbol,
      action: p.action,
      max_leverage: v.max_leverage,
      adverse_move: round4(v.adverse),
      equity: round2(p.equity),
      margin_required: round2(p.margin_required),
      qty_to_reduce: round4(q),
      reason: p.reason,
    });
  }

  const view: AccountView = {
    account_id: def.id,
    tz: def.tz,
    display_name: def.name,
    cash: round2(cash),
    equity: round2(p.equity),
    margin_required: round2(p.margin_required),
    worst_case_loss: round2(p.worst_case_loss),
    gross_exposure: round2(gross),
    margin_ratio: p.margin_required > 0 ? round3(p.equity / p.margin_required) : null,
    leverage_used: p.equity > 0 ? round2(gross / p.equity) : null,
    positions: rows,
  };
  const status: TonightStatus = p.action === "hold" ? "safe" : p.action === "close" ? "auto_derisk" : "action_needed";
  return { view, decisions, status };
}

export function demoAccounts(): AccountSummary[] {
  return ACCOUNTS.map((a, i) => {
    const e = evaluateAccount(a, i);
    return { id: a.id, display_name: a.name, tz: a.tz, equity: e.view.equity, status: e.status };
  });
}

export function demoAccountIds(): string[] {
  return ACCOUNTS.map((a) => a.id);
}

// ------------------------------------------------------------------ copilot templates

function explain(d: Decision, acct: AccountView, row: PositionRow | undefined): Explanation {
  const sym = d.symbol ?? "your position";
  const deadlineLocal = timeIn(DEADLINE_ET, acct.tz);
  const deriskLocal = timeIn(DERISK_ET, acct.tz);
  const adverse = pct(d.adverse_move ?? row?.adverse_move ?? 0, 0);
  const earnings = row?.earnings_tonight ?? false;
  const base: Omit<Explanation, "headline" | "body" | "action_hint"> = {
    decision_id: d.id,
    symbol: d.symbol,
    action: d.action,
    qty_to_reduce: d.qty_to_reduce,
    max_leverage: d.max_leverage,
    model: DEMO_MODEL,
  };

  if (d.action === "freeze") {
    return {
      ...base,
      headline: `${sym} is frozen tonight. Nothing will be liquidated.`,
      body: `${sym} has a corporate action effective today (${d.reason.replace("guards=", "").replace(/_/g, " ")}). Unadjusted prices look like a crash on split days, so the engine refuses to liquidate or re-lever ${sym} until clean prices arrive.`,
      action_hint: null,
    };
  }

  const why = earnings
    ? `${sym} reports earnings after the close. On earnings nights it has moved as much as ${adverse} (99th percentile), and at ${lev(acct.leverage_used)} that kind of gap would wipe out your account.`
    : `${sym} carries an overnight gap risk of ${adverse} at the 99th percentile. Your account cannot absorb that move at ${lev(acct.leverage_used)} leverage.`;

  if (d.action === "close") {
    return {
      ...base,
      headline: `We are closing your ${sym} position before the bell.`,
      body: `Your equity no longer covers the position. ${why}`,
      action_hint: `The position will be unwound at ${deriskLocal} your time with market-impact limits so you get the fairest fill available.`,
    };
  }

  const qty = shares(d.qty_to_reduce);
  const label = d.action === "margin_call" ? "Margin call" : "Heads up";
  return {
    ...base,
    headline: `${label}: ${sym} is capped at ${lev(d.max_leverage)} tonight.`,
    body: `${why} Overnight leverage is sized so a 99th-percentile move cannot take your account below zero.`,
    action_hint: `Sell ${qty} shares of ${sym} before 4:00 PM ET (${deadlineLocal} your time) to stay in control, or we will reduce it for you at 3:45 PM ET (${deriskLocal}).`,
  };
}

export function demoTonight(accountId: string): TonightBriefing | null {
  const index = ACCOUNTS.findIndex((a) => a.id === accountId);
  if (index < 0) return null;
  const e = evaluateAccount(ACCOUNTS[index], index);
  const rowsBySymbol = Object.fromEntries(e.view.positions.map((r) => [r.symbol, r]));
  const cards = e.decisions.map((d) => explain(d, e.view, d.symbol ? rowsBySymbol[d.symbol] : undefined));
  const actionable = e.decisions.filter((d) => d.action !== "freeze");
  const earningsNames = e.view.positions.filter((r) => r.earnings_tonight).map((r) => r.symbol);

  let headline: string;
  let summary: string;
  if (e.status === "safe") {
    headline = "You are safe tonight.";
    summary =
      `Even if every position gaps to its 99th-percentile worst case, your equity stays positive ` +
      `(worst-case loss ${pct(e.view.worst_case_loss / Math.max(e.view.equity, 1), 0)} of equity). ` +
      (earningsNames.length ? `${earningsNames.join(", ")} report tonight; your sizing already covers it. ` : "") +
      `No action required. Sleep well.`;
  } else if (e.status === "auto_derisk") {
    headline = "We are stepping in to protect your account.";
    summary = `Your equity is exhausted. Positions will be closed at 3:45 PM ET with impact-limited orders. Every decision is logged and anchored on-chain so you can verify it later.`;
  } else {
    headline = `Action needed before ${timeIn(DEADLINE_ET, e.view.tz)}.`;
    summary =
      `${actionable.length} position${actionable.length === 1 ? "" : "s"} exceed tonight's overnight leverage limit. ` +
      `Reduce them yourself before the 4:00 PM ET close, or the engine will trim exactly the amount required at 3:45 PM ET. ` +
      `Nothing more than necessary is ever sold.`;
  }

  return {
    account: e.view,
    status: e.status,
    as_of: AS_OF.toISOString(),
    deadline_et: DEADLINE_ET.toISOString(),
    deadline_local: timeIn(DEADLINE_ET, e.view.tz),
    local_time: timeIn(AS_OF, e.view.tz),
    headline,
    summary,
    cards,
    decisions: e.decisions,
    model: DEMO_MODEL,
  };
}

// ------------------------------------------------------------------ book console

export function demoBook(): BookResponse {
  const decisions = ACCOUNTS.flatMap((a, i) => evaluateAccount(a, i).decisions);
  return {
    summary: {
      ts: AS_OF.toISOString(),
      phase: "closing_ramp",
      ramp: 0,
      accounts: 2000,
      positions: 4987,
      gross_exposure: 193_400_000,
      net_equity: 86_200_000,
      worst_case_loss: 19_100_000,
      broker_loss_at_p99: 86_400,
      accounts_at_risk: 41,
      reduce: 28,
      margin_call: 11,
      close: 2,
      frozen_symbols: ["GME"],
      earnings_tonight: ["NVDA", "CRM", "SMCI"],
      top_concentration: [
        { symbol: "NVDA", notional: 42_548_000, share: 0.22 },
        { symbol: "TSLA", notional: 27_076_000, share: 0.14 },
        { symbol: "SPY", notional: 21_274_000, share: 0.11 },
        { symbol: "MSTR", notional: 15_472_000, share: 0.08 },
        { symbol: "AAPL", notional: 13_538_000, share: 0.07 },
      ],
      avg_leverage_used: 4.6,
      margin_health_hist: [
        { bucket: "<1.0", count: 41 },
        { bucket: "1.0-1.25", count: 118 },
        { bucket: "1.25-1.5", count: 204 },
        { bucket: "1.5-2", count: 466 },
        { bucket: "2-3", count: 611 },
        { bucket: ">3", count: 560 },
      ],
      evaluate_ms: 38.4,
    },
    ops_brief:
      "Tonight 41 accounts hold earnings names into the close; NVDA, CRM and SMCI all report after the bell. " +
      "Worst-case broker loss at p99 is $86k, concentrated in NVDA (22% of gross) and TSLA (14%). " +
      "28 accounts will be trimmed and 11 receive margin calls at 3:45 PM ET; 2 accounts are closing. " +
      "GME is frozen for a 4-for-1 split effective today and will not be touched. No halts are expected.",
    decisions,
  };
}

// ------------------------------------------------------------------ replay

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const DEMO_GAPS: Record<string, number> = { NVDA: -0.11, SMCI: -0.09, CRM: -0.06, MSTR: -0.05, COIN: -0.04 };

export function demoReplay(symbol = "NVDA"): ReplayResult {
  const sym = RISK[symbol.toUpperCase()] ? symbol.toUpperCase() : "NVDA";
  const risk = RISK[sym];
  const rng = mulberry32(sym.split("").reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0);
  const frozen = FROZEN.has(sym);
  const points: ReplayPoint[] = [];

  const session = (day: string, startMin: number, endMin: number, startPrice: number, earnings: boolean) => {
    const n = (endMin - startMin) / 5;
    const sigma = risk.intraday_p99 / 2.6 / Math.sqrt(n);
    let px = startPrice;
    for (let k = 0; k <= n; k++) {
      const mins = startMin + 5 * k;
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      const ts = new Date(`${day}T${hh}:${mm}:00-04:00`);
      if (k > 0) px *= 1 + gaussian(rng) * sigma;
      const br = maxLeverage(risk, 10_000, ts, earnings);
      points.push({
        ts: ts.toISOString(),
        price: round2(px),
        max_leverage: frozen ? 1 : br.max_leverage,
        phase: br.phase,
        ramp: round3(br.ramp),
        frozen,
      });
    }
    return px;
  };

  const startPx = PRICE[sym] * (1 - 0.004);
  const closePx = session(DEMO_DAY, 9 * 60 + 30, 16 * 60, startPx, EARNINGS_TONIGHT.has(sym));
  const gap = DEMO_GAPS[sym] ?? gaussian(rng) * (risk.gap_p99 / 3);
  session(NEXT_DAY, 9 * 60 + 30, 11 * 60, closePx * (1 + gap), false);

  const ev = (ts: string, kind: ReplayEvent["kind"], note: string, extra: Partial<ReplayEvent> = {}): ReplayEvent => ({
    ts: new Date(ts).toISOString(),
    kind,
    symbol: null,
    account_id: null,
    decision_id: null,
    qty: null,
    fill_price: null,
    slippage_bps: null,
    note,
    ...extra,
  });

  const events: ReplayEvent[] = [
    ev(`${DEMO_DAY}T09:30:00-04:00`, "freeze", "4-for-1 split effective today. Guard froze the symbol: no liquidation, no re-levering.", { symbol: "GME" }),
    ev(`${DEMO_DAY}T15:30:00-04:00`, "ramp_start", "Closing ramp begins: allowed leverage descends linearly toward the overnight level by 16:00."),
    ev(`${DEMO_DAY}T15:45:00-04:00`, "reduce", "Overnight survival check. Auto de-risk: sell 455 NVDA (earnings tonight, adverse 18%).", { symbol: "NVDA", account_id: "acct-0001", decision_id: 1001, qty: 455 }),
    ev(`${DEMO_DAY}T15:45:00-04:00`, "margin_call", "Margin call: trim 2,057 SMCI (earnings tonight, adverse 30%).", { symbol: "SMCI", account_id: "acct-0003", decision_id: 1021, qty: 2057 }),
    ev(`${DEMO_DAY}T15:45:00-04:00`, "reduce", "Auto de-risk: sell 87 MSTR (overnight gap risk 15%).", { symbol: "MSTR", account_id: "acct-0005", decision_id: 1041, qty: 87 }),
    ev(`${DEMO_DAY}T16:05:00-04:00`, "earnings", "NVDA, CRM and SMCI report after the close.", { symbol: "NVDA" }),
    ev(`${DEMO_DAY}T20:00:00-04:00`, "anchor", "Day's 61 decisions Merkle-anchored on Sepolia (root 0x8f2a…c41d)."),
    ev(`${NEXT_DAY}T09:30:00-04:00`, "gap", `${sym} opens ${pct(gap, 1)} versus the prior close.`, { symbol: sym }),
    ev(`${NEXT_DAY}T09:31:00-04:00`, "liquidation", "Open-bell unwind, worst margin ratio first. Participation capped at 10% of minute volume.", { symbol: "NVDA", account_id: "acct-0117", decision_id: 1042, qty: 800, fill_price: 119.62, slippage_bps: 44 }),
    ev(`${NEXT_DAY}T09:33:00-04:00`, "liquidation", "Second-worst margin ratio. 3-minute unwind to respect the participation cap.", { symbol: "SMCI", account_id: "acct-0388", decision_id: 1057, qty: 1500, fill_price: 35.71, slippage_bps: 71 }),
  ].sort((a, b) => a.ts.localeCompare(b.ts));

  return {
    date: DEMO_DAY,
    symbol: sym,
    symbols: DEMO_SYMBOLS,
    points,
    events,
    summary: {
      date: DEMO_DAY,
      broker_loss: 12_340,
      avg_leverage: 4.6,
      liquidations: 7,
      false_liquidations: 0,
      accounts_reduced: 41,
      split_day_liquidations: 0,
      evaluate_ms_p95: 41.2,
      decisions: 61,
    },
  };
}

// ------------------------------------------------------------------ simulate

export function demoLeverage(symbol: string, notional: number, ts: Date, earningsOverride?: boolean): LeverageResult | null {
  const risk = RISK[symbol.toUpperCase()];
  if (!risk) return null;
  const sym = symbol.toUpperCase();
  const earnings = earningsOverride ?? (EARNINGS_TONIGHT.has(sym) && ts.toISOString().slice(0, 10) === DEMO_DAY);
  const br = maxLeverage(risk, notional, ts, earnings);
  const frozen = FROZEN.has(sym) && ts.toISOString().slice(0, 10) === DEMO_DAY;
  const explanation = frozen
    ? `${sym} is frozen: a split is effective today, so the engine refuses to lever or liquidate it until adjusted prices settle.`
    : br.phase === "open"
      ? `During the open session you are only exposed to intraday moves, so ${sym} is sized against its ${pct(risk.intraday_p99, 1)} intraday p99 move. Slippage of ${pct(br.slippage, 2)} for your size is added before dividing the ${SAFETY_LABEL} safety budget.`
      : br.phase === "closing_ramp"
        ? `It is the closing ramp: leverage is gliding from the intraday limit to the overnight limit so nobody gets a cliff at 4:00 PM. ${Math.round(br.ramp * 100)}% of the way there, the adverse move is ${pct(br.adverse_move, 1)}.`
        : earnings
          ? `${sym} reports tonight. Overnight you are exposed to the earnings gap, historically up to ${pct(risk.earnings_gap_p99, 0)}, so the safety budget only supports ${lev(br.max_leverage)}.`
          : `Overnight you are exposed to the full gap risk. ${sym}'s 99th-percentile gap is ${pct(risk.gap_p99, 1)}, plus ${pct(br.slippage, 2)} slippage for your size.`;
  return {
    symbol: sym,
    max_leverage: frozen ? 1 : br.max_leverage,
    adverse_move: round4(br.adverse_move),
    slippage: round4(br.slippage),
    concentration_haircut: round3(br.concentration_haircut),
    phase: br.phase,
    ramp: round3(br.ramp),
    earnings_tonight: earnings,
    reason: frozen ? `${br.reason} FROZEN:split_effective` : br.reason,
    frozen,
    explanation,
    risk,
  };
}
const SAFETY_LABEL = "0.8";

// ------------------------------------------------------------------ verify

function fakeHash(seed: string): string {
  // deterministic 32-byte hex for demo purposes only (NOT keccak)
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let out = "";
  for (let i = 0; i < 8; i++) {
    for (const c of `${seed}:${i}`) {
      h1 = Math.imul(h1 ^ c.charCodeAt(0), 16777619) >>> 0;
      h2 = Math.imul(h2 + c.charCodeAt(0), 2246822519) >>> 0;
    }
    out += (h1 ^ h2).toString(16).padStart(8, "0");
  }
  return `0x${out}`;
}

export function demoVerify(decisionId: number): VerifyResult {
  const decisions = demoBook().decisions;
  const known = decisions.find((d) => d.id === decisionId);
  const inBatch = decisionId >= 1000 && decisionId < 1100;
  if (!inBatch) {
    return {
      decision_id: decisionId,
      found: false,
      valid: false,
      anchored: false,
      leaf_hash: null,
      merkle_root: null,
      merkle_path: [],
      tx_hash: null,
      contract_address: DEMO_CONTRACT,
      etherscan_url: null,
      batch_date: null,
      anchored_at: null,
      decision: null,
      error: `No decision ${decisionId} in the log.`,
    };
  }
  const tx = fakeHash(`tx:${DEMO_DAY}`);
  return {
    decision_id: decisionId,
    found: true,
    valid: true,
    anchored: true,
    leaf_hash: fakeHash(`leaf:${decisionId}`),
    merkle_root: fakeHash(`root:${DEMO_DAY}`),
    merkle_path: [1, 2, 3, 4, 5, 6].map((k) => fakeHash(`path:${decisionId}:${k}`)),
    tx_hash: tx,
    contract_address: DEMO_CONTRACT,
    etherscan_url: `https://sepolia.etherscan.io/tx/${tx}`,
    batch_date: DEMO_DAY,
    anchored_at: new Date(`${DEMO_DAY}T20:00:00-04:00`).toISOString(),
    decision: known ?? {
      id: decisionId,
      ts: new Date(`${NEXT_DAY}T09:31:00-04:00`).toISOString(),
      account_id: "acct-0117",
      symbol: "NVDA",
      action: "close",
      max_leverage: 4.41,
      adverse_move: 0.18,
      equity: -1240.5,
      margin_required: 21_800,
      qty_to_reduce: 800,
      reason: "equity=-1240<=0 gross=96000",
    },
    error: null,
  };
}

// ------------------------------------------------------------------ helpers

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
