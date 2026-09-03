import { redirect } from "next/navigation";

// Account detail lives on /tonight; keep the /accounts/[id] URL from the plan as a stable deep link.
export default async function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  redirect(`/tonight?account=${encodeURIComponent(id)}`);
}
