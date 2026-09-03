"use client";

import { Area, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { etIsoOffset, maxLeverage } from "@/lib/engine";
import { lev } from "@/lib/format";
import type { SymbolRisk } from "@/lib/types";

// Allowed leverage across a full ET session for the given symbol/size.
// Computed client-side with the TS port of the engine; purely illustrative.
export function LeverageCurve({
  risk,
  notional,
  earningsTonight,
  date,
  cursorMinutes,
}: {
  risk: SymbolRisk;
  notional: number;
  earningsTonight: boolean;
  date: string; // YYYY-MM-DD, interpreted in ET
  cursorMinutes?: number | null;
}) {
  const offset = etIsoOffset(date);
  const data: Array<{ m: number; label: string; leverage: number }> = [];
  for (let m = 9 * 60; m <= 17 * 60; m += 5) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const ts = new Date(`${date}T${hh}:${mm}:00${offset}`);
    data.push({ m, label: `${hh}:${mm}`, leverage: maxLeverage(risk, notional, ts, earningsTonight).max_leverage });
  }
  const ticks = [9 * 60 + 30, 12 * 60, 15 * 60 + 30, 16 * 60];
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: -12, right: 12, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="levFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4a05a" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#d4a05a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="m"
            type="number"
            domain={[9 * 60, 17 * 60]}
            ticks={ticks}
            tickFormatter={(m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`}
            tick={{ fill: "#948a7d", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis domain={[0, 20]} tick={{ fill: "#948a7d", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}x`} />
          <Tooltip
            contentStyle={{ background: "#1d1916", border: "1px solid #2b251f", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#948a7d" }}
            itemStyle={{ color: "#f3ede6" }}
            labelFormatter={(m) => `${Math.floor(Number(m) / 60)}:${String(Number(m) % 60).padStart(2, "0")} ET`}
            formatter={(v) => [lev(Number(v)), "Allowed leverage"]}
          />
          <ReferenceLine x={9 * 60 + 30} stroke="#2b251f" label={{ value: "open", fill: "#948a7d", fontSize: 10, position: "insideTopLeft" }} />
          <ReferenceLine x={15 * 60 + 30} stroke="#2b251f" label={{ value: "ramp", fill: "#948a7d", fontSize: 10, position: "insideTopLeft" }} />
          <ReferenceLine x={16 * 60} stroke="#2b251f" label={{ value: "close", fill: "#948a7d", fontSize: 10, position: "insideTopRight" }} />
          {cursorMinutes != null && <ReferenceLine x={cursorMinutes} stroke="#f3ede6" strokeDasharray="4 4" />}
          <Area type="stepAfter" dataKey="leverage" stroke="#d4a05a" strokeWidth={2} fill="url(#levFill)" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
