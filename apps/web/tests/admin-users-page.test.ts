import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { describe, it } from "node:test";

import { AppShell } from "../app/_components/app-shell/app-shell";
import type { SafeUser } from "../lib/users";
import {
  buildUsersListViewModel,
  renderUsersView,
  type UsersViewUser,
} from "../app/admin/users/users-view";
import { UsersPage } from "../app/admin/users/page";

type AdminUsersViewProps = {
  currentPath: string;
  title: string;
  kicker: string;
  description?: string;
  userLabel?: string;
  children: ReactElement;
};

function readViewProps(view: ReactElement): AdminUsersViewProps {
  return view.props as AdminUsersViewProps;
}

function childrenOf(element: ReactElement): ReactElement[] {
  return (element.props as { children: ReactElement[] }).children;
}

function userFixture(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: "user-1",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    role: "STAFF",
    isActive: true,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("buildUsersListViewModel", () => {
  it("returns the empty kind with a Spanish message when there are no users", () => {
    const viewModel = buildUsersListViewModel([]);

    assert.equal(viewModel.kind, "empty");
    if (viewModel.kind === "empty") {
      assert.equal(viewModel.message, "Todavía no hay usuarios cargados.");
    }
  });

  it("returns the list kind with one row per user, preserving order", () => {
    const viewModel = buildUsersListViewModel([
      userFixture({ id: "u-1", email: "a@x.com" }),
      userFixture({ id: "u-2", email: "b@x.com" }),
    ]);

    assert.equal(viewModel.kind, "list");
    if (viewModel.kind === "list") {
      assert.equal(viewModel.rows.length, 2);
      assert.equal(viewModel.rows[0]!.id, "u-1");
      assert.equal(viewModel.rows[0]!.email, "a@x.com");
      assert.equal(viewModel.rows[1]!.id, "u-2");
    }
  });

  it("maps isActive to a Spanish status label", () => {
    const viewModel = buildUsersListViewModel([
      userFixture({ id: "u-active", isActive: true }),
      userFixture({ id: "u-inactive", isActive: false }),
    ]);

    assert.equal(viewModel.kind, "list");
    if (viewModel.kind === "list") {
      assert.equal(viewModel.rows[0]!.statusLabel, "Activo");
      assert.equal(viewModel.rows[1]!.statusLabel, "Inactivo");
    }
  });
});

describe("renderUsersView composition", () => {
  function viewArgs(overrides: Record<string, unknown> = {}) {
    return {
      user: { fullName: "Ada Lovelace" } as UsersViewUser,
      users: [userFixture()],
      query: "",
      ...overrides,
    };
  }

  it("wraps the users content inside AppShell with admin-users context", () => {
    const view = renderUsersView(viewArgs());

    assert.equal(view.type, AppShell);
    const props = readViewProps(view);
    assert.equal(props.currentPath, "/admin/users");
    assert.equal(props.kicker, "MEDIASSWINT · Usuarios");
    assert.equal(props.title, "Usuarios");
    assert.equal(props.userLabel, "Bienvenido, Ada Lovelace");
  });

  it("falls back to a neutral userLabel when fullName is missing", () => {
    const view = renderUsersView(viewArgs({ user: { fullName: null } }));
    const props = readViewProps(view);
    assert.equal(props.userLabel, "Bienvenido");
  });

  it("renders each user as a static row without a detail link", () => {
    const view = renderUsersView(viewArgs({ users: [userFixture({ id: "u-1" })] }));
    const props = readViewProps(view);
    const [, list] = childrenOf(props.children);

    assert.equal(list!.type, "ul");
    const items = childrenOf(list!);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.type, "li");

    const rowChild = (items[0]!.props as { children: unknown }).children;
    assert.equal(typeof rowChild, "string", "user row must be plain text, not a link element");
  });

  it("renders a GET search form seeded with the current query", () => {
    const view = renderUsersView(viewArgs({ query: "ada" }));
    const props = readViewProps(view);
    const [form] = childrenOf(props.children);

    assert.equal(form!.type, "form");
    assert.equal((form!.props as { method?: string }).method, "get");

    const input = childrenOf(form!)[0]!;
    assert.equal((input.props as { name?: string }).name, "q");
    assert.equal((input.props as { defaultValue?: string }).defaultValue, "ada");
  });
});

describe("UsersPage route", () => {
  function adminUser() {
    return { id: "admin-1", role: "ADMIN" as const, fullName: "Ada Lovelace" };
  }

  function defaultDeps(overrides: Record<string, unknown> = {}) {
    return {
      readUser: async () => adminUser(),
      listUsersFn: async () => ({ ok: true as const, value: [userFixture()] }),
      ...overrides,
    };
  }

  it("renders AppShell with the listed users for ADMIN users", async () => {
    const view = await UsersPage({ searchParams: Promise.resolve({}) }, defaultDeps());

    assert.equal(view.type, AppShell);
    const props = readViewProps(view);
    assert.equal(props.currentPath, "/admin/users");
  });

  it("forwards the q search param into listUsers and into the form", async () => {
    const calls: { q: string | null; limit: number }[] = [];
    const view = await UsersPage(
      { searchParams: Promise.resolve({ q: "grace" }) },
      defaultDeps({
        listUsersFn: async (query: { q: string | null; limit: number }) => {
          calls.push(query);
          return { ok: true as const, value: [userFixture()] };
        },
      }),
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.q, "grace");

    const props = readViewProps(view);
    const [form] = childrenOf(props.children);
    const input = childrenOf(form!)[0]!;
    assert.equal((input.props as { defaultValue?: string }).defaultValue, "grace");
  });

  it("throws when the users service fails so the error boundary handles it", async () => {
    await assert.rejects(
      UsersPage(
        { searchParams: Promise.resolve({}) },
        defaultDeps({ listUsersFn: async () => ({ ok: false as const, error: "UNKNOWN" }) }),
      ),
    );
  });
});
