import { Badge, PageHeader, SourceBadge, Stat, buttonClass, inputClass } from "@/components/ui";
import { getReplay } from "@/lib/api";
import { int, lev, money, pct } from "@/lib/format";

import { ReplayTimeline } from "./ReplayTimeline";

export const metadata = { title: "Replay" };

export default async function ReplayPage({ searchParams }: { searchParams: Promise<{ symbol?: string; date?: string }> }) {
  const sp = await searchParams;
  const symbol = (typeof sp.symbol === "string" && sp.symbol.trim().toUpperCase()) || "NVDA";
  const date = typeof sp.date === "string" && sp.date ? sp.date : undefined;

  const { data, live, error } = await getReplay({ symbol, date });
  if (!data) {
    return <>
      <PageHeader title="Historical risk review" subtitle="Current risk rules applied only to persisted Alpha Vantage bars." right={<SourceBadge live={false} error={error} />} />
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{error ?? "No real intraday history is available."}</p>
    </>;
  }
  const s = data.summary;
  const symbols = data.symbols.length ? data.symbols : [data.symbol];

  return (
    <>
      <PageHeader
        title="Historical risk review"
        subtitle="Current risk rules applied to persisted, actual Alpha Vantage bars. This view never simulates prices or trades."
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
        <Stat label="Actual bars" value={int(s.bars)} hint="persisted from Alpha Vantage" />
        <Stat label="Open" value={money(s.open_price, true)} hint="first persisted bar" />
        <Stat label="Close" value={money(s.close_price, true)} hint="last persisted bar" />
        <Stat label="Session move" value={pct(s.price_change, 2)} hint="actual bar-to-bar change" tone={s.price_change < 0 ? "danger" : "safe"} />
        <Stat label="Minimum allowed lev" value={lev(s.min_allowed_leverage)} hint="for a $10k reference position" tone="warn" />
        <Stat label="Close allowed lev" value={lev(s.close_allowed_leverage)} hint="under current risk rules" tone="accent" />
      </div>

      <ReplayTimeline replay={data} />

      <p className="mt-4 text-xs text-muted">
        <Badge tone="neutral">{data.points.length} bars</Badge> actual persisted intraday prints; availability depends on the live quote history already ingested.
      </p>
    </>
  );
}
