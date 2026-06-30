import Link from "next/link";
import { requireProfile, getPermissions } from "@/lib/auth";
import { MODULES } from "@/lib/modules";
import { can } from "@/lib/permissions";

export default async function LaunchpadPage() {
  const profile = await requireProfile();
  const perms = await getPermissions();
  const modules = MODULES.filter(
    (m) => (!m.roles || m.roles.includes(profile.role)) && can(perms, m.key, "r"),
  );
  const firstName = (profile.full_name ?? profile.email).split(" ")[0];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Select a module to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const available = mod.status === "available";

          const card = (
            <div
              className={`group relative h-full rounded-2xl border p-5 transition ${
                available
                  ? "cursor-pointer border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                  : "border-dashed border-neutral-200 bg-white/50 dark:border-neutral-800 dark:bg-neutral-900/50"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    available
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {!available && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:bg-neutral-800">
                    Soon
                  </span>
                )}
              </div>
              <h2 className="text-base font-semibold">{mod.name}</h2>
              <p className="mt-1 text-sm text-neutral-500">{mod.description}</p>
            </div>
          );

          return available ? (
            <Link key={mod.key} href={mod.href}>
              {card}
            </Link>
          ) : (
            <div key={mod.key} aria-disabled>
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
