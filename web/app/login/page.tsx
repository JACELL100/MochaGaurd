import Link from "next/link";

import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <LoginContent searchParams={searchParams} />;
}

async function LoginContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Sign in to Mochatrade" subtitle="Use the Google account enabled in Supabase Auth." />
      <Card title="Secure risk access" subtitle="Your session stays in Supabase; the dashboard sends its token only to the Mochatrade risk API.">
        <GoogleSignInButton />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <p className="mt-5 text-xs leading-5 text-muted">
          By continuing, you access only your linked Mochatrade account. Staff access is granted by the server-side allowlist.
          <Link href="/tonight" className="ml-1 text-accent hover:underline">Back to Tonight</Link>
        </p>
      </Card>
    </div>
  );
}
