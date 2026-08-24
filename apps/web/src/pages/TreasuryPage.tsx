import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column, Pagination } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ContextualSearchBar } from '../components/ui/ContextualSearchBar';
import {
  Landmark,
  Plus,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Building,
  CreditCard,
} from 'lucide-react';
import {
  TreasuryAccountType,
  TreasuryDirection,
  TreasuryTransactionType,
  PERMISSIONS,
  Money,
} from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface TreasuryAccount {
  id: string;
  name: string;
  type: TreasuryAccountType;
  openingBalance: number;
  currentBalance: number;
  status: string;
  createdAt: string;
}

interface TreasuryTransaction {
  id: string;
  transactionNumber: string;
  transactionType: TreasuryTransactionType;
  direction: TreasuryDirection;
  amount: number;
  accountId: string;
  description?: string;
  transactionDate: string;
  treasuryAccount?: { name: string; type: string };
  creator?: { username: string; fullName: string };
}

export const TreasuryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [accountFilter, setAccountFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Form states
  const [formAccountName, setFormAccountName] = useState('');
  const [formAccountType, setFormAccountType] = useState<TreasuryAccountType>(TreasuryAccountType.CASH);
  const [formOpeningBalance, setFormOpeningBalance] = useState<number>(0);

  const [formFromAccountId, setFormFromAccountId] = useState('');
  const [formToAccountId, setFormToAccountId] = useState('');
  const [formTransferAmount, setFormTransferAmount] = useState<number>(0);
  const [formTransferNotes, setFormTransferNotes] = useState('');

  // 1. Fetch Accounts
  const { data: accounts, isLoading: isAccountsLoading } = useQuery<TreasuryAccount[]>({
    queryKey: ['treasury-accounts'],
    queryFn: () => apiClient('/treasury/accounts'),
  });

  // 2. Fetch Transactions Ledger
  const { data: txData, isLoading: isTxLoading } = useQuery<{
    items: TreasuryTransaction[];
    meta: any;
  }>({
    queryKey: ['treasury-transactions', page, accountFilter, typeFilter],
    queryFn: () =>
      apiClient(
        `/treasury/transactions?page=${page}&limit=15&accountId=${accountFilter}&transactionType=${typeFilter}`,
      ),
  });

  // Create Account Mutation
  const createAccountMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/treasury/accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('تم إنشاء حساب الخزينة بنجاح');
      setIsCreateModalOpen(false);
      setFormAccountName('');
      setFormOpeningBalance(0);
    },
    onError: (err: any) => {
      toast.error('فشل إنشاء الحساب', err.message);
    },
  });

  // Transfer Mutation
  const transferMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/treasury/transfer', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('تم تحويل الأموال وتحديث الخزائن بنجاح');
      setIsTransferModalOpen(false);
      setFormTransferAmount(0);
      setFormTransferNotes('');
    },
    onError: (err: any) => {
      toast.error('فشل التحويل المالي', err.message);
    },
  });

  const getAccountIcon = (type: TreasuryAccountType) => {
    switch (type) {
      case 'BANK':
        return Building;
      case 'WALLET':
        return CreditCard;
      case 'CASH':
      default:
        return Wallet;
    }
  };

  const columns: Column<TreasuryTransaction>[] = [
    {
      header: 'رقم الحركة',
      accessorKey: 'transactionNumber',
      className: 'font-mono font-bold text-navy-900 dark:text-slate-100',
    },
    {
      header: 'التاريخ والوقت',
      cell: (tx) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono font-medium">
          {new Date(tx.transactionDate).toLocaleString('ar-EG')}
        </span>
      ),
    },
    {
      header: 'الحساب المالي',
      cell: (tx) => (
        <span className="font-semibold text-navy-900 dark:text-slate-100">
          {tx.treasuryAccount?.name}
        </span>
      ),
    },
    {
      header: 'نوع الحركة',
      cell: (tx) => (
        <Badge variant={tx.direction === 'IN' ? 'success' : 'danger'}>
          {tx.transactionType}
        </Badge>
      ),
    },
    {
      header: 'الاتجاه',
      cell: (tx) => (
        <span
          className={`font-bold flex items-center gap-1 ${
            tx.direction === 'IN' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
          }`}
        >
          {tx.direction === 'IN' ? (
            <>
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>إيداع (+IN)</span>
            </>
          ) : (
            <>
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>سحب (-OUT)</span>
            </>
          )}
        </span>
      ),
    },
    {
      header: 'المبلغ (EGP)',
      cell: (tx) => (
        <span
          className={`font-mono font-bold text-sm ${
            tx.direction === 'IN' ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'
          }`}
        >
          {tx.direction === 'IN' ? '+' : '-'} {Money.format(tx.amount)}
        </span>
      ),
    },
    {
      header: 'البيان / الوصف',
      cell: (tx) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs block font-medium">
          {tx.description || '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-kufi font-extrabold text-navy-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Icon3D name="treasury" size="lg" />
            <span>الخزينة والحسابات المالية 🏛️</span>
          </h1>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
            إدارة النقدية، الحسابات البنكية، المحافظ الإلكترونية، وحركات التدفق النقدي
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasPermission(PERMISSIONS.TREASURY_CREATE) && (
            <Button
              variant="outline"
              onClick={() => setIsTransferModalOpen(true)}
              leftIcon={<ArrowLeftRight className="w-4 h-4" />}
            >
              تحويل بين الخزائن
            </Button>
          )}

          {hasPermission(PERMISSIONS.TREASURY_MANAGE) && (
            <Button
              variant="gold"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              إضافة حساب / خزينة
            </Button>
          )}
        </div>
      </div>

      {/* Account Balances Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts?.map((acc) => {
          const Icon = getAccountIcon(acc.type);
          return (
            <div
              key={acc.id}
              className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-extrabold text-navy-900 dark:text-slate-100 text-base">{acc.name}</h3>
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-mono font-bold">{acc.type}</span>
                </div>
                <div className="p-3 rounded-xl bg-ivory-200 dark:bg-[#0E203C] text-amber-600 dark:text-gold-400 border border-ivory-300 dark:border-[#1E3A5F]">
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-bold block mb-1">الرصيد الحسابي الحقيقي</span>
                <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-400 font-mono tracking-tight">
                  {Money.format(acc.currentBalance)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Contextual Smart Search & Quick Filter Pills Bar */}
      <div className="space-y-2 font-sans">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
          {[
            { label: 'الكل', type: '' },
            { label: 'إيداعات / مقبوضات', type: 'SALE_PAYMENT' },
            { label: 'سحوبات / مصروفات', type: 'EXPENSE' },
            { label: 'تحويلات بين الخزن', type: 'TRANSFER' },
            { label: 'تسويات أرصدة', type: 'OPENING_BALANCE' },
          ].map((pill) => {
            const isActive = typeFilter === pill.type;
            return (
              <button
                key={pill.label}
                onClick={() => {
                  setTypeFilter(pill.type);
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
          value={accountFilter}
          onChange={() => {}}
          placeholder="بحث فوري في دفتر قيود الخزينة والتحويلات النقدية..."
          filteredCount={txData?.items?.length || 0}
          totalCount={txData?.meta?.totalItems || 0}
          filterSlots={
            <div className="flex flex-wrap md:flex-nowrap items-center gap-2.5">
              <div className="w-40">
                <Select
                  value={accountFilter}
                  onChange={(e) => {
                    setAccountFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">جميع الحسابات</option>
                  {accounts?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-48">
                <Select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">جميع أنواع القيود</option>
                  <option value={TreasuryTransactionType.SALE_PAYMENT}>تحصيل مبيعات (SALE_PAYMENT)</option>
                  <option value={TreasuryTransactionType.EXPENSE}>مصروفات (EXPENSE)</option>
                  <option value={TreasuryTransactionType.TRANSFER}>تحويل بين الحسابات (TRANSFER)</option>
                  <option value={TreasuryTransactionType.OPENING_BALANCE}>رصيد افتتاحي (OPENING_BALANCE)</option>
                </Select>
              </div>
            </div>
          }
        />
      </div>

      {/* Transactions Table */}
      <Table
        columns={columns}
        data={txData?.items || []}
        isLoading={isTxLoading}
        emptyMessage="لم يتم تسجيل حركات نقدية مطابقة"
      />

      <Pagination
        page={page}
        totalPages={txData?.meta?.totalPages || 1}
        totalItems={txData?.meta?.totalItems || 0}
        onPageChange={(p) => setPage(p)}
      />

      {/* 1. Modal: Create Account */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="إضافة خزينة أو حساب مالي جديد"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              isLoading={createAccountMutation.isPending}
              onClick={() => {
                if (!formAccountName) {
                  toast.error('يرجى كتابة اسم الحساب أو الخزينة');
                  return;
                }
                createAccountMutation.mutate({
                  name: formAccountName,
                  type: formAccountType,
                  openingBalance: Number(formOpeningBalance) || 0,
                });
              }}
            >
              إنشاء الحساب
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="اسم الحساب / الخزينة *"
            placeholder="مثال: خزينة الفرع الثاني (كاش)"
            value={formAccountName}
            onChange={(e) => setFormAccountName(e.target.value)}
          />

          <Select
            label="نوع الحساب *"
            value={formAccountType}
            onChange={(e) => setFormAccountType(e.target.value as TreasuryAccountType)}
          >
            <option value={TreasuryAccountType.CASH}>نقدية / كاش (CASH)</option>
            <option value={TreasuryAccountType.BANK}>حساب بنكي (BANK)</option>
            <option value={TreasuryAccountType.WALLET}>محفظة إلكترونية (WALLET)</option>
          </Select>

          <Input
            label="الرصيد الافتتاحي (ج.م صحيح)"
            type="number"
            min="0"
            value={formOpeningBalance}
            onChange={(e) => setFormOpeningBalance(parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </Modal>

      {/* 2. Modal: Transfer Funds */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="تحويل أموال بين حسابين"
        description="تسجيل قيد سحب من الحساب المصدر وقيد إيداع في الحساب المستلم"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsTransferModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              isLoading={transferMutation.isPending}
              onClick={() => {
                if (!formFromAccountId || !formToAccountId || formTransferAmount <= 0) {
                  toast.error('يرجى تحديد الحسابات والمبلغ المحول (> 0)');
                  return;
                }
                if (formFromAccountId === formToAccountId) {
                  toast.error('لا يمكن التحويل لنفس الحساب');
                  return;
                }

                transferMutation.mutate({
                  fromAccountId: formFromAccountId,
                  toAccountId: formToAccountId,
                  amount: Number(formTransferAmount),
                  description: formTransferNotes || undefined,
                });
              }}
            >
              تأكيد التحويل ({Money.format(formTransferAmount)})
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="من الحساب (المرسل) *"
            value={formFromAccountId}
            onChange={(e) => setFormFromAccountId(e.target.value)}
          >
            <option value="">اختر الحساب المصدر...</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} (رصيد متاح: {Money.format(a.currentBalance)})
              </option>
            ))}
          </Select>

          <Select
            label="إلى الحساب (المستلم) *"
            value={formToAccountId}
            onChange={(e) => setFormToAccountId(e.target.value)}
          >
            <option value="">اختر الحساب المستلم...</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} (رصيد حالي: {Money.format(a.currentBalance)})
              </option>
            ))}
          </Select>

          <Input
            label="المبلغ المحول (ج.م صحيح) *"
            type="number"
            min="1"
            value={formTransferAmount}
            onChange={(e) => setFormTransferAmount(parseInt(e.target.value, 10) || 0)}
          />

          <Textarea
            label="البيان / سبب التحويل"
            placeholder="مثال: توريد نقدية من الخزينة للبنك..."
            value={formTransferNotes}
            onChange={(e) => setFormTransferNotes(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
