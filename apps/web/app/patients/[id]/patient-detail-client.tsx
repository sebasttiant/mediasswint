"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { ageToApproxBirthDate, computeAge, formatISODate } from "@/lib/patient-age";
import { useRouter } from "next/navigation";

import { PATIENT_TIMELINE_EVENT_TYPE } from "@/lib/patient-timeline";
import { formatClinicDate, formatClinicDateTime } from "@/lib/datetime";
import {
  PAYMENT_BANKS,
  PAYMENT_INCOME_TYPES,
  PAYMENT_METHODS,
  type PaymentBank,
  type PaymentIncomeType,
  type PaymentMethod,
} from "@/lib/cashbox";

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
import { COLOMBIA_HEALTH_INSURERS, HEALTH_INSURANCE_OTHER } from "@/lib/health-insurance-catalog";
import {
  buildCommercialSummary,
  buildOperationFinancials,
  buildMeasurementsSectionViewModel,
} from "./patient-detail-view";

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

// Etapa E: order metadata form scaffolding. Empty fields are treated as
// "absent" — sending only non-empty values. Clearing a previously-set field is
// out of scope for v1.
const OPERATION_METADATA_FIELDS = [
  "orderNumber",
  "orderedAt",
  "productCode",
  "productType",
  "quantity",
  "invoiceNumber",
  "invoiceDate",
  "discount",
  "exitDate",
] as const;

type OperationMetadataForm = Record<(typeof OPERATION_METADATA_FIELDS)[number], string>;

const EMPTY_OPERATION_METADATA_FORM: OperationMetadataForm = {
  orderNumber: "",
  orderedAt: "",
  productCode: "",
  productType: "",
  quantity: "",
  invoiceNumber: "",
  invoiceDate: "",
  discount: "",
  exitDate: "",
};

// ISO timestamps → YYYY-MM-DD for native date inputs.
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function operationToMetadataForm(op: OperationSummary): OperationMetadataForm {
  return {
    orderNumber: op.orderNumber ?? "",
    orderedAt: toDateInputValue(op.orderedAt),
    productCode: op.productCode ?? "",
    productType: op.productType ?? "",
    quantity: op.quantity != null ? String(op.quantity) : "",
    invoiceNumber: op.invoiceNumber ?? "",
    invoiceDate: toDateInputValue(op.invoiceDate),
    discount: op.discount ?? "",
    exitDate: toDateInputValue(op.exitDate),
  };
}

// Only include non-empty metadata values in a request payload.
function compactMetadataPayload(form: OperationMetadataForm): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const field of OPERATION_METADATA_FIELDS) {
    const value = form[field].trim();
    if (value) payload[field] = value;
  }
  return payload;
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
  const [newOpMeta, setNewOpMeta] = useState<OperationMetadataForm>(EMPTY_OPERATION_METADATA_FORM);
  const [creatingOp, setCreatingOp] = useState(false);

  // Edit operation state
  const [editingOperationId, setEditingOperationId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    garmentType: "",
    totalAmount: "",
    status: "",
    notes: "",
    ...EMPTY_OPERATION_METADATA_FORM,
  });
  const [updatingOp, setUpdatingOp] = useState(false);

  // Deposit state
  const [depositOperationId, setDepositOperationId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>("EFECTIVO");
  const [depositBank, setDepositBank] = useState<PaymentBank | "">("");
  const [depositIncomeType, setDepositIncomeType] = useState<PaymentIncomeType>("PRIMERA_VEZ");
  const [depositing, setDepositing] = useState(false);

  // Compute summary (CANCELADO excluded; pending balance floored at 0).
  const summary = buildCommercialSummary(operations);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Apply age/DOB disambiguation: if user deliberately edited Edad (ageTouched),
      // compute an approximate birthDate from the age. Otherwise send the exact stored value.
      // Strip UI-only keys (ageInput, ageTouched, healthInsuranceCustom) so rejectUnknownFields
      // doesn't 400. Resolve the final healthInsurance value from the select + free-text.
      const { ageInput, ageTouched, healthInsuranceCustom, ...rest } = form;
      const outgoingBirthDate =
        ageTouched && ageInput.trim() !== "" && !Number.isNaN(Number(ageInput))
          ? formatISODate(ageToApproxBirthDate(Number(ageInput)))
          : rest.birthDate;
      const outgoingHealthInsurance =
        rest.healthInsurance === HEALTH_INSURANCE_OTHER
          ? healthInsuranceCustom.trim() || null
          : rest.healthInsurance || null;

      const response = await fetch(`/api/patients/${encodeURIComponent(initialPatient.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          birthDate: outgoingBirthDate,
          healthInsurance: outgoingHealthInsurance,
        }),
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
            ...compactMetadataPayload(newOpMeta),
          }),
        },
      );

      if (response.ok) {
        setShowOperationForm(false);
        setNewOpGarmentType("");
        setNewOpTotalAmount("");
        setNewOpNotes("");
        setNewOpMeta(EMPTY_OPERATION_METADATA_FORM);
        router.refresh();
      } else {
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        alert(json?.error ?? "Error al crear operación");
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
      ...operationToMetadataForm(op),
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

      // Etapa E metadata: send only changed, non-empty fields. Clearing an
      // existing value is out of scope for v1.
      const metadataBaseline = operationToMetadataForm(original);
      for (const field of OPERATION_METADATA_FIELDS) {
        const next = editForm[field].trim();
        if (next && next !== metadataBaseline[field]) {
          body[field] = next;
        }
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
          body: JSON.stringify({
            amount: String(parseFloat(depositAmount)),
            method: depositMethod,
            bank: depositMethod === "TRANSFERENCIA" && depositBank ? depositBank : null,
            incomeType: depositIncomeType,
          }),
        },
      );

      if (response.ok) {
        setDepositOperationId(null);
        setDepositAmount("");
        setDepositMethod("EFECTIVO");
        setDepositBank("");
        setDepositIncomeType("PRIMERA_VEZ");
        router.refresh();
      } else {
        const json = (await response.json()) as { error?: string };
        alert(json.error ?? "Error al registrar abono");
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
          {/* 1. Nombre completo — full width */}
          <label className={styles.fullWidthField}>
            Nombre completo*
            <input
              required
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            />
          </label>

          {/* 2. Sexo | Tipo de documento */}
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

          {/* 3. Número de documento | Fecha de nacimiento */}
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
              onChange={(event) => setForm((current) => ({
                ...current,
                birthDate: event.target.value,
                // When user edits DOB directly, update the read-only ageInput display
                ageInput: event.target.value
                  ? String(computeAge(new Date(event.target.value)))
                  : "",
                ageTouched: false,
              }))}
            />
          </label>

          {/* 4. Edad | Teléfono */}
          <label>
            Edad
            {form.birthDate ? (
              <input
                type="number"
                value={form.ageInput}
                readOnly
                disabled
                aria-label="Edad calculada (solo lectura cuando la fecha de nacimiento está establecida)"
              />
            ) : (
              <input
                type="number"
                min="0"
                max="130"
                value={form.ageInput}
                placeholder="Ej: 35"
                onChange={(event) => setForm((current) => ({
                  ...current,
                  ageInput: event.target.value,
                  ageTouched: true,
                }))}
              />
            )}
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>

          {/* 5. Email | Entidad de salud */}
          <label>
            Email
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            Entidad de salud
            <select
              value={form.healthInsurance}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  healthInsurance: event.target.value,
                  healthInsuranceCustom:
                    event.target.value !== HEALTH_INSURANCE_OTHER ? "" : current.healthInsuranceCustom,
                }))
              }
            >
              <option value="">Seleccionar…</option>
              {COLOMBIA_HEALTH_INSURERS.map((eps) => (
                <option key={eps} value={eps}>{eps}</option>
              ))}
              <option value={HEALTH_INSURANCE_OTHER}>Otra…</option>
            </select>
            {form.healthInsurance === HEALTH_INSURANCE_OTHER && (
              <input
                style={{ marginTop: "0.35rem" }}
                placeholder="Nombre de la entidad"
                value={form.healthInsuranceCustom}
                maxLength={120}
                onChange={(event) =>
                  setForm((current) => ({ ...current, healthInsuranceCustom: event.target.value }))
                }
              />
            )}
          </label>

          {/* 6. Dirección — full width */}
          <label className={styles.fullWidthField}>
            Dirección
            <input
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Ej: Calle 123, Barrio Centro"
              maxLength={160}
            />
          </label>

          {/* 7. Notas — full width */}
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
                      {formatClinicDateTime(event.occurredAt)}
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
              <span>Total abonado</span>
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
              <div>
                <label className={styles.operationFormLabel}>N° de orden</label>
                <input
                  type="text"
                  value={newOpMeta.orderNumber}
                  onChange={(e) => setNewOpMeta((p) => ({ ...p, orderNumber: e.target.value }))}
                  placeholder="ej: 3952"
                  maxLength={32}
                  className={styles.operationFormInput}
                />
              </div>
              <div>
                <label className={styles.operationFormLabel}>Fecha de orden</label>
                <input
                  type="date"
                  value={newOpMeta.orderedAt}
                  onChange={(e) => setNewOpMeta((p) => ({ ...p, orderedAt: e.target.value }))}
                  className={styles.operationFormInput}
                />
              </div>
              <div>
                <label className={styles.operationFormLabel}>Código de producto</label>
                <input
                  type="text"
                  value={newOpMeta.productCode}
                  onChange={(e) => setNewOpMeta((p) => ({ ...p, productCode: e.target.value }))}
                  maxLength={64}
                  className={styles.operationFormInput}
                />
              </div>
              <div>
                <label className={styles.operationFormLabel}>Tipo de producto</label>
                <input
                  type="text"
                  value={newOpMeta.productType}
                  onChange={(e) => setNewOpMeta((p) => ({ ...p, productType: e.target.value }))}
                  maxLength={64}
                  className={styles.operationFormInput}
                />
              </div>
              <div>
                <label className={styles.operationFormLabel}>Cantidad</label>
                <input
                  type="number"
                  value={newOpMeta.quantity}
                  onChange={(e) => setNewOpMeta((p) => ({ ...p, quantity: e.target.value }))}
                  placeholder="1"
                  min="1"
                  step="1"
                  className={styles.operationFormInput}
                />
              </div>
              <div>
                <label className={styles.operationFormLabel}>N° de factura</label>
                <input
                  type="text"
                  value={newOpMeta.invoiceNumber}
                  onChange={(e) => setNewOpMeta((p) => ({ ...p, invoiceNumber: e.target.value }))}
                  maxLength={64}
                  className={styles.operationFormInput}
                />
              </div>
              <div>
                <label className={styles.operationFormLabel}>Fecha de factura</label>
                <input
                  type="date"
                  value={newOpMeta.invoiceDate}
                  onChange={(e) => setNewOpMeta((p) => ({ ...p, invoiceDate: e.target.value }))}
                  className={styles.operationFormInput}
                />
              </div>
              <div>
                <label className={styles.operationFormLabel}>Descuento</label>
                <input
                  type="number"
                  value={newOpMeta.discount}
                  onChange={(e) => setNewOpMeta((p) => ({ ...p, discount: e.target.value }))}
                  min="0"
                  step="0.01"
                  className={styles.operationFormInput}
                />
              </div>
              <div>
                <label className={styles.operationFormLabel}>Fecha de salida</label>
                <input
                  type="date"
                  value={newOpMeta.exitDate}
                  onChange={(e) => setNewOpMeta((p) => ({ ...p, exitDate: e.target.value }))}
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
                  setNewOpMeta(EMPTY_OPERATION_METADATA_FORM);
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
              const financials = buildOperationFinancials(op);
              const isEditing = editingOperationId === op.id;
              const isDepositing = depositOperationId === op.id;
              const depositDisabledReason = financials.isCancelled
                ? "No se pueden agregar abonos a operaciones canceladas"
                : financials.isFullyPaid
                  ? "La operación ya está totalmente pagada"
                  : undefined;

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
                          <label className={styles.operationFormLabel}>Abono actual</label>
                          <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem", fontWeight: 600, color: "#10b981" }}>
                            {formatCurrency(op.depositPaid)}
                          </p>
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>N° de orden</label>
                          <input
                            className={styles.operationFormInput}
                            type="text"
                            maxLength={32}
                            value={editForm.orderNumber}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, orderNumber: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>Fecha de orden</label>
                          <input
                            className={styles.operationFormInput}
                            type="date"
                            value={editForm.orderedAt}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, orderedAt: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>Código de producto</label>
                          <input
                            className={styles.operationFormInput}
                            type="text"
                            maxLength={64}
                            value={editForm.productCode}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, productCode: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>Tipo de producto</label>
                          <input
                            className={styles.operationFormInput}
                            type="text"
                            maxLength={64}
                            value={editForm.productType}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, productType: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>Cantidad</label>
                          <input
                            className={styles.operationFormInput}
                            type="number"
                            min="1"
                            step="1"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, quantity: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>N° de factura</label>
                          <input
                            className={styles.operationFormInput}
                            type="text"
                            maxLength={64}
                            value={editForm.invoiceNumber}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>Fecha de factura</label>
                          <input
                            className={styles.operationFormInput}
                            type="date"
                            value={editForm.invoiceDate}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, invoiceDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>Descuento</label>
                          <input
                            className={styles.operationFormInput}
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.discount}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, discount: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={styles.operationFormLabel}>Fecha de salida</label>
                          <input
                            className={styles.operationFormInput}
                            type="date"
                            value={editForm.exitDate}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, exitDate: e.target.value }))}
                          />
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
                          {formatClinicDate(op.createdAt)}
                        </time>
                      </div>
                      <div className={styles.operationCardBody}>
                        {financials.hasTotal && (
                          <div className={styles.operationFinanceGrid}>
                            <div className={styles.operationFinanceItem}>
                              <p>Total</p>
                              <p>{formatCurrency(op.totalAmount)}</p>
                            </div>
                            <div className={styles.operationFinanceItem}>
                              <p>Abono</p>
                              <p className={styles.operationFinancePositive}>{formatCurrency(op.depositPaid)}</p>
                            </div>
                            <div className={styles.operationFinanceItem}>
                              <p>Saldo</p>
                              <p className={financials.pendingBalance > 0 ? styles.operationFinanceWarning : styles.operationFinancePositive}>
                                {financials.isFullyPaid ? "Pagado" : formatCurrency(financials.pendingBalance)}
                              </p>
                            </div>
                          </div>
                        )}
                        {(() => {
                          const metaItems: Array<[string, string]> = [];
                          if (op.orderNumber) metaItems.push(["N° orden", op.orderNumber]);
                          if (op.orderedAt) metaItems.push(["Fecha orden", formatClinicDate(op.orderedAt)]);
                          const product = [op.productCode, op.productType].filter(Boolean).join(" · ");
                          if (product) metaItems.push(["Producto", product]);
                          if (op.quantity != null) metaItems.push(["Cantidad", String(op.quantity)]);
                          if (op.invoiceNumber) metaItems.push(["N° factura", op.invoiceNumber]);
                          if (op.invoiceDate) metaItems.push(["Fecha factura", formatClinicDate(op.invoiceDate)]);
                          if (op.discount) metaItems.push(["Descuento", formatCurrency(op.discount)]);
                          if (op.exitDate) metaItems.push(["Fecha salida", formatClinicDate(op.exitDate)]);
                          if (metaItems.length === 0) return null;
                          return (
                            <dl className={styles.operationMetaGrid}>
                              {metaItems.map(([label, value]) => (
                                <div key={label}>
                                  <dt>{label}</dt>
                                  <dd>{value}</dd>
                                </div>
                              ))}
                            </dl>
                          );
                        })()}
                        {op.notes && (
                          <p className={styles.operationNotes}>{op.notes}</p>
                        )}
                        <div className={styles.operationActions}>
                          <button
                            className={styles.operationActionBtn}
                            onClick={() => startEdit(op)}
                            disabled={!financials.canEdit}
                            title={financials.canEdit ? undefined : "Las operaciones canceladas no se pueden editar"}
                          >
                            Editar
                          </button>
                          <button
                            className={styles.operationActionBtn}
                            onClick={() => startDeposit(op)}
                            disabled={!financials.canDeposit}
                            title={depositDisabledReason}
                            aria-describedby={depositDisabledReason ? `deposit-disabled-${op.id}` : undefined}
                          >
                            + Abono
                          </button>
                          {depositDisabledReason ? (
                            <span id={`deposit-disabled-${op.id}`} className={styles.muted}>
                              {depositDisabledReason}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Deposit form ── */}
                  {isDepositing && !isEditing && (
                    <form onSubmit={submitDeposit} className={styles.depositForm}>
                      <label>
                        Monto del abono:
                        {financials.hasTotal ? (
                          <span className={styles.muted}> (saldo pendiente: {formatCurrency(financials.pendingBalance)})</span>
                        ) : null}
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        max={financials.hasTotal ? financials.pendingBalance : undefined}
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="ej: 50000"
                        required
                        className={styles.depositInput}
                        autoFocus
                      />
                      <label className={styles.depositField}>
                        Método de pago:
                        <select
                          className={styles.depositSelect}
                          value={depositMethod}
                          onChange={(e) => setDepositMethod(e.target.value as PaymentMethod)}
                        >
                          {PAYMENT_METHODS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {depositMethod === "TRANSFERENCIA" && (
                        <label className={styles.depositField}>
                          Banco / origen:
                          <select
                            className={styles.depositSelect}
                            value={depositBank}
                            onChange={(e) => setDepositBank(e.target.value as PaymentBank | "")}
                          >
                            <option value="">Sin especificar</option>
                            {PAYMENT_BANKS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className={styles.depositField}>
                        Tipo de ingreso:
                        <select
                          className={styles.depositSelect}
                          value={depositIncomeType}
                          onChange={(e) => setDepositIncomeType(e.target.value as PaymentIncomeType)}
                        >
                          {PAYMENT_INCOME_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        disabled={depositing || !depositAmount}
                        className={`${styles.operationActionBtn} ${styles.operationActionBtnPrimary}`}
                      >
                        {depositing ? "Registrando..." : "Confirmar abono"}
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
            <h2>Mediciones</h2>
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
                        {formatClinicDateTime(row.measuredAt)}
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
