export const HEAD_MEASUREMENT_MOBILE_FIGURE_CLASS =
  "lg:hidden border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-4";
export const HEAD_MEASUREMENT_DESKTOP_LAYOUT_CLASS =
  "hidden flex-1 min-h-0 overflow-hidden lg:grid lg:grid-cols-[minmax(360px,480px)_minmax(0,1fr)]";
export const HEAD_MEASUREMENT_DESKTOP_FIGURE_PANEL_CLASS =
  "flex flex-col items-start justify-start overflow-y-auto bg-slate-50 px-4 py-4";
export const HEAD_MEASUREMENT_DESKTOP_FIGURE_CARD_CLASS =
  "sticky top-3 flex w-full max-w-[820px] flex-col items-stretch gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

export function focusVisibleZoneInput(scope: ParentNode, zoneId: string) {
  const inputs = scope.querySelectorAll<HTMLInputElement>("[data-anatomy-zone]");
  const visibleInput = Array.from(inputs).find(
    (input) =>
      input.dataset.anatomyZone === zoneId &&
      !input.disabled &&
      input.getClientRects().length > 0,
  );

  visibleInput?.focus();
}
