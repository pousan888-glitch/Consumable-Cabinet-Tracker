import React, { useState } from "react";
import { 
  auth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  getActiveFirebaseConfig, 
  saveInAppFirebaseConfig, 
  clearInAppFirebaseConfig 
} from "../lib/firebase";
import { UserProfile, UserRole } from "../types";
import { 
  QrCode, 
  Sparkles, 
  AlertTriangle, 
  Key, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Database, 
  Info, 
  ChevronRight, 
  X,
  Settings
} from "lucide-react";

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentConfigInfo = getActiveFirebaseConfig();
  const currentHostname = typeof window !== "undefined" ? window.location.hostname : "";

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
      
      if (errCode === "auth/popup-blocked") {
        setError(
          "เบราว์เซอร์หรือ Iframe บล็อกการเปิดหน้าต่างภายนอก (Popup Blocked) กรุณาคลิกปุ่ม 'เปิดในแท็บใหม่' ด้านขวาบนของหน้าจอ แล้วลองเข้าสู่ระบบอีกครั้ง"
        );
      } else if (errCode === "auth/popup-closed-by-user") {
        setError("หน้าต่างลงชื่อเข้าใช้ถูกปิดก่อนจะยืนยันสำเร็จ กรุณากดเข้าสู่ระบบใหม่อีกครั้ง");
      } else if (errCode === "auth/unauthorized-domain") {
        setError(
          `โดเมน "${currentHostname}" ยังไม่ได้รับอนุญาตใน Firebase! วิธีแก้: เข้า Firebase Console > Authentication > Settings > Authorized domains แล้วกด "Add domain" ใส่ "${currentHostname}"`
        );
      } else if (errCode === "auth/operation-not-allowed") {
        setError(
          "ผู้ให้บริการ Google Sign-In ยังไม่ถูกเปิดใช้งาน! วิธีแก้: เข้า Firebase Console > Authentication > Sign-in method แล้วกดเปิดใช้งาน (Enable) ตัวเลือก 'Google'"
        );
      } else if (errCode === "auth/api-key-not-valid") {
        setError(
          "Firebase API Key ที่ระบุไม่ถูกต้อง กรุณาตรวจสอบว่าได้คัดลอก apiKey มาจาก Firebase Console ครบถ้วนแล้วหรือไม่ หรือกดปุ่ม 'คู่มือดึงข้อมูลจาก Firebase' ด้านล่าง"
        );
      } else {
        setError(
          `เข้าสู่ระบบไม่สำเร็จ (${errCode || "unknown"}): ${errMsg || "กรุณาตรวจสอบการตั้งค่า Firebase หรืออินเทอร์เน็ตของคุณ"}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyJsonConfig = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Try to parse raw JSON or object text
      let cleaned = jsonInput.trim();
      if (cleaned.startsWith("const firebaseConfig =")) {
        cleaned = cleaned.replace("const firebaseConfig =", "").replace(/;$/, "").trim();
      }
      // If object keys are unquoted, handle simple JSON format
      const parsed = JSON.parse(cleaned);
      if (!parsed.apiKey || !parsed.projectId) {
        alert("ข้อมูลไม่ถูกต้อง ต้องมี apiKey และ projectId เป็นอย่างน้อย");
        return;
      }
      saveInAppFirebaseConfig(parsed);
      setSaveSuccess(true);
    } catch (err) {
      alert("ไม่สามารถอ่านรูปแบบ JSON ได้ กรุณาตรวจสอบรูปแบบข้อความให้ถูกต้อง");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
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

        {/* Real Mode Status Indicator */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-700">
              สถานะ: <strong className="text-emerald-700">ระบบจริง (Real Firebase Mode)</strong>
            </span>
          </div>
          <button
            onClick={() => setShowSetupModal(true)}
            className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5" />
            ตั้งค่า
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-xl text-xs leading-relaxed space-y-2">
            <div className="font-semibold text-red-800 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <span>แจ้งเตือนจากระบบเข้าสู่ระบบ:</span>
            </div>
            <p className="text-red-800 font-sans">{error}</p>
            <div className="pt-1">
              <button
                onClick={() => setShowSetupModal(true)}
                className="text-indigo-700 underline font-semibold hover:text-indigo-900 cursor-pointer"
              >
                คลิกดูวิธีตั้งค่า Firebase ให้ถูกต้อง
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-1">
          <button
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 border border-slate-300 rounded-xl shadow-sm bg-white hover:bg-slate-50 text-slate-800 font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none text-base"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.18 4.114-3.483 0-6.312-2.83-6.312-6.314s2.83-6.314 6.312-6.314c1.55 0 2.97.56 4.07 1.48l3.14-3.14C19.06 1.99 15.89 1 12.24 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.898 0 10.607-4.218 10.607-10.607 0-.486-.048-.96-.13-1.42H12.24z"
              />
            </svg>
            {loading ? "กำลังเปิดหน้าต่าง Google..." : "เข้าสู่ระบบด้วย Google Account"}
          </button>

          <button
            onClick={() => setShowSetupModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-xl font-medium transition-colors cursor-pointer"
          >
            <Key className="h-3.5 w-3.5 text-indigo-600" />
            วิธีเอาค่าคอนฟิกจาก Firebase มาใส่ Vercel (ขั้นตอนละเอียด)
          </button>
        </div>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            สิทธิ์ผู้ดูแลระบบสูงสุด (ADMIN): <span className="font-semibold text-slate-700">pousan888@gmail.com</span>
          </p>
        </div>
      </div>

      {/* Firebase Setup Instructions & Config Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    วิธีนำค่าจาก Firebase Console มาใส่ใน Vercel
                  </h3>
                  <p className="text-xs text-slate-500">
                    ขั้นตอนอย่างละเอียดสำหรับใช้งานจริงด้วยบัญชี Google ของคุณ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSetupModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed">
              {/* Step 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</span>
                  <h4>เข้าสู่ระบบ Firebase Console</h4>
                </div>
                <p className="text-xs text-slate-600 pl-8">
                  เปิดเว็บเบราว์เซอร์ไปที่{" "}
                  <a
                    href="https://console.firebase.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 underline font-medium inline-flex items-center gap-1"
                  >
                    console.firebase.google.com <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  แล้วกดเลือกโปรเจกต์ของคุณ (หรือกด Create a project หากยังไม่มี)
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
                  <h4>หาค่าคอนฟิก Web App ใน Project Settings</h4>
                </div>
                <div className="text-xs text-slate-600 pl-8 space-y-2">
                  <ol className="list-disc pl-4 space-y-1">
                    <li>กดที่ไอคอนรูปเฟือง ⚙️ ด้านบนซ้าย ข้างข้อความ "Project Overview"</li>
                    <li>เลือกเมนู <strong>Project settings (การตั้งค่าโปรเจกต์)</strong></li>
                    <li>เลื่อนลงมาด้านล่างสุด จะพบหัวข้อ <strong>"Your apps" (แอปของคุณ)</strong></li>
                    <li>
                      หากยังไม่มีแอป ให้คลิกไอคอนเว็บ <strong>&lt;/&gt;</strong> (Web app) ตั้งชื่อเล่นแอป แล้วกด Register app
                    </li>
                    <li>
                      คุณจะเห็นโค้ดที่มีหน้าตาแบบนี้:
                    </li>
                  </ol>
                  <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
                    <div>const firebaseConfig = &#123;</div>
                    <div className="pl-4 text-amber-300">apiKey: "AIzaSy...",</div>
                    <div className="pl-4 text-emerald-300">authDomain: "your-project.firebaseapp.com",</div>
                    <div className="pl-4 text-sky-300">projectId: "your-project",</div>
                    <div className="pl-4 text-indigo-300">storageBucket: "your-project.firebasestorage.app",</div>
                    <div className="pl-4 text-rose-300">messagingSenderId: "123456789",</div>
                    <div className="pl-4 text-purple-300">appId: "1:123456:web:..."</div>
                    <div>&#125;;</div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">3</span>
                  <h4>รายชื่อตัวแปรที่ต้องนำไปใส่ใน Vercel (กด Copy ได้ทันที)</h4>
                </div>
                <p className="text-xs text-slate-600 pl-8">
                  ไปที่ <strong>Vercel Dashboard &gt; เลือกโปรเจกต์ &gt; Settings &gt; Environment Variables</strong> แล้วเพิ่มตามตารางนี้:
                </p>
                <div className="pl-8">
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 font-semibold text-slate-700">
                        <tr>
                          <th className="p-2.5">ชื่อตัวแปรใน Vercel</th>
                          <th className="p-2.5">ค่าที่นำมาจาก Firebase</th>
                          <th className="p-2.5 text-center">คัดลอกชื่อ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                        {[
                          { env: "VITE_FIREBASE_API_KEY", desc: "apiKey" },
                          { env: "VITE_FIREBASE_AUTH_DOMAIN", desc: "authDomain" },
                          { env: "VITE_FIREBASE_PROJECT_ID", desc: "projectId" },
                          { env: "VITE_FIREBASE_STORAGE_BUCKET", desc: "storageBucket" },
                          { env: "VITE_FIREBASE_MESSAGING_SENDER_ID", desc: "messagingSenderId" },
                          { env: "VITE_FIREBASE_APP_ID", desc: "appId" }
                        ].map((item) => (
                          <tr key={item.env} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-indigo-700">{item.env}</td>
                            <td className="p-2.5 text-slate-600 font-sans text-xs">{item.desc}</td>
                            <td className="p-2.5 text-center font-sans">
                              <button
                                onClick={() => handleCopy(item.env, item.env)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md inline-flex items-center gap-1 text-[11px] transition-colors"
                              >
                                {copiedKey === item.env ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    <span className="text-emerald-600 font-medium">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    คัดลอก
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">4</span>
                  <h4>เปิดใช้งาน Google Sign-In และเพิ่ม Authorized Domain</h4>
                </div>
                <div className="text-xs text-slate-600 pl-8 space-y-2">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                    <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-amber-600" />
                      สำคัญมาก: มิฉะนั้น Google Sign-In จะขึ้นว่า Unauthorized Domain!
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 text-amber-900">
                      <li>
                        ใน Firebase Console ไปที่เมนู <strong>Build &gt; Authentication &gt; Sign-in method</strong>
                      </li>
                      <li>คลิกที่ <strong>Google</strong> แล้วกดเปิดสวิตช์ <strong>Enable</strong> จากนั้นเลือก Support email แล้วกด Save</li>
                      <li>
                        คลิกแท็บ <strong>Settings</strong> ด้านบนของหน้า Authentication
                      </li>
                      <li>
                        เลื่อนลงมาที่หัวข้อ <strong>Authorized domains</strong> แล้วกด <strong>Add domain</strong>
                      </li>
                      <li>
                        ใส่โดเมนของ Vercel ของคุณ (เช่น: <code className="bg-white px-1.5 py-0.5 rounded border border-amber-300 font-bold">{currentHostname || "your-app.vercel.app"}</code>)
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">5</span>
                  <h4>Redeploy บน Vercel</h4>
                </div>
                <p className="text-xs text-slate-600 pl-8">
                  หลังจากเพิ่มตัวแปรใน Vercel ครบ 6 ตัวแล้ว ให้ไปที่แท็บ <strong>Deployments</strong> ใน Vercel แล้วกด <strong>Redeploy</strong> (หรือ Push โค้ดใหม่) เพื่อให้ Vite นำตัวแปรไปคอมไพล์ใช้งานจริงทันที!
                </p>
              </div>

              {/* Optional Quick Test form */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Key className="h-4 w-4 text-indigo-600" />
                    ทางเลือกลัด: วางโค้ด Firebase Config เพื่อทดสอบบนเครื่องนี้ทันที
                  </h4>
                  {currentConfigInfo.source === "custom" && (
                    <button
                      onClick={clearInAppFirebaseConfig}
                      className="text-xs text-red-600 hover:underline"
                    >
                      ล้างค่าคอนฟิกที่บันทึกไว้
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  สามารถคัดลอกบล็อก <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">&#123; "apiKey": "...", ... &#125;</code> จาก Firebase Console มาวางด้านล่างเพื่อบันทึกและเชื่อมต่อได้ทันทีโดยไม่ต้องรอ Deploy:
                </p>
                <form onSubmit={handleApplyJsonConfig} className="space-y-2">
                  <textarea
                    rows={4}
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='{"apiKey": "AIzaSy...", "authDomain": "...", "projectId": "...", "storageBucket": "...", "messagingSenderId": "...", "appId": "..."}'
                    className="w-full text-xs font-mono p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      บันทึกและเชื่อมต่อ Firebase ทันที
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end rounded-b-2xl">
              <button
                onClick={() => setShowSetupModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                เข้าใจแล้ว / ปิดหน้าต่างนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

