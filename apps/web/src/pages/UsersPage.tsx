import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { useToast } from '../components/ui/Toast';
import { Table, Column } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PERMISSIONS, ROLES } from '@alkabeer/shared';
import { Icon3D } from '../components/icons3d';

interface UserItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  status: string;
  createdAt: string;
  userRoles?: Array<{ role: { name: string } }>;
}

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);

  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<string>(ROLES.SALES);

  // 1. Fetch Users
  const { data, isLoading } = useQuery<{ items: UserItem[]; meta: any }>({
    queryKey: ['users'],
    queryFn: () => apiClient('/users?limit=50'),
  });

  // 2. Fetch Roles & Permissions
  const { data: rolesData } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => apiClient('/rbac/roles'),
    enabled: isRolesModalOpen,
  });

  // Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('تم إنشاء حساب المستخدم وتعيين الصلاحيات بنجاح');
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('فشل إنشاء المستخدم', err.message);
    },
  });

  const resetForm = () => {
    setFormUsername('');
    setFormEmail('');
    setFormFullName('');
    setFormPassword('');
    setFormRole(ROLES.SALES);
  };

  const columns: Column<UserItem>[] = [
    {
      header: 'اسم المستخدم',
      accessorKey: 'username',
      className: 'font-mono font-bold text-slate-900 dark:text-slate-100',
    },
    {
      header: 'الاسم الكامل',
      accessorKey: 'fullName',
      className: 'font-semibold text-slate-900 dark:text-slate-100',
    },
    {
      header: 'البريد الإلكتروني',
      accessorKey: 'email',
      className: 'font-mono text-slate-600 dark:text-slate-400',
    },
    {
      header: 'الدور الوظيفي',
      cell: (u) => (
        <div className="flex gap-1">
          {u.userRoles?.map((ur, idx) => (
            <Badge key={idx} variant={ur.role.name === 'ADMIN' ? 'danger' : 'info'}>
              {ur.role.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      header: 'الحالة',
      cell: (u) => (
        <Badge variant={u.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {u.status}
        </Badge>
      ),
    },
    {
      header: 'تاريخ الإنشاء',
      cell: (u) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          {new Date(u.createdAt).toLocaleDateString('ar-EG')}
        </span>
      ),
    },
    {
      header: 'الإجراءات',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (u) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toast.success(`صلاحيات المستخدم: ${u.username} (${u.userRoles?.map(r=>r.role.name).join(', ')})`)}
            title="عرض الصلاحيات والمعلومات"
            aria-label="عرض الصلاحيات والمعلومات"
            className="p-1.5 rounded-lg hover:bg-ivory-200 dark:hover:bg-navy-800 transition-colors group/btn"
          >
            <Icon3D name="eye" size="xs" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight font-kufi">
            <Icon3D name="users" size="lg" />
            <span>إدارة المستخدمين وصلاحيات النظام 👥</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
            إضافة الموظفين، تعيين الأدوار والصلاحيات، وتأمين كلمات المرور عبر Argon2id
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsRolesModalOpen(true)}
            leftIcon={<Icon3D name="audit" size="xs" />}
          >
            مصفوفة الأدوار والصلاحيات
          </Button>

          {hasPermission(PERMISSIONS.USERS_MANAGE) && (
            <Button
              variant="gold"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Icon3D name="plus" size="xs" />}
            >
              مستخدم جديد
            </Button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <Table
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyMessage="لم يتم العثور على مستخدمين"
      />

      {/* 1. Modal: Create User */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="إنشاء حساب مستخدم جديد"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              isLoading={createUserMutation.isPending}
              onClick={() => {
                if (!formUsername || !formEmail || !formFullName || !formPassword) {
                  toast.error('يرجى ملء جميع الحقول المطلوبة');
                  return;
                }
                createUserMutation.mutate({
                  username: formUsername,
                  email: formEmail,
                  fullName: formFullName,
                  password: formPassword,
                  roles: [formRole],
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
            label="اسم المستخدم (Username) *"
            placeholder="مثال: ahmed_sales"
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
            dir="ltr"
          />
          <Input
            label="البريد الإلكتروني *"
            type="email"
            placeholder="ahmed@alkabeer.local"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            dir="ltr"
          />
          <Input
            label="الاسم الكامل *"
            placeholder="مثال: أحمد حسن"
            value={formFullName}
            onChange={(e) => setFormFullName(e.target.value)}
          />
          <Input
            label="كلمة المرور (تشفير Argon2id) *"
            type="password"
            placeholder="••••••••"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            dir="ltr"
          />
          <Select
            label="الدور الوظيفي والصلاحيات *"
            value={formRole}
            onChange={(e) => setFormRole(e.target.value)}
          >
            <option value={ROLES.SALES}>مسؤول مبيعات (SALES)</option>
            <option value={ROLES.ACCOUNTANT}>محاسب مالي (ACCOUNTANT)</option>
            <option value={ROLES.MANAGER}>مدير تشغيل (MANAGER)</option>
            <option value={ROLES.ADMIN}>مدير نظام كامل (ADMIN)</option>
            <option value={ROLES.VIEWER}>مشاهد فقط (VIEWER)</option>
          </Select>
        </div>
      </Modal>

      {/* 2. Modal: Roles & Permissions Matrix */}
      <Modal
        isOpen={isRolesModalOpen}
        onClose={() => setIsRolesModalOpen(false)}
        size="xl"
        title="مصفوفة الأدوار والصلاحيات (Server-Enforced RBAC)"
      >
        <div className="space-y-4">
          {rolesData?.map((role: any) => (
            <div key={role.id} className="p-4 bg-ivory-100 dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-navy-900 dark:text-slate-100 text-sm">{role.name}</span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{role.description}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-ivory-300 dark:border-navy-750">
                {role.rolePermissions?.map((rp: any) => (
                  <span
                    key={rp.permission.id}
                    className="px-2 py-0.5 rounded bg-ivory-200 dark:bg-navy-800 border border-ivory-300 dark:border-navy-700 font-mono text-[10px] text-navy-900 dark:text-slate-200 font-bold"
                  >
                    {rp.permission.key}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
