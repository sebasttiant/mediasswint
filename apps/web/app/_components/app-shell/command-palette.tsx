"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Home, Search, Stethoscope, Users, X } from "lucide-react";

type PatientResult = {
  id: string;
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
};

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ReactNode;
};

const NAV_COMMANDS: CommandItem[] = [
  { id: "nav-dashboard", label: "Ir al Dashboard", href: "/", icon: <Home size={16} /> },
  { id: "nav-patients", label: "Ir a Pacientes", description: "Listado clínico", href: "/patients", icon: <Users size={16} /> },
  { id: "nav-measurements", label: "Iniciar medición", description: "Buscar paciente primero", href: "/patients", icon: <Stethoscope size={16} /> },
  { id: "nav-operations", label: "Ir a Operaciones", description: "Cola operativa", href: "/operations", icon: <Briefcase size={16} /> },
];

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
};

export function CommandPalette({ open, onClose, inputRef }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredNavCommands = NAV_COMMANDS.filter(
    (cmd) =>
      !query ||
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      (cmd.description?.toLowerCase().includes(query.toLowerCase()) ?? false),
  );

  const patientItems: CommandItem[] = patients.map((p) => ({
    id: `patient-${p.id}`,
    label: p.fullName,
    description: [p.documentType, p.documentNumber].filter(Boolean).join(" ") || undefined,
    href: `/patients/${p.id}`,
    icon: <Users size={16} />,
  }));

  const allItems: CommandItem[] = [...filteredNavCommands, ...patientItems];

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setPatients([]);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPatients([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timeoutId = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "8" });
        const response = await fetch(`/api/patients?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.ok) {
          const data = (await response.json()) as PatientResult[];
          setPatients(data);
        }
      } catch {
        // Abort or network error — ignore
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = allItems[activeIndex];
      if (item) navigate(item.href);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            key="palette"
            role="dialog"
            aria-label="Paleta de comandos"
            aria-modal="true"
            className="fixed left-1/2 top-[15vh] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-edge bg-surface shadow-elevated"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0.32, 1] }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-edge px-4 py-3">
              <Search size={18} className="shrink-0 text-ink-muted" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar paciente, sección o acción…"
                aria-label="Buscar en el sistema"
                aria-autocomplete="list"
                className="flex-1 bg-transparent text-sm text-ink placeholder-ink-placeholder outline-none"
              />
              {loading && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-edge border-t-clinical-500" aria-hidden="true" />
              )}
              <button
                onClick={onClose}
                aria-label="Cerrar paleta de comandos"
                className="rounded-md p-1 text-ink-muted transition-colors hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto p-2" role="listbox" aria-label="Resultados de búsqueda">
              {allItems.length === 0 && !loading && (
                <p className="px-3 py-6 text-center text-sm text-ink-muted">Sin resultados para &ldquo;{query}&rdquo;</p>
              )}

              {filteredNavCommands.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-muted">Navegación</p>
                  {filteredNavCommands.map((item, idx) => (
                    <CommandRow
                      key={item.id}
                      item={item}
                      active={activeIndex === idx}
                      onClick={() => navigate(item.href)}
                    />
                  ))}
                </div>
              )}

              {patientItems.length > 0 && (
                <div>
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-muted">Pacientes</p>
                  {patientItems.map((item, idx) => (
                    <CommandRow
                      key={item.id}
                      item={item}
                      active={activeIndex === filteredNavCommands.length + idx}
                      onClick={() => navigate(item.href)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-edge px-4 py-2 text-[10px] text-ink-muted">
              <span><kbd className="rounded bg-surface-soft px-1 py-0.5 font-mono text-[10px]">↑↓</kbd> navegar</span>
              <span><kbd className="rounded bg-surface-soft px-1 py-0.5 font-mono text-[10px]">↵</kbd> abrir</span>
              <span><kbd className="rounded bg-surface-soft px-1 py-0.5 font-mono text-[10px]">Esc</kbd> cerrar</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CommandRow({
  active,
  item,
  onClick,
}: {
  active: boolean;
  item: CommandItem;
  onClick: () => void;
}) {
  return (
    <button
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active ? "bg-clinical-50 text-clinical-700" : "text-ink hover:bg-surface-soft"
      }`}
    >
      <span className={`shrink-0 ${active ? "text-clinical-600" : "text-ink-muted"}`}>{item.icon}</span>
      <span className="flex-1 truncate">
        <span className="font-medium">{item.label}</span>
        {item.description && (
          <span className="ml-2 text-xs text-ink-muted">{item.description}</span>
        )}
      </span>
    </button>
  );
}
