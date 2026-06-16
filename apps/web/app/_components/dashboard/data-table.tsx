import type { ReactNode } from "react";

import { EmptyState } from "../ui/empty-state";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getKey: (row: T) => string;
  emptyMessage?: string;
};

export function DataTable<T>({
  columns,
  emptyMessage = "Sin datos.",
  getKey,
  rows,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <>
      {/* Mobile/small-tablet: stacked label/value cards so columns never clip
          or force horizontal scroll. Real table returns at md+. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={getKey(row)} className="rounded-xl border border-slate-200 p-4">
            <dl className="flex flex-col gap-2.5">
              {columns.map((col) => (
                <div key={col.key} className="min-w-0">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {col.header}
                  </dt>
                  <dd className="mt-0.5 min-w-0 break-words text-sm text-slate-700">
                    {col.render(row)}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
        <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`border-b border-slate-200 px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 ${col.align === "right" ? "text-right" : "text-left"} ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={getKey(row)}
              className={`transition-colors hover:bg-slate-50/70 ${idx !== rows.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-5 py-4 text-slate-600 ${col.align === "right" ? "text-right" : ""} ${col.className ?? ""}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
