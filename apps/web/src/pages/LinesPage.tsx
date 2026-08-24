import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column, Pagination } from '../components/ui/Table';
import { Badge, CompanyBadge, getStatusBadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ContextualSearchBar } from '../components/ui/ContextualSearchBar';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Phone,
  Plus,
  Search,
  Building2,
  User,
  History,
  Edit2,
  Clock,
  DollarSign,
  PackageCheck,
  Eye,
  CreditCard,
  Share2,
} from 'lucide-react';
import { LineStatus, PERMISSIONS, Money } from '@alkabeer/shared';
import { UnifiedPaymentModal } from '../components/finance/UnifiedPaymentModal';
import { CustomerStatementCard, CustomerStatementData } from '../components/finance/CustomerStatementCard';
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

export const LinesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Unified Payment & Statement State
  const [payingCustomerId, setPayingCustomerId] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [statementData, setStatementData] = useState<CustomerStatementData | null>(null);
  const [isStatementCardOpen, setIsStatementCardOpen] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);

  // Form states (Optimized for quick stock intake & bulk extraction)
  const [bulkNumbers, setBulkNumbers] = useState('');
  const [extractedCount, setExtractedCount] = useState<number>(0);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formMonthlyPkg, setFormMonthlyPkg] = useState<number>(0);
  const [formAdditionalPkg, setFormAdditionalPkg] = useState<number>(0);
  const [formPurchasePrice, setFormPurchasePrice] = useState<number>(0);
  const [formSalePrice, setFormSalePrice] = useState<number>(0);
  const [formRenewalDate, setFormRenewalDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPaymentDay, setFormPaymentDay] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<LineStatus>(LineStatus.IN_STOCK);
  const [formNotes, setFormNotes] = useState('');

  // 1. Fetch Telecom Companies
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiClient('/companies'),
  });

  // Fetch Telecom Packages for Auto-Fill
  const { data: packagesData } = useQuery({
    queryKey: ['telecom-packages-lookup'],
    queryFn: () => apiClient('/inventory/packages'),
  });

  // 2. Fetch Lines List with Instant Search & Status Filter
  const { data, isLoading } = useQuery<{ items: Line[]; meta: any; summary?: any }>({
    queryKey: ['lines', page, search, companyFilter, statusFilter],
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

  const lineList: Line[] = React.useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any).items)) return (data as any).items;
    return [];
  }, [data]);

  const lineMeta = React.useMemo(() => {
    if (!data) return { totalPages: 1, totalItems: 0 };
    if (Array.isArray(data)) {
      return { totalPages: 1, totalItems: data.length };
    }
    return (data as any).meta || { totalPages: 1, totalItems: lineList.length };
  }, [data, lineList]);

  // 3. Fetch Line Full Details & History
  const { data: lineDetails, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['line-details', selectedLine?.id],
    queryFn: () => apiClient(`/lines/${selectedLine?.id}`),
    enabled: !!selectedLine?.id && isHistoryModalOpen,
  });

  // Create Mutation (Single Stock Intake)
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/lines', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['in-stock-lines'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('تم تسجيل الخط وإيداعه بالمخزن بنجاح بحالة IN_STOCK');
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('فشل إضافة الخط للمخزن', err.message);
    },
  });

  // Bulk Create Mutation (Smart Bulk Intake)
  const bulkMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/lines/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['in-stock-lines'] });
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

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiClient(`/lines/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['line-details'] });
      toast.success('تم تحديث بيانات الخط وتوثيق التغيير في سجل الحركات');
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error('فشل تحديث الخط', err.message);
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
      toast.error('لم يتم العثور على أرقام صحيحة (10 أو 11 رقم)');
    }
  };

  // Package Selection & Auto-fill Handler
  const handlePackageSelection = (pkgId: string) => {
    setSelectedPackageId(pkgId);
    if (!pkgId) return;
    const selectedPkg = packagesData?.items?.find((p: any) => p.id === pkgId);
    if (selectedPkg) {
      setFormSalePrice(selectedPkg.sellingPrice || 0);
      setFormPurchasePrice(selectedPkg.costPrice || 0);
      setFormMonthlyPkg(selectedPkg.sellingPrice || 0);
      if (selectedPkg.companyId) {
        setFormCompanyId(selectedPkg.companyId);
      }
    }
  };

  const resetForm = () => {
    setBulkNumbers('');
    setExtractedCount(0);
    setSelectedPackageId('');
    setFormPhone('');
    setFormCompanyId(companies && companies.length > 0 ? companies[0].id : '');
    setFormMonthlyPkg(0);
    setFormAdditionalPkg(0);
    setFormPurchasePrice(0);
    setFormSalePrice(0);
    setFormRenewalDate(new Date().toISOString().split('T')[0]);
    setFormPaymentDay(1);
    setFormStatus(LineStatus.IN_STOCK);
    setFormNotes('');
  };

  const handleOpenEdit = (line: Line) => {
    setSelectedLine(line);
    setFormMonthlyPkg(line.monthlyPackage);
    setFormAdditionalPkg(line.additionalPackage);
    setFormPurchasePrice(line.purchasePrice);
    setFormSalePrice(line.salePrice);
    setFormPaymentDay(line.paymentDay);
    setFormStatus(line.status);
    setFormNotes(line.notes || '');
    setIsEditModalOpen(true);
  };

  const handleOpenHistory = (line: Line) => {
    setSelectedLine(line);
    setIsHistoryModalOpen(true);
  };

  const columns: Column<Line>[] = [
    {
      header: 'رقم الخط (Phone)',
      cell: (l) => (
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: l.company?.color || '#3b82f6' }}
            title={l.company?.name}
          />
          <span className="font-mono font-bold text-slate-900 text-sm dir-ltr inline-block">
            {l.phoneNumber}
          </span>
        </div>
      ),
    },
    {
      header: 'الشركة المزودة',
      cell: (l) => (
        <CompanyBadge
          companyNameOrCode={l.company?.name || l.company?.code}
          color={l.company?.color}
        />
      ),
    },
    {
      header: 'العميل الحالي',
      cell: (l) =>
        l.customer ? (
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{l.customer.name}</p>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              <span className="font-bold text-amber-700 dark:text-gold-400">{l.customer.customerCode}</span> • {l.customer.phone}
            </p>
          </div>
        ) : (
          <span className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md font-semibold border border-emerald-200 dark:border-emerald-800">
            متاح بالمخزن
          </span>
        ),
    },
    {
      header: 'الباقة الشهرية',
      cell: (l) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {Money.format(l.monthlyPackage)}
        </span>
      ),
    },
    {
      header: 'سعر البيع المطلوب',
      cell: (l) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {Money.format(l.salePrice)}
        </span>
      ),
    },
    {
      header: 'تاريخ التجديد',
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
          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-navy-950 px-2 py-0.5 rounded-md border border-slate-200 dark:border-navy-700 dir-ltr inline-block">
            {formatted}
          </span>
        );
      },
    },
    {
      header: 'الحالة بالمخزن',
      cell: (l) => (
        <Badge variant={getStatusBadgeVariant(l.status)}>{l.status}</Badge>
      ),
    },
    {
      header: 'الإجراءات',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (l) => {
        const custId = l.customerId || l.customer?.id;
        return (
          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {custId && hasPermission(PERMISSIONS.PAYMENTS_CREATE) && (
              <button
                onClick={() => {
                  setPayingCustomerId(custId);
                  setIsPaymentModalOpen(true);
                }}
                title="سداد مالي للعميل المرتبط بالخط"
                className="px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-500 text-navy-950 font-extrabold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>سداد</span>
              </button>
            )}

            <button
              onClick={() => handleOpenHistory(l)}
              title="عرض سجل الحركات والتاريخ"
              aria-label="عرض سجل الحركات والتاريخ"
              className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
            >
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>

            {hasPermission(PERMISSIONS.LINES_EDIT) && (
              <button
                onClick={() => handleOpenEdit(l)}
                title="تعديل أسعار وبيانات الخط"
                aria-label="تعديل أسعار وبيانات الخط"
                className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
              >
                <Edit2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Icon3D name="lines" size="lg" />
            <span>سجل وإدارة خطوط الـ VIP 📱</span>
          </h1>
          <p className="text-xs font-sans text-slate-700 dark:text-slate-400 mt-1 font-bold">
            إدخال الخطوط للمخزن، تحديد أسعار البيع والتكلفة، وتتبع تاريخ ملكية كل رقم
          </p>
        </div>

        {hasPermission(PERMISSIONS.LINES_CREATE) && (
          <Button
            variant="gold"
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            leftIcon={<Icon3D name="plus" size="xs" />}
          >
            إضافة خط للمخزن
          </Button>
        )}
      </div>

      {/* Contextual Smart Search & Quick Filter Pills Bar */}
      <div className="space-y-2 font-sans">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
          {[
            { label: 'الكل', status: '', searchVal: '' },
            { label: 'متاح بالمخزن', status: 'IN_STOCK', searchVal: '' },
            { label: 'مباع ومخصص', status: 'SOLD', searchVal: '' },
            { label: 'محجوز', status: 'RESERVED', searchVal: '' },
            { label: 'موقوف مؤقتاً', status: 'SUSPENDED', searchVal: '' },
            { label: 'مميز VIP', status: '', searchVal: 'VIP' },
          ].map((pill) => {
            const isActive = pill.searchVal
              ? search === pill.searchVal
              : statusFilter === pill.status && !search;
            return (
              <button
                key={pill.label}
                onClick={() => {
                  setStatusFilter(pill.status);
                  if (pill.searchVal) {
                    setSearch(pill.searchVal);
                  } else if (search === 'VIP') {
                    setSearch('');
                  }
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
          placeholder="بحث فوري برقم الخط، اسم العميل، الشريحة، أو الملاحظات..."
          filteredCount={lineList.length}
          totalCount={lineMeta.totalItems}
          autoFocus
          filterSlots={
            <div className="flex flex-wrap md:flex-nowrap items-center gap-2.5">
              <div className="w-40">
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
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-40">
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">جميع الحالات</option>
                  <option value={LineStatus.IN_STOCK}>بالمخزن (IN_STOCK)</option>
                  <option value={LineStatus.SOLD}>مباع (SOLD)</option>
                  <option value={LineStatus.RESERVED}>محجوز (RESERVED)</option>
                  <option value={LineStatus.SUSPENDED}>موقوف (SUSPENDED)</option>
                  <option value={LineStatus.CANCELLED}>ملغى (CANCELLED)</option>
                </Select>
              </div>
            </div>
          }
        />
      </div>

      {/* Data Table */}
      <Table
        columns={columns}
        data={lineList}
        isLoading={isLoading}
        emptyMessage="لم يتم العثور على خطوط مطابقة. يمكنك إضافة خط جديد للمخزن عبر زر [إضافة خط للمخزن]."
        onRowClick={(l) => handleOpenHistory(l)}
      />

      <Pagination
        page={page}
        totalPages={lineMeta.totalPages}
        totalItems={lineMeta.totalItems}
        onPageChange={(p) => setPage(p)}
      />

      {/* 1. Modal: Quick Add Line to Stock */}
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
                // Parse and extract numbers
                const rawText = bulkNumbers || formPhone;
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
          {/* 1. إدخال الأرقام بكثافة مع زر الاستخلاص */}
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
              onChange={(e) => {
                setFormCompanyId(e.target.value);
                const comp = companies?.find((c: any) => c.id === e.target.value);
                if (comp && comp.paymentDay) {
                  setFormPaymentDay(comp.paymentDay);
                }
              }}
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

          {/* 3. اختيار الباقة وتاريخ التجديد (بدون باقة إضافية) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="اختر باقة الخط المسجلة *"
              value={selectedPackageId}
              onChange={(e) => handlePackageSelection(e.target.value)}
            >
              <option value="">اختر الباقة لتعبئة الأسعار تلقائياً...</option>
              {packagesData?.items?.map((pkg: any) => (
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

      {/* 2. Modal: Edit Line */}
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
              isLoading={updateMutation.isPending}
              onClick={() => {
                if (!selectedLine) return;
                updateMutation.mutate({
                  id: selectedLine.id,
                  payload: {
                    monthlyPackage: Number(formMonthlyPkg) || 0,
                    additionalPackage: Number(formAdditionalPkg) || 0,
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="الباقة الشهرية (ج.م)"
              type="number"
              value={formMonthlyPkg}
              onChange={(e) => setFormMonthlyPkg(parseInt(e.target.value, 10) || 0)}
            />
            <Input
              label="باقة إضافية (ج.م)"
              type="number"
              value={formAdditionalPkg}
              onChange={(e) => setFormAdditionalPkg(parseInt(e.target.value, 10) || 0)}
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
            label="حالة الخط بالمخزن"
            value={formStatus}
            onChange={(e) => setFormStatus(e.target.value as LineStatus)}
          >
            <option value={LineStatus.IN_STOCK}>بالمخزن (IN_STOCK)</option>
            <option value={LineStatus.SOLD}>مباع (SOLD)</option>
            <option value={LineStatus.ACTIVE}>نشط (ACTIVE)</option>
            <option value={LineStatus.RESERVED}>محجوز (RESERVED)</option>
            <option value={LineStatus.SUSPENDED}>موقوف (SUSPENDED)</option>
            <option value={LineStatus.CANCELLED}>ملغي (CANCELLED)</option>
          </Select>
          <Textarea
            label="ملاحظات"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* 3. Modal: Line History Timeline */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        size="lg"
        title={`سجل تاريخ وتدقيق الخط: ${lineDetails?.phoneNumber || selectedLine?.phoneNumber}`}
        description={`الشركة المزودة: ${lineDetails?.company?.name || selectedLine?.company?.name}`}
      >
        {isHistoryLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            جاري تحميل سجل حركات الخط من الخادم...
          </div>
        ) : (
          <div className="space-y-6">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <span>المخطط الزمني لحالات وملكية الخط ({lineDetails?.lineHistory?.length || 0})</span>
            </h4>

            {lineDetails?.lineHistory?.length === 0 ? (
              <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-xl text-center">
                لا توجد حركات سابقة مسجلة على هذا الخط.
              </p>
            ) : (
              <div className="relative border-r-2 border-slate-200 mr-3 space-y-4">
                {lineDetails?.lineHistory?.map((h: any) => (
                  <div key={h.id} className="relative pr-6">
                    <div className="absolute -right-[7px] top-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{h.action}</span>
                        <span className="text-slate-400 font-mono">
                          {new Date(h.createdAt).toLocaleString('ar-EG')}
                        </span>
                      </div>
                      <p className="text-slate-600">
                        تغيرت الحالة من{' '}
                        <span className="font-semibold text-slate-800">{h.oldStatus}</span> إلى{' '}
                        <span className="font-semibold text-blue-600">{h.newStatus}</span>
                      </p>
                      {h.notes && <p className="text-slate-500 italic">"{h.notes}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Unified Payment & Settlement Modal */}
      <UnifiedPaymentModal
        customerId={payingCustomerId}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPayingCustomerId(null);
        }}
      />

      {/* Customer Statement Card Preview */}
      {statementData && (
        <CustomerStatementCard
          data={statementData}
          isOpen={isStatementCardOpen}
          onClose={() => {
            setIsStatementCardOpen(false);
            setStatementData(null);
          }}
        />
      )}
    </div>
  );
};
