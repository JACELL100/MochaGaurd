// Server-only client for the FastAPI service. Every call degrades to the demo fallback
// (lib/demo.ts) when the API is unreachable so the dashboard never renders a blank page.
// Pages read `live` to show a "demo data" badge instead of silently lying.

import "server-only";

import {
  demoAccounts,
  demoBook,
  demoLeverage,
  demoReplay,
  demoTonight,
  demoVerify,
} from "./demo";
import type {
  AccountSummary,
  ApiResult,
  BookResponse,
  LeverageResult,
  ReplayResult,
  TonightBriefing,
  VerifyResult,
} from "./types";

const BASE = (process.env.FASTAPI_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.FASTAPI_TIMEOUT_MS ?? 4000);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(text || `${res.status} ${res.statusText}`, res.status);
  }
  return (await res.json()) as T;
}

async function withFallback<T>(live: () => Promise<T>, fallback: () => T): Promise<ApiResult<T>> {
  try {
    return { data: await live(), live: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: fallback(), live: false, error: message };
  }
}

export function getBook(): Promise<ApiResult<BookResponse>> {
  return withFallback(() => call<BookResponse>("/dashboard/book"), demoBook);
}

export function getAccounts(): Promise<ApiResult<AccountSummary[]>> {
  return withFallback(() => call<AccountSummary[]>("/dashboard/accounts"), demoAccounts);
}

export function getTonight(accountId: string): Promise<ApiResult<TonightBriefing | null>> {
  return withFallback(
    async () => {
      try {
        return await call<TonightBriefing>(`/tonight/${encodeURIComponent(accountId)}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    () => demoTonight(accountId),
  );
}

export function getReplay(params: { symbol: string; date?: string }): Promise<ApiResult<ReplayResult>> {
  return withFallback(
    () => call<ReplayResult>("/replay", { method: "POST", body: JSON.stringify(params) }),
    () => demoReplay(params.symbol),
  );
}

export function getLeverage(params: {
  symbol: string;
  notional: number;
  ts: Date;
  earnings_tonight?: boolean;
}): Promise<ApiResult<LeverageResult | null>> {
  return withFallback(
    async () => {
      try {
        return await call<LeverageResult>("/leverage", {
          method: "POST",
          body: JSON.stringify({ ...params, ts: params.ts.toISOString() }),
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    () => demoLeverage(params.symbol, params.notional, params.ts, params.earnings_tonight),
  );
}

export function getVerify(decisionId: number): Promise<ApiResult<VerifyResult>> {
  return withFallback(() => call<VerifyResult>(`/verify/${decisionId}`), () => demoVerify(decisionId));
}
