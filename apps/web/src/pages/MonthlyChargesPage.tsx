import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column, Pagination } from '../components/ui/Table';
import { Badge, getStatusBadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { MonthlyChargeStatus, PERMISSIONS, Money } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface MonthlyCharge {
  id: string;
  lineId: string;
  customerId: string;
  billingMonth: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: MonthlyChargeStatus;
  notes?: string;
  createdAt: string;
  line?: { id: string; phoneNumber: string; company?: { name: string } };
  customer?: { id: string; name: string; phone: string; customerCode: string };
  allocations?: any[];
}

export const MonthlyChargesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [billingMonthFilter, setBillingMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  // Form state
  const [formLineId, setFormLineId] = useState('');
  const [formMonth, setFormMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');

  // 1. Fetch Monthly Charges
  const { data, isLoading } = useQuery<{ items: MonthlyCharge[]; meta: any }>({
    queryKey: ['monthly-charges', page, billingMonthFilter, statusFilter],
    queryFn: () =>
      apiClient(
        `/monthly-charges?page=${page}&limit=15&billingMonth=${billingMonthFilter}&status=${statusFilter}`,
      ),
  });

  // 2. Fetch Assigned Lines for Charge Generation
  const { data: assignedLines } = useQuery({
    queryKey: ['sold-active-lines'],
    queryFn: () => apiClient('/lines?limit=100'),
    enabled: isGenerateModalOpen,
  });

  // Generate Charge Mutation
  const generateMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/monthly-charges', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-charges'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      toast.success('تم توليد الفاتورة الشهرية بنجاح');
      setIsGenerateModalOpen(false);
      setFormLineId('');
      setFormAmount(0);
      setFormNotes('');
    },
    onError: (err: any) => {
      toast.error('فشل توليد الفاتورة', err.message);
    },
  });

  const handleLineSelect = (lineId: string) => {
    setFormLineId(lineId);
    const line = assignedLines?.items?.find((l: any) => l.id === lineId);
    if (line) {
      setFormAmount(line.monthlyPackage || 0);
    }
  };

  const columns: Column<MonthlyCharge>[] = [
    {
      header: 'شهر الفاتورة',
      accessorKey: 'billingMonth',
      className: 'font-mono font-bold text-slate-900 dark:text-slate-100',
    },
    {
      header: 'رقم الخط',
      cell: (ch) => (
        <div>
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 dir-ltr inline-block">
            {ch.line?.phoneNumber}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 block">{ch.line?.company?.name}</span>
        </div>
      ),
    },
    {
      header: 'العميل المستحق عليه',
      cell: (ch) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{ch.customer?.name || '—'}</p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{ch.customer?.phone}</p>
        </div>
      ),
    },
    {
      header: 'تاريخ الاستحقاق',
      cell: (ch) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
          {new Date(ch.dueDate).toLocaleDateString('ar-EG')}
        </span>
      ),
    },
    {
      header: 'قيمة الفاتورة (EGP)',
      cell: (ch) => (
        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{Money.format(ch.amount)}</span>
      ),
    },
    {
      header: 'المسدد منها',
      cell: (ch) => (
        <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
          {Money.format(ch.paidAmount)}
        </span>
      ),
    },
    {
      header: 'المتبقي',
      cell: (ch) => {
        const rem = Money.subtract(ch.amount, ch.paidAmount);
        return (
          <span className={`font-bold font-mono ${rem > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {Money.format(rem)}
          </span>
        );
      },
    },
    {
      header: 'الحالة',
      cell: (ch) => (
        <Badge variant={getStatusBadgeVariant(ch.status)}>{ch.status}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight font-kufi">
            <Icon3D name="receipt" size="lg" />
            <span>سجل الفواتير الشهرية الدورية 🧾</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
            استحقاقات الاشتراكات الشهرية وتتبع المدفوعات والمتبقي لكل خط
          </p>
        </div>

        {hasPermission(PERMISSIONS.MONTHLY_CHARGES_MANAGE) && (
          <Button
            variant="gold"
            onClick={() => setIsGenerateModalOpen(true)}
            leftIcon={<Icon3D name="plus" size="xs" />}
          >
            توليد فاتورة شهرية لخط
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200/90 dark:border-navy-800 shadow-2xs flex flex-col md:flex-row items-center gap-4 transition-colors">
        <div className="w-full md:w-48">
          <Input
            label="تصفية بالشهر"
            type="month"
            value={billingMonthFilter}
            onChange={(e) => {
              setBillingMonthFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="w-full md:w-48">
          <Select
            label="تصفية بالحالة"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">جميع الحالات</option>
            <option value={MonthlyChargeStatus.DUE}>مستحق بالكامل (DUE)</option>
            <option value={MonthlyChargeStatus.PARTIALLY_PAID}>مسدد جزئياً (PARTIALLY_PAID)</option>
            <option value={MonthlyChargeStatus.PAID}>مسدد بالكامل (PAID)</option>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <Table
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyMessage="لم يتم العثور على فواتير شهرية مطابقة"
      />

      <Pagination
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalItems={data?.meta?.totalItems || 0}
        onPageChange={(p) => setPage(p)}
      />

      {/* Modal: Generate Monthly Charge */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="توليد فاتورة شهرية دورية"
        description="توليد استحقاق شهري منفصل مع التحقق من عدم التكرار لنفس الخط والشهر"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsGenerateModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              isLoading={generateMutation.isPending}
              onClick={() => {
                if (!formLineId || !formMonth || !formDueDate || formAmount <= 0) {
                  toast.error('يرجى اختيار الخط وتحديد شهر الاستحقاق والمبلغ (> 0)');
                  return;
                }

                generateMutation.mutate({
                  lineId: formLineId,
                  billingMonth: formMonth,
                  dueDate: formDueDate,
                  amount: Number(formAmount),
                  notes: formNotes || undefined,
                });
              }}
            >
              توليد الفاتورة ({Money.format(formAmount)})
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="اختر الخط المملوك لعميل *"
            value={formLineId}
            onChange={(e) => handleLineSelect(e.target.value)}
          >
            <option value="">اختر الخط من القائمة...</option>
            {assignedLines?.items
              ?.filter((l: any) => !!l.customerId)
              ?.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.phoneNumber} ({l.company?.name}) - العميل: {l.customer?.name}
                </option>
              ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="شهر الفاتورة (YYYY-MM) *"
              type="month"
              value={formMonth}
              onChange={(e) => setFormMonth(e.target.value)}
            />
            <Input
              label="تاريخ الاستحقاق *"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />
          </div>

          <Input
            label="مبلغ الفاتورة (ج.م صحيح) *"
            type="number"
            min="1"
            value={formAmount}
            onChange={(e) => setFormAmount(parseInt(e.target.value, 10) || 0)}
          />

          <Textarea
            label="ملاحظات"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
