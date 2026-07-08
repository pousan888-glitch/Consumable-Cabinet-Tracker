import React, { useState } from "react";
import { auth, signInWithPopup, GoogleAuthProvider, isOfflineFallback, isPlaceholderKey, isVercel } from "../lib/firebase";
import { UserProfile, UserRole } from "../types";
import { QrCode, Sparkles, AlertTriangle, Key, Terminal, ArrowRight } from "lucide-react";

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
      const errCode = err?.code || "";
      const errMsg = err?.message || "";
      
      if (errCode === "auth/popup-blocked" || errCode === "auth/popup-closed-by-user") {
        setError(
          "เบราว์เซอร์หรือ Iframe บล็อกการเปิดหน้าต่างภายนอก (Popups) กรุณาคลิกปุ่ม 'เปิดในแท็บใหม่' ด้านขวาบนของหน้าจอ แล้วจึงเข้าสู่ระบบด้วย Google Account อีกครั้ง"
        );
      } else if (errCode === "auth/api-key-not-valid") {
        setError(
          "รหัสผ่าน Firebase API Key ที่กำหนดไว้ไม่ถูกต้องหรือเป็นค่าจำลอง (auth/api-key-not-valid) กรุณาตรวจสอบให้แน่ใจว่าคุณได้ตั้งค่า Environment Variables บน Vercel ครบถ้วนแล้ว หรือคลิกปุ่ม 'ทดลองใช้งานแบบจำลอง (Offline Demo)' ด้านล่างเพื่อใช้งานทันที"
        );
      } else {
        setError(
          `เกิดข้อผิดพลาดในการเข้าสู่ระบบ (${errCode || "unknown"}): ${errMsg || "กรุณาตรวจสอบการตั้งค่า Firebase หรืออินเทอร์เน็ตของคุณ"}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateLogin = () => {
    onLogin({
      email: "pousan888@gmail.com",
      name: "คุณปูแสน (Demo Admin)",
      role: "ADMIN",
      isSimulation: true
    });
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

        {isOfflineFallback && (
          <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-4 text-xs text-amber-900 leading-relaxed space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>โหมดจำลองสถานะออฟไลน์ (Offline/Demo Mode Active)</span>
            </div>
            <p>
              เนื่องจากแอปตรวจพบว่ากำลังทำงานอยู่บน Vercel และใช้ API Key ตั้งต้นที่เป็นค่าจำลอง กรุณาเพิ่มและตั้งค่า <strong>Environment Variables</strong> ในโครงการ Vercel ของคุณเพื่อใช้งานระบบคลาวด์จริง
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-xl text-xs leading-relaxed space-y-1">
            <div className="font-semibold text-red-800 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              ข้อผิดพลาดตอนเข้าสู่ระบบ:
            </div>
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-3">
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

          {(isOfflineFallback || error) && (
            <button
              onClick={handleSimulateLogin}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100 transition-all duration-150 cursor-pointer text-sm border border-indigo-100"
            >
              <Sparkles className="h-4 w-4" />
              ทดลองใช้งานแบบจำลอง (Offline Demo)
            </button>
          )}
        </div>

        {isOfflineFallback && (
          <div className="border-t border-slate-100 pt-5 mt-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-indigo-600" />
              วิธีแก้ปัญหาเพื่อใช้งาน Google Auth บน Vercel:
            </h4>
            <ol className="text-[11px] text-slate-500 list-decimal pl-4 space-y-1 leading-relaxed">
              <li>
                สร้างโปรเจกต์ใหม่ที่ <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-medium">Firebase Console</a>
              </li>
              <li>
                เปิดใช้บริการ <strong>Authentication (Google Sign-In)</strong> และ <strong>Cloud Firestore</strong>
              </li>
              <li>
                เพิ่มโดเมนของ Vercel (เช่น <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">consumable-cabinet-tracker.vercel.app</code>) เข้าไปใน <strong>Authorized Domains</strong> ในเมนู Auth ของ Firebase
              </li>
              <li>
                ไปที่ <strong>Vercel Dashboard &gt; Settings &gt; Environment Variables</strong> ของโปรเจกต์นี้
              </li>
              <li>
                เพิ่มตัวแปรระบบตามโครงสร้างนี้จาก Firebase ของคุณ:
                <div className="bg-slate-900 text-[10px] text-slate-300 font-mono p-2 rounded-lg mt-1.5 space-y-0.5 overflow-x-auto">
                  <div>VITE_FIREBASE_API_KEY="..."</div>
                  <div>VITE_FIREBASE_AUTH_DOMAIN="..."</div>
                  <div>VITE_FIREBASE_PROJECT_ID="..."</div>
                  <div>VITE_FIREBASE_STORAGE_BUCKET="..."</div>
                  <div>VITE_FIREBASE_MESSAGING_SENDER_ID="..."</div>
                  <div>VITE_FIREBASE_APP_ID="..."</div>
                </div>
              </li>
              <li>
                ทำคลิก <strong>Redeploy</strong> ใน Vercel เพื่อนำค่าที่ตั้งใหม่ไปใช้งาน!
              </li>
            </ol>
          </div>
        )}

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
