import React, { useState, useEffect } from "react";
import { UserProfile, UserRole, Consumable } from "./types";
import Header from "./components/Header";
import LoginScreen from "./components/LoginScreen";
import AdminDashboard from "./components/AdminDashboard";
import HelperCountView from "./components/HelperCountView";
import QCConsumeView from "./components/QCConsumeView";
import { seedDatabaseIfEmpty, getConsumables } from "./lib/dbService";
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
        const savedUser = localStorage.getItem("cabinet_tracker_user");
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }

        // 3. Check for QR code URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const cabId = urlParams.get("cabinetId");
        if (cabId) {
          setCabinetParam(cabId);
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
        const lowQty = items.filter(i => i.currentQty <= i.minThreshold).length;
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
    localStorage.setItem("cabinet_tracker_user", JSON.stringify(profile));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    }
    setUser(null);
    localStorage.removeItem("cabinet_tracker_user");
    // Clean up query param on logout
    const url = new URL(window.location.href);
    url.searchParams.delete("cabinetId");
    window.history.pushState({}, "", url.toString());
    setCabinetParam(null);
  };

  const handleChangeRole = (newRole: UserRole) => {
    if (!user) return;
    const updated = { ...user, role: newRole };
    setUser(updated);
    localStorage.setItem("cabinet_tracker_user", JSON.stringify(updated));
  };

  const handleBackToMenu = () => {
    setCabinetParam(null);
    // Clean up browser URL
    const url = new URL(window.location.href);
    url.searchParams.delete("cabinetId");
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

  // A. QR Redirect Routing: If cabinetId is present in URL (scanned cabinet)
  // We immediately bypass default dashboards and show the mobile counting screen!
  if (cabinetParam) {
    return (
      <div className="bg-slate-50 min-h-screen">
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
          onBackToMainMenu={handleBackToMenu} 
        />
      </div>
    );
  }

  // B. Default Role-based view routers
  return (
    <div className="bg-slate-50 min-h-screen font-sans flex flex-col pb-16">
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
      </main>

      {/* QUICK ACCESS TESTING BAR - RESERVED FOR SUPER ADMIN & SIMULATION */}
      {(user.isSuperAdmin || user.email.toLowerCase() === "pousan888@gmail.com" || user.isSimulation) && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2.5 px-4 z-40 shadow-lg">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 font-medium">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <span>โหมดทดสอบสิทธิ์ (เฉพาะผู้ดูแลระบบสูงสุด): สลับดูหน้าจอของแต่ละบทบาทได้ทันที</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleChangeRole("ADMIN")}
                className={`px-3 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                  user.role === "ADMIN" 
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                หน้า Admin
              </button>
              <button
                onClick={() => handleChangeRole("HELPER")}
                className={`px-3 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                  user.role === "HELPER" 
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                ทีมนับของ (Helper)
              </button>
              <button
                onClick={() => handleChangeRole("QC")}
                className={`px-3 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                  user.role === "QC" 
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                QC เบิกของใช้
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
