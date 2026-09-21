import React, { useState, useEffect } from "react";
import { UserProfile, UserRole, Consumable } from "./types";
import Header from "./components/Header";
import LoginScreen from "./components/LoginScreen";
import AdminDashboard from "./components/AdminDashboard";
import HelperCountView from "./components/HelperCountView";
import QCConsumeView from "./components/QCConsumeView";
import ViewerDashboard from "./components/ViewerDashboard";
import { seedDatabaseIfEmpty, getConsumables } from "./lib/dbService";
import { isItemLowStock } from "./lib/stockUtils";
import { auth, signOut } from "./lib/firebase";
import { 
  Package, 
  Shield, 
  ClipboardList, 
  QrCode, 
  Sparkles, 
  Loader2, 
  UsersRound, 
  TrendingUp, 
  LogOut 
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [cabinetParam, setCabinetParam] = useState<string | null>(null);
  const [modeParam, setModeParam] = useState<"count" | "withdraw">("count");
  const [isTestingBarOpen, setIsTestingBarOpen] = useState(false);

  // Auto-seed database and restore session on startup
  useEffect(() => {
    let active = true;
    
    // Safety timeout: If initialization takes too long (e.g. 3.5 seconds), proceed to the screen anyway
    const safetyTimeout = setTimeout(() => {
      if (active) {
        console.warn("Database initialization taking longer than expected. Proceeding to main screen...");
        setLoading(false);
      }
    }, 3500);

    async function initializeApp() {
      try {
        // 1. Seed database with rich mock data if empty
        await seedDatabaseIfEmpty();

        if (!active) return;

        // 2. Load and restore session if present
        try {
          const savedUser = localStorage.getItem("cabinet_tracker_user");
          if (savedUser) {
            setUser(JSON.parse(savedUser));
          }
        } catch (e) {
          console.warn("Could not read saved user session:", e);
        }

        // 3. Check for QR code URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const cabId = urlParams.get("cabinetId");
        const mode = urlParams.get("mode") as "count" | "withdraw" | null;
        if (cabId) {
          setCabinetParam(cabId);
          if (mode === "withdraw" || mode === "count") {
            setModeParam(mode);
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        if (active) {
          clearTimeout(safetyTimeout);
          setLoading(false);
        }
      }
    }
    initializeApp();

    return () => {
      active = false;
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Fetch critical safety stock warnings in real-time
  useEffect(() => {
    async function checkLowStock() {
      try {
        const items = await getConsumables();
        const lowQty = items.filter(i => isItemLowStock(i)).length;
        setLowStockCount(lowQty);
      } catch (err) {
        console.error("Failed to check low stock items:", err);
      }
    }
    
    // Check initially and poll every 30 seconds to keep counts in header accurate
    checkLowStock();
    const interval = setInterval(checkLowStock, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogin = (profile: UserProfile) => {
    setUser(profile);
    try {
      localStorage.setItem("cabinet_tracker_user", JSON.stringify(profile));
    } catch (e) {
      console.warn("Could not write session to localStorage:", e);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    }
    setUser(null);
    try {
      localStorage.removeItem("cabinet_tracker_user");
    } catch (e) {
      console.warn("Could not remove session from localStorage:", e);
    }
    // Clean up query param on logout
    const url = new URL(window.location.href);
    url.searchParams.delete("cabinetId");
    url.searchParams.delete("mode");
    window.history.pushState({}, "", url.toString());
    setCabinetParam(null);
  };

  const handleChangeRole = (newRole: UserRole) => {
    if (!user) return;
    const updated = { ...user, role: newRole };
    setUser(updated);
    try {
      localStorage.setItem("cabinet_tracker_user", JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not update role in localStorage:", e);
    }
  };

  const handleBackToMenu = () => {
    setCabinetParam(null);
    // Clean up browser URL
    const url = new URL(window.location.href);
    url.searchParams.delete("cabinetId");
    url.searchParams.delete("mode");
    window.history.pushState({}, "", url.toString());
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500 animate-pulse">กำลังตั้งค่าฐานข้อมูลระบบและซิงค์คลาวด์...</p>
      </div>
    );
  }

  // Not signed in -> render the beautiful Login Form
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // SIGNED IN -> render based on current state & role

  // Background Ambient Fluid Glass Blobs
  const ambientBackground = (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] bg-indigo-400/18 rounded-full blur-[100px] animate-ambient-float" />
      <div className="absolute top-1/4 -right-32 w-[32rem] h-[32rem] bg-sky-400/18 rounded-full blur-[110px] animate-ambient-float" style={{ animationDelay: "-4s" }} />
      <div className="absolute -bottom-32 left-1/3 w-[36rem] h-[36rem] bg-violet-400/14 rounded-full blur-[120px] animate-ambient-float" style={{ animationDelay: "-8s" }} />
      <div className="absolute top-2/3 -left-20 w-[24rem] h-[24rem] bg-rose-400/10 rounded-full blur-[90px]" />
    </div>
  );

  // A. QR Redirect Routing: If cabinetId is present in URL (scanned cabinet)
  // We immediately bypass default dashboards and show the mobile counting / withdrawing screen!
  if (cabinetParam) {
    return (
      <div className="relative min-h-screen text-slate-900 selection:bg-indigo-500/20">
        {ambientBackground}
        <div className="relative z-10">
          <Header 
            user={user} 
            onChangeRole={handleChangeRole} 
            onLogout={handleLogout} 
            lowStockCount={lowStockCount} 
          />
          <HelperCountView 
            userEmail={user.email} 
            userName={user.name} 
            selectedCabinetId={cabinetParam} 
            initialMode={modeParam}
            onBackToMainMenu={handleBackToMenu} 
          />
        </div>
      </div>
    );
  }

  // B. Default Role-based view routers
  return (
    <div className="relative min-h-screen font-sans flex flex-col pb-8 text-slate-900 selection:bg-indigo-500/20">
      {ambientBackground}

      <div className="relative z-10 flex flex-col flex-grow">
        <Header 
          user={user} 
          onChangeRole={handleChangeRole} 
          onLogout={handleLogout} 
          lowStockCount={lowStockCount} 
        />

        <main className="flex-grow">
          {user.role === "ADMIN" && (
            <AdminDashboard 
              userEmail={user.email} 
              isSuperAdmin={user.isSuperAdmin || user.email.toLowerCase() === "pousan888@gmail.com"} 
            />
          )}
          {user.role === "HELPER" && (
            <HelperCountView 
              userEmail={user.email} 
              userName={user.name} 
              onBackToMainMenu={handleBackToMenu}
            />
          )}
          {user.role === "QC" && (
            <QCConsumeView 
              userEmail={user.email} 
              userName={user.name} 
              onBackToMainMenu={handleBackToMenu}
            />
          )}
          {user.role === "VIEWER" && (
            <ViewerDashboard 
              userEmail={user.email} 
              userName={user.name} 
            />
          )}
        </main>
      </div>

      {/* QUICK ACCESS TESTING BAR - FLOATING AND COLLAPSIBLE IN IOS LIQUID GLASS PILL */}
      {(user.isSuperAdmin || user.email.toLowerCase() === "pousan888@gmail.com" || user.isSimulation) && (
        <aside className="fixed bottom-4 right-4 z-40">
          {!isTestingBarOpen ? (
            <button
              onClick={() => setIsTestingBarOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full shadow-xl shadow-slate-900/20 backdrop-blur-2xl text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 border border-white/20"
              title="เปิดเมนูสลับสิทธิ์ทดสอบ"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>สลับสิทธิ์</span>
              <span className="px-2 py-0.5 bg-indigo-500/80 backdrop-blur-xs text-[10px] rounded-full uppercase tracking-wider font-extrabold border border-white/20">
                {user.role}
              </span>
            </button>
          ) : (
            <div className="ios-glass-card rounded-3xl p-4 shadow-2xl space-y-3 max-w-xs animate-scale-up border border-white/90">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <div className="p-1 rounded-lg bg-amber-100 text-amber-600">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <span>สลับดูหน้าจอ (Super Admin)</span>
                </div>
                <button
                  onClick={() => setIsTestingBarOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    handleChangeRole("ADMIN");
                    setIsTestingBarOpen(false);
                  }}
                  className={`py-2 px-2.5 rounded-2xl text-center font-bold text-xs border transition-all cursor-pointer ios-press ${
                    user.role === "ADMIN" 
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20" 
                      : "ios-glass text-slate-700 hover:bg-white/90"
                  }`}
                >
                  🛡️ Admin
                </button>
                <button
                  onClick={() => {
                    handleChangeRole("HELPER");
                    setIsTestingBarOpen(false);
                  }}
                  className={`py-2 px-2.5 rounded-2xl text-center font-bold text-xs border transition-all cursor-pointer ios-press ${
                    user.role === "HELPER" 
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20" 
                      : "ios-glass text-slate-700 hover:bg-white/90"
                  }`}
                >
                  📋 Helper
                </button>
                <button
                  onClick={() => {
                    handleChangeRole("QC");
                    setIsTestingBarOpen(false);
                  }}
                  className={`py-2 px-2.5 rounded-2xl text-center font-bold text-xs border transition-all cursor-pointer ios-press ${
                    user.role === "QC" 
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20" 
                      : "ios-glass text-slate-700 hover:bg-white/90"
                  }`}
                >
                  🔬 QC
                </button>
                <button
                  onClick={() => {
                    handleChangeRole("VIEWER");
                    setIsTestingBarOpen(false);
                  }}
                  className={`py-2 px-2.5 rounded-2xl text-center font-bold text-xs border transition-all cursor-pointer ios-press ${
                    user.role === "VIEWER" 
                      ? "bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/20" 
                      : "ios-glass text-slate-700 hover:bg-white/90"
                  }`}
                >
                  👁️ Viewer
                </button>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
