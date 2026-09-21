import React, { useState, useEffect } from "react";
import { Cabinet, Consumable, CountHistory, QCConsumptionHistory, DepartmentRecord, MasterConsumable } from "../types";
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
  getMasterConsumables,
  addMasterConsumable,
  CABINET_PRESETS,
  CONSUMABLE_PRESETS
} from "../lib/dbService";
import { isItemLowStock } from "../lib/stockUtils";
import { getActiveFirebaseConfig } from "../lib/firebase";
import UserRoleManagement from "./UserRoleManagement";
import DepartmentSettings from "./DepartmentSettings";
import ImageUploadInput from "./ImageUploadInput";
import ImagePreviewModal from "./ImagePreviewModal";
import CabinetQRModal from "./CabinetQRModal";
import ClearHistoryModal from "./ClearHistoryModal";
import DepartmentConsumablesView from "./DepartmentConsumablesView";
import PurchaseOrderView from "./PurchaseOrderView";
import MasterCatalogView from "./MasterCatalogView";
import { 
  Plus, 
  Edit, 
  Trash, 
  Trash2, 
  QrCode, 
  AlertTriangle, 
  Package, 
  Boxes, 
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
  Users,
  Crown,
  ShieldCheck,
  Building2,
  Camera,
  PackageMinus,
  Download,
  Filter,
  FileSpreadsheet,
  ShoppingCart,
  ChevronRight,
  FileText,
  MoreHorizontal,
  Lightbulb,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Layers
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
  const [masterConsumables, setMasterConsumables] = useState<MasterConsumable[]>([]);
  const [countLogs, setCountLogs] = useState<CountHistory[]>([]);
  const [qcLogs, setQcLogs] = useState<QCConsumptionHistory[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  
  // Loading & View States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"department_consumables" | "purchase_orders" | "cabinets" | "history" | "qc" | "users" | "settings">("department_consumables");
  const [settingsSubTab, setSettingsSubTab] = useState<"departments" | "master_catalog">("departments");
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
  const [selectedMasterId, setSelectedMasterId] = useState<string>("");
  const [saveToMasterCatalog, setSaveToMasterCatalog] = useState(false);
  const [consumableForm, setConsumableForm] = useState({
    name: "",
    department: "CMT",
    currentQty: 10,
    minThreshold: 5,
    maxThreshold: 50,
    unit: "ชิ้น",
    imageUrl: CONSUMABLE_PRESETS["glove"],
    masterId: undefined as string | undefined
  });
  const [isSavingConsumable, setIsSavingConsumable] = useState(false);
  const [consumableError, setConsumableError] = useState<string | null>(null);

  // Unified Consumption & Dispense History Filters
  const [qcSourceFilter, setQcSourceFilter] = useState<string>("ALL");
  const [qcDeptFilter, setQcDeptFilter] = useState<string>("ALL");
  const [qcCabinetFilter, setQcCabinetFilter] = useState<string>("ALL");
  const [qcSearchTerm, setQcSearchTerm] = useState<string>("");

  // Notifications & UI Helpers
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(() => {
    try {
      return localStorage.getItem("hide_admin_onboarding") !== "true";
    } catch {
      return true;
    }
  });

  const handleToggleOnboarding = () => {
    setShowOnboardingGuide(prev => {
      const next = !prev;
      try {
        localStorage.setItem("hide_admin_onboarding", next ? "false" : "true");
      } catch {}
      return next;
    });
  };
  const [dismissCloudNotice, setDismissCloudNotice] = useState(false);
  const [showCloudGuideModal, setShowCloudGuideModal] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
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
        const masters = await getMasterConsumables();
        setMasterConsumables(masters);
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

  // Departments List (dynamic from database with fallback, strictly omitting Production)
  const availableDepartmentNames = departments.length > 0
    ? departments.map(d => d.name).filter(n => n.toLowerCase() !== "production")
    : ["CMT", "DNM", "WL", "SBS", "QC"];

  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      try {
        const [depts, cabs, items, histories, qcHistories, masters] = await Promise.all([
          getDepartments(),
          getCabinets(),
          getConsumables(),
          getCountHistory(),
          getQCConsumptionHistory(),
          getMasterConsumables()
        ]);

        const activeDepts = depts.filter(d => d.name.toLowerCase() !== "production");
        setDepartments(activeDepts);
        setCabinets(cabs);

        // Auto-migrate any items with legacy "Production" department to their cabinet department or CMT
        const hasLegacyProd = items.some(c => c.department?.toLowerCase() === "production");
        if (hasLegacyProd) {
          const updatedItems = items.map(c => {
            if (c.department?.toLowerCase() === "production") {
              const cab = cabs.find(cb => cb.id === c.cabinetId);
              const targetDept = cab?.departments?.[0] || activeDepts[0]?.name || "CMT";
              updateConsumable(c.id, { department: targetDept }).catch(() => {});
              return { ...c, department: targetDept };
            }
            return c;
          });
          setConsumables(updatedItems);
        } else {
          setConsumables(items);
        }

        setCountLogs(histories);
        setQcLogs(qcHistories);
        setMasterConsumables(masters);
      } catch (err) {
        console.error("Error loading admin dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, [refreshTrigger]);

  const triggerRefresh = () => setRefreshTrigger(p => p + 1);

  // Critical items check (accurately accounting for max capacity)
  const criticalItems = consumables.filter(item => isItemLowStock(item));

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
    if (confirm("คุณแน่ใจหรือไม่ที่จะลบตู้นี้? การลบตู้จะทำให้ตู้และรายการพัสดุทั้งหมดในตู้นี้ถูกลบอย่างถาวรทันที")) {
      try {
        // 1. Optimistic instant UI purge so cabinet never flickers or bounces back
        setCabinets(prev => prev.filter(c => c.id !== id));
        setConsumables(prev => prev.filter(c => c.cabinetId !== id));
        if (selectedCabinetId === id) {
          setSelectedCabinetId("");
        }
        // 2. Permanent deletion in storage and Cloud Tombstones
        await deleteCabinet(id);
        setToastMessage("ลบตู้เก็บของและรายการพัสดุในตู้เรียบร้อยอย่างถาวร");
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
        masterId: selectedMasterId || undefined,
        name: trimmedName,
        cabinetId: selectedCabinetId,
        lastUpdatedBy: userEmail
      };

      if (editingConsumable) {
        await updateConsumable(editingConsumable.id, payload);
        setToastMessage("อัปเดตข้อมูลวัสดุสิ้นเปลืองเรียบร้อย");
      } else {
        await addConsumable(payload);
        
        // If user opted to also save to Master Catalog
        if (saveToMasterCatalog && trimmedName) {
          const exists = masterConsumables.some(m => m.name.trim().toLowerCase() === trimmedName.toLowerCase());
          if (!exists) {
            try {
              await addMasterConsumable({
                code: "MAT-" + Math.floor(100 + Math.random() * 900),
                name: trimmedName,
                category: "ทั่วไป",
                unit: consumableForm.unit.trim() || "ชิ้น",
                imageUrl: consumableForm.imageUrl,
                defaultMinThreshold: consumableForm.minThreshold || 5,
                defaultMaxThreshold: consumableForm.maxThreshold || 25,
                description: `สร้างอัตโนมัติจากสต็อกแผนก ${consumableForm.department}`,
                createdBy: userEmail
              });
              const updatedMasters = await getMasterConsumables();
              setMasterConsumables(updatedMasters);
            } catch (e) {
              console.warn("Could not save to master catalog:", e);
            }
          }
        }
        setToastMessage("เพิ่มวัสดุสิ้นเปลืองลงในตู้สำเร็จเรียบร้อย!");
      }

      setShowConsumableModal(false);
      setEditingConsumable(null);
      setSelectedMasterId("");
      setSaveToMasterCatalog(false);
      const defaultDept = departments.find(d => d.name.toLowerCase() === "cmt")?.name 
        || departments[0]?.name 
        || "CMT";
      setConsumableForm({
        name: "",
        department: defaultDept,
        currentQty: 10,
        minThreshold: 5,
        maxThreshold: 50,
        unit: "ชิ้น",
        imageUrl: CONSUMABLE_PRESETS["glove"],
        masterId: undefined
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
    setSelectedMasterId(item.masterId || "");
    setSaveToMasterCatalog(false);
    setConsumableForm({
      name: item.name,
      department: item.department,
      currentQty: item.currentQty,
      minThreshold: item.minThreshold,
      maxThreshold: item.maxThreshold ?? (item.minThreshold ? item.minThreshold * 5 : 50),
      unit: item.unit,
      imageUrl: item.imageUrl,
      masterId: item.masterId
    });
    setShowConsumableModal(true);
  };

  // Deploy item from Master Catalog directly into a cabinet
  const handleDeployMasterToCabinet = async (
    masterItem: MasterConsumable,
    cabinetId: string,
    department: string,
    initialQty: number,
    minThresh: number,
    maxThresh: number
  ) => {
    await addConsumable({
      cabinetId,
      masterId: masterItem.id,
      name: masterItem.name,
      department,
      currentQty: initialQty,
      minThreshold: minThresh,
      maxThreshold: maxThresh,
      unit: masterItem.unit,
      imageUrl: masterItem.imageUrl,
      lastUpdatedBy: userEmail
    });
    triggerRefresh();
  };

  const handleDeleteConsumable = async (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ที่จะลบรายการวัสดุสิ้นเปลืองนี้?")) {
      try {
        // Optimistically remove from state immediately so it never flickers
        setConsumables(prev => prev.filter(c => c.id !== id));
        await deleteConsumable(id);
        triggerRefresh();
        setToastMessage("ลบรายการวัสดุสิ้นเปลืองเรียบร้อย");
        setTimeout(() => setToastMessage(null), 3000);
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

  // Direct qty update from department table stepper or restock button
  const handleUpdateQty = async (item: Consumable, newQty: number) => {
    const safeQty = Math.max(0, newQty);
    // Optimistic UI update
    setConsumables(prev => prev.map(c => c.id === item.id ? { ...c, currentQty: safeQty } : c));
    try {
      await updateConsumable(item.id, {
        currentQty: safeQty,
        lastUpdatedBy: userEmail
      });
    } catch (err) {
      console.error("Failed to update consumable quantity:", err);
      // Rollback on error
      setRefreshTrigger(prev => prev + 1);
      setToastMessage("เกิดข้อผิดพลาดในการบันทึกจำนวน กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleAddConsumableForDept = (deptName: string) => {
    setEditingConsumable(null);
    setSelectedMasterId("");
    setSaveToMasterCatalog(false);
    const targetDept = (deptName && deptName !== "ALL")
      ? deptName
      : (departments.find(d => d.name.toLowerCase() === "cmt")?.name || departments[0]?.name || "CMT");

    setConsumableForm({
      name: "",
      department: targetDept,
      currentQty: 10,
      minThreshold: 5,
      maxThreshold: 50,
      unit: "ชิ้น",
      imageUrl: CONSUMABLE_PRESETS["glove"],
      masterId: undefined
    });

    // Auto-select cabinet matching this department if available
    const matchingCab = cabinets.find(c => c.departments?.some(d => d.toLowerCase() === targetDept.toLowerCase()));
    if (matchingCab) {
      setSelectedCabinetId(matchingCab.id);
    } else if (cabinets.length > 0) {
      setSelectedCabinetId(cabinets[0].id);
    }
    setShowConsumableModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500">กำลังดึงข้อมูลแผงควบคุมแอดมิน...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 font-sans min-h-screen">
      
      {/* 1. TOP HERO BANNER & INTEGRATED STATS (APPLE LIQUID GLASS DARK SLAB) */}
      <div className="ios-glass-dark rounded-3xl p-5 sm:p-7 text-white shadow-2xl relative overflow-hidden mb-6 border border-white/20">
        {/* Soft background glow accents */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -top-10 w-52 h-52 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute left-10 -bottom-10 w-44 h-44 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Title & Info */}
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/15 text-indigo-200 border border-white/20 backdrop-blur-md shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-300" />
                โหมดผู้ดูแลระบบ (ADMIN TERMINAL)
              </span>
              {isUserSuperAdmin && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30 backdrop-blur-md shadow-xs">
                  <Crown className="h-3.5 w-3.5 text-amber-300" />
                  Super Admin
                </span>
              )}
              {getCloudSyncNotice().hasError ? (
                <button
                  onClick={() => setShowCloudGuideModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 cursor-pointer transition-colors backdrop-blur-md shadow-xs ios-press"
                  title="คลิกเพื่อดูวิธีเปิดสิทธิ์ Cloud Firestore (3 ขั้นตอน)"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                  <span>โหมด Local (คลิกเปิดสิทธิ์ Cloud)</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 backdrop-blur-md shadow-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  Cloud ซิงค์พร้อม
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-display">
              แดชบอร์ดบริหารตู้พัสดุและคลังสต็อกส่วนกลาง
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-normal">
              ยินดีต้อนรับคุณ <b className="text-white font-bold">{userEmail}</b> • ตรวจสอบสต็อก, สั่งซื้ออัตโนมัติ, จัดการตู้ และออกป้าย QR Code ติดหน้าตู้
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Guide Toggle */}
            <button
              onClick={handleToggleOnboarding}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border ios-press backdrop-blur-md ${
                showOnboardingGuide
                  ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/20"
                  : "bg-white/10 hover:bg-white/20 text-slate-100 border-white/20"
              }`}
              title="เปิด/ปิดคำแนะนำการใช้งานเริ่มต้น"
            >
              <Lightbulb className={`h-4 w-4 ${showOnboardingGuide ? "text-slate-950" : "text-amber-300"}`} />
              <span>{showOnboardingGuide ? "ซ่อนคำแนะนำ" : "แนะนำเริ่มต้น"}</span>
            </button>

            {/* Cloud Sync Button */}
            <button
              onClick={handleSyncToCloud}
              disabled={isSyncingCloud}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-75 text-white rounded-2xl text-xs font-bold transition-all border border-emerald-400/40 cursor-pointer shadow-md shadow-emerald-600/20 backdrop-blur-md ios-press"
              title="ซิงค์ข้อมูลจากเครื่องนี้ขึ้น Cloud Firestore"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingCloud ? "animate-spin" : ""}`} />
              <span>{isSyncingCloud ? "กำลังซิงค์..." : "ซิงค์ Cloud"}</span>
            </button>

            {/* Add Cabinet (Secondary) */}
            <button
              onClick={() => {
                setEditingCabinet(null);
                setCabinetForm({ name: "", location: "", departments: [], photoUrl: CABINET_PRESETS[0] });
                setShowCabinetModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-2xl text-xs font-bold transition-all border border-white/25 cursor-pointer backdrop-blur-md ios-press"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>เพิ่มตู้</span>
            </button>

            {/* Add Consumable (Primary High-Visibility) */}
            <button
              onClick={() => {
                setEditingConsumable(null);
                const firstCab = cabinets[0];
                const targetDept = firstCab?.departments?.[0]
                  || departments.find(d => d.name.toLowerCase() === "cmt")?.name
                  || departments[0]?.name
                  || "CMT";
                setConsumableForm({
                  name: "",
                  department: targetDept,
                  currentQty: 10,
                  minThreshold: 5,
                  unit: "ชิ้น",
                  imageUrl: CONSUMABLE_PRESETS["glove"]
                });
                if (cabinets.length > 0) setSelectedCabinetId(cabinets[0].id);
                setShowConsumableModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-lg shadow-emerald-400/25 cursor-pointer active:scale-98 ios-press"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>เพิ่มพัสดุ</span>
            </button>

            {/* More Options Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoreActions(!showMoreActions)}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl transition-all cursor-pointer backdrop-blur-md ios-press"
                title="ตัวเลือกเพิ่มเติม"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {showMoreActions && (
                <>
                  <div 
                    className="fixed inset-0 z-20"
                    onClick={() => setShowMoreActions(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-30 text-xs animate-scale-up text-slate-900">
                    <button
                      onClick={() => {
                        setShowMoreActions(false);
                        setShowCloudGuideModal(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <FileText className="h-4 w-4 text-amber-600" />
                      <span>วิธีตั้งค่า Cloud / Rules</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreActions(false);
                        setClearHistoryInitialType("ALL");
                        setShowClearHistoryModal(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Trash2 className="h-4 w-4 text-rose-600" />
                      <span>เคลียร์ประวัติเก่า...</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* QUICK STATS ROW INSIDE BANNER (APPLE LIQUID GLASS TILES) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-6 pt-5 border-t border-white/15">
          {/* Card 1: Consumables */}
          <div 
            onClick={() => setActiveTab("department_consumables")}
            className={`cursor-pointer transition-all backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 border ios-press ${
              activeTab === "department_consumables"
                ? "bg-white/25 border-white/60 ring-2 ring-white/40 shadow-xl shadow-indigo-950/20"
                : "bg-white/10 hover:bg-white/18 border-white/15"
            }`}
          >
            <div className="flex items-center justify-between text-slate-200 text-[11px] font-bold">
              <span>พัสดุในคลัง</span>
              <Package className="h-4 w-4 text-emerald-300" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">
              {consumables.length}
              <span className="text-xs font-normal text-slate-300 ml-1">รายการ</span>
            </div>
          </div>

          {/* Card 2: Departments & Master Catalog */}
          <div 
            onClick={() => {
              setSettingsSubTab("departments");
              setActiveTab("settings");
            }}
            className={`cursor-pointer transition-all backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 border ios-press ${
              activeTab === "settings"
                ? "bg-white/25 border-white/60 ring-2 ring-white/40 shadow-xl shadow-indigo-950/20"
                : "bg-white/10 hover:bg-white/18 border-white/15"
            }`}
          >
            <div className="flex items-center justify-between text-indigo-200 text-[11px] font-bold">
              <span>แผนก & พัสดุมาตรฐาน</span>
              <Building2 className="h-4 w-4 text-indigo-300" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-100 mt-1 flex items-baseline gap-1">
              <span>{departments.length}</span>
              <span className="text-xs font-normal text-indigo-200/80 mr-1">แผนก</span>
              <span className="text-xs font-normal text-indigo-200/50">•</span>
              <span className="text-base font-bold text-indigo-100 ml-1">{masterConsumables.length}</span>
              <span className="text-[11px] font-normal text-indigo-200/80">พัสดุกลาง</span>
            </div>
          </div>

          {/* Card 3: Cabinets */}
          <div 
            onClick={() => setActiveTab("cabinets")}
            className={`cursor-pointer transition-all backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 border ios-press ${
              activeTab === "cabinets"
                ? "bg-white/25 border-white/60 ring-2 ring-white/40 shadow-xl shadow-indigo-950/20"
                : "bg-white/10 hover:bg-white/18 border-white/15"
            }`}
          >
            <div className="flex items-center justify-between text-slate-200 text-[11px] font-bold">
              <span>ตู้จัดเก็บ & QR</span>
              <Building2 className="h-4 w-4 text-blue-300" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">
              {cabinets.length}
              <span className="text-xs font-normal text-slate-300 ml-1">ตู้</span>
            </div>
          </div>

          {/* Card 4: Critical / Out of Stock -> PO */}
          <div 
            onClick={() => setActiveTab("purchase_orders")}
            className={`cursor-pointer transition-all backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 border ios-press ${
              activeTab === "purchase_orders"
                ? "bg-rose-500/35 border-rose-400/70 ring-2 ring-rose-400/50 shadow-xl shadow-rose-950/30"
                : criticalItems.length > 0
                ? "bg-rose-500/20 hover:bg-rose-500/30 border-rose-400/40"
                : "bg-white/10 hover:bg-white/18 border-white/15"
            }`}
          >
            <div className="flex items-center justify-between text-rose-200 text-[11px] font-bold">
              <span>ขาด/ต้องสั่งเพิ่ม</span>
              <AlertTriangle className={`h-4 w-4 ${criticalItems.length > 0 ? "text-rose-400 animate-pulse" : "text-slate-300"}`} />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${criticalItems.length > 0 ? "text-rose-200" : "text-white"}`}>
              {criticalItems.length}
              <span className="text-xs font-normal text-rose-200/80 ml-1">ชนิด</span>
            </div>
          </div>

          {/* Card 5: QC Withdrawals */}
          <div 
            onClick={() => setActiveTab("qc")}
            className={`cursor-pointer transition-all backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 border ios-press ${
              activeTab === "qc"
                ? "bg-white/25 border-white/60 ring-2 ring-white/40 shadow-xl shadow-indigo-950/20"
                : "bg-white/10 hover:bg-white/18 border-white/15"
            }`}
          >
            <div className="flex items-center justify-between text-purple-200 text-[11px] font-bold">
              <span>ประวัติเบิกใช้</span>
              <Activity className="h-4 w-4 text-purple-300" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-200 mt-1">
              {qcLogs.length}
              <span className="text-xs font-normal text-purple-300/80 ml-1">ครั้ง</span>
            </div>
          </div>

          {/* Card 6: Audit History */}
          <div 
            onClick={() => setActiveTab("history")}
            className={`cursor-pointer transition-all backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 border ios-press ${
              activeTab === "history"
                ? "bg-white/25 border-white/60 ring-2 ring-white/40 shadow-xl shadow-indigo-950/20"
                : "bg-white/10 hover:bg-white/18 border-white/15"
            }`}
          >
            <div className="flex items-center justify-between text-amber-200 text-[11px] font-bold">
              <span>ประวัติตรวจนับ</span>
              <Clock className="h-4 w-4 text-amber-300" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-200 mt-1">
              {countLogs.length}
              <span className="text-xs font-normal text-amber-200/80 ml-1">รอบ</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ONBOARDING QUICK START GUIDE (3 EASY STEPS FOR FIRST-TIME ADMINS) */}
      {showOnboardingGuide && (
        <div className="mb-6 bg-gradient-to-br from-indigo-50/90 via-slate-50 to-emerald-50/70 rounded-3xl p-5 sm:p-6 border border-indigo-100 shadow-xs relative animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                <Lightbulb className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  คำแนะนำการเริ่มต้นใช้งานระบบคลังพัสดุ (3 สเต็ปง่ายๆ ใน 1 นาที)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ทำตาม 3 ขั้นตอนนี้เพื่อให้ระบบพร้อมให้เจ้าหน้าที่และพนักงานเริ่มสแกนเบิกของได้ทันที
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleOnboarding}
              className="self-start sm:self-auto px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              เข้าใจแล้ว (ซ่อนคำแนะนำ)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Step 1 */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">1</span>
                  <span className="font-extrabold text-slate-900 text-xs sm:text-sm">สร้างตู้ & พิมพ์ QR ติดหน้าตู้</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  สร้างตู้เก็บของตามจุดติดตั้งในโรงงาน แล้วกดปุ่ม <b>"พิมพ์ป้าย QR Code"</b> เพื่อนำไปติดหน้าตู้ให้ทุกคนสแกน
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setEditingCabinet(null);
                    setCabinetForm({ name: "", location: "", departments: [], photoUrl: CABINET_PRESETS[0] });
                    setShowCabinetModal(true);
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>เพิ่มตู้ใหม่</span>
                </button>
                <button
                  onClick={() => setActiveTab("cabinets")}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  ดูตู้ทั้งหมด
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">2</span>
                  <span className="font-extrabold text-slate-900 text-xs sm:text-sm">ลงทะเบียนพัสดุ & จุดเตือน (Min)</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  ใส่รูปภาพ จำนวนคงเหลือ และเกณฑ์ขั้นต่ำ (Min Threshold) ระบบจะคำนวณและแจ้งเตือนสินค้าใกล้หมดให้อัตโนมัติ
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setEditingConsumable(null);
                    setShowConsumableModal(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>เพิ่มพัสดุ</span>
                </button>
                <button
                  onClick={() => setActiveTab("department_consumables")}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  ดูรายการสต็อก
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-purple-100 text-purple-800 font-black text-xs flex items-center justify-center">3</span>
                  <span className="font-extrabold text-slate-900 text-xs sm:text-sm">สแกนเบิก & สั่งซื้ออัตโนมัติ (Auto PO)</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  ผู้ใช้สแกน QR เพื่อเบิกของได้เลย ระบบจะตัดยอดทันที หากมีของขาด ระบบจะสรุปใน <b>"ใบสั่งซื้อพัสดุ"</b> ให้อัตโนมัติ
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setActiveTab("purchase_orders")}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>เปิดใบสั่งซื้อพัสดุ</span>
                </button>
                <button
                  onClick={() => setActiveTab("qc")}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  ใครเบิกอะไรบ้าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLOUD SYNC SUCCESS BANNER */}
      {syncSuccessMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4 text-xs animate-fade-in shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 shadow-xs">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-emerald-950 text-xs sm:text-sm">
                เชื่อมต่อ Cloud สำเร็จและซิงค์ข้อมูลขึ้นระบบคลาวด์เรียบร้อยแล้ว!
              </p>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
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

      {/* 3. DIRECT, SINGLE-LEVEL TAB NAVIGATION (APPLE LIQUID GLASS SEGMENTED BAR) */}
      <div className="ios-segmented rounded-2xl p-1.5 shadow-md shadow-slate-900/5 mb-6">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {/* Tab 1: Consumables & Stock */}
          <button
            onClick={() => setActiveTab("department_consumables")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ios-press ${
              activeTab === "department_consumables"
                ? "bg-white/95 text-slate-900 shadow-md shadow-slate-300/40 border border-white font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <Package className="h-4 w-4 text-emerald-500" />
            <span>พัสดุ & สต็อกแผนก</span>
            {criticalItems.length > 0 ? (
              <span className="px-1.5 py-0.2 text-[9px] font-black bg-rose-500 text-white rounded-full animate-pulse">
                ขาด {criticalItems.length}
              </span>
            ) : (
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                activeTab === "department_consumables" ? "bg-slate-100 text-slate-700" : "bg-white/60 text-slate-500"
              }`}>
                {consumables.length}
              </span>
            )}
          </button>

          {/* Tab 2: Cabinets & QR */}
          <button
            onClick={() => setActiveTab("cabinets")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ios-press ${
              activeTab === "cabinets"
                ? "bg-white/95 text-slate-900 shadow-md shadow-slate-300/40 border border-white font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <Building2 className="h-4 w-4 text-blue-500" />
            <span>ตู้จัดเก็บ & QR</span>
            <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
              activeTab === "cabinets" ? "bg-slate-100 text-slate-700" : "bg-white/60 text-slate-500"
            }`}>
              {cabinets.length}
            </span>
          </button>

          {/* Tab 3: Purchase Orders */}
          <button
            onClick={() => setActiveTab("purchase_orders")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ios-press ${
              activeTab === "purchase_orders"
                ? "bg-white/95 text-slate-900 shadow-md shadow-slate-300/40 border border-white font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <ShoppingCart className="h-4 w-4 text-amber-500" />
            <span>ใบสั่งซื้อพัสดุ (Auto PO)</span>
            {criticalItems.length > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] font-black bg-rose-500 text-white rounded-full animate-pulse">
                ขาด {criticalItems.length}
              </span>
            )}
          </button>

          {/* Tab 4: QC Withdrawals (ใครเบิกอะไรบ้าง) */}
          <button
            onClick={() => setActiveTab("qc")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ios-press ${
              activeTab === "qc"
                ? "bg-white/95 text-slate-900 shadow-md shadow-slate-300/40 border border-white font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <Activity className="h-4 w-4 text-purple-500" />
            <span>ใครเบิกอะไรบ้าง</span>
            <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
              activeTab === "qc" ? "bg-slate-100 text-slate-700" : "bg-white/60 text-slate-500"
            }`}>
              {qcLogs.length}
            </span>
          </button>

          {/* Tab 5: Count History */}
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ios-press ${
              activeTab === "history"
                ? "bg-white/95 text-slate-900 shadow-md shadow-slate-300/40 border border-white font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <Clock className="h-4 w-4 text-amber-500" />
            <span>ประวัติตรวจนับ</span>
            <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
              activeTab === "history" ? "bg-slate-100 text-slate-700" : "bg-white/60 text-slate-500"
            }`}>
              {countLogs.length}
            </span>
          </button>

          {/* Tab 6: Department Settings & Master Catalog */}
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ios-press ${
              activeTab === "settings"
                ? "bg-white/95 text-slate-900 shadow-md shadow-slate-300/40 border border-white font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <Settings className="h-4 w-4 text-slate-500" />
            <span>จัดการแผนก & พัสดุมาตรฐาน</span>
            <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
              activeTab === "settings" ? "bg-slate-100 text-slate-700" : "bg-white/60 text-slate-500"
            }`}>
              {departments.length} แผนก
            </span>
          </button>

          {/* Tab 7: User Management (Super Admin only) */}
          {isUserSuperAdmin && (
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ios-press ${
                activeTab === "users"
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/25 border border-amber-400 font-extrabold"
                  : "text-amber-800 hover:bg-amber-100/50"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>จัดการสิทธิ์ผู้ใช้</span>
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                activeTab === "users" ? "bg-amber-600 text-white" : "bg-amber-100/80 text-amber-900"
              }`}>
                Admin
              </span>
            </button>
          )}
        </div>
      </div>

      {/* SEARCH CONTROLS FOR CABINETS TAB */}
      {activeTab === "cabinets" && (
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อตู้, ตำแหน่งที่ตั้ง..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs transition-all shadow-2xs"
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
                  <div key={cabinet.id} className="ios-glass-card rounded-3xl overflow-hidden border border-white/80 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:border-indigo-300 transition-all duration-300 flex flex-col justify-between">
                    <div>
                      {/* Photo Header */}
                      <div 
                        className="relative h-44 bg-slate-100/60 cursor-pointer group overflow-hidden"
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
                        <div className="absolute inset-0 bg-slate-950/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                          <span className="px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[11px] font-bold text-slate-900 shadow-md flex items-center gap-1.5">
                            <Eye className="h-3.5 w-3.5 text-indigo-600" /> ดูรูปใหญ่
                          </span>
                        </div>
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                          {cabinet.departments.map(d => (
                            <span key={d} className="bg-indigo-600/85 backdrop-blur-md text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs border border-white/20">
                              {d}
                            </span>
                          ))}
                        </div>
                        {lowItemsCount > 0 && (
                          <div className="absolute top-3 right-3 bg-rose-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md animate-pulse border border-white/20">
                            <AlertTriangle className="h-3 w-3" />
                            วิกฤต {lowItemsCount}
                          </div>
                        )}
                      </div>

                      {/* Info body */}
                      <div className="p-5">
                        <h3 className="font-black text-slate-900 text-base leading-snug mb-1">
                          {cabinet.name}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 font-medium mb-3.5">
                          <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span>{cabinet.location}</span>
                        </p>

                        {/* Items preview box */}
                        <div className="bg-white/60 backdrop-blur-md rounded-2xl p-3 border border-white/80 space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between pb-1 border-b border-slate-100">
                            <span>พัสดุในตู้นี้</span>
                            <span className="font-extrabold text-indigo-600">{cabinetItems.length} ชนิด</span>
                          </div>
                          {cabinetItems.length === 0 ? (
                            <span className="text-xs text-slate-400 block italic py-1">ตู้ยังว่างเปล่า ไม่มีสินค้าจัดสรร</span>
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
                            <span className="text-[10px] text-indigo-600 font-bold block pt-1 cursor-pointer hover:underline" onClick={() => { setActiveTab("department_consumables"); }}>
                              ดูวัสดุสิ้นเปลืองอีก {cabinetItems.length - 3} ชนิด เพิ่มเติม...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Operations */}
                    <div className="bg-white/50 backdrop-blur-md border-t border-white/80 p-3.5 flex items-center justify-between gap-1">
                      <button
                        onClick={() => {
                          setQrCabinet(cabinet);
                          setShowQRModal(true);
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/90 border border-indigo-200/80 px-3 py-1.5 rounded-xl cursor-pointer transition-all ios-press shadow-2xs"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        พิมพ์ QR ตู้
                      </button>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleEditCabinet(cabinet)}
                          className="p-2 bg-white/80 text-slate-600 hover:text-slate-900 border border-white/90 hover:border-indigo-200 rounded-xl cursor-pointer transition-all ios-press shadow-2xs"
                          title="แก้ไขรายละเอียดตู้"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCabinet(cabinet.id)}
                          className="p-2 bg-white/80 text-rose-500 hover:text-rose-700 border border-white/90 hover:border-rose-200 rounded-xl cursor-pointer transition-all ios-press shadow-2xs"
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

      {/* 2. DEPARTMENT CONSUMABLES TAB (Matching Image 1) */}
      {activeTab === "department_consumables" && (
        <DepartmentConsumablesView
          departments={departments}
          cabinets={cabinets}
          consumables={consumables}
          currentUserEmail={userEmail}
          onUpdateQty={handleUpdateQty}
          onEditConsumable={handleEditConsumable}
          onDeleteConsumable={handleDeleteConsumable}
          onAddConsumableForDept={handleAddConsumableForDept}
          onPreviewImage={(img) => setPreviewModalImage(img)}
          getCabinetName={getCabinetName}
          onToast={(msg) => setToastMessage(msg)}
        />
      )}


      {/* 3. PURCHASE ORDERS (AUTO STOCK REFILL) TAB (Matching Image 3) */}
      {activeTab === "purchase_orders" && (
        <PurchaseOrderView
          departments={departments}
          cabinets={cabinets}
          consumables={consumables}
          onUpdateQty={handleUpdateQty}
          getCabinetName={getCabinetName}
          onToast={(msg) => setToastMessage(msg)}
          currentUserEmail={userEmail}
        />
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
                        <span className="flex items-center gap-1 truncate max-w-[160px]" title={log.checkedBy}>
                          <Activity className="h-3 w-3 shrink-0" />
                          โดย: {log.checkedBy.includes("(") ? log.checkedBy.split("(")[0].trim() : log.checkedBy.split("@")[0]}
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

      {/* 6. DEPARTMENT SETTINGS & MASTER CATALOG TAB (ADMIN & SUPER ADMIN) */}
      {activeTab === "settings" && (
        <DepartmentSettings
          departments={departments}
          cabinets={cabinets}
          consumables={consumables}
          masterItems={masterConsumables}
          currentUserEmail={userEmail}
          isSuperAdmin={isUserSuperAdmin}
          activeSubTab={settingsSubTab}
          onSubTabChange={(sub) => setSettingsSubTab(sub)}
          onRefresh={async () => {
            const depts = await getDepartments();
            setDepartments(depts);
          }}
          onRefreshMasters={async () => {
            const masters = await getMasterConsumables();
            setMasterConsumables(masters);
            const items = await getConsumables();
            setConsumables(items);
          }}
          onDeployToCabinet={handleDeployMasterToCabinet}
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-scale-up my-auto">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-950">
                  {editingCabinet ? "แก้ไขตู้เก็บของพัสดุ" : "เพิ่มตู้เก็บของใหม่เข้าคลัง"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">กำหนดข้อมูล และระบุแผนกที่จะใช้งานตู้ใบนี้</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCabinetModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer shrink-0"
                title="ปิดหน้าต่าง"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCabinetSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden font-sans text-xs">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
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
              </div>

              {/* Pinned Action Buttons Footer */}
              <div className="flex gap-2.5 p-4 sm:p-5 border-t border-slate-100 bg-white shrink-0">
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
                    <span>{editingCabinet ? "บันทึกการแก้ไข" : "ตกลงและบันทึก"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. CONSUMABLE ADD/EDIT MODAL */}
      {showConsumableModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-scale-up my-auto">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-950">
                  {editingConsumable ? "แก้ไขพัสดุวัสดุสิ้นเปลือง" : "จัดสรรวัสดุสิ้นเปลืองเข้าตู้เก็บของ"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingConsumable 
                    ? "กำหนดตู้เก็บ, ระบุสต็อกเริ่มต้น, และตั้งค่าการแจ้งเตือนความปลอดภัย" 
                    : "กำหนดตู้เก็บ, ระบุสต็อกเริ่มต้น, และตั้งค่าการแจ้งเตือนความปลอดภัย"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConsumableModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer shrink-0"
                title="ปิดหน้าต่าง"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConsumableSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden font-sans text-xs">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {consumableError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                    <span>{consumableError}</span>
                  </div>
                )}

                {/* Master Catalog Quick Selection Card */}
                {!editingConsumable && (
                  <div className="p-3.5 bg-gradient-to-br from-indigo-50/90 via-blue-50/50 to-indigo-50/30 rounded-2xl border border-indigo-200/80 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                        <Boxes className="h-4 w-4 text-indigo-600" />
                        <span>เลือกจากแคตตาล็อกพัสดุมาตรฐาน (Master Catalog)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowConsumableModal(false);
                          setSettingsSubTab("master_catalog");
                          setActiveTab("settings");
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                      >
                        จัดการแคตตาล็อกกลาง ({masterConsumables.length})
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      หากเป็นพัสดุส่วนกลางที่ใช้ร่วมกัน สามารถคลิกเลือกเพื่อดึงชื่อ รูปถ่าย และหน่วยนับมาตรฐานได้ทันที:
                    </p>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedMasterId}
                        onChange={(e) => {
                          const mId = e.target.value;
                          setSelectedMasterId(mId);
                          if (mId) {
                            const chosen = masterConsumables.find(m => m.id === mId);
                            if (chosen) {
                              setConsumableForm(prev => ({
                                ...prev,
                                name: chosen.name,
                                unit: chosen.unit,
                                imageUrl: chosen.imageUrl,
                                minThreshold: chosen.defaultMinThreshold || prev.minThreshold,
                                maxThreshold: chosen.defaultMaxThreshold || prev.maxThreshold,
                                masterId: chosen.id
                              }));
                            }
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
                      >
                        <option value="">-- คลิกเลือกพัสดุมาตรฐาน ({masterConsumables.length} รายการ) --</option>
                        {masterConsumables.map(m => (
                          <option key={m.id} value={m.id}>
                            [{m.code || "STD"}] {m.name} ({m.category} • {m.unit})
                          </option>
                        ))}
                      </select>
                      {selectedMasterId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMasterId("");
                            setConsumableForm(prev => ({ ...prev, masterId: undefined }));
                          }}
                          className="px-2.5 py-2 text-[10px] font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer shrink-0"
                          title="ยกเลิกการผูกพัสดุมาตรฐาน เพื่อพิมพ์เองอิสระ"
                        >
                          ล้าง
                        </button>
                      )}
                    </div>

                    {selectedMasterId && (() => {
                      const chosen = masterConsumables.find(m => m.id === selectedMasterId);
                      if (!chosen) return null;
                      return (
                        <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-800 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>ดึงข้อมูลมาตรฐานของ <b>{chosen.name}</b> สำเร็จแล้ว (หน่วย: {chosen.unit})</span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div>
                  <label htmlFor="con-cabinet-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    เลือกจัดสรรลงตู้เก็บของ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="con-cabinet-select"
                    value={selectedCabinetId}
                    onChange={(e) => {
                      const newCabId = e.target.value;
                      setSelectedCabinetId(newCabId);
                      const selCab = cabinets.find(c => c.id === newCabId);
                      // Automatically sync department with the cabinet's primary department if not set
                      if (selCab && selCab.departments && selCab.departments.length > 0) {
                        if (!selCab.departments.includes(consumableForm.department)) {
                          setConsumableForm(prev => ({
                            ...prev,
                            department: selCab.departments[0]
                          }));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-medium text-slate-700"
                  >
                    <option value="" disabled>-- กรุณาเลือกตู้จัดเก็บ --</option>
                    {cabinets.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.location})</option>
                    ))}
                  </select>

                  {(() => {
                    const selCab = cabinets.find(c => c.id === selectedCabinetId);
                    if (selCab && selCab.departments && selCab.departments.length > 0) {
                      return (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-semibold">แผนกของตู้นี้:</span>
                          <div className="flex flex-wrap gap-1">
                            {selCab.departments.map(d => (
                              <button
                                type="button"
                                key={d}
                                onClick={() => setConsumableForm(prev => ({ ...prev, department: d }))}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                                  consumableForm.department?.toLowerCase() === d.toLowerCase()
                                    ? "bg-emerald-600 text-white shadow-2xs"
                                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                                }`}
                              >
                                ✓ {d} {consumableForm.department?.toLowerCase() === d.toLowerCase() ? "(เลือกอยู่)" : ""}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
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
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-800"
                    >
                      {!availableDepartmentNames.includes(consumableForm.department) && consumableForm.department && (
                        <option value={consumableForm.department}>{consumableForm.department}</option>
                      )}
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="con-qty-input" className="block text-xs font-semibold text-slate-600 mb-1">
                      สต็อกปัจจุบัน <span className="text-slate-400 font-normal">({consumableForm.unit || "หน่วย"})</span>
                    </label>
                    <input
                      id="con-qty-input"
                      type="number"
                      min="0"
                      value={consumableForm.currentQty}
                      onChange={(e) => setConsumableForm({ ...consumableForm, currentQty: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label htmlFor="con-threshold-input" className="block text-xs font-semibold text-rose-600 mb-1">
                      Minimum (ขั้นต่ำ)
                    </label>
                    <input
                      id="con-threshold-input"
                      type="number"
                      min="0"
                      placeholder="เช่น 5"
                      value={consumableForm.minThreshold}
                      onChange={(e) => setConsumableForm({ ...consumableForm, minThreshold: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 border border-rose-200 bg-rose-50/20 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-xs font-bold text-rose-600"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">เตือนเมื่อเหลือน้อยกว่านี้</span>
                  </div>

                  <div>
                    <label htmlFor="con-max-threshold-input" className="block text-xs font-semibold text-indigo-600 mb-1">
                      Maximum (ขั้นสูง)
                    </label>
                    <input
                      id="con-max-threshold-input"
                      type="number"
                      min="0"
                      placeholder="เช่น 50"
                      value={consumableForm.maxThreshold}
                      onChange={(e) => setConsumableForm({ ...consumableForm, maxThreshold: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 border border-indigo-200 bg-indigo-50/20 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-indigo-600"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">ความจุสต็อกสูงสุดของตู้</span>
                  </div>
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

                {!editingConsumable && !selectedMasterId && (
                  <label className="flex items-start gap-2.5 p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={saveToMasterCatalog}
                      onChange={(e) => setSaveToMasterCatalog(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">
                        บันทึกรายการนี้เข้าสู่ "แคตตาล็อกพัสดุมาตรฐาน (Master Catalog)" ด้วย
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        เพื่อให้แผนกอื่นๆ สามารถเลือกดึงข้อมูลไปใส่ในตู้ของตนเองได้ โดยไม่ต้องพิมพ์หรือถ่ายรูปซ้ำ
                      </span>
                    </div>
                  </label>
                )}
              </div>

              {/* Pinned Action Buttons Footer - Always visible on any screen size */}
              <div className="flex gap-2.5 p-4 sm:p-5 border-t border-slate-100 bg-white shrink-0 shadow-xs">
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
                      <span>{editingConsumable ? "กำลังบันทึก..." : "กำลังจัดเก็บ..."}</span>
                    </>
                  ) : (
                    <span>{editingConsumable ? "จัดเก็บลงตู้" : "จัดเก็บลงตู้"}</span>
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

      {/* CLOUD FIRESTORE RULES GUIDE MODAL */}
      {showCloudGuideModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up my-auto">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-amber-50/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-950">
                    วิธีตั้งค่า Cloud Firestore & ซิงค์ข้อมูลข้ามเครื่อง
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    โปรเจกต์: <b className="text-slate-700">{activeProjectId}</b> (ทำตาม 3 ขั้นตอนเพียง 1 นาที)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                หากเปิดใช้งานในเครื่องอื่นหรือมือถือแล้วยังไม่เห็นตู้หรือพัสดุที่เพิ่งเพิ่ม เป็นเพราะฐานข้อมูล Cloud Firestore ใน Firebase Console ปฏิเสธการเข้าถึง (Permission Denied) เนื่องจากยังไม่ได้เปิดสิทธิ์ Rules ทำให้ระบบต้องจัดเก็บในเครื่องชั่วคราว ทำตาม 3 ขั้นตอนนี้เพื่อให้ทุกเครื่องซิงค์ตรงกัน:
              </p>

              {/* Step 1 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">1</span>
                    <span className="font-bold text-slate-900 text-sm">คัดลอกโค้ด Firestore Rules</span>
                  </div>
                  <button
                    onClick={() => {
                      const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`;
                      navigator.clipboard.writeText(rules);
                      setCopiedRule(true);
                      setTimeout(() => setCopiedRule(false), 3500);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs text-xs"
                  >
                    {copiedRule ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>คัดลอกสำเร็จแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>คัดลอกโค้ด Rules</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-900 text-amber-200 p-3 rounded-lg text-[11px] font-mono overflow-x-auto">
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

              {/* Step 2 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">2</span>
                    <span className="font-bold text-slate-900 text-sm">ไปที่ Firebase &gt; Firestore Rules</span>
                  </div>
                  <a
                    href={firebaseRulesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs text-xs"
                  >
                    <span>เปิดหน้า Firebase</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-700 text-[11px] space-y-1.5 leading-relaxed">
                  <div className="font-semibold text-rose-600">⚠️ ต้องเป็น &quot;Firestore Database&quot; เท่านั้น:</div>
                  <div>• <b>ถ้าเห็นปุ่ม &quot;Create database&quot;:</b> ให้กดปุ่มนี้ &gt; เลือก <b>&quot;Start in test mode&quot;</b> &gt; กด Next &gt; กด Enable ได้เลย (ระบบจะเปิดสิทธิ์ให้อัตโนมัติทันที)</div>
                  <div>• <b>ถ้ามีฐานข้อมูลแล้ว:</b> คลิกที่แท็บ <b>Rules (กฎ)</b> ด้านบนจอ นำโค้ดที่คัดลอกไปวางทับ แล้วกดปุ่มสีฟ้า <b>Publish (เผยแพร่)</b></div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-900 font-black text-xs flex items-center justify-center">3</span>
                    <span className="font-bold text-slate-900 text-sm">ทดสอบและส่งข้อมูลขึ้น Cloud</span>
                  </div>
                  <button
                    onClick={handleSyncToCloud}
                    disabled={isSyncingCloud}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs text-xs"
                  >
                    {isSyncingCloud ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>กำลังทดสอบ...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>ทดสอบและซิงค์ทันที</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  เมื่อกด Publish ใน Firebase เรียบร้อยแล้ว ให้กดปุ่มนี้เพื่อส่งตู้และรายการพัสดุจากเครื่องนี้ขึ้น Cloud ให้ทุกเครื่องเห็นพร้อมกัน
                </p>
                {syncErrorMsg && (
                  <div className="p-2.5 mt-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] font-semibold">
                    {syncErrorMsg}
                  </div>
                )}
                {syncSuccessMsg && (
                  <div className="p-2.5 mt-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-semibold">
                    {syncSuccessMsg}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowCloudGuideModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
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
