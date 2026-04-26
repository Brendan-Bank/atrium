import { Routes, Route, Navigate } from 'react-router-dom';

import { AppLayout } from './components/AppLayout';
import { MaintenancePage } from './components/MaintenancePage';
import { RequireAuth } from './components/RequireAuth';
import { useAppConfig } from './hooks/useAppConfig';
import { useMe } from './hooks/useAuth';
import { AcceptInvitePage } from './routes/AcceptInvitePage';
import { AdminPage } from './routes/AdminPage';
import { ForgotPasswordPage } from './routes/ForgotPasswordPage';
import { HomePage } from './routes/HomePage';
import { LoginPage } from './routes/LoginPage';
import { NotificationsPage } from './routes/NotificationsPage';
import { ProfilePage } from './routes/ProfilePage';
import { ResetPasswordPage } from './routes/ResetPasswordPage';
import { TwoFactorPage } from './routes/TwoFactorPage';

export default function App() {
  const { data: appConfig } = useAppConfig();
  const { data: me } = useMe();
  // Maintenance gate is enforced server-side by MaintenanceMiddleware;
  // this is the UI half so non-super_admins see a friendly page rather
  // than a forest of 503 toasts. Login + reset-password are still
  // reachable so a super_admin can sign in to flip the flag back —
  // those routes appear *before* this guard.
  const maintenanceOn = appConfig?.system?.maintenance_mode === true;
  const isSuperAdmin = me?.roles.includes('super_admin') ?? false;
  if (maintenanceOn && !isSuperAdmin) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/2fa" element={<TwoFactorPage />} />
        <Route path="*" element={<MaintenancePage />} />
      </Routes>
    );
  }
  return (
    <Routes>
      {/* Public auth routes (no layout) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      {/* 2FA gate — needs a partial session, so it lives outside
          RequireAuth (which only understands full sessions). */}
      <Route path="/2fa" element={<TwoFactorPage />} />

      {/* Authenticated routes (inside app shell) */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
