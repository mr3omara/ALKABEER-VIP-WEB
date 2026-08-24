import React from 'react';
import { cn } from '../../lib/utils';
import { Inbox, ChevronRight, ChevronLeft } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'right' | 'center' | 'left';
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (item: T) => void;
  className?: string;
  stickyHeader?: boolean;
}

export function Table<T = any>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'لا توجد بيانات متاحة حالياً',
  emptyIcon,
  onRowClick,
  className,
  stickyHeader = true,
}: TableProps<T>) {
  return (
    <div
      className={cn(
        'w-full bg-ivory-50 dark:bg-navy-850 border border-ivory-300 dark:border-navy-750 rounded-2xl shadow-warm-xs overflow-hidden transition-colors font-sans',
        className,
      )}
    >
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-right border-collapse text-[15px]">
          <thead>
            <tr
              className={cn(
                'bg-ivory-200/80 dark:bg-navy-950/90 border-b border-ivory-300 dark:border-navy-750 text-navy-900 dark:text-slate-200 font-display font-bold text-xs uppercase tracking-wider',
                stickyHeader && 'sticky top-0 z-10 backdrop-blur-xs',
              )}
            >
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  scope="col"
                  className={cn(
                    'px-4 py-3.5 whitespace-nowrap text-navy-900 dark:text-slate-100 font-bold',
                    col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right',
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ivory-300/70 dark:divide-navy-750">
            {isLoading ? (
              // Professional skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  {columns.map((_, colIdx) => (
                    <td key={colIdx} className="px-4 py-4">
                      <div className="h-4 bg-ivory-200 dark:bg-navy-800 rounded-md w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-16 text-center text-slate-700 dark:text-slate-300"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-ivory-200 dark:bg-navy-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                      {emptyIcon || <Inbox className="w-6 h-6" />}
                    </div>
                    <span className="text-base font-bold text-navy-900 dark:text-slate-100">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={(row as any).id || (row as any).key || rowIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={cn(
                    'transition-colors hover:bg-ivory-200/60 dark:hover:bg-navy-800/60 group',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={cn(
                        'px-4 py-3.5 text-navy-900 dark:text-slate-100 whitespace-nowrap text-[15px] font-medium leading-relaxed',
                        col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right',
                        col.className,
                      )}
                    >
                      {col.cell
                        ? col.cell(row, rowIdx)
                        : col.accessorKey
                        ? (row as any)[col.accessorKey]
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  limit?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  onPageChange,
  limit = 20,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-3 py-3.5 text-xs text-slate-800 dark:text-slate-300 bg-ivory-50 dark:bg-navy-850 border border-ivory-300 dark:border-navy-750 rounded-xl shadow-warm-xs mt-3 transition-colors font-sans" dir="rtl">
      <div>
        عرض <span className="font-extrabold text-navy-900 dark:text-slate-100">{(page - 1) * limit + 1}</span> إلى{' '}
        <span className="font-extrabold text-navy-900 dark:text-slate-100">
          {Math.min(page * limit, totalItems)}
        </span>{' '}
        من إجمالي <span className="font-extrabold text-navy-900 dark:text-slate-100">{totalItems}</span> سجل
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-navy-800 border border-ivory-300 dark:border-navy-700 rounded-lg font-bold text-navy-900 dark:text-slate-200 hover:bg-ivory-200 dark:hover:bg-navy-750 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          السابق
        </button>
        <span className="px-2 font-extrabold text-navy-900 dark:text-slate-100">
          صفحة {page} من {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-navy-800 border border-ivory-300 dark:border-navy-700 rounded-lg font-bold text-navy-900 dark:text-slate-200 hover:bg-ivory-200 dark:hover:bg-navy-750 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
        >
          التالي
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
