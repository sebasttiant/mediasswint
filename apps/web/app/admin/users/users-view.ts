import { createElement, type ReactElement, type ReactNode } from "react";

import type { SafeUser } from "@/lib/users";

import { AppShell } from "../../_components/app-shell/app-shell";

export type UsersViewUser = { fullName: string | null };

export type UsersRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: SafeUser["role"];
  statusLabel: string;
};

export type UsersListViewModel =
  | { kind: "empty"; message: string }
  | { kind: "list"; rows: UsersRow[] };

export type RenderUsersViewArgs = {
  user: UsersViewUser;
  users: SafeUser[];
  query: string;
  actions?: ReactNode;
};

export function buildUsersListViewModel(users: SafeUser[]): UsersListViewModel {
  if (users.length === 0) {
    return { kind: "empty", message: "Todavía no hay usuarios cargados." };
  }

  return {
    kind: "list",
    rows: users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      statusLabel: user.isActive ? "Activo" : "Inactivo",
    })),
  };
}

function buildSearchForm(query: string): ReactElement {
  return createElement(
    "form",
    { method: "get", role: "search", "aria-label": "Buscar usuarios" },
    createElement("input", {
      type: "search",
      name: "q",
      defaultValue: query,
      placeholder: "Buscar por email o nombre",
      "aria-label": "Buscar por email o nombre",
    }),
    createElement("button", { type: "submit" }, "Buscar"),
  );
}

function buildUsersList(viewModel: UsersListViewModel): ReactElement {
  if (viewModel.kind === "empty") {
    return createElement("p", { role: "status" }, viewModel.message);
  }

  return createElement(
    "ul",
    { "aria-label": "Usuarios" },
    viewModel.rows.map((row) =>
      createElement(
        "li",
        { key: row.id },
        `${row.fullName ?? row.email} — ${row.email} · ${row.role} · ${row.statusLabel}`,
      ),
    ),
  );
}

export function renderUsersView({
  user,
  users,
  query,
  actions,
}: RenderUsersViewArgs): ReactElement {
  const viewModel = buildUsersListViewModel(users);

  // eslint-disable-next-line react/no-children-prop -- AppShellProps.children is required, so createElement needs it in props
  return createElement(AppShell, {
    actions,
    role: "ADMIN",
    currentPath: "/admin/users",
    description: "Alta, roles y estado de las cuentas.",
    kicker: "MEDIASSWINT · Usuarios",
    title: "Usuarios",
    userLabel: user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido",
    children: createElement(
      "div",
      { "aria-label": "Gestión de usuarios" },
      buildSearchForm(query),
      buildUsersList(viewModel),
    ),
  });
}
