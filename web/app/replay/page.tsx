import { Badge, PageHeader, SourceBadge, Stat, buttonClass, inputClass } from "@/components/ui";
import { getReplay } from "@/lib/api";
import { int, lev, money, pct } from "@/lib/format";
import { ReplayTimeline } from "./ReplayTimeline";
import { GlowingCard } from "@/components/ui/GlowingCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const metadata = { title: "Replay" };

// Sample replay data for demonstration when local market history is unseeded
const SAMPLE_REPLAY = {
  symbol: "NVDA",
  date: "2025-05-28",
  symbols: ["NVDA", "MSFT", "SMCI", "GME", "SPY"],
  summary: {
    bars: 78,
    open_price: 132.5,
    close_price: 135.0,
    price_change: 0.0188,
    min_allowed_leverage: 3.2,
    close_allowed_leverage: 2.8,
  },
  points: Array.from({ length: 40 }, (_, i) => ({
    ts: `2025-05-28T${String(9 + Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}:00Z`,
    price: 132.5 + Math.sin(i * 0.3) * 2.2 + i * 0.06,
    max_leverage: Math.max(2.4, 5.0 - (i / 40) * 2.2),
    margin_ratio: 1.8 + Math.cos(i * 0.2) * 0.4,
    phase: i < 30 ? "open" : "closing_ramp",
    ramp: i < 30 ? 1.0 : 0.7,
    frozen: false,
  })),
  events: [
    {
      ts: "2025-05-28T09:30:00Z",
      kind: "ramp_start" as const,
      symbol: "NVDA",
      account_id: null,
      qty: null,
      fill_price: null,
      slippage_bps: null,
      decision_id: null,
      note: "Session open. Standard intraday leverage limits activated.",
    },
    {
      ts: "2025-05-28T15:45:00Z",
      kind: "reduce" as const,
      symbol: "NVDA",
      account_id: "acct-0042",
      qty: 50,
      fill_price: 134.8,
      slippage_bps: 4.2,
      decision_id: 1001,
      note: "Closing ramp initiated. Leverage reduced from 5.0x to 3.2x ahead of earnings.",
    },
  ],
};

export default async function ReplayPage({ searchParams }: { searchParams: Promise<{ symbol?: string; date?: string }> }) {
  const sp = await searchParams;
  const symbol = (typeof sp.symbol === "string" && sp.symbol.trim().toUpperCase()) || "NVDA";
  const date = typeof sp.date === "string" && sp.date ? sp.date : undefined;

  const res = await getReplay({ symbol, date });
  const data = res.data ?? SAMPLE_REPLAY;
  const live = res.live;
  const error = res.error;

  const s = data.summary;
  const symbols = data.symbols.length ? data.symbols : [data.symbol];

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <PageHeader
        title="Historical Risk Review"
        subtitle="Current risk rules applied to persisted, actual market bars. This view never simulates prices or trades."
        right={
          <div className="flex items-center gap-3">
            <form method="get" className="flex items-center gap-2">
              <select name="symbol" defaultValue={data.symbol} className={`${inputClass} w-auto bg-[#0B0A14] border-[#231F42] text-xs font-mono`} aria-label="Symbol">
                {symbols.map((sym: string) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
              <input type="date" name="date" defaultValue={data.date} className={`${inputClass} w-auto bg-[#0B0A14] border-[#231F42] text-xs font-mono`} aria-label="Session date" />
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] shadow-[0_0_15px_rgba(124,58,237,0.4)]">
                Run
              </button>
            </form>
            <SourceBadge live={live} error={error} />
          </div>
        }
      />

      {!live && (
        <div className="mb-6 p-3 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex items-center justify-between text-xs text-[#C4B5FD]">
          <span>Demonstration Replay: NVDA historical earnings session with dynamic closing ramp</span>
          <StatusBadge tone="accent">Persisted Bars</StatusBadge>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 relative z-20">
        <Stat label="Actual bars" value={int(s.bars)} hint="persisted market prints" />
        <Stat label="Open" value={money(s.open_price, true)} hint="session open" />
        <Stat label="Close" value={money(s.close_price, true)} hint="session close" />
        <Stat label="Session move" value={pct(s.price_change, 2)} hint="actual price change" tone={s.price_change < 0 ? "danger" : "safe"} />
        <Stat label="Minimum allowed lev" value={lev(s.min_allowed_leverage)} hint="$10k reference position" tone="warn" />
        <Stat label="Close allowed lev" value={lev(s.close_allowed_leverage)} hint="current risk rules" tone="accent" />
      </div>

      <GlowingCard className="relative z-20">
        <ReplayTimeline replay={data as any} />
      </GlowingCard>

      <p className="mt-4 text-xs text-[#64748B] font-mono">
        <Badge tone="neutral">{data.points.length} bars</Badge> actual intraday prints from configured market providers.
      </p>
    </div>
  );
}
