import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { IntakeForm } from "@/components/consignments/IntakeForm";
import type { ConsignorSummary } from "@/lib/consignments";

export default async function NewIntakePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: consignors }, { data: managers }] = await Promise.all([
    supabase
      .from("consignors")
      .select("id, full_name, email, phone")
      .order("full_name"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/consignments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Consignments
      </Link>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Receive item
      </h1>
      <p className="mb-6 text-sm text-neutral-500">
        Log an item into custody at the receiving counter.
      </p>

      <IntakeForm
        consignors={(consignors ?? []) as ConsignorSummary[]}
        managers={(managers ?? []).map((m) => ({
          id: m.id,
          name: m.full_name || m.email,
        }))}
        currentUserId={profile.id}
      />
    </div>
  );
}
