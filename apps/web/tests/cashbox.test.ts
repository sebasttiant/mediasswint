import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDailyCashbox,
  filterDailyRowsByRange,
  resolveCashboxRange,
  shiftDateKey,
  toCashboxDateKey,
  CASHBOX_COLORS,
  type CashboxMovement,
  type DailyCashboxRow,
} from "@/lib/cashbox";

function movement(overrides: Partial<CashboxMovement>): CashboxMovement {
  return {
    amount: 0,
    method: "EFECTIVO",
    incomeType: "PRIMERA_VEZ",
    dateKey: "2026-06-17",
    ...overrides,
  };
}

describe("buildDailyCashbox — income type buckets", () => {
  it("groups abonos into 1 Vez, R, MEFE and sums Total Abonos", () => {
    const [row] = buildDailyCashbox(
      [
        movement({ amount: 100, incomeType: "PRIMERA_VEZ" }),
        movement({ amount: 50, incomeType: "R" }),
        movement({ amount: 25, incomeType: "MEFE" }),
      ],
      [],
      [],
    );

    assert.equal(row.primeraVez, 100);
    assert.equal(row.r, 50);
    assert.equal(row.mefe, 25);
    assert.equal(row.totalAbonos, 175);
  });

  it("groups reclamados and sums Total Reclamados", () => {
    const [row] = buildDailyCashbox(
      [
        movement({ amount: 80, incomeType: "RECLAMADO_PRIMERA_VEZ" }),
        movement({ amount: 20, incomeType: "RECLAMADO_R" }),
      ],
      [],
      [],
    );

    assert.equal(row.reclamadoPrimeraVez, 80);
    assert.equal(row.reclamadoR, 20);
    assert.equal(row.totalReclamados, 100);
  });
});

describe("buildDailyCashbox — method buckets and Total Bancos", () => {
  it("sums Total Bancos as Transferencia + BOLD + Tarjeta débito + Tarjeta crédito (excludes Efectivo and Otro)", () => {
    const [row] = buildDailyCashbox(
      [
        movement({ amount: 10, method: "EFECTIVO" }),
        movement({ amount: 100, method: "TRANSFERENCIA" }),
        movement({ amount: 200, method: "BOLD" }),
        movement({ amount: 300, method: "TARJETA_DEBITO" }),
        movement({ amount: 400, method: "TARJETA_CREDITO" }),
        movement({ amount: 999, method: "OTRO" }),
      ],
      [],
      [],
    );

    assert.equal(row.transferencias, 100);
    assert.equal(row.bold, 200);
    assert.equal(row.tarjetaDebito, 300);
    assert.equal(row.tarjetaCredito, 400);
    assert.equal(row.efectivo, 10);
    assert.equal(row.otros, 999);
    assert.equal(row.totalBancos, 1000); // 100 + 200 + 300 + 400
  });
});

describe("buildDailyCashbox — cashbox formulas", () => {
  it("computes Venta Bruta = Total Abonos + Total Reclamados - Total Bancos - Otros (== Efectivo)", () => {
    const [row] = buildDailyCashbox(
      [
        movement({ amount: 500, method: "EFECTIVO", incomeType: "PRIMERA_VEZ" }),
        movement({ amount: 300, method: "TRANSFERENCIA", incomeType: "R" }),
        movement({ amount: 200, method: "EFECTIVO", incomeType: "RECLAMADO_PRIMERA_VEZ" }),
      ],
      [],
      [],
    );

    // totalAbonos = 800, totalReclamados = 200, totalBancos = 300, otros = 0
    assert.equal(row.totalAbonos, 800);
    assert.equal(row.totalReclamados, 200);
    assert.equal(row.totalBancos, 300);
    assert.equal(row.ventaBruta, 700); // 800 + 200 - 300 - 0
    assert.equal(row.ventaBruta, row.efectivo); // invariant: gross cash == efectivo
  });

  it("excludes method=OTRO from cash so it never contaminates Venta Bruta or Diferencia", () => {
    const [row] = buildDailyCashbox(
      [
        movement({ amount: 1000, method: "EFECTIVO", incomeType: "PRIMERA_VEZ" }),
        movement({ amount: 500, method: "OTRO", incomeType: "PRIMERA_VEZ" }),
      ],
      [],
      [{ amount: 1000, dateKey: "2026-06-17" }],
    );

    // Otro is shown separately but is NOT physical cash.
    assert.equal(row.efectivo, 1000);
    assert.equal(row.otros, 500);
    assert.equal(row.totalAbonos, 1500); // both still classified by income type
    assert.equal(row.ventaBruta, 1000); // 1500 - 0 (bancos) - 500 (otros) == efectivo
    assert.equal(row.ventaNetaEfectivo, 1000);
    // Counted cash (1000) matches expected cash (1000) → no difference, despite the
    // 500 in "Otro". Under the old formula this would have been -500.
    assert.equal(row.diferencia, 0);
  });

  it("computes Venta neta efectivo = Venta Bruta - Egresos", () => {
    const [row] = buildDailyCashbox(
      [movement({ amount: 1000, method: "EFECTIVO", incomeType: "PRIMERA_VEZ" })],
      [{ amount: 150, dateKey: "2026-06-17" }],
      [],
    );

    assert.equal(row.ventaBruta, 1000);
    assert.equal(row.egresos, 150);
    assert.equal(row.ventaNetaEfectivo, 850);
  });

  it("computes Diferencia = Real contado - Venta neta efectivo when a count exists", () => {
    const [row] = buildDailyCashbox(
      [movement({ amount: 1000, method: "EFECTIVO", incomeType: "PRIMERA_VEZ" })],
      [{ amount: 100, dateKey: "2026-06-17" }],
      [{ amount: 920, dateKey: "2026-06-17" }],
    );

    assert.equal(row.ventaNetaEfectivo, 900); // 1000 - 100
    assert.equal(row.realContado, 920);
    assert.equal(row.diferencia, 20); // 920 - 900
  });

  it("leaves Real contado and Diferencia null when no count was registered", () => {
    const [row] = buildDailyCashbox(
      [movement({ amount: 1000, method: "EFECTIVO", incomeType: "PRIMERA_VEZ" })],
      [],
      [],
    );

    assert.equal(row.realContado, null);
    assert.equal(row.diferencia, null);
  });
});

describe("buildDailyCashbox — multi-day grouping", () => {
  it("produces one row per day, most recent first", () => {
    const rows = buildDailyCashbox(
      [
        movement({ amount: 100, dateKey: "2026-06-15" }),
        movement({ amount: 200, dateKey: "2026-06-17" }),
        movement({ amount: 50, dateKey: "2026-06-15" }),
      ],
      [],
      [],
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0].date, "2026-06-17");
    assert.equal(rows[1].date, "2026-06-15");
    assert.equal(rows[1].primeraVez, 150);
  });

  it("creates a day row for an expense or count even with no movements", () => {
    const rows = buildDailyCashbox(
      [],
      [{ amount: 30, dateKey: "2026-06-10" }],
      [{ amount: 0, dateKey: "2026-06-10" }],
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].date, "2026-06-10");
    assert.equal(rows[0].egresos, 30);
    assert.equal(rows[0].ventaBruta, 0);
    assert.equal(rows[0].ventaNetaEfectivo, -30);
    assert.equal(rows[0].diferencia, 30); // 0 - (-30)
  });
});

describe("buildDailyCashbox — money precision", () => {
  it("rounds to 2 decimals avoiding float drift", () => {
    const [row] = buildDailyCashbox(
      [
        movement({ amount: 0.1, incomeType: "PRIMERA_VEZ" }),
        movement({ amount: 0.2, incomeType: "PRIMERA_VEZ" }),
      ],
      [],
      [],
    );

    assert.equal(row.primeraVez, 0.3);
  });
});

describe("toCashboxDateKey", () => {
  it("returns the America/Bogota calendar day as YYYY-MM-DD", () => {
    // 2026-06-18 02:00 UTC is still 2026-06-17 21:00 in Bogota (UTC-5)
    assert.equal(toCashboxDateKey(new Date("2026-06-18T02:00:00Z")), "2026-06-17");
    assert.equal(toCashboxDateKey(new Date("2026-06-17T12:00:00Z")), "2026-06-17");
  });
});

describe("resolveCashboxRange", () => {
  const today = "2026-06-17";

  it("defaults both bounds to today when nothing is provided", () => {
    assert.deepEqual(resolveCashboxRange({}, today), { from: today, to: today });
    assert.deepEqual(resolveCashboxRange({ from: null, to: null }, today), {
      from: today,
      to: today,
    });
  });

  it("passes through a valid from/to range", () => {
    assert.deepEqual(resolveCashboxRange({ from: "2026-06-01", to: "2026-06-10" }, today), {
      from: "2026-06-01",
      to: "2026-06-10",
    });
  });

  it("falls back an invalid bound to today, keeping the valid one", () => {
    // from is invalid → today (06-17); with to=06-10 the range inverts, so it is
    // swapped back to a valid 06-10..06-17 window.
    assert.deepEqual(resolveCashboxRange({ from: "nope", to: "2026-06-10" }, today), {
      from: "2026-06-10",
      to: today,
    });
    assert.deepEqual(resolveCashboxRange({ from: "2026-06-01", to: "31/12/2026" }, today), {
      from: "2026-06-01",
      to: today,
    });
  });

  it("rejects a calendar-shaped but impossible date and falls back to today", () => {
    // 2026-02-30 matches the YYYY-MM-DD shape but is not a real day; it must not
    // sneak through as a valid bound. `to` is after today so the swap is not in play.
    assert.deepEqual(resolveCashboxRange({ from: "2026-02-30", to: "2026-12-25" }, today), {
      from: today,
      to: "2026-12-25",
    });
  });

  it("swaps the bounds when from is after to so the range is never empty", () => {
    assert.deepEqual(resolveCashboxRange({ from: "2026-06-10", to: "2026-06-01" }, today), {
      from: "2026-06-01",
      to: "2026-06-10",
    });
  });
});

describe("shiftDateKey", () => {
  it("shifts a date key back and forth by calendar days", () => {
    assert.equal(shiftDateKey("2026-06-17", -6), "2026-06-11");
    assert.equal(shiftDateKey("2026-06-17", 0), "2026-06-17");
    assert.equal(shiftDateKey("2026-06-17", 3), "2026-06-20");
  });

  it("crosses month boundaries correctly", () => {
    assert.equal(shiftDateKey("2026-06-01", -1), "2026-05-31");
    assert.equal(shiftDateKey("2026-12-31", 1), "2027-01-01");
  });
});

describe("filterDailyRowsByRange", () => {
  const row = (date: string): DailyCashboxRow =>
    buildDailyCashbox([{ amount: 1, method: "EFECTIVO", incomeType: "PRIMERA_VEZ", dateKey: date }], [], [])[0];
  const rows = ["2026-06-20", "2026-06-17", "2026-06-15", "2026-06-10"].map(row);

  it("keeps rows whose date is within the inclusive range", () => {
    const result = filterDailyRowsByRange(rows, "2026-06-15", "2026-06-17");
    assert.deepEqual(
      result.map((r) => r.date),
      ["2026-06-17", "2026-06-15"],
    );
  });

  it("includes both range boundaries", () => {
    const result = filterDailyRowsByRange(rows, "2026-06-10", "2026-06-20");
    assert.equal(result.length, 4);
  });

  it("returns a single day when from equals to", () => {
    const result = filterDailyRowsByRange(rows, "2026-06-17", "2026-06-17");
    assert.deepEqual(
      result.map((r) => r.date),
      ["2026-06-17"],
    );
  });

  it("returns nothing when the range has no matching days", () => {
    assert.equal(filterDailyRowsByRange(rows, "2026-07-01", "2026-07-31").length, 0);
  });
});

describe("CASHBOX_COLORS", () => {
  it("matches the Excel palette", () => {
    assert.equal(CASHBOX_COLORS.abonos, "#FFFFCC");
    assert.equal(CASHBOX_COLORS.reclamados, "#FF99CC");
    assert.equal(CASHBOX_COLORS.bancos, "#99CCFF");
    assert.equal(CASHBOX_COLORS.ventaNetaEfectivo, "#FFFF00");
  });
});
