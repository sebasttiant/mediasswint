import { createElement, type ReactElement, type ReactNode } from "react";
import type { AuditAction } from "@prisma/client";

import type { AuditLogRow, ListAuditFilters } from "@/lib/audit-log";

import { AppShell } from "../../_components/app-shell/app-shell";

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

function buildFilterForm(formValues: AuditFormValues): ReactElement {
  const actionOptions = [
    { value: "", label: "Todas las acciones" },
    { value: "CREATE", label: "Creación" },
    { value: "UPDATE", label: "Actualización" },
    { value: "DELETE", label: "Eliminación" },
  ];

  return createElement(
    "form",
    { method: "get", role: "search", "aria-label": "Filtrar auditoría" },
    createElement("input", {
      type: "text",
      name: "entityType",
      defaultValue: formValues.entityType,
      placeholder: "Tipo de entidad",
      "aria-label": "Tipo de entidad",
    }),
    createElement("input", {
      type: "text",
      name: "userId",
      defaultValue: formValues.userId,
      placeholder: "ID de usuario",
      "aria-label": "ID de usuario",
    }),
    createElement(
      "select",
      { name: "action", defaultValue: formValues.action, "aria-label": "Acción" },
      actionOptions.map((option) =>
        createElement("option", { key: option.value, value: option.value }, option.label),
      ),
    ),
    createElement("input", {
      type: "date",
      name: "from",
      defaultValue: formValues.from,
      "aria-label": "Desde",
    }),
    createElement("input", {
      type: "date",
      name: "to",
      defaultValue: formValues.to,
      "aria-label": "Hasta",
    }),
    createElement("button", { type: "submit" }, "Filtrar"),
  );
}

function buildList(viewModel: AuditListViewModel): ReactElement {
  if (viewModel.kind === "empty") {
    return createElement("p", { role: "status" }, viewModel.message);
  }

  return createElement(
    "ul",
    { "aria-label": "Registros de auditoría" },
    viewModel.rows.map((row) =>
      createElement(
        "li",
        { key: row.id },
        `${row.createdAt} · ${row.actorLabel} · ${row.actionLabel} · ${row.entityType} (${row.entityId})`,
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
    currentPath: "/admin/audit-log",
    description: "Historial de acciones administrativas.",
    kicker: "MEDIASSWINT · Auditoría",
    title: "Auditoría",
    userLabel: user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido",
    children: createElement(
      "div",
      { "aria-label": "Visor de auditoría" },
      buildFilterForm(formValues),
      buildList(viewModel),
      buildPaginationNav(pagination, formValues),
    ),
  });
}
