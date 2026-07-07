import React, { useState } from "react";
import { auth, signInWithPopup, GoogleAuthProvider } from "../lib/firebase";
import { UserProfile, UserRole } from "../types";
import { QrCode, Sparkles } from "lucide-react";

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const emailLower = user.email?.toLowerCase() || "";
      const isUserAdmin = emailLower === "pousan888@gmail.com";
      const role: UserRole = isUserAdmin ? "ADMIN" : "HELPER";

      onLogin({
        email: emailLower,
        name: user.displayName || user.email || "ผู้ใช้งาน",
        role,
        isSimulation: false
      });
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setError(
        "เบราว์เซอร์หรือ Iframe บล็อกการเปิดหน้าต่างภายนอก (Popups) กรุณาคลิกปุ่ม 'เปิดในแท็บใหม่' ด้านขวาบนของหน้าจอ แล้วจึงเข้าสู่ระบบด้วย Google Account อีกครั้ง"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
            <QrCode className="h-10 w-10" id="login-logo" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight font-display">
            Cabinet Consumable
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-sans">
            ระบบตรวจสอบและติดตามพัสดุวัสดุสิ้นเปลืองประจำตู้เก็บของแผนก
          </p>
        </div>

        {error && (
          <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-800 p-4 rounded-r-lg text-sm leading-relaxed">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 border border-slate-200 rounded-xl shadow-sm bg-white hover:bg-slate-50 text-slate-700 font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 hover:border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.18 4.114-3.483 0-6.312-2.83-6.312-6.314s2.83-6.314 6.312-6.314c1.55 0 2.97.56 4.07 1.48l3.14-3.14C19.06 1.99 15.89 1 12.24 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.898 0 10.607-4.218 10.607-10.607 0-.486-.048-.96-.13-1.42H12.24z"
              />
            </svg>
            {loading ? "กำลังโหลด..." : "เข้าสู่ระบบด้วย Google Account"}
          </button>
        </div>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-500" />
            ผู้ดูแลระบบหลัก: pousan888@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
}
