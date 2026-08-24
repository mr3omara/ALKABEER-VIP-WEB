import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  FileText,
  Filter,
  Calendar,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Money } from '@alkabeer/shared';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/ui/Button';
import { Icon3D } from '../components/icons3d';
import { CustomerStatementCard, CustomerStatementData } from '../components/finance/CustomerStatementCard';

interface LedgerEntry {
  id: string;
  transactionNumber: string;
  transactionType: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  transactionDate: string;
  creator?: { fullName: string };
  customer?: { id: string; name: string; customerCode: string; phone?: string };
}

interface LedgerTotals {
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

export function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [totals, setTotals] = useState<LedgerTotals>({ totalDebit: 0, totalCredit: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);
  
  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [direction, setDirection] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Statement Card Modal
  const [selectedCustomerForStatement, setSelectedCustomerForStatement] = useState<CustomerStatementData | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  const fetchLedger = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    if (search.trim()) params.set('search', search.trim());
    if (transactionType) params.set('transactionType', transactionType);
    if (direction !== 'ALL') params.set('direction', direction);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    apiClient(`/ledger?${params.toString()}`)
      .then((res: any) => {
        setEntries(res.items || []);
        if (res.totals) setTotals(res.totals);
        if (res.meta) {
          setTotalPages(res.meta.totalPages || 1);
          setTotalItems(res.meta.totalItems || 0);
        }
      })
      .catch((err) => console.error('Failed to fetch ledger:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLedger();
  }, [page, limit, transactionType, direction, dateFrom, dateTo]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLedger();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleResetFilters = () => {
    setSearch('');
    setTransactionType('');
    setDirection('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleOpenStatement = (cust: { id: string; name: string; customerCode: string; phone?: string }) => {
    setSelectedCustomerForStatement({
      customer: {
        id: cust.id,
        name: cust.name,
        customerCode: cust.customerCode,
        phone: cust.phone,
      },
    });
    setIsStatementOpen(true);
  };

  const getBadgeDetails = (type: string) => {
    switch (type) {
      case 'INVOICE':
        return { label: 'فاتورة / استحقاق', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' };
      case 'PAYMENT':
        return { label: 'سداد نقدي', color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' };
      case 'CREDIT_BALANCE':
        return { label: 'رصيد دائن زائد', color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' };
      case 'CREDIT_USAGE':
        return { label: 'استخدام رصيد دائن', color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' };
      case 'OPENING_BALANCE':
        return { label: 'رصيد افتتاحي', color: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800' };
      case 'REVERSAL':
        return { label: 'إلغاء / عكس حركة', color: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' };
      default:
        return { label: type, color: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-navy-800 dark:text-slate-200' };
    }
  };

  return (
    <div className="space-y-6 font-sans pb-12" dir="rtl">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-navy-900 p-6 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-sm transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-gold-600 flex items-center justify-center text-white shadow-gold-sm">
            <Icon3D name="reports" size="md" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-kufi font-black text-navy-950 dark:text-white">
                📒 دفتر الأستاذ العام (General Ledger)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-gold-400 border border-amber-300 dark:border-amber-800">
                المصدر المحاسبي الموحد
              </span>
            </div>
            <p className="text-xs font-tajawal text-slate-500 dark:text-slate-400 mt-1">
              سجل تفصيلي دقيق لجميع القيود، الفواتير، السدادات، والأرصدة الدائنة مع الحسابات الجارية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLedger}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs border-slate-300 dark:border-navy-700"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Movements */}
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي الحركات المسجلة</p>
              <h3 className="text-2xl font-black text-navy-950 dark:text-white mt-1 font-mono">
                {totalItems.toLocaleString('ar-EG')}
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
            <span>قيود موثقة في دفتر الأستاذ</span>
          </p>
        </div>

        {/* Total Debits (عليه) */}
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">إجمالي المدين (الاستحقاقات)</p>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">
                {Money.format(totals.totalDebit)} <span className="text-xs font-sans">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
            <span>فواتير ومبيعات ومطالبات</span>
          </p>
        </div>

        {/* Total Credits (له) */}
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">إجمالي الدائن (السدادات)</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {Money.format(totals.totalCredit)} <span className="text-xs font-sans">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
            <span>تحصيلات وسدادات نقدية وبنكية</span>
          </p>
        </div>

        {/* Net Ledger Position */}
        <div className="bg-white dark:bg-navy-900 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gold-600 dark:text-gold-400">صافي رصيد الحسابات</p>
              <h3 className={`text-2xl font-black mt-1 font-mono ${totals.netBalance > 0 ? 'text-rose-600 dark:text-rose-400' : totals.netBalance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-navy-950 dark:text-white'}`}>
                {Money.format(Math.abs(totals.netBalance))} <span className="text-xs font-sans">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-gold-50 dark:bg-gold-950/50 rounded-xl text-gold-600 dark:text-gold-400 border border-gold-200 dark:border-gold-800">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-semibold">
            {totals.netBalance > 0 ? '⚠️ صافي مديونية مستحقة على العملاء' : totals.netBalance < 0 ? '✨ صافي أرصدة دائنة للعملاء' : '✨ الحسابات مطابقة تماماً'}
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-navy-900 p-4.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-sm space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث برقم الحركة، اسم العميل، الكود، أو البيان..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none transition-all"
            />
          </div>

          {/* Transaction Type Filter */}
          <div>
            <select
              value={transactionType}
              onChange={(e) => {
                setTransactionType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none"
            >
              <option value="">جميع أنواع الحركات</option>
              <option value="INVOICE">فاتورة / استحقاق شهري</option>
              <option value="PAYMENT">سداد نقدي / بنكي</option>
              <option value="CREDIT_BALANCE">رصيد دائن زائد (Overpayment)</option>
              <option value="CREDIT_USAGE">استخدام رصيد دائن</option>
              <option value="OPENING_BALANCE">رصيد افتتاحي</option>
              <option value="REVERSAL">إلغاء / عكس حركة</option>
            </select>
          </div>

          {/* Direction Filter */}
          <div>
            <select
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-none"
            >
              <option value="ALL">الكل (مدين ودائن)</option>
              <option value="DEBIT">مدين فقط (عليه)</option>
              <option value="CREDIT">دائن فقط (له)</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="w-full h-10 border-slate-200 dark:border-navy-700 text-xs flex items-center justify-center gap-1 text-slate-600 dark:text-slate-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط</span>
            </Button>
          </div>
        </div>

        {/* Date Range Sub-row */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 dark:border-navy-800 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-bold">من تاريخ:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-bold">إلى تاريخ:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 dark:bg-navy-950/80 border-b border-slate-200 dark:border-navy-800 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="p-3.5">التاريخ والوقت</th>
                <th className="p-3.5">رقم السند</th>
                <th className="p-3.5">العميل</th>
                <th className="p-3.5">نوع الحركة</th>
                <th className="p-3.5">البيان المحاسبي</th>
                <th className="p-3.5 text-center">مدين (عليه)</th>
                <th className="p-3.5 text-center">دائن (له)</th>
                <th className="p-3.5 text-center">الرصيد بعد الحركة</th>
                <th className="p-3.5">المسؤول</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 rounded-full border-2 border-gold-500 border-t-transparent animate-spin" />
                      <span>جاري تحميل بيانات دفتر الأستاذ العام...</span>
                    </div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    لا توجد قيود أو حركات تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const badge = getBadgeDetails(entry.transactionType);
                  return (
                    <tr key={entry.id} className="hover:bg-gold-50/20 dark:hover:bg-navy-800/50 transition-colors">
                      {/* Date */}
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {new Date(entry.transactionDate).toLocaleString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Transaction Number */}
                      <td className="p-3.5 font-mono text-xs font-bold text-navy-900 dark:text-gold-400 whitespace-nowrap">
                        {entry.transactionNumber}
                      </td>

                      {/* Customer */}
                      <td className="p-3.5">
                        {entry.customer ? (
                          <div>
                            <span className="font-bold text-navy-900 dark:text-slate-100 block">
                              {entry.customer.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <span className="font-mono">{entry.customer.customerCode}</span>
                              {entry.customer.phone && <span>• {entry.customer.phone}</span>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">حساب عام</span>
                        )}
                      </td>

                      {/* Transaction Type Badge */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="p-3.5 text-slate-800 dark:text-slate-200 max-w-xs truncate" title={entry.description}>
                        {entry.description}
                      </td>

                      {/* Debit */}
                      <td className="p-3.5 text-center font-bold text-rose-600 dark:text-rose-400 font-mono text-sm">
                        {entry.debit > 0 ? Money.format(entry.debit) : '-'}
                      </td>

                      {/* Credit */}
                      <td className="p-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                        {entry.credit > 0 ? Money.format(entry.credit) : '-'}
                      </td>

                      {/* Balance After */}
                      <td className="p-3.5 text-center font-black font-mono text-sm whitespace-nowrap" dir="ltr">
                        <span className={entry.balanceAfter > 0 ? 'text-rose-600 dark:text-rose-400' : entry.balanceAfter < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}>
                          {Money.format(Math.abs(entry.balanceAfter))}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1 font-sans">
                          {entry.balanceAfter > 0 ? 'مدين' : entry.balanceAfter < 0 ? 'دائن' : 'خالص'}
                        </span>
                      </td>

                      {/* User */}
                      <td className="p-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                        {entry.creator?.fullName || 'النظام'}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {entry.customer && (
                          <button
                            type="button"
                            onClick={() => handleOpenStatement(entry.customer!)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-gold-600 hover:bg-gold-50 dark:hover:bg-navy-800 transition-colors"
                            title="عرض ومشاركة كشف الحساب التفصيلي"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50/80 dark:bg-navy-950/80 border-t border-slate-200 dark:border-navy-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span>عرض</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span>من إجمالي {totalItems.toLocaleString('ar-EG')} قيد</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-8 px-2.5 border-slate-200 dark:border-navy-700"
            >
              <ChevronRight className="w-4 h-4 ml-1" />
              <span>السابق</span>
            </Button>
            <span className="font-bold px-2 text-slate-700 dark:text-slate-200">
              صفحة {page} من {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 px-2.5 border-slate-200 dark:border-navy-700"
            >
              <span>التالي</span>
              <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Customer Statement Modal */}
      {selectedCustomerForStatement && (
        <CustomerStatementCard
          isOpen={isStatementOpen}
          onClose={() => setIsStatementOpen(false)}
          data={selectedCustomerForStatement}
        />
      )}
    </div>
  );
}

export default LedgerPage;
