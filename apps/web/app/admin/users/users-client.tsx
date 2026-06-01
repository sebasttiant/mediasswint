"use client";

import { useState } from "react";
import { Pencil, Search, UserPlus, Users as UsersIcon } from "lucide-react";

import { Avatar } from "../../_components/dashboard/avatar";
import { Badge } from "../../_components/ui/badge";
import { Button } from "../../_components/ui/button";
import { Card, CardBody, CardHeader } from "../../_components/ui/card";
import { DataTable, type DataTableColumn } from "../../_components/dashboard/data-table";

import { CreateUserModal } from "./new/create-user-modal";
import { EditUserModal } from "./edit-user-modal";
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

export function UsersClient({ viewModel, total, query, currentUserId }: UsersClientProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsersRow | null>(null);

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
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setEditingUser(row)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          >
            <Pencil size={13} aria-hidden="true" />
            Editar
          </button>
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
            <div className="flex items-center gap-2">
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
              <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                <UserPlus size={15} aria-hidden="true" />
                Nuevo usuario
              </Button>
            </div>
          }
        />
        <CardBody>
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

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditUserModal
        key={editingUser?.id ?? "none"}
        user={editingUser}
        isCurrentUser={editingUser?.id === currentUserId}
        onClose={() => setEditingUser(null)}
      />
    </div>
  );
}

export default UsersClient;
