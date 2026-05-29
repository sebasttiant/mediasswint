"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Breadcrumbs } from "./breadcrumbs";

type TopbarProps = {
  userLabel?: string;
};

function displayName(label?: string): string {
  if (!label) return "Usuario";
  return label.replace(/^Bienvenido,?\s*/i, "").trim() || "Usuario";
}

function initialOf(label?: string): string {
  return (displayName(label)[0] ?? "U").toUpperCase();
}

export function Topbar({ userLabel }: TopbarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/patients?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        {/* Left: breadcrumbs */}
        <div className="flex min-w-0 flex-1 items-center">
          <Breadcrumbs />
        </div>

        {/* Right: search + command palette + user */}
        <div className="flex shrink-0 items-center gap-2">
          <form onSubmit={onSearchSubmit} className="hidden sm:block" role="search">
            <label htmlFor="topbar-search" className="sr-only">
              Buscar paciente por nombre o cédula
            </label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="topbar-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar paciente…"
                className="h-9 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:w-64 focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
            </div>
          </form>

          <div className="flex items-center gap-2.5 pl-1">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-800">{displayName(userLabel)}</p>
              <p className="text-[11px] leading-tight text-slate-400">Panel interno</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
              {initialOf(userLabel)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
