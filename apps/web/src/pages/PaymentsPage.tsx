import React, { useState } from 'react';
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
  CreditCard,
  Plus,
  Search,
  Eye,
  RotateCcw,
  Landmark,
  FileCheck,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  Printer,
} from 'lucide-react';
import { PaymentMethod, PERMISSIONS, Money } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface PaymentAllocation {
  id: string;
  amount: number;
  charge?: {
    id: string;
    billingMonth: string;
    amount: number;
    paidAmount: number;
    status: string;
    line?: { phoneNumber: string };
  };
}

interface Payment {
  id: string;
  paymentNumber: string;
  customerId: string;
  saleId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  reference?: string;
  notes?: string;
  isReversed: boolean;
  reversalReason?: string;
  customer?: { id: string; name: string; phone: string; customerCode: string };
  allocations?: PaymentAllocation[];
}

export const PaymentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  // Form states
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formMethod, setFormMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [formTreasuryId, setFormTreasuryId] = useState('');
  const [formReference, setFormReference] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // 1. Fetch Payments List with Instant Search
  const { data, isLoading } = useQuery<{ items: Payment[]; meta: any }>({
    queryKey: ['payments', page, search],
    queryFn: () =>
      apiClient(
        `/payments?page=${page}&limit=15&search=${encodeURIComponent(search)}`,
      ),
  });

  // 2. Fetch Customers for Payment Collection
  const { data: customersData } = useQuery({
    queryKey: ['active-customers'],
    queryFn: () => apiClient('/customers?limit=100&status=ACTIVE'),
    enabled: isCreateModalOpen,
  });

  // 3. Fetch Selected Customer's Debt Details for Instant Autofill
  const { data: selectedCustomerDetails } = useQuery({
    queryKey: ['customer-details-for-payment', formCustomerId],
    queryFn: () => apiClient(`/customers/${formCustomerId}`),
    enabled: !!formCustomerId && isCreateModalOpen,
  });

  // 4. Fetch Treasury Accounts for Inflow
  const { data: treasuryAccounts } = useQuery({
    queryKey: ['treasury-accounts'],
    queryFn: () => apiClient('/treasury/accounts'),
    enabled: isCreateModalOpen,
  });

  // Calculate selected customer's total unpaid debt
  const totalCustomerDebt = selectedCustomerDetails?.monthlyCharges?.reduce((acc: number, ch: any) => {
    return acc + Money.subtract(ch.amount, ch.paidAmount);
  }, 0) || 0;

  // Create Payment Mutation
  const createPaymentMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-charges'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-accounts'] });
      toast.success('تم تسجيل التحصيل وتوزيع الـ FIFO على الفواتير وإيداع المبلغ بنجاح');
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('فشل تسجيل التحصيل', err.message);
    },
  });

  // Reverse Payment Mutation
  const reversePaymentMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient(`/payments/${id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-charges'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-accounts'] });
      toast.success('تم عكس التحصيل واستعادة الفواتير المستحقة وقيد حركة الاسترداد');
      setIsReverseModalOpen(false);
      setReverseReason('');
    },
    onError: (err: any) => {
      toast.error('فشل عكس التحصيل', err.message);
    },
  });

  const resetForm = () => {
    setFormCustomerId('');
    setFormAmount(0);
    setFormMethod(PaymentMethod.CASH);
    setFormTreasuryId(treasuryAccounts && treasuryAccounts.length > 0 ? treasuryAccounts[0].id : '');
    setFormReference('');
    setFormNotes('');
  };

  const columns: Column<Payment>[] = [
    {
      header: 'رقم السند',
      accessorKey: 'paymentNumber',
      className: 'font-mono font-bold text-slate-900 dark:text-slate-100',
    },
    {
      header: 'تاريخ التحصيل',
      cell: (p) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
          {new Date(p.paymentDate).toLocaleDateString('ar-EG')}
        </span>
      ),
    },
    {
      header: 'العميل المسدد',
      cell: (p) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{p.customer?.name || '—'}</p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {p.customer?.customerCode ? <span className="font-bold text-amber-700 dark:text-gold-400">{p.customer.customerCode} • </span> : null}
            <span className="dir-ltr inline-block">{p.customer?.phone}</span>
          </p>
        </div>
      ),
    },
    {
      header: 'المبلغ المحصل (EGP)',
      cell: (p) => (
        <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-sm">
          +{Money.format(p.amount)}
        </span>
      ),
    },
    {
      header: 'طريقة الدفع',
      cell: (p) => (
        <Badge variant="neutral">{p.paymentMethod}</Badge>
      ),
    },
    {
      header: 'الفواتير المغطاة',
      cell: (p) => (
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
          {p.allocations?.length || 0} فواتير
        </span>
      ),
    },
    {
      header: 'الحالة المحاسبية',
      cell: (p) =>
        p.isReversed ? (
          <Badge variant="danger">معكوس (REVERSED)</Badge>
        ) : (
          <Badge variant="success">مؤكد (SETTLED)</Badge>
        ),
    },
    {
      header: 'الإجراءات',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (p) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setSelectedPayment(p);
              setIsDetailsModalOpen(true);
            }}
            title="عرض توزيعات وتفاصيل السند"
            aria-label="عرض توزيعات وتفاصيل السند"
            className="p-1.5 rounded-lg hover:bg-ivory-200 dark:hover:bg-navy-800 transition-colors group/btn"
          >
            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover/btn:scale-110 transition-transform" />
          </button>

          <button
            onClick={() => {
              setSelectedPayment(p);
              setIsDetailsModalOpen(true);
              setTimeout(() => window.print(), 300);
            }}
            title="طباعة إيصال السند"
            aria-label="طباعة إيصال السند"
            className="p-1.5 rounded-lg hover:bg-ivory-200 dark:hover:bg-navy-800 transition-colors group/btn"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover/btn:scale-110 transition-transform" />
          </button>

          {hasPermission(PERMISSIONS.PAYMENTS_REVERSE) && !p.isReversed && (
            <button
              onClick={() => {
                setSelectedPayment(p);
                setIsReverseModalOpen(true);
              }}
              title="عكس السند المالي"
              aria-label="عكس السند المالي"
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
            <Icon3D name="payments" size="lg" />
            <span>سندات التحصيل والمدفوعات 💰</span>
          </h1>
          <p className="text-xs font-sans text-slate-700 dark:text-slate-400 mt-1 font-bold">
            إيداع التحصيلات النقدية والبنكية مع التوزيع الآلي على أقدم الاستحقاقات الشهرية (FIFO)
          </p>
        </div>

        {hasPermission(PERMISSIONS.PAYMENTS_CREATE) && (
          <Button
            variant="gold"
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            leftIcon={<Icon3D name="plus" size="xs" />}
          >
            تسجيل سند تحصيل جديد
          </Button>
        )}
      </div>

      {/* Contextual Smart Search & Quick Filter Pills Bar */}
      <div className="space-y-2 font-sans">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
          {[
            { label: 'الكل', searchVal: '' },
            { label: 'تحصيلات اليوم', searchVal: 'اليوم' },
            { label: 'كاش / نقدي', searchVal: 'CASH' },
            { label: 'تحويل بنكي', searchVal: 'BANK' },
            { label: 'محفظة كاش', searchVal: 'WALLET' },
            { label: 'سندات معكوسة', searchVal: 'معكوس' },
          ].map((pill) => {
            const isActive = search === pill.searchVal;
            return (
              <button
                key={pill.label}
                onClick={() => {
                  setSearch(pill.searchVal);
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
          placeholder="بحث فوري برقم السند، اسم العميل، أو رقم الهاتف..."
          filteredCount={data?.items?.length || 0}
          totalCount={data?.meta?.totalItems || 0}
          autoFocus
        />
      </div>

      {/* Data Table */}
      <Table
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyMessage="لم يتم العثور على سندات تحصيل مطابقة. يمكنك تسجيل سند تحصيل جديد بالضغط على زر [تسجيل سند تحصيل جديد]."
        onRowClick={(p) => {
          setSelectedPayment(p);
          setIsDetailsModalOpen(true);
        }}
      />

      <Pagination
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalItems={data?.meta?.totalItems || 0}
        onPageChange={(p) => setPage(p)}
      />

      {/* 1. Modal: Fast Payment Collection with Live Debt Preview */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="lg"
        title="تسجيل سند تحصيل مالي (FIFO Allocation)"
        description="يقوم النظام تلقائياً بتوزيع المبلغ على أقدم الفواتير المستحقة للعميل"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              isLoading={createPaymentMutation.isPending}
              onClick={() => {
                if (!formCustomerId || formAmount <= 0 || !formTreasuryId) {
                  toast.error('يرجى اختيار العميل وتحديد المبلغ (> 0) واختيار الخزينة');
                  return;
                }

                createPaymentMutation.mutate({
                  customerId: formCustomerId,
                  amount: Number(formAmount),
                  paymentMethod: formMethod,
                  treasuryAccountId: formTreasuryId,
                  reference: formReference.trim() || undefined,
                  notes: formNotes.trim() || undefined,
                });
              }}
            >
              تأكيد التحصيل والإيداع ({Money.format(formAmount)})
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="العميل المسدد *"
            value={formCustomerId}
            onChange={(e) => {
              setFormCustomerId(e.target.value);
            }}
            autoFocus
          >
            <option value="">اختر العميل من القائمة...</option>
            {customersData?.items?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone}) - كود: {c.customerCode}
              </option>
            ))}
          </Select>

          {/* Customer Debt Insight Card */}
          {formCustomerId && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-amber-800 font-semibold">إجمالي المديونية المستحقة على العميل:</span>
                <p className="text-base font-extrabold text-amber-950 mt-0.5">
                  {Money.format(totalCustomerDebt)}
                </p>
              </div>

              {totalCustomerDebt > 0 && (
                <button
                  type="button"
                  onClick={() => setFormAmount(totalCustomerDebt)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-sm transition-colors"
                >
                  سداد كامل المديونية
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="المبلغ المحصل (ج.م صحيح) *"
              type="number"
              min="1"
              value={formAmount}
              onChange={(e) => setFormAmount(parseInt(e.target.value, 10) || 0)}
            />
            <Select
              label="طريقة التحصيل *"
              value={formMethod}
              onChange={(e) => setFormMethod(e.target.value as PaymentMethod)}
            >
              <option value={PaymentMethod.CASH}>نقدية / كاش (CASH)</option>
              <option value={PaymentMethod.BANK}>تحويل بنكي (BANK)</option>
              <option value={PaymentMethod.WALLET}>محفظة إلكترونية (WALLET)</option>
              <option value={PaymentMethod.OTHER}>أخرى (OTHER)</option>
            </Select>
          </div>

          <Select
            label="حساب الخزينة المستلم للإيداع *"
            value={formTreasuryId}
            onChange={(e) => setFormTreasuryId(e.target.value)}
          >
            <option value="">اختر الخزينة لتسجيل حركة الإيداع...</option>
            {treasuryAccounts?.map((acc: any) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} (رصيد حالي: {Money.format(acc.currentBalance)})
              </option>
            ))}
          </Select>

          <Input
            label="رقم المرجع البنكي / إشعار التحويل (اختياري)"
            placeholder="مثال: Bank Ref #123456"
            value={formReference}
            onChange={(e) => setFormReference(e.target.value)}
            dir="ltr"
          />

          <Textarea
            label="ملاحظات السند"
            placeholder="ملاحظات إضافية..."
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* 2. Modal: View Allocations */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        size="lg"
        title={`تفاصيل سند التحصيل: ${selectedPayment?.paymentNumber}`}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">العميل</span>
              <p className="text-sm font-bold text-slate-900">{selectedPayment?.customer?.name}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">المبلغ المحصل</span>
              <p className="text-sm font-bold text-emerald-600">{Money.format(selectedPayment?.amount || 0)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">الحالة المحاسبية</span>
              <p className="text-sm font-bold">
                {selectedPayment?.isReversed ? 'معكوس' : 'مؤكد'}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>توزيع المبلغ على الفواتير الشهرية بنظام FIFO</span>
            </h4>

            {selectedPayment?.allocations?.length === 0 ? (
              <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-xl text-center">
                لم يتم ربط هذا السند بفواتير شهرية سابقة (تحصيل مباشر أو مقدم).
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">شهر الفاتورة</th>
                      <th className="p-2.5">رقم الخط</th>
                      <th className="p-2.5">المبلغ المخصص من السند</th>
                      <th className="p-2.5">حالة الفاتورة بعد التخصيص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPayment?.allocations?.map((alloc) => (
                      <tr key={alloc.id}>
                        <td className="p-2.5 font-bold font-mono">{alloc.charge?.billingMonth}</td>
                        <td className="p-2.5 font-mono dir-ltr">{alloc.charge?.line?.phoneNumber}</td>
                        <td className="p-2.5 font-bold text-emerald-600">{Money.format(alloc.amount)}</td>
                        <td className="p-2.5">
                          <Badge variant={getStatusBadgeVariant(alloc.charge?.status || '')}>
                            {alloc.charge?.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* 3. Modal: Reverse Payment with Specific Consequence Warning */}
      <Modal
        isOpen={isReverseModalOpen}
        onClose={() => setIsReverseModalOpen(false)}
        title={`عكس سند التحصيل: ${selectedPayment?.paymentNumber}`}
        description="سيتم إلغاء التخصيص واستعادة الفواتير لحالة غير مسددة وخصم المبلغ من الخزينة بحركة استرداد رسمية"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsReverseModalOpen(false)}
            >
              تراجع
            </Button>
            <Button
              variant="danger"
              isLoading={reversePaymentMutation.isPending}
              onClick={() => {
                if (!selectedPayment || !reverseReason.trim()) {
                  toast.error('يرجى كتابة سبب عكس السند');
                  return;
                }
                reversePaymentMutation.mutate({
                  id: selectedPayment.id,
                  reason: reverseReason.trim(),
                });
              }}
            >
              تأكيد عكس السند ({Money.format(selectedPayment?.amount || 0)})
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">أثر المعاملة المحاسبية المعكوسة:</p>
              <p className="mt-1">
                سيتم إعادة الفواتير التي غطاها هذا السند إلى حالة غير مسددة، وسيتم قيد حركة سحب استرداد من الخزينة وتوثيق العملية في سجل التدقيق الأمني.
              </p>
            </div>
          </div>

          <Textarea
            label="سبب عكس السند المالي *"
            placeholder="مثال: خطأ في إدخال المبلغ أو إيداع مكرر من العميل..."
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
};
