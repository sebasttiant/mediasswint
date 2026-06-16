"use client";

import { motion, AnimatePresence } from "framer-motion";

export type StripTabId = "RL" | "LL" | "RA" | "LA";

type MobileStripTabsProps = {
  activeTab: StripTabId;
  onTabChange: (tab: StripTabId) => void;
};

const TABS: { id: StripTabId; label: string; sublabel: string }[] = [
  { id: "RL", label: "P.D", sublabel: "Pierna Der." },
  { id: "LL", label: "P.I", sublabel: "Pierna Izq." },
  { id: "RA", label: "B.D", sublabel: "Brazo Der." },
  { id: "LA", label: "B.I", sublabel: "Brazo Izq." },
];

export function MobileStripTabs({ activeTab, onTabChange }: MobileStripTabsProps) {
  return (
    <div className="flex border-b border-slate-200 bg-slate-50 lg:hidden">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`relative min-w-0 flex-1 px-1 py-2 text-xs font-semibold transition-colors sm:py-2.5 ${
            activeTab === tab.id
              ? "text-sky-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
          aria-selected={activeTab === tab.id}
          role="tab"
        >
          <span className="block truncate text-[13px] font-bold leading-tight sm:text-sm">{tab.label}</span>
          <span className="block truncate text-[10px] font-normal leading-tight text-slate-400">{tab.sublabel}</span>
          {activeTab === tab.id ? (
            <motion.div
              layoutId="mobile-tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600"
              transition={{ duration: 0.2 }}
            />
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function MobileStripPanel({
  activeTab,
  children,
}: {
  activeTab: StripTabId;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.18 }}
        className="lg:hidden"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
