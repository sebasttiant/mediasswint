"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PATIENT_TIMELINE_EVENT_TYPE } from "@/lib/patient-timeline";

import styles from "../page.module.css";
import {
  buildMeasurementDetailHref,
  buildNewMeasurementHref,
  DOCUMENT_TYPE_OPTIONS,
  executePatientSaveNavigation,
  PATIENT_SEX_OPTIONS,
  patientToFormState,
  type OperationSummary,
  type PatientDetail,
  type PatientFormState,
  type PatientMeasurementSummary,
  type PatientTimelineItem,
} from "./patient-detail-helpers";
import { buildMeasurementsSectionViewModel } from "./patient-detail-view";

function getTimelineBadgeLabel(type: string): string {
  if (type === PATIENT_TIMELINE_EVENT_TYPE.MEASUREMENT_CREATED) return "Medición creada";
  if (type === PATIENT_TIMELINE_EVENT_TYPE.MEASUREMENT_COMPLETED) return "Medición finalizada";
  if (type === PATIENT_TIMELINE_EVENT_TYPE.PATIENT_CREATED) return "Paciente creado";
  if (type === PATIENT_TIMELINE_EVENT_TYPE.PATIENT_UPDATED) return "Paciente actualizado";
  return "Evento clínico";
}

type StatusInfo = { label: string; color: string; bg: string };

const STATUS_MAP: Record<string, StatusInfo> = {
  PRESUPUESTO: { label: "Presupuesto", color: "#b8733f", bg: "#fef5ec" },
  CONFIRMADO: { label: "Confirmado", color: "#10b981", bg: "#ecfdf5" },
  EN_PRODUCCION: { label: "En producción", color: "#3b82f6", bg: "#eff6ff" },
  ENTREGADO: { label: "Entregado", color: "#8b5cf6", bg: "#f5f3ff" },
  CANCELADO: { label: "Cancelado", color: "#ef4444", bg: "#fef2f2" },
};

const STATUS_OPTIONS = [
  { value: "PRESUPUESTO", label: "Presupuesto" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "EN_PRODUCCION", label: "En producción" },
  { value: "ENTREGADO", label: "Entregado" },
  { value: "CANCELADO", label: "Cancelado" },
];

function getOperationStatusInfo(status: string): StatusInfo {
  return STATUS_MAP[status] ?? { label: status, color: "#6b7280", bg: "#f3f4f6" };
}

function formatCurrency(value: string | number | null): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  return `$${num.toLocaleString("es-AR")}`;
}

export default function PatientDetailClient({
  initialPatient,
  recentMeasurements,
  timeline,
  operations,
}: {
  initialPatient: PatientDetail;
  recentMeasurements: PatientMeasurementSummary[];
  timeline: PatientTimelineItem[];
  operations: OperationSummary[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<PatientFormState>(() => patientToFormState(initialPatient));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New operation form state
  const [showOperationForm, setShowOperationForm] = useState(false);
  const [newOpGarmentType, setNewOpGarmentType] = useState("");
  const [newOpTotalAmount, setNewOpTotalAmount] = useState("");
  const [newOpNotes, setNewOpNotes] = useState("");
  const [creatingOp, setCreatingOp] = useState(false);

  // Edit operation state
  const [editingOperationId, setEditingOperationId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ garmentType: "", totalAmount: "", status: "", notes: "" });
  const [updatingOp, setUpdatingOp] = useState(false);

  // Deposit state
  const [depositOperationId, setDepositOperationId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  // Compute summary
  const summary = operations.reduce(
    (acc, op) => {
      if (op.status === "CANCELADO") return acc;
      const total = Number(op.totalAmount ?? 0);
      const deposit = Number(op.depositPaid);
      return {
        totalCount: acc.totalCount + 1,
        totalAmount: acc.totalAmount + total,
        totalDeposit: acc.totalDeposit + deposit,
        totalBalance: acc.totalBalance + (total - deposit),
      };
    },
    { totalCount: 0, totalAmount: 0, totalDeposit: 0, totalBalance: 0 },
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(initialPatient.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        if (response.status === 409) {
          setError("Ya existe un paciente con ese documento");
          return;
        }
        if (response.status === 400) {
          setError("Datos inválidos. Revisá el formulario");
          return;
        }
        if (response.status === 404) {
          setError("El paciente ya no existe");
          return;
        }
        setError("No se pudo actualizar el paciente");
        return;
      }

      executePatientSaveNavigation(router);
    } catch {
      setError("No se pudo actualizar el paciente");
    } finally {
      setSaving(false);
    }
  }

  async function createOperation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newOpGarmentType.trim()) return;

    setCreatingOp(true);
    try {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(initialPatient.id)}/operations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            garmentType: newOpGarmentType.trim(),
            totalAmount: newOpTotalAmount ? String(parseFloat(newOpTotalAmount)) : undefined,
            notes: newOpNotes.trim() || undefined,
          }),
        },
      );

      if (response.ok) {
        setShowOperationForm(false);
        setNewOpGarmentType("");
        setNewOpTotalAmount("");
        setNewOpNotes("");
        router.refresh();
      } else {
        alert("Error al crear operación");
      }
    } finally {
      setCreatingOp(false);
    }
  }

  function startEdit(op: OperationSummary) {
    setEditingOperationId(op.id);
    setDepositOperationId(null);
    setEditForm({
      garmentType: op.garmentType ?? "",
      totalAmount: op.totalAmount ?? "",
      status: op.status,
      notes: op.notes ?? "",
    });
  }

  function startDeposit(op: OperationSummary) {
    setDepositOperationId(op.id);
    setEditingOperationId(null);
    setDepositAmount("");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingOperationId) return;

    setUpdatingOp(true);
    try {
      const body: Record<string, string> = {};
      const original = operations.find((op) => op.id === editingOperationId);
      if (!original) return;

      if (editForm.garmentType !== (original.garmentType ?? "")) {
        body.garmentType = editForm.garmentType;
      }
      if (editForm.totalAmount !== (original.totalAmount ?? "")) {
        body.totalAmount = editForm.totalAmount || "0";
      }
      if (editForm.status !== original.status) {
        body.status = editForm.status;
      }
      if (editForm.notes !== (original.notes ?? "")) {
        body.notes = editForm.notes;
      }

      if (Object.keys(body).length === 0) {
        setEditingOperationId(null);
        return;
      }

      const response = await fetch(
        `/api/patients/${encodeURIComponent(initialPatient.id)}/operations/${editingOperationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (response.ok) {
        setEditingOperationId(null);
        router.refresh();
      } else {
        const json = (await response.json()) as { error?: string };
        alert(json.error ?? "Error al actualizar operación");
      }
    } finally {
      setUpdatingOp(false);
    }
  }

  async function submitDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!depositOperationId || !depositAmount) return;

    setDepositing(true);
    try {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(initialPatient.id)}/operations/${depositOperationId}/deposit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: String(parseFloat(depositAmount)) }),
        },
      );

      if (response.ok) {
        setDepositOperationId(null);
        setDepositAmount("");
        router.refresh();
      } else {
        const json = (await response.json()) as { error?: string };
        alert(json.error ?? "Error al registrar seña");
      }
    } finally {
      setDepositing(false);
    }
  }

  const measurementsViewModel = buildMeasurementsSectionViewModel({
    recentMeasurements,
    patientId: initialPatient.id,
  });

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h2>Datos demográficos</h2>
        {error ? <p className={styles.error}>{error}</p> : null}
        <form onSubmit={onSubmit} className={styles.formGrid}>
          <label>
            Nombre completo*
            <input
              required
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            />
          </label>
          <label>
            Sexo
            <select
              value={form.sex}
              onChange={(event) => setForm((current) => ({ ...current, sex: event.target.value }))}
            >
              <option value="">Seleccionar…</option>
              {PATIENT_SEX_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label>
            Tipo de documento
            <select
              value={form.documentType}
              onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))}
            >
              <option value="">Seleccionar…</option>
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label>
            Número de documento
            <input
              value={form.documentNumber}
              onChange={(event) => setForm((current) => ({ ...current, documentNumber: event.target.value }))}
            />
          </label>
          <label>
            Fecha de nacimiento
            <input
              type="date"
              value={form.birthDate}
              className={styles.dateInput}
              onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
            />
            <span className={styles.fieldHint}>Formato: AAAA-MM-DD</span>
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>
          <label>
            Email
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label className={styles.fullWidthField}>
            Notas
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          <button type="submit" disabled={saving} className={styles.primaryButton}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.tableHeader}>
          <div>
            <h2>Historia clínica</h2>
            <p className={styles.muted}>Timeline cronológico de eventos del paciente</p>
          </div>
        </div>

        {timeline.length > 0 ? (
          <ol className={styles.timelineList}>
            {timeline.map((event) => (
              <li key={event.id} className={styles.timelineItem}>
                <div className={styles.timelineMarker} aria-hidden="true" />
                <div className={styles.timelineContent}>
                  <div className={styles.timelineHeader}>
                    <span className={styles.timelineBadge}>{getTimelineBadgeLabel(event.type)}</span>
                    <time dateTime={event.occurredAt} className={styles.muted}>
                      {new Date(event.occurredAt).toLocaleString("es-AR")}
                    </time>
                  </div>
                  <h3>{event.title}</h3>
                  {event.description ? <p className={styles.muted}>{event.description}</p> : null}
                  {event.measurementId ? (
                    <Link
                      className={styles.patientNameLink}
                      href={buildMeasurementDetailHref(initialPatient.id, event.measurementId)}
                    >
                      Ver detalle de medición
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.muted}>Todavía no hay eventos clínicos para mostrar.</p>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.tableHeader}>
          <div>
            <h2>Operaciones Comerciales</h2>
            <p className={styles.muted}>Presupuestos, pedidos y pagos del paciente</p>
          </div>
          {!showOperationForm && (
            <button
              className={styles.primaryButton}
              onClick={() => {
                setShowOperationForm(true);
                setEditingOperationId(null);
                setDepositOperationId(null);
              }}
            >
              + Nueva Operación
            </button>
          )}
        </div>

        {/* Summary */}
        {operations.length > 0 && (
          <div className={styles.operationsSummary}>
            <div className={styles.operationsSummaryItem}>
              <span>Operaciones</span>
              <strong>{summary.totalCount}</strong>
            </div>
            <div className={styles.operationsSummaryItem}>
              <span>Total presupuestado</span>
              <strong className={styles.opsSummaryNumber}>{formatCurrency(summary.totalAmount)}</strong>
            </div>
            <div className={styles.operationsSummaryItem}>
              <span>Total señado</span>
              <strong className={styles.opsSummaryPositive}>{formatCurrency(summary.totalDeposit)}</strong>
            </div>
            <div className={styles.operationsSummaryItem}>
              <span>Saldo pendiente</span>
              <strong className={styles.opsSummaryPending}>{formatCurrency(summary.totalBalance)}</strong>
            </div>
          </div>
        )}

        {/* New operation form */}
        {showOperationForm && (
          <form onSubmit={createOperation} className={styles.operationNewForm}>
            <div className={styles.operationNewFormFields}>
              <div>
                <label className={styles.operationFormLabel}>
                  Tipo de prenda *
                </label>
                <input
                  type="text"
                  value={newOpGarmentType}
                  onChange={(e) => setNewOpGarmentType(e.target.value)}
                  placeholder="ej: Media compresión"
                  required
                  className={styles.operationFormInput}
                />
              </div>
              <div>
                <label className={styles.operationFormLabel}>
                  Monto total (opcional)
                </label>
                <input
                  type="number"
                  value={newOpTotalAmount}
                  onChange={(e) => setNewOpTotalAmount(e.target.value)}
                  placeholder="ej: 150000"
                  min="0"
                  step="0.01"
                  className={styles.operationFormInput}
                />
              </div>
              <div className={styles.operationNewFormFullWidth}>
                <label className={styles.operationFormLabel}>
                  Notas (opcional)
                </label>
                <textarea
                  value={newOpNotes}
                  onChange={(e) => setNewOpNotes(e.target.value)}
                  placeholder="Observaciones adicionales..."
                  rows={2}
                  className={styles.operationFormInput}
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
            <div className={styles.operationNewFormActions}>
              <button
                type="submit"
                disabled={creatingOp || !newOpGarmentType.trim()}
                className={`${styles.operationActionBtn} ${styles.operationActionBtnPrimary}`}
              >
                {creatingOp ? "Creando..." : "Crear Operación"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOperationForm(false);
                  setNewOpGarmentType("");
                  setNewOpTotalAmount("");
                  setNewOpNotes("");
                }}
                className={styles.operationActionBtn}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Operations list */}
        {operations.length > 0 ? (
          <div className={styles.operationList}>
            {operations.map((op) => {
              const statusInfo = getOperationStatusInfo(op.status);
              const total = op.totalAmount ? Number(op.totalAmount) : 0;
              const deposit = Number(op.depositPaid);
              const balance = total - deposit;
              const isEditing = editingOperationId === op.id;
              const isDepositing = depositOperationId === op.id;

              return (
                <div key={op.id} className={styles.operationCard}>
                  {isEditing ? (
                    /* ── Edit mode ── */
                    <form onSubmit={submitEdit} className={styles.operationInlineForm}>
                      <div className={styles.operationInlineFormFields}>
                        <div>
                          <label className={styles.operationFormLabel}>Prenda</label>
                          <input
                            className={styles.operationFormInput}
                            value={editForm.garmentType}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, garmentType: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>Monto total</label>
                          <input
                            className={styles.operationFormInput}
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.totalAmount}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, totalAmount: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>Estado</label>
                          <select
                            className={styles.operationFormSelect}
                            value={editForm.status}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>Seña actual</label>
                          <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem", fontWeight: 600, color: "#10b981" }}>
                            {formatCurrency(op.depositPaid)}
                          </p>
                        </div>
                        <div className={styles.operationFormFullWidth}>
                          <label className={styles.operationFormLabel}>Notas</label>
                          <textarea
                            className={styles.operationFormInput}
                            rows={2}
                            style={{ resize: "vertical" }}
                            value={editForm.notes}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className={styles.operationFormActions}>
                        <button
                          type="submit"
                          disabled={updatingOp}
                          className={`${styles.operationActionBtn} ${styles.operationActionBtnPrimary}`}
                        >
                          {updatingOp ? "Guardando..." : "Guardar cambios"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingOperationId(null)}
                          className={styles.operationActionBtn}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* ── View mode ── */
                    <>
                      <div className={styles.operationCardHeader}>
                        <div>
                          <span
                            className={styles.operationStatusBadge}
                            style={{ background: statusInfo.bg, color: statusInfo.color }}
                          >
                            {statusInfo.label}
                          </span>
                          <h3 className={styles.operationTitle}>
                            {op.garmentType ?? "Operación comercial"}
                          </h3>
                        </div>
                        <time className={styles.operationDate}>
                          {new Date(op.createdAt).toLocaleDateString("es-AR")}
                        </time>
                      </div>
                      <div className={styles.operationCardBody}>
                        {total > 0 && (
                          <div className={styles.operationFinanceGrid}>
                            <div className={styles.operationFinanceItem}>
                              <p>Total</p>
                              <p>{formatCurrency(op.totalAmount)}</p>
                            </div>
                            <div className={styles.operationFinanceItem}>
                              <p>Seña</p>
                              <p className={styles.operationFinancePositive}>{formatCurrency(op.depositPaid)}</p>
                            </div>
                            <div className={styles.operationFinanceItem}>
                              <p>Saldo</p>
                              <p className={balance > 0 ? styles.operationFinanceWarning : styles.operationFinancePositive}>
                                {formatCurrency(balance)}
                              </p>
                            </div>
                          </div>
                        )}
                        {op.notes && (
                          <p className={styles.operationNotes}>{op.notes}</p>
                        )}
                        <div className={styles.operationActions}>
                          <button
                            className={styles.operationActionBtn}
                            onClick={() => startEdit(op)}
                          >
                            Editar
                          </button>
                          <button
                            className={styles.operationActionBtn}
                            onClick={() => startDeposit(op)}
                            disabled={op.status === "CANCELADO"}
                            title={op.status === "CANCELADO" ? "No se pueden agregar señas a operaciones canceladas" : undefined}
                          >
                            + Seña
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Deposit form ── */}
                  {isDepositing && !isEditing && (
                    <form onSubmit={submitDeposit} className={styles.depositForm}>
                      <label>Monto de la seña:</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="ej: 50000"
                        required
                        className={styles.depositInput}
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={depositing || !depositAmount}
                        className={`${styles.operationActionBtn} ${styles.operationActionBtnPrimary}`}
                      >
                        {depositing ? "Registrando..." : "Confirmar seña"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositOperationId(null)}
                        className={styles.operationActionBtn}
                      >
                        Cancelar
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.muted}>Todavía no hay operaciones comerciales.</p>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.tableHeader}>
          <div>
            <h2>Medidas</h2>
            <p className={styles.muted}>Mediciones digitales recientes del paciente</p>
          </div>
          <Link className={styles.primaryButton} href={buildNewMeasurementHref(initialPatient.id)}>
            Nueva medición
          </Link>
        </div>
        {measurementsViewModel.kind === "empty" ? (
          <p className={styles.muted}>{measurementsViewModel.message}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Prenda</th>
                  <th>Clase</th>
                  <th>Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {measurementsViewModel.rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Fecha">
                      <Link className={styles.patientNameLink} href={row.href}>
                        {new Date(row.measuredAt).toLocaleString("es-AR")}
                      </Link>
                    </td>
                    <td data-label="Estado">{row.status}</td>
                    <td data-label="Prenda">{row.garmentType ?? "—"}</td>
                    <td data-label="Clase">{row.compressionClass ?? "—"}</td>
                    <td data-label="Diagnóstico">{row.diagnosis ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
