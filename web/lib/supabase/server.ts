import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function accessToken(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll() {
        // Server Components cannot mutate cookies. The OAuth callback and browser client refresh them.
      },
    },
  });
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}
