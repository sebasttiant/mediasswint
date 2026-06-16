"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { usePathname } from "next/navigation";

import { findAppShellActiveItem } from "./navigation";

type BreadcrumbSegment = {
  label: string;
  href: string;
};

function buildBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [{ label: "Dashboard", href: "/" }];

  if (pathname === "/") return segments;

  const activeItem = findAppShellActiveItem(pathname);

  if (pathname.startsWith("/patients")) {
    segments.push({ label: "Pacientes", href: "/patients" });

    const parts = pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const patientId = parts[1]!;
      segments.push({ label: "Ficha del paciente", href: `/patients/${patientId}` });

      if (parts.length >= 3 && parts[2] === "measurements") {
        if (parts[3] === "new") {
          segments.push({ label: "Nueva medición", href: pathname });
        } else if (parts[3]) {
          segments.push({ label: "Detalle de medición", href: pathname });
        }
      }
    }

    return segments;
  }

  if (pathname.startsWith("/operations")) {
    segments.push({ label: "Operaciones", href: "/operations" });
    return segments;
  }

  if (pathname.startsWith("/admin")) {
    segments.push({ label: "Administración", href: "/admin" });
    return segments;
  }

  if (activeItem) {
    segments.push({ label: activeItem.label, href: activeItem.href });
  }

  return segments;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Navegación de ruta"
      className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden text-xs text-ink-muted"
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const isFirst = index === 0;

        return (
          // On phones only the current (last) crumb is shown so the trail can
          // never collide with the avatar; ancestors return from sm upward.
          <span
            key={crumb.href}
            className={`items-center gap-1 ${isLast ? "flex min-w-0" : "hidden sm:flex"}`}
          >
            {isFirst ? (
              <Link
                href={crumb.href}
                aria-label="Ir al dashboard"
                className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-ink"
              >
                <Home size={11} />
                <span className="hidden sm:inline">{crumb.label}</span>
              </Link>
            ) : isLast ? (
              <span className="max-w-[140px] truncate font-medium text-ink" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="max-w-[120px] truncate rounded px-1 py-0.5 transition-colors hover:text-ink"
              >
                {crumb.label}
              </Link>
            )}
            {!isLast && <ChevronRight size={11} className="shrink-0 text-ink-placeholder" aria-hidden="true" />}
          </span>
        );
      })}
    </nav>
  );
}
