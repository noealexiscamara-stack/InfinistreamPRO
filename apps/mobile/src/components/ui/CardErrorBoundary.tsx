import React, { Component, type ReactNode } from 'react';

interface CardErrorBoundaryProps {
  children: ReactNode;
  /** Identifies which home card failed — included in logs for debugging. */
  name?: string;
}

interface CardErrorBoundaryState {
  hasError: boolean;
}

function logCardError(name: string | undefined, error: Error, componentStack: string | null | undefined): void {
  const label = name ? `[CardErrorBoundary:${name}]` : '[CardErrorBoundary]';
  console.error(`${label} Home card render failed`, error, { componentStack });
  // Sentry.captureException(error, { tags: { card: name }, extra: { componentStack } });
}

/** Isolates a single home card — a render failure shows nothing instead of blocking startup. */
export class CardErrorBoundary extends Component<CardErrorBoundaryProps, CardErrorBoundaryState> {
  state: CardErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logCardError(this.props.name, error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
