import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { Table, Column } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  TrendingUp,
  FileSpreadsheet,
  Search,
  Users,
  DollarSign,
  AlertOctagon,
  Eye,
  Calendar,
  Phone,
  CreditCard,
  Share2,
  Banknote,
} from 'lucide-react';
import { Money, PERMISSIONS } from '@alkabeer/shared';
import { useAuth } from '../contexts/auth-context';
import { UnifiedPaymentModal } from '../components/finance/UnifiedPaymentModal';
import { CustomerStatementCard, CustomerStatementData } from '../components/finance/CustomerStatementCard';
import { Icon3D } from '../components/icons3d';

interface CustomerDebt {
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string;
  };
  openingBalance?: number;
  unpaidChargesTotal: number;
  unpaidSalesTotal: number;
  totalDebt: number;
  unpaidChargesCount: number;
  unpaidCharges: Array<{
    chargeId: string;
    billingMonth: string;
    dueDate: string;
    phoneNumber: string;
    amount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
  }>;
}

export const ReportsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedDebt, setSelectedDebt] = useState<CustomerDebt | null>(null);

  // Unified Payment & Statement State
  const [payingCustomerId, setPayingCustomerId] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [statementData, setStatementData] = useState<CustomerStatementData | null>(null);
  const [isStatementCardOpen, setIsStatementCardOpen] = useState(false);

  // Fetch Debts Report
  const { data: debts, isLoading } = useQuery<CustomerDebt[]>({
    queryKey: ['customer-debts'],
    queryFn: () => apiClient('/reports/customer-debts'),
  });

  const debtsList: CustomerDebt[] = React.useMemo(() => {
    if (!debts) return [];
    if (Array.isArray(debts)) return debts;
    if (Array.isArray((debts as any).items)) return (debts as any).items;
    return [];
  }, [debts]);

  const filteredDebts = debtsList.filter(
    (d) =>
      d.customer.name.includes(search) ||
      d.customer.phone.includes(search) ||
      d.customer.code.includes(search),
  );

  const totalOutstanding = filteredDebts.reduce(
    (acc, d) => Money.add(acc, d.totalDebt),
    0,
  );

  const handleOpenStatement = (d: CustomerDebt) => {
    setStatementData({
      customer: {
        id: d.customer.id,
        customerCode: d.customer.code,
        name: d.customer.name,
        phone: d.customer.phone,
      },
      lines: d.unpaidCharges.map((ch) => ({
        phoneNumber: ch.phoneNumber,
        monthlyPackage: ch.amount,
        renewalDate: ch.dueDate,
      })),
      openingBalance: d.openingBalance || 0,
      unpaidChargesTotal: d.unpaidChargesTotal,
      unpaidSalesTotal: d.unpaidSalesTotal,
      totalDebt: d.totalDebt,
    });
    setIsStatementCardOpen(true);
  };

  const columns: Column<CustomerDebt>[] = [
    {
      header: 'كود العميل',
      cell: (d) => <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{d.customer.code}</span>,
    },
    {
      header: 'اسم العميل',
      cell: (d) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-sm">{d.customer.name}</p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-300">{d.customer.phone}</p>
        </div>
      ),
    },
    {
      header: 'عدد الفواتير غير المسددة',
      cell: (d) => (
        <Badge variant={d.unpaidChargesCount > 2 ? 'danger' : 'warning'}>
          {d.unpaidChargesCount} شهور متأخرة
        </Badge>
      ),
    },
    {
      header: 'مديونية الفواتير (EGP)',
      cell: (d) => (
        <span className="font-bold text-slate-800 dark:text-slate-100">
          {Money.format(d.unpaidChargesTotal)}
        </span>
      ),
    },
    {
      header: 'متبقي مبيعات مؤجلة (EGP)',
      cell: (d) => (
        <span className="font-bold text-slate-700 dark:text-slate-200">
          {Money.format(d.unpaidSalesTotal)}
        </span>
      ),
    },
    {
      header: 'إجمالي المديونية المستحقة',
      cell: (d) => (
        <span className="font-extrabold text-rose-600 dark:text-rose-400 text-sm">
          {Money.format(d.totalDebt)}
        </span>
      ),
    },
    {
      header: 'الإجراءات والتحصيل',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (d) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {hasPermission(PERMISSIONS.PAYMENTS_CREATE) && (
            <button
              onClick={() => {
                setPayingCustomerId(d.customer.id);
                setIsPaymentModalOpen(true);
              }}
              title="سداد مالي فوري للعميل"
              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-500 text-navy-950 font-extrabold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>سداد</span>
            </button>
          )}

          <button
            onClick={() => handleOpenStatement(d)}
            title="إرسال كشف حساب بصورة احترافية"
            className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-amber-600 dark:text-amber-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSelectedDebt(d)}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
            title="عرض التفاصيل والأشهر"
          >
            تفاصيل
          </Button>
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
            <Icon3D name="reports" size="lg" />
            <span>تقارير المديونيات وكشوف الحسابات 📊</span>
          </h1>
          <p className="text-xs font-sans text-slate-700 dark:text-slate-400 mt-1 font-bold">
            كشف دقيق بمديونيات العملاء ومطابقة الأشهر غير المسددة لكل خط
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-ivory-300/80 dark:border-navy-800 shadow-warm-xs relative overflow-hidden transition-colors flex items-center justify-between">
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-600 rounded-r"></div>
          <div>
            <span className="text-xs font-display text-slate-800 dark:text-slate-200 font-bold">
              💰 إجمالي المديونيات المستحقة للتحصيل
            </span>
            <p className="text-2xl font-extrabold text-rose-800 dark:text-rose-400 mt-1 font-mono">
              {Money.format(totalOutstanding)}
            </p>
          </div>
          <div className="p-1 rounded-xl">
            <Icon3D name="payments" size="lg" />
          </div>
        </div>

        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-ivory-300/80 dark:border-navy-800 shadow-warm-xs relative overflow-hidden transition-colors flex items-center justify-between">
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-navy-900 dark:bg-gold-500 rounded-r"></div>
          <div>
            <span className="text-xs font-display text-slate-800 dark:text-slate-200 font-bold">
              👤 عدد العملاء المدينين
            </span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono">
              {filteredDebts.length} <span className="text-xs font-sans font-bold text-slate-700 dark:text-slate-300">عميل</span>
            </p>
          </div>
          <div className="p-1 rounded-xl">
            <Icon3D name="customers" size="lg" />
          </div>
        </div>

        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-ivory-300/80 dark:border-navy-800 shadow-warm-xs relative overflow-hidden transition-colors flex items-center justify-between">
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-amber-600 rounded-r"></div>
          <div>
            <span className="text-xs font-display text-slate-800 dark:text-slate-200 font-bold">
              🧾 إجمالي الفواتير المتأخرة
            </span>
            <p className="text-2xl font-extrabold text-amber-800 dark:text-amber-400 mt-1 font-mono">
              {filteredDebts.reduce((acc, d) => acc + d.unpaidChargesCount, 0)} <span className="text-xs font-sans font-bold text-slate-700 dark:text-slate-300">فاتورة</span>
            </p>
          </div>
          <div className="p-1 rounded-xl">
            <Icon3D name="expenses" size="lg" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl border border-slate-200/90 dark:border-navy-800 shadow-2xs transition-colors">
        <Input
          placeholder="بحث باسم العميل، الهاتف، أو الكود..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          rightIcon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Data Table */}
      <Table
        columns={columns}
        data={filteredDebts}
        isLoading={isLoading}
        emptyMessage="ممتاز! لا توجد مديونيات متأخرة على العملاء حالياً."
      />

      {/* Modal: Breakdown Details by Month */}
      <Modal
        isOpen={!!selectedDebt}
        onClose={() => setSelectedDebt(null)}
        size="lg"
        title={`كشف تفصيلي بمديونية العميل: ${selectedDebt?.customer.name}`}
        description={`إجمالي المديونية: ${Money.format(selectedDebt?.totalDebt || 0)} ج.م`}
        footer={
          selectedDebt ? (
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleOpenStatement(selectedDebt);
                }}
                leftIcon={<Share2 className="w-4 h-4 text-amber-500" />}
              >
                📤 إرسال كشف الحساب
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedDebt(null)}>
                  إغلاق
                </Button>
                {hasPermission(PERMISSIONS.PAYMENTS_CREATE) && (
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => {
                      setPayingCustomerId(selectedDebt.customer.id);
                      setSelectedDebt(null);
                      setIsPaymentModalOpen(true);
                    }}
                    leftIcon={<CreditCard className="w-4 h-4 text-navy-950" />}
                    className="font-extrabold text-navy-950 px-4"
                  >
                    💰 سداد الآن ({Money.format(selectedDebt.totalDebt)} ج.م)
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">الأشهر غير المسددة وتفاصيل الاستحقاق:</h4>

          <div className="border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-navy-950 text-slate-600 dark:text-amber-400 border-b border-slate-200 dark:border-navy-700 font-bold">
                <tr>
                  <th className="p-2.5">شهر الفاتورة</th>
                  <th className="p-2.5">رقم الخط</th>
                  <th className="p-2.5">تاريخ الاستحقاق</th>
                  <th className="p-2.5">المبلغ الكلي</th>
                  <th className="p-2.5">المسدد منه</th>
                  <th className="p-2.5">المتبقي المطلوب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800 bg-white dark:bg-navy-900 text-slate-800 dark:text-slate-100">
                {selectedDebt?.unpaidCharges.map((ch) => (
                  <tr key={ch.chargeId} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                    <td className="p-2.5 font-bold font-mono text-slate-900 dark:text-white">{ch.billingMonth}</td>
                    <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200" dir="ltr">{ch.phoneNumber}</td>
                    <td className="p-2.5 text-slate-500 dark:text-slate-400">{new Date(ch.dueDate).toLocaleDateString('ar-EG')}</td>
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100">{Money.format(ch.amount)}</td>
                    <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-bold">{Money.format(ch.paidAmount)}</td>
                    <td className="p-2.5 font-bold text-rose-600 dark:text-rose-400">{Money.format(ch.remainingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
