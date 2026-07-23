/**
 * Application root: providers, routing, and the auth gate.
 *
 * The whole app is auth-gated (CJIS-friendly: no data without a signed-in
 * user). While the initial auth check runs we show a spinner; unauthenticated
 * users get the login screen; authenticated users get the routed app inside the
 * shared layout. The public "What's New" changelog is reachable either way.
 */

import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import CaseView from '@/pages/CaseView';
import CalculationsView from '@/pages/CalculationsView';
import WhatsNew from '@/pages/WhatsNew';
import { Spinner } from '@/components/ui';
import { APP_VERSION } from '@/version';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthGate />
        <VersionBadge />
      </BrowserRouter>
    </AuthProvider>
  );
}

/** Small fixed version label (links to the changelog) to confirm deploys. */
function VersionBadge() {
  return (
    <Link
      to="/whats-new"
      className="fixed bottom-2 right-3 z-50 select-none text-[11px] text-slate-500 hover:text-brand-300"
      title="What's new"
    >
      v{APP_VERSION}
    </Link>
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

  // Unauthenticated: only the login screen and the public changelog are shown.
  if (!user) {
    return (
      <Routes>
        <Route path="/whats-new" element={<PublicWhatsNew />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="cases/:id" element={<CaseView />} />
        <Route path="cases/:id/calculations" element={<CalculationsView />} />
        <Route path="whats-new" element={<WhatsNew />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

/** What's New wrapped in a minimal page frame when the user isn't signed in. */
function PublicWhatsNew() {
  return (
    <div className="min-h-full bg-surface px-4 py-8 text-slate-100">
      <WhatsNew />
    </div>
  );
}
