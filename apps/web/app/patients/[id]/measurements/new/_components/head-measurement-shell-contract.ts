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
