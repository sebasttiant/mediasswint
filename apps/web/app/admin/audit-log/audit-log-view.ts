import { createElement, type ReactElement, type ReactNode } from "react";
import type { AuditAction } from "@prisma/client";
import { Calendar, Filter, ScrollText, Search } from "lucide-react";

import type { AuditLogRow, ListAuditFilters } from "@/lib/audit-log";
import { formatClinicDateTime } from "@/lib/datetime";

import { AppShell } from "../../_components/app-shell/app-shell";
import { Badge, type BadgeVariant } from "../../_components/ui/badge";
import { Card, CardBody, CardHeader } from "../../_components/ui/card";

export type AuditLogViewUser = { fullName: string | null };

export type AuditFormValues = {
  entityType: string;
  userId: string;
  action: string;
  from: string;
  to: string;
};

export type RawAuditParams = {
  page?: string;
  entityType?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
};

export type ResolvedAuditQuery = {
  filters: ListAuditFilters;
  page: number;
  formValues: AuditFormValues;
};

const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE"] as const;

const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
};

function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}

function nonEmpty(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseDate(value: string | undefined): Date | undefined {
  const trimmed = nonEmpty(value);
  if (trimmed === undefined) return undefined;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

/**
 * Mirror the audit-log route filter parsing for a Server Component: invalid
 * action/date filters are dropped (lenient list view) while the raw values are
 * preserved in formValues so the filter form repopulates what the user typed.
 */
export function resolveAuditQuery(params: RawAuditParams, limit: number): ResolvedAuditQuery {
  const page = parsePage(params.page);
  const skip = (page - 1) * limit;

  const rawAction = nonEmpty(params.action);
  const action = rawAction && isAuditAction(rawAction) ? rawAction : undefined;

  const entityType = nonEmpty(params.entityType) as AuditLogRow["entityType"] | undefined;

  const filters: ListAuditFilters = {
    entityType: entityType as ListAuditFilters["entityType"],
    userId: nonEmpty(params.userId),
    action,
    from: parseDate(params.from),
    to: parseDate(params.to),
    limit,
    skip,
  };

  return {
    filters,
    page,
    formValues: {
      entityType: params.entityType ?? "",
      userId: params.userId ?? "",
      action: params.action ?? "",
      from: params.from ?? "",
      to: params.to ?? "",
    },
  };
}

export type AuditPagination = {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevPage: number;
  nextPage: number;
};

export function buildAuditPagination(args: {
  page: number;
  limit: number;
  total: number;
  rowCount: number;
}): AuditPagination {
  const skip = (args.page - 1) * args.limit;
  return {
    page: args.page,
    hasPrev: args.page > 1,
    hasNext: skip + args.rowCount < args.total,
    prevPage: args.page - 1,
    nextPage: args.page + 1,
  };
}

export type AuditRowView = {
  id: string;
  actorLabel: string;
  actionLabel: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

export type AuditListViewModel =
  | { kind: "empty"; message: string }
  | { kind: "list"; rows: AuditRowView[] };

export function buildAuditListViewModel(rows: AuditLogRow[]): AuditListViewModel {
  if (rows.length === 0) {
    return { kind: "empty", message: "No hay registros de auditoría." };
  }

  return {
    kind: "list",
    rows: rows.map((row) => ({
      id: row.id,
      actorLabel: row.user?.fullName ?? row.user?.email ?? row.userId ?? "Sistema",
      actionLabel: AUDIT_ACTION_LABELS[row.action] ?? row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export function auditActionBadgeVariant(actionLabel: string): BadgeVariant {
  if (actionLabel === "Creación") return "success";
  if (actionLabel === "Actualización") return "info";
  if (actionLabel === "Eliminación") return "danger";
  return "neutral";
}

function buildFilterField(label: string, control: ReactElement): ReactElement {
  return createElement(
    "label",
    { className: "space-y-1.5 text-xs font-bold uppercase tracking-wider text-slate-500" },
    label,
    control,
  );
}

const FILTER_INPUT_CLASS =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10";

function buildFilterForm(formValues: AuditFormValues): ReactElement {
  const actionOptions = [
    { value: "", label: "Todas las acciones" },
    { value: "CREATE", label: "Creación" },
    { value: "UPDATE", label: "Actualización" },
    { value: "DELETE", label: "Eliminación" },
  ];

  return createElement(
    Card,
    null,
    createElement(CardHeader, {
      title: createElement(
        "span",
        { className: "flex items-center gap-2" },
        createElement(Search, { size: 18, className: "text-brand", "aria-hidden": true }),
        "Filtros de auditoría",
      ),
    }),
    createElement(
      CardBody,
      null,
      createElement(
        "form",
        {
          method: "get",
          role: "search",
          "aria-label": "Filtrar auditoría",
          className: "grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_auto] xl:items-end",
        },
        buildFilterField(
          "Tipo de entidad",
          createElement("input", {
            className: FILTER_INPUT_CLASS,
            type: "text",
            name: "entityType",
            defaultValue: formValues.entityType,
            placeholder: "Ej: Patient, User",
            "aria-label": "Tipo de entidad",
          }),
        ),
        buildFilterField(
          "ID de usuario",
          createElement("input", {
            className: FILTER_INPUT_CLASS,
            type: "text",
            name: "userId",
            defaultValue: formValues.userId,
            placeholder: "Usuario o sistema",
            "aria-label": "ID de usuario",
          }),
        ),
        buildFilterField(
          "Acción",
          createElement(
            "select",
            {
              className: FILTER_INPUT_CLASS,
              name: "action",
              defaultValue: formValues.action,
              "aria-label": "Acción",
            },
            actionOptions.map((option) =>
              createElement("option", { key: option.value, value: option.value }, option.label),
            ),
          ),
        ),
        buildFilterField(
          "Desde",
          createElement("input", {
            className: FILTER_INPUT_CLASS,
            type: "date",
            name: "from",
            defaultValue: formValues.from,
            "aria-label": "Desde",
          }),
        ),
        buildFilterField(
          "Hasta",
          createElement("input", {
            className: FILTER_INPUT_CLASS,
            type: "date",
            name: "to",
            defaultValue: formValues.to,
            "aria-label": "Hasta",
          }),
        ),
        createElement(
          "button",
          {
            type: "submit",
            className:
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-strong hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-1",
          },
          createElement(Filter, { size: 16, "aria-hidden": true }),
          "Filtrar",
        ),
      ),
    ),
  );
}

function buildAuditField(label: string, value: ReactNode): ReactElement {
  return createElement(
    "div",
    { key: label, className: "min-w-0" },
    createElement(
      "dt",
      { className: "text-[11px] font-bold uppercase tracking-wider text-slate-400" },
      label,
    ),
    createElement("dd", { className: "mt-0.5 min-w-0 break-words text-sm text-slate-700" }, value),
  );
}

// Mobile/small-tablet: each audit row becomes a labeled card so the 5 columns
// never clip or force horizontal scroll. The real table returns at md+.
function buildAuditCards(rows: AuditRowView[]): ReactElement {
  return createElement(
    "ul",
    { className: "flex flex-col gap-3 md:hidden" },
    rows.map((row) =>
      createElement(
        "li",
        { key: row.id, className: "rounded-xl border border-slate-200 p-4" },
        createElement(
          "dl",
          { className: "flex flex-col gap-2.5" },
          buildAuditField(
            "Fecha",
            createElement(
              "span",
              { className: "inline-flex items-center gap-2" },
              createElement(Calendar, { size: 14, className: "text-slate-400", "aria-hidden": true }),
              formatClinicDateTime(row.createdAt),
            ),
          ),
          buildAuditField("Usuario", row.actorLabel),
          buildAuditField(
            "Acción",
            // eslint-disable-next-line react/no-children-prop -- Badge's createElement overload requires children in props in this .ts view module
            createElement(Badge, {
              variant: auditActionBadgeVariant(row.actionLabel),
              children: row.actionLabel,
            }),
          ),
          buildAuditField("Entidad", row.entityType),
          buildAuditField(
            "ID",
            createElement(
              "span",
              { className: "break-all font-mono text-xs text-slate-500" },
              row.entityId,
            ),
          ),
        ),
      ),
    ),
  );
}

function buildList(viewModel: AuditListViewModel): ReactElement {
  if (viewModel.kind === "empty") {
    return createElement(
      Card,
      null,
      createElement(CardHeader, {
        title: createElement(
          "span",
          { className: "flex items-center gap-2" },
          createElement(ScrollText, { size: 18, className: "text-brand", "aria-hidden": true }),
          "Registros",
        ),
      }),
      createElement(
        CardBody,
        null,
        createElement("p", { role: "status", className: "text-sm text-slate-500" }, viewModel.message),
      ),
    );
  }

  return createElement(
    Card,
    null,
    createElement(CardHeader, {
      title: createElement(
        "span",
        { className: "flex items-center gap-2" },
        createElement(ScrollText, { size: 18, className: "text-brand", "aria-hidden": true }),
        `${viewModel.rows.length} ${viewModel.rows.length === 1 ? "registro" : "registros"}`,
      ),
    }),
    createElement(
      CardBody,
      null,
      buildAuditCards(viewModel.rows),
      createElement(
        "div",
        { className: "hidden overflow-x-auto rounded-xl border border-slate-200 md:block" },
        createElement(
          "table",
          { className: "w-full border-collapse text-sm", "aria-label": "Registros de auditoría" },
          createElement(
            "thead",
            null,
            createElement(
              "tr",
              { className: "bg-slate-50" },
              ["Fecha", "Usuario", "Acción", "Entidad", "ID"].map((header) =>
                createElement(
                  "th",
                  {
                    key: header,
                    className:
                      "border-b border-slate-200 px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400",
                  },
                  header,
                ),
              ),
            ),
          ),
          createElement(
            "tbody",
            null,
            viewModel.rows.map((row, index) =>
              createElement(
                "tr",
                {
                  key: row.id,
                  className: `transition-colors hover:bg-slate-50/70 ${
                    index !== viewModel.rows.length - 1 ? "border-b border-slate-100" : ""
                  }`,
                },
                createElement(
                  "td",
                  { className: "whitespace-nowrap px-5 py-4 text-slate-600" },
                  createElement(
                    "span",
                    { className: "inline-flex items-center gap-2" },
                    createElement(Calendar, { size: 14, className: "text-slate-400", "aria-hidden": true }),
                    formatClinicDateTime(row.createdAt),
                  ),
                ),
                createElement("td", { className: "px-5 py-4 font-medium text-slate-800" }, row.actorLabel),
                createElement(
                  "td",
                  { className: "px-5 py-4" },
                  // eslint-disable-next-line react/no-children-prop -- Badge's createElement overload requires children in props in this .ts view module
                  createElement(Badge, {
                    variant: auditActionBadgeVariant(row.actionLabel),
                    children: row.actionLabel,
                  }),
                ),
                createElement("td", { className: "px-5 py-4 text-slate-700" }, row.entityType),
                createElement(
                  "td",
                  { className: "max-w-[280px] truncate px-5 py-4 font-mono text-xs text-slate-500" },
                  row.entityId,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/**
 * Build a pagination href that preserves the active filters and only swaps the
 * target page — paginating must never reset entityType/userId/action/from/to.
 */
export function buildAuditPageHref(formValues: AuditFormValues, page: number): string {
  const params = new URLSearchParams();
  if (formValues.entityType) params.set("entityType", formValues.entityType);
  if (formValues.userId) params.set("userId", formValues.userId);
  if (formValues.action) params.set("action", formValues.action);
  if (formValues.from) params.set("from", formValues.from);
  if (formValues.to) params.set("to", formValues.to);
  params.set("page", String(page));
  return `?${params.toString()}`;
}

function buildPaginationNav(pagination: AuditPagination, formValues: AuditFormValues): ReactElement {
  const links: ReactElement[] = [];
  if (pagination.hasPrev) {
    links.push(
      createElement(
        "a",
        { key: "prev", href: buildAuditPageHref(formValues, pagination.prevPage), rel: "prev" },
        "Anterior",
      ),
    );
  }
  if (pagination.hasNext) {
    links.push(
      createElement(
        "a",
        { key: "next", href: buildAuditPageHref(formValues, pagination.nextPage), rel: "next" },
        "Siguiente",
      ),
    );
  }
  return createElement("nav", { "aria-label": "Paginación" }, links);
}

function buildPaginationCard(pagination: AuditPagination, formValues: AuditFormValues): ReactElement | null {
  if (!pagination.hasPrev && !pagination.hasNext) return null;

  return createElement(
    "div",
    { className: "flex justify-end" },
    buildPaginationNav(pagination, formValues),
  );
}

export type RenderAuditLogViewArgs = {
  user: AuditLogViewUser;
  rows: AuditLogRow[];
  formValues: AuditFormValues;
  pagination: AuditPagination;
  actions?: ReactNode;
};

export function renderAuditLogView({
  user,
  rows,
  formValues,
  pagination,
  actions,
}: RenderAuditLogViewArgs): ReactElement {
  const viewModel = buildAuditListViewModel(rows);

  // eslint-disable-next-line react/no-children-prop -- AppShellProps.children is required, so createElement needs it in props
  return createElement(AppShell, {
    actions,
    role: "ADMIN",
    currentPath: "/admin/audit-log",
    description: "Historial de acciones administrativas.",
    kicker: "MEDIASSWINT · Auditoría",
    title: "Auditoría",
    userLabel: user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido",
    children: createElement(
      "div",
      { "aria-label": "Visor de auditoría", className: "space-y-6" },
      buildFilterForm(formValues),
      buildList(viewModel),
      buildPaginationCard(pagination, formValues),
    ),
  });
}
