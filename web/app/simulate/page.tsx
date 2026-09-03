import { LeverageCurve } from "@/components/charts/LeverageCurve";
import { Badge, Card, Empty, Mono, PageHeader, SourceBadge, Stat, buttonClass, inputClass } from "@/components/ui";
import { getLeverage } from "@/lib/api";
import { DEMO_DAY, DEMO_SYMBOLS } from "@/lib/demo";
import { etWallClock } from "@/lib/engine";
import { etDateTime, lev, money, pct, phaseLabel } from "@/lib/format";

export const metadata = { title: "Simulate" };

const PRESETS: Array<{ label: string; time: string }> = [
  { label: "Open 09:30", time: "09:30" },
  { label: "Midday 12:00", time: "12:00" },
  { label: "Ramp 15:45", time: "15:45" },
  { label: "Closed 16:30", time: "16:30" },
];

export default async function SimulatePage({ searchParams }: PageProps<"/simulate">) {
  const sp = await searchParams;
  const symbol = (typeof sp.symbol === "string" && sp.symbol.trim().toUpperCase()) || "NVDA";
  const notional = Math.max(0, Number(typeof sp.notional === "string" ? sp.notional : "") || 50_000);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : DEMO_DAY;
  const time = typeof sp.time === "string" && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : "15:45";
  const earningsParam = typeof sp.earnings === "string" ? sp.earnings : undefined;
  const earnings = earningsParam === "1" ? true : earningsParam === "0" ? false : undefined;

  const ts = etWallClock(date, time);
  const { data: r, live, error } = await getLeverage({ symbol, notional, ts, earnings_tonight: earnings });
  const cursorMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const symbols = DEMO_SYMBOLS.includes(symbol) ? DEMO_SYMBOLS : [symbol, ...DEMO_SYMBOLS];

  return (
    <>
      <PageHeader
        title="Leverage simulator"
        subtitle="max_leverage = SAFETY / (adverse_move + slippage), haircut for concentration, capped at 20x."
        right={<SourceBadge live={live} error={error} />}
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card title="Inputs">
          <form method="get" className="space-y-4 text-sm">
            <label className="block text-muted">
              Symbol
              <select name="symbol" defaultValue={symbol} className={`${inputClass} mt-1`}>
                {symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-muted">
              Position size (USD notional)
              <input name="notional" type="number" min={0} step={1000} defaultValue={notional} className={`${inputClass} mt-1 font-mono`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-muted">
                Session date
                <input name="date" type="date" defaultValue={date} className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-muted">
                Time (ET)
                <input name="time" type="time" defaultValue={time} step={300} className={`${inputClass} mt-1`} />
              </label>
            </div>
            <fieldset className="text-muted">
              <legend className="mb-1">Earnings tonight</legend>
              <div className="flex gap-3">
                {[
                  ["", "Auto (calendar)"],
                  ["1", "Force yes"],
                  ["0", "Force no"],
                ].map(([v, label]) => (
                  <label key={v} className="flex items-center gap-1.5">
                    <input type="radio" name="earnings" value={v} defaultChecked={(earningsParam ?? "") === v} className="accent-accent" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.time} type="submit" name="time" value={p.time} className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent/50 hover:text-foreground">
                  {p.label}
                </button>
              ))}
            </div>
            <button type="submit" className={`${buttonClass} w-full`}>
              Compute
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          {!r ? (
            <Empty>
              Unknown symbol <Mono>{symbol}</Mono>. The engine has no precomputed risk stats for it.
            </Empty>
          ) : (
            <>
              <Card>
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                      Allowed leverage · {r.symbol} · {money(notional)} · {etDateTime(ts)}
                    </div>
                    <div className={`tabular mt-1 text-6xl font-semibold tracking-tight ${r.frozen ? "text-accent" : "text-foreground"}`}>
                      {r.frozen ? "Frozen" : lev(r.max_leverage)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={r.phase === "closing_ramp" ? "warn" : r.phase === "open" ? "safe" : "neutral"}>
                        {phaseLabel(r.phase)}
                        {r.phase === "closing_ramp" && ` · ramp ${pct(r.ramp, 0)}`}
                      </Badge>
                      {r.earnings_tonight && <Badge tone="warn">earnings tonight</Badge>}
                      {r.frozen && <Badge tone="accent">guard: frozen</Badge>}
                      {r.max_leverage >= 20 && !r.frozen && <Badge tone="accent">headline cap</Badge>}
                    </div>
                  </div>
                  <div className="max-w-md text-sm leading-6 text-foreground/85">
                    {r.explanation ?? "No narration available for this decision."}
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Adverse move" value={pct(r.adverse_move, 1)} hint={r.earnings_tonight ? "earnings-gap p99" : r.phase === "open" ? "intraday p99" : "overnight gap p99"} tone="warn" />
                <Stat label="Slippage" value={pct(r.slippage, 2)} hint={r.risk ? `${pct(notional / r.risk.adv_dollar, 3)} of ADV$` : "own market impact"} />
                <Stat label="Concentration haircut" value={`×${r.concentration_haircut.toFixed(2)}`} hint={r.concentration_haircut < 1 ? "size > 1% of ADV$" : "no haircut"} tone={r.concentration_haircut < 1 ? "warn" : "neutral"} />
                <Stat label="Safety budget" value="0.80" hint="tuned against replay broker loss" tone="accent" />
              </div>

              {r.risk && (
                <Card
                  title="Allowed leverage across the session"
                  subtitle={`Same symbol and size, every 5 minutes. gap p99 ${pct(r.risk.gap_p99, 1)} · intraday p99 ${pct(r.risk.intraday_p99, 1)} · earnings gap p99 ${pct(r.risk.earnings_gap_p99, 0)}`}
                >
                  <LeverageCurve risk={r.risk} notional={notional} earningsTonight={r.earnings_tonight} date={date} cursorMinutes={cursorMinutes} />
                </Card>
              )}

              <Card title="Engine reason string" subtitle="This is what the copilot narrates. Every number in the explanation must appear here.">
                <Mono className="block whitespace-pre-wrap break-all">{r.reason}</Mono>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
