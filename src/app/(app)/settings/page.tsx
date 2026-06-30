import { Users, CalendarDays, Shield } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsersAdmin, type AdminUser } from "@/components/admin/UsersAdmin";
import { RolesAdmin, type AppRole } from "@/components/admin/RolesAdmin";
import { SaleEventsAdmin, type SaleEvent } from "@/components/admin/SaleEventsAdmin";

export default async function SettingsPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  const [{ data: users }, { data: roles }, { data: events }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, role_id, is_active, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("app_roles").select("id, name, permissions").order("name", { ascending: true }),
    supabase
      .from("auctions")
      .select("id, name, sale_date, location, status")
      .order("sale_date", { ascending: true }),
  ]);

  const roleList = (roles ?? []) as AppRole[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Users, roles, and house-wide settings.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <Users className="h-4 w-4" /> Users
        </h2>
        <UsersAdmin
          users={(users ?? []) as AdminUser[]}
          roles={roleList}
          currentUserId={me.id}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <Shield className="h-4 w-4" /> Roles &amp; permissions
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          Create roles and grant create / read / update / delete on each module. Assign
          a role to a staff user above. Admins always have full access.
        </p>
        <RolesAdmin roles={roleList} />
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <CalendarDays className="h-4 w-4" /> Sale events
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          The upcoming sales offered when routing an accepted item to auction.
        </p>
        <SaleEventsAdmin events={(events ?? []) as SaleEvent[]} />
      </section>
    </div>
  );
}
