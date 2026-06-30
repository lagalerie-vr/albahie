import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { EditForm } from "@/components/consignments/EditForm";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const [{ data: item }, { data: managers }] = await Promise.all([
    supabase
      .from("consignment_items")
      .select(
        `id, consignment_id, title, description, category, height_cm, width_cm, depth_cm, weight_kg,
         responsible_manager, received_at,
         consignment:consignments ( notes, consignor:consignors ( id, full_name, email, phone, address ) ),
         photos:consignment_item_photos ( id, storage_path )`,
      )
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  if (!item) notFound();

  const consignment = item.consignment as unknown as {
    notes: string | null;
    consignor: {
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
    } | null;
  } | null;
  const consignor = consignment?.consignor ?? null;
  if (!consignor) notFound();

  const photos = (
    (item.photos ?? []) as { id: string; storage_path: string }[]
  ).map((p) => ({
    id: p.id,
    url: supabase.storage
      .from("consignment-photos")
      .getPublicUrl(p.storage_path).data.publicUrl,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/consignments/items/${item.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to item
      </Link>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        Edit consignment
      </h1>

      <EditForm
        item={{
          id: item.id,
          consignment_id: item.consignment_id,
          title: item.title,
          description: item.description,
          category: item.category,
          height_cm: item.height_cm,
          width_cm: item.width_cm,
          depth_cm: item.depth_cm,
          weight_kg: item.weight_kg,
          responsible_manager: item.responsible_manager,
          received_at: item.received_at,
        }}
        consignor={consignor}
        consignmentNotes={consignment?.notes ?? null}
        existingPhotos={photos}
        managers={(managers ?? []).map((m) => ({
          id: m.id,
          name: m.full_name || m.email,
        }))}
      />
    </div>
  );
}
