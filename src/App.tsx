/**
 * Application root: providers, routing, and the auth gate.
 *
 * The whole app is auth-gated (CJIS-friendly: no data without a signed-in
 * user). While the initial auth check runs we show a spinner; unauthenticated
 * users get the login screen; authenticated users get the routed app inside the
 * shared layout.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import CaseView from '@/pages/CaseView';
import CalculationsView from '@/pages/CalculationsView';
import { Spinner } from '@/components/ui';
import { APP_VERSION } from '@/version';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthGate />
      </BrowserRouter>
      <VersionBadge />
    </AuthProvider>
  );
}

/** Small fixed version label, visible on every screen to confirm deploys. */
function VersionBadge() {
  return (
    <div className="pointer-events-none fixed bottom-2 right-3 z-50 select-none text-[11px] text-slate-500">
      v{APP_VERSION}
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="cases/:id" element={<CaseView />} />
        <Route path="cases/:id/calculations" element={<CalculationsView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
