/**
 * Data hooks for cases.
 *
 * `useCases` streams the signed-in user's case list; `useCase` streams a single
 * case. Both wrap the repository's `onSnapshot` subscriptions so components get
 * live updates and clean unsubscription, with typed loading/error state.
 */

import { useEffect, useState } from 'react';
import type { Case } from '@/types';
import { subscribeCase, subscribeCases } from '@/lib/firebase/cases';
import { useAuth } from '@/contexts/AuthContext';

interface ListState {
  cases: Case[];
  loading: boolean;
  error: string | null;
}

/** Live list of the current user's cases, newest first. */
export function useCases(): ListState {
  const { user } = useAuth();
  const [state, setState] = useState<ListState>({ cases: [], loading: true, error: null });

  useEffect(() => {
    if (!user) {
      setState({ cases: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const unsub = subscribeCases(
      user.uid,
      (cases) => setState({ cases, loading: false, error: null }),
      (err) => setState({ cases: [], loading: false, error: err.message }),
    );
    return unsub;
  }, [user]);

  return state;
}

interface CaseState {
  kase: Case | null;
  loading: boolean;
  error: string | null;
}

/** Live single case by id. */
export function useCase(id: string | undefined): CaseState {
  const [state, setState] = useState<CaseState>({ kase: null, loading: true, error: null });

  useEffect(() => {
    if (!id) {
      setState({ kase: null, loading: false, error: null });
      return;
    }
    setState({ kase: null, loading: true, error: null });
    const unsub = subscribeCase(
      id,
      (kase) => setState({ kase, loading: false, error: null }),
      (err) => setState({ kase: null, loading: false, error: err.message }),
    );
    return unsub;
  }, [id]);

  return state;
}
