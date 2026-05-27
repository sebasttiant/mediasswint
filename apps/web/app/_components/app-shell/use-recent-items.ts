"use client";

import { useCallback, useEffect, useState } from "react";

export type RecentItem = {
  id: string;
  label: string;
  href: string;
  type: "patient";
  visitedAt: number;
};

const STORAGE_KEY = "mediasswint:recent-items";
const MAX_ITEMS = 5;

function readFromStorage(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentItem[];
  } catch {
    return [];
  }
}

function writeToStorage(items: RecentItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors (private browsing, quota, etc.)
  }
}

export function useRecentItems() {
  const [items, setItems] = useState<RecentItem[]>([]);

  // Bootstrap from localStorage after mount + sync across tabs
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readFromStorage());

    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) {
        setItems(readFromStorage());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addRecentItem = useCallback((item: Omit<RecentItem, "visitedAt">) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.id !== item.id);
      const next: RecentItem[] = [{ ...item, visitedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      writeToStorage(next);
      return next;
    });
  }, []);

  return { items, addRecentItem };
}
