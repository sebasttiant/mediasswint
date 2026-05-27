"use client";

import type { ReactNode } from "react";

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
};

export function AppShell({
  actions,
  children,
  description,
  kicker,
  title,
  userLabel,
}: AppShellProps) {
  const { inputRef, open, setOpen } = useCommandPalette();
  const { items: recentItems } = useRecentItems();

  return (
    <div className="flex min-h-dvh bg-surface-soft">
      <Sidebar recentItems={recentItems} onCommandPaletteOpen={() => setOpen(true)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          kicker={kicker}
          description={description}
          actions={actions}
          userLabel={userLabel}
          onCommandPaletteOpen={() => setOpen(true)}
        />

        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>

      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        inputRef={inputRef}
      />
    </div>
  );
}
