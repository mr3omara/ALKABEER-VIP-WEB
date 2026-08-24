import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column, Pagination } from '../components/ui/Table';
import { Badge, CompanyBadge, getStatusBadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Package,
  Plus,
  SlidersHorizontal,
  Search,
  X,
  Phone,
  Building2,
  TrendingUp,
  Boxes,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  History,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { LineStatus, PERMISSIONS, Money, InventoryMovementType } from '@alkabeer/shared';
import { UnifiedPaymentModal } from '../components/finance/UnifiedPaymentModal';
import { Icon3D } from '../components/icons3d';

interface Line {
  id: string;
  phoneNumber: string;
  companyId: string;
  customerId?: string;
  monthlyPackage: number;
  additionalPackage: number;
  paymentDay: number;
  renewalDate?: string | null;
  activationDate?: string | null;
  purchasePrice: number;
  salePrice: number;
  status: LineStatus;
  notes?: string;
  createdAt: string;
  company?: { id: string; name: string; code: string; color?: string };
  customer?: { id: string; name: string; phone: string; customerCode: string };
}

interface LinesResponse {
  items: Line[];
  summary?: {
    totalLines: number;
    inStockLines: number;
    reservedLines: number;
    soldLines: number;
    totalCost: number;
    totalSelling: number;
    expectedProfit: number;
  };
  meta: any;
}

export const InventoryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  // Filters state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingCustomerId, setPayingCustomerId] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);

  // Stock Intake Form States (with Smart Bulk Extraction)
  const [bulkNumbers, setBulkNumbers] = useState('');
  const [extractedCount, setExtractedCount] = useState<number>(0);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formPurchasePrice, setFormPurchasePrice] = useState<number>(0);
  const [formSalePrice, setFormSalePrice] = useState<number>(0);
  const [formMonthlyPkg, setFormMonthlyPkg] = useState<number>(0);
  const [formRenewalDate, setFormRenewalDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPaymentDay, setFormPaymentDay] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<LineStatus>(LineStatus.IN_STOCK);
  const [formNotes, setFormNotes] = useState('');

  // 1. Fetch Companies
  const { data: companies } = useQuery({
    queryKey: ['companies-lookup-inventory'],
    queryFn: () => apiClient('/companies'),
  });

  // 2. Fetch Packages for Autofill
  const { data: packagesData } = useQuery({
    queryKey: ['packages-lookup-inventory'],
    queryFn: async () => {
      try {
        return await apiClient('/packages');
      } catch {
        return await apiClient('/inventory/packages');
      }
    },
  });

  // 3. Fetch Lines with KPIs
  const { data, isLoading, refetch } = useQuery<LinesResponse>({
    queryKey: ['inventory-lines', page, search, companyFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (search.trim()) params.set('search', search.trim());
      if (companyFilter.trim()) params.set('companyId', companyFilter.trim());
      if (statusFilter.trim()) params.set('status', statusFilter.trim());
      return apiClient(`/lines?${params.toString()}`);
    },
  });

  const inventoryList: Line[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any).items)) return (data as any).items;
    return [];
  }, [data]);

  const inventoryMeta = useMemo(() => {
    if (!data) return { totalPages: 1, totalItems: 0 };
    if (Array.isArray(data)) {
      return { totalPages: 1, totalItems: data.length };
    }
    return (data as any).meta || { totalPages: 1, totalItems: inventoryList.length };
  }, [data, inventoryList]);

  // 4. Fetch Selected Line Details & History
  const { data: lineDetails, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['inventory-line-details', selectedLine?.id],
    queryFn: () => apiClient(`/lines/${selectedLine?.id}`),
    enabled: !!selectedLine?.id && isHistoryModalOpen,
  });

  // Single Intake Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/lines', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lines'] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('تم تسجيل الخط وإيداعه بالمخزن بنجاح بحالة IN_STOCK');
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('فشل إضافة الخط للمخزن', err.message);
    },
  });

  // Bulk Intake Mutation
  const bulkMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/lines/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lines'] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success(
        `تم إيداع ${res.createdCount} خط بالمخزن بنجاح ${
          res.skippedCount > 0 ? `(تم تخطي ${res.skippedCount} مكرر مسبقاً)` : ''
        }`,
      );
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('فشل إيداع الخطوط بالمخزن', err.message);
    },
  });

  // Edit Line Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiClient(`/lines/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lines'] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-line-details'] });
      toast.success('تم تحديث بيانات الخط بنجاح');
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error('فشل تحديث الخط', err.message);
    },
  });

  // Delete Line Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/lines/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lines'] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      toast.success('تم حذف الخط بنجاح');
      setIsDeleteModalOpen(false);
      setSelectedLine(null);
    },
    onError: (err: any) => {
      toast.error('لا يمكن حذف الخط', err.message);
      setIsDeleteModalOpen(false);
    },
  });

  // Smart Extraction Logic
  const extractAndValidateNumbers = () => {
    const rawText = bulkNumbers;
    const lines = rawText.split(/[\n,; ]+/);
    const validNumbers: string[] = [];

    lines.forEach((line) => {
      let cleaned = line.replace(/\D/g, '');
      if (cleaned.length === 10) {
        cleaned = '0' + cleaned;
        validNumbers.push(cleaned);
      } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
        validNumbers.push(cleaned);
      }
    });

    const uniqueNumbers = Array.from(new Set(validNumbers));
    setBulkNumbers(uniqueNumbers.join('\n'));
    setExtractedCount(uniqueNumbers.length);
    if (uniqueNumbers.length > 0) {
      toast.success(`تم رصد وتصحيح: ${uniqueNumbers.length} رقم صحيح`);
    } else {
      toast.error('لم يتم العثور على أرقام هواتف صالحة (10 أو 11 رقم)');
    }
  };

  // Package Autofill Handler
  const handlePackageSelection = (pkgId: string) => {
    setSelectedPackageId(pkgId);
    if (!pkgId) return;
    const items = packagesData?.items || packagesData || [];
    const selectedPkg = Array.isArray(items) ? items.find((p: any) => p.id === pkgId) : null;
    if (selectedPkg) {
      setFormSalePrice(selectedPkg.sellingPrice || 0);
      setFormPurchasePrice(selectedPkg.costPrice || 0);
      setFormMonthlyPkg(selectedPkg.sellingPrice || 0);
      if (selectedPkg.companyId) {
        setFormCompanyId(selectedPkg.companyId);
      }
    }
  };

  // Company Selection & Auto Renewal Binding Handler
  const handleCompanySelection = (companyId: string) => {
    setFormCompanyId(companyId);
    if (!companyId) return;
    const comp = companies?.find((c: any) => c.id === companyId);
    if (comp) {
      if (comp.renewalDate) {
        setFormRenewalDate(new Date(comp.renewalDate).toISOString().split('T')[0]);
      } else if (comp.paymentDay) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(Math.min(28, comp.paymentDay)).padStart(2, '0');
        setFormRenewalDate(`${year}-${month}-${day}`);
      }
    }
  };

  const resetForm = () => {
    setBulkNumbers('');
    setExtractedCount(0);
    setSelectedPackageId('');
    setFormCompanyId(companies && companies.length > 0 ? companies[0].id : '');
    setFormPurchasePrice(0);
    setFormSalePrice(0);
    setFormMonthlyPkg(0);
    setFormRenewalDate(new Date().toISOString().split('T')[0]);
    setFormPaymentDay(1);
    setFormStatus(LineStatus.IN_STOCK);
    setFormNotes('');
  };

  const handleOpenEdit = (line: Line) => {
    setSelectedLine(line);
    setFormMonthlyPkg(line.monthlyPackage || 0);
    setFormPurchasePrice(line.purchasePrice || 0);
    setFormSalePrice(line.salePrice || 0);
    setFormPaymentDay(line.paymentDay || 1);
    setFormStatus(line.status);
    setFormNotes(line.notes || '');
    setIsEditModalOpen(true);
  };

  // 7 KPI Calculations
  const totalLines = data?.summary?.totalLines ?? data?.meta?.totalItems ?? 0;
  const inStockLines = data?.summary?.inStockLines ?? 0;
  const reservedLines = data?.summary?.reservedLines ?? 0;
  const soldLines = data?.summary?.soldLines ?? 0;
  const totalCost = data?.summary?.totalCost ?? 0;
  const totalSelling = data?.summary?.totalSelling ?? 0;
  const expectedProfit = data?.summary?.expectedProfit ?? (totalSelling - totalCost);

  // Table Columns (10 Columns)
  const columns: Column<Line>[] = [
    {
      header: 'رقم الهاتف',
      cell: (l) => (
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: l.company?.color || '#3b82f6' }}
            title={l.company?.name}
          />
          <span className="font-mono font-extrabold text-navy-900 dark:text-slate-100 text-sm dir-ltr inline-block">
            {l.phoneNumber}
          </span>
        </div>
      ),
    },
    {
      header: 'الشركة',
      cell: (l) => (
        <CompanyBadge
          companyNameOrCode={l.company?.name || l.company?.code}
          color={l.company?.color}
        />
      ),
    },
    {
      header: 'اسم الباقة',
      cell: (l) => (
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          {l.monthlyPackage > 0 ? `باقة ${l.monthlyPackage} ج.م` : 'باقة قياسية'}
        </span>
      ),
    },
    {
      header: 'سعر الشراء',
      cell: (l) => (
        <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400">
          {Money.format(l.purchasePrice || 0)}
        </span>
      ),
    },
    {
      header: 'سعر البيع الشهري',
      cell: (l) => (
        <span className="font-mono text-xs font-extrabold text-navy-900 dark:text-slate-100">
          {Money.format(l.salePrice || l.monthlyPackage || 0)}
        </span>
      ),
    },
    {
      header: 'تاريخ التشغيل',
      cell: (l) => {
        let formatted = '—';
        const d = l.activationDate || l.createdAt;
        if (d) {
          const dateObj = new Date(d);
          if (!isNaN(dateObj.getTime())) {
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            formatted = `${day}/${month}/${year}`;
          }
        }
        return (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-300 dir-ltr inline-block">
            {formatted}
          </span>
        );
      },
    },
    {
      header: 'تاريخ التجديد الحاكم',
      cell: (l) => {
        let formatted = '—';
        if (l.renewalDate) {
          const dateObj = new Date(l.renewalDate);
          if (!isNaN(dateObj.getTime())) {
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            formatted = `${day}/${month}/${year}`;
          }
        } else if (l.paymentDay) {
          formatted = `يوم ${l.paymentDay} شهرياً`;
        }

        return (
          <span className="font-mono text-xs font-bold text-amber-700 dark:text-gold-400 bg-amber-50 dark:bg-navy-950 px-2 py-0.5 rounded-md border border-amber-200 dark:border-navy-700 dir-ltr inline-block">
            {formatted}
          </span>
        );
      },
    },
    {
      header: 'الحالة',
      cell: (l) => (
        <Badge variant={getStatusBadgeVariant(l.status)}>
          {l.status === LineStatus.IN_STOCK
            ? 'المخزن'
            : l.status === LineStatus.ACTIVE
            ? 'نشط'
            : l.status === LineStatus.SOLD
            ? 'مسكن'
            : l.status === LineStatus.RESERVED
            ? 'محجوز'
            : l.status === LineStatus.SUSPENDED
            ? 'معلق'
            : l.status}
        </Badge>
      ),
    },
    {
      header: 'ملاحظات',
      cell: (l) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs block">
          {l.notes || '—'}
        </span>
      ),
    },
    {
      header: 'الإجراءات',
      cell: (l) => {
        const custId = l.customerId || l.customer?.id;
        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {custId && hasPermission(PERMISSIONS.PAYMENTS_CREATE) && (
              <button
                type="button"
                onClick={() => {
                  setPayingCustomerId(custId);
                  setIsPaymentModalOpen(true);
                }}
                title="سداد مالي للعميل المرتبط"
                className="px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-500 text-navy-950 font-extrabold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <Icon3D name="payments" size="xs" />
                <span>سداد</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedLine(l);
                setIsHistoryModalOpen(true);
              }}
              className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-slate-700 dark:text-slate-300 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
              title="سجل الحركات"
            >
              <History className="w-3.5 h-3.5" />
            </button>
            {hasPermission(PERMISSIONS.LINES_EDIT) && (
              <button
                type="button"
                onClick={() => handleOpenEdit(l)}
                className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-amber-600 dark:text-amber-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
                title="تعديل"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {hasPermission(PERMISSIONS.LINES_DELETE) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedLine(l);
                  setIsDeleteModalOpen(true);
                }}
                className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-rose-600 dark:text-rose-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
                title="حذف"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 font-sans text-navy-900 dark:text-slate-100 pb-12">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-kufi font-extrabold text-navy-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Icon3D name="inventory" size="lg" />
            <span>المخزن والخطوط (Inventory Stock) 📦</span>
          </h1>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
            إدارة خطوط المخزن، الجرد اللحظي، والتوريد والإيداع مع الاستخلاص الذكي
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            title="تحديث البيانات"
          >
            تحديث
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsAdvancedFiltersOpen((prev) => !prev)}
            leftIcon={<Icon3D name="filter" size="xs" />}
          >
            فلترة متقدمة
          </Button>

          {hasPermission(PERMISSIONS.LINES_CREATE) && (
            <Button
              variant="gold"
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              leftIcon={<Icon3D name="plus" size="xs" />}
            >
              + إضافة خط للمخزن
            </Button>
          )}
        </div>
      </div>

      {/* 2. 7 Top KPI Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="bg-ivory-50 dark:bg-navy-850 p-3.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
            إجمالي الخطوط
          </span>
          <p className="text-xl font-extrabold text-navy-900 dark:text-slate-100 font-mono">
            {totalLines}
          </p>
        </div>

        <div className="bg-ivory-50 dark:bg-navy-850 p-3.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
            الخطوط المتاحة
          </span>
          <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
            {inStockLines}
          </p>
        </div>

        <div className="bg-ivory-50 dark:bg-navy-850 p-3.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
            الخطوط المحجوزة
          </span>
          <p className="text-xl font-extrabold text-amber-700 dark:text-amber-400 font-mono">
            {reservedLines}
          </p>
        </div>

        <div className="bg-ivory-50 dark:bg-navy-850 p-3.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
            الخطوط المباعة
          </span>
          <p className="text-xl font-extrabold text-cyan-700 dark:text-cyan-400 font-mono">
            {soldLines}
          </p>
        </div>

        <div className="bg-ivory-50 dark:bg-navy-850 p-3.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
            قيمة التكلفة
          </span>
          <p className="text-lg font-extrabold text-rose-700 dark:text-rose-400 font-mono truncate" title={`${totalCost} ج.م`}>
            {Money.format(totalCost)}
          </p>
        </div>

        <div className="bg-ivory-50 dark:bg-navy-850 p-3.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
            قيمة البيع
          </span>
          <p className="text-lg font-extrabold text-navy-900 dark:text-slate-100 font-mono truncate" title={`${totalSelling} ج.م`}>
            {Money.format(totalSelling)}
          </p>
        </div>

        <div className="bg-ivory-50 dark:bg-navy-850 p-3.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
            الربح المتوقع
          </span>
          <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 font-mono truncate" title={`${expectedProfit} ج.م`}>
            +{Money.format(expectedProfit)}
          </p>
        </div>
      </div>

      {/* 3. Quick Status Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
        {[
          { label: 'الكل', status: '' },
          { label: 'المخزن', status: LineStatus.IN_STOCK },
          { label: 'نشط', status: LineStatus.ACTIVE },
          { label: 'مسكن', status: LineStatus.SOLD },
          { label: 'معلق', status: LineStatus.SUSPENDED },
          { label: 'محجوز', status: LineStatus.RESERVED },
        ].map((pill) => {
          const isActive = statusFilter === pill.status;
          return (
            <button
              key={pill.label}
              type="button"
              onClick={() => {
                setStatusFilter(pill.status);
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

      {/* 4. Search & Advanced Filter Controls */}
      <div className="space-y-3">
        <div className="bg-ivory-50 dark:bg-navy-850 p-4 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full flex items-center">
            <Search className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400 absolute right-3.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="بحث سريع في السجلات..."
              className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-sm text-navy-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 transition-all font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-3 p-1 text-slate-400 hover:text-navy-900 dark:hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="w-48">
              <Select
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">جميع الشركات</option>
                {companies?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </div>

            <div className="px-3 py-1.5 bg-ivory-200/80 dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-xs font-bold text-navy-900 dark:text-slate-200 whitespace-nowrap">
              عرض <span className="font-extrabold text-gold-700 dark:text-gold-400">{inventoryList.length}</span> من أصل <span className="font-extrabold">{totalLines}</span> خط
            </div>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {isAdvancedFiltersOpen && (
          <div className="bg-ivory-100 dark:bg-navy-900 p-4 rounded-2xl border border-ivory-300 dark:border-navy-750 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="تصفية حسب الشركة"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="">جميع الشركات</option>
              {companies?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </Select>

            <Select
              label="تصفية حسب الحالة"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">جميع الحالات</option>
              <option value={LineStatus.IN_STOCK}>متاح بالمخزن (IN_STOCK)</option>
              <option value={LineStatus.ACTIVE}>نشط (ACTIVE)</option>
              <option value={LineStatus.SOLD}>مسكن (SOLD)</option>
              <option value={LineStatus.RESERVED}>محجوز (RESERVED)</option>
              <option value={LineStatus.SUSPENDED}>معلق (SUSPENDED)</option>
            </Select>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setCompanyFilter('');
                  setStatusFilter('');
                  setSearch('');
                  setPage(1);
                }}
                className="w-full text-xs"
              >
                إعادة ضبط الفلاتر
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 5. 10-Column Data Table */}
      <Table
        data={inventoryList}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="لا توجد خطوط مسجلة في المخزن تطابق معايير البحث"
      />

      <Pagination
        page={page}
        totalPages={inventoryMeta.totalPages}
        totalItems={totalLines}
        onPageChange={(p) => setPage(p)}
      />

      {/* 6. Smart Stock Intake Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="lg"
        title="إضافة خطوط جديدة للمخزن (Stock Intake)"
        description="تسجيل الأرقام بالحركة المخزنية الرسمية مع الاستخلاص الذكي"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="gold"
              isLoading={createMutation.isPending || bulkMutation.isPending}
              onClick={() => {
                const rawText = bulkNumbers;
                const lines = rawText.split(/[\n,; ]+/);
                const validNumbers: string[] = [];

                lines.forEach((line) => {
                  let cleaned = line.replace(/\D/g, '');
                  if (cleaned.length === 10) {
                    cleaned = '0' + cleaned;
                    validNumbers.push(cleaned);
                  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
                    validNumbers.push(cleaned);
                  }
                });

                const uniqueNumbers = Array.from(new Set(validNumbers));

                if (uniqueNumbers.length === 0) {
                  toast.error('يرجى إدخال أرقام الهواتف المحمولة أولاً');
                  return;
                }
                if (!formCompanyId) {
                  toast.error('يرجى اختيار شركة الاتصالات المزودة');
                  return;
                }

                if (uniqueNumbers.length === 1) {
                  createMutation.mutate({
                    phoneNumber: uniqueNumbers[0],
                    companyId: formCompanyId,
                    monthlyPackage: Number(formMonthlyPkg) || Number(formSalePrice) || 0,
                    additionalPackage: 0,
                    renewalDate: formRenewalDate,
                    purchasePrice: Number(formPurchasePrice) || 0,
                    salePrice: Number(formSalePrice) || 0,
                    notes: formNotes.trim() || undefined,
                  });
                } else {
                  bulkMutation.mutate({
                    phoneNumbers: uniqueNumbers,
                    companyId: formCompanyId,
                    monthlyPackage: Number(formMonthlyPkg) || Number(formSalePrice) || 0,
                    renewalDate: formRenewalDate,
                    purchasePrice: Number(formPurchasePrice) || 0,
                    salePrice: Number(formSalePrice) || 0,
                    notes: formNotes.trim() || undefined,
                  });
                }
              }}
            >
              إيداع بالمخزن
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          {/* 1. مساحة إدخال الأرقام بكثافة مع زر الاستخلاص */}
          <div className="p-3.5 bg-ivory-100 dark:bg-navy-900 rounded-xl border border-ivory-300 dark:border-navy-750 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-navy-900 dark:text-slate-100 tracking-tight">
                أرقام الهواتف المحمولة (يمكن لصق قائمة أرقام) <span className="text-rose-500 mr-1">*</span>
              </label>
              <span className="text-[11px] font-mono font-extrabold text-amber-700 dark:text-gold-400 bg-amber-50 dark:bg-navy-950 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-navy-700">
                تم رصد: {extractedCount || 0} رقم صحيح
              </span>
            </div>

            <Textarea
              rows={4}
              placeholder="الصق الأرقام هنا (كل رقم في سطر، أو مفصولة بمسافات أو فواصل)..."
              value={bulkNumbers}
              onChange={(e) => {
                setBulkNumbers(e.target.value);
                const count = e.target.value.split(/[\n,; ]+/).filter((x) => x.replace(/\D/g, '').length >= 10).length;
                setExtractedCount(count);
              }}
              required
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={extractAndValidateNumbers}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-navy-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>🔍 استخلاص وتصحيح الأرقام تلقائياً</span>
              </button>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                (يتم تحويل الأرقام 10 خانات إلى 11 بإضافة الصفر تلقائياً)
              </span>
            </div>
          </div>

          {/* 2. اختيار الشركة المزودة والأسعار */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              label="شركة الاتصالات المزودة *"
              value={formCompanyId}
              onChange={(e) => handleCompanySelection(e.target.value)}
              required
            >
              <option value="">اختر الشركة...</option>
              {companies?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name} {c.paymentDay ? `(تجديد يوم ${c.paymentDay})` : ''}
                </option>
              ))}
            </Select>

            <Input
              label="سعر التكلفة / الشراء (ج.م)"
              type="number"
              min="0"
              placeholder="0"
              value={formPurchasePrice || ''}
              onChange={(e) => setFormPurchasePrice(parseInt(e.target.value, 10) || 0)}
            />

            <Input
              label="سعر البيع المقترح (ج.م)"
              type="number"
              min="0"
              placeholder="0"
              value={formSalePrice || ''}
              onChange={(e) => setFormSalePrice(parseInt(e.target.value, 10) || 0)}
            />
          </div>

          {/* 3. اختيار الباقة وتاريخ التجديد */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="اختر باقة الخط المسجلة *"
              value={selectedPackageId}
              onChange={(e) => handlePackageSelection(e.target.value)}
            >
              <option value="">اختر الباقة لتعبئة الأسعار تلقائياً...</option>
              {(packagesData?.items || packagesData || []).map((pkg: any) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.companyCode}) — اشتراك: {pkg.sellingPrice} ج.م
                </option>
              ))}
            </Select>

            <Input
              label="تاريخ التجديد *"
              type="date"
              value={formRenewalDate}
              onChange={(e) => setFormRenewalDate(e.target.value)}
              required
            />
          </div>

          {/* 4. ملاحظات الخط */}
          <Textarea
            label="ملاحظات الخط"
            rows={2}
            placeholder="ملاحظات العرض، أرقام مميزة، شروط الباقة..."
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* 7. Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`تعديل بيانات الخط: ${selectedLine?.phoneNumber}`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="gold"
              isLoading={updateMutation.isPending}
              onClick={() => {
                if (!selectedLine) return;
                updateMutation.mutate({
                  id: selectedLine.id,
                  payload: {
                    monthlyPackage: Number(formMonthlyPkg) || 0,
                    purchasePrice: Number(formPurchasePrice) || 0,
                    salePrice: Number(formSalePrice) || 0,
                    paymentDay: Number(formPaymentDay) || 1,
                    status: formStatus,
                    notes: formNotes.trim() || undefined,
                  },
                });
              }}
            >
              حفظ التعديلات
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="الباقة الشهرية (ج.م)"
              type="number"
              value={formMonthlyPkg}
              onChange={(e) => setFormMonthlyPkg(parseInt(e.target.value, 10) || 0)}
            />
            <Input
              label="يوم الاستحقاق الشهري (1 - 31)"
              type="number"
              min="1"
              max="31"
              value={formPaymentDay}
              onChange={(e) => setFormPaymentDay(parseInt(e.target.value, 10) || 1)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="سعر التكلفة (ج.م)"
              type="number"
              value={formPurchasePrice}
              onChange={(e) => setFormPurchasePrice(parseInt(e.target.value, 10) || 0)}
            />
            <Input
              label="سعر البيع (ج.م)"
              type="number"
              value={formSalePrice}
              onChange={(e) => setFormSalePrice(parseInt(e.target.value, 10) || 0)}
            />
          </div>

          <Select
            label="حالة الخط"
            value={formStatus}
            onChange={(e) => setFormStatus(e.target.value as LineStatus)}
          >
            <option value={LineStatus.IN_STOCK}>متاح بالمخزن (IN_STOCK)</option>
            <option value={LineStatus.ACTIVE}>نشط (ACTIVE)</option>
            <option value={LineStatus.SOLD}>مسكن (SOLD)</option>
            <option value={LineStatus.RESERVED}>محجوز (RESERVED)</option>
            <option value={LineStatus.SUSPENDED}>معلق (SUSPENDED)</option>
            <option value={LineStatus.CANCELLED}>ملغي (CANCELLED)</option>
          </Select>

          <Textarea
            label="ملاحظات الخط"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* 8. History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`سجل حركات الخط: ${selectedLine?.phoneNumber}`}
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>
            إغلاق
          </Button>
        }
      >
        <div className="space-y-3 font-sans max-h-96 overflow-y-auto">
          {isHistoryLoading ? (
            <p className="text-xs text-slate-500 p-4 text-center">جاري تحميل سجل الحركات...</p>
          ) : lineDetails?.lineHistory?.length === 0 ? (
            <p className="text-xs text-slate-500 p-4 text-center">لا توجد حركات مسجلة لهذا الخط حتى الآن.</p>
          ) : (
            <div className="divide-y divide-ivory-200 dark:divide-navy-800 border border-ivory-300 dark:border-navy-750 rounded-xl overflow-hidden">
              {lineDetails?.lineHistory?.map((h: any) => (
                <div key={h.id} className="p-3 bg-white dark:bg-navy-950 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-navy-900 dark:text-slate-100 block">
                      {h.action}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {h.notes || h.referenceType}
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="font-mono text-[11px] text-slate-400 block">
                      {new Date(h.createdAt).toLocaleString('ar-EG')}
                    </span>
                    <Badge variant={getStatusBadgeVariant(h.newStatus)}>{h.newStatus}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 9. Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="تأكيد حذف الخط"
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
                if (selectedLine) {
                  deleteMutation.mutate(selectedLine.id);
                }
              }}
            >
              تأكيد الحذف
            </Button>
          </>
        }
      >
        <div className="space-y-3 font-sans">
          <p className="text-xs text-slate-700 dark:text-slate-300">
            هل أنت متأكد من حذف الخط <strong className="font-bold text-navy-900 dark:text-slate-100">{selectedLine?.phoneNumber}</strong> من المخزن؟
          </p>
        </div>
      </Modal>

      {/* Unified Payment Modal */}
      <UnifiedPaymentModal
        customerId={payingCustomerId}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPayingCustomerId(null);
        }}
      />
    </div>
  );
};

export default InventoryPage;
