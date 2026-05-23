"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

import type { RecentItem } from "./use-recent-items";

type RecentItemsProps = {
  items: RecentItem[];
};

export function RecentItems({ items }: RecentItemsProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-2 px-2">
      <p className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-muted">
        <Clock size={10} />
        Recientes
      </p>
      <ul className="grid gap-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex min-h-[36px] items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-clinical-400" />
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
