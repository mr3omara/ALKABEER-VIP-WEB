import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column } from '../components/ui/Table';
import { Badge, CompanyBadge, getStatusBadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ContextualSearchBar } from '../components/ui/ContextualSearchBar';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Calendar,
  UserCheck,
  FileText,
  Boxes,
  ShieldCheck,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { PERMISSIONS } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface Company {
  id: string;
  name: string;
  code: string;
  color?: string;
  paymentDay: number;
  renewalDate?: string;
  sponsorName?: string;
  sponsorPhone?: string;
  accountManagerName?: string;
  accountManagerPhone?: string;
  contractNumber?: string;
  notes?: string;
  status: string;
  createdAt: string;
  _count?: { lines: number };
}

export const CompaniesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formColor, setFormColor] = useState('#E60000');
  const [formRenewalDate, setFormRenewalDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [formPaymentDay, setFormPaymentDay] = useState<number>(1);
  const [formSponsorName, setFormSponsorName] = useState('');
  const [formSponsorPhone, setFormSponsorPhone] = useState('');
  const [formAccountManagerName, setFormAccountManagerName] = useState('');
  const [formAccountManagerPhone, setFormAccountManagerPhone] = useState('');
  const [formContractNumber, setFormContractNumber] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState('ACTIVE');

  // Fetch Companies
  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: () => apiClient('/companies'),
  });

  const resetForm = () => {
    setFormName('');
    setFormCode('');
    setFormColor('#E60000');
    setFormRenewalDate(new Date().toISOString().split('T')[0]);
    setFormPaymentDay(1);
    setFormSponsorName('');
    setFormSponsorPhone('');
    setFormAccountManagerName('');
    setFormAccountManagerPhone('');
    setFormContractNumber('');
    setFormNotes('');
    setFormStatus('ACTIVE');
    setSelectedCompany(null);
  };

  const handleOpenEdit = (comp: Company) => {
    setSelectedCompany(comp);
    setFormName(comp.name);
    setFormCode(comp.code);
    setFormColor(comp.color || '#E60000');
    setFormRenewalDate(
      comp.renewalDate
        ? new Date(comp.renewalDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    );
    setFormPaymentDay(comp.paymentDay || 1);
    setFormSponsorName(comp.sponsorName || '');
    setFormSponsorPhone(comp.sponsorPhone || '');
    setFormAccountManagerName(comp.accountManagerName || '');
    setFormAccountManagerPhone(comp.accountManagerPhone || '');
    setFormContractNumber(comp.contractNumber || '');
    setFormNotes(comp.notes || '');
    setFormStatus(comp.status || 'ACTIVE');
    setIsEditModalOpen(true);
  };

  // Create Company Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/companies', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('تم إضافة شركة الاتصالات بنجاح');
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('فشل إضافة الشركة', err.message);
    },
  });

  // Update Company Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiClient(`/companies/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('تم تحديث بيانات شركة الاتصالات بنجاح');
      setIsEditModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('فشل تحديث بيانات الشركة', err.message);
    },
  });

  // Delete Company Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/companies/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('تم حذف شركة الاتصالات بنجاح');
      setIsDeleteModalOpen(false);
      setSelectedCompany(null);
    },
    onError: (err: any) => {
      toast.error('تعذر حذف الشركة', err.message);
    },
  });

  const companiesList: Company[] = React.useMemo(() => {
    if (!companies) return [];
    if (Array.isArray(companies)) return companies;
    if (Array.isArray((companies as any).items)) return (companies as any).items;
    return [];
  }, [companies]);

  // Filtered List
  const filteredCompanies = companiesList.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.sponsorName && c.sponsorName.toLowerCase().includes(q)) ||
      (c.accountManagerName && c.accountManagerName.toLowerCase().includes(q)) ||
      (c.contractNumber && c.contractNumber.toLowerCase().includes(q))
    );
  });

  // Top KPIs
  const totalCompaniesCount = companiesList.length;
  const activeCompaniesCount = companiesList.filter((c) => c.status === 'ACTIVE').length;
  const totalBoundLines = companiesList.reduce((acc, c) => acc + (c._count?.lines || 0), 0);

  const columns: Column<Company>[] = [
    {
      header: 'الاسم المختصر / الكود',
      cell: (c) => (
        <CompanyBadge
          companyNameOrCode={c.name || c.code}
          color={c.color}
        />
      ),
    },
    {
      header: 'اسم الشركة المزودة والتعاقد',
      cell: (c) => (
        <div className="space-y-0.5">
          <span className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm block">
            {c.name}
          </span>
          {c.contractNumber && (
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block">
              رقم التعاقد: {c.contractNumber}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'يوم / تاريخ التجديد الحاكم',
      cell: (c) => (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-amber-700 dark:text-gold-400 bg-amber-50 dark:bg-[#0E203C] px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-[#1E3A5F]">
            <Calendar className="w-3.5 h-3.5" />
            <span>يوم {c.paymentDay || (c.renewalDate ? new Date(c.renewalDate).getDate() : 1)} شهرياً</span>
          </span>
          {c.renewalDate && (
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">
              تاريخ الأساس: {new Date(c.renewalDate).toLocaleDateString('ar-EG')}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'الخطوط المسجلة بالشركة',
      cell: (c) => (
        <span className="inline-flex items-center gap-1.5 font-bold font-mono text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
          <Phone className="w-3.5 h-3.5" />
          <span>{c._count?.lines || 0} خط</span>
        </span>
      ),
    },
    {
      header: 'مسؤول الحساب والراعي',
      cell: (c) => (
        <div className="space-y-0.5 text-xs">
          {c.accountManagerName ? (
            <div className="text-slate-800 dark:text-slate-200 font-semibold">
              <span>مسؤول: {c.accountManagerName}</span>
              {c.accountManagerPhone && (
                <span className="font-mono text-slate-500 dark:text-slate-400 mr-1 text-[11px]">
                  ({c.accountManagerPhone})
                </span>
              )}
            </div>
          ) : null}
          {c.sponsorName ? (
            <div className="text-slate-600 dark:text-slate-400 text-[11px]">
              <span>الراعي: {c.sponsorName}</span>
              {c.sponsorPhone && (
                <span className="font-mono mr-1">({c.sponsorPhone})</span>
              )}
            </div>
          ) : null}
          {!c.accountManagerName && !c.sponsorName && (
            <span className="text-slate-400">—</span>
          )}
        </div>
      ),
    },
    {
      header: 'الحالة',
      cell: (c) => (
        <Badge variant={c.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {c.status === 'ACTIVE' ? 'نشط' : 'معطل'}
        </Badge>
      ),
    },
    {
      header: 'الإجراءات',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (c) => (
        <div
          className="flex items-center justify-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {hasPermission(PERMISSIONS.COMPANIES_MANAGE) && (
            <>
              <button
                type="button"
                onClick={() => handleOpenEdit(c)}
                title="تعديل بيانات الشركة"
                aria-label="تعديل بيانات الشركة"
                className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-amber-600 dark:text-amber-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCompany(c);
                  setIsDeleteModalOpen(true);
                }}
                title="حذف الشركة"
                aria-label="حذف الشركة"
                className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-rose-600 dark:text-rose-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans text-navy-900 dark:text-slate-100 pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-kufi font-extrabold text-navy-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Icon3D name="companies" size="lg" />
            <span>شركات الاتصالات ومزودي الخدمة 🏢</span>
          </h1>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
            إدارة بيانات شركات المحمول (فودافون، أورانج، اتصالات، WE) وتواريخ التجديد الحاكمة
          </p>
        </div>

        {hasPermission(PERMISSIONS.COMPANIES_MANAGE) && (
          <Button
            variant="gold"
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            leftIcon={<Icon3D name="plus" size="xs" />}
          >
            إضافة شركة جديدة
          </Button>
        )}
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-ivory-50 dark:bg-[#0E203C] p-4.5 rounded-2xl border border-ivory-300 dark:border-[#1E3A5F] shadow-warm-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold block mb-1">
              🏢 إجمالي شركات الاتصالات
            </span>
            <p className="text-2xl font-extrabold font-mono text-navy-900 dark:text-slate-100">
              {totalCompaniesCount} شركة
            </p>
          </div>
          <div className="p-1 rounded-xl">
            <Icon3D name="companies" size="lg" />
          </div>
        </div>

        <div className="bg-ivory-50 dark:bg-[#0E203C] p-4.5 rounded-2xl border border-ivory-300 dark:border-[#1E3A5F] shadow-warm-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold block mb-1">
              ✅ الشركات النشطة
            </span>
            <p className="text-2xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
              {activeCompaniesCount} نشط
            </p>
          </div>
          <div className="p-1 rounded-xl">
            <Icon3D name="check" size="lg" />
          </div>
        </div>

        <div className="bg-ivory-50 dark:bg-[#0E203C] p-4.5 rounded-2xl border border-ivory-300 dark:border-[#1E3A5F] shadow-warm-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold block mb-1">
              📱 إجمالي الخطوط المربوطة بالمخزن
            </span>
            <p className="text-2xl font-extrabold font-mono text-blue-700 dark:text-blue-400">
              {totalBoundLines} خط
            </p>
          </div>
          <div className="p-1 rounded-xl">
            <Icon3D name="lines" size="lg" />
          </div>
        </div>
      </div>

      {/* 3. Search Bar */}
      <ContextualSearchBar
        value={search}
        onChange={(val) => setSearch(val)}
        placeholder="بحث باسم الشركة، الكود المعياري، مسؤول الحساب، أو رقم التعاقد..."
        filteredCount={filteredCompanies.length}
        totalCount={companies?.length || 0}
      />

      {/* 4. Data Table with High-Contrast Tokens */}
      <div className="bg-ivory-50 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] rounded-2xl overflow-hidden shadow-warm-xs">
        <Table
          columns={columns}
          data={filteredCompanies}
          isLoading={isLoading}
          emptyMessage="لم يتم العثور على شركات اتصالات مسجلة"
        />
      </div>

      {/* 5. Modal: Create Company */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="lg"
        title="إضافة شركة اتصالات ومزود خدمة جديد"
        description="تسجيل بيانات الشركة وتاريخ التجديد الحاكم والمسؤولين"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="gold"
              isLoading={createMutation.isPending}
              onClick={() => {
                if (!formName.trim() || !formCode.trim()) {
                  toast.error('يرجى إدخال اسم الشركة والكود المعياري');
                  return;
                }
                createMutation.mutate({
                  name: formName.trim(),
                  code: formCode.trim().toUpperCase(),
                  color: formColor,
                  renewalDate: formRenewalDate,
                  paymentDay: Number(formPaymentDay) || 1,
                  sponsorName: formSponsorName.trim() || undefined,
                  sponsorPhone: formSponsorPhone.trim() || undefined,
                  accountManagerName: formAccountManagerName.trim() || undefined,
                  accountManagerPhone: formAccountManagerPhone.trim() || undefined,
                  contractNumber: formContractNumber.trim() || undefined,
                  notes: formNotes.trim() || undefined,
                  status: formStatus,
                });
              }}
            >
              حفظ وتأكيد الشركة
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          {/* Main Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="الاسم المختصر / الكود المعياري *"
              placeholder="مثال: S 25 أو VF-CORP أو ET-VIP"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              dir="ltr"
              required
            />

            <Input
              label="اسم الشركة المزودة بالكامل *"
              placeholder="مثال: فودافون مصر - حساب الشركات 25"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          {/* Renewal date & color & payment day */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="يوم / تاريخ التجديد الحاكم *"
              type="date"
              value={formRenewalDate}
              onChange={(e) => {
                setFormRenewalDate(e.target.value);
                if (e.target.value) {
                  const day = new Date(e.target.value).getDate();
                  if (day) setFormPaymentDay(day);
                }
              }}
              required
            />

            <Input
              label="يوم الاستحقاق الشهري (1-31)"
              type="number"
              min="1"
              max="31"
              value={formPaymentDay}
              onChange={(e) => setFormPaymentDay(parseInt(e.target.value, 10) || 1)}
            />

            <Input
              label="اللون التعريفي"
              type="color"
              value={formColor}
              onChange={(e) => setFormColor(e.target.value)}
            />
          </div>

          {/* Account Manager & Sponsor Info */}
          <div className="p-3.5 bg-ivory-100 dark:bg-navy-900 rounded-xl border border-ivory-300 dark:border-navy-750 space-y-3">
            <h4 className="text-xs font-extrabold text-navy-900 dark:text-slate-100 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-500" />
              <span>بيانات مسؤول الحساب والراعي الشخصي (اختياري)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="اسم مسؤول الحساب بالشركة"
                placeholder="اسم المسؤول في شركة الاتصالات"
                value={formAccountManagerName}
                onChange={(e) => setFormAccountManagerName(e.target.value)}
              />

              <Input
                label="رقم هاتف مسؤول الحساب"
                placeholder="010..."
                value={formAccountManagerPhone}
                onChange={(e) => setFormAccountManagerPhone(e.target.value)}
                dir="ltr"
              />

              <Input
                label="اسم الراعي الشخصي (Sponsor)"
                placeholder="اسم الراعي"
                value={formSponsorName}
                onChange={(e) => setFormSponsorName(e.target.value)}
              />

              <Input
                label="رقم هاتف الراعي"
                placeholder="010..."
                value={formSponsorPhone}
                onChange={(e) => setFormSponsorPhone(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          {/* Contract Numbers & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="أرقام التفويض والتعاقد"
              placeholder="مثال: AUTH-2026-8800"
              value={formContractNumber}
              onChange={(e) => setFormContractNumber(e.target.value)}
            />

            <Select
              label="حالة الحساب"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
            >
              <option value="ACTIVE">نشط (Active)</option>
              <option value="INACTIVE">معطل (Inactive)</option>
            </Select>
          </div>

          <Textarea
            label="ملاحظات الشركة والتعاقد"
            rows={2}
            placeholder="شروط الباقات، أرقام الحسابات، تفاصيل الفوترة..."
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* 6. Modal: Edit Company */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        size="lg"
        title="تعديل بيانات شركة الاتصالات"
        description="تحديث دورة التجديد، أرقام التواصل، والتعاقد"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="gold"
              isLoading={updateMutation.isPending}
              onClick={() => {
                if (!selectedCompany) return;
                if (!formName.trim() || !formCode.trim()) {
                  toast.error('يرجى إدخال اسم الشركة والكود المعياري');
                  return;
                }
                updateMutation.mutate({
                  id: selectedCompany.id,
                  payload: {
                    name: formName.trim(),
                    code: formCode.trim().toUpperCase(),
                    color: formColor,
                    renewalDate: formRenewalDate,
                    paymentDay: Number(formPaymentDay) || 1,
                    sponsorName: formSponsorName.trim() || undefined,
                    sponsorPhone: formSponsorPhone.trim() || undefined,
                    accountManagerName: formAccountManagerName.trim() || undefined,
                    accountManagerPhone: formAccountManagerPhone.trim() || undefined,
                    contractNumber: formContractNumber.trim() || undefined,
                    notes: formNotes.trim() || undefined,
                    status: formStatus,
                  },
                });
              }}
            >
              حفظ التعديلات
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          {/* Main Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="الاسم المختصر / الكود المعياري *"
              placeholder="مثال: S 25 أو VF-CORP"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              dir="ltr"
              required
            />

            <Input
              label="اسم الشركة المزودة بالكامل *"
              placeholder="مثال: فودافون مصر - حساب الشركات 25"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          {/* Renewal date & color & payment day */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="يوم / تاريخ التجديد الحاكم *"
              type="date"
              value={formRenewalDate}
              onChange={(e) => {
                setFormRenewalDate(e.target.value);
                if (e.target.value) {
                  const day = new Date(e.target.value).getDate();
                  if (day) setFormPaymentDay(day);
                }
              }}
              required
            />

            <Input
              label="يوم الاستحقاق الشهري (1-31)"
              type="number"
              min="1"
              max="31"
              value={formPaymentDay}
              onChange={(e) => setFormPaymentDay(parseInt(e.target.value, 10) || 1)}
            />

            <Input
              label="اللون التعريفي"
              type="color"
              value={formColor}
              onChange={(e) => setFormColor(e.target.value)}
            />
          </div>

          {/* Account Manager & Sponsor Info */}
          <div className="p-3.5 bg-ivory-100 dark:bg-navy-900 rounded-xl border border-ivory-300 dark:border-navy-750 space-y-3">
            <h4 className="text-xs font-extrabold text-navy-900 dark:text-slate-100 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-500" />
              <span>بيانات مسؤول الحساب والراعي الشخصي (اختياري)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="اسم مسؤول الحساب بالشركة"
                placeholder="اسم المسؤول في شركة الاتصالات"
                value={formAccountManagerName}
                onChange={(e) => setFormAccountManagerName(e.target.value)}
              />

              <Input
                label="رقم هاتف مسؤول الحساب"
                placeholder="010..."
                value={formAccountManagerPhone}
                onChange={(e) => setFormAccountManagerPhone(e.target.value)}
                dir="ltr"
              />

              <Input
                label="اسم الراعي الشخصي (Sponsor)"
                placeholder="اسم الراعي"
                value={formSponsorName}
                onChange={(e) => setFormSponsorName(e.target.value)}
              />

              <Input
                label="رقم هاتف الراعي"
                placeholder="010..."
                value={formSponsorPhone}
                onChange={(e) => setFormSponsorPhone(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          {/* Contract Numbers & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="أرقام التفويض والتعاقد"
              placeholder="مثال: AUTH-2026-8800"
              value={formContractNumber}
              onChange={(e) => setFormContractNumber(e.target.value)}
            />

            <Select
              label="حالة الحساب"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
            >
              <option value="ACTIVE">نشط (Active)</option>
              <option value="INACTIVE">معطل (Inactive)</option>
            </Select>
          </div>

          <Textarea
            label="ملاحظات الشركة والتعاقد"
            rows={2}
            placeholder="شروط الباقات، أرقام الحسابات، تفاصيل الفوترة..."
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* 7. Modal: Delete Company */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="تأكيد حذف شركة الاتصالات"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              onClick={() => {
                if (selectedCompany) {
                  deleteMutation.mutate(selectedCompany.id);
                }
              }}
            >
              تأكيد الحذف
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
          هل أنت متأكد من رغبتك في حذف شركة الاتصالات{' '}
          <strong className="text-navy-900 dark:text-white">
            {selectedCompany?.name} ({selectedCompany?.code})
          </strong>
          ؟
        </p>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-bold">
          ملاحظة: لا يمكن حذف الشركة إذا كانت مرتبطة بخطوط في المخزن.
        </p>
      </Modal>
    </div>
  );
};
