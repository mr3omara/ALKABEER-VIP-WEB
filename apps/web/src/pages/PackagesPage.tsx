import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Badge, CompanyBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Building2,
  TrendingUp,
  Boxes,
  ExternalLink,
  Search,
  X,
  RefreshCw,
} from 'lucide-react';
import { PERMISSIONS, Money } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

export interface TelecomPackage {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  faceValue: number;
  costPrice: number;
  sellingPrice: number;
  profitMargin: number;
  details?: string;
  activeLinesCount: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

export function PackagesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const toast = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLinesModalOpen, setIsLinesModalOpen] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<TelecomPackage | null>(null);

  // Lines Viewer State
  const [linesList, setLinesList] = useState<any[]>([]);
  const [isLinesLoading, setIsLinesLoading] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formFaceValue, setFormFaceValue] = useState<number>(0);
  const [formCostPrice, setFormCostPrice] = useState<number>(0);
  const [formSellingPrice, setFormSellingPrice] = useState<number>(0);
  const [formDetails, setFormDetails] = useState('');

  // 1. Fetch Companies
  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiClient('/companies'),
  });

  const companies = useMemo(() => {
    if (!companiesData) return [];
    if (Array.isArray(companiesData)) return companiesData;
    if (Array.isArray((companiesData as any).items)) return (companiesData as any).items;
    return [];
  }, [companiesData]);

  // 2. Fetch Packages
  const { data: rawPackagesData, isLoading, refetch } = useQuery({
    queryKey: ['packages', search, companyFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (companyFilter.trim()) params.set('companyId', companyFilter.trim());
      return apiClient(`/inventory/packages?${params.toString()}`);
    },
  });

  const packages: TelecomPackage[] = useMemo(() => {
    const raw = Array.isArray(rawPackagesData)
      ? rawPackagesData
      : (rawPackagesData as any)?.items || [];
    
    // Strict Deduplication by (name.trim().toLowerCase() + sellingPrice)
    const seen = new Set<string>();
    const uniqueList: TelecomPackage[] = [];

    for (const p of raw) {
      const key = `${(p.name || '').trim().toLowerCase()}__${p.sellingPrice}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueList.push(p);
      }
    }
    return uniqueList;
  }, [rawPackagesData]);

  const totalCount = packages.length;

  const filteredList = useMemo(() => {
    return packages.filter((pkg) => {
      const s = search.toLowerCase().trim();
      const nameMatch = !s || (pkg.name || '').toLowerCase().includes(s);
      const compMatch = !companyFilter || pkg.companyCode === companyFilter || pkg.companyId === companyFilter;
      return nameMatch && compMatch;
    });
  }, [packages, search, companyFilter]);

  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/packages', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast.success('تم إضافة الباقة بنجاح');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('فشل إضافة الباقة', err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiClient(`/packages/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast.success('تم تعديل بيانات الباقة بنجاح');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('فشل تعديل الباقة', err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/packages/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast.success('تم حذف الباقة بنجاح');
      setIsDeleteOpen(false);
      setSelectedPkg(null);
    },
    onError: (err: any) => {
      toast.error('فشل حذف الباقة', err.message);
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const resetForm = () => {
    setSelectedPkg(null);
    setFormName('');
    setFormCompanyId(companies[0]?.id || '');
    setFormFaceValue(0);
    setFormCostPrice(0);
    setFormSellingPrice(0);
    setFormDetails('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pkg: TelecomPackage) => {
    setSelectedPkg(pkg);
    setFormName(pkg.name || '');
    setFormCompanyId(pkg.companyId || '');
    setFormFaceValue(pkg.faceValue || 0);
    setFormCostPrice(pkg.costPrice || 0);
    setFormSellingPrice(pkg.sellingPrice || 0);
    setFormDetails(pkg.details || '');
    setIsModalOpen(true);
  };

  const handleOpenLines = async (pkg: TelecomPackage) => {
    setSelectedPkg(pkg);
    setIsLinesModalOpen(true);
    setIsLinesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (pkg.sellingPrice) params.set('monthlyPackage', String(pkg.sellingPrice));
      if (pkg.companyId) params.set('companyId', pkg.companyId);
      const res: any = await apiClient(`/lines?${params.toString()}`);
      setLinesList(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []);
    } catch {
      setLinesList([]);
    }
    setIsLinesLoading(false);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formCompanyId) {
      toast.error('يرجى كتابة اسم الباقة واختيار الشركة');
      return;
    }
    if (formSellingPrice <= 0 || formCostPrice <= 0) {
      toast.error('يرجى إدخال أسعار الشراء والبيع بشكل صحيح');
      return;
    }

    const payload = {
      name: formName.trim(),
      companyId: formCompanyId,
      faceValue: Number(formFaceValue) || 0,
      costPrice: Number(formCostPrice) || 0,
      sellingPrice: Number(formSellingPrice) || 0,
      details: formDetails.trim() || undefined,
    };

    if (selectedPkg) {
      updateMutation.mutate({ id: selectedPkg.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = async () => {
    if (!selectedPkg) return;
    deleteMutation.mutate(selectedPkg.id);
  };

  const getBadgeStyle = (code?: string) => {
    switch (code?.toUpperCase()) {
      case 'VF':
      case 'VODAFONE':
        return 'bg-red-600 text-white border-red-700';
      case 'OR':
      case 'ORANGE':
        return 'bg-orange-500 text-white border-orange-600';
      case 'WE':
        return 'bg-purple-700 text-white border-purple-800';
      case 'ET':
      case 'ETISALAT':
        return 'bg-emerald-600 text-white border-emerald-700';
      default:
        return 'bg-navy-900 text-gold-400 border-navy-700';
    }
  };

  const totalLines = packages.reduce((acc, p) => acc + (p?.activeLinesCount || 0), 0);
  const avgMargin =
    totalCount > 0
      ? Number((packages.reduce((acc, p) => acc + (p?.profitMargin || 0), 0) / totalCount).toFixed(2))
      : 0;

  const currentMargin = Number((formSellingPrice - formCostPrice).toFixed(2));

  return (
    <div className="space-y-6 font-sans text-navy-900 dark:text-slate-100 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-kufi font-extrabold text-navy-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Icon3D name="packages" size="lg" />
            <span>إدارة باقات الاتصالات والاشتراكات 📦</span>
          </h1>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
            التحكم في أسعار باقات فودافون وأورانج وWE واتصالات وحساب هوامش الربح وربط الخطوط
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            title="تحديث البيانات"
          >
            تحديث
          </Button>

          {hasPermission(PERMISSIONS.INVENTORY_ADJUST) && (
            <Button
              variant="gold"
              onClick={handleOpenCreate}
              leftIcon={<Icon3D name="plus" size="xs" />}
            >
              إضافة باقة جديدة
            </Button>
          )}
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-ivory-50 dark:bg-navy-850 p-4 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              📦 إجمالي الباقات المسجلة
            </span>
            <p className="text-2xl font-extrabold text-navy-900 dark:text-slate-100 font-mono">
              {totalCount} باقة
            </p>
          </div>
          <div className="p-1 rounded-xl">
            <Icon3D name="packages" size="lg" />
          </div>
        </div>

        <div className="bg-ivory-50 dark:bg-navy-850 p-4 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              📈 متوسط هامش الربح للخط شهرياً
            </span>
            <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
              +{Money.format(avgMargin)} ج.م
            </p>
          </div>
          <div className="p-1 rounded-xl">
            <Icon3D name="dashboard" size="lg" />
          </div>
        </div>

        <div className="bg-ivory-50 dark:bg-navy-850 p-4 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              📱 إجمالي الخطوط المشتركة بالباقات
            </span>
            <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 font-mono">
              {totalLines} خط نشط
            </p>
          </div>
          <div className="p-1 rounded-xl">
            <Icon3D name="lines" size="lg" />
          </div>
        </div>
      </div>

      {/* 3. Filter Pills & Search */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
          {[
            { label: 'جميع الباقات', company: '' },
            { label: 'فودافون (VF)', company: 'VF' },
            { label: 'أورانج (OR)', company: 'OR' },
            { label: 'المصرية للاتصالات (WE)', company: 'WE' },
            { label: 'اتصالات (ET)', company: 'ET' },
          ].map((pill) => {
            const isActive = companyFilter === pill.company;
            return (
              <button
                key={pill.label}
                type="button"
                onClick={() => setCompanyFilter(pill.company)}
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

        <div className="bg-ivory-50 dark:bg-navy-850 p-4 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full flex items-center">
            <Search className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400 absolute right-3.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث فوري في أسماء الباقات، التفاصيل، أو الأسعار..."
              className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-sm text-navy-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 transition-all font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-3 p-1 text-slate-400 hover:text-navy-900 dark:hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="w-48">
              <Select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <option value="">جميع الشركات</option>
                {companies.map((c: any) => (
                  <option key={c.id || c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </Select>
            </div>

            <div className="px-3 py-1.5 bg-ivory-200/80 dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-xs font-bold text-navy-900 dark:text-slate-200 whitespace-nowrap">
              عرض <span className="font-extrabold text-gold-700 dark:text-gold-400">{filteredList.length}</span> من أصل <span className="font-extrabold">{totalCount}</span> باقة
            </div>
          </div>
        </div>
      </div>

      {/* 4. Rectangular Cards Grid */}
      {filteredList.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-navy-900 rounded-2xl border border-ivory-300 dark:border-navy-800 p-8">
          <Layers className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900 dark:text-slate-100">لا توجد باقات مسجلة</h3>
          <p className="text-xs text-slate-500 mt-1">
            لم يتم العثور على باقات تطابق معايير البحث. يمكنك إضافة باقة جديدة من الزر العلوي.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredList.map((pkg) => (
            <div
              key={`${pkg.id}_${pkg.name}_${pkg.sellingPrice}`}
              onClick={() => handleOpenEdit(pkg)}
              className="bg-ivory-50 dark:bg-navy-850 hover:bg-white dark:hover:bg-navy-800 border border-ivory-300 dark:border-navy-750 hover:border-amber-400 dark:hover:border-amber-500/50 rounded-2xl p-4.5 transition-all duration-200 hover:shadow-warm-md hover:scale-[1.01] cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <CompanyBadge
                    companyNameOrCode={pkg.companyName || pkg.companyCode}
                  />

                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-extrabold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                    <Phone className="w-3 h-3" />
                    <span>{pkg.activeLinesCount || 0} خط نشط</span>
                  </span>
                </div>

                <h3 className="text-sm font-kufi font-extrabold text-navy-900 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-gold-400 transition-colors">
                  {pkg.name}
                </h3>

                {pkg.details && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {pkg.details}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-ivory-200 dark:border-navy-750/80 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                      سعر الشراء / التكلفة:
                    </span>
                    <span className="font-mono font-extrabold text-rose-700 dark:text-rose-400">
                      {Money.format(pkg.costPrice || 0)} ج.م
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                      سعر البيع / الاشتراك:
                    </span>
                    <span className="font-mono font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                      {Money.format(pkg.sellingPrice || 0)} ج.م
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80">
                  <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">
                    صافي الربح المتوقع:
                  </span>
                  <span className="font-mono text-xs font-extrabold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-navy-950 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700">
                    +{Money.format(pkg.profitMargin ?? (pkg.sellingPrice - pkg.costPrice))} ج.م
                  </span>
                </div>
              </div>

              <div
                className="mt-3 pt-2.5 border-t border-ivory-200 dark:border-navy-750 flex items-center justify-between gap-1 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => handleOpenLines(pkg)}
                  className="px-2.5 py-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-blue-600 dark:text-blue-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] font-bold transition-colors flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>عرض الخطوط</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {hasPermission(PERMISSIONS.INVENTORY_ADJUST) && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(pkg)}
                        className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-amber-600 dark:text-amber-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
                        title="تعديل الباقة"
                        aria-label="تعديل الباقة"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPkg(pkg);
                          setIsDeleteOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-ivory-200 dark:bg-[#0E203C] border border-ivory-300 dark:border-[#1E3A5F] text-rose-600 dark:text-rose-400 hover:bg-ivory-300 dark:hover:bg-[#162B4D] transition-colors"
                        title="حذف الباقة"
                        aria-label="حذف الباقة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal 1: Create/Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedPkg ? `تعديل الباقة — ${selectedPkg.name}` : 'إضافة باقة اتصالات واشتراك جديد'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="gold"
              isLoading={isSubmitting}
              onClick={handleSave}
            >
              حفظ وتأكيد الباقة
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="اسم الباقة *"
              placeholder="مثال: 2025 Business Flex 80"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
            />

            <Select
              label="شركة الاتصالات المزودة *"
              value={formCompanyId}
              onChange={(e) => setFormCompanyId(e.target.value)}
            >
              <option value="">اختر الشركة...</option>
              {companies.map((c: any) => (
                <option key={c.id || c.code} value={c.id || c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="القيمة الاسمية (قبل الضريبة)"
              type="number"
              value={formFaceValue || ''}
              onChange={(e) => setFormFaceValue(Number(e.target.value))}
              placeholder="80.00"
            />

            <Input
              label="سعر الشراء / التكلفة (بعد الضريبة) *"
              type="number"
              value={formCostPrice || ''}
              onChange={(e) => setFormCostPrice(Number(e.target.value))}
              placeholder="114.50"
            />

            <Input
              label="سعر البيع للعميل (الاشتراك الشهري) *"
              type="number"
              value={formSellingPrice || ''}
              onChange={(e) => setFormSellingPrice(Number(e.target.value))}
              placeholder="130.00"
            />
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                هامش الربح الشهري المتوقع لكل خط:
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                سعر البيع ({Money.format(formSellingPrice)}) - سعر الشراء ({Money.format(formCostPrice)})
              </span>
            </div>
            <span className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-navy-950 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
              +{Money.format(currentMargin)} ج.م
            </span>
          </div>

          <Textarea
            label="ملاحظات وتفاصيل الباقة (دقائق، جيجابايت، شروط الاستخدام)"
            placeholder="مثال: 4000 فليكس + 10 جيجابايت إنترنت بيزنس وتجديد شهري تلقائي..."
            value={formDetails}
            onChange={(e) => setFormDetails(e.target.value)}
          />
        </div>
      </Modal>

      {/* Modal 2: View Lines */}
      <Modal
        isOpen={isLinesModalOpen}
        onClose={() => setIsLinesModalOpen(false)}
        title={`الخطوط المشتركة في باقة ${selectedPkg?.name} (${selectedPkg?.activeLinesCount || 0} خط)`}
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setIsLinesModalOpen(false)}>
            إغلاق
          </Button>
        }
      >
        <div className="space-y-3 font-sans max-h-96 overflow-y-auto">
          {isLinesLoading ? (
            <p className="text-xs text-slate-500 p-4 text-center">جاري تحميل الخطوط...</p>
          ) : linesList.length === 0 ? (
            <p className="text-xs text-slate-500 p-4 text-center">لا توجد خطوط مسجلة بهذه الباقة حالياً.</p>
          ) : (
            <div className="divide-y divide-ivory-200 dark:divide-navy-800 border border-ivory-300 dark:border-navy-750 rounded-xl overflow-hidden">
              {linesList.map((l: any) => (
                <div key={l?.id || Math.random().toString()} className="p-3 bg-white dark:bg-navy-950 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-navy-900 dark:text-slate-100 text-sm">
                      {l?.phoneNumber || '—'}
                    </span>
                    <Badge variant="neutral">{l?.status || 'IN_STOCK'}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600 dark:text-slate-400 font-bold">
                      {l?.customer?.name || 'متاح بالمخزن'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLinesModalOpen(false);
                        navigate('/lines');
                      }}
                      className="text-amber-600 dark:text-gold-400 hover:underline text-[11px] font-bold flex items-center gap-0.5"
                    >
                      <span>الانتقال للخط</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal 3: Delete */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="تأكيد حذف الباقة"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              isLoading={isSubmitting}
              onClick={handleDelete}
            >
              تأكيد الحذف
            </Button>
          </>
        }
      >
        <div className="space-y-3 font-sans">
          <p className="text-xs text-slate-700 dark:text-slate-300">
            هل أنت متأكد من حذف باقة <strong className="font-bold text-navy-900 dark:text-slate-100">{selectedPkg?.name}</strong>؟
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default PackagesPage;
