import Link from "next/link";

import { Badge, Banner, Card, Empty, Mono, PageHeader, SourceBadge, Stat, VerifyLink } from "@/components/ui";
import { getAccounts, getTonight } from "@/lib/api";
import {
  actionLabel,
  actionTone,
  etTime,
  lev,
  money,
  pct,
  shares,
  statusTone,
  timeIn,
  tzCity,
} from "@/lib/format";
import type { Explanation } from "@/lib/types";
import { AccountPicker } from "./AccountPicker";
import { GlowingCard } from "@/components/ui/GlowingCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Moon, ShieldCheck, Clock, Terminal } from "lucide-react";

export const metadata = { title: "Tonight" };

// High-fidelity fallback sample for previewing when local database is unseeded
const SAMPLE_BRIEFING = {
  account: {
    account_id: "acct-0042",
    display_name: "Vega Alpha Fund (Sample Preview)",
    tz: "America/New_York",
    equity: 125000,
    cash: 38000,
    gross_exposure: 345000,
    leverage_used: 2.76,
    margin_required: 48500,
    margin_ratio: 2.58,
    worst_case_loss: 42000,
    positions: [
      { symbol: "NVDA", qty: 450, price: 178.5, notional: 80325, max_leverage: 3.2, adverse_move: 0.18, earnings_tonight: true, frozen: false },
      { symbol: "MSFT", qty: 300, price: 445.2, notional: 133560, max_leverage: 5.5, adverse_move: 0.045, earnings_tonight: false, frozen: false },
      { symbol: "SMCI", qty: 250, price: 42.0, notional: 10500, max_leverage: 2.1, adverse_move: 0.28, earnings_tonight: true, frozen: false },
      { symbol: "GME", qty: 500, price: 28.5, notional: 14250, max_leverage: 1.0, adverse_move: 0.35, earnings_tonight: false, frozen: true },
    ],
  },
  status: "warn" as const,
  headline: "Overnight Gap Buffer Alert: NVDA & SMCI Report Tonight",
  summary: "Initial margin requirements have been dynamically ramped to 35% across earnings-exposed tech equities. Close-out deadline is 15:45 ET to avoid forced liquidation before 20:00 ET Sepolia anchoring.",
  as_of: new Date().toISOString(),
  local_time: "15:42 ET",
  deadline_local: "15:45 ET",
  deadline_et: "3 minutes to closing bell",
  cards: [
    {
      decision_id: 1042,
      action: "reduce" as const,
      headline: "Trim SMCI by 80 shares ahead of after-hours release",
      body: "High concentration combined with 28% historical earnings gap p99 exceeds the $125k portfolio equity safety budget.",
      action_hint: "Sell 80 shares of SMCI at market or add $12,500 collateral before 15:45 ET.",
      max_leverage: 2.1,
      model: "qwen/qwen3.8-27b (Strict Grounding)",
    },
    {
      decision_id: 1043,
      action: "freeze" as const,
      headline: "GME Position Frozen (Corporate Action Guard)",
      body: "Split pending execution. Position is protected against automatic liquidation or margin calls.",
      action_hint: "No action required. Position automatically unfreezes upon split completion.",
      max_leverage: 1.0,
      model: "qwen/qwen3.8-27b (Strict Grounding)",
    },
  ],
  decisions: [
    { id: 1042, action: "reduce" as const, symbol: "SMCI", qty_to_reduce: 80, reason: "earnings_p99_exceeded: gap 0.28 > allowed 0.12" },
    { id: 1043, action: "freeze" as const, symbol: "GME", qty_to_reduce: 0, reason: "corporate_action_split_pending: freeze_guard_active" },
  ],
  model: "qwen/qwen3.8-27b (Groq)",
};

export default async function TonightPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const accountsRes = await getAccounts();
  const accounts = accountsRes.data ?? [];

  const requested = typeof account === "string" ? account : undefined;
  const fallback = accounts.find((a) => a.status !== "safe") ?? accounts[0];
  const selected = requested ?? fallback?.id;

  const tonightRes = selected ? await getTonight(selected) : null;
  const briefing = tonightRes?.data ?? (accounts.length === 0 ? SAMPLE_BRIEFING : null);
  const live = accountsRes.live && (tonightRes?.live ?? true);
  const error = accountsRes.error ?? tonightRes?.error ?? null;

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <PageHeader
        title="Tonight (The 2 AM Problem)"
        subtitle="The sleep-safe briefing a trader reviews before bed. Every sentence is a decided fact, translated."
        right={
          <div className="flex items-center gap-3">
            {selected && accounts.length > 0 && <AccountPicker accounts={accounts} selected={selected} />}
            <SourceBadge live={live} error={error} />
          </div>
        }
      />

      {briefing && <Briefing b={briefing} isPreview={!live} />}
    </div>
  );
}

function Briefing({ b, isPreview = false }: { b: any; isPreview?: boolean }) {
  const a = b.account;
  const tone = statusTone(b.status);
  const icon = b.status === "safe" ? "✅" : b.status === "auto_derisk" ? "🛑" : "⚠️";
  const actionable = b.cards.filter((c: any) => c.action !== "freeze");
  const frozen = b.cards.filter((c: any) => c.action === "freeze");

  return (
    <div className="space-y-6 relative z-20">
      {isPreview && (
        <div className="p-3 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex items-center justify-between text-xs text-[#C4B5FD]">
          <span>Interactive Preview Mode: Demonstrating overnight margin briefing telemetry</span>
          <StatusBadge tone="accent">Sample Portfolio</StatusBadge>
        </div>
      )}

      <Banner
        tone={tone}
        icon={icon}
        title={b.headline}
        body={b.summary}
        aside={
          <div className="rounded-xl border border-[#231F42] bg-[#0B0A14]/80 px-4 py-3 text-sm">
            <div className="text-[11px] uppercase tracking-wider text-[#94A3B8]">
              {a.display_name ?? a.account_id} · {tzCity(a.tz)}
            </div>
            <div className="tabular mt-1 text-lg font-semibold text-white">{b.local_time} local</div>
            <div className="mt-0.5 text-xs text-[#64748B]">
              {etTime(b.as_of)} in New York · deadline {b.deadline_local} ({b.deadline_et})
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Equity" value={money(a.equity)} hint={`cash ${money(a.cash)}`} />
        <Stat label="Gross exposure" value={money(a.gross_exposure)} hint={`${lev(a.leverage_used)} leverage used`} />
        <Stat
          label="Margin required"
          value={money(a.margin_required)}
          hint={a.margin_ratio !== null ? `ratio ${a.margin_ratio.toFixed(2)}` : "no positions"}
          tone={a.margin_ratio !== null && a.margin_ratio < 1 ? "danger" : "neutral"}
        />
        <Stat
          label="Worst case tonight"
          value={money(a.worst_case_loss)}
          hint={`${pct(a.worst_case_loss / Math.max(a.equity, 1), 0)} of equity at p99`}
          tone={a.worst_case_loss >= a.equity ? "danger" : "warn"}
        />
        <Stat label="Deadline" value={b.deadline_local} hint={b.deadline_et} tone="accent" />
      </div>

      {actionable.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-white">What to do before {b.deadline_local}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {actionable.map((c: any, i: number) => (
              <ExplanationCard key={c.decision_id ?? i} c={c} tz={a.tz} />
            ))}
          </div>
        </section>
      )}

      {frozen.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {frozen.map((c: any, i: number) => (
            <ExplanationCard key={c.decision_id ?? `f${i}`} c={c} tz={a.tz} />
          ))}
        </section>
      )}

      <GlowingCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Active Account Positions</h3>
            <p className="text-xs text-[#94A3B8]">Allowed leverage is per position: overnight gap risk, earnings, and liquidity footprint.</p>
          </div>
          <Link href={`/simulate?symbol=${a.positions[0]?.symbol ?? "NVDA"}`} className="text-xs text-[#A78BFA] hover:underline">
            Open in simulator →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="text-left text-[11px] uppercase tracking-wider text-[#64748B] border-b border-[#1C1836]">
              <tr>
                <th className="pb-2.5 pr-4 font-medium">Symbol</th>
                <th className="pb-2.5 pr-4 text-right font-medium">Qty</th>
                <th className="pb-2.5 pr-4 text-right font-medium">Price</th>
                <th className="pb-2.5 pr-4 text-right font-medium">Notional</th>
                <th className="pb-2.5 pr-4 text-right font-medium">Allowed Lev</th>
                <th className="pb-2.5 pr-4 text-right font-medium">p99 Move</th>
                <th className="pb-2.5 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-[#1C1836]/60">
              {a.positions.map((p: any) => (
                <tr key={p.symbol} className="hover:bg-[#121024]/40 transition-colors">
                  <td className="py-2.5 pr-4 font-semibold text-white">{p.symbol}</td>
                  <td className="py-2.5 pr-4 text-right text-[#CBD5E1]">{shares(p.qty)}</td>
                  <td className="py-2.5 pr-4 text-right text-[#CBD5E1]">{money(p.price, true)}</td>
                  <td className="py-2.5 pr-4 text-right text-white">{money(p.notional)}</td>
                  <td className="py-2.5 pr-4 text-right text-[#C4B5FD]">{lev(p.max_leverage)}</td>
                  <td className="py-2.5 pr-4 text-right text-[#CBD5E1]">{pct(p.adverse_move)}</td>
                  <td className="py-2.5">
                    <div className="flex gap-1.5">
                      {p.earnings_tonight && <StatusBadge tone="warn">Earnings Tonight</StatusBadge>}
                      {p.frozen && <StatusBadge tone="accent">Frozen</StatusBadge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlowingCard>
    </div>
  );
}

function ExplanationCard({ c, tz }: { c: any; tz: string }) {
  const tone = actionTone(c.action);
  return (
    <GlowingCard className="h-full flex flex-col justify-between">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <Badge tone={tone}>{actionLabel(c.action)}</Badge>
          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            {c.max_leverage !== null && <span>cap {lev(c.max_leverage)}</span>}
            <VerifyLink id={c.decision_id} />
          </div>
        </div>
        <h3 className="text-base font-bold text-white leading-snug">{c.headline}</h3>
        <p className="mt-2 text-xs leading-relaxed text-[#CBD5E1]">{c.body}</p>
        {c.action_hint && (
          <div className="mt-4 rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-4 py-3 text-xs text-white">
            <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]">Action Required</span>
            {c.action_hint}
          </div>
        )}
      </div>
      <p className="mt-4 pt-3 border-t border-[#1C1836] text-[10px] text-[#64748B] font-mono">
        Local timezone {tz} · Grounded LLM: {c.model}
      </p>
    </GlowingCard>
  );
}
