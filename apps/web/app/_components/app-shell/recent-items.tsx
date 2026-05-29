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
    <div className="mt-5">
      <p className="flex items-center gap-1.5 px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-white/45">
        <Clock size={10} />
        Recientes
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex min-h-[36px] items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
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
