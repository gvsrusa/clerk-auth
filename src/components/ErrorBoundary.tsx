'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  /**
   * The children components to render
   */
  children: ReactNode;
  
  /**
   * Optional fallback component to render when an error occurs
   */
  fallback?: ReactNode;
  
  /**
   * Optional callback for handling errors
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  /**
   * Indicates if an error has occurred
   */
  hasError: boolean;
  
  /**
   * The error that occurred, if any
   */
  error: Error | null;
  
  /**
   * Additional error information
   */
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to prevent component errors from crashing the entire app
 * Use this to wrap critical components that might fail
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    // Save error info for display
    this.setState({
      errorInfo,
    });
    
    // Call the optional error handler
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }
  }

  /**
   * Try to recover the component by resetting the error state
   */
  tryRecovery = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Render custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <h2>Something went wrong</h2>
            <details>
              <summary>View error details</summary>
              <pre>{error?.toString()}</pre>
            </details>
            <button 
              className="error-boundary-retry-btn"
              onClick={this.tryRecovery}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Higher-Order Component that wraps a component with an ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;