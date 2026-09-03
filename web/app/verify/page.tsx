import Link from "next/link";

import { Badge, Banner, Card, Mono, PageHeader, SourceBadge, buttonClass, inputClass } from "@/components/ui";
import { getVerify } from "@/lib/api";
import { actionLabel, actionTone, etDateTime, lev, money, pct, shares, shortHash } from "@/lib/format";
import type { VerifyResult } from "@/lib/types";

export const metadata = { title: "Verify" };

export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const { id } = await searchParams;
  const raw = typeof id === "string" ? id.trim().replace(/^#/, "") : "";
  const decisionId = /^\d+$/.test(raw) ? Number(raw) : null;
  const res = decisionId !== null ? await getVerify(decisionId) : null;

  return (
    <>
      <PageHeader
        title="Verify a decision"
        subtitle="Each day's decision log is Merkle-tree'd and the root is written to Sepolia. Only hashes go on-chain, never user data."
        right={res && <SourceBadge live={res.live} error={res.error} />}
      />

      <Card className="mb-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm text-muted">
            Decision ID
            <input
              name="id"
              defaultValue={raw}
              placeholder="e.g. 1001"
              inputMode="numeric"
              autoComplete="off"
              className={`${inputClass} mt-1 font-mono`}
            />
          </label>
          <button type="submit" className={buttonClass}>
            Verify on-chain
          </button>
        </form>
        {raw && decisionId === null && <p className="mt-2 text-xs text-danger">Decision IDs are integers.</p>}
        <p className="mt-3 text-xs text-muted">
          Verification is a free <Mono>view</Mono> call to <Mono>MochaAnchor.verify(root, leaf, proof)</Mono>. Pick one from the{" "}
          <Link href="/replay" className="text-accent hover:underline">
            replay timeline
          </Link>{" "}
          or the{" "}
          <Link href="/" className="text-accent hover:underline">
            pending decisions table
          </Link>
          .
        </p>
      </Card>

      {res && <Result r={res.data} />}
    </>
  );
}

function Result({ r }: { r: VerifyResult }) {
  if (!r.found) {
    return <Banner tone="danger" icon="✕" title={`Decision #${r.decision_id} not found`} body={r.error ?? "The decision log has no entry with this ID."} />;
  }
  if (!r.anchored) {
    return (
      <Banner
        tone="warn"
        icon="◔"
        title={`Decision #${r.decision_id} is logged but not yet anchored`}
        body="The Merkle root for this day has not been written to Sepolia yet. Anchoring runs at end of day, asynchronously, and never blocks a decision."
      />
    );
  }

  const d = r.decision;
  return (
    <div className="space-y-6">
      <Banner
        tone={r.valid ? "safe" : "danger"}
        icon={r.valid ? "✓" : "✕"}
        title={r.valid ? `Decision #${r.decision_id} verified on Sepolia` : `Decision #${r.decision_id} FAILED verification`}
        body={
          r.valid
            ? "The leaf hash and Merkle path reproduce a root that exists on-chain. This decision was logged as shown and has not been altered since it was anchored."
            : r.error ?? "The proof does not reproduce an anchored root. Either the log entry was modified after anchoring or the proof is corrupt."
        }
        aside={
          r.etherscan_url && (
            <a href={r.etherscan_url} target="_blank" rel="noopener noreferrer" className={buttonClass}>
              Open anchor tx on Etherscan ↗
            </a>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {d && (
          <Card title="What was decided" subtitle="The exact facts hashed into the leaf.">
            <dl className="tabular grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted">Time</dt>
              <dd>{etDateTime(d.ts)}</dd>
              <dt className="text-muted">Account</dt>
              <dd>
                {d.account_id ? (
                  <Link href={`/tonight?account=${d.account_id}`} className="font-mono text-xs hover:text-accent">
                    {d.account_id}
                  </Link>
                ) : (
                  <span className="text-muted">book-level</span>
                )}
              </dd>
              <dt className="text-muted">Symbol</dt>
              <dd className="font-medium">{d.symbol ?? "–"}</dd>
              <dt className="text-muted">Action</dt>
              <dd>
                <Badge tone={actionTone(d.action)}>{actionLabel(d.action)}</Badge>
              </dd>
              <dt className="text-muted">Max leverage</dt>
              <dd>{lev(d.max_leverage)}</dd>
              <dt className="text-muted">Adverse move</dt>
              <dd>{pct(d.adverse_move)}</dd>
              <dt className="text-muted">Equity</dt>
              <dd>{money(d.equity, true)}</dd>
              <dt className="text-muted">Margin required</dt>
              <dd>{money(d.margin_required, true)}</dd>
              <dt className="text-muted">Qty to reduce</dt>
              <dd>{d.qty_to_reduce ? `${shares(d.qty_to_reduce)} sh` : "–"}</dd>
              <dt className="text-muted">Reason</dt>
              <dd>
                <Mono>{d.reason}</Mono>
              </dd>
            </dl>
          </Card>
        )}

        <Card title="Proof material" subtitle={`Batch ${r.batch_date ?? "–"} · anchored ${r.anchored_at ? etDateTime(r.anchored_at) : "–"}`}>
          <dl className="grid gap-3 text-sm">
            <Row label="Leaf hash" value={r.leaf_hash} />
            <Row label="Merkle root" value={r.merkle_root} />
            <Row
              label="Anchor tx"
              value={r.tx_hash}
              href={r.etherscan_url ?? undefined}
            />
            <Row
              label="Contract"
              value={r.contract_address}
              href={r.contract_address ? `https://sepolia.etherscan.io/address/${r.contract_address}` : undefined}
            />
          </dl>
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
              Merkle path ({r.merkle_path.length} siblings)
            </summary>
            <ol className="mt-2 space-y-1">
              {r.merkle_path.map((h, i) => (
                <li key={h} className="flex items-center gap-2 font-mono text-[11px] text-foreground/80">
                  <span className="w-5 text-muted">{i}</span>
                  <span className="truncate">{h}</span>
                </li>
              ))}
            </ol>
          </details>
        </Card>
      </div>

      <p className="text-xs text-muted">
        Sorted-pair Merkle tree: at each level <Mono>h = keccak(min(h, sib) ‖ max(h, sib))</Mono>. Mochatrade cannot alter a decision after
        anchoring without breaking this root.
      </p>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-6">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-right font-mono text-xs" title={value ?? undefined}>
        {href && value ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            {shortHash(value, 10)} ↗
          </a>
        ) : (
          shortHash(value, 10)
        )}
      </dd>
    </div>
  );
}
