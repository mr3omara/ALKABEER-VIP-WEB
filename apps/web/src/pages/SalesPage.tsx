import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  ShoppingCart,
  Plus,
  Search,
  Trash2,
  Eye,
  RotateCcw,
  Landmark,
  FileCheck,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Printer,
} from 'lucide-react';
import { SaleStatus, PaymentMethod, PERMISSIONS, Money, LineStatus } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface SaleItem {
  id: string;
  lineId: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  line?: { id: string; phoneNumber: string; company?: { name: string } };
}

interface Sale {
  id: string;
  saleNumber: string;
  customerId: string;
  saleDate: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  status: SaleStatus;
  notes?: string;
  customer?: { id: string; name: string; phone: string; customerCode: string };
  items?: SaleItem[];
  payments?: any[];
}

export const SalesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsCreateModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [isConfirmationStep, setIsConfirmationStep] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // New Sale Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [saleItems, setSaleItems] = useState<
    Array<{ lineId: string; unitPrice: number; discount: number; description?: string }>
  >([]);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // 1. Fetch Sales List
  const { data, isLoading } = useQuery<{ items: Sale[]; meta: any }>({
    queryKey: ['sales', page, search, statusFilter],
    queryFn: () =>
      apiClient(
        `/sales?page=${page}&limit=15&search=${encodeURIComponent(
          search,
        )}&status=${statusFilter}`,
      ),
  });

  // 2. Fetch Customers for Sale Creation
  const { data: customersData } = useQuery({
    queryKey: ['active-customers'],
    queryFn: () => apiClient('/customers?limit=100&status=ACTIVE'),
    enabled: isCreateModalOpen,
  });

  // 3. Fetch In-Stock Lines for Sale Creation
  const { data: inStockLines } = useQuery({
    queryKey: ['in-stock-lines'],
    queryFn: () => apiClient(`/lines?limit=100&status=${LineStatus.IN_STOCK}`),
    enabled: isCreateModalOpen,
  });

  // 4. Fetch Treasury Accounts for Immediate Payment Inflow
  const { data: treasuryAccounts } = useQuery({
    queryKey: ['treasury-accounts'],
    queryFn: () => apiClient('/treasury/accounts'),
    enabled: isCreateModalOpen,
  });

  // Create Sale Mutation (Atomic Transaction Engine)
  const createSaleMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/sales', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['in-stock-lines'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('تم إتمام الفاتورة وتحديث حالة الخطوط والخزينة ذرياً بنجاح');
      setIsCreateModalOpen(false);
      setIsConfirmationStep(false);
      resetSaleForm();
    },
    onError: (err: any) => {
      toast.error('فشل إتمام البيع', err.message);
    },
  });

  // Cancel Sale Mutation
  const cancelSaleMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient(`/sales/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['in-stock-lines'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('تم إلغاء البيع وإرجاع الخطوط للمخزن وعكس السندات النقدية');
      setIsCancelModalOpen(false);
      setCancelReason('');
    },
    onError: (err: any) => {
      toast.error('فشل إلغاء البيع', err.message);
    },
  });

  const resetSaleForm = () => {
    setSelectedCustomerId('');
    setSaleItems([]);
    setOverallDiscount(0);
    setPaidAmount(0);
    setPaymentMethod(PaymentMethod.CASH);
    setSelectedTreasuryId('');
    setSaleNotes('');
    setIsConfirmationStep(false);
  };

  const handleAddLineItem = () => {
    setSaleItems((prev) => [
      ...prev,
      { lineId: '', unitPrice: 0, discount: 0, description: '' },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setSaleItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemLineChange = (index: number, lineId: string) => {
    const line = inStockLines?.items?.find((l: any) => l.id === lineId);
    setSaleItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        lineId,
        unitPrice: line ? line.salePrice : 0,
      };
      return copy;
    });
  };

  // Pure Integer EGP Financial Calculations
  const subtotal = saleItems.reduce((acc, item) => {
    const itemTotal = Math.max(0, (item.unitPrice || 0) - (item.discount || 0));
    return acc + itemTotal;
  }, 0);
  const total = Math.max(0, subtotal - (overallDiscount || 0));
  const remaining = Math.max(0, total - (paidAmount || 0));

  const chosenCustomer = customersData?.items?.find((c: any) => c.id === selectedCustomerId);
  const chosenTreasury = treasuryAccounts?.find((t: any) => t.id === selectedTreasuryId);

  const columns: Column<Sale>[] = [
    {
      header: 'رقم الفاتورة',
      accessorKey: 'saleNumber',
      className: 'font-mono font-bold text-slate-900 dark:text-slate-100',
    },
    {
      header: 'تاريخ البيع',
      cell: (s) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
          {new Date(s.saleDate).toLocaleDateString('ar-EG')}
        </span>
      ),
    },
    {
      header: 'العميل',
      cell: (s) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{s.customer?.name || '—'}</p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {s.customer?.customerCode ? <span className="font-bold text-amber-700 dark:text-gold-400">{s.customer.customerCode} • </span> : null}
            <span className="dir-ltr inline-block">{s.customer?.phone}</span>
          </p>
        </div>
      ),
    },
    {
      header: 'الخطوط المباعة',
      cell: (s) => (
        <span className="font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md text-xs border border-blue-200 dark:border-blue-800">
          {s.items?.length || 0} خط
        </span>
      ),
    },
    {
      header: 'الإجمالي (EGP)',
      cell: (s) => (
        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{Money.format(s.total)}</span>
      ),
    },
    {
      header: 'المسدد فوراً',
      cell: (s) => (
        <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">{Money.format(s.paid)}</span>
      ),
    },
    {
      header: 'المتبقي (مديونية)',
      cell: (s) => (
        <span
          className={`font-bold font-mono ${
            s.remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {Money.format(s.remaining)}
        </span>
      ),
    },
    {
      header: 'الحالة',
      cell: (s) => (
        <Badge variant={getStatusBadgeVariant(s.status)}>{s.status}</Badge>
      ),
    },
    {
      header: 'الإجراءات',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (s) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setSelectedSale(s);
              setIsDetailsModalOpen(true);
            }}
            title="عرض تفاصيل الفاتورة"
            aria-label="عرض تفاصيل الفاتورة"
            className="p-1.5 rounded-lg hover:bg-ivory-200 dark:hover:bg-navy-800 transition-colors group/btn"
          >
            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover/btn:scale-110 transition-transform" />
          </button>

          <button
            onClick={() => {
              setSelectedSale(s);
              setIsDetailsModalOpen(true);
              setTimeout(() => window.print(), 300);
            }}
            title="طباعة الفاتورة"
            aria-label="طباعة الفاتورة"
            className="p-1.5 rounded-lg hover:bg-ivory-200 dark:hover:bg-navy-800 transition-colors group/btn"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover/btn:scale-110 transition-transform" />
          </button>

          {hasPermission(PERMISSIONS.SALES_CANCEL) && s.status === SaleStatus.COMPLETED && (
            <button
              onClick={() => {
                setSelectedSale(s);
                setIsCancelModalOpen(true);
              }}
              title="إلغاء البيع وعكس الفاتورة"
              aria-label="إلغاء البيع وعكس الفاتورة"
              className="p-1.5 rounded-lg hover:bg-ivory-200 dark:hover:bg-navy-800 transition-colors group/btn"
            >
              <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover/btn:scale-110 transition-transform" />
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
          <h1 className="text-2xl font-display font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Icon3D name="sales" size="lg" />
            <span>سجل المبيعات والتعاقدات 🛒</span>
          </h1>
          <p className="text-xs font-sans text-slate-700 dark:text-slate-400 mt-1 font-bold">
            تنفيذ فواتير بيع الخطوط، تسجيل سندات التحصيل الفورية، وقيد المعاملات بالخزائن
          </p>
        </div>

        {hasPermission(PERMISSIONS.SALES_CREATE) && (
          <Button
            variant="gold"
            onClick={() => {
              resetSaleForm();
              handleAddLineItem();
              if (treasuryAccounts && treasuryAccounts.length > 0) {
                setSelectedTreasuryId(treasuryAccounts[0].id);
              }
              setIsCreateModalOpen(true);
            }}
            leftIcon={<Icon3D name="plus" size="xs" />}
          >
            إنشاء فاتورة بيع جديدة
          </Button>
        )}
      </div>

      {/* Contextual Smart Search & Quick Filter Pills Bar */}
      <div className="space-y-2 font-sans">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
          {[
            { label: 'الكل', status: '', searchVal: '' },
            { label: 'فواتير اليوم', status: '', searchVal: 'اليوم' },
            { label: 'مسددة بالكامل', status: 'COMPLETED', searchVal: '' },
            { label: 'متبقي عليها آجل', status: 'PARTIAL', searchVal: '' },
            { label: 'ملغاة / مسترجعة', status: 'CANCELLED', searchVal: '' },
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
                  } else if (search === 'اليوم') {
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
          placeholder="بحث فوري برقم الفاتورة، اسم العميل، أو رقم الهاتف..."
          filteredCount={data?.items?.length || 0}
          totalCount={data?.meta?.totalItems || 0}
          autoFocus
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
                <option value={SaleStatus.COMPLETED}>مكتمل (COMPLETED)</option>
                <option value={SaleStatus.CANCELLED}>ملغى (CANCELLED)</option>
              </Select>
            </div>
          }
        />
      </div>

      {/* Data Table */}
      <Table
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyMessage="لم يتم تسجيل عمليات بيع مطابقة. يمكنك إنشاء أول فاتورة بيع بالضغط على [إنشاء فاتورة بيع جديدة]."
        onRowClick={(s) => {
          setSelectedSale(s);
          setIsDetailsModalOpen(true);
        }}
      />

      <Pagination
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalItems={data?.meta?.totalItems || 0}
        onPageChange={(p) => setPage(p)}
      />

      {/* 1. Modal: Fast Multi-Line Atomic Sale Creation with Pre-Confirmation Step */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="2xl"
        title={isConfirmationStep ? 'مراجعة وتأكيد فاتورة البيع' : 'إنشاء فاتورة بيع جديدة'}
        description={
          isConfirmationStep
            ? 'تأكد من صحة أسعار الخطوط والمبالغ المسددة قبل الاعتماد النهائي'
            : 'اختر العميل والخطوط المتاحة بالمخزن مع تحديد الأسعار والخصومات والدفعة المقدمة'
        }
        footer={
          <>
            {isConfirmationStep ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsConfirmationStep(false)}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  الرجوع للتعديل
                </Button>
                <Button
                  isLoading={createSaleMutation.isPending}
                  onClick={() => {
                    createSaleMutation.mutate({
                      customerId: selectedCustomerId,
                      items: saleItems.map((i) => ({
                        lineId: i.lineId,
                        unitPrice: Number(i.unitPrice) || 0,
                        discount: Number(i.discount) || 0,
                        description: i.description || undefined,
                      })),
                      discount: Number(overallDiscount) || 0,
                      paid: Number(paidAmount) || 0,
                      paymentMethod,
                      treasuryAccountId: paidAmount > 0 ? selectedTreasuryId : undefined,
                      notes: saleNotes.trim() || undefined,
                    });
                  }}
                >
                  اعتماد البيع النهائي ({Money.format(total)})
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={() => {
                    if (!selectedCustomerId) {
                      toast.error('يرجى اختيار العميل أولاً');
                      return;
                    }
                    if (saleItems.length === 0 || saleItems.some((i) => !i.lineId)) {
                      toast.error('يرجى إضافة واختيار الخطوط المراد بيعها');
                      return;
                    }
                    if (paidAmount > total) {
                      toast.error('المبلغ المسدد لا يمكن أن يتجاوز إجمالي الفاتورة');
                      return;
                    }
                    if (paidAmount > 0 && !selectedTreasuryId) {
                      toast.error('يرجى اختيار حساب الخزينة لإيداع الدفعة المقدمة');
                      return;
                    }

                    setIsConfirmationStep(true);
                  }}
                >
                  مراجعة الفاتورة ({Money.format(total)})
                </Button>
              </>
            )}
          </>
        }
      >
        {!isConfirmationStep ? (
          <div className="space-y-5">
            {/* Customer Selection */}
            <Select
              label="العميل المشتري *"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              autoFocus
            >
              <option value="">اختر العميل من السجل...</option>
              {customersData?.items?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) - كود: {c.customerCode}
                </option>
              ))}
            </Select>

            {/* Line Items Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  الخطوط المراد بيعها في الفاتورة ({saleItems.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>إضافة خط آخر للفاتورة</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {saleItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50/50 flex flex-col md:flex-row items-center gap-3">
                    <div className="flex-1 w-full">
                      <Select
                        value={item.lineId}
                        onChange={(e) => handleItemLineChange(idx, e.target.value)}
                      >
                        <option value="">اختر الخط من المخزن المتاح...</option>
                        {inStockLines?.items?.map((line: any) => (
                          <option key={line.id} value={line.id}>
                            {line.phoneNumber} ({line.company?.name}) - سعر البيع: {Money.format(line.salePrice)}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="w-full md:w-32">
                      <Input
                        placeholder="السعر (ج.م)"
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setSaleItems((prev) => {
                            const copy = [...prev];
                            copy[idx].unitPrice = val;
                            return copy;
                          });
                        }}
                      />
                    </div>

                    <div className="w-full md:w-28">
                      <Input
                        placeholder="الخصم (ج.م)"
                        type="number"
                        min="0"
                        value={item.discount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setSaleItems((prev) => {
                            const copy = [...prev];
                            copy[idx].discount = val;
                            return copy;
                          });
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-lg"
                      aria-label="حذف الخط من الفاتورة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Discounts, Upfront Payment & Financial Summary */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  label="خصم إضافي على إجمالي الفاتورة (ج.م)"
                  type="number"
                  min="0"
                  value={overallDiscount}
                  onChange={(e) => setOverallDiscount(parseInt(e.target.value, 10) || 0)}
                />
                <Input
                  label="المبلغ المسدد مقدماً (ج.م)"
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(parseInt(e.target.value, 10) || 0)}
                />
                <Select
                  label="طريقة الدفع"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <option value={PaymentMethod.CASH}>نقدية / كاش (CASH)</option>
                  <option value={PaymentMethod.BANK}>تحويل بنكي (BANK)</option>
                  <option value={PaymentMethod.WALLET}>محفظة إلكترونية (WALLET)</option>
                </Select>
              </div>

              {paidAmount > 0 && (
                <Select
                  label="حساب الخزينة المستلم للدفعة *"
                  value={selectedTreasuryId}
                  onChange={(e) => setSelectedTreasuryId(e.target.value)}
                >
                  <option value="">اختر الخزينة لإيداع المبلغ...</option>
                  {treasuryAccounts?.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (رصيد حالي: {Money.format(acc.currentBalance)})
                    </option>
                  ))}
                </Select>
              )}

              {/* Calculated Real-time Financial Breakdown */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">الإجمالي النهائي: <span className="text-slate-900 text-sm font-extrabold">{Money.format(total)}</span></span>
                <span className="text-emerald-700">المسدد مقدماً: {Money.format(paidAmount)}</span>
                <span className="text-rose-700">المتبقي مديونية: {Money.format(remaining)}</span>
              </div>
            </div>

            <Textarea
              label="ملاحظات وشروط الفاتورة"
              placeholder="أي شروط تعاقدية أو ملاحظات خاصة بالعملية..."
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
            />
          </div>
        ) : (
          /* Step 2: Final Pre-Confirmation View */
          <div className="space-y-5">
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-700 font-bold">العميل المشتري:</span>
                <span className="text-sm font-extrabold text-blue-950">{chosenCustomer?.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">رقم الهاتف:</span>
                <span className="font-mono text-slate-800 dir-ltr">{chosenCustomer?.phone}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2">قائمة الخطوط المختارة:</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">رقم الخط</th>
                      <th className="p-2.5">السعر الفردي</th>
                      <th className="p-2.5">الخصم</th>
                      <th className="p-2.5">الصافي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {saleItems.map((item, idx) => {
                      const line = inStockLines?.items?.find((l: any) => l.id === item.lineId);
                      const net = Math.max(0, item.unitPrice - item.discount);
                      return (
                        <tr key={idx}>
                          <td className="p-2.5 font-mono font-bold dir-ltr">{line?.phoneNumber || '—'}</td>
                          <td className="p-2.5">{Money.format(item.unitPrice)}</td>
                          <td className="p-2.5 text-slate-400">{Money.format(item.discount)}</td>
                          <td className="p-2.5 font-bold text-slate-900">{Money.format(net)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">المجموع الفرعي:</span>
                <span className="font-bold">{Money.format(subtotal)}</span>
              </div>
              {overallDiscount > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>خصم إجمالي:</span>
                  <span className="font-bold">-{Money.format(overallDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>الإجمالي الكلي:</span>
                <span>{Money.format(total)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>الدفعة المسددة مقدماً ({paymentMethod}):</span>
                <span>+{Money.format(paidAmount)}</span>
              </div>
              {paidAmount > 0 && chosenTreasury && (
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>الخزينة المودع بها:</span>
                  <span>{chosenTreasury.name}</span>
                </div>
              )}
              <div className="flex justify-between text-rose-700 font-bold pt-1 border-t border-slate-200">
                <span>المتبقي مديونية على العميل:</span>
                <span>{Money.format(remaining)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. Modal: Sale Details */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        size="lg"
        title={`تفاصيل فاتورة البيع: ${selectedSale?.saleNumber}`}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">العميل</span>
              <p className="text-sm font-bold text-slate-900">{selectedSale?.customer?.name}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">الإجمالي</span>
              <p className="text-sm font-bold text-slate-900">{Money.format(selectedSale?.total || 0)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">المسدد فوراً</span>
              <p className="text-sm font-bold text-emerald-600">{Money.format(selectedSale?.paid || 0)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">المتبقي مديونية</span>
              <p className="text-sm font-bold text-rose-600">{Money.format(selectedSale?.remaining || 0)}</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-2">الخطوط المباعة في هذه الفاتورة</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">رقم الخط</th>
                    <th className="p-2.5">الشركة</th>
                    <th className="p-2.5">السعر</th>
                    <th className="p-2.5">الخصم</th>
                    <th className="p-2.5">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedSale?.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="p-2.5 font-mono font-bold dir-ltr" dir="ltr">{item.line?.phoneNumber}</td>
                      <td className="p-2.5">{item.line?.company?.name}</td>
                      <td className="p-2.5">{Money.format(item.unitPrice)}</td>
                      <td className="p-2.5 text-slate-400">{Money.format(item.discount)}</td>
                      <td className="p-2.5 font-bold text-slate-900">{Money.format(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>

      {/* 3. Modal: Cancel Sale */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={`إلغاء فاتورة البيع: ${selectedSale?.saleNumber}`}
        description="سيتم إرجاع كافة الخطوط المباعة للمخزن بحالة IN_STOCK وعكس أي مدفوعات نقدية بالخزينة"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCancelModalOpen(false)}
            >
              تراجع
            </Button>
            <Button
              variant="danger"
              isLoading={cancelSaleMutation.isPending}
              onClick={() => {
                if (!selectedSale || !cancelReason.trim()) {
                  toast.error('يرجى كتابة سبب إلغاء الفاتورة');
                  return;
                }
                cancelSaleMutation.mutate({
                  id: selectedSale.id,
                  reason: cancelReason.trim(),
                });
              }}
            >
              تأكيد إلغاء البيع وتعويض المخزن
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">تنبيه الحماية المالية وسجل المخزون:</p>
              <p className="mt-1">
                عملية الإلغاء ستولد حركة مرتجع مخزني رسمية وتوثق حركة استرداد مالي بالخزينة للحفاظ على دقة الميزانية وسجل التدقيق.
              </p>
            </div>
          </div>

          <Textarea
            label="سبب الإلغاء والتعويض *"
            placeholder="مثال: رغبة العميل في استبدال الباقة أو إلغاء التعاقد..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
};
