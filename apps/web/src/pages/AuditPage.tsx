import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { Table, Column, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ContextualSearchBar } from '../components/ui/ContextualSearchBar';
import { ShieldAlert, Eye, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AuditAction } from '@alkabeer/shared';
import { useToast } from '../components/ui/Toast';
import { Icon3D } from '../components/icons3d';

interface AuditLog {
  id: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldData?: string;
  newData?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: { username: string; fullName: string; roles?: string[] };
}

export const AuditPage: React.FC = () => {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch Audit Logs
  const { data, isLoading } = useQuery<{ items: AuditLog[]; meta: any }>({
    queryKey: ['audit-logs', page, entityTypeFilter, actionFilter, search],
    queryFn: () =>
      apiClient(
        `/audit?page=${page}&limit=20&entityType=${entityTypeFilter}&action=${actionFilter}&search=${encodeURIComponent(search)}`,
      ).catch(() => ({ items: [], meta: { totalPages: 1, totalItems: 0 } })),
  });

  const getActionArabicLabel = (action: AuditAction) => {
    switch (action) {
      case 'CREATE':
        return 'إنشاء جديد';
      case 'UPDATE':
        return 'تعديل بيانات';
      case 'DELETE':
        return 'حذف / أرشِفة';
      case 'LOGIN':
        return 'تسجيل دخول';
      case 'REVERSAL':
        return 'عكس معاملة مالية';
      case 'DAILY_CLOSE':
        return 'إغلاق وردية';
      case 'DAILY_REOPEN':
        return 'إعادة فتح وردية';
      default:
        return action;
    }
  };

  const getActionBadgeVariant = (action: AuditAction) => {
    switch (action) {
      case 'CREATE':
      case 'LOGIN':
        return 'success';
      case 'UPDATE':
      case 'DAILY_CLOSE':
        return 'info';
      case 'DELETE':
      case 'REVERSAL':
        return 'danger';
      case 'DAILY_REOPEN':
      case 'STATUS_CHANGE':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const handleExportCSV = () => {
    if (!data?.items || data.items.length === 0) {
      toast.error('لا توجد سجلات متاحة للتصدير');
      return;
    }

    try {
      const headers = ['التاريخ والتوقيت', 'المستخدم', 'نوع الإجراء', 'الكيان المتأثر', 'كود الكيان', 'عنوان IP'];
      const rows = data.items.map((log) => [
        new Date(log.createdAt).toLocaleString('ar-EG'),
        log.user?.fullName || log.user?.username || 'النظام (System)',
        getActionArabicLabel(log.action),
        log.entityType,
        log.entityId || '-',
        log.ipAddress || '-',
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `alkabeer_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('تم تصدير سجلات التدقيق بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء تصدير السجلات');
    }
  };

  const columns: Column<AuditLog>[] = [
    {
      header: 'التوقيت الدقيق',
      cell: (l) => (
        <span className="text-xs font-mono text-slate-600 dark:text-slate-300 font-bold">
          {new Date(l.createdAt).toLocaleString('ar-EG', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
    },
    {
      header: 'المستخدم المسؤول',
      cell: (l) => (
        <div>
          <span className="font-extrabold text-navy-900 dark:text-slate-100 block">
            {l.user?.fullName || l.user?.username || 'نظام ذاتي (System)'}
          </span>
          {l.user?.roles && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {l.user.roles.join(' • ')}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'نوع الإجراء / الحركة',
      cell: (l) => (
        <Badge variant={getActionBadgeVariant(l.action)}>
          {getActionArabicLabel(l.action)}
        </Badge>
      ),
    },
    {
      header: 'الكيان المتأثر (Target Entity)',
      cell: (l) => (
        <div>
          <span className="font-bold text-navy-900 dark:text-slate-100">{l.entityType}</span>
          {l.entityId && (
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block truncate max-w-[130px]">
              ID: {l.entityId}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'عنوان IP والجلسة',
      cell: (l) => (
        <span className="text-xs font-mono text-slate-600 dark:text-slate-400 font-medium">
          {l.ipAddress || '127.0.0.1'}
        </span>
      ),
    },
    {
      header: 'نتيجة العملية',
      cell: (l) => {
        const isWarning = l.action === AuditAction.REVERSAL || l.action === AuditAction.DAILY_REOPEN || l.action === AuditAction.DELETE;
        return (
          <div className="flex items-center gap-1.5">
            {isWarning ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>حساسة</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>نجاح</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'تفاصيل السجل',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (l) => (
        <div className="flex items-center justify-center">
          <button
            onClick={() => setSelectedLog(l)}
            className="p-1.5 text-navy-900 dark:text-gold-400 hover:bg-ivory-200 dark:hover:bg-navy-800 rounded-lg transition-colors"
            title="عرض حمولة البيانات التفصيلية (JSON Payload)"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-kufi font-extrabold text-navy-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Icon3D name="audit" size="lg" />
            <span>سجل التدقيق الأمني والنشاطات 🔒</span>
          </h1>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
            سجل دائم غير قابل للتعديل يوثق كافة حركات وإنشاء وتعديل البيانات وحركات الحسابات
          </p>
        </div>

        <Button
          variant="outline"
          onClick={handleExportCSV}
          leftIcon={<Icon3D name="download" size="xs" />}
        >
          تصدير السجلات (CSV)
        </Button>
      </div>

      {/* Contextual Smart Search & Quick Filter Pills Bar */}
      <div className="space-y-2 font-sans">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
          {[
            { label: 'الكل', entity: '', action: '' },
            { label: 'عمليات مالية', entity: 'Payment', action: '' },
            { label: 'مبيعات', entity: 'Sale', action: '' },
            { label: 'عملاء وخطوط', entity: 'Customer', action: '' },
            { label: 'عمليات حساسة / حذوفات', entity: '', action: 'DELETE' },
            { label: 'تسجيلات الدخول', entity: 'User', action: 'LOGIN' },
          ].map((pill) => {
            const isActive = pill.action
              ? actionFilter === pill.action
              : entityTypeFilter === pill.entity && !actionFilter;
            return (
              <button
                key={pill.label}
                onClick={() => {
                  setEntityTypeFilter(pill.entity);
                  setActionFilter(pill.action);
                  setPage(1);
                }}
                className={
                  isActive
                    ? 'px-3.5 py-1 text-xs rounded-full bg-amber-400 text-navy-950 font-extrabold shadow-sm shadow-amber-500/20 whitespace-nowrap cursor-pointer'
                    : 'px-3.5 py-1 text-xs rounded-full border border-ivory-300 dark:border-slate-700/60 bg-white dark:bg-navy-950 text-navy-900 dark:text-slate-300 hover:border-amber-500/50 transition-all cursor-pointer font-bold whitespace-nowrap'
                }
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <ContextualSearchBar
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="بحث فوري باسم المستخدم، نوع الكيان، عنوان IP، أو كود العملية..."
          filteredCount={data?.items?.length || 0}
          totalCount={data?.meta?.totalItems || 0}
          filterSlots={
            <div className="flex flex-wrap md:flex-nowrap items-center gap-2.5">
              <div className="w-40">
                <Select
                  value={entityTypeFilter}
                  onChange={(e) => {
                    setEntityTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">جميع الكيانات</option>
                  <option value="Sale">المبيعات (Sale)</option>
                  <option value="Payment">التحصيلات (Payment)</option>
                  <option value="Customer">العملاء (Customer)</option>
                  <option value="Line">الخطوط (Line)</option>
                  <option value="Expense">المصروفات (Expense)</option>
                  <option value="DailyClosing">الإغلاق اليومي (DailyClosing)</option>
                  <option value="User">المستخدمين (User)</option>
                </Select>
              </div>

              <div className="w-40">
                <Select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">جميع الإجراءات</option>
                <option value={AuditAction.LOGIN}>تسجيل دخول (LOGIN)</option>
                <option value={AuditAction.CREATE}>إنشاء (CREATE)</option>
                <option value={AuditAction.UPDATE}>تعديل (UPDATE)</option>
                <option value={AuditAction.REVERSAL}>عكس معاملة (REVERSAL)</option>
                <option value={AuditAction.DAILY_CLOSE}>إغلاق يومي (DAILY_CLOSE)</option>
                <option value={AuditAction.DAILY_REOPEN}>إعادة فتح وردية (DAILY_REOPEN)</option>
              </Select>
            </div>
          </div>
        }
      />
      </div>

      {/* Data Table */}
      <Table
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyMessage="لم يتم العثور على سجلات تدقيق مطابقة"
      />

      <Pagination
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalItems={data?.meta?.totalItems || 0}
        onPageChange={(p) => setPage(p)}
      />

      {/* Modal: View Audit Payload JSON */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        size="lg"
        title={`تفاصيل سجّل التدقيق: ${selectedLog?.action} على ${selectedLog?.entityType}`}
      >
        <div className="space-y-4 text-xs font-mono" dir="ltr">
          {selectedLog?.oldData && (
            <div>
              <p className="font-sans font-bold text-navy-900 dark:text-slate-200 text-right mb-1 text-xs">
                البيانات السابقة (Old Data):
              </p>
              <pre className="p-3.5 bg-navy-950 text-slate-100 rounded-xl border border-navy-800 overflow-x-auto text-[11px] leading-relaxed custom-scrollbar">
                {JSON.stringify(JSON.parse(selectedLog.oldData), null, 2)}
              </pre>
            </div>
          )}

          {selectedLog?.newData && (
            <div>
              <p className="font-sans font-bold text-navy-900 dark:text-slate-200 text-right mb-1 text-xs">
                البيانات الجديدة (New Data):
              </p>
              <pre className="p-3.5 bg-navy-950 text-emerald-300 rounded-xl border border-navy-800 overflow-x-auto text-[11px] leading-relaxed custom-scrollbar">
                {JSON.stringify(JSON.parse(selectedLog.newData), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
