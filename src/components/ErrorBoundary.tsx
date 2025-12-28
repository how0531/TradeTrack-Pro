
// [Manage] Last Updated: 2024-05-22
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    if (window.confirm("這將清除所有本地暫存資料並重新整理頁面。如果您已登入，雲端資料不會受影響。確定要繼續嗎？\n\nThis will clear local storage and reload. Cloud data is safe.")) {
      // Clear specific app keys to avoid wiping unrelated localhost data
      const keysToRemove = [
        'local_trades', 'local_strategies', 'local_emotions', 'local_portfolios',
        'app_active_portfolios', 'app_loss_color', 'app_dd_threshold', 'app_max_loss_streak'
      ];
      keysToRemove.forEach(k => localStorage.removeItem(k));
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0C10] flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
            <AlertTriangle size={40} className="text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-slate-400 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
            應用程式遇到非預期的錯誤，可能是因為匯入的資料格式不相容。
            <br/><br/>
            <span className="font-mono text-xs opacity-50 bg-black/30 p-1 rounded block overflow-hidden text-ellipsis whitespace-nowrap">
              {this.state.error?.message}
            </span>
          </p>

          <div className="space-y-3 w-full max-w-xs">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} /> 重新整理 (Reload)
            </button>

            <button 
              onClick={this.handleReset}
              className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-black transition-all flex items-center justify-center gap-2"
            >
              <Trash2 size={14} /> 清除資料並重置 (Reset Data)
            </button>
          </div>
          
          <div className="mt-8 text-[10px] text-slate-600">
            TradeTrack Pro Error Recovery
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
