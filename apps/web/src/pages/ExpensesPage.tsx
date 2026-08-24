import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ContextualSearchBar } from '../components/ui/ContextualSearchBar';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Eye, Plus, Search } from 'lucide-react';
import { PaymentMethod, PERMISSIONS, Money } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface Expense {
  id: string;
  expenseNumber: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  treasuryAccountId: string;
  description: string;
  category?: { id: string; name: string };
  treasuryAccount?: { id: string; name: string };
  creator?: { username: string; fullName: string };
}

export const ExpensesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals state
  const [isCreateExpenseModalOpen, setIsCreateExpenseModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Form states
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formTreasuryId, setFormTreasuryId] = useState('');
  const [formMethod, setFormMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [formDescription, setFormDescription] = useState('');

  // Category creation
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // 1. Fetch Expense Categories
  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => apiClient('/expenses/categories'),
  });

  // 2. Fetch Treasury Accounts for Outflow
  const { data: treasuryAccounts } = useQuery({
    queryKey: ['treasury-accounts'],
    queryFn: () => apiClient('/treasury/accounts'),
    enabled: isCreateExpenseModalOpen,
  });

  // 3. Fetch Expenses List
  const { data, isLoading } = useQuery<{ items: Expense[]; meta: any }>({
    queryKey: ['expenses', page, categoryFilter],
    queryFn: () =>
      apiClient(
        `/expenses?page=${page}&limit=15&categoryId=${categoryFilter}`,
      ),
  });

  // Create Expense Mutation
  const createExpenseMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('تم تسجيل المصروف وخصم المبلغ من الخزينة بنجاح');
      setIsCreateExpenseModalOpen(false);
      resetExpenseForm();
    },
    onError: (err: any) => {
      toast.error('فشل تسجيل المصروف', err.message);
    },
  });

  // Create Category Mutation
  const createCategoryMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/expenses/categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast.success('تم إضافة بند المصروفات بنجاح');
      setIsCategoryModalOpen(false);
      setNewCatName('');
      setNewCatDesc('');
    },
    onError: (err: any) => {
      toast.error('فشل إضافة البند', err.message);
    },
  });

  const resetExpenseForm = () => {
    setFormCategoryId('');
    setFormAmount(0);
    setFormTreasuryId('');
    setFormMethod(PaymentMethod.CASH);
    setFormDescription('');
  };

  const columns: Column<Expense>[] = [
    {
      header: 'رقم السند',
      accessorKey: 'expenseNumber',
      className: 'font-mono font-bold text-slate-900 dark:text-slate-100',
    },
    {
      header: 'تاريخ الصرف',
      cell: (e) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
          {new Date(e.expenseDate).toLocaleDateString('ar-EG')}
        </span>
      ),
    },
    {
      header: 'بند المصروف',
      cell: (e) => (
        <Badge variant="neutral">{e.category?.name || 'عام'}</Badge>
      ),
    },
    {
      header: 'الخزينة المخصوم منها',
      cell: (e) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {e.treasuryAccount?.name}
        </span>
      ),
    },
    {
      header: 'المبلغ (EGP)',
      cell: (e) => (
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
          -{Money.format(e.amount)}
        </span>
      ),
    },
    {
      header: 'طريقة الدفع',
      cell: (e) => <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{e.paymentMethod}</span>,
    },
    {
      header: 'البيان والتفاصيل',
      cell: (e) => (
        <span className="text-xs text-slate-700 dark:text-slate-300 block max-w-sm truncate font-medium">
          {e.description}
        </span>
      ),
    },
    {
      header: 'الإجراءات',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (e) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(evt) => evt.stopPropagation()}>
          <button
            onClick={() => toast.success(`تفاصيل المصروف: ${e.category?.name || 'عام'} بمبلغ ${Money.format(e.amount)} - ${e.description}`)}
            title="عرض تفاصيل المصروف"
            aria-label="عرض تفاصيل المصروف"
            className="p-1.5 rounded-lg hover:bg-ivory-200 dark:hover:bg-navy-800 transition-colors group/btn"
          >
            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover/btn:scale-110 transition-transform" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-kufi font-extrabold text-navy-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Icon3D name="expenses" size="lg" />
            <span>سجل المصروفات العامة والنثريات 💸</span>
          </h1>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
            تسجيل مصروفات التشغيل، خصم المبالغ فورياً من الخزينة، وتصنيف بنود الإنفاق
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasPermission(PERMISSIONS.EXPENSES_CREATE) && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsCategoryModalOpen(true)}
                leftIcon={<Icon3D name="plus" size="xs" />}
              >
                إضافة بند جديد
              </Button>
              <Button
                variant="gold"
                onClick={() => {
                  resetExpenseForm();
                  if (treasuryAccounts && treasuryAccounts.length > 0) {
                    setFormTreasuryId(treasuryAccounts[0].id);
                  }
                  setIsCreateExpenseModalOpen(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                تسجيل مصروف جديد
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Contextual Smart Search & Quick Filter Pills Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
          {[
            { label: 'الكل', value: '' },
            { label: 'إيجار', value: 'إيجار' },
            { label: 'كهرباء', value: 'كهرباء' },
            { label: 'إنترنت', value: 'إنترنت' },
            { label: 'مرتبات', value: 'مرتبات' },
            { label: 'مواصلات', value: 'مواصلات' },
            { label: 'صيانة', value: 'صيانة' },
            { label: 'تسويق', value: 'تسويق' },
            { label: 'مشتريات', value: 'مشتريات' },
            { label: 'خدمات', value: 'خدمات' },
          ].map((pill) => {
            const activeCategory = categories?.find((c: any) => c.name.includes(pill.value));
            const isActive = pill.value === '' ? !categoryFilter : categoryFilter === activeCategory?.id || categoryFilter === pill.value;
            return (
              <button
                key={pill.label}
                onClick={() => {
                  if (pill.value === '') {
                    setCategoryFilter('');
                  } else if (activeCategory) {
                    setCategoryFilter(activeCategory.id);
                  } else {
                    setCategoryFilter(pill.value);
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
          value={categoryFilter}
          onChange={() => {}}
          placeholder="بحث فوري في المصروفات المسجلة..."
          filteredCount={data?.items?.length || 0}
          totalCount={data?.meta?.totalItems || 0}
          filterSlots={
            <div className="w-48">
              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">جميع بنود المصروفات</option>
                {categories?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
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
        emptyMessage="لم يتم العثور على مصروفات مسجلة"
      />

      <Pagination
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalItems={data?.meta?.totalItems || 0}
        onPageChange={(p) => setPage(p)}
      />

      {/* 1. Modal: Record Expense */}
      <Modal
        isOpen={isCreateExpenseModalOpen}
        onClose={() => setIsCreateExpenseModalOpen(false)}
        title="تسجيل إذن صرف نقدي"
        description="سيتم خصم المبلغ فوراً من الخزينة المحددة وتسجيل قيد سحب نقدية"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCreateExpenseModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              isLoading={createExpenseMutation.isPending}
              onClick={() => {
                if (!formCategoryId || formAmount <= 0 || !formTreasuryId || !formDescription) {
                  toast.error('يرجى اختيار البند والخزينة وكتابة المبلغ والبيان');
                  return;
                }

                createExpenseMutation.mutate({
                  categoryId: formCategoryId,
                  amount: Number(formAmount),
                  treasuryAccountId: formTreasuryId,
                  paymentMethod: formMethod,
                  description: formDescription,
                });
              }}
            >
              صرف المبلغ ({Money.format(formAmount)})
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="بند المصروف *"
            value={formCategoryId}
            onChange={(e) => setFormCategoryId(e.target.value)}
          >
            <option value="">اختر البند...</option>
            {categories?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="المبلغ المصروف (ج.م صحيح) *"
              type="number"
              min="1"
              value={formAmount}
              onChange={(e) => setFormAmount(parseInt(e.target.value, 10) || 0)}
            />
            <Select
              label="طريقة الصرف *"
              value={formMethod}
              onChange={(e) => setFormMethod(e.target.value as PaymentMethod)}
            >
              <option value={PaymentMethod.CASH}>كاش (CASH)</option>
              <option value={PaymentMethod.BANK}>شيك / تحويل (BANK)</option>
              <option value={PaymentMethod.WALLET}>محفظة إلكترونية (WALLET)</option>
            </Select>
          </div>

          <Select
            label="الخصم من خزينة / حساب *"
            value={formTreasuryId}
            onChange={(e) => setFormTreasuryId(e.target.value)}
          >
            <option value="">اختر الخزينة...</option>
            {treasuryAccounts?.map((acc: any) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} (رصيد حالي: {Money.format(acc.currentBalance)})
              </option>
            ))}
          </Select>

          <Textarea
            label="البيان والتفاصيل *"
            placeholder="مثال: فاتورة كهرباء الفرع، شراء مستلزمات مكتبية..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
        </div>
      </Modal>

      {/* 2. Modal: Create Expense Category */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="إضافة بند مصروفات جديد"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              isLoading={createCategoryMutation.isPending}
              onClick={() => {
                if (!newCatName) {
                  toast.error('يرجى كتابة اسم البند');
                  return;
                }
                createCategoryMutation.mutate({
                  name: newCatName,
                  description: newCatDesc || undefined,
                });
              }}
            >
              إضافة البند
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="اسم بند المصروف *"
            placeholder="مثال: دعاية وتسويق"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
          />
          <Textarea
            label="وصف البند"
            placeholder="شرح المصروفات التابعة لهذا البند..."
            value={newCatDesc}
            onChange={(e) => setNewCatDesc(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
