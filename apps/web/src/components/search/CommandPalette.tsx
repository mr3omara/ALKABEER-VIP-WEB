import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Command,
  LayoutDashboard,
  Users,
  Phone,
  Package,
  ShoppingCart,
  CreditCard,
  FileText,
  Landmark,
  Receipt,
  Clock,
  Layers,
  Building2,
  UserCheck,
  Settings,
  ShieldAlert,
  PlusCircle,
  ArrowRight,
  History,
  X,
} from 'lucide-react';
import { normalizeArabic } from '../../lib/search-utils';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  category: 'التنقل المباشر' | 'الإجراءات السريعة' | 'السجل الأخير';
  title: string;
  subtitle?: string;
  keywords?: string[];
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('alkabeer_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Reset query and focus when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const saveRecentSearch = (term: string) => {
    if (!term.trim()) return;
    const updated = [term.trim(), ...recentSearches.filter((s) => s !== term.trim())].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('alkabeer_recent_searches', JSON.stringify(updated));
  };

  const handleSelect = (item: PaletteItem) => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
    }
    item.action();
    onClose();
  };

  // Base Registry of Navigational Pages & Quick Actions
  const staticItems: PaletteItem[] = [
    // --- Pages Navigation ---
    {
      id: 'nav-dashboard',
      category: 'التنقل المباشر',
      title: 'لوحة التحكم والعمليات',
      subtitle: 'الصفحة الرئيسية والمؤشرات المالية',
      keywords: ['dashboard', 'home', 'الرئيسية', 'لوحة'],
      icon: LayoutDashboard,
      action: () => navigate('/'),
    },
    {
      id: 'nav-customers',
      category: 'التنقل المباشر',
      title: 'سجل العملاء والمشتركين',
      subtitle: 'إدارة بيانات العملاء والمديونيات',
      keywords: ['customers', 'عميل', 'مشتركين', 'هاتف', 'قومي'],
      icon: Users,
      action: () => navigate('/customers'),
    },
    {
      id: 'nav-lines',
      category: 'التنقل المباشر',
      title: 'سجل الخطوط والأرقام VIP',
      subtitle: 'مخزن الأرقام وتكاليف الخطوط',
      keywords: ['lines', 'خطوط', 'أرقام', 'vip', 'مخزن'],
      icon: Phone,
      action: () => navigate('/lines'),
    },
    {
      id: 'nav-inventory',
      category: 'التنقل المباشر',
      title: 'دفتر حركات المخزون',
      subtitle: 'حركات الإدخال والبيع والتسوية',
      keywords: ['inventory', 'مخزون', 'حركات', 'تعديل'],
      icon: Package,
      action: () => navigate('/inventory'),
    },
    {
      id: 'nav-sales',
      category: 'التنقل المباشر',
      title: 'سجل المبيعات والتعاقدات',
      subtitle: 'فواتير البيع والمدفوعات الفورية',
      keywords: ['sales', 'مبيعات', 'فواتير', 'عقد', 'بيع'],
      icon: ShoppingCart,
      action: () => navigate('/sales'),
    },
    {
      id: 'nav-payments',
      category: 'التنقل المباشر',
      title: 'سندات التحصيل والمدفوعات (FIFO)',
      subtitle: 'تسجيل التحصيلات وتوزيع الاستحقاقات',
      keywords: ['payments', 'تحصيل', 'سند', 'مدفوعات', 'سداد'],
      icon: CreditCard,
      action: () => navigate('/payments'),
    },
    {
      id: 'nav-monthly-charges',
      category: 'التنقل المباشر',
      title: 'سجل الفواتير الشهرية الدورية',
      subtitle: 'الاشتراكات والمديونيات الشهرية',
      keywords: ['charges', 'شريحة', 'استحقاق', 'شهري', 'فواتير'],
      icon: FileText,
      action: () => navigate('/monthly-charges'),
    },
    {
      id: 'nav-treasury',
      category: 'التنقل المباشر',
      title: 'الخزينة والحسابات المالية',
      subtitle: 'أرصدة البنوك والتحويلات النقدية',
      keywords: ['treasury', 'خزينة', 'بنك', 'حسابات', 'تحويل'],
      icon: Landmark,
      action: () => navigate('/treasury'),
    },
    {
      id: 'nav-expenses',
      category: 'التنقل المباشر',
      title: 'سجل المصروفات والنثريات',
      subtitle: 'المدفوعات التشغيلية والإدارية',
      keywords: ['expenses', 'مصروفات', 'نثريات', 'صرف'],
      icon: Receipt,
      action: () => navigate('/expenses'),
    },
    {
      id: 'nav-daily-closing',
      category: 'التنقل المباشر',
      title: 'الإغلاق اليومي للورديات',
      subtitle: 'مطابقة الخزينة والرصيد الفعلي',
      keywords: ['closing', 'إغلاق', 'وردية', 'مطابقة', 'تعديل'],
      icon: Clock,
      action: () => navigate('/daily-closing'),
    },
    {
      id: 'nav-reports',
      category: 'التنقل المباشر',
      title: 'تقارير المديونيات وكشوف الحسابات',
      subtitle: 'تحليل المتأخرات والأرباح',
      keywords: ['reports', 'تقارير', 'مديونية', 'أرباح', 'كشف'],
      icon: Layers,
      action: () => navigate('/reports'),
    },
    {
      id: 'nav-companies',
      category: 'التنقل المباشر',
      title: 'شركات الاتصالات ومزودي الخدمة',
      subtitle: 'فودافون، أورنج، اتصالات، وي',
      keywords: ['companies', 'شركات', 'اتصالات', 'شبكات'],
      icon: Building2,
      action: () => navigate('/companies'),
    },
    {
      id: 'nav-users',
      category: 'التنقل المباشر',
      title: 'إدارة المستخدمين والصلاحيات (RBAC)',
      subtitle: 'حسابات الموظفين والأدوار',
      keywords: ['users', 'مستخدمين', 'موظفين', 'صلاحيات', 'أدوار'],
      icon: UserCheck,
      action: () => navigate('/users'),
    },
    {
      id: 'nav-settings',
      category: 'التنقل المباشر',
      title: 'إعدادات النظام العامة',
      subtitle: 'تهيئة المتغيرات التشغيلية',
      keywords: ['settings', 'إعدادات', 'خيارات', 'نظام'],
      icon: Settings,
      action: () => navigate('/settings'),
    },
    {
      id: 'nav-audit',
      category: 'التنقل المباشر',
      title: 'سجل التدقيق الأمني (Audit Trail)',
      subtitle: 'توثيق الحركات الحساسة',
      keywords: ['audit', 'تدقيق', 'أمان', 'حركات'],
      icon: ShieldAlert,
      action: () => navigate('/audit'),
    },

    // --- Quick Commands ---
    {
      id: 'act-add-customer',
      category: 'الإجراءات السريعة',
      title: 'تسجيل عميل جديد (+عميل)',
      subtitle: 'إدخال بيانات عميل ومستندات',
      keywords: ['+عميل', 'إضافة عميل', 'جديد', 'انشاء عميل'],
      icon: PlusCircle,
      action: () => navigate('/customers?action=new'),
    },
    {
      id: 'act-add-line',
      category: 'الإجراءات السريعة',
      title: 'إضافة خط جديد للمخزن (+خط)',
      subtitle: 'تسجيل رقم جديد في المخزن',
      keywords: ['+خط', 'إضافة خط', 'جديد', 'رقم جديد'],
      icon: PlusCircle,
      action: () => navigate('/lines?action=new'),
    },
    {
      id: 'act-new-sale',
      category: 'الإجراءات السريعة',
      title: 'إنشاء فاتورة بيع جديدة (+فاتورة)',
      subtitle: 'بيع خطوط وتوليد عقد بيع',
      keywords: ['+فاتورة', 'بيع جديدة', 'مبيعات', 'انشاء فاتورة'],
      icon: PlusCircle,
      action: () => navigate('/sales?action=new'),
    },
    {
      id: 'act-new-payment',
      category: 'الإجراءات السريعة',
      title: 'تسجيل سند تحصيل جديد (+سند)',
      subtitle: 'تحصيل نقدية أو تحويل بنكي',
      keywords: ['+سند', 'تحصيل', 'سداد', 'قبض'],
      icon: PlusCircle,
      action: () => navigate('/payments?action=new'),
    },
    {
      id: 'act-transfer',
      category: 'الإجراءات السريعة',
      title: 'تحويل مالي بين الخزائن (+تحويل)',
      subtitle: 'نقل رصيد بين الخزائن والبنوك',
      keywords: ['+تحويل', 'تحويل خزينة', 'نقل رصيد'],
      icon: PlusCircle,
      action: () => navigate('/treasury?action=transfer'),
    },
  ];

  // Filter Items based on Normalized Query
  const normQuery = normalizeArabic(query);
  const filteredItems = staticItems.filter((item) => {
    if (!normQuery) return true;
    const titleNorm = normalizeArabic(item.title);
    const subtitleNorm = normalizeArabic(item.subtitle || '');
    const keywordsNorm = (item.keywords || []).map(normalizeArabic);

    return (
      titleNorm.includes(normQuery) ||
      subtitleNorm.includes(normQuery) ||
      keywordsNorm.some((k) => k.includes(normQuery))
    );
  });

  // Handle Keyboard Navigation (Up / Down / Enter / Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? Math.max(0, filteredItems.length - 1) : prev - 1,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-navy-950/70 backdrop-blur-xs animate-in fade-in duration-150 font-sans"
      dir="rtl"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl bg-white dark:bg-navy-900 text-navy-900 dark:text-slate-100 rounded-2xl shadow-navy-lg border border-ivory-300 dark:border-navy-750 overflow-hidden z-10 flex flex-col transition-colors">
        {/* Search Input Bar Header */}
        <div className="p-4 border-b border-ivory-300 dark:border-navy-800 flex items-center gap-3 bg-ivory-100/60 dark:bg-navy-950/60">
          <Search className="w-5 h-5 text-gold-600 dark:text-gold-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="ابحث فورياً في النظام (صفحة، عميل، خط، فاتورة، أمر +عميل)..."
            className="flex-1 bg-transparent text-sm text-navy-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none font-bold"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-navy-900 dark:hover:text-white rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-ivory-200 dark:bg-navy-800 border border-ivory-300 dark:border-navy-700 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Recent Searches Pills (When query is empty) */}
        {!query && recentSearches.length > 0 && (
          <div className="px-4 py-2.5 bg-ivory-50 dark:bg-navy-950/40 border-b border-ivory-300/60 dark:border-navy-800 flex items-center gap-2 overflow-x-auto custom-scrollbar text-xs">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1 flex-shrink-0">
              <History className="w-3.5 h-3.5 text-gold-500" />
              <span>عمليات البحث الأخيرة:</span>
            </span>
            {recentSearches.map((term, i) => (
              <button
                key={i}
                onClick={() => setQuery(term)}
                className="px-2.5 py-0.5 bg-white dark:bg-navy-800 border border-ivory-300 dark:border-navy-700 hover:border-gold-500 text-navy-900 dark:text-slate-200 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        )}

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <Command className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-xs font-bold">لم نجد أي نتائج مطابقة لـ "{query}"</p>
              <p className="text-[11px]">جرب البحث باسم الصفحة، كود العميل، أو الأمر `+عميل`</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-navy-900 text-white dark:bg-navy-800 shadow-warm-xs'
                      : 'hover:bg-ivory-100 dark:hover:bg-navy-800/60 text-navy-900 dark:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl flex-shrink-0 ${
                        isSelected
                          ? 'bg-gold-500 text-navy-950 font-bold'
                          : 'bg-ivory-200 dark:bg-navy-800 text-gold-600 dark:text-gold-400'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold truncate">{item.title}</span>
                        <span
                          className={`text-[10px] px-2 py-0.2 rounded-md font-bold ${
                            isSelected
                              ? 'bg-navy-800 text-gold-300'
                              : 'bg-ivory-200 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p
                          className={`text-[11px] truncate font-medium mt-0.5 ${
                            isSelected ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 transform rotate-180 transition-transform ${
                      isSelected ? 'text-gold-400 translate-x-[-2px]' : 'opacity-0'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Helper Bar */}
        <div className="px-4 py-2.5 bg-ivory-100/70 dark:bg-navy-950/70 border-t border-ivory-300 dark:border-navy-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-bold">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-navy-800 border border-ivory-300 dark:border-navy-700 rounded text-[10px] font-mono">
                ↑↓
              </kbd>{' '}
              التنقل
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-navy-800 border border-ivory-300 dark:border-navy-700 rounded text-[10px] font-mono">
                ↵
              </kbd>{' '}
              الاختيار
            </span>
          </div>
          <span>منظومة الكبير VIP المحاسبية</span>
        </div>
      </div>
    </div>
  );
};
