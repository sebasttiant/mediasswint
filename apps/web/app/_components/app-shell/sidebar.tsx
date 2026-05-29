"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, LogOut, Menu, Search, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";

import { APP_SHELL_NAVIGATION, buildAppShellAriaLabel, findAppShellActiveItem } from "./navigation";
import { RecentItems } from "./recent-items";
import type { RecentItem } from "./use-recent-items";

type SidebarProps = {
  recentItems: RecentItem[];
  onCommandPaletteOpen: () => void;
};

// Presentational grouping of the flat navigation (no data/route changes) so
// the modules read as distinct blocks instead of one undifferentiated list.
const NAV_GROUPS = [
  { label: "Principal", items: APP_SHELL_NAVIGATION.filter((i) => i.key === "dashboard") },
  {
    label: "Gestión",
    items: APP_SHELL_NAVIGATION.filter((i) =>
      ["patients", "measurements", "operations"].includes(i.key),
    ),
  },
];

export function Sidebar({ onCommandPaletteOpen, recentItems }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = findAppShellActiveItem(pathname) ?? APP_SHELL_NAVIGATION[0]!;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const content = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-black text-white">
          M
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-sm font-bold tracking-tight text-white">MEDIASSWINT</strong>
          <small className="block text-[10px] font-medium uppercase tracking-widest text-white/40">
            Gestión clínica
          </small>
        </span>
      </div>

      {/* Command palette trigger */}
      <div className="px-3 pt-4">
        <button
          onClick={onCommandPaletteOpen}
          aria-label="Abrir paleta de comandos (Ctrl+K)"
          className="flex min-h-[40px] w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          <Search size={14} className="shrink-0" />
          <span className="flex-1 truncate text-left text-xs">Buscar o ir a…</span>
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Módulos" className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-white/45">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = item.key === activeItem.key;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={buildAppShellAriaLabel(item, active)}
                    className={`relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-white/10 font-semibold text-white"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand"
                        aria-hidden="true"
                      />
                    )}
                    <Icon
                      size={18}
                      className={`shrink-0 ${active ? "text-white" : "text-slate-400"}`}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate font-medium">{item.label}</span>
                    {active && <ChevronRight size={16} className="shrink-0 text-white/50" aria-hidden="true" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <RecentItems items={recentItems} />
      </nav>

      {/* Footer */}
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link
          href="/admin"
          className="flex min-h-[40px] items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Settings size={16} className="shrink-0" aria-hidden="true" />
          <span>Administración</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut size={16} className="shrink-0" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden h-screen w-[280px] shrink-0 flex-col bg-[#0b1325] md:flex"
        style={{ position: "sticky", top: 0, alignSelf: "start", height: "100dvh" }}
        aria-label="Navegación principal"
      >
        {content}
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú de navegación"
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-card md:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="overlay"
              className="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="drawer"
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#0b1325] shadow-elevated md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              aria-label="Navegación principal (móvil)"
            >
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white/60 hover:text-white"
              >
                <X size={18} />
              </button>
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
