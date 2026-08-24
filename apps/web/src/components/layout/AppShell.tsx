import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-context';
import { useTheme } from '../../contexts/theme-context';
import {
  Menu,
  X,
  ChevronLeft,
  Moon,
  Sun,
  LogOut,
  Zap,
  Clock,
} from 'lucide-react';
import { PERMISSIONS } from '@alkabeer/shared';
import { CommandPalette } from '../search/CommandPalette';
import { CentralCollectionModal } from '../finance/CentralCollectionModal';
import { Icon3D, Icon3DName } from '../icons3d';

interface NavGroup {
  title: string;
  emoji?: string;
  items: Array<{
    label: string;
    path: string;
    icon3d: Icon3DName;
    emoji?: string;
    perm?: string;
  }>;
}

export const AppShell: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCentralCollectionOpen, setIsCentralCollectionOpen] = useState(false);

  // Global Ctrl + K / Cmd + K and F2 Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setIsCentralCollectionOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleLogout = async () => {
    if (window.confirm('هل تريد بالتأكيد تسجيل الخروج من النظام؟')) {
      await logout();
      navigate('/login');
    }
  };

  const navGroups: NavGroup[] = [
    {
      title: 'الرئيسية',
      emoji: '⚡',
      items: [
        { label: 'لوحة التحكم والعمليات', path: '/', icon3d: 'dashboard', emoji: '📊' },
      ],
    },
    {
      title: 'العمليات والمبيعات',
      emoji: '💼',
      items: [
        { label: 'سجل العملاء', path: '/customers', icon3d: 'customers', emoji: '👤', perm: PERMISSIONS.CUSTOMERS_VIEW },
        { label: 'الخطوط والأرقام VIP', path: '/lines', icon3d: 'lines', emoji: '📱', perm: PERMISSIONS.LINES_VIEW },
        { label: 'المخزن والخطوط', path: '/inventory', icon3d: 'inventory', emoji: '📦', perm: PERMISSIONS.INVENTORY_VIEW },
        { label: 'المبيعات والتعاقدات', path: '/sales', icon3d: 'sales', emoji: '🛒', perm: PERMISSIONS.SALES_VIEW },
        { label: 'التحصيلات والسندات', path: '/payments', icon3d: 'payments', emoji: '💰', perm: PERMISSIONS.PAYMENTS_VIEW },
        { label: 'إدارة الباقات', path: '/packages', icon3d: 'packages', emoji: '📦', perm: PERMISSIONS.INVENTORY_VIEW },
        { label: 'الفواتير الشهرية', path: '/monthly-charges', icon3d: 'expenses', emoji: '🧾', perm: PERMISSIONS.MONTHLY_CHARGES_VIEW },
      ],
    },
    {
      title: 'الإدارة المالية والخزينة',
      emoji: '🏦',
      items: [
        { label: 'الخزينة والحسابات', path: '/treasury', icon3d: 'treasury', emoji: '🏛️', perm: PERMISSIONS.TREASURY_VIEW },
        { label: '📒 دفتر الأستاذ', path: '/ledger', icon3d: 'audit', emoji: '📒', perm: PERMISSIONS.PAYMENTS_VIEW },
        { label: 'المصروفات والنثريات', path: '/expenses', icon3d: 'expenses', emoji: '💸', perm: PERMISSIONS.EXPENSES_VIEW },
        { label: 'التزامات فواتير الشركات', path: '/company-liabilities', icon3d: 'company-liabilities', emoji: '🏢', perm: PERMISSIONS.COMPANIES_VIEW },
        { label: 'الإغلاق اليومي والمطابقة', path: '/daily-closing', icon3d: 'daily-closing', emoji: '⏱️', perm: PERMISSIONS.DAILY_CLOSING_VIEW },
        { label: 'تقارير المديونيات والأرباح', path: '/reports', icon3d: 'reports', emoji: '📈', perm: PERMISSIONS.REPORTS_VIEW },
      ],
    },
    {
      title: 'إدارة النظام والأمان',
      emoji: '🛡️',
      items: [
        { label: 'المستخدمين والصلاحيات', path: '/users', icon3d: 'users', emoji: '👥', perm: PERMISSIONS.USERS_MANAGE },
        { label: 'شركات الاتصالات', path: '/companies', icon3d: 'companies', emoji: '📡', perm: PERMISSIONS.COMPANIES_VIEW },
        { label: 'إعدادات النظام', path: '/settings', icon3d: 'settings', emoji: '⚙️', perm: PERMISSIONS.SETTINGS_MANAGE },
        { label: 'سجل التدقيق الأمني', path: '/audit', icon3d: 'audit', emoji: '🔒', perm: PERMISSIONS.AUDIT_VIEW },
        { label: 'النسخ وإدارة البيانات', path: '/backup', icon3d: 'backup', emoji: '💾', perm: PERMISSIONS.BACKUP_MANAGE },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-ivory-100 dark:bg-navy-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-gold-500/20 selection:text-gold-900 transition-colors" dir="rtl">
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 dark:bg-navy-950/80 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation (Deep Navy with Restrained Luxury Gold Accents) */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-72 bg-navy-900 text-slate-200 flex flex-col border-l border-navy-800 shadow-navy-lg transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4.5 border-b border-navy-800/90 flex items-center justify-between bg-navy-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-800 border border-gold-500/30 flex items-center justify-center text-gold-400 shadow-gold-sm">
              <Icon3D name="crown" size="md" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-display font-extrabold text-white tracking-wide">
                  الكبير VIP
                </h1>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-gold-500/15 border border-gold-500/30 text-gold-300 font-mono font-semibold">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">إدارة الخطوط والمالية 👑</p>
            </div>
          </div>

          <button
            onClick={() => setIsMobileOpen(false)}
            aria-label="إغلاق القائمة الجانبية"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Grouped Items */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto dark-scrollbar">
          {navGroups.map((group, groupIdx) => {
            const filteredItems = group.items.filter(
              (item) => !item.perm || hasPermission(item.perm),
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={groupIdx} className="space-y-1">
                <div className="px-3 pb-1 text-[11px] font-display font-bold uppercase tracking-wider text-slate-400/80 flex items-center gap-1.5">
                  <span>{group.emoji}</span>
                  <span>{group.title}</span>
                </div>
                {filteredItems.map((item) => {
                  const isActive =
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.path);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileOpen(false)}
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-navy-800/90 text-white border-r-3 border-gold-400 shadow-navy-sm font-bold pl-2.5'
                          : 'text-slate-300/90 hover:bg-navy-800/50 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon3D
                          name={item.icon3d}
                          size="sm"
                          className="group-hover:scale-110 transition-transform duration-150"
                        />
                        <span className="flex items-center gap-1.5">
                          <span>{item.label}</span>
                          {item.emoji && (
                            <span className="text-xs opacity-75">{item.emoji}</span>
                          )}
                        </span>
                      </div>
                      {isActive && (
                        <ChevronLeft className="w-3.5 h-3.5 text-gold-400/80 opacity-80" />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User / Session Area */}
        <div className="p-3 border-t border-navy-800/90 bg-navy-950/60">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-navy-850 border border-navy-750">
            <div className="truncate mr-1.5">
              <p className="text-xs font-bold text-white truncate">
                {user?.fullName || user?.username}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs"></span>
                <span className="text-[11px] text-slate-400 font-mono truncate">
                  {user?.roles?.join(' • ') || 'User'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج من الحساب"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-ivory-50 dark:bg-navy-850 border-b border-ivory-300 dark:border-navy-750 px-4 sm:px-6 flex items-center justify-between shadow-warm-xs z-10 transition-colors">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              aria-label="فتح القائمة الجانبية"
              className="p-2 text-slate-800 dark:text-slate-200 hover:bg-ivory-200 dark:hover:bg-navy-800 rounded-xl lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-navy-900 dark:text-slate-100">
                متصل بقاعدة البيانات • متصل بالنواة
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Quick Central Collection Button (F2) */}
            <button
              onClick={() => setIsCentralCollectionOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-gold-500 hover:from-amber-500 hover:to-gold-600 text-navy-950 font-bold rounded-lg shadow-sm text-xs transition-all active:scale-95 cursor-pointer font-sans group border border-amber-300"
              title="التحصيل المركزي وسداد العملاء (F2)"
            >
              <Icon3D name="payments" size="xs" className="group-hover:scale-110 transition-transform" />
              <span className="font-kufi font-extrabold hidden sm:inline">💰 التحصيل</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-amber-300/80 text-navy-950 font-extrabold rounded">
                F2
              </kbd>
            </button>

            {/* Global Search Bar Button (Ctrl + K) */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 bg-ivory-100/80 dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 text-slate-700 dark:text-slate-300 hover:border-gold-500 hover:text-navy-900 dark:hover:text-gold-400 rounded-xl text-xs font-bold transition-all shadow-2xs group"
              title="البحث الفوري الشامل (Ctrl + K)"
            >
              <Icon3D name="search" size="xs" className="group-hover:scale-110 transition-transform" />
              <span className="hidden md:inline">🔍 البحث الفوري الشامل...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-navy-800 border border-ivory-300 dark:border-navy-700 rounded-md">
                Ctrl K
              </kbd>
            </button>

            <div className="text-xs text-slate-800 dark:text-slate-200 font-bold hidden sm:flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gold-600 dark:text-gold-400" />
              <span>
                {new Date().toLocaleDateString('ar-EG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'تغيير المظهر إلى الوضع الليلي' : 'تغيير المظهر إلى الوضع النهاري'}
              title={theme === 'light' ? 'تغيير المظهر إلى الوضع الليلي' : 'تغيير المظهر إلى الوضع النهاري'}
              className="p-2 text-slate-800 dark:text-slate-200 hover:text-navy-900 dark:hover:text-gold-400 hover:bg-ivory-200/60 dark:hover:bg-navy-800 rounded-xl transition-all flex items-center justify-center border border-ivory-300 dark:border-navy-750 shadow-2xs"
            >
              {theme === 'light' ? (
                <Moon className="w-4.5 h-4.5 text-navy-900" />
              ) : (
                <Sun className="w-4.5 h-4.5 text-gold-400" />
              )}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 bg-ivory-100 dark:bg-navy-950/90 text-slate-900 dark:text-slate-100 custom-scrollbar transition-colors">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Global Command Palette Modal */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
        <CentralCollectionModal
          isOpen={isCentralCollectionOpen}
          onClose={() => setIsCentralCollectionOpen(false)}
        />
      </div>
    </div>
  );
};
