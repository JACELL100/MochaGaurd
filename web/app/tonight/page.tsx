import Link from "next/link";

import { Badge, Banner, Card, Empty, Mono, PageHeader, SourceBadge, Stat, VerifyLink } from "@/components/ui";
import { getAccounts, getTonight } from "@/lib/api";
import {
  actionLabel,
  actionTone,
  dateTimeIn,
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

export const metadata = { title: "Tonight" };

export default async function TonightPage({ searchParams }: PageProps<"/tonight">) {
  const { account } = await searchParams;
  const accountsRes = await getAccounts();
  const accounts = accountsRes.data;

  const requested = typeof account === "string" ? account : undefined;
  const fallback = accounts.find((a) => a.status !== "safe") ?? accounts[0];
  const selected = requested ?? fallback?.id;

  const tonightRes = selected ? await getTonight(selected) : null;
  const briefing = tonightRes?.data ?? null;
  const live = accountsRes.live && (tonightRes?.live ?? true);
  const error = accountsRes.error ?? tonightRes?.error ?? null;

  return (
    <>
      <PageHeader
        title="Tonight"
        subtitle="The sleep-safe briefing a user reads before bed. Every sentence is a decided fact, translated."
        right={
          <>
            {selected && <AccountPicker accounts={accounts} selected={selected} />}
            <SourceBadge live={live} error={error} />
          </>
        }
      />

      {!briefing ? (
        <Empty>
          {selected ? (
            <>
              No briefing for <Mono>{selected}</Mono>. Pick another account above.
            </>
          ) : (
            "No accounts loaded."
          )}
        </Empty>
      ) : (
        <Briefing b={briefing} />
      )}
    </>
  );
}

function Briefing({ b }: { b: NonNullable<Awaited<ReturnType<typeof getTonight>>["data"]> }) {
  const a = b.account;
  const tone = statusTone(b.status);
  const icon = b.status === "safe" ? "✅" : b.status === "auto_derisk" ? "🛑" : "⚠️";
  const actionable = b.cards.filter((c) => c.action !== "freeze");
  const frozen = b.cards.filter((c) => c.action === "freeze");

  return (
    <div className="space-y-6">
      <Banner
        tone={tone}
        icon={icon}
        title={b.headline}
        body={b.summary}
        aside={
          <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm">
            <div className="text-[11px] uppercase tracking-wider text-muted">
              {a.display_name ?? a.account_id} · {tzCity(a.tz)}
            </div>
            <div className="tabular mt-1 text-lg font-semibold">{b.local_time} local</div>
            <div className="mt-0.5 text-xs text-muted">
              {etTime(b.as_of)} in New York · deadline {b.deadline_local} ({etTime(b.deadline_et)})
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
        <Stat label="Deadline" value={b.deadline_local} hint={dateTimeIn(b.deadline_et, a.tz)} tone="accent" />
      </div>

      {actionable.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide">What to do before {b.deadline_local}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {actionable.map((c, i) => (
              <ExplanationCard key={c.decision_id ?? i} c={c} tz={a.tz} />
            ))}
          </div>
        </section>
      )}

      {frozen.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {frozen.map((c, i) => (
            <ExplanationCard key={c.decision_id ?? `f${i}`} c={c} tz={a.tz} />
          ))}
        </section>
      )}

      <Card
        title="Positions"
        subtitle="Allowed leverage is per position: overnight gap risk, earnings and your own market footprint."
        action={
          <Link href={`/simulate?symbol=${a.positions[0]?.symbol ?? "NVDA"}`} className="text-xs text-accent hover:underline">
            Open in simulator →
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="pb-2 pr-4 font-medium">Symbol</th>
                <th className="pb-2 pr-4 text-right font-medium">Qty</th>
                <th className="pb-2 pr-4 text-right font-medium">Price</th>
                <th className="pb-2 pr-4 text-right font-medium">Notional</th>
                <th className="pb-2 pr-4 text-right font-medium">Allowed lev</th>
                <th className="pb-2 pr-4 text-right font-medium">p99 move</th>
                <th className="pb-2 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-border/60">
              {a.positions.map((p) => (
                <tr key={p.symbol}>
                  <td className="py-2 pr-4 font-medium">{p.symbol}</td>
                  <td className="py-2 pr-4 text-right">{shares(p.qty)}</td>
                  <td className="py-2 pr-4 text-right">{money(p.price, true)}</td>
                  <td className="py-2 pr-4 text-right">{money(p.notional)}</td>
                  <td className="py-2 pr-4 text-right">{lev(p.max_leverage)}</td>
                  <td className="py-2 pr-4 text-right">{pct(p.adverse_move)}</td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      {p.earnings_tonight && <Badge tone="warn">earnings tonight</Badge>}
                      {p.frozen && <Badge tone="accent">frozen</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {b.decisions.length > 0 && (
        <Card title="Engine decisions behind this briefing" subtitle={`Narrated by ${b.model}. Click an ID to verify it on-chain.`}>
          <ul className="space-y-2 text-sm">
            {b.decisions.map((d, i) => (
              <li key={d.id ?? i} className="flex flex-wrap items-center gap-2">
                <VerifyLink id={d.id} />
                <Badge tone={actionTone(d.action)}>{actionLabel(d.action)}</Badge>
                <span className="font-medium">{d.symbol ?? "account"}</span>
                {d.qty_to_reduce ? <span className="text-muted">sell {shares(d.qty_to_reduce)} sh</span> : null}
                <Mono className="text-muted">{d.reason}</Mono>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs text-muted">
        Times shown in {a.tz}; the engine works in America/New_York. Briefing generated at {timeIn(b.as_of, a.tz)}.
      </p>
    </div>
  );
}

function ExplanationCard({ c, tz }: { c: Explanation; tz: string }) {
  const tone = actionTone(c.action);
  return (
    <article className={`rounded-xl border p-5 ${tone === "danger" ? "border-danger/40" : tone === "warn" ? "border-warn/40" : "border-accent/40"} bg-surface`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Badge tone={tone}>{actionLabel(c.action)}</Badge>
        <div className="flex items-center gap-2 text-xs text-muted">
          {c.max_leverage !== null && <span>cap {lev(c.max_leverage)}</span>}
          <VerifyLink id={c.decision_id} />
        </div>
      </div>
      <h3 className="text-lg font-semibold leading-snug">{c.headline}</h3>
      <p className="mt-2 text-sm leading-6 text-foreground/85">{c.body}</p>
      {c.action_hint && (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-wider text-accent">Do this</span>
          {c.action_hint}
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted">Local timezone {tz}. Model: {c.model}</p>
    </article>
  );
}
