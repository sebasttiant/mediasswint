"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type QuickActionCardProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
};

export function QuickActionCard({ description, href, icon: Icon, label }: QuickActionCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Link
        href={href}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-brand hover:shadow-md"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
      </Link>
    </motion.div>
  );
}
