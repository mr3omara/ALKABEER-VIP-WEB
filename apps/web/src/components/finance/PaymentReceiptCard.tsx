import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Crown,
  CheckCircle2,
  Phone,
  Calendar,
  Share2,
  Download,
  Copy,
  Receipt,
  Building,
  CreditCard,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Money } from '@alkabeer/shared';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

export interface PaymentReceiptData {
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  treasuryName?: string;
  customer: {
    id: string;
    customerCode: string;
    name: string;
    phone?: string;
  };
  debtBeforePayment: number;
  remainingDebt: number;
  newCreditCreated?: number;
  customerCreditBefore?: number;
  finalCreditBalance?: number;
  lines?: Array<{
    phoneNumber: string;
    companyCode?: string;
    packageName?: string;
  }>;
  reference?: string;
  notes?: string;
}

interface PaymentReceiptCardProps {
  data: PaymentReceiptData;
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentReceiptCard: React.FC<PaymentReceiptCardProps> = ({
  data,
  isOpen,
  onClose,
}) => {
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const {
    paymentNumber,
    paymentDate,
    amount,
    paymentMethod,
    treasuryName,
    customer,
    debtBeforePayment,
    remainingDebt,
    newCreditCreated,
    customerCreditBefore,
    finalCreditBalance,
    lines = [],
    reference,
    notes,
  } = data;

  const dateStr = new Date(paymentDate || new Date()).toLocaleString('ar-EG', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const getWhatsAppMessageText = () => {
    let msg = `👑 *إيصال سداد مالي معتمد - الكبير VIP*\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `🧾 *رقم الإيصال:* ${paymentNumber}\n`;
    msg += `📅 *التاريخ:* ${new Date(paymentDate || new Date()).toLocaleDateString('ar-EG')} (${new Date(paymentDate || new Date()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })})\n`;
    msg += `👤 *العميل:* ${customer.name}\n`;
    msg += `🏷️ *كود الحساب:* ${customer.customerCode}\n\n`;

    msg += `💵 *المبلغ المسدد:* ${Money.format(amount)} ج.م\n`;
    msg += `💳 *طريقة السداد:* ${paymentMethod}\n`;
    if (treasuryName) msg += `🏦 *الخزينة:* ${treasuryName}\n`;
    if (reference) msg += `🔖 *المرجع:* ${reference}\n`;

    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 *الموقف المالي للحساب:*\n`;
    msg += `• المديونية قبل السداد: ${Money.format(debtBeforePayment)} ج.م\n`;
    msg += `• المبلغ المدفوع: ${Money.format(amount)} ج.م\n`;
    msg += `• *المتبقي المستحق:* ${Money.format(remainingDebt)} ج.م\n`;

    if (lines.length > 0) {
      msg += `\n📱 *الخطوط المربوطة (${lines.length} خط):*\n`;
      lines.slice(0, 4).forEach((l) => {
        msg += `• ${l.phoneNumber} (${l.companyCode || 'اتصالات'})\n`;
      });
      if (lines.length > 4) {
        msg += `• وعدد ${lines.length - 4} خطوط أخرى..\n`;
      }
    }

    msg += `\n✅ *تم قيد السداد وتحديث الحساب المالي بنجاح.*\n`;
    msg += `_شكراً لثقتكم المستمرة في الكبير VIP._ 👑`;
    return msg;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getWhatsAppMessageText());
    toast.success('تم نسخ نص الإيصال بنجاح');
  };

  const generateCanvasImage = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, // Ultra-sharp 3x DPI for mobile
        useCORS: true,
        backgroundColor: '#070F1E',
        logging: false,
      });

      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      });
    } catch (err) {
      console.error('Receipt generation error', err);
      toast.error('فشل إنشاء صورة الإيصال');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = async () => {
    const blob = await generateCanvasImage();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `إيصال_سداد_${paymentNumber}_${customer.customerCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('تم تحميل صورة الإيصال بنجاح');
  };

  const handleShareWhatsApp = async () => {
    const blob = await generateCanvasImage();
    const textMsg = getWhatsAppMessageText();

    // 1. Try Native Web Share API with File
    if (blob && navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'receipt.png', { type: 'image/png' })] })) {
      try {
        const file = new File([blob], `إيصال_سداد_${paymentNumber}.png`, { type: 'image/png' });
        await navigator.share({
          title: `إيصال سداد - ${paymentNumber}`,
          text: textMsg,
          files: [file],
        });
        toast.success('تمت المشاركة بنجاح');
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Native share failed, falling back', err);
        } else {
          return;
        }
      }
    }

    // 2. Fallback: Auto download image + Open WhatsApp Web
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `إيصال_سداد_${paymentNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    const cleanPhone = (customer.phone || '').replace(/\D/g, '');
    const targetPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone.length === 10 ? '20' + cleanPhone : cleanPhone;
    const waUrl = targetPhone
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(textMsg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;

    window.open(waUrl, '_blank');
    toast.success('تم تجهيز صورة الإيصال وفتح واتساب للمشاركة');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/85 backdrop-blur-md overflow-y-auto font-sans">
      <div className="relative w-full max-w-md bg-navy-900 border-2 border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-navy-950/90 border-b border-navy-800">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-kufi font-bold text-white">إيصال سداد مالي معتمد</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container with Visual Capture Target */}
        <div className="p-4 max-h-[75vh] overflow-y-auto custom-scrollbar flex justify-center bg-navy-950/40">
          {/* ========================================================================= */}
          {/* CAPTURED LUXURY RECEIPT CARD (Deep Navy + Luxury Gold) */}
          {/* ========================================================================= */}
          <div
            ref={cardRef}
            dir="rtl"
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#070F1E',
              color: '#F8FAFC',
              fontFamily: 'Tajawal, sans-serif',
            }}
            className="rounded-2xl p-5 border border-amber-500/40 shadow-2xl relative overflow-hidden space-y-4 text-right"
          >
            {/* Background Glow Accents */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

            {/* 1. Header Banner */}
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-navy-950 shadow-md">
                  <Crown className="w-5 h-5 text-navy-950 stroke-[2.5]" />
                </div>
                <div>
                  <h1 className="text-sm font-extrabold text-white leading-none" style={{ fontFamily: 'Noto Kufi Arabic, sans-serif' }}>
                    الكبير VIP
                  </h1>
                  <span className="text-[9px] font-bold text-amber-400 block mt-0.5">
                    إيصال استلام نقدية معتمد
                  </span>
                </div>
              </div>

              <div className="text-left font-mono">
                <span className="px-2 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/30 text-amber-400 font-extrabold text-[11px] block">
                  {paymentNumber}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {dateStr}
                </span>
              </div>
            </div>

            {/* 2. Big Paid Amount Highlight Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-950/40 to-[#0E203C] border border-emerald-500/40 text-center space-y-1 relative z-10">
              <span className="text-[11px] font-bold text-emerald-400 block">
                المبلغ المسدد بنجاح (EGP)
              </span>
              <div className="flex items-baseline justify-center gap-1.5 font-mono">
                <span className="text-3xl font-extrabold text-white tracking-tight">
                  +{Money.format(amount)}
                </span>
                <span className="text-sm font-bold text-amber-400">جنيه مصري</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-300 pt-1 border-t border-emerald-500/20">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>طريقة الدفع: <b className="text-white">{paymentMethod}</b></span>
                {treasuryName && <span>• {treasuryName}</span>}
              </div>
            </div>

            {/* 3. Customer & Account Details */}
            <div className="bg-[#0E203C] p-3 rounded-xl border border-[#1E3A5F] space-y-1.5 text-xs relative z-10">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">العميل المسدد:</span>
                <span className="font-extrabold text-white text-sm">{customer.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">كود الحساب:</span>
                <span className="font-mono font-bold text-amber-400">{customer.customerCode}</span>
              </div>
              {customer.phone && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">رقم الهاتف:</span>
                  <span className="font-mono text-slate-200 dir-ltr">{customer.phone}</span>
                </div>
              )}
            </div>

            {/* 4. Financial Balance Impact */}
            <div className="bg-[#0E203C] p-3 rounded-xl border border-[#1E3A5F] space-y-2 text-xs relative z-10">
              <div className="flex justify-between items-center text-slate-300">
                <span>المديونية قبل السداد:</span>
                <span className="font-mono font-bold text-rose-400">
                  {Money.format(debtBeforePayment)} ج.م
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>المبلغ المخصوم الآن:</span>
                <span className="font-mono font-bold text-emerald-400">
                  -{Money.format(amount)} ج.م
                </span>
              </div>
              <div className="pt-2 border-t border-[#1E3A5F] flex justify-between items-center font-bold">
                <span className="text-amber-300">المتبقي المستحق بعد السداد:</span>
                <span className="font-mono text-sm text-white font-extrabold">
                  {Money.format(remainingDebt)} ج.م
                </span>
              </div>
            </div>

            {/* 5. Stamp & Verification */}
            <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-[10px] text-slate-400 relative z-10">
              <div className="flex items-center gap-1 text-emerald-400 font-extrabold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>سند مالي مؤكد ومسجل بالخزينة</span>
              </div>
              <span className="text-slate-500 font-mono text-[9px]">ALKABEER VIP POS</span>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 bg-navy-950 border-t border-navy-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              leftIcon={<Copy className="w-3.5 h-3.5" />}
              title="نسخ نص الإيصال"
            >
              نسخ النص
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadImage}
              isLoading={isGenerating}
              leftIcon={<Download className="w-3.5 h-3.5" />}
              title="تحميل صورة الإيصال"
            >
              تحميل الصورة
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="gold"
              size="sm"
              onClick={handleShareWhatsApp}
              isLoading={isGenerating}
              leftIcon={<Share2 className="w-3.5 h-3.5 text-navy-950" />}
              className="font-extrabold text-navy-950"
              title="مشاركة الإيصال على واتساب"
            >
              مشاركة عبر واتساب
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
