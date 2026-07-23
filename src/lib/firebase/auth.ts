/**
 * Authentication helpers.
 *
 * Thin, typed wrappers over Firebase email/password auth that also translate
 * Firebase's error codes into human-readable messages suitable for the UI. The
 * app is auth-gated (CJIS-friendly: no data without a signed-in user), so these
 * are the only ways in and out.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from './config';

export type { User };

export async function signIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred.user;
}

export function signOut(): Promise<void> {
  return fbSignOut(auth);
}

/** Map a Firebase auth error to a message a non-technical user can act on. */
export function authErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-email':
        return 'That email address is not valid.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      case 'auth/email-already-in-use':
        return 'An account already exists for that email.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return err.message.replace('Firebase: ', '');
    }
  }
  return 'Something went wrong. Please try again.';
}
