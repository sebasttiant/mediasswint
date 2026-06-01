"use client";

import type { ReactNode } from "react";

import type { UserRole } from "@/lib/auth-edge";

import { PageHeader } from "../ui/page-header";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useCommandPalette } from "./use-command-palette";
import { useRecentItems } from "./use-recent-items";

type AppShellProps = {
  children: ReactNode;
  currentPath?: string;
  title: string;
  kicker: string;
  description?: string;
  userLabel?: string;
  actions?: ReactNode;
  role?: UserRole;
};

export function AppShell({
  actions,
  children,
  description,
  kicker,
  role,
  title,
  userLabel,
}: AppShellProps) {
  const { inputRef, open, setOpen } = useCommandPalette();
  const { items: recentItems } = useRecentItems();

  return (
    <div className="flex min-h-dvh bg-slate-100">
      <Sidebar role={role} recentItems={recentItems} onCommandPaletteOpen={() => setOpen(true)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userLabel={userLabel} />

        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 md:px-8">
            <PageHeader title={title} subtitle={description} kicker={kicker} actions={actions} />
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={open} onClose={() => setOpen(false)} inputRef={inputRef} />
    </div>
  );
}
