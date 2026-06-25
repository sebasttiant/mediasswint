// List of active Colombian EPS (health insurance entities) as of 2025.
// The business should verify and extend this list as the regulatory landscape changes.
export const COLOMBIA_HEALTH_INSURERS: readonly string[] = [
  "AIC EPSI",
  "Aliansalud EPS",
  "Anas Wayuu EPSI",
  "Asmet Salud EPS",
  "Cajacopi EPS",
  "Capital Salud EPS",
  "Capresoca EPS",
  "Coosalud EPS",
  "Comfaoriente EPS",
  "Comfenalco Valle EPS",
  "Compensar EPS",
  "Dusakawi EPSI",
  "EPS Sanitas",
  "Emssanar EPS",
  "Familiar de Colombia EPS",
  "Famisanar EPS",
  "Mallamas EPSI",
  "Mutual SER",
  "Nueva EPS",
  "Pijaos Salud EPSI",
  "Salud Bolívar EPS",
  "Salud Total EPS",
  "Savia Salud EPS",
  "SOS - Servicio Occidental de Salud",
  "Sura EPS",
];

// Sentinel value displayed in the select when the stored health insurer
// is not found in COLOMBIA_HEALTH_INSURERS. Selecting this option reveals
// a free-text input so the user can enter a custom insurer name.
export const HEALTH_INSURANCE_OTHER = "Otra";
