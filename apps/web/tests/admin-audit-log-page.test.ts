import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { describe, it } from "node:test";

import { AppShell } from "../app/_components/app-shell/app-shell";
import type { AuditLogRow, ListAuditFilters } from "../lib/audit-log";
import {
  auditActionBadgeVariant,
  buildAuditListViewModel,
  buildAuditPageHref,
  buildAuditPagination,
  renderAuditLogView,
  resolveAuditQuery,
  type AuditLogViewUser,
} from "../app/admin/audit-log/audit-log-view";
import { AuditLogPage } from "../app/admin/audit-log/page";

type AuditViewProps = {
  currentPath: string;
  title: string;
  kicker: string;
  description?: string;
  userLabel?: string;
  children: ReactElement;
};

function readViewProps(view: ReactElement): AuditViewProps {
  return view.props as AuditViewProps;
}

function isReactElement(value: unknown): value is ReactElement {
  return typeof value === "object" && value !== null && "props" in value && "type" in value;
}

function childrenOf(element: ReactElement): ReactElement[] {
  const children = (element.props as { children?: ReactElement | ReactElement[] | null }).children;
  if (Array.isArray(children)) return children.filter(isReactElement);
  return isReactElement(children) ? [children] : [];
}

function findChildByType(element: ReactElement, type: unknown): ReactElement | null {
  if (element.type === type) return element;
  for (const child of childrenOf(element)) {
    const found = findChildByType(child, type);
    if (found) return found;
  }
  return null;
}

function auditRowFixture(overrides: Partial<AuditLogRow> = {}): AuditLogRow {
  return {
    id: "a-1",
    userId: "u-1",
    user: { id: "u-1", email: "ada@example.com", fullName: "Ada Lovelace" },
    action: "CREATE",
    entityType: "User",
    entityId: "e-1",
    diff: {},
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("resolveAuditQuery", () => {
  it("computes skip from page and limit", () => {
    const resolved = resolveAuditQuery({ page: "3" }, 20);
    assert.equal(resolved.page, 3);
    assert.equal(resolved.filters.skip, 40);
    assert.equal(resolved.filters.limit, 20);
  });

  it("defaults to page 1 for missing or invalid page values", () => {
    assert.equal(resolveAuditQuery({}, 20).page, 1);
    assert.equal(resolveAuditQuery({}, 20).filters.skip, 0);
    assert.equal(resolveAuditQuery({ page: "abc" }, 20).page, 1);
  });

  it("keeps a valid action and drops an invalid one", () => {
    assert.equal(resolveAuditQuery({ action: "UPDATE" }, 20).filters.action, "UPDATE");
    assert.equal(resolveAuditQuery({ action: "DESTROY" }, 20).filters.action, undefined);
    assert.equal(resolveAuditQuery({ action: "DESTROY" }, 20).formValues.action, "DESTROY");
  });

  it("parses valid from/to into Date and drops invalid ones", () => {
    const resolved = resolveAuditQuery({ from: "2026-01-01", to: "nope" }, 20);
    assert.ok(resolved.filters.from instanceof Date);
    assert.equal(resolved.filters.to, undefined);
    assert.equal(resolved.formValues.to, "nope");
  });

  it("passes entityType and userId through when present", () => {
    const resolved = resolveAuditQuery({ entityType: "User", userId: "u-9" }, 20);
    assert.equal(resolved.filters.entityType, "User");
    assert.equal(resolved.filters.userId, "u-9");
  });
});

describe("buildAuditPagination", () => {
  it("signals a next page when more rows remain (using skip + rowCount < total)", () => {
    const pagination = buildAuditPagination({ page: 1, limit: 20, total: 50, rowCount: 20 });
    assert.equal(pagination.hasNext, true);
    assert.equal(pagination.hasPrev, false);
    assert.equal(pagination.nextPage, 2);
  });

  it("stops paginating on the last page", () => {
    const pagination = buildAuditPagination({ page: 3, limit: 20, total: 50, rowCount: 10 });
    assert.equal(pagination.hasNext, false);
    assert.equal(pagination.hasPrev, true);
    assert.equal(pagination.prevPage, 2);
  });
});

describe("buildAuditPageHref", () => {
  it("preserves every active filter and sets the target page", () => {
    const href = buildAuditPageHref(
      {
        entityType: "User",
        userId: "u-9",
        action: "UPDATE",
        from: "2026-01-01",
        to: "2026-02-01",
      },
      3,
    );
    const sp = new URLSearchParams(href.replace(/^\?/, ""));

    assert.equal(sp.get("entityType"), "User");
    assert.equal(sp.get("userId"), "u-9");
    assert.equal(sp.get("action"), "UPDATE");
    assert.equal(sp.get("from"), "2026-01-01");
    assert.equal(sp.get("to"), "2026-02-01");
    assert.equal(sp.get("page"), "3");
  });

  it("omits empty filters and only carries the page", () => {
    const href = buildAuditPageHref(
      { entityType: "", userId: "", action: "", from: "", to: "" },
      2,
    );
    const sp = new URLSearchParams(href.replace(/^\?/, ""));

    assert.equal(sp.get("entityType"), null);
    assert.equal(sp.get("action"), null);
    assert.equal(sp.get("page"), "2");
  });
});

describe("buildAuditListViewModel", () => {
  it("returns the empty kind with a Spanish message when there are no rows", () => {
    const viewModel = buildAuditListViewModel([]);
    assert.equal(viewModel.kind, "empty");
    if (viewModel.kind === "empty") {
      assert.equal(viewModel.message, "No hay registros de auditoría.");
    }
  });

  it("derives the actor label from fullName, then email, then 'Sistema'", () => {
    const viewModel = buildAuditListViewModel([
      auditRowFixture({ id: "r-1" }),
      auditRowFixture({ id: "r-2", user: { id: "u-2", email: "x@y.com", fullName: null } }),
      auditRowFixture({ id: "r-3", user: null, userId: null }),
    ]);

    assert.equal(viewModel.kind, "list");
    if (viewModel.kind === "list") {
      assert.equal(viewModel.rows[0]!.actorLabel, "Ada Lovelace");
      assert.equal(viewModel.rows[1]!.actorLabel, "x@y.com");
      assert.equal(viewModel.rows[2]!.actorLabel, "Sistema");
    }
  });

  it("maps the audit action to a Spanish label", () => {
    const viewModel = buildAuditListViewModel([auditRowFixture({ action: "CREATE" })]);
    assert.equal(viewModel.kind, "list");
    if (viewModel.kind === "list") {
      assert.equal(viewModel.rows[0]!.actionLabel, "Creación");
    }
  });
});

describe("audit action badges", () => {
  it("maps audit actions to semantic badge variants", () => {
    assert.equal(auditActionBadgeVariant("Creación"), "success");
    assert.equal(auditActionBadgeVariant("Actualización"), "info");
    assert.equal(auditActionBadgeVariant("Eliminación"), "danger");
  });
});

describe("renderAuditLogView composition", () => {
  function viewArgs(overrides: Record<string, unknown> = {}) {
    return {
      user: { fullName: "Ada Lovelace" } as AuditLogViewUser,
      rows: [auditRowFixture()],
      formValues: { entityType: "", userId: "", action: "", from: "", to: "" },
      pagination: { page: 1, hasPrev: false, hasNext: false, prevPage: 0, nextPage: 2 },
      ...overrides,
    };
  }

  it("wraps the audit content inside AppShell with audit context", () => {
    const view = renderAuditLogView(viewArgs());

    assert.equal(view.type, AppShell);
    const props = readViewProps(view);
    assert.equal(props.currentPath, "/admin/audit-log");
    assert.equal(props.kicker, "MEDIASSWINT · Auditoría");
    assert.equal(props.title, "Auditoría");
    assert.equal(props.userLabel, "Bienvenido, Ada Lovelace");
  });

  it("renders a GET filter form seeded with the current action filter", () => {
    const view = renderAuditLogView(
      viewArgs({ formValues: { entityType: "", userId: "", action: "UPDATE", from: "", to: "" } }),
    );
    const props = readViewProps(view);
    const form = findChildByType(props.children, "form");

    assert.ok(form, "expected a filter form inside the audit card");
    assert.equal((form!.props as { method?: string }).method, "get");
  });

  it("keeps active filters in the pagination links", () => {
    const view = renderAuditLogView(
      viewArgs({
        formValues: { entityType: "User", userId: "u-9", action: "UPDATE", from: "", to: "" },
        pagination: { page: 2, hasPrev: true, hasNext: true, prevPage: 1, nextPage: 3 },
      }),
    );
    const props = readViewProps(view);
    const nav = findChildByType(props.children, "nav");
    assert.ok(nav, "expected pagination nav when previous and next pages exist");
    const links = childrenOf(nav!);

    for (const link of links) {
      const href = (link.props as { href: string }).href;
      const sp = new URLSearchParams(href.replace(/^\?/, ""));
      assert.equal(sp.get("entityType"), "User");
      assert.equal(sp.get("userId"), "u-9");
      assert.equal(sp.get("action"), "UPDATE");
    }

    const hrefs = links.map((link) => (link.props as { href: string }).href);
    assert.ok(hrefs.some((href) => href.includes("page=1")), "prev link must target page 1");
    assert.ok(hrefs.some((href) => href.includes("page=3")), "next link must target page 3");
  });
});

describe("AuditLogPage route", () => {
  function adminUser() {
    return { id: "admin-1", role: "ADMIN" as const, fullName: "Ada Lovelace" };
  }

  function defaultDeps(overrides: Record<string, unknown> = {}) {
    return {
      readUser: async () => adminUser(),
      listAuditLogFn: async () => ({ rows: [auditRowFixture()], total: 1 }),
      ...overrides,
    };
  }

  it("renders AppShell for ADMIN users", async () => {
    const view = await AuditLogPage({ searchParams: Promise.resolve({}) }, defaultDeps());

    assert.equal(view.type, AppShell);
    assert.equal(readViewProps(view).currentPath, "/admin/audit-log");
  });

  it("forwards the parsed filters (including skip) to listAuditLog", async () => {
    const calls: ListAuditFilters[] = [];
    await AuditLogPage(
      { searchParams: Promise.resolve({ page: "2", action: "UPDATE" }) },
      defaultDeps({
        listAuditLogFn: async (filters: ListAuditFilters) => {
          calls.push(filters);
          return { rows: [auditRowFixture()], total: 40 };
        },
      }),
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.skip, 20);
    assert.equal(calls[0]!.action, "UPDATE");
  });
});
