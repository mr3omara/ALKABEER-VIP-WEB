import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../pages/LoginPage';
import { DashboardOverview } from '../pages/DashboardOverview';
import { CustomersPage } from '../pages/CustomersPage';
import { LinesPage } from '../pages/LinesPage';
import { InventoryPage } from '../pages/InventoryPage';
import { SalesPage } from '../pages/SalesPage';
import { PaymentsPage } from '../pages/PaymentsPage';
import { MonthlyChargesPage } from '../pages/MonthlyChargesPage';
import { TreasuryPage } from '../pages/TreasuryPage';
import { ExpensesPage } from '../pages/ExpensesPage';
import { DailyClosingPage } from '../pages/DailyClosingPage';
import { ReportsPage } from '../pages/ReportsPage';
import { UsersPage } from '../pages/UsersPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AuditPage } from '../pages/AuditPage';
import { CompaniesPage } from '../pages/CompaniesPage';
import { BackupPage } from '../pages/BackupPage';
import { CompanyLiabilitiesPage } from '../pages/CompanyLiabilitiesPage';
import { PackagesPage } from '../pages/PackagesPage';
import { LedgerPage } from '../pages/LedgerPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <span className="text-xs text-slate-400">جاري التحقق من الجلسة الآمنة...</span>
        </div>
      </div>
    );
  }

  const isDev = (import.meta as any).env.DEV;
  if (!user && !isDev) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  const isDev = (import.meta as any).env.DEV;
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isDev ? <Navigate to="/" replace /> : <LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardOverview />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="lines" element={<LinesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="monthly-charges" element={<MonthlyChargesPage />} />
          <Route path="treasury" element={<TreasuryPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="daily-closing" element={<DailyClosingPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="company-liabilities" element={<CompanyLiabilitiesPage />} />
          <Route path="packages" element={<PackagesPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
