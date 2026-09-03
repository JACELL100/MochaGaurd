import { Badge, PageHeader, SourceBadge, Stat, buttonClass, inputClass } from "@/components/ui";
import { getReplay } from "@/lib/api";
import { compactMoney, int, lev } from "@/lib/format";

import { ReplayTimeline } from "./ReplayTimeline";

export const metadata = { title: "Replay" };

export default async function ReplayPage({ searchParams }: PageProps<"/replay">) {
  const sp = await searchParams;
  const symbol = (typeof sp.symbol === "string" && sp.symbol.trim().toUpperCase()) || "NVDA";
  const date = typeof sp.date === "string" && sp.date ? sp.date : undefined;

  const { data, live, error } = await getReplay({ symbol, date });
  const s = data.summary;
  const symbols = data.symbols.length ? data.symbols : [data.symbol];

  return (
    <>
      <PageHeader
        title="Replay"
        subtitle="Simulated clock threaded through the engine. No wall-clock, no look-ahead: prices are filtered to ts ≤ now."
        right={
          <>
            <form method="get" className="flex items-center gap-2">
              <select name="symbol" defaultValue={data.symbol} className={`${inputClass} w-auto`} aria-label="Symbol">
                {symbols.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
              <input type="date" name="date" defaultValue={data.date} className={`${inputClass} w-auto`} aria-label="Session date" />
              <button type="submit" className={buttonClass}>
                Run
              </button>
            </form>
            <SourceBadge live={live} error={error} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Broker loss" value={compactMoney(s.broker_loss)} hint="after slippage-modelled unwinds" tone={s.broker_loss > 0 ? "danger" : "safe"} />
        <Stat label="Avg leverage" value={lev(s.avg_leverage)} hint="capital efficiency, not safe-and-useless" />
        <Stat label="Liquidations" value={int(s.liquidations)} hint={`${int(s.accounts_reduced)} accounts trimmed at 15:45`} />
        <Stat
          label="False liquidations"
          value={int(s.false_liquidations)}
          hint="closed positions that would have recovered"
          tone={s.false_liquidations === 0 ? "safe" : "warn"}
        />
        <Stat
          label="Split-day liquidations"
          value={int(s.split_day_liquidations)}
          hint={s.split_day_liquidations === 0 ? "guard held: day qualifies" : "DISQUALIFIED"}
          tone={s.split_day_liquidations === 0 ? "safe" : "danger"}
        />
        <Stat label="evaluate p95" value={`${s.evaluate_ms_p95.toFixed(0)} ms`} hint={`${int(s.decisions)} decisions logged`} tone={s.evaluate_ms_p95 < 100 ? "safe" : "danger"} />
      </div>

      <ReplayTimeline replay={data} />

      <p className="mt-4 text-xs text-muted">
        <Badge tone="neutral">{data.points.length} bars</Badge> five-minute resolution across the session close and the next open.
      </p>
    </>
  );
}
