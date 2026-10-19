import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  loginRoute?: string;
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
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled Portal Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoToLogin = () => {
    const route = this.props.loginRoute || '/student';
    window.location.href = route;
  };

  public render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || 'Something went wrong';
      const msg = this.state.error?.message || 'An unexpected rendering error occurred in this view.';

      return (
        <div className="min-h-screen bg-[#080A0F] text-[#F1F5F9] flex flex-col items-center justify-center p-4 font-sans select-none">
          <div className="w-full max-w-lg bg-[#12161F] border border-[#252B36] rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-amber-950/60 border border-amber-600/80 flex items-center justify-center mx-auto text-amber-400 shadow-md">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono font-extrabold text-amber-400 tracking-widest uppercase block">
                PORTAL COMPONENT FAULT RECOVERED
              </span>
              <h2 className="text-xl font-bold text-white font-sans">{title}</h2>
              <div className="bg-[#080A0F] border border-[#252B36] rounded-xl p-3 text-left">
                <p className="text-xs font-mono text-rose-300 break-words leading-relaxed">{msg}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-md transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Portal</span>
              </button>
              <button
                onClick={this.handleGoToLogin}
                className="flex-1 min-h-[44px] bg-[#171C26] hover:bg-[#202633] border border-[#252B36] text-[#94A3B8] hover:text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Return to Login</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
