import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import {
  Crown,
  Phone,
  Calendar,
  Layers,
  Share2,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sparkles,
  ShieldCheck,
  X,
  FileText
} from 'lucide-react';
import { Money } from '@alkabeer/shared';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { apiClient } from '../../lib/api-client';

export interface CustomerStatementData {
  customer: {
    id: string;
    customerCode: string;
    name: string;
    phone?: string;
    nationalId?: string;
  };
  lines?: any[];
  openingBalance?: number;
  unpaidChargesTotal?: number;
  unpaidSalesTotal?: number;
  totalDebt?: number;
  statementDate?: string;
}

interface CustomerStatementCardProps {
  data: CustomerStatementData;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerStatementCard: React.FC<CustomerStatementCardProps> = ({
  data,
  isOpen,
  onClose,
}) => {
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && data.customer?.id) {
      setLoading(true);
      apiClient(`/ledger/statement/${data.customer.id}`)
        .then(res => setLedgerData(res))
        .catch(e => console.error(e))
        .finally(() => setLoading(false));
    }
  }, [isOpen, data.customer?.id]);

  if (!isOpen) return null;

  const { customer } = data;
  const statementDateFormatted = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const getWhatsAppMessageText = () => {
    let msg = `🌟 *كشف حساب - الكابير VIP*\n\n`;
    msg += `👤 *العميل:* ${customer.name}\n`;
    msg += `🎫 *الكود:* ${customer.customerCode}\n`;
    if (customer.phone) msg += `📞 *الهاتف:* ${customer.phone}\n`;
    msg += `📅 *تاريخ الكشف:* ${new Date().toLocaleDateString('ar-EG')}\n\n`;
    
    if (ledgerData) {
       msg += `💰 *الرصيد النهائي:* ${Math.abs(ledgerData.finalBalance)} ج.م ${ledgerData.finalBalance > 0 ? '(مديونية)' : ledgerData.finalBalance < 0 ? '(رصيد دائن)' : ''}\n`;
    }
    return encodeURIComponent(msg);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(decodeURIComponent(getWhatsAppMessageText()));
    toast.success('تم نسخ نص الكشف للمشاركة');
  };

  const handleWhatsApp = () => {
    const phone = customer.phone?.replace(/^0+/, ''); 
    const fullPhone = phone ? `20${phone}` : '';
    window.open(`https://wa.me/${fullPhone}?text=${getWhatsAppMessageText()}`, '_blank');
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    try {
      setIsGenerating(true);
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `Statement_${customer.customerCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('تم تحميل كشف الحساب كصورة بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء إنشاء الصورة');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
      <div className="bg-slate-100 rounded-3xl w-full max-w-4xl shadow-2xl relative flex flex-col md:flex-row my-auto border border-slate-200">
        
        {/* Actions Sidebar */}
        <div className="bg-slate-900 text-white p-6 rounded-t-3xl md:rounded-r-3xl md:rounded-tl-none w-full md:w-80 flex flex-col gap-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-400" />
              كشف حساب تفصيلي
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          <Button variant="primary" onClick={handleDownloadImage} disabled={isGenerating} className="w-full justify-start text-lg h-12 shadow-md">
            <Download className="w-5 h-5 ml-3" /> تحميل كصورة (PNG)
          </Button>

          <Button variant="secondary" onClick={handleWhatsApp} className="w-full justify-start bg-green-600 hover:bg-green-700 text-white border-none h-12 shadow-md text-lg">
            <Share2 className="w-5 h-5 ml-3" /> مشاركة عبر واتساب
          </Button>

          <Button variant="outline" onClick={handleCopy} className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-800 h-12 text-lg">
            <Copy className="w-5 h-5 ml-3" /> نسخ النص
          </Button>
          
          <div className="mt-auto pt-6 border-t border-slate-800 text-sm text-slate-400 space-y-2">
            <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400"/> كشف موثق ومختوم آلياً</div>
            <div className="flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400"/> نظام الكابير VIP للإدارة</div>
          </div>
        </div>

        {/* Printable Card Area */}
        <div className="flex-1 p-6 md:p-8 bg-slate-100 flex justify-center overflow-x-auto">
          <div 
            ref={cardRef} 
            className="bg-white p-8 rounded-2xl shadow-xl w-[210mm] min-h-[297mm] text-slate-900 border border-slate-200" 
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-blue-900 pb-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-blue-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Crown className="w-10 h-10" />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-blue-900 mb-1">مؤسسة الكابير VIP</h1>
                  <h2 className="text-xl font-bold text-slate-700">كشف حساب عميل (دفتر الأستاذ)</h2>
                </div>
              </div>
              <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-end gap-2 text-slate-600 text-sm mb-1">
                  <Calendar className="w-4 h-4" /> {statementDateFormatted}
                </div>
                <div className="text-lg font-bold text-slate-800">
                  كود: <span className="text-blue-700">{customer.customerCode}</span>
                </div>
              </div>
            </div>

            {/* Customer Details Box */}
            <div className="bg-slate-50 rounded-xl p-5 mb-8 border border-slate-200 flex flex-wrap gap-x-12 gap-y-4">
              <div>
                <p className="text-sm text-slate-500 font-semibold mb-1">اسم العميل</p>
                <p className="text-lg font-bold flex items-center gap-2"><Phone className="w-5 h-5 text-blue-600"/> {customer.name}</p>
              </div>
              {customer.phone && (
                <div>
                  <p className="text-sm text-slate-500 font-semibold mb-1">رقم التواصل</p>
                  <p className="text-lg font-bold font-mono" dir="ltr">{customer.phone}</p>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-10">جاري تحميل بيانات دفتر الأستاذ...</div>
            ) : ledgerData ? (
              <>
                {/* Ledger Table */}
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  حركة الحساب التفصيلية
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 mb-8">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                      <tr>
                        <th className="p-3 font-bold">التاريخ</th>
                        <th className="p-3 font-bold">رقم الحركة</th>
                        <th className="p-3 font-bold">البيان</th>
                        <th className="p-3 font-bold text-center">مدين (عليه)</th>
                        <th className="p-3 font-bold text-center">دائن (له)</th>
                        <th className="p-3 font-bold text-center">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerData.ledgerEntries?.map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-600">{new Date(entry.transactionDate).toLocaleDateString('ar-EG')}</td>
                          <td className="p-3 font-mono text-xs text-slate-500">{entry.transactionNumber}</td>
                          <td className="p-3 font-medium text-slate-800">{entry.description}</td>
                          <td className="p-3 text-center text-red-600 font-bold">{entry.debit > 0 ? entry.debit : '-'}</td>
                          <td className="p-3 text-center text-green-600 font-bold">{entry.credit > 0 ? entry.credit : '-'}</td>
                          <td className="p-3 text-center font-black" dir="ltr">
                            {Math.abs(entry.balanceAfter)}
                            <span className="text-xs mr-1 font-normal text-slate-500">{entry.balanceAfter < 0 ? 'CR' : 'DR'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Final Balance Summary */}
                <div className="flex justify-end mt-8 border-t-2 border-slate-200 pt-6">
                  <div className={`bg-${ledgerData.finalBalance < 0 ? 'green' : ledgerData.finalBalance > 0 ? 'red' : 'blue'}-50 p-6 rounded-2xl w-80 text-center border border-${ledgerData.finalBalance < 0 ? 'green' : ledgerData.finalBalance > 0 ? 'red' : 'blue'}-200 shadow-sm`}>
                    <p className="text-slate-600 font-bold mb-2 text-lg">الرصيد النهائي المستحق</p>
                    <p className={`text-4xl font-black ${ledgerData.finalBalance < 0 ? 'text-green-700' : ledgerData.finalBalance > 0 ? 'text-red-700' : 'text-blue-700'} mb-2 flex items-center justify-center gap-2`}>
                      {ledgerData.finalBalance < 0 && <CheckCircle2 className="w-8 h-8"/>}
                      {ledgerData.finalBalance > 0 && <AlertCircle className="w-8 h-8"/>}
                      {Math.abs(ledgerData.finalBalance)} <span className="text-xl">ج.م</span>
                    </p>
                    <p className="font-bold text-slate-700">
                      {ledgerData.finalBalance < 0 ? '(رصيد دائن متاح للعميل)' : ledgerData.finalBalance > 0 ? '(مديونية مستحقة الدفع)' : '(خالص)'}
                    </p>
                  </div>
                </div>
              </>
            ) : null}

            {/* Footer */}
            <div className="mt-16 pt-8 border-t border-slate-200 flex justify-between items-center text-slate-500 text-sm print:mt-auto">
              <div>
                <p className="font-bold text-slate-700">مؤسسة الكابير VIP</p>
                <p>للإدارة والخدمات الذكية</p>
              </div>
              <div className="text-left" dir="ltr">
                <p>ALKABEER VIP SYSTEM v2.0</p>
                <p className="font-mono text-xs opacity-75">Generated: {new Date().toISOString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
