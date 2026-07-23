/**
 * Sign-in / sign-up screen.
 *
 * The single entry point to the app. Toggles between signing in and creating an
 * account, validates input, surfaces friendly auth errors, and shows a loading
 * state while Firebase works. On success the auth listener in AuthContext flips
 * and the router renders the app.
 */

import { useState, type FormEvent } from 'react';
import { authErrorMessage, signIn, signUp } from '@/lib/firebase/auth';
import { Button, Card, Field, TextInput } from '@/components/ui';

type Mode = 'signin' | 'signup';

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password, name.trim() || undefined);
      }
      // On success the AuthContext listener handles navigation.
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold">
            BPA
          </div>
          <div>
            <h1 className="text-lg font-semibold">BPA Assistant</h1>
            <p className="text-xs text-slate-400">Bloodstain Pattern Analysis</p>
          </div>
        </div>

        <Card>
          <h2 className="mb-4 text-base font-semibold">
            {mode === 'signin' ? 'Sign in' : 'Create an account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'signup' ? (
              <Field label="Name (optional)" htmlFor="name">
                <TextInput
                  id="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Det. A. Rivera"
                />
              </Field>
            ) : null}

            <Field label="Email" htmlFor="email">
              <TextInput
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agency.gov"
                required
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <TextInput
                id="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>

            {error ? (
              <p role="alert" className="rounded-md bg-red-950/60 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-slate-400">
            {mode === 'signin' ? (
              <button
                type="button"
                className="hover:text-brand-300"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
              >
                Need an account? <span className="text-brand-400">Sign up</span>
              </button>
            ) : (
              <button
                type="button"
                className="hover:text-brand-300"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
              >
                Already have an account? <span className="text-brand-400">Sign in</span>
              </button>
            )}
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-500">
          Authorized use only. Access is restricted to signed-in investigators.
        </p>
      </div>
    </div>
  );
}
