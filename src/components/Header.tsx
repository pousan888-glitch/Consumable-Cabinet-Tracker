import React from "react";
import { UserProfile, UserRole } from "../types";
import { LogOut, Shield, User, ClipboardList, Settings, Sparkles, RefreshCw } from "lucide-react";

interface HeaderProps {
  user: UserProfile;
  onChangeRole?: (role: UserRole) => void;
  onLogout: () => void;
  lowStockCount: number;
}

export default function Header({ user, onChangeRole, onLogout, lowStockCount }: HeaderProps) {
  const getRoleLabel = (role: UserRole, isSuperAdmin?: boolean) => {
    if (isSuperAdmin) {
      return { text: "👑 ผู้ดูแลระบบสูงสุด", bg: "bg-amber-50 text-amber-800 border-amber-300 font-bold" };
    }
    switch (role) {
      case "ADMIN":
        return { text: "🛡️ แอดมิน (Admin)", bg: "bg-red-50 text-red-700 border-red-200" };
      case "HELPER":
        return { text: "📋 นับสต็อก (Helper)", bg: "bg-indigo-50 text-indigo-700 border-indigo-200" };
      case "QC":
        return { text: "🔬 เบิกใช้ QC", bg: "bg-purple-50 text-purple-700 border-purple-200" };
      case "VIEWER":
        return { text: "👁️ ผู้เข้าชม (Viewer)", bg: "bg-blue-50 text-blue-700 border-blue-200 font-bold" };
    }
  };

  const roleStyle = getRoleLabel(user.role, user.isSuperAdmin);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 font-sans shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16 items-center gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-xs shadow-indigo-500/10 shrink-0">
              C
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-950 tracking-tight text-sm sm:text-lg block font-display truncate">
                Cabinet Stock
              </span>
              <span className="text-[9px] text-indigo-600 uppercase tracking-widest font-bold hidden sm:block leading-none">
                QR STOCK TRACKING SYSTEM
              </span>
            </div>
          </div>

          {/* Quick Stats & Role Control */}
          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
            {/* Low stock badge */}
            {lowStockCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-rose-50 border border-rose-100 text-rose-700 rounded-full text-[11px] sm:text-xs font-bold animate-pulse whitespace-nowrap">
                <span className="h-1.5 w-1.5 bg-rose-600 rounded-full shrink-0"></span>
                <span><span className="hidden xs:inline">วิกฤต </span>{lowStockCount}<span className="hidden sm:inline"> ชนิด</span></span>
              </div>
            )}

            {/* Profile Summary & Role switcher */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-700 leading-tight">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-400">
                {user.email}
              </span>
            </div>

            {/* Simulated role switcher if isSimulation */}
            {user.isSimulation && onChangeRole && (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 sm:p-1">
                <select
                  value={user.role}
                  onChange={(e) => onChangeRole(e.target.value as UserRole)}
                  className="bg-transparent border-none text-[11px] sm:text-xs font-semibold text-slate-600 focus:outline-none pr-1 pl-1 cursor-pointer"
                  title="เปลี่ยนสิทธิ์สำหรับทดสอบ"
                >
                  <option value="ADMIN">แอดมิน</option>
                  <option value="HELPER">ทีมตรวจนับ</option>
                  <option value="QC">QCเบิกใช้</option>
                  <option value="VIEWER">ผู้เข้าชม (Viewer)</option>
                </select>
                <RefreshCw className="h-3 w-3 text-slate-400 animate-spin-slow mr-1 shrink-0" />
              </div>
            )}

            {!user.isSimulation && (
              <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-semibold border rounded-full whitespace-nowrap ${roleStyle.bg}`}>
                {roleStyle.text}
              </span>
            )}

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer shrink-0"
              title="ออกจากระบบ"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
