/**
 * Minimal error boundary. Wraps a subtree (e.g. the WebGL 3D scene) so a render
 * failure there degrades gracefully to a message instead of taking down the
 * whole page.
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <p className="text-sm text-red-400">Something went wrong rendering this view.</p>
        )
      );
    }
    return this.props.children;
  }
}
