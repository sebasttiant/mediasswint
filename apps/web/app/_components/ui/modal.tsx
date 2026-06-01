"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "./cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Small uppercase line shown above the title (e.g. "ACCESO AL PANEL ADMINISTRATIVO"). */
  eyebrow?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: dark blurred overlay, centered card, visible close
 * button, Escape to dismiss, and a basic focus trap that returns focus to the
 * trigger on close. Presentation-only — callers own the body and any forms.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog so keyboard/screen-reader users land inside it.
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables?.[0] ?? panelRef.current)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={description ? descriptionId : undefined}
    >
      {/* Backdrop: dark + blur. Clicking it dismisses the dialog. */}
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-900/60 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 pb-5 pt-6">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand">{eyebrow}</p>
            ) : null}
            <h2 id={headingId} className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-5">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
