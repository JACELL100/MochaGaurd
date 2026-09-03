# Mochatrade Risk

Mochatrade Risk is a live risk service for linked brokerage accounts. It calculates leverage and overnight margin from persisted, split-adjusted Alpha Vantage data; stores decisions in Supabase; generates bounded, fact-grounded Groq explanations downstream; and anchors daily decision commitments on Sepolia.

It deliberately has no demo fallback. If authentication, market data, or the API is unavailable, the UI says so instead of rendering invented values.

## Configuration

Copy [`api/.env.example`](api/.env.example) to `api/.env` and [`web/.env.local.example`](web/.env.local.example) to `web/.env.local`. Keep both real files out of Git.

Required values not included in the provided connection string:

- Supabase URL and browser-safe anon/publishable key for Google sign-in.
- A long random `INTERNAL_API_KEY` shared only with Mochatrade's server-side account/position integration.
- `STAFF_EMAILS` for book-console access.
- A funded **Sepolia-only** private key before contract deployment. Never use a mainnet key.

In Supabase Auth, configure Google and add these redirect URLs:

- `http://localhost:3000/auth/callback`
- Your deployed web origin followed by `/auth/callback`

## Start locally

```powershell
cd api
python -m pip install -r requirements.txt
python scripts/migrate.py
python scripts/seed_market.py NVDA MSFT SPY
uvicorn app.main:app --reload --port 8000
```

Then, in another terminal:

```powershell
cd web
npm install
npm run dev
```

`seed_market.py` consumes Alpha Vantage quota for daily bars, splits, and earnings. On a free key, seed a deliberately small universe; configure premium rate and daily-budget settings for broad live coverage. The quote poller writes actual intraday prints during market hours, and historical review only displays those persisted prints.

## Brokerage account integration

This project cannot invent user positions or submit trades. Mochatrade's existing server-side brokerage service must call the protected sync endpoint whenever an account, cash balance, or position changes:

```http
POST /internal/accounts/sync
X-Internal-Key: <INTERNAL_API_KEY>
Content-Type: application/json

{
  "auth_user_id": "<Supabase user UUID>",
  "email": "trader@example.com",
  "display_name": "Trader",
  "tz": "Asia/Kolkata",
  "cash": 25000,
  "positions": [{"symbol": "NVDA", "qty": 100, "avg_price": 174.25}]
}
```

The risk API evaluates this real portfolio and logs actionable decisions. Actual order routing remains the responsibility of Mochatrade's regulated execution service; do not wire automatic orders to this app without the broker's approval, compliance review, and idempotent execution workflow.

## Sepolia anchoring

With a funded testnet wallet in `ANCHOR_PRIVATE_KEY`, deploy the contract:

```powershell
cd api
python scripts/deploy_contract.py
```

Copy the returned `CONTRACT_ADDRESS` into `api/.env`, restart the API, then have staff call `POST /anchor/{YYYY-MM-DD}`. The endpoint builds sorted-pair Keccak Merkle proofs from that day's stored decisions and submits exactly one Sepolia transaction. `GET /verify/{decision_id}` checks the stored proof against `MochaAnchor.verify` on-chain.

## Security boundaries

- Browser code has only the Supabase anon/publishable key; database and Groq keys never leave the server.
- FastAPI verifies each Supabase bearer token with Supabase Auth and scopes non-staff users to their own account.
- The risk engine makes no database, Groq, or web3 calls while deciding. Persistence, explanations, and anchoring are downstream.
- RLS is enabled on every database table; the Next.js app never queries Supabase tables directly.
