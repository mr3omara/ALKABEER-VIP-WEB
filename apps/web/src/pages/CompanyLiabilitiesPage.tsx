import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column } from '../components/ui/Table';
import { Badge, CompanyBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ContextualSearchBar } from '../components/ui/ContextualSearchBar';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Building2,
  Plus,
  Search,
  Eye,
  CreditCard,
  Printer,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingDown,
  ReceiptText,
  DollarSign,
  BellRing,
  Building,
  ArrowDownRight,
  Filter,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import { PERMISSIONS, Money, PaymentMethod } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface CompanyLiability {
  id: string;
  invoiceNumber: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  companyColor?: string;
  billingMonth: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  alertStatus: 'OVERDUE' | 'DUE_SOON' | 'NORMAL';
  notes?: string;
  createdAt: string;
}

interface LiabilitiesResponse {
  items: CompanyLiability[];
  summary: {
    totalOutstanding: number;
    paidThisMonth: number;
    pendingCount: number;
    totalCount: number;
  };
}

export const CompanyLiabilitiesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLiability, setSelectedLiability] = useState<CompanyLiability | null>(null);

  // Form states (Create)
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formBillingMonth, setFormBillingMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [formDueDate, setFormDueDate] = useState('');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');

  // Form states (Pay Installment)
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payTreasuryId, setPayTreasuryId] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [payNotes, setPayNotes] = useState('');

  // 1. Fetch Liabilities with Instant Search & Status Filter
  const { data, isLoading } = useQuery<LiabilitiesResponse>({
    queryKey: ['company-liabilities', statusFilter, search],
    queryFn: () =>
      apiClient(
        `/companies/liabilities?status=${statusFilter}&search=${encodeURIComponent(search)}`,
      ),
  });

  // 2. Fetch Companies List for Form Select
  const { data: companies } = useQuery({
    queryKey: ['companies-list-lookup'],
    queryFn: () => apiClient('/companies'),
  });

  // 3. Fetch Treasury Accounts for Payments
  const { data: treasuryAccounts } = useQuery({
    queryKey: ['treasury-accounts-lookup'],
    queryFn: () => apiClient('/treasury/accounts'),
    enabled: isPayModalOpen,
  });

  // Create Liability Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/companies/liabilities', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-liabilities'] });
      toast.success('تم تسجيل فاتورة / التزام الشركة بنجاح');
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل تسجيل التزام الشركة');
    },
  });

  // Pay Installment Mutation
  const payMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiClient(`/companies/liabilities/${id}/pay`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-transactions'] });
      toast.success('تم خصم الدفعة من الخزينة وتحديث فاتورة الشركة بنجاح');
      setIsPayModalOpen(false);
      setPayAmount(0);
      setPayNotes('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل خصم سداد الفاتورة');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/companies/liabilities/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-liabilities'] });
      toast.success('تم حذف فاتورة التزام الشركة بنجاح');
      setIsDeleteModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل حذف الفاتورة');
    },
  });

  const resetCreateForm = () => {
    setFormCompanyId('');
    setFormBillingMonth(new Date().toISOString().slice(0, 7));
    setFormDueDate('');
    setFormAmount(0);
    setFormNotes('');
  };

  const getCompanyBadgeStyle = (code: string) => {
    switch (code?.toUpperCase()) {
      case 'VF':
      case 'VODAFONE':
        return 'bg-red-600 text-white border-red-700';
      case 'OR':
      case 'ORANGE':
        return 'bg-orange-500 text-white border-orange-600';
      case 'WE':
        return 'bg-purple-700 text-white border-purple-800';
      case 'ET':
      case 'ETISALAT':
        return 'bg-emerald-600 text-white border-emerald-700';
      default:
        return 'bg-navy-900 text-gold-400 border-navy-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">مسدد بالكامل</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="warning">مسدد جزئياً</Badge>;
      case 'UNPAID':
      default:
        return <Badge variant="danger">غير مسدد</Badge>;
    }
  };

  const getAlertBadge = (alert: string) => {
    switch (alert) {
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>متأخر!</span>
          </span>
        );
      case 'DUE_SOON':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>مستحق قريباً</span>
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>سليم</span>
          </span>
        );
    }
  };

  const columns: Column<CompanyLiability>[] = [
    {
      header: 'م',
      cell: (_, idx) => (
        <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
          {(idx + 1).toString().padStart(2, '0')}
        </span>
      ),
      className: 'w-12 text-center',
    },
    {
      header: 'شركة الاتصالات',
      cell: (item) => (
        <div className="flex items-center gap-2.5">
          <CompanyBadge
            companyNameOrCode={item.companyName || item.companyCode}
          />
          <div>
            <span className="font-extrabold text-navy-900 dark:text-slate-100 text-xs block">
              {item.companyName}
            </span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {item.invoiceNumber}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'شهر الاستحقاق',
      cell: (item) => (
        <span className="font-mono font-bold text-navy-900 dark:text-slate-100 text-xs">
          {item.billingMonth}
        </span>
      ),
    },
    {
      header: 'تاريخ الاستحقاق',
      cell: (item) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
          {item.dueDate}
        </span>
      ),
    },
    {
      header: 'قيمة الفاتورة',
      cell: (item) => (
        <span className="font-mono font-bold text-navy-900 dark:text-slate-100 text-xs">
          {Money.format(item.amount)} ج.م
        </span>
      ),
    },
    {
      header: 'المدفوع',
      cell: (item) => (
        <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400 text-xs">
          {Money.format(item.paidAmount)} ج.م
        </span>
      ),
    },
    {
      header: 'المتبقي',
      cell: (item) => (
        <span className="font-mono font-bold text-rose-700 dark:text-rose-400 text-xs">
          {Money.format(item.remainingAmount)} ج.م
        </span>
      ),
    },
    {
      header: 'نسبة السداد',
      cell: (item) => {
        const percent = Math.min(100, Math.round((item.paidAmount / (item.amount || 1)) * 100));
        return (
          <div className="w-28 space-y-1">
            <div className="flex justify-between text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
              <span>{percent}%</span>
            </div>
            <div className="w-full h-1.5 bg-ivory-200 dark:bg-navy-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  percent === 100
                    ? 'bg-emerald-500'
                    : percent > 0
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'الحالة',
      cell: (item) => getStatusBadge(item.status),
    },
    {
      header: 'التنبيه',
      cell: (item) => getAlertBadge(item.alertStatus),
    },
    {
      header: 'الإجراءات',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (item) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setSelectedLiability(item);
              setIsDetailsModalOpen(true);
            }}
            title="عرض تفاصيل الفاتورة"
            className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-blue-600 dark:text-blue-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>

          {item.status !== 'PAID' && hasPermission(PERMISSIONS.COMPANIES_MANAGE) && (
            <button
              onClick={() => {
                setSelectedLiability(item);
                setPayAmount(item.remainingAmount);
                setIsPayModalOpen(true);
              }}
              title="تسجيل سداد دفعة من الخزينة"
              className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-emerald-600 dark:text-emerald-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
            >
              <CreditCard className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => {
              setSelectedLiability(item);
              setIsDetailsModalOpen(true);
            }}
            title="طباعة إيصال الفاتورة"
            className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-slate-600 dark:text-slate-300 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>

          {hasPermission(PERMISSIONS.COMPANIES_MANAGE) && (
            <button
              onClick={() => {
                setSelectedLiability(item);
                setIsDeleteModalOpen(true);
              }}
              title="حذف الفاتورة"
              className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-rose-600 dark:text-rose-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Page Header & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-kufi font-extrabold text-navy-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Icon3D name="company-liabilities" size="lg" />
            <span>التزامات وفواتير شركات الاتصالات 🏢</span>
          </h1>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
            متابعة وسداد فواتير الموردين (Vodafone, Orange, WE, Etisalat) وإجراء السداد من الخزائن والبنوك
          </p>
        </div>

        {hasPermission(PERMISSIONS.COMPANIES_MANAGE) && (
          <Button
            variant="gold"
            onClick={() => {
              resetCreateForm();
              setIsCreateModalOpen(true);
            }}
            leftIcon={<Icon3D name="plus" size="xs" />}
          >
            تسجيل فاتورة / التزام جديد
          </Button>
        )}
      </div>

      {/* 2. 3 Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Total Outstanding Liabilities */}
        <div className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              ⚠️ إجمالي المستحق للشركات (المتبقي)
            </span>
            <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-400 font-mono tracking-tight">
              {Money.format(data?.summary?.totalOutstanding || 0)} ج.م
            </p>
          </div>
          <div className="p-1 rounded-xl">
            <Icon3D name="alert" size="lg" />
          </div>
        </div>

        {/* KPI 2: Paid This Month */}
        <div className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              المسدد هذا الشهر للشركات
            </span>
            <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-400 font-mono tracking-tight">
              {Money.format(data?.summary?.paidThisMonth || 0)} ج.م
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Pending Invoices Count */}
        <div className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex items-center justify-between transition-colors">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              فواتير معلقة / غير مسددة بالكامل
            </span>
            <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 font-mono tracking-tight">
              {data?.summary?.pendingCount || 0} فواتير
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <BellRing className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Quick Status Filter Pills & Search Bar */}
      <ContextualSearchBar
        value={search}
        onChange={(val) => setSearch(val)}
        placeholder="بحث في التزامات وفواتير الشركات (باسم الشركة، رقم الفاتورة، شهر الاستحقاق)..."
        filteredCount={data?.items?.length || 0}
        totalCount={data?.summary?.totalCount || 0}
        filterSlots={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === ''
                  ? 'bg-navy-900 text-gold-400 dark:bg-gold-500 dark:text-navy-950 shadow-gold-xs'
                  : 'bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-300 border border-ivory-300 dark:border-navy-750'
              }`}
            >
              الكل ({data?.summary?.totalCount || 0})
            </button>

            <button
              onClick={() => setStatusFilter('UNPAID')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'UNPAID'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-300 border border-ivory-300 dark:border-navy-750'
              }`}
            >
              غير مسدد
            </button>

            <button
              onClick={() => setStatusFilter('PARTIALLY_PAID')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'PARTIALLY_PAID'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-300 border border-ivory-300 dark:border-navy-750'
              }`}
            >
              مسدد جزئياً
            </button>

            <button
              onClick={() => setStatusFilter('PAID')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'PAID'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-300 border border-ivory-300 dark:border-navy-750'
              }`}
            >
              مسدد بالكامل
            </button>
          </div>
        }
      />

      {/* 4. Data Table (سجل فواتير الشركات) */}
      <Table
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyMessage="لا توجد فواتير أو التزامات شركات مطابقة لمعايير البحث."
      />

      {/* MODAL 1: New Liability / Invoice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="تسجيل فاتورة / التزام شركة جديد (B2B Invoice)"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="gold"
              isLoading={createMutation.isPending}
              onClick={() => {
                if (!formCompanyId) {
                  toast.error('يرجى اختيار شركة الاتصالات');
                  return;
                }
                if (!formDueDate) {
                  toast.error('يرجى إدخال تاريخ الاستحقاق');
                  return;
                }
                if (!formAmount || formAmount <= 0) {
                  toast.error('يرجى إدخال قيمة الفاتورة بشكل صحيح');
                  return;
                }
                createMutation.mutate({
                  companyId: formCompanyId,
                  billingMonth: formBillingMonth,
                  dueDate: formDueDate,
                  amount: Number(formAmount),
                  notes: formNotes || undefined,
                });
              }}
            >
              حفظ وتأكيد التزام الشركة
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          <Select
            label="اختر شركة الاتصالات (Vodafone, Orange, WE, Etisalat) *"
            value={formCompanyId}
            onChange={(e) => setFormCompanyId(e.target.value)}
          >
            <option value="">اختر الشركة...</option>
            {companies?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="شهر الاستحقاق (YYYY-MM) *"
              type="month"
              value={formBillingMonth}
              onChange={(e) => setFormBillingMonth(e.target.value)}
            />

            <Input
              label="تاريخ الاستحقاق والتسديد النهائي *"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />
          </div>

          <Input
            label="إجمالي قيمة الفاتورة (EGP) *"
            type="number"
            value={formAmount || ''}
            onChange={(e) => setFormAmount(Number(e.target.value))}
            placeholder="0.00"
          />

          <Textarea
            label="ملاحظات وبيان الفاتورة (اختياري)"
            placeholder="رقم الإيصال، التفاصيل الخاصة بالفاتورة، الملاحظات..."
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* MODAL 2: Pay Invoice Installment Modal */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title={`تسجيل سداد دفعة للشركة — ${selectedLiability?.companyName} (${selectedLiability?.invoiceNumber})`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsPayModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              isLoading={payMutation.isPending}
              onClick={() => {
                if (!payAmount || payAmount <= 0) {
                  toast.error('يرجى إدخال مبلغ السداد');
                  return;
                }
                if (!payTreasuryId) {
                  toast.error('يرجى اختيار الخزينة / الحساب المالي الخصم منه');
                  return;
                }
                if (selectedLiability) {
                  payMutation.mutate({
                    id: selectedLiability.id,
                    payload: {
                      amount: Number(payAmount),
                      treasuryAccountId: payTreasuryId,
                      paymentMethod: payMethod,
                      notes: payNotes || undefined,
                    },
                  });
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              تأكيد السداد والخصم من الخزينة
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs flex items-center justify-between">
            <div>
              <span className="font-bold text-rose-900 dark:text-rose-200 block">
                المتبقي غير المسدد من الفاتورة:
              </span>
              <span className="font-mono text-base font-extrabold text-rose-800 dark:text-rose-400">
                {Money.format(selectedLiability?.remainingAmount || 0)} ج.م
              </span>
            </div>
            <Badge variant="warning">شهر {selectedLiability?.billingMonth}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="مبلغ الدفعة المسددة (EGP) *"
              type="number"
              value={payAmount || ''}
              onChange={(e) => setPayAmount(Number(e.target.value))}
              placeholder="0.00"
              autoFocus
            />

            <Select
              label="طريقة السداد *"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            >
              <option value={PaymentMethod.CASH}>نقداً من الخزينة (CASH)</option>
              <option value={PaymentMethod.BANK}>تحويل بنكي (BANK)</option>
              <option value={PaymentMethod.WALLET}>محفظة إلكترونية (WALLET)</option>
            </Select>
          </div>

          <Select
            label="الحساب المالي / الخزينة المخصوم منها *"
            value={payTreasuryId}
            onChange={(e) => setPayTreasuryId(e.target.value)}
          >
            <option value="">اختر الخزينة أو الحساب البنكي...</option>
            {treasuryAccounts?.map((acc: any) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({Money.format(acc.currentBalance)} ج.م)
              </option>
            ))}
          </Select>

          <Textarea
            label="ملاحظات السداد (اختياري)"
            placeholder="رقم التحويل البنكي، اسم المستلم..."
            value={payNotes}
            onChange={(e) => setPayNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* MODAL 3: Liability Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`بطاقة بيانات فاتورة الشركة — ${selectedLiability?.companyName}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
              إغلاق
            </Button>
            <Button variant="gold" onClick={() => window.print()} leftIcon={<Printer className="w-4 h-4" />}>
              طباعة إيصال الفاتورة
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans p-4 bg-white dark:bg-navy-950 rounded-xl border border-ivory-300 dark:border-navy-750">
          <div className="flex items-center justify-between border-b border-ivory-200 dark:border-navy-800 pb-3">
            <div>
              <span className="text-xs text-slate-500 font-bold block">رقم الفاتورة المرجعي</span>
              <span className="font-mono font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                {selectedLiability?.invoiceNumber}
              </span>
            </div>
            {selectedLiability && getStatusBadge(selectedLiability.status)}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-bold block">شركة الاتصالات:</span>
              <span className="font-bold text-navy-900 dark:text-slate-100">{selectedLiability?.companyName}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block">شهر الاستحقاق:</span>
              <span className="font-mono font-bold text-navy-900 dark:text-slate-100">{selectedLiability?.billingMonth}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block">تاريخ الاستحقاق:</span>
              <span className="font-mono font-bold text-navy-900 dark:text-slate-100">{selectedLiability?.dueDate}</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block">إجمالي قيمة الفاتورة:</span>
              <span className="font-mono font-bold text-navy-900 dark:text-slate-100">{Money.format(selectedLiability?.amount || 0)} ج.م</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block">المسدد:</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{Money.format(selectedLiability?.paidAmount || 0)} ج.م</span>
            </div>
            <div>
              <span className="text-slate-500 font-bold block">المتبقي:</span>
              <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{Money.format(selectedLiability?.remainingAmount || 0)} ج.م</span>
            </div>
          </div>

          {selectedLiability?.notes && (
            <div className="p-3 bg-ivory-100 dark:bg-navy-900 rounded-xl text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold block mb-1">الملاحظات والبيان:</span>
              <span>{selectedLiability.notes}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 4: Delete Liability Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="تأكيد حذف التزام الفاتورة"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              onClick={() => {
                if (selectedLiability) {
                  deleteMutation.mutate(selectedLiability.id);
                }
              }}
            >
              تأكيد الحذف
            </Button>
          </>
        }
      >
        <div className="space-y-3 font-sans">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span>
              هل أنت متأكد من حذف فاتورة شركة {selectedLiability?.companyName} ({selectedLiability?.invoiceNumber})؟
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
};
