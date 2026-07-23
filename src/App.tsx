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
import { Spinner } from '@/components/ui';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthGate />
      </BrowserRouter>
    </AuthProvider>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
