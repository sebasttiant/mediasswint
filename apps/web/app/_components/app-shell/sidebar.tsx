"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Command, Menu, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { APP_SHELL_NAVIGATION, buildAppShellAriaLabel, findAppShellActiveItem } from "./navigation";
import { RecentItems } from "./recent-items";
import type { RecentItem } from "./use-recent-items";

type SidebarProps = {
  recentItems: RecentItem[];
  onCommandPaletteOpen: () => void;
};

export function Sidebar({ onCommandPaletteOpen, recentItems }: SidebarProps) {
  const pathname = usePathname();
  const activeItem = findAppShellActiveItem(pathname) ?? APP_SHELL_NAVIGATION[0]!;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Move the active indicator
  useEffect(() => {
    if (collapsed) return;
    const navEl = navRef.current;
    const indicatorEl = indicatorRef.current;
    if (!navEl || !indicatorEl) return;

    const activeLink = navEl.querySelector<HTMLElement>('[aria-current="page"]');
    if (!activeLink) return;

    const navRect = navEl.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    indicatorEl.style.transform = `translateY(${linkRect.top - navRect.top}px)`;
    indicatorEl.style.height = `${linkRect.height}px`;
  }, [pathname, collapsed]);

  // Close mobile drawer on navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center justify-between p-3">
        <Link
          href="/"
          aria-label="Volver al dashboard principal"
          className={`flex min-h-[44px] items-center gap-3 rounded-xl bg-gradient-to-br from-brand-strong to-brand px-3 py-2 text-white shadow-[0_8px_24px_rgba(179,3,3,0.22)] transition-all hover:-translate-y-px hover:shadow-[0_12px_32px_rgba(179,3,3,0.28)] ${collapsed ? "justify-center px-2" : ""}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-sm font-black backdrop-blur-sm">
            M
          </span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <strong className="block text-sm font-black tracking-tight">MEDIASSWINT</strong>
                <small className="block text-[10px] opacity-75">Gestión interna</small>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          className="hidden rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink md:flex"
        >
          <Menu size={16} />
        </button>
      </div>

      {/* Command palette trigger */}
      <div className="px-3 pb-2">
        <button
          onClick={onCommandPaletteOpen}
          aria-label="Abrir paleta de comandos (Ctrl+K)"
          className={`flex min-h-[36px] w-full items-center gap-2 rounded-lg border border-edge bg-surface-soft px-3 py-2 text-sm text-ink-muted transition-colors hover:border-edge-strong hover:text-ink ${collapsed ? "justify-center px-2" : ""}`}
        >
          <Command size={14} className="shrink-0" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-1 items-center justify-between overflow-hidden"
              >
                <span className="truncate text-xs">Buscar o ir a…</span>
                <kbd className="rounded bg-edge px-1 py-0.5 font-mono text-[10px]">⌘K</kbd>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Navigation */}
      <nav
        ref={navRef}
        aria-label="Módulos"
        className="relative flex-1 overflow-y-auto px-2"
      >
        {/* Active indicator (framer-motion sliding pill) */}
        {!collapsed && (
          <motion.div
            ref={indicatorRef}
            layoutId="nav-active-pill"
            className="pointer-events-none absolute inset-x-2 rounded-xl bg-brand/8 border border-brand/20"
            style={{ height: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            aria-hidden="true"
          />
        )}

        <div className="grid gap-0.5 py-1">
          {APP_SHELL_NAVIGATION.map((item) => {
            const active = item.key === activeItem.key;
            const Icon = item.icon;

            return (
              <div key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={buildAppShellAriaLabel(item, active)}
                  className={`relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                    active
                      ? "text-brand-strong font-semibold"
                      : "text-ink-secondary hover:bg-surface-soft hover:text-ink"
                  } ${collapsed ? "justify-center px-2" : ""}`}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 ${active ? "text-brand" : "text-ink-muted"}`}
                    aria-hidden="true"
                  />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <span className="block truncate">{item.label}</span>
                        <small className="block truncate text-[11px] text-ink-muted font-normal">{item.description}</small>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>

                {/* Sub-nav for active item */}
                {!collapsed && item.children && active && (
                  <div
                    className="ml-9 mt-0.5 grid gap-0.5 border-l-2 border-brand/20 pl-3"
                    aria-label={`${item.label} submenú`}
                  >
                    {item.children.map((child) => (
                      <Link
                        key={`${item.key}-${child.label}`}
                        href={child.href}
                        className="flex min-h-[36px] flex-col justify-center rounded-lg px-2 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink"
                      >
                        <span className="font-medium">{child.label}</span>
                        <small className="text-ink-muted">{child.description}</small>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Recent items */}
        {!collapsed && <RecentItems items={recentItems} />}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-edge p-2">
          <Link
            href="/admin"
            className="flex min-h-[36px] items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink"
          >
            <Settings size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
            <span>Administración</span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 256 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative hidden h-screen flex-col overflow-hidden border-r border-edge bg-surface md:flex"
        style={{ position: "sticky", top: 0, alignSelf: "start", height: "100dvh" }}
        aria-label="Navegación principal"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú de navegación"
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-edge bg-surface shadow-card md:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="overlay"
              className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="drawer"
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-edge bg-surface shadow-elevated md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              aria-label="Navegación principal (móvil)"
            >
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="absolute right-3 top-3 z-10 rounded-lg p-2 text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
