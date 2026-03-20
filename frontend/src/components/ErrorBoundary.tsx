"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] m-4 shadow-xl">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[var(--text-primary)] mb-2">Eyvah! Bir şeyler ters gitti.</h2>
          <p className="text-[var(--text-secondary)] text-center max-w-md mb-8">
            Haberleri yüklerken teknik bir sorunla karşılaştık. Lütfen sayfayı yenilemeyi deneyin veya daha sonra tekrar gelin.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-xl font-bold shadow-lg hover:opacity-90 transition-all active:scale-95"
          >
            <RefreshCcw size={18} />
            Sayfayı Yenile
          </button>
          
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-black/5 rounded text-xs text-red-500 overflow-auto max-w-full italic">
              {this.state.error?.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
