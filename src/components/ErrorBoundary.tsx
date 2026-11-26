import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare state: ErrorBoundaryState;
  declare props: Readonly<ErrorBoundaryProps>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: ""
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || "เกิดข้อผิดพลาดที่ไม่คาดคิดในการแสดงผลหน้าจอ"
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[App ErrorBoundary caught error]:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetCacheAndReload = () => {
    try {
      const keysToRemove = [
        "cabinet_tracker_user",
        "local_cabinets",
        "local_consumables",
        "local_departments",
        "local_master_consumables",
        "local_count_history",
        "local_qc_consumption_history",
        "local_users",
        "cabinet_database_seeded_flag"
      ];
      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore storage errors
        }
      });
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-rose-100 p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto h-16 w-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-black text-slate-900">
                ไม่สามารถแสดงผลหน้าจอนี้ได้ชั่วคราว
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                ระบบตรวจพบข้อผิดพลาดระหว่างเปิดหน้าข้อมูล (อาจเกิดจากแคชเก่าในเบราว์เซอร์หรือข้อมูลที่ไม่สมบูรณ์)
              </p>
            </div>

            {this.state.errorMessage && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-[11px] font-mono text-slate-600 break-words max-h-28 overflow-y-auto">
                {this.state.errorMessage}
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                <span>โหลดหน้านี้ใหม่อีกครั้ง</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCacheAndReload}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>ล้างแคชที่ค้างและเข้าสู่ระบบใหม่</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
