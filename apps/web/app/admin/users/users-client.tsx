"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, Search, Users as UsersIcon } from "lucide-react";

import { Avatar } from "../../_components/dashboard/avatar";
import { Badge } from "../../_components/ui/badge";
import { Card, CardBody, CardHeader } from "../../_components/ui/card";
import { DataTable, type DataTableColumn } from "../../_components/dashboard/data-table";

import { setUserActiveAction, updateUserRoleAction } from "./actions";
import { INITIAL_USER_ACTION_STATE, type UserActionState } from "./user-actions-core";
import {
  roleBadgeVariant,
  statusBadgeVariant,
  type UsersListViewModel,
  type UsersRow,
} from "./users-view";

type UsersClientProps = {
  viewModel: UsersListViewModel;
  total: number;
  query: string;
  currentUserId: string;
};

function FeedbackBanner({ state }: { state: UserActionState }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {isError ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
      <span>{state.message}</span>
    </div>
  );
}

export function UsersClient({ viewModel, total, query, currentUserId }: UsersClientProps) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateUserRoleAction,
    INITIAL_USER_ACTION_STATE,
  );
  const [activeState, activeAction, activePending] = useActionState(
    setUserActiveAction,
    INITIAL_USER_ACTION_STATE,
  );

  const rows = viewModel.kind === "list" ? viewModel.rows : [];

  const columns: DataTableColumn<UsersRow>[] = [
    {
      key: "user",
      header: "Usuario",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName ?? row.email} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-slate-800">
              <span className="truncate">{row.fullName ?? "Sin nombre"}</span>
              {row.id === currentUserId ? <Badge variant="info">Vos</Badge> : null}
            </p>
            <p className="truncate text-xs text-slate-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rol",
      render: (row) => (
        <Badge variant={roleBadgeVariant(row.role)}>
          {row.role === "ADMIN" ? "Administrador" : "Staff"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (row) => (
        <Badge variant={statusBadgeVariant(row.isActive)}>{row.statusLabel}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <form action={roleAction} className="flex items-center">
            <input type="hidden" name="userId" value={row.id} />
            <label className="sr-only" htmlFor={`role-${row.id}`}>
              Cambiar rol de {row.fullName ?? row.email}
            </label>
            <select
              id={`role-${row.id}`}
              name="role"
              defaultValue={row.role}
              disabled={rolePending}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-brand/40 focus:ring-2 focus:ring-brand/10 disabled:opacity-50"
            >
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </form>

          <form action={activeAction}>
            <input type="hidden" name="userId" value={row.id} />
            <input type="hidden" name="isActive" value={String(!row.isActive)} />
            <button
              type="submit"
              disabled={activePending}
              className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
                row.isActive
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              {row.isActive ? "Desactivar" : "Activar"}
            </button>
          </form>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <UsersIcon size={18} className="text-brand" aria-hidden="true" />
              {total} {total === 1 ? "usuario registrado" : "usuarios registrados"}
            </span>
          }
          action={
            <form method="get" role="search" className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <label htmlFor="users-search" className="sr-only">
                Buscar por email o nombre
              </label>
              <input
                id="users-search"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Buscar usuario…"
                className="h-9 w-48 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
            </form>
          }
        />
        <CardBody>
          <FeedbackBanner state={roleState} />
          <FeedbackBanner state={activeState} />
          <DataTable
            columns={columns}
            rows={rows}
            getKey={(row) => row.id}
            emptyMessage={
              viewModel.kind === "empty" ? viewModel.message : "Sin usuarios para mostrar."
            }
          />
        </CardBody>
      </Card>

      <Card className="bg-slate-50/60">
        <CardBody className="space-y-2">
          <h3 className="text-sm font-bold tracking-tight text-slate-900">Sobre los roles</h3>
          <p className="text-sm text-slate-600">
            <strong className="font-semibold text-slate-800">Administrador:</strong> acceso total al
            panel, gestión de usuarios y auditoría.
          </p>
          <p className="text-sm text-slate-600">
            <strong className="font-semibold text-slate-800">Staff:</strong> acceso operativo a
            pacientes y operaciones, sin gestión de usuarios.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export default UsersClient;
