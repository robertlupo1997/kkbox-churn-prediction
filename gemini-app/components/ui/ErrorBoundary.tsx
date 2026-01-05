import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from './card';
import { Button } from './button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="glass p-10 rounded-[2.5rem] shadow-xl border-0">
          <CardContent className="p-0 flex flex-col items-center justify-center space-y-6">
            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-full">
              <AlertTriangle size={48} className="text-rose-500" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Something went wrong
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>
            <Button onClick={this.handleReset} className="gap-2">
              <RefreshCw size={16} />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for query error handling
interface QueryErrorFallbackProps {
  error: Error;
  onRetry?: () => void;
  title?: string;
}

export function QueryErrorFallback({
  error,
  onRetry,
  title = 'Failed to Load Data',
}: QueryErrorFallbackProps) {
  return (
    <Card className="glass p-10 rounded-[2.5rem] shadow-xl border-0">
      <CardContent className="p-0 flex flex-col items-center justify-center space-y-6">
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-full">
          <AlertTriangle size={48} className="text-rose-500" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md">
            {error.message}
          </p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw size={16} />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default ErrorBoundary;
