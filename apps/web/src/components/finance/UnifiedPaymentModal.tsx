import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../ui/Toast';
import {
  Receipt,
  Share2,
  CheckCircle2,
  X,
  Smartphone,
  Banknote,
  WalletCards,
  UserCheck,
  Lock,
  RotateCw,
  AlertCircle,
  PhoneCall,
} from 'lucide-react';
import { PaymentMethod, Money } from '@alkabeer/shared';
import { PaymentReceiptCard, PaymentReceiptData } from './PaymentReceiptCard';
import { CustomerStatementCard } from './CustomerStatementCard';

export interface UnifiedPaymentModalProps {
  customerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  initialAmount?: number;
  customerName?: string;
  customerCode?: string;
}

export const UnifiedPaymentModal: React.FC<UnifiedPaymentModalProps> = ({
  customerId,
  isOpen,
  onClose,
  initialAmount,
  customerName: initialName,
  customerCode: initialCode,
}) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Form State
  const [paidAmount, setPaidAmount] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [notes, setNotes] = useState('سداد اشتراكات شهرية / تسوية حساب');

  // Sub-Modals State
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // 1. Fetch Full Customer 360 Details for selected customer
  const { data: customerDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['customer-360-collection-details', customerId],
    queryFn: () => apiClient(`/customers/${customerId}`),
    enabled: isOpen && !!customerId,
  });

  // 2. Fetch Active Treasury Accounts (silent default selection)
  const { data: treasuryAccounts } = useQuery<any[]>({
    queryKey: ['treasury-accounts-collection'],
    queryFn: () => apiClient('/treasury/accounts'),
    enabled: isOpen,
  });

  const defaultTreasuryId = treasuryAccounts && treasuryAccounts.length > 0 ? treasuryAccounts[0].id : undefined;

  // 1. Structural Financial Breakdown Calculations
  const monthlyPackageTotal = useMemo(() => {
    if (!customerDetails?.lines || customerDetails.lines.length === 0) return 0;
    return customerDetails.lines.reduce((acc: number, l: any) => acc + (l.monthlyPackage || 0), 0);
  }, [customerDetails]);

  const arrearsTotal = useMemo(() => {
    const openingBal = customerDetails?.openingBalance || 0;
    const unpaidSales = customerDetails?.sales
      ? customerDetails.sales
          .filter((s: any) => s.remaining > 0 && s.status !== 'CANCELLED')
          .reduce((acc: number, s: any) => acc + (s.remaining || 0), 0)
      : 0;
    return openingBal + unpaidSales;
  }, [customerDetails]);

  const extraPackagesTotal = useMemo(() => {
    if (!customerDetails?.monthlyCharges) return 0;
    return customerDetails.monthlyCharges
      .filter((ch: any) => ch.status === 'DUE' || ch.status === 'PARTIALLY_PAID')
      .reduce((acc: number, ch: any) => acc + Money.subtract(ch.amount, ch.paidAmount), 0);
  }, [customerDetails]);

  // Total Due: Highlighted sum
  const totalDue = useMemo(() => {
    return monthlyPackageTotal + arrearsTotal + extraPackagesTotal;
  }, [monthlyPackageTotal, arrearsTotal, extraPackagesTotal]);

  const currentBalance = customerDetails?.cachedBalance || 0;
  const customerCredit = currentBalance < 0 ? Math.abs(currentBalance) : 0;

  // Auto-fill paidAmount when customer details load or initialAmount is passed
  useEffect(() => {
    if (isOpen) {
      if (initialAmount && initialAmount > 0) {
        setPaidAmount(initialAmount);
      } else if (customerDetails) {
        setPaidAmount(totalDue > 0 ? totalDue : (customerCredit > 0 ? 0 : ''));
      }
    }
  }, [isOpen, initialAmount, customerDetails, totalDue, customerCredit]);

  const handleResetAmount = () => {
    setPaidAmount(totalDue);
  };

  // Real-Time Calculation Logic
  const numericPaid = Number(paidAmount) || 0;
  const surplusAmount = Math.max(0, numericPaid - totalDue);
  const remainingDue = Math.max(0, totalDue - numericPaid);
  const finalCreditBalance = Money.add(customerCredit, surplusAmount);

  // Payment Mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) {
        throw new Error('معرف العميل غير محدد');
      }
      if (numericPaid <= 0) {
        throw new Error('مبلغ السداد يجب أن يكون أكبر من صفر');
      }

      return apiClient('/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          amount: Math.round(numericPaid),
          paymentMethod,
          treasuryAccountId: defaultTreasuryId,
          notes: notes.trim() || 'سداد اشتراكات شهرية / تسوية حساب',
        }),
      });
    },
    onSuccess: (res) => {
      toast.success('تم تسجيل عملية التحصيل والسداد بنجاح وتحديث الحسابات المالية!');

      // Prepare Receipt Data
      const selectedTreasury = treasuryAccounts?.find((t) => t.id === defaultTreasuryId);
      setReceiptData({
        paymentNumber: res?.paymentNumber || `REC-${Date.now().toString().slice(-6)}`,
        paymentDate: res?.paymentDate || new Date().toISOString(),
        amount: Math.round(numericPaid),
        paymentMethod: paymentMethod === PaymentMethod.CASH ? 'كاش نقدي' : paymentMethod === PaymentMethod.WALLET ? 'فودافون كاش' : 'انستاباي (InstaPay)',
        treasuryName: selectedTreasury?.name || 'الخزينة الرئيسية',
        customer: {
          id: customerId!,
          customerCode: customerDetails?.customerCode || initialCode || 'KA-xxxx',
          name: customerDetails?.name || customerDetails?.fullName || initialName || 'عميل',
          phone: customerDetails?.phone || '',
        },
        debtBeforePayment: totalDue,
        remainingDebt: remainingDue,
        customerCreditBefore: customerCredit,
        newCreditCreated: surplusAmount,
        finalCreditBalance: finalCreditBalance,
        lines: customerDetails?.lines?.map((l: any) => ({
          phoneNumber: l.phoneNumber,
          companyCode: l.company?.code || 'عام',
          packageName: l.monthlyPackage ? `${l.monthlyPackage} ج.م` : undefined,
        })) || [],
        notes: notes.trim() || undefined,
      });

      // Real-time Cache Invalidation for all related screens
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-360-collection-details'] });
      queryClient.invalidateQueries({ queryKey: ['customer-360-details'] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });

      // Open Receipt Card
      setIsReceiptOpen(true);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'فشلت عملية التحصيل، يرجى التحقق من البيانات والمحاولة مجدداً');
    },
  });

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans text-slate-100" dir="rtl">
        {/* إخفاء أسهم الإدخال الرقمي */}
        <style>{`
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="number"] {
            -moz-appearance: textfield;
          }
        `}</style>

        <div className="relative w-full max-w-xl bg-[#090f1d] border border-blue-500/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0c1424]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">سداد مالي وتحصيل مديونية (VIP Settlement)</h2>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-3.5 overflow-y-auto max-h-[82vh] custom-scrollbar">
            {isDetailsLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <span>جاري استدعاء الملف المالي والحسابات للعميل...</span>
              </div>
            ) : customerDetails ? (
              <>
                {/* شريط العميل */}
                <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                      <PhoneCall className="w-3 h-3" />
                      {customerDetails.lines?.length || 0} خطوط مسجلة
                    </span>
                    <button 
                      onClick={handleResetAmount}
                      title="إعادة ضبط القيمة"
                      className="p-1 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs font-bold text-slate-100">{customerDetails.name || customerDetails.fullName || initialName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20 font-bold">
                          {customerDetails.customerCode || initialCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {customerDetails.phone || 'بدون هاتف'}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <UserCheck className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* مربعات المديونية الأربعة */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-2.5 text-center">
                    <span className="block text-[10px] text-slate-400 mb-1">إجمالي الباقة الشهرية</span>
                    <span className="text-xs font-bold font-mono text-slate-200">
                      {monthlyPackageTotal.toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">ج.م</span>
                    </span>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-2.5 text-center">
                    <span className="block text-[10px] text-slate-400 mb-1">المتأخرات</span>
                    <span className={`text-xs font-bold font-mono ${arrearsTotal > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {arrearsTotal.toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">ج.م</span>
                    </span>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-2.5 text-center">
                    <span className="block text-[10px] text-slate-400 mb-1">الباقات الإضافية</span>
                    <span className="text-xs font-bold font-mono text-cyan-400">
                      {extraPackagesTotal.toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">ج.م</span>
                    </span>
                  </div>

                  <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-2.5 text-center shadow-sm">
                    <span className="block text-[10px] text-rose-300 font-bold mb-1">إجمالي المستحق</span>
                    <span className="text-xs font-black font-mono text-rose-400">
                      {totalDue.toLocaleString()} <span className="text-[9px] text-rose-400/80 font-normal">ج.م</span>
                    </span>
                  </div>
                </div>

                {/* شريط الخطوط التابعة للحساب */}
                {customerDetails.lines && customerDetails.lines.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block px-1">الخطوط التابعة للحساب:</span>
                    <div className="bg-[#060a14] border border-blue-900/30 rounded-lg p-2 flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-mono">
                        {customerDetails.lines[0].monthlyPackage || 0} ج.م / شهرياً
                      </span>
                      <span className="font-mono text-slate-200">
                        {customerDetails.lines[0].company?.code ? `(${customerDetails.lines[0].company.code}) ` : ''}
                        {customerDetails.lines[0].phoneNumber}
                      </span>
                    </div>
                  </div>
                )}

                {/* رصيد دائن متاح حالياً إن وجد للعميل */}
                {customerCredit > 0 && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                    <span className="font-bold">الرصيد الدائن المتاح حالياً بحساب العميل:</span>
                    <span className="font-mono font-bold">{customerCredit.toLocaleString()} ج.م</span>
                  </div>
                )}

                {/* قسم الإدخال المالي */}
                <div className="space-y-2.5 bg-slate-900/40 border border-slate-800/80 rounded-xl p-3">
                  
                  {/* الصف العلوي: قيمة السداد + المتبقي على العميل جنباً إلى جنب */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* قيمة السداد مع أيقونة الفلوس وبدون أسهم */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        قيمة السداد المحصلة <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                          className="w-full bg-[#050811] border border-blue-500/40 rounded-lg pr-9 pl-8 py-2 text-sm font-bold font-mono text-white focus:outline-none focus:border-blue-400 transition-all text-right"
                          placeholder="0"
                        />
                        <div className="absolute right-2.5 pointer-events-none text-emerald-400">
                          <Banknote className="w-4 h-4" />
                        </div>
                        <span className="absolute left-2.5 text-[10px] text-slate-400 font-medium pointer-events-none">ج.م</span>
                      </div>
                    </div>

                    {/* المتبقي على العميل (صغير ومحكم) */}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        المتبقي على العميل بعد السداد
                      </label>
                      <div className={`h-[38px] px-3 rounded-lg border flex items-center justify-between ${
                        remainingDue > 0 
                          ? 'bg-rose-950/20 border-rose-500/30 text-rose-300' 
                          : 'bg-[#050811] border-slate-800 text-emerald-400'
                      }`}>
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-[10px]">
                            {remainingDue === 0 ? 'خالص بالكامل' : 'متبقي:'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-xs">
                          {remainingDue.toLocaleString()} <span className="text-[9px] font-normal">ج.م</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* الصف السفلي: مربع صغير للزيادة (يستوعب حتى 100,000 ج.م) */}
                  <div className="w-1/2">
                    <div className={`h-[34px] px-3 rounded-lg border flex items-center justify-between transition-colors ${
                      surplusAmount > 0 
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
                        : 'bg-[#050811]/70 border-slate-800/80 text-slate-500'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3" />
                        <span className="text-[10px]">الزيادة (رصيد مقدم):</span>
                      </div>
                      <span className="font-mono font-bold text-xs">
                        {surplusAmount.toLocaleString()} <span className="text-[9px] font-normal">ج.م</span>
                      </span>
                    </div>
                  </div>

                </div>

                {/* طريقة السداد */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5">طريقة السداد / الدفع</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                      className={`flex items-center justify-center gap-2 py-2 px-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        paymentMethod === PaymentMethod.CASH
                          ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                      نقداً (كاش)
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod(PaymentMethod.WALLET)}
                      className={`flex items-center justify-center gap-2 py-2 px-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        paymentMethod === PaymentMethod.WALLET
                          ? 'bg-rose-600/20 border-rose-500 text-white shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                      فودافون كاش
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod(PaymentMethod.BANK)}
                      className={`flex items-center justify-center gap-2 py-2 px-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        paymentMethod === PaymentMethod.BANK
                          ? 'bg-amber-600/20 border-amber-500 text-white shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <WalletCards className="w-3.5 h-3.5 text-amber-400" />
                      انستاباي (InstaPay)
                    </button>
                  </div>
                </div>

                {/* ملاحظات السداد */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">ملاحظات وبيان السداد</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="اكتب أي تفاصيل توثيقية إضافية هنا..."
                    className="w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/60 transition-colors"
                  />
                </div>
              </>
            ) : null}

          </div>

          {/* أزرار الإجراءات السفلية */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-[#0c1424]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              {customerId && (
                <button
                  type="button"
                  onClick={() => setIsStatementOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-955/40 hover:bg-blue-900/50 border border-blue-500/30 text-blue-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>إرسال كشف الحساب</span>
                </button>
              )}
            </div>

            {customerId && (
              <button
                type="button"
                disabled={numericPaid <= 0 || paymentMutation.isPending}
                onClick={() => paymentMutation.mutate()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-955 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
              >
                {paymentMutation.isPending ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>تأكيد السداد ({numericPaid.toLocaleString()} ج.م)</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Payment Receipt Card Modal */}
      {receiptData && (
        <PaymentReceiptCard
          isOpen={isReceiptOpen}
          onClose={() => {
            setIsReceiptOpen(false);
            onClose();
          }}
          data={receiptData}
        />
      )}

      {/* Customer Statement Card Modal */}
      {customerDetails && (
        <CustomerStatementCard
          isOpen={isStatementOpen}
          onClose={() => setIsStatementOpen(false)}
          data={{
            customer: {
              id: customerDetails.id,
              customerCode: customerDetails.customerCode,
              name: customerDetails.name || customerDetails.fullName,
              phone: customerDetails.phone,
              nationalId: customerDetails.nationalId,
            },
          }}
        />
      )}
    </>
  );
};
export default UnifiedPaymentModal;
