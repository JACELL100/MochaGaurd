import Link from "next/link";

import { ConcentrationBars, HealthHistogram } from "@/components/charts/BookCharts";
import { Badge, Card, Empty, Mono, PageHeader, SourceBadge, Stat, VerifyLink } from "@/components/ui";
import { getBook } from "@/lib/api";
import { actionLabel, actionTone, compactMoney, etDateTime, int, lev, phaseLabel, pct, shares } from "@/lib/format";

export const metadata = { title: "Book console" };

export default async function BookConsole() {
  const { data, live, error } = await getBook();
  const s = data.summary;
  const actionable = data.decisions.filter((d) => d.action !== "hold");
  const brokerLossShare = s.gross_exposure ? s.broker_loss_at_p99 / s.gross_exposure : 0;

  return (
    <>
      <PageHeader
        title="Book risk console"
        subtitle={
          <>
            As of {etDateTime(s.ts)} · {phaseLabel(s.phase)}
            {s.phase === "closing_ramp" && <> · ramp {pct(s.ramp, 0)}</>} · {int(s.accounts)} accounts · {int(s.positions)} positions
          </>
        }
        right={
          <>
            <Badge tone={s.evaluate_ms < 100 ? "safe" : "danger"}>evaluate {s.evaluate_ms.toFixed(1)} ms</Badge>
            <SourceBadge live={live} error={error} />
          </>
        }
      />

      {data.ops_brief && (
        <Card title="Ops daily brief" subtitle="Generated from decided facts. The copilot narrates; it never decides." className="mb-6">
          <p className="text-[15px] leading-7 text-foreground/90">{data.ops_brief}</p>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Gross exposure" value={compactMoney(s.gross_exposure)} hint={`${lev(s.avg_leverage_used)} avg leverage used`} />
        <Stat label="Net equity" value={compactMoney(s.net_equity)} hint={`${pct(s.net_equity / Math.max(s.gross_exposure, 1), 0)} of gross`} />
        <Stat label="Worst-case loss (p99 gaps)" value={compactMoney(s.worst_case_loss)} hint="every position gaps to its p99" tone="warn" />
        <Stat
          label="Broker loss at p99"
          value={compactMoney(s.broker_loss_at_p99)}
          hint={`${pct(brokerLossShare, 3)} of gross`}
          tone={s.broker_loss_at_p99 > 0 ? "danger" : "safe"}
        />
        <Stat
          label="Accounts at risk"
          value={int(s.accounts_at_risk)}
          hint={`${s.reduce} reduce · ${s.margin_call} call · ${s.close} close`}
          tone={s.accounts_at_risk ? "warn" : "safe"}
        />
        <Stat
          label="Frozen symbols"
          value={s.frozen_symbols.length}
          hint={s.frozen_symbols.length ? s.frozen_symbols.join(", ") : "none"}
          tone={s.frozen_symbols.length ? "accent" : "neutral"}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Top-5 concentration" subtitle="Share of gross notional. Crowding shrinks allowed leverage.">
          {s.top_concentration.length ? <ConcentrationBars data={s.top_concentration} /> : <Empty>No positions.</Empty>}
        </Card>
        <Card title="Margin health" subtitle="Accounts by equity / margin required. Below 1.0 is flagged for the planner.">
          <HealthHistogram data={s.margin_health_hist} />
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card title="Earnings tonight" subtitle="Overnight limits use earnings-gap p99 for these names.">
          {s.earnings_tonight.length ? (
            <div className="flex flex-wrap gap-2">
              {s.earnings_tonight.map((sym) => (
                <Link key={sym} href={`/simulate?symbol=${sym}&earnings=1`}>
                  <Badge tone="warn" className="cursor-pointer hover:brightness-110">
                    {sym}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No reports between this close and the next open.</p>
          )}
        </Card>
        <Card title="Guards" subtitle="Frozen symbols are never liquidated or re-levered.">
          {s.frozen_symbols.length ? (
            <div className="flex flex-wrap gap-2">
              {s.frozen_symbols.map((sym) => (
                <Badge key={sym} tone="accent">
                  {sym} · frozen
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No splits, halts, stale prints or implausible moves.</p>
          )}
        </Card>
        <Card title="Demo flow" subtitle="Three minutes, end to end.">
          <ol className="space-y-1.5 text-sm text-foreground/85">
            <li>
              1. <Link className="text-accent hover:underline" href="/tonight">Tonight</Link>: the 2 AM problem, felt.
            </li>
            <li>
              2. <Link className="text-accent hover:underline" href="/replay">Replay</Link>: ramp, freeze, split, gap.
            </li>
            <li>
              3. <Link className="text-accent hover:underline" href="/verify">Verify</Link>: click a liquidation, prove it on-chain.
            </li>
          </ol>
        </Card>
      </div>

      <Card
        title="Pending decisions"
        subtitle={`${actionable.length} non-hold decisions at this evaluation. Every one is Merkle-anchored at end of day.`}
      >
        {actionable.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Decision</th>
                  <th className="pb-2 pr-4 font-medium">Account</th>
                  <th className="pb-2 pr-4 font-medium">Symbol</th>
                  <th className="pb-2 pr-4 font-medium">Action</th>
                  <th className="pb-2 pr-4 text-right font-medium">Max lev</th>
                  <th className="pb-2 pr-4 text-right font-medium">Adverse</th>
                  <th className="pb-2 pr-4 text-right font-medium">Reduce</th>
                  <th className="pb-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-border/60">
                {actionable.slice(0, 25).map((d, i) => (
                  <tr key={d.id ?? i} className="align-top">
                    <td className="py-2 pr-4">
                      <VerifyLink id={d.id} />
                    </td>
                    <td className="py-2 pr-4">
                      {d.account_id ? (
                        <Link href={`/tonight?account=${d.account_id}`} className="font-mono text-xs hover:text-accent">
                          {d.account_id}
                        </Link>
                      ) : (
                        <span className="text-muted">book</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-medium">{d.symbol ?? "–"}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={actionTone(d.action)}>{actionLabel(d.action)}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-right">{lev(d.max_leverage)}</td>
                    <td className="py-2 pr-4 text-right">{pct(d.adverse_move)}</td>
                    <td className="py-2 pr-4 text-right">{d.qty_to_reduce ? `${shares(d.qty_to_reduce)} sh` : "–"}</td>
                    <td className="py-2">
                      <Mono className="whitespace-nowrap">{d.reason}</Mono>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Every account holds. Nothing to do tonight.</Empty>
        )}
      </Card>
    </>
  );
}
