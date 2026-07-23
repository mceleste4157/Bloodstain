/**
 * Authentication context.
 *
 * Subscribes once to Firebase's auth state and exposes the current user (and a
 * loading flag while that first check resolves) to the whole tree. Routes use
 * this to gate access; components use it to know who owns the data they write.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import type { User } from '@/lib/firebase/auth';

interface AuthContextValue {
  user: User | null;
  /** True until the initial auth-state check has completed. */
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the current auth state. */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
