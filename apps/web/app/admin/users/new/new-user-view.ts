import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";

import { AppShell } from "../../../_components/app-shell/app-shell";

export type NewUserViewUser = { fullName: string | null };

export type RenderNewUserViewArgs = {
  user: NewUserViewUser;
  CreateUserFormComponent: ComponentType;
  actions?: ReactNode;
};

export function renderNewUserView({
  user,
  CreateUserFormComponent,
  actions,
}: RenderNewUserViewArgs): ReactElement {
  // eslint-disable-next-line react/no-children-prop -- AppShellProps.children is required, so createElement needs it in props
  return createElement(AppShell, {
    actions,
    currentPath: "/admin/users/new",
    description: "Crear una cuenta y asignar su rol.",
    kicker: "MEDIASSWINT · Usuarios",
    title: "Nuevo usuario",
    userLabel: user.fullName ? `Bienvenido, ${user.fullName}` : "Bienvenido",
    children: createElement(CreateUserFormComponent),
  });
}
