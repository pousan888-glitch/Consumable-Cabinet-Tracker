import React from "react";
import { UserProfile, UserRole } from "../types";
import { LogOut, Shield, User, ClipboardList, Settings, Sparkles, RefreshCw, ChevronRight } from "lucide-react";

interface HeaderProps {
  user: UserProfile;
  onChangeRole?: (role: UserRole) => void;
  onLogout: () => void;
  lowStockCount: number;
  showMenuToggle?: boolean;
  isMenuOpen?: boolean;
  onToggleMenu?: () => void;
  activeSectionLabel?: string;
}

export default function Header({
  user,
  onChangeRole,
  onLogout,
  lowStockCount,
  showMenuToggle = false,
  isMenuOpen = false,
  onToggleMenu,
  activeSectionLabel
}: HeaderProps) {
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
      default:
        return { text: "👤 ผู้ใช้งานระบบ", bg: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  const roleStyle = getRoleLabel(user?.role, user?.isSuperAdmin);

  return (
    <header className="ios-glass-header sticky top-0 z-30 font-sans transition-all">
      <div className={`${showMenuToggle ? "w-full" : "max-w-[1440px] mx-auto"} px-3 sm:px-6 lg:px-8`}>
        <div className="flex justify-between h-14 sm:h-16 items-center gap-2">
          {/* Left: Collapse/Expand Menu Trigger, Brand (when sidebar hidden or non-admin) & Active Section */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {showMenuToggle && onToggleMenu && (
              <button
                type="button"
                onClick={onToggleMenu}
                className={`${
                  isMenuOpen ? "lg:hidden" : "inline-flex"
                } inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-extrabold border border-slate-200/90 shadow-xs transition-all cursor-pointer shrink-0 ios-press`}
                title="เปิดแถบเมนูจัดการระบบด้านซ้าย"
              >
                <ChevronRight className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>เมนู</span>
              </button>
            )}

            {/* Brand Logo (hidden on desktop lg+ when Admin docked sidebar is already open so it isn't duplicated) */}
            <div className={`flex items-center gap-2.5 min-w-0 ${showMenuToggle && isMenuOpen ? "lg:hidden" : ""}`}>
              <div className="h-9 w-9 sm:h-10 sm:w-10 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-500 rounded-2xl flex items-center justify-center text-white font-black text-base sm:text-lg shadow-md shadow-indigo-500/25 border border-white/40 shrink-0 ios-press">
                C
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-base block truncate">
                  Cabinet Stock
                </span>
                <span className="text-[9px] text-indigo-600 uppercase tracking-wider font-extrabold hidden sm:block leading-none">
                  QR STOCK TRACKING SYSTEM
                </span>
              </div>
            </div>

            {showMenuToggle && activeSectionLabel && (
              <div className={`hidden sm:flex items-center gap-2 min-w-0 ${!isMenuOpen ? "pl-2 border-l border-slate-200/80" : ""}`}>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                  ADMIN PANEL
                </span>
                <span className="text-slate-300 shrink-0">—</span>
                <span className="text-xs sm:text-sm font-extrabold text-indigo-700 truncate">
                  {activeSectionLabel}
                </span>
              </div>
            )}
          </div>

          {/* Quick Stats & Role Control */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Low stock badge */}
            {lowStockCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-400/30 text-rose-700 backdrop-blur-md rounded-full text-[11px] sm:text-xs font-bold animate-pulse whitespace-nowrap shadow-xs">
                <span className="h-2 w-2 bg-rose-500 rounded-full shrink-0 shadow-xs shadow-rose-500"></span>
                <span><span className="hidden xs:inline">วิกฤต </span>{lowStockCount}<span className="hidden sm:inline"> ชนิด</span></span>
              </div>
            )}

            {/* Profile Summary */}
            <div className="flex flex-col text-right max-w-[120px] sm:max-w-[200px]">
              <span className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight truncate" title={user?.name || user?.email}>
                {user?.name || user?.email || "ผู้ใช้งาน"}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 truncate hidden sm:block font-medium">
                {user?.email || ""}
              </span>
            </div>

            {/* Simulated role switcher if isSimulation */}
            {user.isSimulation && onChangeRole && (
              <div className="flex items-center gap-1 ios-glass-pill rounded-xl px-1.5 py-1">
                <select
                  value={user.role}
                  onChange={(e) => onChangeRole(e.target.value as UserRole)}
                  className="bg-transparent border-none text-[11px] sm:text-xs font-bold text-slate-700 focus:outline-none pr-1 pl-1 cursor-pointer"
                  title="เปลี่ยนสิทธิ์สำหรับทดสอบ"
                >
                  <option value="ADMIN">แอดมิน</option>
                  <option value="HELPER">ทีมตรวจนับ</option>
                  <option value="QC">QCเบิกใช้</option>
                  <option value="VIEWER">ผู้เข้าชม (Viewer)</option>
                </select>
                <RefreshCw className="h-3 w-3 text-slate-400 animate-spin-slow mr-0.5 shrink-0" />
              </div>
            )}

            {!user.isSimulation && (
              <span className={`px-2.5 py-1 text-[11px] sm:text-xs font-bold border rounded-full whitespace-nowrap backdrop-blur-md shadow-xs ${roleStyle.bg}`}>
                {roleStyle.text}
              </span>
            )}

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-2xl transition-all cursor-pointer shrink-0 ios-press"
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
