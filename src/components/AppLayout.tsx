/**
 * Authenticated app shell: a sticky header with branding and the sign-out
 * control, plus an <Outlet/> for the routed page. Rendered only for signed-in
 * users (see the router's ProtectedRoute).
 */

import { Link, Outlet } from 'react-router-dom';
import { signOut } from '@/lib/firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';

export default function AppLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-full bg-surface text-slate-100">
      <header className="sticky top-0 z-10 border-b border-surface-border bg-surface-raised/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-sm font-bold">
              BPA
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">BPA Assistant</div>
              <div className="hidden text-xs text-slate-400 sm:block">
                Bloodstain Pattern Analysis
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/whats-new" className="hidden text-xs text-slate-400 hover:text-brand-300 sm:inline">
              What's new
            </Link>
            <span className="hidden text-xs text-slate-400 sm:inline">
              {user?.displayName || user?.email}
            </span>
            <Button variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
