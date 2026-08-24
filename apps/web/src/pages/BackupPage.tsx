import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  FileSpreadsheet,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Layers,
  Sparkles,
  Building2,
  Smartphone,
  CheckCircle2,
  Clock,
  KeyRound,
  FileUp,
  XCircle,
  ArrowRight,
  HelpCircle,
  FileText,
  Users,
  CreditCard,
  Calendar,
} from 'lucide-react';
import { PERMISSIONS } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface BackupLogItem {
  id: string;
  filename: string;
  sizeBytes: string;
  status: string;
  triggeredBy?: string;
  createdAt: string;
}

interface BackupStatus {
  lastBackup: BackupLogItem | null;
  backupDir: string;
  totalBackupsCount: number;
  totalDiskBytes: number;
  retentionPolicy: string;
  status: string;
  integrity: string;
}

interface ImportPreviewData {
  isValid: boolean;
  stats: {
    totalRows: number;
    linesCount: number;
    customersCount: number;
    newCustomersCount: number;
    existingCustomersCount: number;
    newLinesCount: number;
    existingLinesCount: number;
    companiesCount: number;
    packagesCount: number;
    openingBalancesCount: number;
    totalOpeningDebtEgp: number;
  };
  relationPreviewSamples: Array<{
    customerCode: string;
    customerName: string;
    fullName?: string;
    nationalId?: string;
    openingBalance: number;
    lines: Array<{
      phoneNumber: string;
      companyCode: string;
      packageName: string;
      monthlyPackage: number;
      renewalDate?: string;
      paymentDay: number;
      notes?: string;
    }>;
  }>;
  errors: Array<{ rowNumber: number; field: string; message: string }>;
  warnings: Array<{ rowNumber: number; field: string; message: string }>;
}

type ImportMode = 'FULL_MASTER' | 'NEW_LINES' | 'SMART_MERGE';

export const BackupPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals & Wizard State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isCompanyExportModalOpen, setIsCompanyExportModalOpen] = useState(false);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('FULL_MASTER');

  // Wizard Sub-states
  const [wizardStep, setWizardStep] = useState<'UPLOAD' | 'PREVIEW' | 'SUCCESS'>('UPLOAD');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [skipInvalidRows, setSkipInvalidRows] = useState(false);

  // Forms
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedExportCompanyId, setSelectedExportCompanyId] = useState('');

  // 1. Fetch System Status
  const { data: status, isLoading: isStatusLoading } = useQuery<BackupStatus>({
    queryKey: ['backup-status'],
    queryFn: () => apiClient('/backups/status'),
    refetchInterval: 25000,
  });

  // 2. Fetch Backup Logs
  const { data: logs, isLoading: isLogsLoading } = useQuery<BackupLogItem[]>({
    queryKey: ['backup-logs'],
    queryFn: () => apiClient('/backups/logs'),
  });

  // 3. Fetch Companies Lookup
  const { data: companies } = useQuery({
    queryKey: ['companies-lookup'],
    queryFn: () => apiClient('/companies'),
  });

  // 4. Fetch Customers count for Empty State Detection
  const { data: customersData } = useQuery({
    queryKey: ['customers-count-check'],
    queryFn: () => apiClient('/customers?limit=1'),
  });
  const isDatabaseEmpty = customersData?.meta?.totalItems === 0;

  // Dual Backup Mutation
  const createBackupMutation = useMutation({
    mutationFn: () => apiClient('/backups/create', { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success('تم إنشاء النسخة الاحتياطية بنجاح (.SQL + .JSON)');
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل إنشاء النسخة الاحتياطية');
    },
  });

  // Restore Mutation
  const restoreMutation = useMutation({
    mutationFn: (pwd: string) =>
      apiClient('/backups/restore', {
        method: 'POST',
        body: JSON.stringify({ adminPassword: pwd }),
      }),
    onSuccess: (data: any) => {
      toast.success(data.message || 'تمت استعادة النسخة الاحتياطية بنجاح');
      setIsRestoreModalOpen(false);
      setAdminPassword('');
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل التحقق من كلمة المرور أو تنفيذ الاستعادة');
    },
  });

  // Preview Mutation
  const previewMutation = useMutation({
    mutationFn: (base64Data: string) =>
      apiClient('/backups/excel-preview', {
        method: 'POST',
        body: JSON.stringify({ base64Data }),
      }),
    onSuccess: (data: ImportPreviewData) => {
      setPreviewData(data);
      setWizardStep('PREVIEW');
      if (data.errors.length > 0) {
        toast.error(`تم اكتشاف ${data.errors.length} أخطاء في ملف Excel تحتاج مراجعة`);
      } else {
        toast.success(`تم التحقق من ملف Excel: ${data.stats.customersCount} عميل و ${data.stats.linesCount} خط`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل التحقق من ملف Excel');
    },
  });

  // Commit Import Mutation
  const commitImportMutation = useMutation({
    mutationFn: ({ endpoint, base64Data, skipInvalidRows }: { endpoint: string; base64Data: string; skipInvalidRows?: boolean }) =>
      apiClient(endpoint, {
        method: 'POST',
        body: JSON.stringify({ base64Data, skipInvalidRows }),
      }),
    onSuccess: (data: any) => {
      setExecutionResult(data);
      setWizardStep('SUCCESS');
      // Invalidate all query caches across the entire application
      queryClient.invalidateQueries();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-count-check'] });
      queryClient.invalidateQueries({ queryKey: ['customers-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['companies-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['debt-report'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
      toast.success(data.message || 'تم الاستيراد والربط المحاسبي بنجاح');
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل تنفيذ الاستيراد');
    },
  });

  // File Handlers
  const handleFileSelection = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('يرجى اختيار ملف بصيغة Excel (.xlsx)');
      return;
    }
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setFileBase64(base64);
      previewMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const openImportWizard = (mode: ImportMode) => {
    setImportMode(mode);
    setWizardStep('UPLOAD');
    setSelectedFile(null);
    setFileBase64(null);
    setPreviewData(null);
    setExecutionResult(null);
    setSkipInvalidRows(false);
    setIsImportWizardOpen(true);
  };

  const handleCommitImport = () => {
    if (!fileBase64) return;
    let endpoint = '/backups/excel-import-full';
    if (importMode === 'NEW_LINES') endpoint = '/backups/excel-import-lines';
    if (importMode === 'SMART_MERGE') endpoint = '/backups/excel-smart-merge';

    commitImportMutation.mutate({ endpoint, base64Data: fileBase64, skipInvalidRows });
  };

  // Direct Master Excel Download Handlers
  const handleDownloadFullExport = async () => {
    try {
      toast.info('جاري تصدير الحساب بالكامل وفق الـ Master Template الرسمي...');
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/backups/excel-export-full', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('فشل التصدير');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `النسخه_الاحتياطيه_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('تم تصدير مصنف Excel بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء تحميل ملف Excel');
    }
  };

  const handleDownloadCompanyExport = async () => {
    if (!selectedExportCompanyId) {
      toast.error('يرجى اختيار الشركة أولاً');
      return;
    }
    try {
      toast.info('جاري تصدير بيانات كشف الشركة...');
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/backups/excel-export-company/${selectedExportCompanyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('فشل التصدير');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تصدير_شركة_${selectedExportCompanyId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setIsCompanyExportModalOpen(false);
      setSelectedExportCompanyId('');
      toast.success('تم تصدير كشف الشركة بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء تحميل كشف الشركة');
    }
  };

  const formatBytes = (bytes: number | string) => {
    const n = Number(bytes) || 0;
    if (n === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(n) / Math.log(k));
    return parseFloat((n / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const columns: Column<BackupLogItem>[] = [
    {
      header: 'اسم الملف والتوقيت',
      cell: (l) => (
        <div>
          <span className="font-mono font-bold text-navy-900 dark:text-slate-100 block text-xs truncate max-w-sm">
            {l.filename}
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {new Date(l.createdAt).toLocaleString('ar-EG')}
          </span>
        </div>
      ),
    },
    {
      header: 'الحجم',
      cell: (l) => (
        <span className="font-mono text-xs font-bold text-navy-900 dark:text-slate-200">
          {formatBytes(l.sizeBytes)}
        </span>
      ),
    },
    {
      header: 'نوع الإجراء',
      cell: (l) => (
        <Badge variant={l.triggeredBy === 'SYSTEM_DAILY_AUTO' ? 'info' : 'success'}>
          {l.triggeredBy === 'SYSTEM_DAILY_AUTO' ? 'نسخ يومي تلقائي' : 'نسخ يدوي'}
        </Badge>
      ),
    },
    {
      header: 'الحالة',
      cell: (l) => (
        <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{l.status}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Hidden Global File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
          }
        }}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-kufi font-extrabold text-navy-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Icon3D name="backup" size="lg" />
            <span>النسخ الاحتياطي وإدارة البيانات الماستر 💾</span>
          </h1>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
            استيراد وتصدير وتطابق كامل مع تجربة Android وملف Excel الرسمي (تصدير_الكبير + أرصدة_افتتاحية_الكبير)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleDownloadFullExport}
            leftIcon={<Icon3D name="download" size="xs" />}
          >
            تصدير الحساب بالكامل (Excel)
          </Button>

          {hasPermission(PERMISSIONS.BACKUP_MANAGE) && (
            <Button
              variant="gold"
              isLoading={createBackupMutation.isPending}
              onClick={() => createBackupMutation.mutate()}
              leftIcon={<Icon3D name="backup" size="xs" />}
            >
              نسخة احتياطية الآن
            </Button>
          )}
        </div>
      </div>

      {/* CONDITIONAL ONBOARDING HERO: Shown when Database is completely empty */}
      {isDatabaseEmpty && (
        <div className="bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 border-2 border-gold-500/40 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden text-center space-y-6">
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-500/20 text-gold-400 border border-gold-500/30 text-xs font-bold font-kufi">
              <Sparkles className="w-4 h-4" />
              <span>مرحبًا بك في الكبير VIP — أول إعداد لقاعدة البيانات</span>
            </span>
            <h2 className="text-3xl font-kufi font-black tracking-tight text-white">
              قاعدة البيانات جاهزة لاستيراد الحساب كاملاً
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              قم بسحب وإفلات ملف Excel الرسمي (<span className="text-gold-400 font-bold">النسخه الاحتياطيه.xlsx</span>) لإنشاء وتسكين كافة العملاء والخطوط والشركات والباقات والأرصدة الافتتاحية وربط العلاقات آلياً.
            </p>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => openImportWizard('FULL_MASTER')}
            className={`max-w-xl mx-auto p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-gold-400 bg-gold-500/10 scale-[1.02]'
                : 'border-slate-700 bg-navy-800/60 hover:border-gold-500/60 hover:bg-navy-800'
            }`}
          >
            <div className="p-4 rounded-2xl bg-gold-500 text-navy-950 shadow-gold-md animate-bounce">
              <FileUp className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-bold text-white">
                {isDragging ? 'أفلت ملف Excel الآن لبدء الفحص' : 'اسحب ملف Excel هنا أو اضغط للاختيار'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                يدعم الشيت الماستر (تصدير_الكبير + أرصدة_افتتاحية_الكبير)
              </p>
            </div>
            <Button
              variant="gold"
              size="lg"
              className="mt-2 font-kufi font-bold shadow-gold-lg"
              onClick={(e) => {
                e.stopPropagation();
                openImportWizard('FULL_MASTER');
              }}
            >
              📥 استيراد بيانات الحساب كاملة
            </Button>
          </div>
        </div>
      )}

      {/* SYSTEM STATUS CARD */}
      <div className="bg-ivory-50 dark:bg-navy-850 p-6 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-kufi font-black text-navy-900 dark:text-slate-100 text-lg">
                حالة نظام البيانات والنسخ الاحتياطي
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold border border-emerald-500/20">
                🟢 آمن ومتزامن
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-bold">
              آخر نسخة تم إنشاؤها:{' '}
              <span className="font-mono text-navy-900 dark:text-slate-200">
                {status?.lastBackup ? new Date(status.lastBackup.createdAt).toLocaleString('ar-EG') : 'لا يوجد بعد'}
              </span>
              {' • '}
              حجم التخزين:{' '}
              <span className="font-mono text-navy-900 dark:text-slate-200">
                {formatBytes(status?.totalDiskBytes || 0)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="gold"
            isLoading={createBackupMutation.isPending}
            onClick={() => createBackupMutation.mutate()}
            leftIcon={<HardDrive className="w-4 h-4" />}
          >
            إنشاء نسخة احتياطية الآن
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsRestoreModalOpen(true)}
            leftIcon={<RotateCcw className="w-4 h-4 text-rose-500" />}
            className="border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            استعادة من Backup
          </Button>
        </div>
      </div>

      {/* CORE OPERATIONAL ACTIONS (6 Clean Master Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* CARD 1: Full Account Import */}
        <div className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between space-y-4 hover:border-gold-400/60 transition-all group">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gold-100 dark:bg-navy-800 text-gold-700 dark:text-gold-400 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                استيراد الحساب كاملاً
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              إنشاء وربط كافة العملاء والخطوط والباقات والشركات والأرصدة الافتتاحية من ملف Excel الماستر.
            </p>
          </div>
          <Button
            variant="gold"
            size="sm"
            onClick={() => openImportWizard('FULL_MASTER')}
            leftIcon={<Upload className="w-4 h-4" />}
            className="w-full font-bold"
          >
            استيراد بيانات الحساب
          </Button>
        </div>

        {/* CARD 2: Import New Lines */}
        <div className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between space-y-4 hover:border-blue-400/60 transition-all group">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                استيراد خطوط جديدة
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              إضافة خطوط جديدة للمخزن أو ربطها بالعملاء الحاليين والجدد من نفس ملف Excel الماستر.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openImportWizard('NEW_LINES')}
            leftIcon={<Smartphone className="w-4 h-4 text-blue-600" />}
            className="w-full font-bold"
          >
            استيراد خطوط جديدة
          </Button>
        </div>

        {/* CARD 3: Smart Merge */}
        <div className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between space-y-4 hover:border-emerald-400/60 transition-all group">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                استيراد ودمج ذكي
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              تحديث البيانات ومطابقة السجلات بدون أي تكرار مع الحفاظ على العمليات المحاسبية ودفتر الأستاذ.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openImportWizard('SMART_MERGE')}
            leftIcon={<Sparkles className="w-4 h-4 text-gold-600" />}
            className="w-full font-bold"
          >
            استيراد ودمج ذكي
          </Button>
        </div>

        {/* CARD 4: Export Full Account & Company */}
        <div className="bg-ivory-50 dark:bg-navy-850 p-5 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col justify-between space-y-4 hover:border-purple-400/60 transition-all group">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm">
                تصدير Excel الماستر
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              تصدير مصنف Excel كامل (تصدير_الكبير + أرصدة_افتتاحية_الكبير) أو تصدير كشف شركة محددة.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadFullExport}
              className="flex-1 font-bold text-xs"
            >
              تصدير الحساب
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCompanyExportModalOpen(true)}
              className="flex-1 font-bold text-xs"
            >
              تصدير شركة
            </Button>
          </div>
        </div>
      </div>

      {/* BACKUP HISTORY TABLE */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-base">
            سجل النسخ الاحتياطية السابقة
          </h3>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
            عرض آخر {logs?.length || 0} عمليات
          </span>
        </div>

        <Table
          columns={columns}
          data={logs || []}
          isLoading={isLogsLoading}
          emptyMessage="لا توجد سجلات نسخ احتياطي سابقة"
        />
      </div>

      {/* MODAL 1: INTERACTIVE IMPORT WIZARD (Drag & Drop -> Preview -> Relational Check -> Commit) */}
      <Modal
        isOpen={isImportWizardOpen}
        onClose={() => {
          setIsImportWizardOpen(false);
          setWizardStep('UPLOAD');
          setSelectedFile(null);
          setFileBase64(null);
          setPreviewData(null);
        }}
        title={
          importMode === 'FULL_MASTER'
            ? '📥 استيراد بيانات الحساب كاملة (Excel Master Template)'
            : importMode === 'NEW_LINES'
            ? '📱 استيراد خطوط جديدة للمخزن والعملاء'
            : '🔄 استيراد ودمج ذكي وتحديث السجلات'
        }
        size="xl"
        footer={
          wizardStep === 'PREVIEW' ? (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                onClick={() => setWizardStep('UPLOAD')}
                leftIcon={<ArrowRight className="w-4 h-4" />}
              >
                اختيار ملف آخر
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsImportWizardOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  variant="gold"
                  isLoading={commitImportMutation.isPending}
                  disabled={!previewData?.isValid && !skipInvalidRows}
                  onClick={handleCommitImport}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  بدء الاستيراد الفعلي والربط المحاسبي
                </Button>
              </div>
            </div>
          ) : wizardStep === 'SUCCESS' ? (
            <Button
              variant="gold"
              onClick={() => {
                setIsImportWizardOpen(false);
                setWizardStep('UPLOAD');
                queryClient.invalidateQueries();
              }}
            >
              إغلاق والعودة للنظام
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-6 font-sans">
          {/* STEP 1: UPLOAD / DRAG & DROP */}
          {wizardStep === 'UPLOAD' && (
            <div className="space-y-5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-10 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 text-center ${
                  isDragging
                    ? 'border-gold-500 bg-gold-500/10 scale-[1.02]'
                    : 'border-ivory-300 dark:border-navy-700 bg-ivory-100/50 dark:bg-navy-900/60 hover:border-gold-500/60'
                }`}
              >
                <div className="p-4 rounded-2xl bg-navy-900 text-gold-400 shadow-gold-sm">
                  <FileUp className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-base font-extrabold text-navy-900 dark:text-slate-100">
                    {isDragging ? 'أفلت ملف Excel الآن' : 'اسحب ملف Excel هنا أو اضغط للاختيار من جهازك'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                    يجب أن يحتوي الملف على شيت: <span className="font-bold text-gold-600 dark:text-gold-400">تصدير_الكبير</span> وشيت: <span className="font-bold text-gold-600 dark:text-gold-400">أرصدة_افتتاحية_الكبير</span>
                  </p>
                </div>
                <Button
                  variant="gold"
                  size="md"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  isLoading={previewMutation.isPending}
                >
                  اختيار ملف Excel (.xlsx)
                </Button>
              </div>

              {/* Guidelines Alert */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-950 dark:text-blue-200 text-xs space-y-2">
                <span className="font-bold flex items-center gap-1.5 text-sm">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  <span>قواعد المعالجة المعمارية لملف Excel الماستر:</span>
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                  <li><strong>كود العميل:</strong> هو المفتاح الأساسي. العميل الذي يمتلك عدة خطوط لن يتم تكراره وسيرتبط بكافة أرقامه آلياً.</li>
                  <li><strong>تاريخ التجديد:</strong> يؤخذ مباشرة من عمود (تاريخ التجديد) بالملف ولا يتم استنتاجه من اسم الشركة.</li>
                  <li><strong>الأرصدة الافتتاحية:</strong> تُسجل كأرصدة افتتاحية حقيقية بالجنيه دون إنشاء فواتير أو سندات وهمية.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: SMART PREVIEW & RELATIONAL SAMPLES */}
          {wizardStep === 'PREVIEW' && previewData && (
            <div className="space-y-6">
              {/* Stat Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">العملاء المكتشفين</span>
                  <p className="text-base font-kufi font-black text-navy-900 dark:text-slate-100">
                    {previewData.stats.customersCount}{' '}
                    <span className="text-xs font-normal text-emerald-600">({previewData.stats.newCustomersCount} جديد)</span>
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">إجمالي الخطوط</span>
                  <p className="text-base font-kufi font-black text-navy-900 dark:text-slate-100">
                    {previewData.stats.linesCount}{' '}
                    <span className="text-xs font-normal text-blue-600">({previewData.stats.newLinesCount} جديد)</span>
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">الشركات والباقات</span>
                  <p className="text-base font-kufi font-black text-navy-900 dark:text-slate-100">
                    {previewData.stats.companiesCount} شركات • {previewData.stats.packagesCount} باقات
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">الأرصدة الافتتاحية</span>
                  <p className="text-base font-kufi font-black text-gold-600 dark:text-gold-400 font-mono">
                    {previewData.stats.totalOpeningDebtEgp.toLocaleString()} ج.م
                  </p>
                </div>
              </div>

              {/* Structured Error Grid Table & Skip Toggle */}
              {previewData.errors.length > 0 && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-rose-900 dark:text-rose-200 font-bold text-sm">
                    <span className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span>جدول الأخطاء المكتشفة ({previewData.errors.length} خطأ)</span>
                    </span>
                    <span className="text-xs text-rose-700 dark:text-rose-300 font-mono">
                      {previewData.stats.linesCount - previewData.errors.length} صف صالح
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-lg border border-rose-200 dark:border-rose-900">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-rose-100/70 dark:bg-rose-900/60 text-rose-950 dark:text-rose-200 font-bold sticky top-0">
                        <tr>
                          <th className="p-2 w-20">رقم الصف</th>
                          <th className="p-2 w-28">اسم الحقل</th>
                          <th className="p-2">سبب المشكلة والتشخيص</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-200 dark:divide-rose-900/40 bg-white/70 dark:bg-navy-900/70 text-slate-800 dark:text-slate-200 font-medium">
                        {previewData.errors.map((err, i) => (
                          <tr key={i} className="hover:bg-rose-50/60 dark:hover:bg-rose-950/30">
                            <td className="p-2 font-mono font-bold text-rose-700 dark:text-rose-400">
                              الصف {err.rowNumber}
                            </td>
                            <td className="p-2 font-bold">{err.field}</td>
                            <td className="p-2 text-rose-800 dark:text-rose-300">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Skip Invalid Rows Mode Toggle */}
                  <label className="flex items-center gap-2.5 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl cursor-pointer transition-colors hover:bg-amber-100/60">
                    <input
                      type="checkbox"
                      checked={skipInvalidRows}
                      onChange={(e) => setSkipInvalidRows(e.target.checked)}
                      className="w-4 h-4 rounded text-gold-600 focus:ring-gold-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                      استيراد الصفوف الصالحة فقط وتخطي الصفوف التالفة ({previewData.stats.linesCount - previewData.errors.length} خط متاح للاستيراد)
                    </span>
                  </label>
                </div>
              )}

              {/* Relational Samples Preview (Showing multi-line customers) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-kufi font-extrabold text-navy-900 dark:text-slate-100 text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-gold-600" />
                    <span>معاينة فهم العلاقات وتعدد الخطوط (Sample Relationships)</span>
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500">
                    يتم ربط كل خط بالعميل والشركة وتاريخ التجديد بشكل مستقل
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {previewData.relationPreviewSamples.map((sample) => (
                    <div
                      key={sample.customerCode}
                      className="p-3.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-ivory-200 dark:border-navy-800 pb-2">
                        <div>
                          <span className="font-kufi font-black text-navy-900 dark:text-slate-100 text-sm block">
                            {sample.customerName}
                          </span>
                          <span className="font-mono text-xs font-bold text-gold-600 dark:text-gold-400">
                            {sample.customerCode}
                          </span>
                        </div>

                        {sample.openingBalance > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-gold-500/10 text-gold-700 dark:text-gold-400 border border-gold-500/20 text-xs font-mono font-bold">
                            افتتاحي: {sample.openingBalance.toLocaleString()} ج.م
                          </span>
                        )}
                      </div>

                      {/* Lines List */}
                      <div className="space-y-1.5">
                        {sample.lines.map((ln, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-ivory-50 dark:bg-navy-900 border border-ivory-200 dark:border-navy-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-navy-900 dark:bg-navy-800 text-slate-100 font-mono font-bold text-[11px]">
                                {ln.companyCode}
                              </span>
                              <span className="font-mono font-bold text-navy-900 dark:text-slate-100">
                                {ln.phoneNumber}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 font-bold text-[11px] text-slate-600 dark:text-slate-300">
                              <span>{ln.packageName} ({ln.monthlyPackage} ج.م)</span>
                              {ln.renewalDate && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  تجديد {ln.renewalDate}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS RESULT SCREEN */}
          {wizardStep === 'SUCCESS' && executionResult && (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-lg animate-pulse">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-kufi font-black text-navy-900 dark:text-slate-100">
                  تم الاستيراد والربط بنجاح تام ✓
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">
                  تم حفظ كافة العلاقات المحاسبية والبيانات داخل معاملة آمنة (Atomic Transaction)
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-right">
                <div className="p-3 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 block">عملاء تم إنشاؤهم</span>
                  <p className="text-base font-kufi font-black text-emerald-600">
                    {executionResult.customersCreated}
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 block">خطوط تم إيداعها</span>
                  <p className="text-base font-kufi font-black text-blue-600">
                    {executionResult.linesCreated}
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 block">شركات وباقات</span>
                  <p className="text-base font-kufi font-black text-navy-900 dark:text-slate-100">
                    {executionResult.companiesCreated} / {executionResult.packagesCreated}
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 block">أرصدة افتتاحية</span>
                  <p className="text-base font-kufi font-black text-gold-600 font-mono">
                    {executionResult.totalOpeningDebtEgp?.toLocaleString()} ج.م
                  </p>
                </div>
              </div>

              {executionResult.recordsSkipped > 0 && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs font-bold max-w-lg mx-auto">
                  تنبيه: تم تخطي {executionResult.recordsSkipped} صف تالف بنجاح أثناء الاستيراد دون التأثير على السجلات الصالحة.
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 2: ADMIN PASSWORD CONFIRMATION FOR RESTORE */}
      <Modal
        isOpen={isRestoreModalOpen}
        onClose={() => {
          setIsRestoreModalOpen(false);
          setAdminPassword('');
        }}
        title="تأكيد أمني لاستعادة قاعدة البيانات"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsRestoreModalOpen(false);
                setAdminPassword('');
              }}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              isLoading={restoreMutation.isPending}
              onClick={() => {
                if (!adminPassword) {
                  toast.error('يرجى كتابة كلمة مرور المشرف');
                  return;
                }
                restoreMutation.mutate(adminPassword);
              }}
            >
              تأكيد الاستعادة الفورية
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div>
              <span className="font-extrabold block text-sm">تنبيه أمني هام جداً!</span>
              <span>
                عملية استعادة قاعدة البيانات ستؤثر على البيانات الحالية. يتطلب هذا الإجراء تأكيداً صريحاً بكلمة مرور المشرف.
              </span>
            </div>
          </div>

          <Input
            label="كلمة مرور المشرف (Admin Password) *"
            type="password"
            placeholder="••••••••"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            leftIcon={<KeyRound className="w-4 h-4" />}
            autoFocus
          />
        </div>
      </Modal>

      {/* MODAL 3: SINGLE COMPANY EXPORT SELECTOR */}
      <Modal
        isOpen={isCompanyExportModalOpen}
        onClose={() => {
          setIsCompanyExportModalOpen(false);
          setSelectedExportCompanyId('');
        }}
        title="تصدير كشف شركة اتصالات (Excel)"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsCompanyExportModalOpen(false);
                setSelectedExportCompanyId('');
              }}
            >
              إلغاء
            </Button>
            <Button
              variant="gold"
              onClick={handleDownloadCompanyExport}
              leftIcon={<Download className="w-4 h-4" />}
            >
              تحميل كشف الشركة (Excel)
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            سيتم استخراج ملف Excel مخصص يحتوي على شيت (تصدير_الكبير) بالـ 11 عموداً مفلتراً لكافة الخطوط التابعة لهذه الشركة فقط.
          </p>

          <Select
            label="اختر شركة الاتصالات *"
            value={selectedExportCompanyId}
            onChange={(e) => setSelectedExportCompanyId(e.target.value)}
          >
            <option value="">اختر الشركة...</option>
            {companies?.map((c: any) => (
              <option key={c.id} value={c.code || c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
};

export default BackupPage;
