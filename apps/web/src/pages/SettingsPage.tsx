import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PERMISSIONS } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  updatedAt: string;
}

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<SystemSetting | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDesc, setFormDesc] = useState('');

  // 1. Fetch Settings
  const { data: settings, isLoading } = useQuery<SystemSetting[]>({
    queryKey: ['settings'],
    queryFn: () => apiClient('/settings'),
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ key, value, description }: { key: string; value: string; description?: string }) =>
      apiClient(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value, description }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('تم حفظ وتحديث الإعداد بنجاح');
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error('فشل تحديث الإعداد', err.message);
    },
  });

  const handleOpenEdit = (s: SystemSetting) => {
    setSelectedSetting(s);
    setFormKey(s.key);
    setFormValue(s.value);
    setFormDesc(s.description || '');
    setIsEditModalOpen(true);
  };

  const columns: Column<SystemSetting>[] = [
    {
      header: 'مفتاح الإعداد (Key)',
      accessorKey: 'key',
      className: 'font-mono font-bold text-slate-900 dark:text-slate-100',
    },
    {
      header: 'القيمة الحالية (Value)',
      accessorKey: 'value',
      className: 'font-mono text-blue-700 dark:text-blue-400 font-semibold',
    },
    {
      header: 'الوصف والهدف',
      accessorKey: 'description',
      className: 'text-xs text-slate-600 dark:text-slate-300 font-medium',
    },
    {
      header: 'آخر تحديث',
      cell: (s) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          {new Date(s.updatedAt).toLocaleString('ar-EG')}
        </span>
      ),
    },
    {
      header: 'تعديل',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (s) =>
        hasPermission(PERMISSIONS.SETTINGS_MANAGE) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenEdit(s)}
            leftIcon={<Icon3D name="edit" size="xs" />}
          >
            تعديل
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight font-kufi">
            <Icon3D name="settings" size="lg" />
            <span>إعدادات النظام العامة ⚙️</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
            تهيئة المتغيرات التشغيلية والسياسات العامة للنظام وقاعدة البيانات
          </p>
        </div>

        {hasPermission(PERMISSIONS.SETTINGS_MANAGE) && (
          <Button
            variant="gold"
            onClick={() => {
              setSelectedSetting(null);
              setFormKey('');
              setFormValue('');
              setFormDesc('');
              setIsEditModalOpen(true);
            }}
            leftIcon={<Icon3D name="plus" size="xs" />}
          >
            إضافة متغير جديد
          </Button>
        )}
      </div>

      {/* Settings Table */}
      <Table
        columns={columns}
        data={settings || []}
        isLoading={isLoading}
        emptyMessage="لم يتم حفظ إعدادات مخصصة بعد"
      />

      {/* Modal: Edit Setting */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={selectedSetting ? `تعديل متغير: ${selectedSetting.key}` : 'إضافة متغير إعدادات جديد'}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              isLoading={updateMutation.isPending}
              onClick={() => {
                if (!formKey || !formValue) {
                  toast.error('يرجى كتابة المفتاح والقيمة');
                  return;
                }
                updateMutation.mutate({
                  key: formKey,
                  value: formValue,
                  description: formDesc || undefined,
                });
              }}
            >
              حفظ المتغير
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="مفتاح الإعداد (Key) *"
            placeholder="مثال: DEFAULT_CURRENCY"
            value={formKey}
            disabled={!!selectedSetting}
            onChange={(e) => setFormKey(e.target.value)}
            dir="ltr"
          />

          <Input
            label="القيمة (Value) *"
            placeholder="مثال: EGP"
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
          />

          <Textarea
            label="الوصف والتفاصيل"
            placeholder="شرح وظيفة هذا المتغير في النظام..."
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
