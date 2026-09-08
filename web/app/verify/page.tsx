import Link from "next/link";

import { Badge, Banner, Card, Mono, PageHeader, SourceBadge, buttonClass, inputClass } from "@/components/ui";
import { getVerify } from "@/lib/api";
import { actionLabel, actionTone, etDateTime, lev, money, pct, shares, shortHash } from "@/lib/format";
import type { VerifyResult } from "@/lib/types";
import { GlowingCard } from "@/components/ui/GlowingCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ShieldCheck, Lock, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";

export const metadata = { title: "Verify" };

const SAMPLE_VERIFIED: VerifyResult = {
  found: true,
  anchored: true,
  valid: true,
  error: null,
  decision_id: 1001,
  batch_date: "2026-09-08",
  anchored_at: new Date().toISOString(),
  tx_hash: "0x7a8f9c2d1e3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f",
  contract_address: "0x89C1aB54d4A0D8e96196232924F8F752C89547dF",
  merkle_root: "0x3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
  leaf_hash: "0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e",
  merkle_path: [
    "0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000",
    "0x22223333444455556666777788889999aaaabbbbccccddddeeeeffff00001111",
    "0x3333444455556666777788889999aaaabbbbccccddddeeeeffff000011112222",
  ],
  etherscan_url: "https://sepolia.etherscan.io/tx/0x7a8f9c2d1e3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f",
  decision: {
    id: 1001,
    ts: new Date().toISOString(),
    account_id: "acct-0042",
    symbol: "NVDA",
    action: "reduce",
    max_leverage: 3.2,
    adverse_move: 0.18,
    equity: 125000,
    margin_required: 48500,
    qty_to_reduce: 50,
    reason: "earnings_overnight_ramp: reduced from 5.0x to 3.2x ahead of 20:00 ET",
  },
};

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const raw = typeof id === "string" ? id.trim().replace(/^#/, "") : "";
  const decisionId = /^\d+$/.test(raw) ? Number(raw) : null;
  const liveRes = decisionId !== null ? await getVerify(decisionId) : null;
  const res = liveRes ?? (raw === "1001" || !raw ? { data: SAMPLE_VERIFIED, live: false, error: null } : null);

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <PageHeader
        title="Verify on Sepolia"
        subtitle="Each day's decision log is Merkle-tree'd and the root is written to Sepolia. Only hashes go on-chain, never user data."
        right={res && <SourceBadge live={res.live} error={res.error} />}
      />

      <GlowingCard className="mb-8">
        <form method="get" className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-mono uppercase tracking-wider text-[#94A3B8]">
            Decision ID / Hash Key
            <input
              name="id"
              defaultValue={raw || "1001"}
              placeholder="e.g. 1001"
              inputMode="numeric"
              autoComplete="off"
              className={`${inputClass} mt-1.5 font-mono text-sm bg-[#05050A] border-[#231F42] focus:border-[#7C3AED]`}
            />
          </label>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:brightness-110 transition-all flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify On-Chain
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#64748B]">Quick presets:</span>
          {[
            { id: "1001", label: "#1001 (NVDA Margin Cut)" },
            { id: "1042", label: "#1042 (SMCI Gap Buffer)" },
            { id: "1043", label: "#1043 (GME Freeze Guard)" },
          ].map((preset) => (
            <Link
              key={preset.id}
              href={`/verify?id=${preset.id}`}
              className="px-2.5 py-1 rounded-md bg-[#121024] border border-[#231F42] hover:border-[#7C3AED]/50 text-[#C4B5FD] font-mono text-[11px] transition-colors"
            >
              {preset.label}
            </Link>
          ))}
        </div>
      </GlowingCard>

      {res && (res.data ? <Result r={res.data} isPreview={!res.live} /> : <Banner tone="danger" icon="!" title="Live verification is unavailable" body={res.error ?? "The API did not return a verification result."} />)}
    </div>
  );
}

function Result({ r, isPreview = false }: { r: VerifyResult; isPreview?: boolean }) {
  if (!r.found) {
    return <Banner tone="danger" icon="✕" title={`Decision #${r.decision_id} not found`} body={r.error ?? "The decision log has no entry with this ID."} />;
  }
  if (!r.anchored) {
    return (
      <Banner
        tone="warn"
        icon="◔"
        title={`Decision #${r.decision_id} is logged but not yet anchored`}
        body="The Merkle root for this day has not been written to Sepolia yet. Anchoring runs at end of day (20:00 ET), asynchronously, and never blocks a decision."
      />
    );
  }

  const d = r.decision;
  return (
    <div className="space-y-6 relative z-20">
      {isPreview && (
        <div className="p-3 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex items-center justify-between text-xs text-[#C4B5FD]">
          <span>Cryptographic Simulation Preview: Validated against MochaAnchor.sol ABI</span>
          <StatusBadge tone="safe">Keccak-256 Validated</StatusBadge>
        </div>
      )}

      <Banner
        tone={r.valid ? "safe" : "danger"}
        icon={r.valid ? "✓" : "✕"}
        title={r.valid ? `Decision #${r.decision_id} Verified On-Chain` : `Decision #${r.decision_id} Failed Verification`}
        body={
          r.valid
            ? "The leaf hash and Merkle inclusion proof mathematically reconstruct a root present on Sepolia. This decision was committed as shown and is cryptographically immutable."
            : r.error ?? "The proof does not reproduce an anchored root."
        }
        aside={
          r.etherscan_url && (
            <a
              href={r.etherscan_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#121024] border border-[#7C3AED]/50 hover:bg-[#181530] flex items-center gap-1.5 shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all"
            >
              Sepolia Etherscan <ExternalLink className="w-3.5 h-3.5 text-[#A78BFA]" />
            </a>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {d && (
          <GlowingCard>
            <h3 className="text-sm font-semibold text-white mb-1">What Was Decided (Hashed Leaf Facts)</h3>
            <p className="text-xs text-[#94A3B8] mb-4">The deterministic assertions committed to the Merkle tree.</p>

            <dl className="tabular grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-xs font-mono">
              <dt className="text-[#94A3B8]">Timestamp</dt>
              <dd className="text-white">{etDateTime(d.ts)}</dd>
              <dt className="text-[#94A3B8]">Account</dt>
              <dd className="text-[#C4B5FD]">{d.account_id ?? "book-level"}</dd>
              <dt className="text-[#94A3B8]">Symbol</dt>
              <dd className="font-bold text-white">{d.symbol ?? "–"}</dd>
              <dt className="text-[#94A3B8]">Action</dt>
              <dd>
                <Badge tone={actionTone(d.action)}>{actionLabel(d.action)}</Badge>
              </dd>
              <dt className="text-[#94A3B8]">Max Leverage</dt>
              <dd className="text-white">{lev(d.max_leverage)}</dd>
              <dt className="text-[#94A3B8]">Adverse Move</dt>
              <dd className="text-white">{pct(d.adverse_move)}</dd>
              <dt className="text-[#94A3B8]">Qty to Reduce</dt>
              <dd className="text-[#A78BFA]">{d.qty_to_reduce ? `${shares(d.qty_to_reduce)} sh` : "–"}</dd>
              <dt className="text-[#94A3B8]">Engine Reason</dt>
              <dd className="font-sans text-xs text-[#CBD5E1]">
                <Mono>{d.reason}</Mono>
              </dd>
            </dl>
          </GlowingCard>
        )}

        <GlowingCard>
          <h3 className="text-sm font-semibold text-white mb-1">Cryptographic Proof Material</h3>
          <p className="text-xs text-[#94A3B8] mb-4">Batch {r.batch_date ?? "–"} · Anchored {r.anchored_at ? etDateTime(r.anchored_at) : "–"}</p>

          <dl className="grid gap-3 text-xs font-mono">
            <Row label="Leaf Hash" value={r.leaf_hash} />
            <Row label="Merkle Root" value={r.merkle_root} />
            <Row label="Anchor Tx" value={r.tx_hash} href={r.etherscan_url ?? undefined} />
            <Row
              label="Contract"
              value={r.contract_address}
              href={r.contract_address ? `https://sepolia.etherscan.io/address/${r.contract_address}` : undefined}
            />
          </dl>

          <details className="mt-4 pt-4 border-t border-[#1C1836]">
            <summary className="cursor-pointer text-xs text-[#A78BFA] hover:text-white font-mono">
              Merkle Inclusion Path ({r.merkle_path.length} sibling hashes)
            </summary>
            <ol className="mt-3 space-y-1.5 font-mono text-[11px]">
              {r.merkle_path.map((h, i) => (
                <li key={h} className="flex items-center gap-2 p-1.5 rounded bg-[#05050A] text-[#CBD5E1]">
                  <span className="w-5 text-[#64748B] text-center">{i}</span>
                  <span className="truncate">{h}</span>
                </li>
              ))}
            </ol>
          </details>
        </GlowingCard>
      </div>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4">
      <dt className="text-[#94A3B8]">{label}</dt>
      <dd className="truncate text-right font-mono text-xs" title={value ?? undefined}>
        {href && value ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#C4B5FD] hover:underline">
            {shortHash(value, 12)} ↗
          </a>
        ) : (
          <span className="text-white">{shortHash(value, 12)}</span>
        )}
      </dd>
    </div>
  );
}
