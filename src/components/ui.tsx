/**
 * Small shared UI primitives styled for the dark, touch-friendly
 * law-enforcement theme. Kept intentionally minimal — enough to give the pages
 * a consistent look without pulling in a component library.
 */

import { forwardRef } from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ' +
    'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/60 disabled:cursor-not-allowed ' +
    'disabled:opacity-50 min-h-[44px]';
  const variants: Record<string, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-500',
    secondary: 'bg-surface-border text-slate-100 hover:bg-slate-600',
    ghost: 'bg-transparent text-slate-300 hover:bg-surface-border',
    danger: 'bg-red-700 text-white hover:bg-red-600',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = '', ...props }, ref) {
    return (
      <input
        ref={ref}
        className={
          'w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-slate-100 ' +
          'placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 ' +
          'focus:ring-brand-500 min-h-[44px] ' +
          className
        }
        {...props}
      />
    );
  },
);

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border border-surface-border bg-surface-raised p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-brand-400" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}
