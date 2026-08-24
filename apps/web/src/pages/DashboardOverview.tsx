import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import {
  TrendingUp,
  CreditCard,
  ShoppingCart,
  Phone,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  Lock,
  Crown,
  Users,
  ArrowDownLeft,
  FileEdit,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Clock,
} from 'lucide-react';
import { Money, DailyClosingStatus } from '@alkabeer/shared';
import { Button } from '../components/ui/Button';
import { Icon3D } from '../components/icons3d';

// Todo Item Interface
interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export const DashboardOverview: React.FC = () => {
  // Fetch Live Dashboard Summary from authoritative API
  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiClient('/reports/dashboard-summary'),
    refetchInterval: 15000,
  });

  // Fetch Daily Closing status for today
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: todayClosing } = useQuery({
    queryKey: ['daily-closing-today', todayStr],
    queryFn: () => apiClient(`/daily-closing/${todayStr}`).catch(() => null),
  });

  // --- Widget 1: Persistent Scratchpad State ---
  const [scratchpadText, setScratchpadText] = useState<string>(() => {
    return localStorage.getItem('alkabeer_dashboard_scratchpad') || '';
  });
  const [scratchpadSaved, setScratchpadSaved] = useState(false);

  const handleScratchpadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScratchpadText(val);
    localStorage.setItem('alkabeer_dashboard_scratchpad', val);
    setScratchpadSaved(true);
  };

  useEffect(() => {
    if (scratchpadSaved) {
      const timer = setTimeout(() => setScratchpadSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [scratchpadSaved]);

  // --- Widget 2: Numbered Interactive Daily To-Do List State ---
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    const saved = localStorage.getItem('alkabeer_dashboard_todos');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return [
      {
        id: '1',
        text: 'مراجعة كشف حساب البنك ومطابقة الإيداعات اليومية',
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        text: 'متابعة تحصيل مديونيات كبار العملاء المتأخرة',
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        text: 'إغلاق وردية الخزينة المسائية ومطابقة الفروقات',
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ];
  });
  const [newTodoText, setNewTodoText] = useState('');

  // Persist To-Dos to localStorage
  useEffect(() => {
    localStorage.setItem('alkabeer_dashboard_todos', JSON.stringify(todos));
  }, [todos]);

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    const newItem: TodoItem = {
      id: Date.now().toString(),
      text: newTodoText.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTodos([newItem, ...todos]);
    setNewTodoText('');
  };

  const handleToggleTodo = (id: string) => {
    const nowStr = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    setTodos(
      todos.map((todo) => {
        if (todo.id === id) {
          const isCompleting = !todo.completed;
          return {
            ...todo,
            completed: isCompleting,
            completedAt: isCompleting ? `اليوم ${nowStr}` : undefined,
          };
        }
        return todo;
      }),
    );
  };

  const handleDeleteTodo = (id: string) => {
    setTodos(todos.filter((t) => t.id !== id));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 font-sans">
        <div className="h-8 w-64 bg-ivory-200 dark:bg-navy-800 rounded-xl animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-ivory-50 dark:bg-navy-850 rounded-2xl border border-ivory-300 dark:border-navy-750 p-5 animate-pulse">
              <div className="h-4 w-28 bg-ivory-200 dark:bg-navy-800 rounded mb-4"></div>
              <div className="h-8 w-36 bg-ivory-200 dark:bg-navy-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-200 space-y-3 shadow-warm-xs font-sans">
        <div className="flex items-center gap-2 font-bold text-base">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <span>تعذر تحميل مؤشرات لوحة التحكم من الخادم</span>
        </div>
        <p className="text-sm text-rose-800 dark:text-rose-300 font-medium">
          تأكد من تشغيل خادم الـ Backend وقاعدة البيانات ثم أعد المحاولة.
        </p>
        <Button size="sm" variant="danger" onClick={() => refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const isShiftOpen = todayClosing && todayClosing.status === DailyClosingStatus.OPEN;
  const isShiftClosed = todayClosing && todayClosing.status === DailyClosingStatus.CLOSED;

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Welcome & Shift Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-ivory-50 dark:bg-navy-850 p-5.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs transition-colors">
        <div>
          <div className="flex items-center gap-2.5">
            <Icon3D name="crown" size="lg" />
            <h2 className="text-xl font-kufi font-extrabold text-navy-900 dark:text-slate-100 tracking-tight">
              مركز العمليات والمؤشرات المالية 👑
            </h2>
          </div>
          <p className="text-xs font-tajawal text-slate-700 dark:text-slate-300 mt-1 font-bold">
            متابعة فورية ومباشرة لحركة المبيعات، التحصيلات، الخزائن، والمخزون
          </p>
        </div>

        {/* Daily Shift Status Widget */}
        <div className="flex items-center gap-3 bg-ivory-200/80 dark:bg-navy-950 px-4 py-2.5 rounded-xl border border-ivory-300 dark:border-navy-750 text-xs">
          <div className="flex items-center gap-2">
            {isShiftOpen ? (
              <Icon3D name="check" size="xs" />
            ) : isShiftClosed ? (
              <Icon3D name="audit" size="xs" />
            ) : (
              <Icon3D name="alert" size="xs" />
            )}
            <span className="font-bold text-navy-900 dark:text-slate-200">
              حالة وردية اليوم: {isShiftOpen ? 'مفتوحة (قيد العمل)' : isShiftClosed ? 'مغلقة ومطابقة' : 'لم تُفتح بعد'}
            </span>
          </div>

          <Link
            to="/daily-closing"
            className="text-xs text-gold-700 dark:text-gold-400 hover:text-gold-800 dark:hover:text-gold-300 font-extrabold hover:underline flex items-center gap-1"
          >
            <span>{isShiftOpen ? 'إغلاق الوردية' : 'إدارة الوردية'}</span>
            <span>⏱️</span>
          </Link>
        </div>
      </div>

      {/* Quick Actions Shortcuts Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Link
          to="/sales"
          className="p-3.5 bg-ivory-50 dark:bg-navy-850 border border-ivory-300 dark:border-navy-750 hover:border-gold-500 rounded-xl flex items-center justify-between transition-all shadow-warm-xs group hover:bg-gold-50/20 dark:hover:bg-navy-800"
        >
          <div className="flex items-center gap-2.5">
            <Icon3D name="sales" size="sm" className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-navy-900 dark:text-slate-100 group-hover:text-gold-700 dark:group-hover:text-gold-400 transition-colors">
              🛒 فاتورة بيع جديدة
            </span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-gold-600 group-hover:translate-x-[-2px] transition-all" />
        </Link>

        <Link
          to="/payments"
          className="p-3.5 bg-ivory-50 dark:bg-navy-850 border border-ivory-300 dark:border-navy-750 hover:border-emerald-500 rounded-xl flex items-center justify-between transition-all shadow-warm-xs group hover:bg-emerald-50/30 dark:hover:bg-navy-800"
        >
          <div className="flex items-center gap-2.5">
            <Icon3D name="payments" size="sm" className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-navy-900 dark:text-slate-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors">
              💰 تسجيل تحصيل (FIFO)
            </span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-[-2px] transition-all" />
        </Link>

        <Link
          to="/lines"
          className="p-3.5 bg-ivory-50 dark:bg-navy-850 border border-ivory-300 dark:border-navy-750 hover:border-navy-500 rounded-xl flex items-center justify-between transition-all shadow-warm-xs group hover:bg-ivory-200/60 dark:hover:bg-navy-800"
        >
          <div className="flex items-center gap-2.5">
            <Icon3D name="lines" size="sm" className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-navy-900 dark:text-slate-100 group-hover:text-navy-900 dark:group-hover:text-gold-400 transition-colors">
              📱 إضافة خط للمخزن
            </span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-navy-700 group-hover:translate-x-[-2px] transition-all" />
        </Link>

        <Link
          to="/customers"
          className="p-3.5 bg-ivory-50 dark:bg-navy-850 border border-ivory-300 dark:border-navy-750 hover:border-navy-500 rounded-xl flex items-center justify-between transition-all shadow-warm-xs group hover:bg-ivory-200/60 dark:hover:bg-navy-800"
        >
          <div className="flex items-center gap-2.5">
            <Icon3D name="customers" size="sm" className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-navy-900 dark:text-slate-100 group-hover:text-navy-900 dark:group-hover:text-gold-400 transition-colors">
              👤 تسجيل عميل جديد
            </span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-navy-700 group-hover:translate-x-[-2px] transition-all" />
        </Link>
      </div>

      {/* Main KPI Cards Grid (Restrained Gold & Semantic Highlights) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Sales */}
        <Link
          to="/sales"
          className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between hover:border-gold-500 transition-all group relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gold-500 rounded-r"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-kufi font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>🛒</span>
              <span>مبيعات اليوم</span>
            </span>
            <div className="p-1 rounded-xl bg-ivory-200/80 dark:bg-navy-800 group-hover:scale-110 transition-transform">
              <Icon3D name="sales" size="md" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-navy-900 dark:text-slate-100 tracking-tight font-mono">
              {Money.format(summary?.todaySalesTotal || 0)}
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
              عدد الفواتير: <span className="font-extrabold text-navy-900 dark:text-slate-100">{summary?.todaySalesCount || 0}</span>
            </p>
          </div>
        </Link>

        {/* 2. Today's Collections */}
        <Link
          to="/payments"
          className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between hover:border-emerald-400 transition-all group relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-emerald-600 rounded-r"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-kufi font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>💰</span>
              <span>تحصيلات اليوم الواردة</span>
            </span>
            <div className="p-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 group-hover:scale-110 transition-transform">
              <Icon3D name="payments" size="md" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-400 tracking-tight font-mono">
              +{Money.format(summary?.todayPaymentsTotal || 0)}
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
              سندات التحصيل: <span className="font-extrabold text-navy-900 dark:text-slate-100">{summary?.todayPaymentsCount || 0}</span>
            </p>
          </div>
        </Link>

        {/* 3. Outstanding Customer Debts */}
        <Link
          to="/reports"
          className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between hover:border-rose-400 transition-all group relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-600 rounded-r"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-kufi font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>📈</span>
              <span>إجمالي المديونيات المستحقة</span>
            </span>
            <div className="p-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 group-hover:scale-110 transition-transform">
              <Icon3D name="reports" size="md" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-rose-800 dark:text-rose-400 tracking-tight font-mono">
              {Money.format(summary?.totalOutstandingDebt || 0)}
            </p>
            <p className="text-xs text-rose-800 dark:text-rose-400 font-extrabold mt-1">
              عرض تفاصيل الأشهر المتأخرة ←
            </p>
          </div>
        </Link>

        {/* 4. Total Lines & Customers */}
        <Link
          to="/lines"
          className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between hover:border-navy-500 transition-all group relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-navy-800 dark:bg-gold-500 rounded-r"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-kufi font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>📱</span>
              <span>إجمالي الخطوط والأرقام VIP</span>
            </span>
            <div className="p-1 rounded-xl bg-ivory-200/80 dark:bg-navy-800 group-hover:scale-110 transition-transform">
              <Icon3D name="lines" size="md" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-navy-900 dark:text-slate-100 tracking-tight font-mono">
              {summary?.totalLinesCount || 0} <span className="text-xs font-bold text-slate-700 dark:text-slate-300">خط</span>
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
              إجمالي العملاء: <span className="font-extrabold text-navy-900 dark:text-slate-100">{summary?.totalCustomersCount || 0} عميل</span>
            </p>
          </div>
        </Link>
      </div>

      {/* Live System Summary Pills Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-ivory-50 dark:bg-navy-850 p-4 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs">
        <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-navy-900 rounded-xl border border-ivory-300/80 dark:border-navy-750">
          <div className="flex items-center gap-2">
            <Icon3D name="companies" size="xs" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">🏢 شركات الاتصالات</span>
          </div>
          <span className="font-mono font-extrabold text-sm text-navy-900 dark:text-gold-400">{summary?.totalCompaniesCount || 5}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-navy-900 rounded-xl border border-ivory-300/80 dark:border-navy-750">
          <div className="flex items-center gap-2">
            <Icon3D name="packages" size="xs" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">📦 باقات الاتصالات</span>
          </div>
          <span className="font-mono font-extrabold text-sm text-navy-900 dark:text-gold-400">{summary?.totalPackagesCount || 67}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-navy-900 rounded-xl border border-ivory-300/80 dark:border-navy-750">
          <div className="flex items-center gap-2">
            <Icon3D name="customers" size="xs" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">👤 العملاء المدينين</span>
          </div>
          <span className="font-mono font-extrabold text-sm text-rose-600 dark:text-rose-400">{summary?.debtorsCount || 0} عميل</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-navy-900 rounded-xl border border-ivory-300/80 dark:border-navy-750">
          <div className="flex items-center gap-2">
            <Icon3D name="treasury" size="xs" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">🏛️ رصيد الخزائن</span>
          </div>
          <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">{Money.format(summary?.totalTreasuryBalance || 0)}</span>
        </div>
      </div>

      {/* --- DASHBOARD WIDGETS ROW: Scratchpad + Numbered Daily To-Do List --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WIDGET A: Persistent Scratchpad / Quick Notes Widget */}
        <div className="bg-ivory-50 dark:bg-navy-850 p-5.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-ivory-300 dark:border-navy-750 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-navy-900 dark:bg-navy-800 text-gold-400">
                <FileEdit className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                  ملاحظات ومفكرة الورديات الفورية
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">
                  مسودة سريعة تحفظ آلياً ومتاحة باستمرار في لوحة التحكم
                </p>
              </div>
            </div>

            {/* Saved Status Indicator Badge */}
            {scratchpadSaved && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold animate-in fade-in">
                <Sparkles className="w-3.5 h-3.5" />
                <span>تم الحفظ تلقائياً</span>
              </div>
            )}
          </div>

          <textarea
            value={scratchpadText}
            onChange={handleScratchpadChange}
            placeholder="اكتب أي ملاحظات سريعة، تذكيرات بالتحصيل، أو تعليمات الوردية القادمة هنا..."
            rows={7}
            className="w-full p-4 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-sm text-navy-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 resize-none font-medium leading-relaxed custom-scrollbar transition-all"
          />

          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-bold pt-1">
            <span>عدد الحروف: {scratchpadText.length}</span>
            <span>يتم الحفظ التلقائي في المتصفح</span>
          </div>
        </div>

        {/* WIDGET B: Numbered Interactive Daily To-Do List */}
        <div className="bg-ivory-50 dark:bg-navy-850 p-5.5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-ivory-300 dark:border-navy-750 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-navy-900 dark:bg-navy-800 text-gold-400">
                <CheckSquare className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                  قائمة المهام اليومية المرقمة
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">
                  تنفيذ ومتابعة المهام المطلوبة خلال وردية اليوم
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 bg-ivory-200 dark:bg-navy-800 border border-ivory-300 dark:border-navy-700 text-navy-900 dark:text-slate-200 rounded-lg text-xs font-bold">
              {activeTodos.length} متبقية
            </span>
          </div>

          {/* Add New Task Form */}
          <form onSubmit={handleAddTodo} className="flex items-center gap-2">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="إضافة مهمة جديدة لوردية اليوم..."
              className="flex-1 px-3.5 py-2 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-xs text-navy-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 font-medium"
            />
            <Button type="submit" variant="gold" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              إضافة
            </Button>
          </form>

          {/* Tasks Container */}
          <div className="space-y-4 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
            {/* Active Numbered Tasks */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-extrabold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                المهام النشطة ({activeTodos.length})
              </h4>

              {activeTodos.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center italic font-medium">
                  لا توجد مهام معلقة. أحسنت!
                </p>
              ) : (
                activeTodos.map((todo, idx) => (
                  <div
                    key={todo.id}
                    className="p-3 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl flex items-center justify-between gap-3 group hover:border-gold-500/50 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Number Badge */}
                      <span className="w-5 h-5 rounded-md bg-navy-900 dark:bg-navy-800 text-gold-400 font-mono text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      {/* Custom Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleTodo(todo.id)}
                        className="text-slate-400 hover:text-gold-500 transition-colors flex-shrink-0"
                      >
                        <Square className="w-4.5 h-4.5" />
                      </button>
                      <span className="text-xs font-bold text-navy-900 dark:text-slate-100 truncate">
                        {todo.text}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="حذف المهمة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Completed Tasks Section */}
            {completedTodos.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-ivory-300 dark:border-navy-800">
                <h4 className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تم إنجازها ({completedTodos.length})</span>
                </h4>

                {completedTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="p-2.5 bg-ivory-200/50 dark:bg-navy-900/60 border border-ivory-300/60 dark:border-navy-800 rounded-xl flex items-center justify-between gap-3 text-xs opacity-85 transition-all"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTodo(todo.id)}
                        className="text-emerald-600 dark:text-emerald-400 flex-shrink-0"
                        title="إعادة المهمة للمهام المعلقة"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                      <span className="font-medium text-slate-500 dark:text-slate-400 line-through truncate">
                        {todo.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Timestamp Badge */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-md text-[10px] font-bold">
                        <Clock className="w-3 h-3" />
                        <span>تم الإنجاز: {todo.completedAt}</span>
                      </span>

                      {/* Undo Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleTodo(todo.id)}
                        className="p-1 text-slate-400 hover:text-navy-900 dark:hover:text-gold-400 transition-colors"
                        title="إلغاء التحديد"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
