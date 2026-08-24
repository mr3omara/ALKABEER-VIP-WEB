import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column } from '../components/ui/Table';
import { Badge, getStatusBadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Clock,
  Lock,
  Unlock,
  Plus,
  RotateCcw,
  AlertCircle,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { DailyClosingStatus, PERMISSIONS, Money } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface DailyClosing {
  id: string;
  businessDate: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  totalSales: number;
  totalPayments: number;
  totalExpenses: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  status: DailyClosingStatus;
  notes?: string;
  closer?: { username: string; fullName: string };
}

export const DailyClosingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const todayStr = new Date().toISOString().split('T')[0];

  // Modals state
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState<DailyClosing | null>(null);

  // Form states
  const [formBusinessDate, setFormBusinessDate] = useState(todayStr);
  const [formOpeningBalance, setFormOpeningBalance] = useState<number>(0);
  const [formOpenNotes, setFormOpenNotes] = useState('');

  const [formActualBalance, setFormActualBalance] = useState<number>(0);
  const [formCloseNotes, setFormCloseNotes] = useState('');

  const [reopenReason, setReopenReason] = useState('');

  // 1. Fetch Closings Archive
  const { data: closings, isLoading } = useQuery<DailyClosing[]>({
    queryKey: ['daily-closings'],
    queryFn: () => apiClient('/daily-closing'),
  });

  // Open Shift Mutation
  const openShiftMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/daily-closing/open', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-closings'] });
      queryClient.invalidateQueries({ queryKey: ['daily-closing-today'] });
      toast.success('تم فتح وردية العمل وتثبيت الرصيد الافتتاحي بنجاح');
      setIsOpenModalOpen(false);
      setFormOpeningBalance(0);
      setFormOpenNotes('');
    },
    onError: (err: any) => {
      toast.error('فشل فتح الوردية', err.message);
    },
  });

  // Close Shift Mutation
  const closeShiftMutation = useMutation({
    mutationFn: ({ date, payload }: { date: string; payload: any }) =>
      apiClient(`/daily-closing/${date}/close`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-closings'] });
      queryClient.invalidateQueries({ queryKey: ['daily-closing-today'] });
      toast.success('تم إغلاق الوردية وحساب المطابقة والفروقات المحاسبية بنجاح');
      setIsCloseModalOpen(false);
      setFormActualBalance(0);
      setFormCloseNotes('');
    },
    onError: (err: any) => {
      toast.error('فشل إغلاق الوردية', err.message);
    },
  });

  // Reopen Shift Mutation
  const reopenShiftMutation = useMutation({
    mutationFn: ({ date, reason }: { date: string; reason: string }) =>
      apiClient(`/daily-closing/${date}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-closings'] });
      queryClient.invalidateQueries({ queryKey: ['daily-closing-today'] });
      toast.success('تمت إعادة فتح الوردية وتوثيق السبب بسجل التدقيق الأمني');
      setIsReopenModalOpen(false);
      setReopenReason('');
    },
    onError: (err: any) => {
      toast.error('فشل إعادة فتح الوردية', err.message);
    },
  });

  const columns: Column<DailyClosing>[] = [
    {
      header: 'تاريخ يوم العمل',
      accessorKey: 'businessDate',
      className: 'font-mono font-bold text-slate-900 dark:text-slate-100',
    },
    {
      header: 'الرصيد الافتتاحي',
      cell: (c) => (
        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
          {Money.format(c.openingBalance)}
        </span>
      ),
    },
    {
      header: 'إجمالي المبيعات',
      cell: (c) => (
        <span className="font-bold text-blue-700 dark:text-blue-400 font-mono">
          {Money.format(c.totalSales)}
        </span>
      ),
    },
    {
      header: 'التحصيلات النقدية',
      cell: (c) => (
        <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
          +{Money.format(c.totalPayments)}
        </span>
      ),
    },
    {
      header: 'المصروفات المنصرفة',
      cell: (c) => (
        <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
          -{Money.format(c.totalExpenses)}
        </span>
      ),
    },
    {
      header: 'الرصيد المتوقع بالخزينة',
      cell: (c) => (
        <span className="font-extrabold text-slate-900 dark:text-slate-100 font-mono">
          {Money.format(c.expectedBalance)}
        </span>
      ),
    },
    {
      header: 'الرصيد الفعلي المعدود',
      cell: (c) => (
        <span className="font-extrabold text-amber-700 dark:text-gold-400 font-mono">
          {Money.format(c.actualBalance)}
        </span>
      ),
    },
    {
      header: 'نتيجة المطابقة',
      cell: (c) => {
        const isMatch = c.difference === 0;
        const isSurplus = c.difference > 0;
        return (
          <div className="flex items-center gap-1.5 font-mono">
            {isMatch ? (
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                مطابق تماماً (0)
              </span>
            ) : isSurplus ? (
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>فائض (+{Money.format(c.difference)})</span>
              </span>
            ) : (
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                <span>عجز ({Money.format(c.difference)})</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'الحالة',
      cell: (c) => (
        <Badge variant={getStatusBadgeVariant(c.status)}>{c.status}</Badge>
      ),
    },
    {
      header: 'الإجراءات',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (c) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {c.status === DailyClosingStatus.OPEN && hasPermission(PERMISSIONS.DAILY_CLOSING_MANAGE) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelectedClosing(c);
                setIsCloseModalOpen(true);
              }}
              leftIcon={<Lock className="w-3.5 h-3.5" />}
            >
              إغلاق ومطابقة
            </Button>
          )}

          {c.status === DailyClosingStatus.CLOSED && hasPermission(PERMISSIONS.DAILY_CLOSING_REOPEN) && (
            <button
              onClick={() => {
                setSelectedClosing(c);
                setIsReopenModalOpen(true);
              }}
              title="إعادة فتح الوردية"
              aria-label="إعادة فتح الوردية"
              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight font-kufi">
            <Icon3D name="daily-closing" size="lg" />
            <span>الإغلاق اليومي والمطابقة المحاسبية للورديات ⏱️</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
            تسوية الخزائن النقدية، مطابقة الرصيد الفعلي مقابل المتوقع، وتسجيل الفروقات المحاسبية
          </p>
        </div>

        {hasPermission(PERMISSIONS.DAILY_CLOSING_MANAGE) && (
          <Button
            variant="gold"
            onClick={() => setIsOpenModalOpen(true)}
            leftIcon={<Icon3D name="plus" size="xs" />}
          >
            فتح وردية عمل جديدة
          </Button>
        )}
      </div>

      {/* Accounting Formula Banner */}
      <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200/90 dark:border-navy-800 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-navy-900 dark:bg-navy-800 text-gold-400 rounded-xl border border-gold-500/20">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">معادلة المطابقة المحاسبية للخزينة:</h3>
            <p className="text-xs font-mono text-slate-700 dark:text-slate-300 font-semibold mt-0.5">
              الرصيد المتوقع = الرصيد الافتتاحي + إجمالي التحصيلات - إجمالي المصروفات
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-700 dark:text-slate-300 font-bold">
          الفارق = النقدية الفعلية المعدودة - الرصيد المتوقع
        </div>
      </div>

      {/* Data Table */}
      <Table
        columns={columns}
        data={closings || []}
        isLoading={isLoading}
        emptyMessage="لم يتم تسجيل أي إغلاقات يومية سابقة. يمكنك بدء يوم العمل بالضغط على [فتح وردية عمل جديدة]."
      />

      {/* 1. Modal: Open Shift */}
      <Modal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        title="فتح وردية عمل ليوم جديد"
        description="تحديد تاريخ يوم العمل وتثبيت الرصيد الافتتاحي الفعلي بالدرج / الخزينة"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsOpenModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              isLoading={openShiftMutation.isPending}
              onClick={() => {
                if (!formBusinessDate) {
                  toast.error('يرجى تحديد تاريخ يوم العمل');
                  return;
                }
                openShiftMutation.mutate({
                  businessDate: formBusinessDate,
                  openingBalance: Number(formOpeningBalance) || 0,
                  notes: formOpenNotes.trim() || undefined,
                });
              }}
            >
              تأكيد فتح الوردية
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="تاريخ يوم العمل (YYYY-MM-DD) *"
            type="date"
            value={formBusinessDate}
            onChange={(e) => setFormBusinessDate(e.target.value)}
            autoFocus
          />

          <Input
            label="الرصيد الافتتاحي الفعلي في بداية الوردية (ج.م صحيح)"
            type="number"
            min="0"
            value={formOpeningBalance}
            onChange={(e) => setFormOpeningBalance(parseInt(e.target.value, 10) || 0)}
          />

          <Textarea
            label="ملاحظات الافتتاح"
            placeholder="مثال: استلام الوردية الصباحية بدون فكة، أو ملاحظات خاصة بالدرج..."
            value={formOpenNotes}
            onChange={(e) => setFormOpenNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* 2. Modal: Close Shift & Reconcile */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        size="lg"
        title={`إغلاق الوردية والمطابقة المالية: ${selectedClosing?.businessDate}`}
        description="يقوم الخادم آلياً بتجميع المبيعات والتحصيلات والمصروفات وحساب الرصيد المتوقع"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCloseModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              isLoading={closeShiftMutation.isPending}
              onClick={() => {
                if (!selectedClosing) return;
                closeShiftMutation.mutate({
                  date: selectedClosing.businessDate,
                  payload: {
                    actualBalance: Number(formActualBalance) || 0,
                    notes: formCloseNotes.trim() || undefined,
                  },
                });
              }}
            >
              تأكيد الإغلاق وترحيل الوردية
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Quick Shift Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500">الرصيد الافتتاحي</span>
              <p className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                {Money.format(selectedClosing?.openingBalance || 0)}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[11px] text-emerald-700">التحصيلات النقدية</span>
              <p className="text-sm font-bold text-emerald-800 mt-0.5 font-mono">
                +{Money.format(selectedClosing?.totalPayments || 0)}
              </p>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-[11px] text-rose-700">المصروفات المنصرفة</span>
              <p className="text-sm font-bold text-rose-800 mt-0.5 font-mono">
                -{Money.format(selectedClosing?.totalExpenses || 0)}
              </p>
            </div>
          </div>

          <Input
            label="النقدية الفعلية المعدودة في الخزينة عند الإغلاق (ج.م صحيح) *"
            type="number"
            min="0"
            value={formActualBalance}
            onChange={(e) => setFormActualBalance(parseInt(e.target.value, 10) || 0)}
            autoFocus
          />

          <Textarea
            label="ملاحظات الإغلاق والتسوية"
            placeholder="ملاحظات توضيحية حول سبب أي عجز أو زيادة في النقدية إن وجدت..."
            value={formCloseNotes}
            onChange={(e) => setFormCloseNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* 3. Modal: Reopen Shift with Strict Audit Justification */}
      <Modal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        title={`إعادة فتح الوردية: ${selectedClosing?.businessDate}`}
        description="يتطلب موافقة إدارية وسيتم توثيق طلب إعادة الفتح كاملاً في سجل التدقيق الأمني"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsReopenModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              isLoading={reopenShiftMutation.isPending}
              onClick={() => {
                if (!selectedClosing || !reopenReason.trim()) {
                  toast.error('يرجى كتابة سبب إعادة فتح الوردية المغلقة');
                  return;
                }
                reopenShiftMutation.mutate({
                  date: selectedClosing.businessDate,
                  reason: reopenReason.trim(),
                });
              }}
            >
              تأكيد إعادة الفتح
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">تنبيه الحوكمة والتدقيق المحاسبي:</p>
              <p className="mt-1">
                إعادة فتح الوردية المغلقة هو إجراء استثنائي يتم تتبعه في سجل الأمان لمنع التلاعب بالأرصدة المرحّلة.
              </p>
            </div>
          </div>

          <Textarea
            label="سبب إعادة فتح الوردية *"
            placeholder="مثال: تسجيل سند تحصيل متأخر بموافقة الإدارة المالية..."
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
};
