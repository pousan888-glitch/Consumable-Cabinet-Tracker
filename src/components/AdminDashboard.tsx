import React, { useState, useEffect } from "react";
import { Cabinet, Consumable, CountHistory, QCConsumptionHistory, DepartmentRecord } from "../types";
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
  deleteCountHistoryItem,
  deleteQCConsumptionItem,
  getCloudSyncNotice,
  testAndSyncAllToCloud,
  resetCloudSyncNotice,
  getDepartments,
  restoreDefaultConsumables,
  autoAssignUnlinkedConsumables,
  CABINET_PRESETS,
  CONSUMABLE_PRESETS
} from "../lib/dbService";
import { getActiveFirebaseConfig } from "../lib/firebase";
import UserRoleManagement from "./UserRoleManagement";
import DepartmentSettings from "./DepartmentSettings";
import ImageUploadInput from "./ImageUploadInput";
import ImagePreviewModal from "./ImagePreviewModal";
import CabinetQRModal from "./CabinetQRModal";
import ClearHistoryModal from "./ClearHistoryModal";
import { 
  Plus, 
  Edit, 
  Trash, 
  Trash2, 
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
  X,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Users,
  Crown,
  ShieldCheck,
  Building2,
  Camera,
  PackageMinus,
  Download,
  Filter,
  FileSpreadsheet
} from "lucide-react";

interface AdminDashboardProps {
  userEmail: string;
  isSuperAdmin?: boolean;
}

export default function AdminDashboard({ userEmail, isSuperAdmin }: AdminDashboardProps) {
  const isUserSuperAdmin = isSuperAdmin || userEmail.toLowerCase() === "pousan888@gmail.com";

  // Database States
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [countLogs, setCountLogs] = useState<CountHistory[]>([]);
  const [qcLogs, setQcLogs] = useState<QCConsumptionHistory[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  
  // Loading & View States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"cabinets" | "consumables" | "history" | "qc" | "users" | "settings">("cabinets");
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

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
    maxCapacity: 30,
    unit: "ชิ้น",
    imageUrl: CONSUMABLE_PRESETS["glove"]
  });
  const [isSavingConsumable, setIsSavingConsumable] = useState(false);
  const [isRestoringDemo, setIsRestoringDemo] = useState(false);
  const [consumableError, setConsumableError] = useState<string | null>(null);

  // Unified Consumption & Dispense History Filters
  const [qcSourceFilter, setQcSourceFilter] = useState<string>("ALL");
  const [qcDeptFilter, setQcDeptFilter] = useState<string>("ALL");
  const [qcCabinetFilter, setQcCabinetFilter] = useState<string>("ALL");
  const [qcSearchTerm, setQcSearchTerm] = useState<string>("");

  // Notifications & UI Helpers
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dismissCloudNotice, setDismissCloudNotice] = useState(false);
  const [copiedRule, setCopiedRule] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);

  const activeProjectId = getActiveFirebaseConfig().config.projectId || "warehouse-consumables-monitor";
  const firebaseRulesUrl = `https://console.firebase.google.com/project/${activeProjectId}/firestore/rules`;

  const handleSyncToCloud = async () => {
    setIsSyncingCloud(true);
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);
    try {
      const res = await testAndSyncAllToCloud();
      if (res.success) {
        setSyncSuccessMsg(res.message);
        setToastMessage("ซิงค์ข้อมูลขึ้น Cloud เรียบร้อยแล้ว!");
        setTimeout(() => setToastMessage(null), 4000);
        // Refresh all data
        const cabs = await getCabinets();
        setCabinets(cabs);
        const items = await getConsumables();
        setConsumables(items);
        const histories = await getCountHistory();
        setCountLogs(histories);
        const qcHistories = await getQCConsumptionHistory();
        setQcLogs(qcHistories);
        const depts = await getDepartments();
        setDepartments(depts);
      } else {
        setSyncErrorMsg(res.message);
      }
    } catch (err: any) {
      setSyncErrorMsg(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // QR Code Modal
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCabinet, setQrCabinet] = useState<Cabinet | null>(null);

  // History detail drawer
  const [selectedLog, setSelectedLog] = useState<CountHistory | null>(null);

  // Clear History Modal states
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [clearHistoryInitialType, setClearHistoryInitialType] = useState<"ALL" | "COUNT" | "QC">("ALL");
  const [deletingCountLogId, setDeletingCountLogId] = useState<string | null>(null);
  const [deletingQcLogId, setDeletingQcLogId] = useState<string | null>(null);

  const handleDeleteSingleCountLog = async (logId: string, cabinetName: string) => {
    if (!window.confirm(`ยืนยันลบประวัติการตรวจนับของตู้ "${cabinetName}" รายการนี้?`)) return;
    try {
      setDeletingCountLogId(logId);
      await deleteCountHistoryItem(logId);
      if (selectedLog?.id === logId) {
        setSelectedLog(null);
      }
      const histories = await getCountHistory();
      setCountLogs(histories);
      setToastMessage("ลบประวัติการตรวจนับรายการนี้เรียบร้อยแล้ว");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Delete count log error:", err);
      alert("ไม่สามารถลบรายการได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setDeletingCountLogId(null);
    }
  };

  const handleDeleteSingleQcLog = async (logId: string, department: string, itemCount: number) => {
    if (!window.confirm(`ยืนยันลบประวัติการเบิกของแผนก "${department}" (${itemCount} ชนิดพัสดุ) นี้?`)) return;
    try {
      setDeletingQcLogId(logId);
      await deleteQCConsumptionItem(logId);
      const qcHistories = await getQCConsumptionHistory();
      setQcLogs(qcHistories);
      setToastMessage("ลบประวัติการเบิกรายการนี้เรียบร้อยแล้ว");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Delete qc log error:", err);
      alert("ไม่สามารถลบรายการได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setDeletingQcLogId(null);
    }
  };

  // Departments List (dynamic from database with fallback)
  const availableDepartmentNames = departments.length > 0
    ? departments.map(d => d.name)
    : ["Production", "QC", "Maintenance", "Warehouse", "Office"];

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

        const depts = await getDepartments();
        setDepartments(depts);
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
      const minVal = Math.max(0, consumableForm.minThreshold || 0);
      const maxVal = Math.max(minVal, consumableForm.maxCapacity || Math.max(minVal * 3, 20));

      const payload = {
        ...consumableForm,
        name: trimmedName,
        cabinetId: selectedCabinetId,
        minThreshold: minVal,
        maxCapacity: maxVal,
        lastUpdatedBy: userEmail
      };

      if (editingConsumable) {
        await updateConsumable(editingConsumable.id, payload);
        setToastMessage(`อัปเดตข้อมูลพัสดุ "${trimmedName}" เรียบร้อย (Min: ${minVal}, Max: ${maxVal})`);
      } else {
        await addConsumable(payload);
        setToastMessage(`เพิ่มพัสดุ "${trimmedName}" ลงในตู้สำเร็จเรียบร้อย!`);
      }

      setShowConsumableModal(false);
      setEditingConsumable(null);
      setConsumableForm({
        name: "",
        department: "Production",
        currentQty: 10,
        minThreshold: 5,
        maxCapacity: 30,
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
      maxCapacity: item.maxCapacity ?? Math.max(item.minThreshold * 3, item.currentQty, 20),
      unit: item.unit,
      imageUrl: item.imageUrl
    });
    setShowConsumableModal(true);
  };

  const handleDeleteConsumable = async (id: string, name?: string) => {
    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบรายการพัสดุ "${name || 'นี้'}" ออกจากระบบถาวร?\n\n(หมายเหตุ: หากต้องการนำชุดพัสดุตัวอย่างกลับมา สามารถกดปุ่ม 'คืนค่าพัสดุเริ่มต้น' ได้เสมอ)`)) {
      try {
        await deleteConsumable(id);
        triggerRefresh();
        setToastMessage(`ลบรายการ "${name || 'พัสดุ'}" เรียบร้อย (หากต้องการนำกลับมา สามารถกด 'คืนค่าพัสดุเริ่มต้น' ได้)`);
        setTimeout(() => setToastMessage(null), 5000);
      } catch (err) {
        console.error("Error deleting consumable:", err);
      }
    }
  };

  const handleRestoreDefaultConsumables = async () => {
    if (!confirm("คุณต้องการคืนค่าชุดพัสดุตัวอย่างเริ่มต้นใช่หรือไม่?\n\nระบบจะสร้าง/ซิงค์รายการพัสดุมาตรฐาน (พร้อมรูปภาพ, แผนก, Min, Max) และเชื่อมโยงเข้าตู้เก็บของที่มีอยู่ในระบบให้อัตโนมัติ")) {
      return;
    }
    setIsRestoringDemo(true);
    try {
      const res = await restoreDefaultConsumables();
      triggerRefresh();
      setToastMessage(res.message);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error("Error restoring default consumables:", err);
      setToastMessage("เกิดข้อผิดพลาดในการคืนค่าพัสดุเริ่มต้น");
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsRestoringDemo(false);
    }
  };

  const handleAutoAssignCabinet = async (targetCabId: string) => {
    try {
      const count = await autoAssignUnlinkedConsumables(targetCabId);
      triggerRefresh();
      setToastMessage(`จัดสรรพัสดุที่ไม่มีตู้จำนวน ${count} รายการ เข้าตู้เรียบร้อย`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Error auto assigning cabinets:", err);
    }
  };

  const handleQuickRestock = async (item: Consumable) => {
    try {
      const targetMax = item.maxCapacity || Math.max(item.minThreshold * 3, 20);
      const restockAmt = Math.max(targetMax - item.currentQty, 10);
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
            onClick={handleSyncToCloud}
            disabled={isSyncingCloud}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/10 cursor-pointer transition-all"
            title="ซิงค์ข้อมูลจากเครื่องนี้ขึ้น Cloud Firestore เพื่อให้ทุกเครื่องเห็นตรงกัน"
          >
            {isSyncingCloud ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>{isSyncingCloud ? "กำลังซิงค์..." : "ซิงค์ขึ้น Cloud"}</span>
          </button>
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
                maxCapacity: 30,
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
          <button
            onClick={handleRestoreDefaultConsumables}
            disabled={isRestoringDemo}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all"
            title="คืนค่าชุดพัสดุตัวอย่างเริ่มต้นมาตรฐาน พร้อมค่า Min-Max และผูกเข้าตู้ให้อัตโนมัติ"
          >
            {isRestoringDemo ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            ) : (
              <RotateCcw className="h-4 w-4 text-amber-600" />
            )}
            <span>คืนค่าพัสดุเริ่มต้น</span>
          </button>
          <button
            onClick={() => {
              setClearHistoryInitialType("ALL");
              setShowClearHistoryModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all"
            title="เปิดเมนูล้างและเคลียร์ประวัติการตรวจนับ หรือประวัติการเบิกของ"
          >
            <Trash2 className="h-4 w-4 text-rose-600" />
            <span>เคลียร์ประวัติ</span>
          </button>
        </div>
      </div>

      {/* CLOUD SYNC SUCCESS BANNER */}
      {syncSuccessMsg && (
        <div className="mb-8 p-5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs animate-fade-in shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 shadow-xs">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-emerald-950 text-sm mb-0.5">
                เชื่อมต่อ Cloud สำเร็จและซิงค์ข้อมูลขึ้นระบบคลาวด์เรียบร้อยแล้ว!
              </p>
              <p className="text-emerald-800 leading-relaxed">
                {syncSuccessMsg}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSyncSuccessMsg(null)}
            className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
            title="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* CLOUD FIRESTORE RULES NOTICE BANNER & QUICK RESOLUTION GUIDE */}
      {getCloudSyncNotice().hasError && !dismissCloudNotice && (
        <div className="mb-8 p-6 bg-gradient-to-br from-amber-50 to-orange-50/40 border-2 border-amber-300 rounded-2xl text-xs animate-fade-in shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0 shadow-sm mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  วิธีแก้ปัญหา: ทำไมเปิดในเครื่องอื่นแล้วไม่เห็นข้อมูลที่เพิ่งเพิ่ม?
                </h3>
                <p className="text-slate-600 mt-1 leading-relaxed max-w-4xl">
                  เพราะฐานข้อมูล Cloud Firestore ใน Firebase Console ปฏิเสธการเข้าถึง (Permission Denied) เนื่องจากยังไม่ได้เปิดสิทธิ์ Rules ทำให้ระบบต้องเซฟตู้และพัสดุไว้ในความจำเครื่องนี้ชั่วคราว (Local Storage) เครื่องอื่นจึงยังมองไม่เห็น 
                  <b> ทำตาม 3 ขั้นตอนนี้เพียง 1 นาที เพื่อเปิดให้ทุกเครื่องและมือถือซิงค์ข้อมูลตรงกัน:</b>
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissCloudNotice(true)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-amber-100/60 rounded-xl transition-colors cursor-pointer shrink-0"
              title="ซ่อนคำแนะนำนี้ชั่วคราว"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 3 ACTION STEPS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            {/* STEP 1 */}
            <div className="bg-white p-4 rounded-xl border border-amber-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-6 w-6 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">1</span>
                  <span className="font-bold text-slate-900">คัดลอก Firestore Rules</span>
                </div>
                <p className="text-slate-500 text-[11px] mb-2.5 leading-relaxed">
                  คลิกปุ่มด้านล่างเพื่อคัดลอกโค้ดสิทธิ์อนุญาต:
                </p>
                <pre className="bg-slate-900 text-amber-200 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto mb-3">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                </pre>
              </div>
              <button
                onClick={() => {
                  const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`;
                  navigator.clipboard.writeText(rules);
                  setCopiedRule(true);
                  setTimeout(() => setCopiedRule(false), 3500);
                }}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                {copiedRule ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>คัดลอกโค้ด Rules สำเร็จแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>คลิกเพื่อคัดลอกโค้ด Rules</span>
                  </>
                )}
              </button>
            </div>

            {/* STEP 2 */}
            <div className="bg-white p-4 rounded-xl border border-amber-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-6 w-6 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">2</span>
                  <span className="font-bold text-slate-900">ไปที่ Firebase &gt; Firestore Rules</span>
                </div>
                <p className="text-slate-500 text-[11px] mb-2 leading-relaxed">
                  คลิกปุ่มด้านล่างเพื่อเปิดหน้าโปรเจกต์ <b>{activeProjectId}</b>:
                </p>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-[10.5px] mb-3 space-y-1.5 leading-relaxed">
                  <div className="font-semibold text-rose-600">⚠️ ต้องเป็น &quot;Firestore Database&quot; เท่านั้น (ไม่ใช่ Realtime Database):</div>
                  <div>• <b>ถ้าเห็นปุ่ม &quot;Create database&quot; (สร้างฐานข้อมูล):</b> ให้กดปุ่มนี้ &gt; เลือก <b>&quot;Start in test mode&quot;</b> &gt; กด Next &gt; กด Enable ได้เลย (ระบบจะเปิดสิทธิ์ให้อัตโนมัติทันที!)</div>
                  <div>• <b>ถ้ามีฐานข้อมูลแล้ว:</b> ดูที่แถบเมนูด้านบนจอ จะมีแท็บ <b>[ Data ]  [ Rules / กฎ ]</b> ให้คลิกที่ <b>Rules</b> นำโค้ดที่คัดลอกไปวาง แล้วกดปุ่มสีฟ้า <b>Publish</b></div>
                </div>
              </div>
              <a
                href={firebaseRulesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs text-center"
              >
                <span>เปิดหน้า Firebase Firestore ทันที</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* STEP 3 */}
            <div className="bg-white p-4 rounded-xl border border-amber-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-900 font-black text-xs flex items-center justify-center">3</span>
                  <span className="font-bold text-slate-900">ส่งข้อมูลขึ้น Cloud</span>
                </div>
                <p className="text-slate-500 text-[11px] mb-2 leading-relaxed">
                  เมื่อกด Publish ใน Firebase แล้ว ให้กดปุ่มนี้เพื่อส่งตู้และพัสดุจากเครื่องนี้ขึ้น Cloud:
                </p>
                {syncErrorMsg && (
                  <div className="p-2 mb-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] leading-relaxed font-semibold">
                    {syncErrorMsg}
                  </div>
                )}
              </div>
              <button
                onClick={handleSyncToCloud}
                disabled={isSyncingCloud}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                {isSyncingCloud ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>กำลังทดสอบและซิงค์...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>ทดสอบและซิงค์ข้อมูลขึ้น Cloud เดี๋ยวนี้</span>
                  </>
                )}
              </button>
            </div>
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
            <span>ประวัติเบิกและหยิบใช้ของ</span>
            <span className="px-1.5 py-0.5 text-[9px] font-black bg-purple-100 text-purple-800 rounded-full">
              {qcLogs.length}
            </span>
          </button>

          {/* Department Settings Tab: Accessible by Admin & Super Admin */}
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-4 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "settings"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>จัดการแผนกโรงงาน</span>
            <span className="px-1.5 py-0.5 text-[9px] font-black bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              {departments.length}
            </span>
          </button>

          {isUserSuperAdmin && (
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-4 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === "users"
                  ? "border-amber-500 text-amber-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users className="h-4 w-4 text-amber-600" />
              <span>จัดการสิทธิ์ผู้ใช้งาน</span>
              <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-100 text-amber-900 rounded-full border border-amber-300">
                Super Admin
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* SEARCH/SEARCH CONTROLS */}
      {activeTab !== "history" && activeTab !== "qc" && activeTab !== "users" && activeTab !== "settings" && (
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
                      <div 
                        className="relative h-40 bg-slate-100 cursor-pointer group overflow-hidden"
                        onClick={() => setPreviewModalImage({ 
                          url: cabinet.photoUrl, 
                          title: cabinet.name, 
                          subtitle: `ที่ตั้ง: ${cabinet.location} | แผนก: ${cabinet.departments.join(", ")}` 
                        })}
                        title="คลิกเพื่อดูรูปภาพขนาดใหญ่"
                      >
                        <img 
                          src={cabinet.photoUrl} 
                          alt={cabinet.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="px-2.5 py-1 bg-white/90 rounded-full text-[10px] font-bold text-slate-900 shadow flex items-center gap-1">
                            <Eye className="h-3 w-3" /> ดูรูปใหญ่
                          </span>
                        </div>
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
        <div className="space-y-4">
          {/* Unassigned Consumables Alert Banner */}
          {(() => {
            const unassignedConsumables = consumables.filter(item => !cabinets.some(c => c.id === item.cabinetId));
            if (unassignedConsumables.length === 0) return null;

            return (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs animate-fade-in">
                <div className="flex items-center gap-3 text-amber-900">
                  <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm block">
                      พบพัสดุ {unassignedConsumables.length} รายการที่ยังไม่มีตู้จัดเก็บ (ไม่ระบุตู้)
                    </span>
                    <span className="text-[11px] text-amber-700 mt-0.5 block">
                      พัสดุเหล่านี้ยังไม่ได้ผูกกับตู้เก็บของที่ใช้งานอยู่ สามารถกดจัดสรรเข้าตู้ หรือกดคืนค่าตู้เริ่มต้นได้ทันที
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cabinets.length > 0 ? (
                    <button
                      onClick={() => handleAutoAssignCabinet(cabinets[0].id)}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 text-xs"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>ผูกเข้าตู้ "{cabinets[0].name}" ทันที</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleRestoreDefaultConsumables}
                      disabled={isRestoringDemo}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>คืนค่าตู้และพัสดุเริ่มต้น</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Consumables Table Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header info toolbar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-bold">
                <Package className="h-4 w-4 text-indigo-600" />
                <span>พัสดุและวัสดุสิ้นเปลืองทั้งหมด ({consumables.length} รายการ)</span>
                <span className="text-[11px] text-slate-400 font-medium">| ควบคุมด้วยเกณฑ์สต็อกต่ำสุด (Min) และสูงสุด (Max)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRestoreDefaultConsumables}
                  disabled={isRestoringDemo}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                  title="กู้คืนรายการพัสดุมาตรฐานเริ่มต้น พร้อมเกณฑ์ Min-Max และผูกเข้าตู้"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                  <span>คืนค่าพัสดุเริ่มต้น</span>
                </button>
                <button
                  onClick={() => {
                    setEditingConsumable(null);
                    setConsumableForm({
                      name: "",
                      department: "Production",
                      currentQty: 10,
                      minThreshold: 5,
                      maxCapacity: 30,
                      unit: "ชิ้น",
                      imageUrl: CONSUMABLE_PRESETS["glove"]
                    });
                    if (cabinets.length > 0) setSelectedCabinetId(cabinets[0].id);
                    setShowConsumableModal(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>เพิ่มพัสดุใหม่</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-4 px-6">รูปภาพ & ชื่อวัสดุสิ้นเปลือง</th>
                    <th className="py-4 px-6">ตำแหน่งจัดเก็บ (ตู้เก็บของ)</th>
                    <th className="py-4 px-6">แผนก / เจ้าของพัสดุ</th>
                    <th className="py-4 px-6 text-center">คงเหลือปัจจุบัน</th>
                    <th className="py-4 px-6 text-center">เกณฑ์สต็อก (Min - Max)</th>
                    <th className="py-4 px-6 text-center">ระดับสต็อกเทียบ Max</th>
                    <th className="py-4 px-6 text-center">สถานะ</th>
                    <th className="py-4 px-6 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {consumables.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-3">
                          <Package className="h-10 w-10 text-slate-300" />
                          <p className="font-semibold text-slate-500">ยังไม่มีวัสดุสิ้นเปลืองในระบบ</p>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={handleRestoreDefaultConsumables}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>คืนค่าชุดพัสดุตัวอย่างเริ่มต้น (พร้อม Min-Max)</span>
                            </button>
                          </div>
                        </div>
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
                        const minVal = item.minThreshold;
                        const maxVal = item.maxCapacity || Math.max(item.minThreshold * 3, 20);
                        const isOutOfStock = item.currentQty === 0;
                        const isLow = item.currentQty <= minVal && !isOutOfStock;
                        const isOverstock = item.currentQty > maxVal;
                        const pct = Math.min(Math.round((item.currentQty / maxVal) * 100), 100);
                        const isCabinetUnassigned = !cabinets.some(c => c.id === item.cabinetId);

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6 font-semibold">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="relative h-10 w-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-pointer group"
                                  onClick={() => setPreviewModalImage({ 
                                    url: item.imageUrl, 
                                    title: item.name, 
                                    subtitle: `ตู้: ${getCabinetName(item.cabinetId)} | แผนก: ${item.department} | คงเหลือ: ${item.currentQty} ${item.unit} | Min: ${minVal} | Max: ${maxVal}` 
                                  })}
                                  title="คลิกเพื่อดูรูปภาพขยาย"
                                >
                                  <img 
                                    src={item.imageUrl} 
                                    alt={item.name} 
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                    <Eye className="h-3 w-3" />
                                  </div>
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block leading-tight">{item.name}</span>
                                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">ID: {item.id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              {isCabinetUnassigned ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[10px] px-2 py-0.5 rounded">
                                    ไม่ระบุตู้
                                  </span>
                                  {cabinets.length > 0 && (
                                    <button
                                      onClick={() => handleAutoAssignCabinet(cabinets[0].id)}
                                      className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-semibold cursor-pointer"
                                      title={`ผูกเข้าตู้ ${cabinets[0].name}`}
                                    >
                                      ผูกตู้
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="font-semibold text-slate-700 block">{getCabinetName(item.cabinetId)}</span>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              <span className="bg-slate-100 border border-slate-200/50 text-slate-600 font-bold text-[9px] px-2 py-0.5 rounded uppercase">
                                {item.department}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className={`font-black text-sm ${isOutOfStock ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-800"}`}>
                                {item.currentQty} <span className="text-xs font-semibold text-slate-500">{item.unit}</span>
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-1 text-[11px] font-bold">
                                  <span className="bg-amber-50 text-amber-800 border border-amber-200/70 px-1.5 py-0.5 rounded" title="สต็อกขั้นต่ำ (Minimum)">
                                    Min: {minVal}
                                  </span>
                                  <span className="text-slate-300">-</span>
                                  <span className="bg-blue-50 text-blue-800 border border-blue-200/70 px-1.5 py-0.5 rounded" title="สต็อกสูงสุด (Maximum)">
                                    Max: {maxVal}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-400">{item.unit}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="w-24 mx-auto">
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                  <span>{pct}%</span>
                                  <span>{item.currentQty}/{maxVal}</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      isOutOfStock 
                                        ? "bg-slate-300"
                                        : isLow 
                                        ? "bg-rose-500" 
                                        : isOverstock 
                                        ? "bg-purple-500" 
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${Math.max(pct, isOutOfStock ? 0 : 5)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              {isOutOfStock ? (
                                <span className="bg-rose-100 text-rose-800 font-bold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 bg-rose-600 rounded-full"></span>
                                  หมดสต็อก (0)
                                </span>
                              ) : isLow ? (
                                <span className="bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                                  ของใกล้หมด (≤ Min)
                                </span>
                              ) : isOverstock ? (
                                <span className="bg-purple-50 border border-purple-200 text-purple-700 font-bold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 bg-purple-500 rounded-full"></span>
                                  สต็อกล้น (&gt; Max)
                                </span>
                              ) : (
                                <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 bg-emerald-600 rounded-full"></span>
                                  สต็อกสมดุล
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleQuickRestock(item)}
                                  className="p-1.5 bg-white border border-slate-200 text-emerald-600 hover:text-emerald-800 hover:border-emerald-300 rounded-lg cursor-pointer transition-all"
                                  title={`เติมสต็อกด่วนสู่เกณฑ์ Max (${maxVal} ${item.unit})`}
                                >
                                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                                </button>
                                <button
                                  onClick={() => handleEditConsumable(item)}
                                  className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 rounded-lg cursor-pointer transition-all"
                                  title="แก้ไขพัสดุและเกณฑ์ Min-Max"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteConsumable(item.id, item.name)}
                                  className="p-1.5 bg-white border border-slate-200 text-rose-500 hover:text-rose-700 hover:border-rose-200 rounded-lg cursor-pointer transition-all"
                                  title="ลบพัสดุ (สามารถกู้คืนชุดตัวอย่างได้ที่ปุ่มคืนค่า)"
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
        </div>
      )}

      {/* 3. HISTORY TAB */}
      {activeTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* History list (Left part) */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>รายงานนับสต็อกแต่ละรอบ</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                  {countLogs.length}
                </span>
              </h3>
              {countLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setClearHistoryInitialType("COUNT");
                    setShowClearHistoryModal(true);
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-rose-200"
                  title="ล้างประวัติการตรวจนับสต็อกทั้งหมดหรือตามช่วงเวลา"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>ล้างประวัตินับ</span>
                </button>
              )}
            </div>
            
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
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left group/card ${
                        isSelected
                          ? "bg-indigo-50 border-indigo-200 shadow-sm"
                          : "bg-white border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm truncate max-w-[150px]">
                          {log.cabinetName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {dateStr}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingleCountLog(log.id, log.cabinetName);
                            }}
                            disabled={deletingCountLogId === log.id}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-100/70 rounded-md transition-all opacity-70 group-hover/card:opacity-100 cursor-pointer"
                            title="ลบเฉพาะรายการนับสต็อกนี้"
                          >
                            {deletingCountLogId === log.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                            ) : (
                              <Trash className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
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

      {/* 4. UNIFIED CONSUMPTION & DISPENSE LOGS TAB (ประวัติการเบิกและหยิบใช้ของ) */}
      {activeTab === "qc" && (() => {
        // Compute statistics
        const totalEvents = qcLogs.length;
        const cabinetQrEvents = qcLogs.filter(l => l.source === "CABINET_QR").length;
        const qcDirectEvents = qcLogs.filter(l => l.source === "QC" || !l.source).length;
        const totalUnits = qcLogs.reduce((sum, log) => 
          sum + (log.items?.reduce((isum, it) => isum + (it.qtyTaken || 0), 0) || 0), 0
        );

        // Filtered logs
        const filteredLogs = qcLogs.filter(log => {
          // Source filter
          if (qcSourceFilter === "CABINET_QR" && log.source !== "CABINET_QR") return false;
          if (qcSourceFilter === "QC" && log.source !== "QC" && log.source !== undefined) return false;

          // Department filter
          if (qcDeptFilter !== "ALL" && log.department !== qcDeptFilter) return false;

          // Cabinet filter
          if (qcCabinetFilter !== "ALL") {
            const matchesLogCab = log.cabinetId === qcCabinetFilter;
            const matchesItemCab = log.items.some(i => i.cabinetId === qcCabinetFilter || i.cabinetName === qcCabinetFilter);
            if (!matchesLogCab && !matchesItemCab) return false;
          }

          // Search term
          if (qcSearchTerm.trim()) {
            const term = qcSearchTerm.toLowerCase();
            const matchUser = log.consumedBy.toLowerCase().includes(term);
            const matchDept = log.department.toLowerCase().includes(term);
            const matchCab = (log.cabinetName || "").toLowerCase().includes(term);
            const matchNote = (log.note || "").toLowerCase().includes(term);
            const matchItem = log.items.some(i => 
              i.name.toLowerCase().includes(term) || (i.cabinetName || "").toLowerCase().includes(term)
            );
            if (!matchUser && !matchDept && !matchCab && !matchNote && !matchItem) return false;
          }

          return true;
        });

        const handleExportCSV = () => {
          const rows = [
            ["วันที่และเวลา", "ผู้ทำรายการ", "ช่องทางการเบิก", "แผนกที่เบิก", "ตู้เก็บของ", "ชื่อสินค้า", "จำนวนที่เบิก", "หน่วยนับ", "หมายเหตุ/วัตถุประสงค์"]
          ];
          filteredLogs.forEach(log => {
            const dateStr = new Date(log.consumedAt?.toDate?.() || log.consumedAt).toLocaleString("th-TH");
            const sourceStr = log.source === "CABINET_QR" ? "เบิกผ่าน QR ตู้" : log.source === "QC" ? "QC หยิบใช้" : "เบิกทั่วไป";
            log.items.forEach(item => {
              rows.push([
                `"${dateStr}"`,
                `"${log.consumedBy}"`,
                `"${sourceStr}"`,
                `"${log.department}"`,
                `"${item.cabinetName || log.cabinetName || ""}"`,
                `"${item.name}"`,
                `"${item.qtyTaken}"`,
                `"${item.unit}"`,
                `"${(log.note || "").replace(/"/g, '""')}"`
              ]);
            });
          });

          const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `ประวัติการเบิกพัสดุ_${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        return (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    ประวัติเบิกทั้งหมด
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 block">
                    {totalEvents} <span className="text-xs font-semibold text-slate-400">ครั้ง</span>
                  </span>
                </div>
                <div className="h-11 w-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
                  <Activity className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-orange-100 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider block">
                    เบิกผ่าน QR ตู้
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold text-orange-600 mt-1 block">
                    {cabinetQrEvents} <span className="text-xs font-semibold text-orange-400">ครั้ง</span>
                  </span>
                </div>
                <div className="h-11 w-11 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                  <PackageMinus className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-purple-100 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">
                    QC หยิบใช้ตรง
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold text-purple-600 mt-1 block">
                    {qcDirectEvents} <span className="text-xs font-semibold text-purple-400">ครั้ง</span>
                  </span>
                </div>
                <div className="h-11 w-11 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                  <Activity className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-100 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">
                    ยอดพัสดุที่เบิกออกรวม
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold text-rose-600 mt-1 block">
                    {totalUnits} <span className="text-xs font-semibold text-rose-400">ชิ้น/หน่วย</span>
                  </span>
                </div>
                <div className="h-11 w-11 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Filter and Search Toolbar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                {/* Search input */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อสินค้า, ผู้เบิก, หรือหมายเหตุ..."
                    value={qcSearchTerm}
                    onChange={(e) => setQcSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  {qcSearchTerm && (
                    <button 
                      onClick={() => setQcSearchTerm("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Source Filter */}
                <select
                  value={qcSourceFilter}
                  onChange={(e) => setQcSourceFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="ALL">ทุกช่องทางการเบิก</option>
                  <option value="CABINET_QR">📦 เบิกผ่าน QR ตู้ (Cabinet QR)</option>
                  <option value="QC">🔬 QC หยิบใช้ตรง</option>
                </select>

                {/* Department Filter */}
                <select
                  value={qcDeptFilter}
                  onChange={(e) => setQcDeptFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="ALL">ทุกแผนกที่เบิก</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>

                {/* Cabinet Filter */}
                <select
                  value={qcCabinetFilter}
                  onChange={(e) => setQcCabinetFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="ALL">ทุกตู้เก็บของ</option>
                  {cabinets.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={filteredLogs.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer shadow-2xs transition-all disabled:opacity-40"
                  title="ดาวน์โหลดรายการเบิกเป็นไฟล์ CSV / Excel"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>ส่งออก CSV</span>
                </button>
                {qcLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setClearHistoryInitialType("QC");
                      setShowClearHistoryModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl cursor-pointer shadow-2xs transition-all"
                    title="ล้างประวัติการเบิกและหยิบใช้ของทั้งหมดหรือตามช่วงเวลา"
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                    <span>ล้างประวัติการเบิก</span>
                  </button>
                )}
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                    <span>ตารางประวัติการเบิกและหยิบใช้พัสดุ</span>
                    <span className="bg-purple-100 text-purple-800 font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase">
                      แสดง {filteredLogs.length} จาก {qcLogs.length} รายการ
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    บันทึกการเบิกของออกจากตู้ผ่าน QR Code, ฝ่าย QC และการเบิกใช้ของทีมงานทั้งหมด
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-5">วันที่ & เวลาเบิก</th>
                      <th className="py-3.5 px-5">ผู้ทำรายการเบิก</th>
                      <th className="py-3.5 px-5">ช่องทาง & ตู้เก็บของ</th>
                      <th className="py-3.5 px-5">แผนก</th>
                      <th className="py-3.5 px-5">รายการสินค้าที่เบิก</th>
                      <th className="py-3.5 px-5 text-right">จำนวนที่เบิก</th>
                      <th className="py-3.5 px-5">หมายเหตุ / วัตถุประสงค์</th>
                      <th className="py-3.5 px-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-14 text-center text-slate-400">
                          <PackageMinus className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                          <p className="font-semibold text-slate-600">ไม่พบรายการเบิกพัสดุตามเงื่อนไขที่เลือก</p>
                          <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนตัวกรอง หรือสแกน QR Code ประจำตู้เพื่อทดสอบการเบิกของ</p>
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map(log => {
                        const dateStr = new Date(log.consumedAt?.toDate?.() || log.consumedAt).toLocaleString("th-TH", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        });
                        const isCabinetQr = log.source === "CABINET_QR";
                        const isQc = log.source === "QC" || !log.source;

                        return (
                          <React.Fragment key={log.id}>
                            {log.items.map((item, idx) => {
                              // Match consumable image
                              const matchedConsumable = consumables.find(c => c.id === item.consumableId || c.name === item.name);
                              const imageUrl = item.imageUrl || matchedConsumable?.imageUrl;
                              const displayCabName = item.cabinetName || log.cabinetName || "ตู้ส่วนกลาง";

                              return (
                                <tr key={`${log.id}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                                  {/* Grouped metadata on first row of log */}
                                  {idx === 0 && (
                                    <>
                                      <td className="py-3.5 px-5 font-semibold text-slate-800 whitespace-nowrap align-top" rowSpan={log.items.length}>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                          <span>{dateStr}</span>
                                        </div>
                                      </td>
                                      
                                      <td className="py-3.5 px-5 align-top" rowSpan={log.items.length}>
                                        <div className="flex flex-col">
                                          <span className="font-extrabold text-slate-900">{log.consumedBy.split("@")[0]}</span>
                                          <span className="text-[10px] text-slate-400 font-mono">{log.consumedBy}</span>
                                        </div>
                                      </td>

                                      <td className="py-3.5 px-5 align-top" rowSpan={log.items.length}>
                                        <div className="flex flex-col gap-1 items-start">
                                          {isCabinetQr ? (
                                            <span className="bg-orange-50 border border-orange-200 text-orange-700 font-bold text-[10px] px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                              <QrCode className="h-3 w-3" />
                                              <span>เบิกผ่าน QR ตู้</span>
                                            </span>
                                          ) : isQc ? (
                                            <span className="bg-purple-50 border border-purple-200 text-purple-700 font-bold text-[10px] px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                              <Activity className="h-3 w-3" />
                                              <span>QC หยิบใช้ตรง</span>
                                            </span>
                                          ) : (
                                            <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[10px] px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                              <PackageMinus className="h-3 w-3" />
                                              <span>เบิกทั่วไป</span>
                                            </span>
                                          )}
                                          <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
                                            <MapPin className="h-3 w-3 text-slate-400" />
                                            {displayCabName}
                                          </span>
                                        </div>
                                      </td>

                                      <td className="py-3.5 px-5 align-top" rowSpan={log.items.length}>
                                        <span className="bg-slate-100 border border-slate-200 text-slate-800 font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                          {log.department}
                                        </span>
                                      </td>
                                    </>
                                  )}

                                  {/* Item specific column */}
                                  <td className="py-3.5 px-5">
                                    <div className="flex items-center gap-3">
                                      {imageUrl && (
                                        <button
                                          type="button"
                                          onClick={() => setPreviewModalImage({
                                            url: imageUrl,
                                            title: item.name,
                                            subtitle: `ตู้: ${displayCabName} • แผนก: ${log.department}`
                                          })}
                                          className="h-10 w-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative group/pic cursor-pointer"
                                          title="คลิกเพื่อดูรูปภาพของจริงขนาดใหญ่"
                                        >
                                          <img 
                                            src={imageUrl} 
                                            alt={item.name} 
                                            className="w-full h-full object-cover group-hover/pic:scale-110 transition-all"
                                            referrerPolicy="no-referrer"
                                          />
                                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/pic:opacity-100 transition-opacity flex items-center justify-center text-white">
                                            <Eye className="h-3 w-3" />
                                          </div>
                                        </button>
                                      )}
                                      <div className="flex flex-col">
                                        <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{item.name}</span>
                                        <span className="text-[10px] text-slate-400 font-semibold">ตู้: {displayCabName}</span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Quantity column */}
                                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg text-xs">
                                      <TrendingDown className="h-3.5 w-3.5" />
                                      - {item.qtyTaken} {item.unit}
                                    </span>
                                  </td>

                                  {/* Note column */}
                                  {idx === 0 && (
                                    <>
                                      <td className="py-3.5 px-5 align-top text-xs text-slate-600 max-w-xs" rowSpan={log.items.length}>
                                        {log.note ? (
                                          <span className="bg-slate-50 border border-slate-200/60 p-2 rounded-xl block text-slate-700 italic">
                                            "{log.note}"
                                          </span>
                                        ) : (
                                          <span className="text-slate-300 font-mono">—</span>
                                        )}
                                      </td>
                                      <td className="py-3.5 px-4 align-top text-center" rowSpan={log.items.length}>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSingleQcLog(log.id, log.department, log.items.length)}
                                          disabled={deletingQcLogId === log.id}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                                          title="ลบประวัติการเบิกรายการนี้"
                                        >
                                          {deletingQcLogId === log.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                                          ) : (
                                            <Trash className="h-4 w-4" />
                                          )}
                                        </button>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. USER ROLES & PERMISSIONS TAB (SUPER ADMIN ONLY) */}
      {activeTab === "users" && (
        <UserRoleManagement
          currentUserEmail={userEmail}
          isSuperAdmin={isUserSuperAdmin}
          onToast={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />
      )}

      {/* 6. DEPARTMENT SETTINGS TAB (ADMIN & SUPER ADMIN) */}
      {activeTab === "settings" && (
        <DepartmentSettings
          departments={departments}
          cabinets={cabinets}
          consumables={consumables}
          currentUserEmail={userEmail}
          isSuperAdmin={isUserSuperAdmin}
          onRefresh={async () => {
            const depts = await getDepartments();
            setDepartments(depts);
          }}
          onToast={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />
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
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    กำหนดแผนกที่ดูแล / เข้าตรวจเช็ก (เลือกได้มากกว่า 1)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCabinetModal(false);
                      setActiveTab("settings");
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    + จัดการแผนก
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {availableDepartmentNames.map(dept => {
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

              {/* Cabinet Image with Upload / Camera / Presets */}
              <ImageUploadInput
                label="รูปภาพตู้เก็บพัสดุ (ถ่ายรูปจริง หรือเลือกตัวอย่าง)"
                helperText="รูปถ่ายจริงช่วยให้เจ้าหน้าที่ค้นหาตู้ในโรงงานได้ง่ายและแม่นยำ"
                value={cabinetForm.photoUrl}
                onChange={(newUrl) => setCabinetForm({ ...cabinetForm, photoUrl: newUrl })}
                presets={CABINET_PRESETS.map((url, idx) => ({
                  key: `cab-${idx}`,
                  label: idx === 0 ? "ตู้ล็อกเกอร์เหล็ก" : idx === 1 ? "ชั้นวางอะไหล่" : idx === 2 ? "กล่องอุตสาหกรรม" : "ตู้ช็อปช่าง",
                  url
                }))}
                onPreviewFullImage={(url) => setPreviewModalImage({ url, title: cabinetForm.name || "ตู้เก็บของ", subtitle: cabinetForm.location })}
              />

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
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="con-dept-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      แผนกรับผิดชอบ
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConsumableModal(false);
                        setActiveTab("settings");
                      }}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                    >
                      + จัดการแผนก
                    </button>
                  </div>
                  <select
                    id="con-dept-select"
                    value={consumableForm.department}
                    onChange={(e) => setConsumableForm({ ...consumableForm, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                  >
                    {availableDepartmentNames.map(d => (
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

              {/* Stock Quantity, Minimum and Maximum Thresholds */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-indigo-600" />
                    กำหนดจำนวนสต็อกและเกณฑ์ควบคุม (Min / Max)
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">หน่วย: {consumableForm.unit || "ชิ้น"}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Current Qty */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label htmlFor="con-qty-input" className="block text-[11px] font-bold text-slate-700 mb-1">
                      สต็อกคงเหลือปัจจุบัน
                    </label>
                    <input
                      id="con-qty-input"
                      type="number"
                      min="0"
                      value={consumableForm.currentQty}
                      onChange={(e) => setConsumableForm({ ...consumableForm, currentQty: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-black text-slate-800"
                    />
                    <span className="text-[9px] text-slate-400 mt-1 block">จำนวนที่มีอยู่ในตู้จริงขณะนี้</span>
                  </div>

                  {/* Minimum Threshold */}
                  <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/80 shadow-2xs">
                    <label htmlFor="con-threshold-input" className="block text-[11px] font-bold text-amber-900 mb-1 flex items-center justify-between">
                      <span>สต็อกขั้นต่ำ (Min)</span>
                      <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-extrabold">เตือนสั่งซื้อ</span>
                    </label>
                    <input
                      id="con-threshold-input"
                      type="number"
                      min="0"
                      value={consumableForm.minThreshold}
                      onChange={(e) => setConsumableForm({ ...consumableForm, minThreshold: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm font-black text-amber-800 bg-white"
                    />
                    <span className="text-[9px] text-amber-700 mt-1 block">ถ้า ≤ ค่านี้ จะเตือน "ของใกล้หมด"</span>
                  </div>

                  {/* Maximum Capacity */}
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200/80 shadow-2xs">
                    <label htmlFor="con-max-input" className="block text-[11px] font-bold text-blue-900 mb-1 flex items-center justify-between">
                      <span>สต็อกสูงสุด (Max)</span>
                      <span className="text-[9px] bg-blue-100 text-blue-800 px-1 rounded font-extrabold">ความจุตู้</span>
                    </label>
                    <input
                      id="con-max-input"
                      type="number"
                      min="1"
                      value={consumableForm.maxCapacity}
                      onChange={(e) => setConsumableForm({ ...consumableForm, maxCapacity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-black text-blue-800 bg-white"
                    />
                    <span className="text-[9px] text-blue-700 mt-1 block">ความจุสูงสุด / สต็อกเต็มตู้</span>
                  </div>
                </div>

                {/* Live Preview of Stock Status based on Min and Max */}
                {(() => {
                  const qty = consumableForm.currentQty;
                  const min = consumableForm.minThreshold;
                  const max = Math.max(min, consumableForm.maxCapacity || 1);
                  const pct = Math.min(Math.round((qty / max) * 100), 100);
                  const isLow = qty <= min && qty > 0;
                  const isOutOfStock = qty === 0;
                  const isOver = qty > max;

                  return (
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-600">สถานะตัวอย่าง:</span>
                        {isOutOfStock ? (
                          <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            หมดสต็อก (0 {consumableForm.unit})
                          </span>
                        ) : isLow ? (
                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                            ของใกล้หมด (≤ Min: {min} {consumableForm.unit})
                          </span>
                        ) : isOver ? (
                          <span className="text-[10px] font-extrabold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                            สต็อกล้นตู้ (&gt; Max: {max} {consumableForm.unit})
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            สต็อกสมดุลปกติ ({qty}/{max} {consumableForm.unit})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-black text-slate-600">{pct}% ความจุ</span>
                    </div>
                  );
                })()}
              </div>

              {/* Consumable Image with Upload / Camera / Presets */}
              <ImageUploadInput
                label="รูปภาพพัสดุ / วัสดุสิ้นเปลือง (ถ่ายรูปจริง หรือเลือกตัวอย่าง)"
                helperText="รูปถ่ายจริงช่วยให้ Helper ตรวจนับสต็อกได้รวดเร็ว ชัดเจน ไม่สับสนรุ่น/ขนาด"
                value={consumableForm.imageUrl}
                onChange={(newUrl) => setConsumableForm({ ...consumableForm, imageUrl: newUrl })}
                presets={Object.entries(CONSUMABLE_PRESETS).map(([key, url]) => {
                  const labels: Record<string, string> = {
                    glove: "ถุงมือยาง",
                    mask: "หน้ากากอนามัย",
                    alcohol: "แอลกอฮอล์สเปรย์",
                    tape: "เทปพันเกลียว",
                    paper: "กระดาษทิชชู่",
                    grease: "จาระบี/น้ำมัน",
                    goggles: "แว่นตานิรภัย",
                    tubes: "หลอดทดลอง/ขวด"
                  };
                  return {
                    key,
                    label: labels[key] || key,
                    url
                  };
                })}
                onPreviewFullImage={(url) => setPreviewModalImage({ 
                  url, 
                  title: consumableForm.name || "วัสดุสิ้นเปลือง", 
                  subtitle: `หน่วย: ${consumableForm.unit || "ชิ้น"}` 
                })}
              />

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

      {/* C. QR PRINT & CONFIG MODAL (COUNT, WITHDRAW, DUAL) */}
      {showQRModal && qrCabinet && (
        <CabinetQRModal
          cabinet={qrCabinet}
          onClose={() => {
            setShowQRModal(false);
            setQrCabinet(null);
          }}
        />
      )}

      {/* D. CLEAR HISTORY MODAL */}
      {showClearHistoryModal && (
        <ClearHistoryModal
          initialType={clearHistoryInitialType}
          totalCountLogs={countLogs.length}
          totalQcLogs={qcLogs.length}
          onClose={() => setShowClearHistoryModal(false)}
          onSuccess={async (summary) => {
            setToastMessage(summary);
            setTimeout(() => setToastMessage(null), 4000);
            // Refresh data
            const histories = await getCountHistory();
            setCountLogs(histories);
            setSelectedLog(null);
            const qcHistories = await getQCConsumptionHistory();
            setQcLogs(qcHistories);
          }}
        />
      )}

      {/* FULL IMAGE PREVIEW MODAL */}
      {previewModalImage && (
        <ImagePreviewModal
          imageUrl={previewModalImage.url}
          title={previewModalImage.title}
          subtitle={previewModalImage.subtitle}
          onClose={() => setPreviewModalImage(null)}
        />
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
