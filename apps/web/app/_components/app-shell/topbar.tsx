"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Command, Search } from "lucide-react";

import { Breadcrumbs } from "./breadcrumbs";

type TopbarProps = {
  title: string;
  kicker: string;
  description?: string;
  actions?: ReactNode;
  userLabel?: string;
  onCommandPaletteOpen: () => void;
};

export function Topbar({
  actions,
  description,
  kicker,
  onCommandPaletteOpen,
  title,
  userLabel,
}: TopbarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/patients?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-surface/90 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-2 md:px-6">
        {/* Left: back button + breadcrumbs */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Volver a la página anterior"
            className="hidden shrink-0 items-center justify-center rounded-lg border border-edge p-2 text-ink-muted transition-colors hover:border-edge-strong hover:text-ink md:flex"
          >
            <ArrowLeft size={16} />
          </button>
          <Breadcrumbs />
        </div>

        {/* Right: search + command palette + actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Quick search */}
          <form onSubmit={onSearchSubmit} className="hidden sm:block" role="search">
            <label htmlFor="topbar-search" className="sr-only">Buscar paciente por nombre o cédula</label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="topbar-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar paciente…"
                className="h-9 rounded-lg border border-edge bg-surface-soft pl-8 pr-3 text-sm text-ink placeholder-ink-placeholder outline-none transition-colors focus:border-clinical-400 focus:ring-2 focus:ring-clinical-100 w-44 focus:w-56"
              />
            </div>
          </form>

          {/* Command palette shortcut */}
          <button
            onClick={onCommandPaletteOpen}
            aria-label="Abrir paleta de comandos (Ctrl+K)"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-edge bg-surface-soft px-2.5 text-ink-muted transition-colors hover:border-edge-strong hover:text-ink"
          >
            <Command size={14} />
            <kbd className="hidden font-mono text-[10px] sm:inline">⌘K</kbd>
          </button>

          {/* User label */}
          {userLabel && (
            <span className="hidden rounded-full border border-edge bg-surface-soft px-3 py-1.5 text-xs font-medium text-ink-secondary lg:inline">
              {userLabel}
            </span>
          )}

          {/* Page actions */}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

      {/* Title block */}
      <div className="px-4 pb-4 pt-2 md:px-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{kicker}</p>
        <h1 className="mt-0.5 text-2xl font-black leading-tight tracking-tight text-ink md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-secondary">{description}</p>
        )}
      </div>
    </header>
  );
}
