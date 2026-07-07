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
  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return { text: "ผู้ดูแลระบบ (Admin)", bg: "bg-red-50 text-red-700 border-red-100" };
      case "HELPER":
        return { text: "เจ้าหน้าที่นับสต็อก (Helper)", bg: "bg-indigo-50 text-indigo-700 border-indigo-100" };
      case "QC":
        return { text: "ผู้เบิกใช้ QC (QC Consumer)", bg: "bg-purple-50 text-purple-700 border-purple-100" };
    }
  };

  const roleStyle = getRoleLabel(user.role);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 font-sans shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-500/10">
              C
            </div>
            <div>
              <span className="font-bold text-slate-950 tracking-tight text-base sm:text-lg block font-display">
                Cabinet Consumables
              </span>
              <span className="text-[10px] text-indigo-600 uppercase tracking-widest font-bold block leading-none">
                QR STOCK TRACKING SYSTEM
              </span>
            </div>
          </div>

          {/* Quick Stats & Role Control */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Low stock badge */}
            {lowStockCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-100 text-rose-700 rounded-full text-xs font-semibold animate-pulse">
                <span className="h-1.5 w-1.5 bg-rose-600 rounded-full"></span>
                <span>วิกฤต {lowStockCount} ชนิด</span>
              </div>
            )}

            {/* Profile Summary & Role switcher */}
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-700 leading-tight">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-400">
                {user.email}
              </span>
            </div>

            {/* Simulated role switcher if isSimulation */}
            {user.isSimulation && onChangeRole && (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
                <select
                  value={user.role}
                  onChange={(e) => onChangeRole(e.target.value as UserRole)}
                  className="bg-transparent border-none text-xs font-semibold text-slate-600 focus:outline-none pr-1 pl-1 cursor-pointer"
                  title="เปลี่ยนสิทธิ์สำหรับทดสอบ"
                >
                  <option value="ADMIN">จำลองเป็น แอดมิน</option>
                  <option value="HELPER">จำลองเป็น ทีมงานนับสต็อก</option>
                  <option value="QC">จำลองเป็น QCเบิกใช้</option>
                </select>
                <RefreshCw className="h-3 w-3 text-slate-400 animate-spin-slow mr-1" />
              </div>
            )}

            {!user.isSimulation && (
              <span className={`px-2.5 py-1 text-xs font-semibold border rounded-full ${roleStyle.bg}`}>
                {roleStyle.text}
              </span>
            )}

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
