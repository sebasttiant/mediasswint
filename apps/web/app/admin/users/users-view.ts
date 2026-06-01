import { createElement, type ReactElement } from "react";
import { UserPlus } from "lucide-react";

import type { SafeUser } from "@/lib/users";

import { AppShell } from "../../_components/app-shell/app-shell";
import type { BadgeVariant } from "../../_components/ui/badge";
import { Button } from "../../_components/ui/button";

import { UsersClient } from "./users-client";

export type UsersViewUser = { fullName: string | null };

export type UsersRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: SafeUser["role"];
  isActive: boolean;
  statusLabel: string;
};

export type UsersListViewModel =
  | { kind: "empty"; message: string }
  | { kind: "list"; rows: UsersRow[] };

export type RenderUsersViewArgs = {
  user: UsersViewUser;
  users: SafeUser[];
  query: string;
  currentUserId: string;
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
      isActive: user.isActive,
      statusLabel: user.isActive ? "Activo" : "Inactivo",
    })),
  };
}

export function roleBadgeVariant(role: SafeUser["role"]): BadgeVariant {
  return role === "ADMIN" ? "brand" : "neutral";
}

export function statusBadgeVariant(isActive: boolean): BadgeVariant {
  return isActive ? "success" : "danger";
}

export function renderUsersView({
  user,
  users,
  query,
  currentUserId,
}: RenderUsersViewArgs): ReactElement {
  // eslint-disable-next-line react/no-children-prop -- AppShellProps.children is required, so createElement needs it in props
  return createElement(AppShell, {
    role: "ADMIN",
    currentPath: "/admin/users",
    description: "Control de acceso y roles.",
    kicker: "MEDIASSWINT · Usuarios",
    title: "Usuarios",
    userLabel: user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido",
    // eslint-disable-next-line react/no-children-prop -- createElement needs children in props for the Button overload
    actions: createElement(Button, {
      href: "/admin/users/new",
      variant: "primary",
      children: createElement(
        "span",
        { className: "inline-flex items-center gap-2" },
        createElement(UserPlus, { size: 16, "aria-hidden": true }),
        "Nuevo usuario",
      ),
    }),
    children: createElement(UsersClient, {
      viewModel: buildUsersListViewModel(users),
      total: users.length,
      query,
      currentUserId,
    }),
  });
}
