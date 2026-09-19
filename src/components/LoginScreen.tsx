import React, { useState, useEffect } from "react";
import { 
  auth, 
  signInWithPopup, 
  GoogleAuthProvider 
} from "../lib/firebase";
import { fetchOrRegisterUser, updateAppUserName } from "../lib/dbService";
import { UserProfile, UserRole } from "../types";
import { 
  AlertTriangle, 
  Lock, 
  Boxes, 
  ArrowRight,
  Mail,
  UserCheck,
  Check,
  ShieldCheck
} from "lucide-react";

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
}

interface PendingUser {
  email: string;
  defaultName: string;
  role: UserRole;
  isSuperAdmin: boolean;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContact, setShowContact] = useState(false);

  // Step 2: Full name input state after email authentication
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const currentHostname = typeof window !== "undefined" ? window.location.hostname : "";

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      // Prompt user to select an account even if they already signed in previously
      provider.setCustomParameters({ prompt: "select_account" });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const emailLower = user.email?.toLowerCase() || "";
      const googleDisplayName = user.displayName || user.email || "";
      const userMeta = await fetchOrRegisterUser(emailLower, googleDisplayName);

      // Extract existing first & last name if available
      const existingName = userMeta.name || googleDisplayName;
      const parts = existingName.trim().split(" ");
      if (parts.length > 1) {
        setFirstName(parts[0]);
        setLastName(parts.slice(1).join(" "));
      } else {
        setFirstName(parts[0] || "");
        setLastName("");
      }

      // Transition to Step 2: Confirm or input user's Full Name
      setPendingUser({
        email: emailLower,
        defaultName: existingName,
        role: userMeta.role,
        isSuperAdmin: userMeta.isSuperAdmin
      });
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      const errCode = err?.code || "";
      const errMsg = err?.message || "";
      
      if (errCode === "auth/popup-blocked") {
        setError(
          "เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ (Popup Blocked) กรุณาคลิก 'เปิดในแท็บใหม่' ด้านขวาบนของหน้าต่าง แล้วลองใหม่อีกครั้ง"
        );
      } else if (errCode === "auth/popup-closed-by-user") {
        setError("หน้าต่างลงชื่อเข้าใช้ถูกปิดก่อนจะยืนยันสำเร็จ กรุณากดเข้าสู่ระบบใหม่อีกครั้ง");
      } else if (errCode === "auth/unauthorized-domain") {
        setError(
          `โดเมน "${currentHostname}" ยังไม่ได้รับอนุญาตใน Firebase Authentication กรุณาแจ้งผู้ดูแลระบบให้เพิ่มโดเมนใน Firebase Console`
        );
      } else if (errCode === "auth/operation-not-allowed") {
        setError("ผู้ให้บริการ Google Sign-In ยังไม่ถูกเปิดใช้งานในระบบ กรุณาติดต่อผู้ดูแลระบบ");
      } else {
        setError(
          `เข้าสู่ระบบไม่สำเร็จ: ${errMsg || "กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือติดต่อผู้ดูแลระบบ"}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const fullName = trimmedLast ? `${trimmedFirst} ${trimmedLast}` : trimmedFirst;

    if (!fullName) {
      setError("กรุณาระบุชื่อและนามสกุลสำหรับบันทึกการทำงานในระบบ");
      return;
    }

    setSavingName(true);
    setError("");

    try {
      await updateAppUserName(pendingUser.email, fullName);

      onLogin({
        email: pendingUser.email,
        name: fullName,
        role: pendingUser.role,
        isSuperAdmin: pendingUser.isSuperAdmin,
        isSimulation: false
      });
    } catch (err) {
      console.error("Error updating user name:", err);
      // Even if cloud sync has minor network delay, allow proceeding with input name
      onLogin({
        email: pendingUser.email,
        name: fullName,
        role: pendingUser.role,
        isSuperAdmin: pendingUser.isSuperAdmin,
        isSimulation: false
      });
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-[#0b0f19] px-4 py-8 sm:px-6 lg:px-8 font-sans overflow-hidden select-none">
      {/* 1. Industrial Background: Dot Grid & Blueprint Tech Grid */}
      <div 
        className="absolute inset-0 opacity-[0.06] pointer-events-none" 
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px"
        }}
      />
      <div 
        className="absolute inset-0 opacity-[0.08] pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
          backgroundSize: "20px 20px"
        }}
      />

      {/* 2. Soft Radial Glows (Dark Navy / Blue / Safety Orange Ambient Accents) */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-orange-500/15 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* 3. System Status Ticker / Telemetry Badges */}
      <div className="relative z-10 mb-6 flex flex-wrap items-center justify-center gap-2 max-w-md w-full px-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/70 text-slate-300 text-xs shadow-lg backdrop-blur-md">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-emerald-300">Cloud Sync พร้อม</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/70 text-slate-300 text-xs shadow-lg backdrop-blur-md">
          <Boxes className="h-3.5 w-3.5 text-orange-400" />
          <span className="font-medium text-slate-300">ระบบติดตามวัสดุและตู้พัสดุ</span>
        </div>
      </div>

      {/* 4. Central Card with Safety Orange Accent Top Border */}
      <div className="max-w-md w-full relative z-10 bg-white/98 backdrop-blur-xl p-7 sm:p-9 rounded-2xl shadow-2xl shadow-black/70 border border-slate-200/80 border-t-4 border-t-orange-500 space-y-6">
        
        {/* STEP 1: Google Authentication Screen */}
        {!pendingUser ? (
          <>
            {/* Card Header & 3D Smart Cabinet Illustration */}
            <div className="text-center space-y-3">
              {/* Smart Cabinet 3D/Isometric Style Icon */}
              <div className="mx-auto relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/30 to-indigo-600/30 rounded-2xl blur-lg pointer-events-none" />
                
                <div className="relative w-20 h-20 bg-gradient-to-b from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-2.5 shadow-xl border border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    </div>
                    <span className="text-[8px] font-mono font-bold text-slate-400 tracking-wider">SMART-CAB</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 px-1 py-1">
                    <div className="h-4 bg-slate-800/90 rounded border border-slate-700 flex items-center justify-center">
                      <div className="w-3 h-1.5 bg-orange-500/80 rounded-xs" />
                    </div>
                    <div className="h-4 bg-slate-800/90 rounded border border-slate-700 flex items-center justify-center">
                      <div className="w-3 h-1.5 bg-indigo-400/80 rounded-xs" />
                    </div>
                    <div className="h-4 bg-slate-800/90 rounded border border-slate-700 flex items-center justify-center">
                      <div className="w-3 h-1.5 bg-sky-400/80 rounded-xs" />
                    </div>
                    <div className="h-4 bg-slate-800/90 rounded border border-slate-700 flex items-center justify-center">
                      <div className="w-3 h-1.5 bg-emerald-400/80 rounded-xs" />
                    </div>
                  </div>

                  <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 rounded-full shadow-xs shadow-orange-500/50" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight font-display">
                  Cabinet Consumable
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 font-sans leading-relaxed">
                  ระบบตรวจสอบและติดตามพัสดุวัสดุสิ้นเปลืองประจำตู้เก็บของแผนก
                </p>
              </div>

              {/* Security & Access Badge */}
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-600">
                  <Lock className="h-3 w-3 text-slate-500" />
                  Restricted Access: Authorized Personnel Only
                </span>
              </div>
            </div>

            {/* Error Alert if any */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3.5 rounded-xl text-xs leading-relaxed space-y-1 animate-fadeIn">
                <div className="font-semibold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>แจ้งเตือนจากระบบ:</span>
                </div>
                <p className="text-rose-700 font-sans pl-5.5">{error}</p>
              </div>
            )}

            {/* Corporate Standard Google Sign-In Button */}
            <div className="pt-1 space-y-3">
              <button
                id="google-signin-btn"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl font-semibold transition-all duration-150 shadow-md shadow-slate-900/20 hover:shadow-lg border border-slate-800 disabled:opacity-60 cursor-pointer text-sm sm:text-base group"
              >
                <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center shrink-0 shadow-2xs">
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                </div>
                
                <span className="tracking-normal font-medium">
                  {loading ? "กำลังเปิดหน้าต่างยืนยัน..." : "เข้าสู่ระบบด้วย Google Workspace"}
                </span>

                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>

              {/* Discreet Help / Admin Contact Note */}
              <div className="pt-3 border-t border-slate-100 text-center">
                {!showContact ? (
                  <button
                    type="button"
                    onClick={() => setShowContact(true)}
                    className="text-[11px] sm:text-xs text-slate-500 hover:text-orange-600 font-medium transition-colors underline decoration-slate-300 hover:decoration-orange-500 cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>ต้องการขอสิทธิ์เข้าใช้งาน</span>
                  </button>
                ) : (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] sm:text-xs text-slate-600 space-y-1 animate-fadeIn">
                    <p className="font-medium text-slate-700">ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์:</p>
                    <a 
                      href="mailto:pousan888@gmail.com" 
                      className="inline-flex items-center gap-1.5 text-orange-600 hover:text-orange-700 font-semibold transition-colors underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>pousan888@gmail.com</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* STEP 2: Name & Surname Input Prompt */
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shadow-xs">
                <UserCheck className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                ระบุชื่อ - นามสกุลผู้ใช้งาน
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                เพื่อใช้แสดงชื่อผู้ตรวจนับและบันทึกประวัติการเบิกใช้วัสดุในระบบอย่างชัดเจน
              </p>
            </div>

            {/* Account Confirmation Pill */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] text-slate-400 block font-medium">บัญชีอีเมลที่ยืนยันแล้ว:</span>
                <span className="font-semibold text-slate-800 truncate block font-mono text-[11px]">
                  {pendingUser.email}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                ยืนยันแล้ว
              </span>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleConfirmName} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="user-first-name" className="text-xs font-semibold text-slate-700 block">
                    ชื่อจริง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="user-first-name"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="เช่น สมชาย"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="user-last-name" className="text-xs font-semibold text-slate-700 block">
                    นามสกุล
                  </label>
                  <input
                    id="user-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="เช่น ใจดี"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  id="confirm-name-btn"
                  type="submit"
                  disabled={savingName || !firstName.trim()}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-xl font-semibold shadow-md shadow-orange-600/20 transition-all cursor-pointer disabled:opacity-50 text-sm"
                >
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>{savingName ? "กำลังบันทึกข้อมูล..." : "บันทึกและเข้าใช้งานระบบ"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPendingUser(null);
                    setError("");
                  }}
                  className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-center"
                >
                  สลับบัญชี หรือเข้าสู่ระบบใหม่
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* 5. Minimal Engineering Footer Note */}
      <div className="relative z-10 mt-6 text-center text-slate-500 text-[11px] font-mono tracking-wider">
        INTELLIGENT CABINET & INVENTORY CONTROL SYSTEM • v2.4
      </div>
    </div>
  );
}
