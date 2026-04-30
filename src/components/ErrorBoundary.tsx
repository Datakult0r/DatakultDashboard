'use client';

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Fallback label shown in the error state */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches render errors in child components.
 * Shows a branded error state with retry option instead of crashing the whole page.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-danger/5 border border-danger/20 rounded-lg p-6 text-center">
          <AlertCircle size={24} className="text-danger mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-danger mb-1">
            {this.props.label ? `Error loading ${this.props.label}` : 'Something went wrong'}
          </h3>
          <p className="text-xs text-secondary mb-3">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
          >
            <RotateCcw size={12} />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
