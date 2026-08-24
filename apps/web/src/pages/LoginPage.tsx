import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { Lock, User as UserIcon, AlertCircle, Crown, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول. يرجى التأكد من صحة بيانات الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ivory-100 dark:bg-navy-950 flex items-center justify-center p-4 selection:bg-gold-500/30 selection:text-white transition-colors font-sans" dir="rtl">
      <div className="max-w-md w-full bg-ivory-50 dark:bg-navy-850 rounded-2xl shadow-warm-sm p-8 sm:p-9 border border-ivory-300 dark:border-navy-750 transition-colors">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-navy-900 border border-gold-500/40 text-gold-400 mb-4 shadow-gold-sm">
            <Crown className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-kufi font-extrabold text-navy-900 dark:text-slate-100 tracking-tight">منظومة الكبير VIP</h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">بوابة إدارة العمليات المالية والخطوط المميزة</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-xl text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-extrabold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4.5">
          <div>
            <label className="block text-xs font-bold text-navy-900 dark:text-slate-200 mb-1.5">
              اسم المستخدم أو البريد الإلكتروني
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="009"
                className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-sm text-navy-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 focus:bg-white dark:focus:bg-navy-950 transition-all text-left font-medium"
                dir="ltr"
              />
              <UserIcon className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute right-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-navy-900 dark:text-slate-200 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-sm text-navy-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 focus:bg-white dark:focus:bg-navy-950 transition-all text-left font-medium"
                dir="ltr"
              />
              <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute right-3.5 top-3" />
            </div>
          </div>

          <Button
            type="submit"
            variant="gold"
            isLoading={loading}
            className="w-full py-3 text-sm font-bold mt-2"
          >
            تسجيل الدخول إلى النظام
          </Button>
        </form>

        <div className="mt-7 text-center border-t border-ivory-300 dark:border-navy-800 pt-4 flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-gold-600 dark:text-gold-400" />
          <p className="text-xs font-bold">
            جلسة مشفرة ومحمية بالكامل • HttpOnly Cookie
          </p>
        </div>
      </div>
    </div>
  );
};
