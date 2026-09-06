import React, { useState, useEffect } from "react";
import { Cabinet, Consumable, CountHistory, QCConsumptionHistory } from "../types";
import { 
  getCabinets, 
  getConsumables, 
  addCabinet, 
  updateCabinet, 
  deleteCabinet,
  addConsumable, 
  updateConsumable, 
  deleteConsumable,
  getCountHistory,
  getQCConsumptionHistory,
  getCloudSyncNotice,
  CABINET_PRESETS,
  CONSUMABLE_PRESETS
} from "../lib/dbService";
import { 
  Plus, 
  Edit, 
  Trash, 
  QrCode, 
  AlertTriangle, 
  Package, 
  History, 
  Activity, 
  Settings, 
  MapPin, 
  Check, 
  Search, 
  TrendingDown, 
  Clock, 
  FolderSync, 
  Eye, 
  Sparkles,
  Loader2,
  Printer,
  Copy,
  CheckCircle2,
  X
} from "lucide-react";

interface AdminDashboardProps {
  userEmail: string;
}

export default function AdminDashboard({ userEmail }: AdminDashboardProps) {
  // Database States
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [countLogs, setCountLogs] = useState<CountHistory[]>([]);
  const [qcLogs, setQcLogs] = useState<QCConsumptionHistory[]>([]);
  
  // Loading & View States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"cabinets" | "consumables" | "history" | "qc">("cabinets");
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Cabinet Modals / Form
  const [showCabinetModal, setShowCabinetModal] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<Cabinet | null>(null);
  const [cabinetForm, setCabinetForm] = useState({
    name: "",
    location: "",
    departments: [] as string[],
    photoUrl: CABINET_PRESETS[0]
  });
  const [isSavingCabinet, setIsSavingCabinet] = useState(false);
  const [cabinetError, setCabinetError] = useState<string | null>(null);

  // Consumable Modals / Form
  const [showConsumableModal, setShowConsumableModal] = useState(false);
  const [selectedCabinetId, setSelectedCabinetId] = useState<string>("");
  const [editingConsumable, setEditingConsumable] = useState<Consumable | null>(null);
  const [consumableForm, setConsumableForm] = useState({
    name: "",
    department: "Production",
    currentQty: 10,
    minThreshold: 5,
    unit: "ชิ้น",
    imageUrl: CONSUMABLE_PRESETS["glove"]
  });
  const [isSavingConsumable, setIsSavingConsumable] = useState(false);
  const [consumableError, setConsumableError] = useState<string | null>(null);

  // Notifications & UI Helpers
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dismissCloudNotice, setDismissCloudNotice] = useState(false);
  const [copiedRule, setCopiedRule] = useState(false);

  // QR Code Modal
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCabinet, setQrCabinet] = useState<Cabinet | null>(null);

  // History detail drawer
  const [selectedLog, setSelectedLog] = useState<CountHistory | null>(null);

  // Departments List
  const FACTORY_DEPARTMENTS = ["Production", "QC", "Maintenance", "Warehouse", "Office"];

  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      try {
        const cabs = await getCabinets();
        setCabinets(cabs);

        const items = await getConsumables();
        setConsumables(items);

        const histories = await getCountHistory();
        setCountLogs(histories);

        const qcHistories = await getQCConsumptionHistory();
        setQcLogs(qcHistories);
      } catch (err) {
        console.error("Error loading admin dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, [refreshTrigger]);

  const triggerRefresh = () => setRefreshTrigger(p => p + 1);

  // Critical items check
  const criticalItems = consumables.filter(item => item.currentQty <= item.minThreshold);

  // Cabinet submit
  const handleCabinetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCabinetError(null);

    const trimmedName = cabinetForm.name.trim();
    const trimmedLocation = cabinetForm.location.trim();

    if (!trimmedName) {
      setCabinetError("กรุณาระบุชื่อตู้เก็บของ");
      return;
    }
    if (!trimmedLocation) {
      setCabinetError("กรุณาระบุสถานที่ตั้งตู้เก็บของ");
      return;
    }
    if (cabinetForm.departments.length === 0) {
      setCabinetError("กรุณาเลือกอย่างน้อย 1 แผนกที่ดูแลหรือใช้งานตู้นี้");
      return;
    }

    setIsSavingCabinet(true);
    try {
      const payload = {
        name: trimmedName,
        location: trimmedLocation,
        departments: cabinetForm.departments,
        photoUrl: cabinetForm.photoUrl || CABINET_PRESETS[0]
      };

      if (editingCabinet) {
        await updateCabinet(editingCabinet.id, payload);
        setToastMessage("อัปเดตข้อมูลตู้เก็บของเรียบร้อย");
      } else {
        await addCabinet(payload);
        setToastMessage("เพิ่มตู้เก็บของใหม่สำเร็จเรียบร้อย!");
      }

      setShowCabinetModal(false);
      setEditingCabinet(null);
      setCabinetForm({ name: "", location: "", departments: [], photoUrl: CABINET_PRESETS[0] });
      setCabinetError(null);
      triggerRefresh();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Error saving cabinet:", err);
      setCabinetError(err?.message || "เกิดข้อผิดพลาดในการบันทึกตู้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSavingCabinet(false);
    }
  };

  const handleEditCabinet = (cab: Cabinet) => {
    setEditingCabinet(cab);
    setCabinetForm({
      name: cab.name,
      location: cab.location,
      departments: cab.departments,
      photoUrl: cab.photoUrl
    });
    setCabinetError(null);
    setShowCabinetModal(true);
  };

  const handleDeleteCabinet = async (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ที่จะลบตู้นี้? การลบตู้จะทำให้วัสดุสิ้นเปลืองทั้งหมดในตู้นี้ถูกลบไปด้วย และไม่สามารถกู้คืนได้")) {
      try {
        await deleteCabinet(id);
        setToastMessage("ลบตู้เก็บของและรายการพัสดุในตู้เรียบร้อย");
        triggerRefresh();
        setTimeout(() => setToastMessage(null), 4000);
      } catch (err) {
        console.error("Error deleting cabinet:", err);
      }
    }
  };

  // Consumable submit
  const handleConsumableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsumableError(null);

    const trimmedName = consumableForm.name.trim();
    if (!trimmedName) {
      setConsumableError("กรุณาระบุชื่อวัสดุสิ้นเปลือง");
      return;
    }
    if (!selectedCabinetId) {
      setConsumableError("กรุณาเลือกตู้เก็บพัสดุ");
      return;
    }

    setIsSavingConsumable(true);
    try {
      const payload = {
        ...consumableForm,
        name: trimmedName,
        cabinetId: selectedCabinetId,
        lastUpdatedBy: userEmail
      };

      if (editingConsumable) {
        await updateConsumable(editingConsumable.id, payload);
        setToastMessage("อัปเดตข้อมูลวัสดุสิ้นเปลืองเรียบร้อย");
      } else {
        await addConsumable(payload);
        setToastMessage("เพิ่มวัสดุสิ้นเปลืองลงในตู้สำเร็จเรียบร้อย!");
      }

      setShowConsumableModal(false);
      setEditingConsumable(null);
      setConsumableForm({
        name: "",
        department: "Production",
        currentQty: 10,
        minThreshold: 5,
        unit: "ชิ้น",
        imageUrl: CONSUMABLE_PRESETS["glove"]
      });
      setConsumableError(null);
      triggerRefresh();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Error saving consumable:", err);
      setConsumableError(err?.message || "เกิดข้อผิดพลาดในการบันทึกพัสดุ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSavingConsumable(false);
    }
  };

  const handleEditConsumable = (item: Consumable) => {
    setEditingConsumable(item);
    setSelectedCabinetId(item.cabinetId);
    setConsumableForm({
      name: item.name,
      department: item.department,
      currentQty: item.currentQty,
      minThreshold: item.minThreshold,
      unit: item.unit,
      imageUrl: item.imageUrl
    });
    setShowConsumableModal(true);
  };

  const handleDeleteConsumable = async (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ที่จะลบรายการวัสดุสิ้นเปลืองนี้?")) {
      try {
        await deleteConsumable(id);
        triggerRefresh();
      } catch (err) {
        console.error("Error deleting consumable:", err);
      }
    }
  };

  const handleQuickRestock = async (item: Consumable) => {
    try {
      const restockAmt = 15; // default quick restock
      await updateConsumable(item.id, {
        currentQty: item.currentQty + restockAmt,
        lastUpdatedBy: userEmail
      });
      triggerRefresh();
    } catch (err) {
      console.error("Error doing quick restock:", err);
    }
  };

  // Generate helper QR Code URL
  const getQRUrl = (cabId: string) => {
    return `${window.location.origin}${window.location.pathname}?cabinetId=${cabId}`;
  };

  const getQRImageSrc = (cabId: string) => {
    const url = getQRUrl(cabId);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
  };

  const getCabinetName = (id: string) => {
    const cab = cabinets.find(c => c.id === id);
    return cab ? cab.name : "ไม่ระบุตู้";
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-slate-50">
        <Loader2 className="h-8 w-8 text-indigo-650 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500">กำลังดึงข้อมูลแผงควบคุมแอดมิน...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans bg-slate-50 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Admin Terminal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight font-display">
            แดชบอร์ดตรวจสอบสต็อกส่วนกลาง
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            ยินดีต้อนรับแอดมิน ({userEmail}) จัดการโครงสร้างตู้เก็บของ, ออก QR Code, และตรวจสอบประวัติการเช็กสต็อกเปรียบเทียบรอบที่แล้ว
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => {
              setEditingCabinet(null);
              setCabinetForm({ name: "", location: "", departments: [], photoUrl: CABINET_PRESETS[0] });
              setShowCabinetModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md shadow-slate-900/10 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            เพิ่มตู้เก็บพัสดุใหม่
          </button>
          <button
            onClick={() => {
              setEditingConsumable(null);
              setConsumableForm({
                name: "",
                department: "Production",
                currentQty: 10,
                minThreshold: 5,
                unit: "ชิ้น",
                imageUrl: CONSUMABLE_PRESETS["glove"]
              });
              if (cabinets.length > 0) setSelectedCabinetId(cabinets[0].id);
              setShowConsumableModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/10 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            เพิ่มวัสดุสิ้นเปลือง
          </button>
        </div>
      </div>

      {/* CLOUD FIRESTORE RULES NOTICE BANNER */}
      {getCloudSyncNotice().hasError && !dismissCloudNotice && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs animate-fade-in shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-sm mb-1">
                ระบบเปิดใช้งาน Local-First Storage สำเร็จ: ข้อมูลของคุณถูกบันทึกอย่างปลอดภัยในเครื่อง
              </p>
              <p className="text-amber-800 leading-relaxed max-w-3xl">
                {getCloudSyncNotice().code === "permission-denied" ? (
                  <>
                    Cloud Firestore ปฏิเสธการเข้าถึง (Permission Denied) เนื่องจากยังไม่ได้ตั้งค่าสิทธิ์ใน Firebase Console 
                    แต่ระบบได้บันทึกตู้และพัสดุทั้งหมดของคุณไว้ในเครื่องให้ทันที สามารถใช้งาน สร้างตู้ และเช็กสต็อกได้ตามปกติ! 
                    หากต้องการเปิดให้พนักงานเครื่องอื่นมองเห็นข้อมูลร่วมกันบนคลาวด์ ให้ไปที่ <b>Firebase Console &gt; Firestore Database &gt; Rules</b>
                  </>
                ) : (
                  getCloudSyncNotice().message || "กำลังทำงานด้วย Local-First Database อย่างราบรื่น"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              onClick={() => {
                const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`;
                navigator.clipboard.writeText(rules);
                setCopiedRule(true);
                setTimeout(() => setCopiedRule(false), 3000);
              }}
              className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedRule ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                  <span>คัดลอก Rules แล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>คัดลอก Firestore Rules</span>
                </>
              )}
            </button>
            <button
              onClick={() => setDismissCloudNotice(true)}
              className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-xl transition-colors cursor-pointer"
              title="ปิดการแจ้งเตือน"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-100 hover:border-indigo-100 transition-colors flex items-center gap-4">
          <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">ตู้เก็บพัสดุรวม</span>
            <span className="text-xl sm:text-2xl font-black text-slate-950">{cabinets.length} ตู้</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-100 hover:border-indigo-100 transition-colors flex items-center gap-4">
          <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">วัสดุสิ้นเปลืองรวม</span>
            <span className="text-xl sm:text-2xl font-black text-slate-950">{consumables.length} รายการ</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-100 hover:border-indigo-100 transition-colors flex items-center gap-4">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
            criticalItems.length > 0 ? "bg-rose-50 text-rose-600 animate-pulse" : "bg-emerald-50 text-emerald-600"
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">ของเหลือน้อยวิกฤต</span>
            <span className={`text-xl sm:text-2xl font-black ${
              criticalItems.length > 0 ? "text-rose-600" : "text-emerald-700"
            }`}>{criticalItems.length} ชนิด</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-100 hover:border-indigo-100 transition-colors flex items-center gap-4">
          <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">เช็กของล่าสุด</span>
            <span className="text-sm sm:text-base font-bold text-slate-800 block truncate max-w-[150px]">
              {countLogs.length > 0 
                ? new Date(countLogs[0].checkedAt?.toDate?.() || countLogs[0].checkedAt).toLocaleDateString("th-TH")
                : "ยังไม่มีการเช็ก"
              }
            </span>
          </div>
        </div>
      </div>

      {/* CRITICAL ALERTS PANEL */}
      {criticalItems.length > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-500 rounded-r-2xl p-5 mb-8 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <h2 className="text-sm sm:text-base font-extrabold text-rose-950">
              แจ้งเตือนสต็อกวิกฤต! มีวัสดุสิ้นเปลืองใกล้จะหมด ควรรีบสั่งใหม่ ({criticalItems.length} รายการ)
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {criticalItems.map(item => (
              <div key={item.id} className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[8px] bg-slate-100 text-slate-600 font-bold px-1 rounded uppercase">
                      {item.department}
                    </span>
                    <span className="text-[8px] bg-rose-50 text-rose-600 font-semibold px-1 rounded truncate max-w-[100px]">
                      {getCabinetName(item.cabinetId)}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs truncate">{item.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    คงเหลือ <span className="text-rose-600 font-black">{item.currentQty}</span> / เกณฑ์ความปลอดภัย {item.minThreshold} {item.unit}
                  </p>
                </div>
                
                <button
                  onClick={() => handleQuickRestock(item)}
                  className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg shrink-0 cursor-pointer active:scale-95 transition-all"
                  title="คลิกเพื่อสั่งพัสดุเข้ามาเติม +15 กล่อง/ชิ้น"
                >
                  เติมด่วน +15
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB SYSTEM */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab("cabinets")}
            className={`pb-4 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "cabinets"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <QrCode className="h-4 w-4" />
            ตู้เก็บพัสดุและการ์ด QR
          </button>
          
          <button
            onClick={() => setActiveTab("consumables")}
            className={`pb-4 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "consumables"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Package className="h-4 w-4" />
            พัสดุวัสดุสิ้นเปลืองทั้งหมด
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`pb-4 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "history"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="h-4 w-4" />
            ประวัติการเช็กตรวจนับ
          </button>

          <button
            onClick={() => setActiveTab("qc")}
            className={`pb-4 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "qc"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Activity className="h-4 w-4" />
            ประวัติ QC หยิบใช้ของ
          </button>
        </nav>
      </div>

      {/* SEARCH/SEARCH CONTROLS */}
      {activeTab !== "history" && activeTab !== "qc" && (
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === "cabinets" ? "ค้นหาชื่อตู้, ตำแหน่ง..." : "ค้นหาวัสดุสิ้นเปลือง..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs transition-all"
          />
        </div>
      )}

      {/* TAB PANELS */}
      
      {/* 1. CABINETS TAB */}
      {activeTab === "cabinets" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cabinets.length === 0 ? (
            <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              ยังไม่มีตู้เก็บของในระบบ กรุณาคลิก "เพิ่มตู้เก็บพัสดุใหม่" เพื่อเริ่มต้น
            </div>
          ) : (
            cabinets
              .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.location.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(cabinet => {
                // Count items inside this cabinet
                const cabinetItems = consumables.filter(item => item.cabinetId === cabinet.id);
                const lowItemsCount = cabinetItems.filter(item => item.currentQty <= item.minThreshold).length;

                return (
                  <div key={cabinet.id} className="bg-white rounded-2xl overflow-hidden border-2 border-slate-100 hover:border-indigo-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                    <div>
                      {/* Photo Header */}
                      <div className="relative h-40 bg-slate-100">
                        <img 
                          src={cabinet.photoUrl} 
                          alt={cabinet.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                          {cabinet.departments.map(d => (
                            <span key={d} className="bg-indigo-600/90 text-white font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                              {d}
                            </span>
                          ))}
                        </div>
                        {lowItemsCount > 0 && (
                          <div className="absolute top-3 right-3 bg-rose-600 text-white font-bold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-md animate-bounce">
                            <AlertTriangle className="h-2 w-2" />
                            วิกฤต {lowItemsCount}
                          </div>
                        )}
                      </div>

                      {/* Info body */}
                      <div className="p-5">
                        <h3 className="font-extrabold text-slate-900 text-base leading-snug mb-1">
                          {cabinet.name}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 font-semibold mb-4">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {cabinet.location}
                        </p>

                        {/* Items preview */}
                        <div className="space-y-1.5 border-t border-slate-50 pt-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">สิ่งของในตู้นี้ ({cabinetItems.length} ชนิด):</span>
                          {cabinetItems.length === 0 ? (
                            <span className="text-xs text-slate-400 block italic">ตู้ยังว่างเปล่า ไม่มีสินค้าถูกจัดสรร</span>
                          ) : (
                            cabinetItems.slice(0, 3).map(item => (
                              <div key={item.id} className="flex justify-between text-xs font-semibold text-slate-600">
                                <span className="truncate max-w-[170px]">{item.name}</span>
                                <span className={item.currentQty <= item.minThreshold ? "text-rose-600 font-bold" : "text-slate-800"}>
                                  {item.currentQty} {item.unit}
                                </span>
                              </div>
                            ))
                          )}
                          {cabinetItems.length > 3 && (
                            <span className="text-[10px] text-indigo-600 font-bold block pt-1 cursor-pointer hover:underline" onClick={() => { setActiveTab("consumables"); setSearchTerm(cabinet.name); }}>
                              ดูวัสดุสิ้นเปลืองอีก {cabinetItems.length - 3} ชนิด เพิ่มเติม...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Operations */}
                    <div className="bg-slate-50 border-t border-slate-100 p-3.5 flex items-center justify-between gap-1">
                      <button
                        onClick={() => {
                          setQrCabinet(cabinet);
                          setShowQRModal(true);
                        }}
                        className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-2 rounded-lg cursor-pointer transition-all"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        พิมพ์ QR ตู้
                      </button>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleEditCabinet(cabinet)}
                          className="p-2 bg-white text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-all"
                          title="แก้ไขรายละเอียดตู้"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCabinet(cabinet.id)}
                          className="p-2 bg-white text-rose-500 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-lg cursor-pointer transition-all"
                          title="ลบตู้เก็บของ"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* 2. CONSUMABLES TAB */}
      {activeTab === "consumables" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6">รูปภาพ & ชื่อวัสดุสิ้นเปลือง</th>
                  <th className="py-4 px-6">ตำแหน่งจัดเก็บ (ตู้เก็บของ)</th>
                  <th className="py-4 px-6">แผนก / เจ้าของพัสดุ</th>
                  <th className="py-4 px-6 text-center">คงเหลือปัจจุบัน</th>
                  <th className="py-4 px-6 text-center">เกณฑ์ความปลอดภัย</th>
                  <th className="py-4 px-6 text-center">สถานะ</th>
                  <th className="py-4 px-6 text-right">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {consumables.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      ยังไม่มีวัสดุสิ้นเปลืองในระบบ กรุณาเพิ่มที่ปุ่มด้านบน
                    </td>
                  </tr>
                ) : (
                  consumables
                    .filter(item => 
                      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      getCabinetName(item.cabinetId).toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.department.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(item => {
                      const isLow = item.currentQty <= item.minThreshold;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 font-semibold">
                            <div className="flex items-center gap-3">
                              <img 
                                src={item.imageUrl} 
                                alt={item.name} 
                                className="h-10 w-10 rounded-lg object-cover border border-slate-100 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <span className="font-bold text-slate-900 block leading-tight">{item.name}</span>
                                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">ID: {item.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-semibold text-slate-700 block">{getCabinetName(item.cabinetId)}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="bg-slate-100 border border-slate-200/50 text-slate-600 font-bold text-[9px] px-2 py-0.5 rounded uppercase">
                              {item.department}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={`font-black text-sm ${isLow ? "text-rose-600" : "text-slate-800"}`}>
                              {item.currentQty} {item.unit}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center font-bold text-slate-500">
                            {item.minThreshold} {item.unit}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {isLow ? (
                              <span className="bg-rose-50 border border-rose-100 text-rose-700 font-bold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                <span className="h-1 w-1 bg-rose-600 rounded-full"></span>
                                ของใกล้หมด
                              </span>
                            ) : (
                              <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                <span className="h-1 w-1 bg-emerald-600 rounded-full"></span>
                                สต็อกปลอดภัย
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleEditConsumable(item)}
                                className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 rounded-lg cursor-pointer transition-all"
                                title="แก้ไขพัสดุ"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteConsumable(item.id)}
                                className="p-1.5 bg-white border border-slate-200 text-rose-500 hover:text-rose-700 hover:border-rose-200 rounded-lg cursor-pointer transition-all"
                                title="ลบวัสดุพัสดุ"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. HISTORY TAB */}
      {activeTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* History list (Left part) */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-400" />
              รายงานนับสต็อกแต่ละรอบ
            </h3>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {countLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  ยังไม่เคยมีบันทึกการเช็กของจากทีมงาน
                </div>
              ) : (
                countLogs.map(log => {
                  const dateStr = new Date(log.checkedAt?.toDate?.() || log.checkedAt).toLocaleString("th-TH", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                  });
                  const isSelected = selectedLog?.id === log.id;

                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? "bg-indigo-50 border-indigo-200 shadow-sm"
                          : "bg-white border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm truncate max-w-[150px]">
                          {log.cabinetName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {dateStr}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                        <span className="flex items-center gap-1 truncate max-w-[130px]">
                          <Activity className="h-3 w-3 shrink-0" />
                          โดย: {log.checkedBy.split("@")[0]}
                        </span>
                        <span className="text-indigo-600 font-bold">
                          เช็ก {log.items.length} ชนิด
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Comparative analysis board (Right part) */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            {selectedLog ? (
              <div>
                {/* Header info */}
                <div className="border-b border-slate-100 pb-4 mb-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] bg-indigo-55 text-indigo-800 font-bold px-2 py-0.5 rounded uppercase">
                        COMPARATIVE LOG REPORT
                      </span>
                      <h3 className="text-lg font-black text-slate-950 mt-1 leading-snug">
                        วิเคราะห์การเปลี่ยนแปลง: {selectedLog.cabinetName}
                      </h3>
                      <p className="text-slate-400 text-xs mt-1 font-semibold flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        เช็กสต็อกเมื่อ: {new Date(selectedLog.checkedAt?.toDate?.() || selectedLog.checkedAt).toLocaleString("th-TH")}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-400 block font-medium">ผู้ตรวจสอบบัญชี:</span>
                      <span className="font-bold text-slate-800 block">{selectedLog.checkedBy}</span>
                    </div>
                  </div>
                </div>

                {/* Table with compare statistics */}
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  ตารางเปรียบเทียบจำนวนคงเหลือล่าสุด เทียบกับรอบเช็กก่อนหน้า
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">ชื่อสินค้าพัสดุ</th>
                        <th className="py-3 px-4">แผนกวัสดุ</th>
                        <th className="py-3 px-4 text-center">สต็อกก่อนเช็ก</th>
                        <th className="py-3 px-4 text-center">นับได้จริงล่าสุด</th>
                        <th className="py-3 px-4 text-center">อัตราเปลี่ยนแปลง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {selectedLog.items.map((item, idx) => {
                        const diff = item.newQty - item.prevQty;
                        const isNoChange = diff === 0;
                        const isDecreased = diff < 0;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-3.5 px-4 font-bold text-slate-900">{item.name}</td>
                            <td className="py-3.5 px-4">
                              <span className="bg-slate-100 text-slate-600 font-bold text-[8px] px-1.5 py-0.5 rounded uppercase">
                                {item.department}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-slate-500">
                              {item.prevQty} {item.unit}
                            </td>
                            <td className="py-3.5 px-4 text-center font-black text-slate-800">
                              {item.newQty} {item.unit}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {isNoChange ? (
                                <span className="text-slate-400 font-semibold">— ไม่มีเปลี่ยน</span>
                              ) : isDecreased ? (
                                <span className="text-rose-600 font-black inline-flex items-center gap-0.5">
                                  <TrendingDown className="h-3 w-3" />
                                  ลดลง {Math.abs(diff)} {item.unit}
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-black">
                                  เพิ่มขึ้น +{diff} {item.unit}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-50 text-xs text-slate-600 leading-relaxed flex items-start gap-2.5">
                  <Sparkles className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-indigo-900 block mb-0.5">สรุปการตรวจนับสำหรับสั่งสินค้าสต็อก:</span>
                    <span>ตารางเปรียบเทียบด้านบนนี้แสดงระดับการกินความจุของตู้พัสดุ โดยอัตราส่วนการลดลงอย่างมีนัยสำคัญช่วยบ่งชี้ความต้องการปริมาณที่แท้จริงเพื่อให้แอดมินนำมาวางแผนพรีออเดอร์สต็อกสินค้าสำรองได้อย่างแม่นยำ</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <FolderSync className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold">ยังไม่ได้เลือกรายการวิเคราะห์เปรียบเทียบ</p>
                <p className="text-xs text-slate-400 mt-1">กรุณาเลือกตู้และประวัติการเช็กของทีมงานด้านซ้าย เพื่อดึงข้อมูลการเปรียบเทียบสต็อกสิ่งของเทียบกับรอบก่อนหน้าได้ทันที</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. QC LOGS TAB */}
      {activeTab === "qc" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
              บันทึกประวัติการเบิกใช้ของฝ่ายควบคุมคุณภาพ (QC Consume Logs)
            </h3>
            <span className="bg-purple-100 text-purple-800 font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase">
              ทั้งหมด {qcLogs.length} รายการ
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6">วันที่เบิกใช้</th>
                  <th className="py-4 px-6">ผู้ลงทะเบียนหยิบใช้</th>
                  <th className="py-4 px-6">แผนกพัสดุ</th>
                  <th className="py-4 px-6">รายการสินค้าที่เบิกออกไป</th>
                  <th className="py-4 px-6 text-right">จำนวนที่เบิก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {qcLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      ยังไม่มีรายการเบิกใช้ QC ใดๆ ในระบบ
                    </td>
                  </tr>
                ) : (
                  qcLogs.map(log => {
                    const dateStr = new Date(log.consumedAt?.toDate?.() || log.consumedAt).toLocaleString("th-TH");
                    return (
                      <React.Fragment key={log.id}>
                        {log.items.map((item, idx) => (
                          <tr key={`${log.id}-${idx}`} className="hover:bg-slate-50/50">
                            {idx === 0 && (
                              <>
                                <td className="py-4 px-6 font-semibold text-slate-800" rowSpan={log.items.length}>
                                  {dateStr}
                                </td>
                                <td className="py-4 px-6" rowSpan={log.items.length}>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">{log.consumedBy.split("@")[0]}</span>
                                    <span className="text-[10px] text-slate-400">{log.consumedBy}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-6" rowSpan={log.items.length}>
                                  <span className="bg-purple-50 border border-purple-100 text-purple-700 font-bold text-[9px] px-2 py-0.5 rounded uppercase">
                                    {log.department}
                                  </span>
                                </td>
                              </>
                            )}
                            <td className="py-4 px-6">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{item.name}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">จาก: {item.cabinetName}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-right font-extrabold text-rose-600">
                              - {item.qtyTaken} {item.unit}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS SECTION */}
      
      {/* A. CABINET ADD/EDIT MODAL */}
      {showCabinetModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base sm:text-lg font-black text-slate-950">
                {editingCabinet ? "แก้ไขตู้เก็บของพัสดุ" : "เพิ่มตู้เก็บของใหม่เข้าคลัง"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">กำหนดข้อมูล และระบุแผนกที่จะใช้งานตู้ใบนี้</p>
            </div>
            
            <form onSubmit={handleCabinetSubmit} className="p-6 space-y-4 font-sans text-xs">
              {cabinetError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{cabinetError}</span>
                </div>
              )}

              <div>
                <label htmlFor="cab-name-input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  ชื่อตู้เก็บของ <span className="text-rose-500">*</span>
                </label>
                <input
                  id="cab-name-input"
                  type="text"
                  placeholder="ตัวอย่าง: ตู้เก็บแล็บเคมี 1"
                  value={cabinetForm.name}
                  onChange={(e) => setCabinetForm({ ...cabinetForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                />
              </div>

              <div>
                <label htmlFor="cab-location-input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  สถานที่ตั้งตู้เก็บของ <span className="text-rose-500">*</span>
                </label>
                <input
                  id="cab-location-input"
                  type="text"
                  placeholder="ตัวอย่าง: ห้องแล็บเคมี ตึก A ชั้น 2"
                  value={cabinetForm.location}
                  onChange={(e) => setCabinetForm({ ...cabinetForm, location: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                />
              </div>

              {/* Department Checkboxes */}
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  กำหนดแผนกที่ดูแล / เข้าตรวจเช็ก (เลือกได้มากกว่า 1)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {FACTORY_DEPARTMENTS.map(dept => {
                    const checked = cabinetForm.departments.includes(dept);
                    return (
                      <label key={dept} className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setCabinetForm({
                                ...cabinetForm,
                                departments: cabinetForm.departments.filter(d => d !== dept)
                              });
                            } else {
                              setCabinetForm({
                                ...cabinetForm,
                                departments: [...cabinetForm.departments, dept]
                              });
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        {dept}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Cabinet Preset Images Selection */}
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  เลือกรูปภาพสัญลักษณ์ของตู้เก็บของ
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {CABINET_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCabinetForm({ ...cabinetForm, photoUrl: preset })}
                      className={`h-14 rounded-lg overflow-hidden border-2 relative cursor-pointer ${
                        cabinetForm.photoUrl === preset ? "border-indigo-650 shadow-sm" : "border-transparent opacity-60"
                      }`}
                    >
                      <img src={preset} alt="preset" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {cabinetForm.photoUrl === preset && (
                        <div className="absolute inset-0 bg-indigo-650/20 flex items-center justify-center">
                          <Check className="h-4 w-4 text-white font-extrabold" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingCabinet}
                  onClick={() => setShowCabinetModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingCabinet}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-75 text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {isSavingCabinet ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>กำลังบันทึกข้อมูล...</span>
                    </>
                  ) : (
                    <span>ตกลงและบันทึก</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. CONSUMABLE ADD/EDIT MODAL */}
      {showConsumableModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base sm:text-lg font-black text-slate-950">
                {editingConsumable ? "แก้ไขพัสดุวัสดุสิ้นเปลือง" : "จัดสรรวัสดุสิ้นเปลืองเข้าตู้เก็บของ"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">กำหนดตู้เก็บ, ระบุสต็อกเริ่มต้น, และตั้งค่าการแจ้งเตือนความปลอดภัย</p>
            </div>

            <form onSubmit={handleConsumableSubmit} className="p-6 space-y-4 font-sans text-xs">
              {consumableError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{consumableError}</span>
                </div>
              )}

              <div>
                <label htmlFor="con-cabinet-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  เลือกจัดสรรลงตู้เก็บของ <span className="text-rose-500">*</span>
                </label>
                <select
                  id="con-cabinet-select"
                  value={selectedCabinetId}
                  onChange={(e) => setSelectedCabinetId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-medium text-slate-700"
                >
                  <option value="" disabled>-- กรุณาเลือกตู้จัดเก็บ --</option>
                  {cabinets.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.location})</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="con-name-input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  ชื่อวัสดุสิ้นเปลือง / พัสดุ <span className="text-rose-500">*</span>
                </label>
                <input
                  id="con-name-input"
                  type="text"
                  placeholder="ตัวอย่าง: ถุงมือยางไนไตร Size M"
                  value={consumableForm.name}
                  onChange={(e) => setConsumableForm({ ...consumableForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="con-dept-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    แผนกรับผิดชอบ
                  </label>
                  <select
                    id="con-dept-select"
                    value={consumableForm.department}
                    onChange={(e) => setConsumableForm({ ...consumableForm, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                  >
                    {FACTORY_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="con-unit-input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    หน่วยนับ
                  </label>
                  <input
                    id="con-unit-input"
                    type="text"
                    placeholder="กล่อง, ชิ้น, ม้วน, แพ็ค"
                    value={consumableForm.unit}
                    onChange={(e) => setConsumableForm({ ...consumableForm, unit: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="con-qty-input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    สต็อกคงเหลือเริ่มต้น
                  </label>
                  <input
                    id="con-qty-input"
                    type="number"
                    value={consumableForm.currentQty}
                    onChange={(e) => setConsumableForm({ ...consumableForm, currentQty: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
                  />
                </div>

                <div>
                  <label htmlFor="con-threshold-input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    เกณฑ์แจ้งเตือนสต็อกต่ำ
                  </label>
                  <input
                    id="con-threshold-input"
                    type="number"
                    value={consumableForm.minThreshold}
                    onChange={(e) => setConsumableForm({ ...consumableForm, minThreshold: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-rose-600"
                  />
                </div>
              </div>

              {/* Consumable presets */}
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  เลือกรูปสัญลักษณ์สินค้าที่ใกล้เคียง
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {Object.entries(CONSUMABLE_PRESETS).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setConsumableForm({ ...consumableForm, imageUrl: value })}
                      className={`h-11 rounded-lg overflow-hidden border-2 relative cursor-pointer ${
                        consumableForm.imageUrl === value ? "border-indigo-600" : "border-transparent opacity-60"
                      }`}
                      title={key}
                    >
                      <img src={value} alt={key} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingConsumable}
                  onClick={() => setShowConsumableModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingConsumable}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-75 text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {isSavingConsumable ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>กำลังจัดเก็บ...</span>
                    </>
                  ) : (
                    <span>จัดเก็บลงตู้</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* C. QR PRINT POPUP MODAL */}
      {showQRModal && qrCabinet && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden animate-scale-up">
            
            {/* Printable Frame Area */}
            <div id="printable-qr-card" className="p-8 text-center bg-white flex flex-col items-center font-sans">
              <span className="text-[10px] bg-indigo-600 text-white font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                QR CABINET TAG
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-3 leading-snug">
                {qrCabinet.name}
              </h2>
              <p className="text-slate-400 text-xs font-semibold flex items-center gap-1 mt-1 justify-center mb-6">
                <MapPin className="h-3.5 w-3.5" />
                {qrCabinet.location}
              </p>

              {/* QR Image Box */}
              <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl mb-6 relative group">
                <img 
                  src={getQRImageSrc(qrCabinet.id)} 
                  alt="QR Code" 
                  className="h-48 w-48 mx-auto mix-blend-multiply"
                />
              </div>

              <p className="text-slate-500 font-bold text-xs max-w-xs leading-relaxed">
                สแกนแสกน QR ข้างต้นด้วยกล้องสมาร์ทโฟน <br />
                เพื่อเปิดใช้งานโมบายแอปเช็กพัสดุและคีย์จำนวนพัสดุในตู้นี้
              </p>
              
              <div className="text-[9px] text-slate-300 font-mono mt-4 border-t border-slate-100 pt-3 w-full break-all leading-tight">
                URL: {getQRUrl(qrCabinet.id)}
              </div>
            </div>

            {/* Action buttons outside printable card */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex gap-2">
              <button
                onClick={() => {
                  // Custom printing of the QR card
                  const printContent = document.getElementById("printable-qr-card")?.innerHTML;
                  const originalContent = document.body.innerHTML;
                  if (printContent) {
                    const printWindow = window.open("", "_blank");
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Print QR Code - ${qrCabinet.name}</title>
                            <style>
                              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 90vh; background: #fff; margin:0; padding:0; }
                              #printable-qr-card { text-align: center; border: 2px solid #ccc; padding: 40px; border-radius: 20px; max-width: 380px; }
                              h2 { font-size: 24px; margin: 15px 0 5px 0; font-weight: bold; }
                              p { color: #666; font-size: 14px; margin: 5px 0 20px 0; }
                              img { width: 250px; height: 250px; }
                              span { background: #4f46e5; color: white; font-weight: bold; padding: 4px 12px; border-radius: 9999px; font-size: 11px; text-transform: uppercase; }
                              .foot { font-size: 12px; color: #888; margin-top: 15px; font-weight: bold; }
                            </style>
                          </head>
                          <body>
                            <div id="printable-qr-card">
                              <span>QR Cabinet Tag</span>
                              <h2>${qrCabinet.name}</h2>
                              <p>Location: ${qrCabinet.location}</p>
                              <img src="${getQRImageSrc(qrCabinet.id)}" />
                              <div class="foot">สแกน QR ด้วยกล้องสมาร์ทโฟน เพื่อบันทึกจำนวนของและเช็กสต็อก</div>
                            </div>
                            <script>
                              window.onload = function() { window.print(); window.close(); }
                            </script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all"
              >
                <Printer className="h-4 w-4" />
                พิมพ์ภาพ QR
              </button>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setQrCabinet(null);
                }}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-all"
              >
                ปิดหน้าต่าง
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-950/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold animate-slide-up backdrop-blur-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
