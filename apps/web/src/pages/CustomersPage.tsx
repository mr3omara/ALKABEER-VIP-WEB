import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column, Pagination } from '../components/ui/Table';
import { Badge, getStatusBadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ContextualSearchBar } from '../components/ui/ContextualSearchBar';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Edit2,
  Trash2,
  Eye,
  FileText,
  CreditCard,
  Building2,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Receipt,
  Plus,
  Share2,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown,
  Layers,
  Calendar,
  AlertCircle,
  Copy,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ChevronDown,
  X,
  History,
  Activity,
  Landmark,
} from 'lucide-react';
import { CustomerStatus, PERMISSIONS, Money, PaymentMethod, MonthlyChargeStatus } from '@alkabeer/shared';
import { UnifiedPaymentModal } from '../components/finance/UnifiedPaymentModal';
import { CustomerStatementCard } from '../components/finance/CustomerStatementCard';
import { Icon3D } from '../components/icons3d';

interface Customer {
  id: string;
  customerCode: string;
  name: string;
  shortName?: string;
  fullName?: string;
  phone: string;
  contactNumber?: string;
  motherGrandpaName?: string;
  nationalId?: string;
  address?: string;
  joinDate?: string;
  notes?: string;
  status: CustomerStatus;
  createdAt: string;
  _count?: {
    lines: number;
    sales: number;
    payments: number;
    monthlyCharges: number;
  };
}

export const CustomersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  // Page state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [payingCustomerId, setPayingCustomerId] = useState<string | null>(null);
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState('');

  // Sub-ledger tabs
  const [activeTab, setActiveTab] = useState<
    'lines' | 'previous_lines' | 'timeline' | 'sales' | 'payments' | 'debts'
  >('lines');
  const [tabFilterSearch, setTabFilterSearch] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExtraChargeModalOpen, setIsExtraChargeModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isStatementCardModalOpen, setIsStatementCardModalOpen] = useState(false);

  // Form states (Create / Edit)
  const [formShortName, setFormShortName] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formContactNumber, setFormContactNumber] = useState('');
  const [formMotherGrandpaName, setFormMotherGrandpaName] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formJoinDate, setFormJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<CustomerStatus>(CustomerStatus.ACTIVE);

  // Form states (Payment FIFO)
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentTreasuryId, setPaymentTreasuryId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Form states (Extra Charge)
  const [chargeLineId, setChargeLineId] = useState('');
  const [chargeMonth, setChargeMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [chargeNotes, setChargeNotes] = useState('');

  // 1. Fetch Customers List
  const { data: customersData, isLoading: isCustomersLoading } = useQuery<{
    items: Customer[];
    meta: any;
  }>({
    queryKey: ['customers', page, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter.trim()) params.set('status', statusFilter.trim());
      return apiClient(`/customers?${params.toString()}`);
    },
  });

  // 2. Fetch All Active Customers for Top Selector
  const { data: selectorCustomers } = useQuery({
    queryKey: ['customers-selector-list', selectorSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (selectorSearch.trim()) params.set('search', selectorSearch.trim());
      return apiClient(`/customers?${params.toString()}`);
    },
  });

  const customerList: Customer[] = useMemo(() => {
    if (!customersData) return [];
    if (Array.isArray(customersData)) return customersData;
    if (Array.isArray((customersData as any).items)) return (customersData as any).items;
    return [];
  }, [customersData]);

  const customerMeta = useMemo(() => {
    if (!customersData) return { totalPages: 1, totalItems: 0 };
    if (Array.isArray(customersData)) {
      return { totalPages: 1, totalItems: customersData.length };
    }
    return (customersData as any).meta || { totalPages: 1, totalItems: customerList.length };
  }, [customersData, customerList]);

  const selectorList: Customer[] = useMemo(() => {
    if (!selectorCustomers) return [];
    if (Array.isArray(selectorCustomers)) return selectorCustomers;
    if (Array.isArray((selectorCustomers as any).items)) return (selectorCustomers as any).items;
    return [];
  }, [selectorCustomers]);

  // 3. Fetch Selected Customer Comprehensive 360° Data
  const { data: customerDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['customer-360-details', selectedCustomerId],
    queryFn: () => apiClient(`/customers/${selectedCustomerId}`),
    enabled: !!selectedCustomerId,
  });

  // 4. Fetch Treasury Accounts for Payments
  const { data: treasuryAccounts } = useQuery({
    queryKey: ['treasury-accounts-lookup'],
    queryFn: () => apiClient('/treasury/accounts'),
    enabled: isPaymentModalOpen,
  });

  // Auto-select first active treasury account
  useEffect(() => {
    if (treasuryAccounts && treasuryAccounts.length > 0 && !paymentTreasuryId) {
      setPaymentTreasuryId(treasuryAccounts[0].id);
    }
  }, [treasuryAccounts, paymentTreasuryId]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newCustomer: any) =>
      apiClient('/customers', {
        method: 'POST',
        body: JSON.stringify(newCustomer),
      }),
    onSuccess: (createdCustomer: any) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-selector-list'] });
      toast.success('تم تسجيل العميل بنجاح في المنظومة');
      setIsCreateModalOpen(false);
      resetForm();
      if (createdCustomer?.id) {
        setSelectedCustomerId(createdCustomer.id);
      }
    },
    onError: (err: any) => {
      toast.error('فشل إنشاء العميل', err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiClient(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-360-details'] });
      toast.success('تم تحديث بيانات العميل بنجاح');
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error('فشل تحديث العميل', err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/customers/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('تم حذف العميل بنجاح');
      setIsDeleteModalOpen(false);
      setSelectedCustomerId(null);
    },
    onError: (err: any) => {
      toast.error('لا يمكن حذف العميل', err.message);
      setIsDeleteModalOpen(false);
    },
  });

  // Payment Mutation (FIFO)
  const paymentMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-360-details'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-charges'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-accounts'] });
      toast.success('تم تسجيل سند التحصيل والتخصيص المالي بنجاح (FIFO)');
      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setPaymentNotes('');
    },
    onError: (err: any) => {
      toast.error('فشل تسجيل السداد', err.message);
    },
  });

  // Extra Charge Mutation
  const extraChargeMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/monthly-charges', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-360-details'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-charges'] });
      toast.success('تم إضافة الاستحقاق المالي بنجاح');
      setIsExtraChargeModalOpen(false);
      setChargeAmount(0);
      setChargeNotes('');
    },
    onError: (err: any) => {
      toast.error('فشل إضافة الاستحقاق', err.message);
    },
  });

  const resetForm = () => {
    setFormShortName('');
    setFormFullName('');
    setFormContactNumber('');
    setFormMotherGrandpaName('');
    setFormNationalId('');
    setFormJoinDate(new Date().toISOString().split('T')[0]);
    setFormAddress('');
    setFormNotes('');
    setFormStatus(CustomerStatus.ACTIVE);
  };

  const handleOpenEdit = (customer: Customer) => {
    setFormShortName(customer.shortName || customer.name || '');
    setFormFullName(customer.fullName || customer.name || '');
    setFormContactNumber(customer.contactNumber || (customer.phone && !customer.phone.startsWith('NA-') ? customer.phone : ''));
    setFormMotherGrandpaName(customer.motherGrandpaName || '');
    setFormNationalId(customer.nationalId || '');
    setFormJoinDate(
      customer.joinDate
        ? customer.joinDate.split('T')[0]
        : customer.createdAt
        ? customer.createdAt.split('T')[0]
        : new Date().toISOString().split('T')[0],
    );
    setFormAddress(customer.address || '');
    setFormNotes(customer.notes || '');
    setFormStatus(customer.status);
    setIsEditModalOpen(true);
  };

  // KPI Calculations
  const activeLines = useMemo(() => {
    return customerDetails?.lines || [];
  }, [customerDetails]);

  const monthlySubscriptionTotal = useMemo(() => {
    return activeLines.reduce((acc: number, l: any) => acc + (l.monthlyPackage || 0), 0);
  }, [activeLines]);

  const overdueDebts = useMemo(() => {
    if (!customerDetails?.monthlyCharges) return 0;
    return customerDetails.monthlyCharges
      .filter((ch: any) => ch.status === MonthlyChargeStatus.DUE || ch.status === MonthlyChargeStatus.PARTIALLY_PAID)
      .reduce((acc: number, ch: any) => acc + Money.subtract(ch.amount, ch.paidAmount), 0);
  }, [customerDetails]);

  const salesRemainingDebt = useMemo(() => {
    if (!customerDetails?.sales) return 0;
    return customerDetails.sales.reduce((acc: number, s: any) => acc + (s.remaining || 0), 0);
  }, [customerDetails]);

  const totalReceivable = useMemo(() => {
    return overdueDebts + salesRemainingDebt;
  }, [overdueDebts, salesRemainingDebt]);

  // Combined Timeline Events
  const activityTimeline = useMemo(() => {
    if (!customerDetails) return [];
    const events: Array<{
      id: string;
      type: 'sale' | 'payment' | 'charge' | 'line';
      title: string;
      amount?: number;
      date: string;
      description?: string;
      badge?: string;
    }> = [];

    customerDetails.sales?.forEach((s: any) => {
      events.push({
        id: `sale-${s.id}`,
        type: 'sale',
        title: `فاتورة مبيعات (${s.saleNumber})`,
        amount: s.total,
        date: s.saleDate || s.createdAt,
        description: `إجمالي: ${Money.format(s.total)} ج.م • المدفوع: ${Money.format(s.paid)} ج.م • المتبقي: ${Money.format(s.remaining)} ج.م`,
        badge: s.status,
      });
    });

    customerDetails.payments?.forEach((p: any) => {
      events.push({
        id: `payment-${p.id}`,
        type: 'payment',
        title: `سند تحصيل نقدية (${p.paymentNumber})`,
        amount: p.amount,
        date: p.paymentDate || p.createdAt,
        description: `طريقة الدفع: ${p.paymentMethod} • المبلغ: ${Money.format(p.amount)} ج.م`,
        badge: 'تحصيل',
      });
    });

    customerDetails.monthlyCharges?.forEach((ch: any) => {
      events.push({
        id: `charge-${ch.id}`,
        type: 'charge',
        title: `استحقاق اشتراك شهري (${ch.billingMonth})`,
        amount: ch.amount,
        date: ch.dueDate || ch.createdAt,
        description: `الخط: ${ch.line?.phoneNumber || '—'} • القيمة: ${Money.format(ch.amount)} ج.م • المتبقي: ${Money.format(Money.subtract(ch.amount, ch.paidAmount))} ج.م`,
        badge: ch.status,
      });
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customerDetails]);

  // Export Customer Statement to CSV
  const handleExportStatement = () => {
    if (!customerDetails) return;
    const rows = [
      ['كشف حساب العميل', customerDetails.name, `كود: ${customerDetails.customerCode}`],
      ['الهاتف', customerDetails.phone, `الرقم القومي: ${customerDetails.nationalId || '—'}`],
      ['تاريخ الاستخراج', new Date().toLocaleString('ar-EG'), ''],
      [],
      ['نوع المعاملة', 'الرقم المرجعي', 'التاريخ', 'القيمة (ج.م)', 'البيان'],
    ];

    activityTimeline.forEach((ev) => {
      rows.push([
        ev.title,
        ev.id,
        new Date(ev.date).toLocaleDateString('ar-EG'),
        ev.amount ? Money.format(ev.amount) : '—',
        ev.description || '',
      ]);
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');

    const anchor = document.createElement('a');
    anchor.setAttribute('href', encodeURI(csvContent));
    anchor.setAttribute('download', `statement_${customerDetails.customerCode}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast.success('تم تصدير كشف الحساب المالي بنجاح');
  };

  const getWhatsAppStatementText = () => {
    if (!customerDetails) return '';
    return `*كشف حساب مالي - الكبير VIP* 👑\n\n*العميل:* ${customerDetails.name}\n*كود الحساب:* ${customerDetails.customerCode}\n*عدد الخطوط النشطة:* ${activeLines.length}\n*الاشتراك الشهري:* ${Money.format(monthlySubscriptionTotal)} ج.م\n*المتأخرات الحالية:* ${Money.format(overdueDebts)} ج.م\n*إجمالي المستحق للسداد:* ${Money.format(totalReceivable)} ج.م\n\n_شكراً لتعاملكم الراقي مع الكبير VIP._`;
  };

  const copyWhatsAppText = () => {
    navigator.clipboard.writeText(getWhatsAppStatementText());
    toast.success('تم نسخ رسالة كشف الحساب إلى الحافظة بنجاح');
  };

  // Columns for Customer Directory List
  const directoryColumns: Column<Customer>[] = [
    {
      header: 'كود العميل',
      accessorKey: 'customerCode',
      className: 'font-mono font-bold text-navy-900 dark:text-slate-100',
    },
    {
      header: 'اسم العميل',
      cell: (c) => (
        <div>
          <p className="font-bold text-navy-900 dark:text-slate-100">{c.name}</p>
          {c.address && <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">{c.address}</p>}
        </div>
      ),
    },
    {
      header: 'رقم الهاتف',
      cell: (c) => (
        <span className="font-mono font-semibold text-navy-900 dark:text-slate-100 dir-ltr inline-block">
          {c.phone}
        </span>
      ),
    },
    {
      header: 'الرقم القومي',
      cell: (c) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400 dir-ltr inline-block">
          {c.nationalId || '—'}
        </span>
      ),
    },
    {
      header: 'الخطوط المملوكة',
      cell: (c) => (
        <span className="font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md text-xs border border-blue-200 dark:border-blue-800">
          {c._count?.lines || 0} خط
        </span>
      ),
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
          {hasPermission(PERMISSIONS.PAYMENTS_CREATE) && (
            <button
              onClick={() => {
                setPayingCustomerId(c.id);
                setIsPaymentModalOpen(true);
              }}
              title="سداد مالي وتحصيل مديونية"
              className="px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-500 text-navy-950 font-extrabold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>سداد</span>
            </button>
          )}

          <button
            onClick={() => setSelectedCustomerId(c.id)}
            title="فتح المركز المالي 360°"
            className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-blue-600 dark:text-blue-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>

          {hasPermission(PERMISSIONS.CUSTOMERS_EDIT) && (
            <button
              onClick={() => handleOpenEdit(c)}
              title="تعديل بيانات العميل"
              className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-amber-600 dark:text-amber-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          {hasPermission(PERMISSIONS.CUSTOMERS_DELETE) && (
            <button
              onClick={() => {
                setSelectedCustomerId(c.id);
                setIsDeleteModalOpen(true);
              }}
              title="حذف العميل"
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
      {/* 1. TOP CUSTOMER SELECTOR & REAL-TIME FINANCIAL SUMMARY BAR */}
      <div className="bg-ivory-50 dark:bg-navy-850 p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs space-y-4 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Autocomplete Search & Selector Input */}
          <div className="flex-1 relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="ابحث واختر العميل بالاسم، كود العميل (KA-...)، رقم الهاتف، أو الرقم القومي..."
                  value={selectorSearch}
                  onChange={(e) => {
                    setSelectorSearch(e.target.value);
                    setIsCustomerSelectorOpen(true);
                  }}
                  onFocus={() => setIsCustomerSelectorOpen(true)}
                  leftIcon={<Search className="w-4 h-4 text-gold-600 dark:text-gold-400" />}
                />
              </div>

              <Button
                variant={selectedCustomerId ? 'outline' : 'secondary'}
                onClick={() => {
                  setSelectedCustomerId(null);
                  setSelectorSearch('');
                }}
                className="text-xs shrink-0"
              >
                {selectedCustomerId ? 'تصفح قائمة العملاء' : 'جميع العملاء'}
              </Button>

              {hasPermission(PERMISSIONS.CUSTOMERS_CREATE) && (
                <Button
                  variant="gold"
                  onClick={() => {
                    resetForm();
                    setIsCreateModalOpen(true);
                  }}
                  leftIcon={<UserPlus className="w-4 h-4" />}
                  className="shrink-0 text-xs"
                >
                  عميل جديد
                </Button>
              )}
            </div>

            {/* Live Autocomplete Dropdown List */}
            {isCustomerSelectorOpen && selectorList.length > 0 && (
              <div className="absolute top-full right-0 left-0 mt-1.5 bg-white dark:bg-navy-900 border border-ivory-300 dark:border-navy-700 rounded-xl shadow-navy-lg z-30 max-h-64 overflow-y-auto custom-scrollbar">
                <div className="p-2 border-b border-ivory-200 dark:border-navy-800 flex items-center justify-between text-xs text-slate-500 font-bold">
                  <span>اختر عميلاً لعرض مركزه المالي اللحظي 360°</span>
                  <button
                    onClick={() => setIsCustomerSelectorOpen(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-navy-800 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {selectorList.map((c: Customer) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setSelectorSearch(`${c.name} (${c.customerCode})`);
                      setIsCustomerSelectorOpen(false);
                    }}
                    className="p-3 hover:bg-ivory-100 dark:hover:bg-navy-800 cursor-pointer border-b border-ivory-100 dark:border-navy-800/60 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <span className="font-extrabold text-navy-900 dark:text-slate-100 text-sm block">
                        {c.name}
                      </span>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {c.customerCode} • {c.phone}
                      </span>
                    </div>
                    <Badge variant={getStatusBadgeVariant(c.status)}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Customer Identity Header */}
        {selectedCustomerId && customerDetails && (
          <div className="p-4 bg-white dark:bg-navy-950/80 border border-ivory-300 dark:border-navy-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-navy-900 dark:bg-navy-800 border border-gold-500/30 flex items-center justify-center text-gold-400 font-kufi font-extrabold text-lg shadow-gold-sm">
                {customerDetails.name?.slice(0, 1) || 'ع'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-kufi font-extrabold text-navy-900 dark:text-slate-100">
                    {customerDetails.name}
                  </h2>
                  <Badge variant={getStatusBadgeVariant(customerDetails.status)}>
                    {customerDetails.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                  <span className="font-bold text-gold-700 dark:text-gold-400">
                    كود: {customerDetails.customerCode}
                  </span>
                  <span>•</span>
                  <span>الهاتف: {customerDetails.phone}</span>
                  {customerDetails.nationalId && (
                    <>
                      <span>•</span>
                      <span>الرقم القومي: {customerDetails.nationalId}</span>
                    </>
                  )}
                  {customerDetails.address && (
                    <>
                      <span>•</span>
                      <span className="font-sans">{customerDetails.address}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasPermission(PERMISSIONS.PAYMENTS_CREATE) && (
                <Button
                  variant="gold"
                  onClick={() => {
                    setPayingCustomerId(selectedCustomerId);
                    setIsPaymentModalOpen(true);
                  }}
                  leftIcon={<CreditCard className="w-3.5 h-3.5 text-navy-950" />}
                  className="text-xs py-1.5 px-3 font-extrabold text-navy-950 shadow-gold-sm"
                >
                  💰 سداد مالي
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => setIsStatementCardModalOpen(true)}
                leftIcon={<Share2 className="w-3.5 h-3.5 text-amber-500" />}
                className="text-xs py-1.5"
                title="توليد كشف حساب بصورة احترافية للموبايل والواتساب"
              >
                📤 إرسال كشف الحساب
              </Button>

              <Button
                variant="outline"
                onClick={() => handleOpenEdit(customerDetails)}
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                className="text-xs py-1.5"
              >
                تعديل البيانات
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedCustomerId(null);
                  setSelectorSearch('');
                }}
                leftIcon={<X className="w-3.5 h-3.5" />}
                className="text-xs py-1.5"
              >
                إلغاء التحديد
              </Button>
            </div>
          </div>
        )}

        {/* 4 Instant KPI Metrics Cards */}
        {selectedCustomerId && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            {/* KPI 1: Lines Count */}
            <div className="p-3.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                  📱 عدد الخطوط
                </span>
                <span className="text-xl font-extrabold text-navy-900 dark:text-slate-100 font-mono">
                  {activeLines.length} خط
                </span>
              </div>
              <div className="p-1 rounded-xl">
                <Icon3D name="lines" size="md" />
              </div>
            </div>

            {/* KPI 2: Monthly Subscription */}
            <div className="p-3.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                  📦 الاشتراك الشهري
                </span>
                <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-400 font-mono">
                  {Money.format(monthlySubscriptionTotal)} ج.م
                </span>
              </div>
              <div className="p-1 rounded-xl">
                <Icon3D name="packages" size="md" />
              </div>
            </div>

            {/* KPI 3: Overdue Debts */}
            <div className="p-3.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                  ⚠️ المتأخرات
                </span>
                <span className="text-xl font-extrabold text-rose-700 dark:text-rose-400 font-mono">
                  {Money.format(overdueDebts)} ج.م
                </span>
              </div>
              <div className="p-1 rounded-xl">
                <Icon3D name="alert" size="md" />
              </div>
            </div>

            {/* KPI 4: Total Receivable */}
            <div className="p-3.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                  💰 إجمالي المستحق
                </span>
                <span className="text-xl font-extrabold text-gold-700 dark:text-gold-400 font-mono">
                  {Money.format(totalReceivable)} ج.م
                </span>
              </div>
              <div className="p-1 rounded-xl">
                <Icon3D name="payments" size="md" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. DUAL-TIER TABBED VIEW & FILTER SYSTEM */}
      {selectedCustomerId && customerDetails ? (
        <div className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs space-y-4 transition-colors">
          {/* Sub-Ledger Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-ivory-300 dark:border-navy-750 pb-2 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('lines')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'lines'
                  ? 'bg-navy-900 text-gold-400 shadow-gold-xs dark:bg-gold-500 dark:text-navy-950'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-ivory-200 dark:hover:bg-navy-800'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>الخطوط الحالية ({activeLines.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('previous_lines')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'previous_lines'
                  ? 'bg-navy-900 text-gold-400 shadow-gold-xs dark:bg-gold-500 dark:text-navy-950'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-ivory-200 dark:hover:bg-navy-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>سجل الخطوط السابقة ({customerDetails.lineHistoryOld?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'timeline'
                  ? 'bg-navy-900 text-gold-400 shadow-gold-xs dark:bg-gold-500 dark:text-navy-950'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-ivory-200 dark:hover:bg-navy-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>الجدول الزمني للعميل ({activityTimeline.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'sales'
                  ? 'bg-navy-900 text-gold-400 shadow-gold-xs dark:bg-gold-500 dark:text-navy-950'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-ivory-200 dark:hover:bg-navy-800'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>سجل المبيعات ({customerDetails.sales?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'payments'
                  ? 'bg-navy-900 text-gold-400 shadow-gold-xs dark:bg-gold-500 dark:text-navy-950'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-ivory-200 dark:hover:bg-navy-800'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>سجل المدفوعات ({customerDetails.payments?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('debts')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'debts'
                  ? 'bg-navy-900 text-gold-400 shadow-gold-xs dark:bg-gold-500 dark:text-navy-950'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-ivory-200 dark:hover:bg-navy-800'
              }`}
            >
              <TrendingDown className="w-4 h-4 text-rose-500" />
              <span>كشف المديونيات والمتأخرات ({Money.format(totalReceivable)} ج.م)</span>
            </button>
          </div>

          {/* TAB 1: Active Lines */}
          {activeTab === 'lines' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                  قائمة الخطوط والأرقام النشطة التابعة للعميل
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-ivory-200/80 dark:bg-navy-900 text-navy-900 dark:text-slate-200 font-kufi font-bold">
                    <tr>
                      <th className="p-3">رقم الهاتف</th>
                      <th className="p-3">الشركة</th>
                      <th className="p-3">الباقة الشهرية</th>
                      <th className="p-3">يوم التجديد</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ivory-200 dark:divide-navy-800 font-sans">
                    {activeLines.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500">
                          لا توجد خطوط مسجلة باسم هذا العميل حالياً.
                        </td>
                      </tr>
                    ) : (
                      activeLines.map((l: any) => (
                        <tr key={l.id} className="hover:bg-ivory-100/60 dark:hover:bg-navy-900/60">
                          <td className="p-3 font-mono font-bold text-navy-900 dark:text-slate-100">
                            {l.phoneNumber}
                          </td>
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                            {l.company?.name || '—'}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                            {Money.format(l.monthlyPackage)} ج.م
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-600 dark:text-slate-400">
                            يوم {l.paymentDay}
                          </td>
                          <td className="p-3">
                            <Badge variant={getStatusBadgeVariant(l.status)}>{l.status}</Badge>
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 text-xs">
                            {l.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Previous Lines History */}
          {activeTab === 'previous_lines' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                  سجل الخطوط المحولة أو المتنازل عنها سابقاً
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-ivory-200/80 dark:bg-navy-900 text-navy-900 dark:text-slate-200 font-kufi font-bold">
                    <tr>
                      <th className="p-3">رقم الهاتف</th>
                      <th className="p-3">الشركة</th>
                      <th className="p-3">تاريخ التحويل / التنازل</th>
                      <th className="p-3">العميل الجديد المحول إليه</th>
                      <th className="p-3">نوع الحركة</th>
                      <th className="p-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ivory-200 dark:divide-navy-800 font-sans">
                    {customerDetails.lineHistoryOld?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500">
                          لا يوجد سجل خطوط سابقة أو متنازل عنها لهذا العميل.
                        </td>
                      </tr>
                    ) : (
                      customerDetails.lineHistoryOld?.map((lh: any) => (
                        <tr key={lh.id} className="hover:bg-ivory-100/60 dark:hover:bg-navy-900/60">
                          <td className="p-3 font-mono font-bold text-navy-900 dark:text-slate-100">
                            {lh.line?.phoneNumber || '—'}
                          </td>
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                            {lh.line?.company?.name || '—'}
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                            {new Date(lh.createdAt).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="p-3 font-bold text-navy-900 dark:text-slate-100">
                            {lh.newCustomer?.name || 'استرجاع للمخزن'}
                          </td>
                          <td className="p-3">
                            <Badge variant="info">{lh.changeType || 'تنازل / نقل'}</Badge>
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 text-xs">
                            {lh.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Activity Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                الجدول الزمني لحركات وتعاملات العميل المالية والتشغيلية
              </h3>

              <div className="relative border-r border-ivory-300 dark:border-navy-700 mr-4 space-y-6">
                {activityTimeline.length === 0 ? (
                  <p className="p-4 text-slate-500 text-xs">لا توجد حركات مسجلة للعميل حتى الآن.</p>
                ) : (
                  activityTimeline.map((ev) => (
                    <div key={ev.id} className="relative pr-6">
                      <div
                        className={`absolute -right-2.5 top-1.5 w-5 h-5 rounded-full border-2 border-white dark:border-navy-950 flex items-center justify-center ${
                          ev.type === 'sale'
                            ? 'bg-blue-600 text-white'
                            : ev.type === 'payment'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gold-500 text-navy-950'
                        }`}
                      >
                        {ev.type === 'sale' ? (
                          <ShoppingCart className="w-2.5 h-2.5" />
                        ) : ev.type === 'payment' ? (
                          <CreditCard className="w-2.5 h-2.5" />
                        ) : (
                          <Calendar className="w-2.5 h-2.5" />
                        )}
                      </div>

                      <div className="bg-white dark:bg-navy-950 p-3.5 rounded-xl border border-ivory-300 dark:border-navy-750 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-navy-900 dark:text-slate-100 text-xs">
                            {ev.title}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {new Date(ev.date).toLocaleString('ar-EG')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {ev.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Sales Ledger */}
          {activeTab === 'sales' && (
            <div className="space-y-3">
              <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                سجل فواتير وتعاقدات البيع
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-ivory-200/80 dark:bg-navy-900 text-navy-900 dark:text-slate-200 font-kufi font-bold">
                    <tr>
                      <th className="p-3">رقم الفاتورة</th>
                      <th className="p-3">تاريخ البيع</th>
                      <th className="p-3">إجمالي الفاتورة</th>
                      <th className="p-3">المدفوع</th>
                      <th className="p-3">المتبقي</th>
                      <th className="p-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ivory-200 dark:divide-navy-800 font-sans">
                    {customerDetails.sales?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500">
                          لا توجد فواتير مبيعات مسجلة لهذا العميل.
                        </td>
                      </tr>
                    ) : (
                      customerDetails.sales?.map((s: any) => (
                        <tr key={s.id} className="hover:bg-ivory-100/60 dark:hover:bg-navy-900/60">
                          <td className="p-3 font-mono font-bold text-navy-900 dark:text-slate-100">
                            {s.saleNumber}
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                            {new Date(s.saleDate || s.createdAt).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="p-3 font-mono font-bold text-navy-900 dark:text-slate-100">
                            {Money.format(s.total)} ج.م
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                            {Money.format(s.paid)} ج.م
                          </td>
                          <td className="p-3 font-mono font-bold text-rose-700 dark:text-rose-400">
                            {Money.format(s.remaining)} ج.م
                          </td>
                          <td className="p-3">
                            <Badge variant={getStatusBadgeVariant(s.status)}>{s.status}</Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: Payment Receipts (FIFO) */}
          {activeTab === 'payments' && (
            <div className="space-y-3">
              <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                سجل سندات التحصيل والدفعات المالية
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-ivory-200/80 dark:bg-navy-900 text-navy-900 dark:text-slate-200 font-kufi font-bold">
                    <tr>
                      <th className="p-3">رقم السند</th>
                      <th className="p-3">التاريخ والوقت</th>
                      <th className="p-3">المبلغ المحصل</th>
                      <th className="p-3">طريقة الدفع</th>
                      <th className="p-3">التخصيصات (Allocations)</th>
                      <th className="p-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ivory-200 dark:divide-navy-800 font-sans">
                    {customerDetails.payments?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500">
                          لا توجد سندات تحصيل مسجلة لهذا العميل.
                        </td>
                      </tr>
                    ) : (
                      customerDetails.payments?.map((p: any) => (
                        <tr key={p.id} className="hover:bg-ivory-100/60 dark:hover:bg-navy-900/60">
                          <td className="p-3 font-mono font-bold text-navy-900 dark:text-slate-100">
                            {p.paymentNumber}
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                            {new Date(p.paymentDate || p.createdAt).toLocaleString('ar-EG')}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-400 text-sm">
                            +{Money.format(p.amount)} ج.م
                          </td>
                          <td className="p-3">
                            <Badge variant="info">{p.paymentMethod}</Badge>
                          </td>
                          <td className="p-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                            {p.allocations?.length > 0 ? (
                              <span>تخصيص {p.allocations.length} فواتير</span>
                            ) : (
                              'سداد مباشر'
                            )}
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 text-xs">
                            {p.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: Debts & Overdue Breakdown */}
          {activeTab === 'debts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                  تفصيل المديونيات والمتأخرات غير المسددة
                </h3>
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400 font-mono">
                  إجمالي المديونية: {Money.format(totalReceivable)} ج.م
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-ivory-200/80 dark:bg-navy-900 text-navy-900 dark:text-slate-200 font-kufi font-bold">
                    <tr>
                      <th className="p-3">نوع المديونية</th>
                      <th className="p-3">الخط / المرجع</th>
                      <th className="p-3">شهر الاستحقاق</th>
                      <th className="p-3">القيمة الأصلية</th>
                      <th className="p-3">المدفوع</th>
                      <th className="p-3">المتبقي / المتأخر</th>
                      <th className="p-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ivory-200 dark:divide-navy-800 font-sans">
                    {overdueDebts === 0 && salesRemainingDebt === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-emerald-700 dark:text-emerald-400 font-bold">
                          🎉 الحساب خالص تماماً ولا توجد أي مديونيات متأخرة على العميل!
                        </td>
                      </tr>
                    ) : (
                      <>
                        {customerDetails.monthlyCharges
                          ?.filter((ch: any) => ch.status === MonthlyChargeStatus.DUE || ch.status === MonthlyChargeStatus.PARTIALLY_PAID)
                          ?.map((ch: any) => (
                            <tr key={ch.id} className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20">
                              <td className="p-3 font-bold text-navy-900 dark:text-slate-100">
                                اشتراك شهري
                              </td>
                              <td className="p-3 font-mono font-bold text-navy-900 dark:text-slate-100">
                                {ch.line?.phoneNumber || '—'}
                              </td>
                              <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                                {ch.billingMonth}
                              </td>
                              <td className="p-3 font-mono font-bold text-navy-900 dark:text-slate-100">
                                {Money.format(ch.amount)} ج.م
                              </td>
                              <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                                {Money.format(ch.paidAmount)} ج.م
                              </td>
                              <td className="p-3 font-mono font-bold text-rose-700 dark:text-rose-400 text-sm">
                                {Money.format(Money.subtract(ch.amount, ch.paidAmount))} ج.م
                              </td>
                              <td className="p-3">
                                <Badge variant="danger">{ch.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        {customerDetails.sales
                          ?.filter((s: any) => s.remaining > 0)
                          ?.map((s: any) => (
                            <tr key={s.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20">
                              <td className="p-3 font-bold text-navy-900 dark:text-slate-100">
                                متبقي فاتورة بيع
                              </td>
                              <td className="p-3 font-mono font-bold text-navy-900 dark:text-slate-100">
                                {s.saleNumber}
                              </td>
                              <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                                {new Date(s.saleDate || s.createdAt).toLocaleDateString('ar-EG')}
                              </td>
                              <td className="p-3 font-mono font-bold text-navy-900 dark:text-slate-100">
                                {Money.format(s.total)} ج.م
                              </td>
                              <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                                {Money.format(s.paid)} ج.م
                              </td>
                              <td className="p-3 font-mono font-bold text-rose-700 dark:text-rose-400 text-sm">
                                {Money.format(s.remaining)} ج.م
                              </td>
                              <td className="p-3">
                                <Badge variant="warning">آجل</Badge>
                              </td>
                            </tr>
                          ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Full Customers Directory List (When no customer is selected) */
        <div className="space-y-4 font-sans">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-kufi font-extrabold text-navy-900 dark:text-slate-100">
              دليل وسجل العملاء والمشتركين
            </h2>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">
              اضغط على أي عميل لفتح المركز المالي الشامل 360°
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
              {[
                { label: 'الكل (جميع العملاء)', status: '' },
                { label: 'نشط (ACTIVE)', status: CustomerStatus.ACTIVE },
                { label: 'غير نشط (INACTIVE)', status: CustomerStatus.INACTIVE },
                { label: 'موقوف / محظور (BLOCKED)', status: CustomerStatus.BLOCKED },
              ].map((pill) => {
                const isActive = statusFilter === pill.status;
                return (
                  <button
                    key={pill.label}
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

            <ContextualSearchBar
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              placeholder="بحث فوري باسم العميل، كود العميل، رقم الهاتف، أو الرقم القومي..."
              filteredCount={customerList.length}
              totalCount={customerMeta.totalItems}
              filterSlots={
                <div className="w-44">
                  <Select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">جميع الحالات</option>
                    <option value={CustomerStatus.ACTIVE}>نشط (ACTIVE)</option>
                    <option value={CustomerStatus.INACTIVE}>غير نشط (INACTIVE)</option>
                    <option value={CustomerStatus.BLOCKED}>محظور (BLOCKED)</option>
                  </Select>
                </div>
              }
            />
          </div>

          <Table
            columns={directoryColumns}
            data={customerList}
            isLoading={isCustomersLoading}
            emptyMessage="لم يتم العثور على عملاء مطابقين للبحث. يمكنك إضافة عميل جديد بالضغط على زر [عميل جديد] أعلاه."
            onRowClick={(c) => setSelectedCustomerId(c.id)}
          />

          <Pagination
            page={page}
            totalPages={customerMeta.totalPages}
            totalItems={customerMeta.totalItems}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* 3. BOTTOM FIXED / ACCENTED ACTION TOOLBAR */}
      {selectedCustomerId && customerDetails && (
        <div className="sticky bottom-4 z-20 bg-navy-900 dark:bg-navy-950 border border-gold-500/40 p-3.5 rounded-2xl shadow-navy-xl flex flex-wrap items-center justify-between gap-3 text-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gold-300 font-kufi">
              إجراءات كشف الحساب والتحصيل:
            </span>
            <span className="text-xs font-mono font-bold text-slate-300 hidden sm:inline">
              المستحق: {Money.format(totalReceivable)} ج.م
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Share WhatsApp */}
            <Button
              variant="gold"
              onClick={() => setIsShareModalOpen(true)}
              leftIcon={<Share2 className="w-4 h-4" />}
              className="text-xs py-1.5"
            >
              مشاركة كشف الحساب
            </Button>

            {/* Statement Pro Print */}
            <Button
              variant="outline"
              onClick={() => setIsStatementModalOpen(true)}
              leftIcon={<Printer className="w-4 h-4" />}
              className="text-xs py-1.5 border-navy-700 bg-navy-800 text-slate-100 hover:bg-navy-700"
            >
              تقرير العميل الكامل (Statement Pro)
            </Button>

            {/* Log Payment FIFO */}
            {hasPermission(PERMISSIONS.PAYMENTS_CREATE) && (
              <Button
                variant="primary"
                onClick={() => {
                  setPaymentAmount(totalReceivable > 0 ? totalReceivable : 0);
                  setIsPaymentModalOpen(true);
                }}
                leftIcon={<CreditCard className="w-4 h-4" />}
                className="text-xs py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                تسجيل سداد دفعة (FIFO)
              </Button>
            )}

            {/* Extra Charge */}
            {hasPermission(PERMISSIONS.MONTHLY_CHARGES_MANAGE) && (
              <Button
                variant="outline"
                onClick={() => {
                  if (activeLines.length > 0) {
                    setChargeLineId(activeLines[0].id);
                  }
                  setIsExtraChargeModalOpen(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
                className="text-xs py-1.5 border-navy-700 bg-navy-800 text-slate-100 hover:bg-navy-700"
              >
                إضافة استحقاق إضافي
              </Button>
            )}

            {/* Excel Export */}
            <Button
              variant="secondary"
              onClick={handleExportStatement}
              leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
              className="text-xs py-1.5 bg-navy-800 text-slate-200 border-navy-700 hover:bg-navy-700"
            >
              كشف حساب Excel
            </Button>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Customer */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="lg"
        title="تسجيل عميل جديد"
        description="البيانات الأساسية الإلزامية مميزة بعلامة (*)، وباقي الحقول اختيارية"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="gold"
              isLoading={createMutation.isPending}
              onClick={() => {
                if (!formShortName.trim()) {
                  toast.error('يرجى إدخال اسم العميل (الشهرة)');
                  return;
                }
                if (!formFullName.trim()) {
                  toast.error('يرجى إدخال الاسم بالكامل');
                  return;
                }
                if (formNationalId && formNationalId.trim().length !== 14) {
                  toast.error('الرقم القومي يجب أن يتكون من 14 رقم بالظبط');
                  return;
                }
                createMutation.mutate({
                  shortName: formShortName.trim(),
                  fullName: formFullName.trim(),
                  name: formFullName.trim(),
                  contactNumber: formContactNumber.trim() || undefined,
                  phone: formContactNumber.trim() || undefined,
                  motherGrandpaName: formMotherGrandpaName.trim() || undefined,
                  nationalId: formNationalId.trim() || undefined,
                  joinDate: formJoinDate || undefined,
                  address: formAddress.trim() || undefined,
                  notes: formNotes.trim() || undefined,
                  status: formStatus,
                });
              }}
            >
              حفظ العميل
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          {/* قسم البيانات الإلزامية */}
          <div className="p-3.5 bg-ivory-100 dark:bg-navy-900 rounded-xl border border-ivory-300 dark:border-navy-750 space-y-3">
            <h4 className="text-xs font-bold text-navy-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>البيانات الإلزامية الأساسية</span>
              <span className="text-[10px] text-rose-500 font-normal">(مطلوبة لحفظ العميل)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="اسم العميل (الشهره) *"
                placeholder="مثال: حسن عماره"
                value={formShortName}
                onChange={(e) => setFormShortName(e.target.value)}
                autoFocus
                required
              />
              <Input
                label="الاسم بالكامل *"
                placeholder="مثال: حسن علي حسن عماره"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* قسم البيانات الاختيارية */}
          <div className="p-3.5 bg-ivory-50 dark:bg-navy-950 rounded-xl border border-ivory-300 dark:border-navy-750 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">بيانات اختيارية وإضافية</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="رقم التواصل (اختياري)"
                type="tel"
                placeholder="رقم الهاتف الشخصي"
                value={formContactNumber}
                onChange={(e) => setFormContactNumber(e.target.value)}
                dir="ltr"
              />
              <Input
                label="اسم الجد للأم (اختياري)"
                placeholder="اسم الجد للأم"
                value={formMotherGrandpaName}
                onChange={(e) => setFormMotherGrandpaName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="الرقم القومي (اختياري - 14 رقم)"
                placeholder="29001011234567"
                maxLength={14}
                value={formNationalId}
                onChange={(e) => setFormNationalId(e.target.value)}
                dir="ltr"
              />
              <Input
                label="تاريخ الانضمام (اختياري)"
                type="date"
                value={formJoinDate}
                onChange={(e) => setFormJoinDate(e.target.value)}
              />
              <Select
                label="حالة الحساب"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as CustomerStatus)}
              >
                <option value={CustomerStatus.ACTIVE}>نشط (ACTIVE)</option>
                <option value={CustomerStatus.INACTIVE}>غير نشط (INACTIVE)</option>
                <option value={CustomerStatus.BLOCKED}>محظور (BLOCKED)</option>
              </Select>
            </div>

            <Input
              label="العنوان (اختياري)"
              placeholder="مثال: الجيزة - شارع الهرم"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
            />

            <Textarea
              label="ملاحظات (اختياري)"
              rows={3}
              placeholder="شروط خاصة، أوقات التواصل المفضلة..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 2: Edit Customer */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="تعديل بيانات العميل"
        description="تحديث البيانات الأساسية والإضافية للعميل"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="gold"
              isLoading={updateMutation.isPending}
              onClick={() => {
                if (!formShortName.trim()) {
                  toast.error('يرجى إدخال اسم العميل (الشهرة)');
                  return;
                }
                if (!formFullName.trim()) {
                  toast.error('يرجى إدخال الاسم بالكامل');
                  return;
                }
                if (formNationalId && formNationalId.trim().length !== 14) {
                  toast.error('الرقم القومي يجب أن يتكون من 14 رقم بالظبط');
                  return;
                }
                if (selectedCustomerId) {
                  updateMutation.mutate({
                    id: selectedCustomerId,
                    payload: {
                      shortName: formShortName.trim(),
                      fullName: formFullName.trim(),
                      name: formFullName.trim(),
                      contactNumber: formContactNumber.trim() || undefined,
                      phone: formContactNumber.trim() || undefined,
                      motherGrandpaName: formMotherGrandpaName.trim() || undefined,
                      nationalId: formNationalId.trim() || undefined,
                      joinDate: formJoinDate || undefined,
                      address: formAddress.trim() || undefined,
                      notes: formNotes.trim() || undefined,
                      status: formStatus,
                    },
                  });
                }
              }}
            >
              حفظ التعديلات
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          {/* قسم البيانات الإلزامية */}
          <div className="p-3.5 bg-ivory-100 dark:bg-navy-900 rounded-xl border border-ivory-300 dark:border-navy-750 space-y-3">
            <h4 className="text-xs font-bold text-navy-900 dark:text-slate-100">البيانات الإلزامية الأساسية</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="اسم العميل (الشهره) *"
                value={formShortName}
                onChange={(e) => setFormShortName(e.target.value)}
                required
              />
              <Input
                label="الاسم بالكامل *"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* قسم البيانات الاختيارية */}
          <div className="p-3.5 bg-ivory-50 dark:bg-navy-950 rounded-xl border border-ivory-300 dark:border-navy-750 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">بيانات اختيارية وإضافية</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="رقم التواصل (اختياري)"
                type="tel"
                value={formContactNumber}
                onChange={(e) => setFormContactNumber(e.target.value)}
                dir="ltr"
              />
              <Input
                label="اسم الجد للأم (اختياري)"
                value={formMotherGrandpaName}
                onChange={(e) => setFormMotherGrandpaName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="الرقم القومي (اختياري - 14 رقم)"
                maxLength={14}
                value={formNationalId}
                onChange={(e) => setFormNationalId(e.target.value)}
                dir="ltr"
              />
              <Input
                label="تاريخ الانضمام (اختياري)"
                type="date"
                value={formJoinDate}
                onChange={(e) => setFormJoinDate(e.target.value)}
              />
              <Select
                label="حالة الحساب"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as CustomerStatus)}
              >
                <option value={CustomerStatus.ACTIVE}>نشط (ACTIVE)</option>
                <option value={CustomerStatus.INACTIVE}>غير نشط (INACTIVE)</option>
                <option value={CustomerStatus.BLOCKED}>محظور (BLOCKED)</option>
              </Select>
            </div>

            <Input
              label="العنوان (اختياري)"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
            />

            <Textarea
              label="ملاحظات (اختياري)"
              rows={3}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Delete Customer Confirmation */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="تأكيد حذف العميل"
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
                if (selectedCustomerId) {
                  deleteMutation.mutate(selectedCustomerId);
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
              هل أنت متأكد من رغبتك في حذف هذا العميل؟ لا يمكن حذف العملاء الذين لديهم فواتير أو حركات مالية نشطة.
            </span>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: Unified VIP Payment & Settlement Modal */}
      <UnifiedPaymentModal
        customerId={payingCustomerId || selectedCustomerId}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPayingCustomerId(null);
        }}
      />

      {/* MODAL 4.1: Customer Statement Card (Mobile-friendly Luxury Canvas) */}
      {selectedCustomerId && customerDetails && (
        <CustomerStatementCard
          isOpen={isStatementCardModalOpen}
          onClose={() => setIsStatementCardModalOpen(false)}
          data={{
            customer: {
              id: customerDetails.id,
              customerCode: customerDetails.customerCode,
              name: customerDetails.name,
              phone: customerDetails.phone,
              nationalId: customerDetails.nationalId,
            },
            lines: activeLines.map((l: any) => ({
              id: l.id,
              phoneNumber: l.phoneNumber,
              companyName: l.company?.name,
              companyCode: l.company?.code,
              packageName: l.package?.name || (l.monthlyPackage ? `باقة ${l.monthlyPackage}` : undefined),
              monthlyPackage: l.monthlyPackage || 0,
              renewalDate: l.renewalDate,
              paymentDay: l.paymentDay,
            })),
            openingBalance: customerDetails.openingBalance || 0,
            unpaidChargesTotal: overdueDebts,
            unpaidSalesTotal: salesRemainingDebt,
            totalDebt: totalReceivable,
          }}
        />
      )}

      {/* MODAL 5: Extra Charge */}
      <Modal
        isOpen={isExtraChargeModalOpen}
        onClose={() => setIsExtraChargeModalOpen(false)}
        title={`إضافة استحقاق إضافي على العميل — ${customerDetails?.name}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsExtraChargeModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="gold"
              isLoading={extraChargeMutation.isPending}
              onClick={() => {
                if (!chargeLineId) {
                  toast.error('يرجى اختيار الخط');
                  return;
                }
                if (!chargeAmount || chargeAmount <= 0) {
                  toast.error('يرجى إدخال قيمة الاستحقاق');
                  return;
                }
                extraChargeMutation.mutate({
                  lineId: chargeLineId,
                  billingMonth: chargeMonth,
                  amount: Number(chargeAmount),
                  notes: chargeNotes || undefined,
                });
              }}
            >
              تسجيل الاستحقاق
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          <Select
            label="اختر الخط التابع للعميل *"
            value={chargeLineId}
            onChange={(e) => setChargeLineId(e.target.value)}
          >
            <option value="">اختر الخط...</option>
            {activeLines.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.phoneNumber} ({l.company?.name})
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="شهر الاستحقاق (YYYY-MM) *"
              type="month"
              value={chargeMonth}
              onChange={(e) => setChargeMonth(e.target.value)}
            />

            <Input
              label="القيمة المستحقة (EGP) *"
              type="number"
              value={chargeAmount || ''}
              onChange={(e) => setChargeAmount(Number(e.target.value))}
              placeholder="0.00"
            />
          </div>

          <Textarea
            label="البيان / السبب (اختياري)"
            placeholder="باقة إضافية، غرامة تأخير، خدمات مضافة..."
            value={chargeNotes}
            onChange={(e) => setChargeNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* MODAL 6: WhatsApp Share Statement */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="مشاركة كشف الحساب عبر WhatsApp"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsShareModalOpen(false)}>
              إغلاق
            </Button>
            <Button
              variant="gold"
              onClick={copyWhatsAppText}
              leftIcon={<Copy className="w-4 h-4" />}
            >
              نسخ نص الرسالة
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          <p className="text-xs text-slate-700 dark:text-slate-300">
            تم تجهيز نص كشف الحساب المالي جاهزاً للمشاركة المباشرة عبر تطبيق WhatsApp:
          </p>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl font-mono text-xs text-emerald-950 dark:text-emerald-200 whitespace-pre-line leading-relaxed">
            {getWhatsAppStatementText()}
          </div>
        </div>
      </Modal>

      {/* MODAL 7: Statement Pro (Print/PDF) */}
      <Modal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        title={`تقرير كشف الحساب الشامل (Statement Pro) — ${customerDetails?.name}`}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsStatementModalOpen(false)}>
              إغلاق
            </Button>
            <Button
              variant="gold"
              onClick={() => window.print()}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              طباعة كشف الحساب
            </Button>
          </>
        }
      >
        <div className="space-y-6 font-sans p-4 bg-white text-navy-950 rounded-xl border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-kufi font-extrabold text-navy-900">الكبير VIP — كشف حساب العميل</h2>
              <p className="text-xs text-slate-600 font-mono">
                كود: {customerDetails?.customerCode} • الهاتف: {customerDetails?.phone}
              </p>
            </div>
            <div className="text-left font-mono text-xs text-slate-600">
              <p>تاريخ الكشف: {new Date().toLocaleDateString('ar-EG')}</p>
              <p className="font-bold text-navy-900">المستحق: {Money.format(totalReceivable)} ج.م</p>
            </div>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-600 block">الخطوط النشطة</span>
              <span className="text-sm font-bold font-mono">{activeLines.length}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-600 block">الاشتراك الشهري</span>
              <span className="text-sm font-bold font-mono">{Money.format(monthlySubscriptionTotal)} ج.م</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-600 block">المتأخرات</span>
              <span className="text-sm font-bold font-mono text-rose-700">{Money.format(overdueDebts)} ج.م</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-600 block">إجمالي المستحق</span>
              <span className="text-sm font-bold font-mono text-gold-700">{Money.format(totalReceivable)} ج.م</span>
            </div>
          </div>

          {/* Statement Table */}
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-800 font-bold">
              <tr>
                <th className="p-2.5">المعاملة</th>
                <th className="p-2.5">التاريخ</th>
                <th className="p-2.5">القيمة</th>
                <th className="p-2.5">البيان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {activityTimeline.slice(0, 15).map((ev) => (
                <tr key={ev.id}>
                  <td className="p-2.5 font-bold">{ev.title}</td>
                  <td className="p-2.5 font-mono">{new Date(ev.date).toLocaleDateString('ar-EG')}</td>
                  <td className="p-2.5 font-mono font-bold">{ev.amount ? `${Money.format(ev.amount)} ج.م` : '—'}</td>
                  <td className="p-2.5 text-slate-600">{ev.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
};
