import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { AdminDestination } from "./admin-view";

export function AdminDashboard({
  destinations,
}: {
  destinations: readonly AdminDestination[];
}) {
  return (
    <section aria-label="Accesos administrativos" className="grid gap-4 sm:grid-cols-2">
      {destinations.map((destination) => {
        const Icon = destination.icon;
        return (
          <Link
            key={destination.key}
            href={destination.href}
            aria-label={`${destination.label}: ${destination.description}`}
            className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Icon size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-1.5 text-base font-bold tracking-tight text-slate-900">
                {destination.label}
                <ArrowRight
                  size={16}
                  className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                  aria-hidden="true"
                />
              </h2>
              <p className="mt-1 text-sm text-slate-500">{destination.description}</p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

export default AdminDashboard;
