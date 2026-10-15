import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // ثبت امن در کنسول جهت دیباگ توسعه‌دهنده بدون نشت اطلاعات حساس
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleGoHome = () => {
    window.location.href = window.location.origin + window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          role="alert"
          aria-live="assertive"
          className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans select-none"
        >
          <div className="max-w-md w-full bg-slate-900 border border-emerald-900/40 rounded-2xl p-6 md:p-8 text-center shadow-2xl relative overflow-hidden">
            {/* جلوه پس‌زمینه معنوی */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <h1 className="text-xl md:text-2xl font-bold text-slate-100 mb-2">
              {this.props.fallbackTitle || 'خطایی در اجرای برنامه رخ داد'}
            </h1>

            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              متأسفانه در پردازش این بخش مشکلی پیش آمد. داده‌های قرآن و تنظیمات شما محفوظ هستند و هیچ آسیبی ندیده‌اند.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-3 bg-slate-950/80 border border-rose-900/30 rounded-xl text-left font-mono text-xs text-rose-300 max-h-32 overflow-y-auto ltr text-left">
                <p className="font-semibold">{this.state.error.name}: {this.state.error.message}</p>
              </div>
            )}

            <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                aria-label="تلاش مجدد برای اجرای صفحه"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تلاش مجدد</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-medium text-sm transition-all border border-slate-700 cursor-pointer"
                aria-label="بارگذاری مجدد کل صفحه"
              >
                <RefreshCw className="w-4 h-4" />
                <span>بارگذاری مجدد</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 active:scale-95 text-slate-300 font-medium text-sm transition-all border border-slate-700/60 cursor-pointer"
                aria-label="بازگشت به صفحه اصلی قرآن مبین"
              >
                <Home className="w-4 h-4" />
                <span>صفحهٔ اصلی</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
