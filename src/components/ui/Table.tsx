import React from 'react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No hay registros disponibles.',
  isLoading = false,
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border-subtle bg-surface">
      <table className="w-full text-left text-sm border-collapse">
        <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-text-muted border-b border-border-subtle tracking-wider">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={`px-4 py-3.5 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-text-muted">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
                  <span>Cargando datos...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className="hover:bg-border/40 transition-colors group"
              >
                {columns.map((col, idx) => (
                  <td key={idx} className={`px-4 py-3.5 text-text-primary ${col.className || ''}`}>
                    {col.cell
                      ? col.cell(item)
                      : col.accessorKey
                      ? (item[col.accessorKey] as React.ReactNode)
                      : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
