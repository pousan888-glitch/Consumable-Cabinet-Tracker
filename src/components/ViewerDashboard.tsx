import React, { useState, useEffect, useMemo } from "react";
import { Cabinet, Consumable, DepartmentRecord, CountHistory, QCConsumptionHistory } from "../types";
import { 
  getCabinets, 
  getConsumables, 
  getDepartments,
  getCountHistory,
  getQCConsumptionHistory
} from "../lib/dbService";
import { 
  getItemTargetStock, 
  isItemLowStock, 
  isItemOutOfStock,
  getMultiCabinetStockInfo,
  getDeptBadgeClass,
  MultiCabinetStockInfo
} from "../lib/stockUtils";
import ImagePreviewModal from "./ImagePreviewModal";
import { 
  Search, 
  RefreshCw, 
  Eye, 
  Building2, 
  Package, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Grid, 
  List, 
  X, 
  ShieldCheck, 
  Info,
  Archive,
  ChevronRight,
  History,
  Activity,
  User,
  Clock,
  Calendar,
  Download,
  ClipboardCheck,
  TrendingDown,
  TrendingUp,
  PackageMinus,
  Check,
  FileSpreadsheet
} from "lucide-react";

interface ViewerDashboardProps {
  userEmail: string;
  userName: string;
}

export default function ViewerDashboard({ userEmail, userName }: ViewerDashboardProps) {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [countLogs, setCountLogs] = useState<CountHistory[]>([]);
  const [qcLogs, setQcLogs] = useState<QCConsumptionHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Main navigation tabs
  const [activeTab, setActiveTab] = useState<"cabinets" | "consumables" | "consumption" | "counts">("cabinets");

  // General filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "LOW" | "OUT" | "NORMAL">("ALL");
  const [displayMode, setDisplayMode] = useState<"grid" | "table">("grid");

  // Specific filters for History & Consumption
  const [qcSourceFilter, setQcSourceFilter] = useState<"ALL" | "CABINET_QR" | "QC">("ALL");
  const [selectedCabinetFilter, setSelectedCabinetFilter] = useState<string>("ALL");

  // Modals & Details
  const [selectedCabinetForModal, setSelectedCabinetForModal] = useState<Cabinet | null>(null);
  const [cabinetModalTab, setCabinetModalTab] = useState<"items" | "counts" | "consumption">("items");
  const [selectedMultiStock, setSelectedMultiStock] = useState<MultiCabinetStockInfo | null>(null);
  const [selectedCountLogModal, setSelectedCountLogModal] = useState<CountHistory | null>(null);
  const [selectedQcLogModal, setSelectedQcLogModal] = useState<QCConsumptionHistory | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Load all initial data from cloud/local
  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [cabs, cons, depts, counts, qcs] = await Promise.all([
        getCabinets(),
        getConsumables(),
        getDepartments(),
        getCountHistory(),
        getQCConsumptionHistory()
      ]);
      setCabinets(cabs);
      setConsumables(cons);
      setDepartments(depts);
      setCountLogs(counts);
      setQcLogs(qcs);
    } catch (err) {
      console.error("Error loading viewer data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick lookup maps
  const cabinetMap = useMemo(() => {
    const map = new Map<string, Cabinet>();
    cabinets.forEach(c => map.set(c.id, c));
    return map;
  }, [cabinets]);

  const getCabinetName = (cabId: string) => {
    return cabinetMap.get(cabId)?.name || "ตู้จัดเก็บ";
  };

  const getCabinetLocation = (cabId: string) => {
    return cabinetMap.get(cabId)?.location || "-";
  };

  // Extract all department names
  const allDeptNames = useMemo(() => {
    const names = new Set<string>();
    departments.forEach(d => {
      if (d.name && d.name.toLowerCase() !== "production") names.add(d.name);
    });
    consumables.forEach(c => {
      if (c.department && c.department.toLowerCase() !== "production") names.add(c.department);
    });
    if (names.size === 0) {
      ["CMT", "DNM", "WL", "SBS", "QC"].forEach(n => names.add(n));
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [departments, consumables]);

  // Overall stock statistics
  const stats = useMemo(() => {
    let normalCount = 0;
    let lowCount = 0;
    let outCount = 0;

    consumables.forEach(item => {
      if (isItemOutOfStock(item)) outCount++;
      else if (isItemLowStock(item)) lowCount++;
      else normalCount++;
    });

    const totalWithdrawalUnits = qcLogs.reduce((sum, log) => {
      return sum + (log.items?.reduce((isum, it) => isum + (it.qtyTaken || 0), 0) || 0);
    }, 0);

    return {
      totalCabinets: cabinets.length,
      totalConsumables: consumables.length,
      normalCount,
      lowCount,
      outCount,
      attentionTotal: lowCount + outCount,
      totalWithdrawalEvents: qcLogs.length,
      totalWithdrawalUnits,
      totalCountAudits: countLogs.length
    };
  }, [cabinets, consumables, qcLogs, countLogs]);

  // Map latest count check per cabinet
  const latestCountByCabinet = useMemo(() => {
    const map = new Map<string, CountHistory>();
    // countLogs are already sorted newest first or we can iterate
    countLogs.forEach(log => {
      if (!map.has(log.cabinetId)) {
        map.set(log.cabinetId, log);
      }
    });
    return map;
  }, [countLogs]);

  // Map latest consumption per cabinet
  const latestWithdrawalByCabinet = useMemo(() => {
    const map = new Map<string, QCConsumptionHistory>();
    qcLogs.forEach(log => {
      const cabId = log.cabinetId || (log.items?.[0]?.cabinetId);
      if (cabId && !map.has(cabId)) {
        map.set(cabId, log);
      }
    });
    return map;
  }, [qcLogs]);

  // Filtered Consumables list
  const filteredConsumables = useMemo(() => {
    return consumables.filter(item => {
      // 1. Department
      if (selectedDept !== "ALL" && item.department?.toLowerCase() !== selectedDept.toLowerCase()) {
        return false;
      }

      // 2. Status
      if (statusFilter === "OUT" && !isItemOutOfStock(item)) return false;
      if (statusFilter === "LOW" && (!isItemLowStock(item) || isItemOutOfStock(item))) return false;
      if (statusFilter === "NORMAL" && (isItemLowStock(item) || isItemOutOfStock(item))) return false;

      // 3. Search Term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesDept = item.department?.toLowerCase().includes(q);
        const matchesCab = getCabinetName(item.cabinetId).toLowerCase().includes(q);
        const matchesLoc = getCabinetLocation(item.cabinetId).toLowerCase().includes(q);
        const matchesUser = (item.lastUpdatedBy || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDept && !matchesCab && !matchesLoc && !matchesUser) return false;
      }

      return true;
    }).sort((a, b) => {
      const aOut = isItemOutOfStock(a) ? 1 : 0;
      const bOut = isItemOutOfStock(b) ? 1 : 0;
      if (aOut !== bOut) return bOut - aOut;

      const aLow = isItemLowStock(a) ? 1 : 0;
      const bLow = isItemLowStock(b) ? 1 : 0;
      if (aLow !== bLow) return bLow - aLow;

      return (a.name || "").localeCompare(b.name || "");
    });
  }, [consumables, selectedDept, statusFilter, searchTerm, cabinetMap]);

  // Filtered Cabinets list
  const filteredCabinets = useMemo(() => {
    return cabinets.filter(cab => {
      if (selectedDept !== "ALL") {
        const hasDept = cab.departments?.some(d => d.toLowerCase() === selectedDept.toLowerCase());
        const hasItemsInDept = consumables.some(
          c => c.cabinetId === cab.id && c.department?.toLowerCase() === selectedDept.toLowerCase()
        );
        if (!hasDept && !hasItemsInDept) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = cab.name?.toLowerCase().includes(q);
        const matchesLoc = cab.location?.toLowerCase().includes(q);
        const matchesDept = cab.departments?.some(d => d.toLowerCase().includes(q));
        const matchesItemInside = consumables.some(
          c => c.cabinetId === cab.id && c.name?.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesLoc && !matchesDept && !matchesItemInside) return false;
      }

      return true;
    });
  }, [cabinets, selectedDept, searchTerm, consumables]);

  // Filtered Withdrawal / Consumption Logs (ใครเบิกอะไรบ้าง)
  const filteredQcLogs = useMemo(() => {
    return qcLogs.filter(log => {
      // Source filter
      if (qcSourceFilter === "CABINET_QR" && log.source !== "CABINET_QR") return false;
      if (qcSourceFilter === "QC" && log.source !== "QC" && log.source !== undefined) return false;

      // Department filter
      if (selectedDept !== "ALL" && log.department?.toLowerCase() !== selectedDept.toLowerCase()) return false;

      // Cabinet filter
      if (selectedCabinetFilter !== "ALL") {
        const matchesCab = log.cabinetId === selectedCabinetFilter || 
          log.items?.some(i => i.cabinetId === selectedCabinetFilter);
        if (!matchesCab) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesUser = (log.consumedBy || "").toLowerCase().includes(q);
        const matchesDept = (log.department || "").toLowerCase().includes(q);
        const matchesCab = (log.cabinetName || "").toLowerCase().includes(q);
        const matchesNote = (log.note || "").toLowerCase().includes(q);
        const matchesItem = log.items?.some(i => 
          (i.name || "").toLowerCase().includes(q) || (i.cabinetName || "").toLowerCase().includes(q)
        );
        if (!matchesUser && !matchesDept && !matchesCab && !matchesNote && !matchesItem) return false;
      }

      return true;
    });
  }, [qcLogs, qcSourceFilter, selectedDept, selectedCabinetFilter, searchTerm]);

  // Filtered Count History Logs (ตรวจเช็คล่าสุดยังไงบ้าง)
  const filteredCountLogs = useMemo(() => {
    return countLogs.filter(log => {
      // Cabinet filter
      if (selectedCabinetFilter !== "ALL" && log.cabinetId !== selectedCabinetFilter) return false;

      // Department filter
      if (selectedDept !== "ALL") {
        const hasDept = log.items?.some(i => i.department?.toLowerCase() === selectedDept.toLowerCase());
        if (!hasDept) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesUser = (log.checkedBy || "").toLowerCase().includes(q);
        const matchesCab = (log.cabinetName || "").toLowerCase().includes(q);
        const matchesItem = log.items?.some(i => 
          (i.name || "").toLowerCase().includes(q) || (i.department || "").toLowerCase().includes(q)
        );
        if (!matchesUser && !matchesCab && !matchesItem) return false;
      }

      return true;
    });
  }, [countLogs, selectedCabinetFilter, selectedDept, searchTerm]);

  // Helper to compute stats for a specific cabinet
  const getCabinetStockSummary = (cabId: string) => {
    const items = consumables.filter(c => c.cabinetId === cabId);
    let normal = 0;
    let low = 0;
    let out = 0;

    items.forEach(c => {
      if (isItemOutOfStock(c)) out++;
      else if (isItemLowStock(c)) low++;
      else normal++;
    });

    const total = items.length;
    const healthPercent = total > 0 ? Math.round((normal / total) * 100) : 100;
    const latestCount = latestCountByCabinet.get(cabId);
    const latestWithdrawal = latestWithdrawalByCabinet.get(cabId);

    return { total, normal, low, out, healthPercent, items, latestCount, latestWithdrawal };
  };

  // Export withdrawal logs to CSV
  const handleExportWithdrawalCSV = () => {
    const rows = [
      ["วันที่และเวลา", "ผู้ทำรายการเบิก", "ช่องทาง", "แผนก", "ตู้จัดเก็บ", "รายการพัสดุ", "จำนวนที่เบิก", "หน่วยนับ", "หมายเหตุ/วัตถุประสงค์"]
    ];

    filteredQcLogs.forEach(log => {
      const dateStr = formatDate(log.consumedAt);
      const sourceStr = log.source === "CABINET_QR" ? "QR หน้าตู้" : log.source === "QC" ? "QC เบิกใช้" : "เบิกทั่วไป";
      log.items?.forEach(item => {
        rows.push([
          `"${dateStr}"`,
          `"${log.consumedBy || "-"}"`,
          `"${sourceStr}"`,
          `"${log.department || "-"}"`,
          `"${item.cabinetName || log.cabinetName || "-"}"`,
          `"${item.name || "-"}"`,
          `"${item.qtyTaken || 0}"`,
          `"${item.unit || "-"}"`,
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

  // Export Consumables Inventory to Excel (CSV with UTF-8 BOM)
  const handleExportConsumablesCSV = () => {
    const deptTitle = selectedDept === "ALL" ? "รวมทุกแผนก" : selectedDept;
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `รายการพัสดุ_${deptTitle}_${dateStr}.csv`;

    const headers = [
      "ลำดับ",
      "รหัสพัสดุ",
      "ชื่อรายการพัสดุ",
      "แผนก",
      "ตู้จัดเก็บ",
      "สถานที่ตั้งตู้",
      "จำนวนคงเหลือจริง",
      "หน่วยนับ",
      "เกณฑ์เป้าหมาย (Max)",
      "เกณฑ์ขั้นต่ำ (Min)",
      "จำนวนที่ต้องเติม",
      "สถานะสต็อก",
      "มีในหลายตู้หรือไม่",
      "สต็อกรวมทุกตู้ของแผนก",
      "รายละเอียดตู้จัดเก็บ"
    ];

    const rows = filteredConsumables.map((item, idx) => {
      const targetStock = getItemTargetStock(item);
      const isOut = isItemOutOfStock(item);
      const isLow = isItemLowStock(item) && !isOut;
      const status = isOut ? "หมดสต็อก (วิกฤต)" : isLow ? "ใกล้หมด (ต่ำกว่าเกณฑ์)" : "ปกติ (พร้อมใช้)";
      const refillNeeded = Math.max(0, targetStock - (item.currentQty || 0));
      const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);
      const cabName = getCabinetName(item.cabinetId);
      const cabLoc = getCabinetLocation(item.cabinetId);

      return [
        idx + 1,
        `"${item.id}"`,
        `"${(item.name || "").replace(/"/g, '""')}"`,
        `"${(item.department || "").replace(/"/g, '""')}"`,
        `"${cabName.replace(/"/g, '""')}"`,
        `"${cabLoc.replace(/"/g, '""')}"`,
        item.currentQty ?? 0,
        `"${(item.unit || "ชิ้น").replace(/"/g, '""')}"`,
        targetStock,
        item.minThreshold ?? 0,
        refillNeeded,
        `"${status}"`,
        multiInfo.hasMultipleCabinets ? "มีในหลายตู้" : "ตู้เดียว",
        multiInfo.hasMultipleCabinets ? multiInfo.totalQtyAcrossCabinets : (item.currentQty ?? 0),
        `"${(multiInfo.hasMultipleCabinets ? multiInfo.breakdownText : cabName).replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper date formatter
  const formatDate = (val: any): string => {
    if (!val) return "-";
    try {
      const date = val?.toDate ? val.toDate() : new Date(val);
      if (isNaN(date.getTime())) return "-";
      return date.toLocaleString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "-";
    }
  };

  const formatShortDate = (val: any): string => {
    if (!val) return "-";
    try {
      const date = val?.toDate ? val.toDate() : new Date(val);
      if (isNaN(date.getTime())) return "-";
      return date.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch {
      return "-";
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center animate-pulse mb-3">
          <Eye className="h-6 w-6" />
        </div>
        <p className="font-bold text-slate-800 text-sm">กำลังโหลดข้อมูลตู้, พัสดุ, และประวัติการเบิก/ตรวจนับ...</p>
        <p className="text-xs text-slate-400 mt-1">ระบบกำลังเตรียมข้อมูลสถานะล่าสุดจากฐานข้อมูล</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">
      {/* TOP BANNER & READ-ONLY NOTICE */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Decorative blur rings */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-1/4 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-200 border border-blue-400/30 backdrop-blur-xs">
                <Eye className="h-3.5 w-3.5 text-blue-300" />
                โหมดผู้เข้าชม (VIEWER DASHBOARD)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                <ShieldCheck className="h-3 w-3 text-emerald-300" />
                Read-Only (ปลอดภัย ไม่มีการแก้ไขข้อมูล)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              แดชบอร์ดตรวจสอบตู้ พัสดุ และประวัติสต็อก
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              สำหรับตรวจสอบยอดคงเหลือจริงในตู้จัดเก็บ ดูประวัติการเบิกใช้ว่าใครเบิกอะไรไปบ้าง และผลการตรวจนับสต็อกรอบล่าสุดของแต่ละตู้
            </p>
          </div>

          {/* User info & refresh */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-2xl text-xs font-bold transition-all border border-white/15 cursor-pointer backdrop-blur-xs"
              title="รีเฟรชข้อมูลล่าสุด"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-blue-300" : ""}`} />
              <span>{refreshing ? "กำลังซิงค์..." : "รีเฟรชข้อมูล"}</span>
            </button>
          </div>
        </div>

        {/* QUICK STATS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div 
            onClick={() => setActiveTab("cabinets")}
            className="bg-white/10 hover:bg-white/15 cursor-pointer transition-all backdrop-blur-xs rounded-2xl p-3 sm:p-4 border border-white/10"
          >
            <div className="flex items-center justify-between text-slate-300 text-[11px] font-bold">
              <span>ตู้จัดเก็บทั้งหมด</span>
              <Building2 className="h-4 w-4 text-blue-300" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              {stats.totalCabinets}
              <span className="text-xs font-normal text-slate-300 ml-1">ตู้</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab("consumables")}
            className="bg-white/10 hover:bg-white/15 cursor-pointer transition-all backdrop-blur-xs rounded-2xl p-3 sm:p-4 border border-white/10"
          >
            <div className="flex items-center justify-between text-slate-300 text-[11px] font-bold">
              <span>พัสดุคอนซูม</span>
              <Package className="h-4 w-4 text-indigo-300" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              {stats.totalConsumables}
              <span className="text-xs font-normal text-slate-300 ml-1">รายการ</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab("consumption")}
            className="bg-white/10 hover:bg-white/15 cursor-pointer transition-all backdrop-blur-xs rounded-2xl p-3 sm:p-4 border border-white/10"
          >
            <div className="flex items-center justify-between text-purple-200 text-[11px] font-bold">
              <span>ประวัติเบิกใช้</span>
              <Activity className="h-4 w-4 text-purple-300" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-purple-200 mt-1">
              {stats.totalWithdrawalEvents}
              <span className="text-xs font-normal text-purple-300/80 ml-1">ครั้ง ({stats.totalWithdrawalUnits} ชิ้น)</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab("counts")}
            className="bg-white/10 hover:bg-white/15 cursor-pointer transition-all backdrop-blur-xs rounded-2xl p-3 sm:p-4 border border-white/10"
          >
            <div className="flex items-center justify-between text-emerald-200 text-[11px] font-bold">
              <span>รอบตรวจนับสต็อก</span>
              <ClipboardCheck className="h-4 w-4 text-emerald-300" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1">
              {stats.totalCountAudits}
              <span className="text-xs font-normal text-emerald-200/80 ml-1">รอบ</span>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW SELECTOR TABS & SEARCH CONTROLS */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        {/* Navigation Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab("cabinets")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "cabinets"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>ตู้จัดเก็บ ({filteredCabinets.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("consumables")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "consumables"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package className="h-4 w-4" />
              <span>พัสดุคอนซูม ({filteredConsumables.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("consumption")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "consumption"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Activity className="h-4 w-4 text-purple-600" />
              <span>ใครเบิกอะไรบ้าง ({filteredQcLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("counts")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "counts"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ClipboardCheck className="h-4 w-4 text-emerald-600" />
              <span>ตรวจเช็กล่าสุด ({filteredCountLogs.length})</span>
            </button>
          </div>

          {/* Consumables Tab Specific: Export Excel & Grid/Table Switch */}
          {activeTab === "consumables" && (
            <div className="flex items-center gap-2 self-end lg:self-auto">
              <button
                onClick={handleExportConsumablesCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                title="ส่งออกรายการพัสดุและยอดสต็อกเป็นไฟล์ Excel (.csv รองรับภาษาไทย)"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>ส่งออก Excel ({filteredConsumables.length})</span>
              </button>
              
              <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl">
                <button
                  onClick={() => setDisplayMode("grid")}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    displayMode === "grid" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="มุมมองการ์ด"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDisplayMode("table")}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    displayMode === "table" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="มุมมองตาราง"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Consumption Tab Specific: Export CSV */}
          {activeTab === "consumption" && (
            <button
              onClick={handleExportWithdrawalCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-colors cursor-pointer self-end lg:self-auto"
              title="ดาวน์โหลดรายการเบิกที่กรองเป็นไฟล์ Excel (CSV)"
            >
              <Download className="h-4 w-4" />
              <span>ส่งออก CSV ({filteredQcLogs.length})</span>
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === "cabinets" 
                  ? "ค้นหาชื่อตู้จัดเก็บ, สถานที่ หรือแผนก..."
                  : activeTab === "consumables"
                  ? "ค้นหาชื่อพัสดุ, ชื่อตู้ หรือผู้ตรวจนับ..."
                  : activeTab === "consumption"
                  ? "ค้นหาชื่อคนเบิก, ชื่อพัสดุ, หรือหมายเหตุ..."
                  : "ค้นหาชื่อผู้ตรวจนับ, ชื่อตู้, หรือชื่อพัสดุ..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="ALL">🏢 แผนก: ทั้งหมด ({allDeptNames.length})</option>
              {allDeptNames.map(dept => (
                <option key={dept} value={dept}>
                  แผนก {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic 3rd filter according to activeTab */}
          <div className="sm:col-span-3">
            {activeTab === "consumables" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="ALL">⚡ สถานะสต็อก: ทั้งหมด</option>
                <option value="OUT">🚨 วิกฤต หมดสต็อก (0 ชิ้น)</option>
                <option value="LOW">⚠️ ต่ำกว่าเกณฑ์ (ใกล้หมด)</option>
                <option value="NORMAL">✅ สต็อกปกติ (พร้อมใช้)</option>
              </select>
            )}

            {activeTab === "consumption" && (
              <select
                value={qcSourceFilter}
                onChange={(e) => setQcSourceFilter(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
              >
                <option value="ALL">📱 ช่องทางเบิก: ทั้งหมด</option>
                <option value="CABINET_QR">📱 เบิกผ่าน QR หน้าตู้</option>
                <option value="QC">🔬 เบิกใช้โดย QC</option>
              </select>
            )}

            {(activeTab === "cabinets" || activeTab === "counts") && (
              <select
                value={selectedCabinetFilter}
                onChange={(e) => setSelectedCabinetFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="ALL">🗄️ ตู้จัดเก็บ: ทั้งหมด ({cabinets.length})</option>
                {cabinets.map(cab => (
                  <option key={cab.id} value={cab.id}>
                    {cab.name} {cab.location ? `(${cab.location})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CABINET VIEW (ตู้จัดเก็บ)                                          */}
      {/* ========================================================================= */}
      {activeTab === "cabinets" && (
        <div className="space-y-4">
          {filteredCabinets.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Archive className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-base">ไม่พบตู้จัดเก็บที่ตรงกับเงื่อนไข</h3>
              <p className="text-xs text-slate-400 mt-1">ลองล้างคำค้นหาหรือเปลี่ยนตัวกรองแผนก</p>
              {(searchTerm || selectedDept !== "ALL" || selectedCabinetFilter !== "ALL") && (
                <button
                  onClick={() => { setSearchTerm(""); setSelectedDept("ALL"); setSelectedCabinetFilter("ALL"); }}
                  className="mt-3 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCabinets.map(cab => {
                const summary = getCabinetStockSummary(cab.id);
                const latestCount = summary.latestCount;
                const latestWithdrawal = summary.latestWithdrawal;

                return (
                  <div
                    key={cab.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col group"
                  >
                    {/* Cabinet Photo Header */}
                    <div className="relative h-44 bg-slate-100 overflow-hidden">
                      <img
                        src={cab.photoUrl || "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=400"}
                        alt={cab.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                      {/* Cabinet Health Badge */}
                      <div className="absolute top-3 right-3">
                        {summary.out > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500 text-white shadow-xs flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="h-3 w-3" /> หมด {summary.out} ชนิด
                          </span>
                        ) : summary.low > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-xs flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> ใกล้หมด {summary.low} ชนิด
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-xs flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> สต็อกพร้อม {summary.total} รายการ
                          </span>
                        )}
                      </div>

                      {/* Cabinet Title inside Image */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-white text-base leading-tight truncate">
                            {cab.name}
                          </h3>
                          <p className="text-slate-200 text-xs flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span>{cab.location || "ไม่ได้ระบุตำแหน่ง"}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Cabinet Card Body */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                      {/* Department Tags */}
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          แผนกที่จัดเก็บในตู้นี้:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cab.departments && cab.departments.length > 0 ? (
                            cab.departments.map(d => (
                              <span
                                key={d}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-bold border border-slate-200"
                              >
                                {d}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">ไม่ระบุแผนก</span>
                          )}
                        </div>
                      </div>

                      {/* LATEST CHECK & WITHDRAWAL ACTIVITY SUMMARY */}
                      <div className="space-y-2 pt-1 border-t border-slate-100 text-xs">
                        {/* Latest Stock Check Info */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-150 flex items-start gap-2.5">
                          <ClipboardCheck className={`h-4 w-4 shrink-0 mt-0.5 ${latestCount ? "text-emerald-600" : "text-slate-400"}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-700">ตรวจนับสต็อกล่าสุด:</span>
                              {latestCount && (
                                <span className="text-[10px] text-slate-400">
                                  {formatShortDate(latestCount.checkedAt)}
                                </span>
                              )}
                            </div>
                            {latestCount ? (
                              <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                                โดย <span className="font-bold text-slate-900">{latestCount.checkedBy}</span>
                                <span className="text-slate-400 ml-1">({latestCount.items?.length || 0} รายการ)</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 mt-0.5 italic">
                                ยังไม่มีบันทึกการตรวจนับ
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Latest Withdrawal Info */}
                        <div className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100 flex items-start gap-2.5">
                          <Activity className={`h-4 w-4 shrink-0 mt-0.5 ${latestWithdrawal ? "text-purple-600" : "text-slate-400"}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-purple-900">เบิกล่าสุด:</span>
                              {latestWithdrawal && (
                                <span className="text-[10px] text-purple-600 font-medium">
                                  {formatShortDate(latestWithdrawal.consumedAt)}
                                </span>
                              )}
                            </div>
                            {latestWithdrawal ? (
                              <div className="text-[11px] text-purple-950 mt-0.5 truncate">
                                ผู้เบิก: <span className="font-bold">{latestWithdrawal.consumedBy}</span>
                                {latestWithdrawal.items?.[0] && (
                                  <span className="text-purple-700 ml-1">
                                    ({latestWithdrawal.items[0].name} x{latestWithdrawal.items[0].qtyTaken})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 mt-0.5 italic">
                                ยังไม่มีประวัติการเบิก
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stock breakdown mini summary */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">พัสดุในตู้ ({summary.total} รายการ)</span>
                          <span className="font-black text-slate-900">{summary.healthPercent}% พร้อม</span>
                        </div>

                        {/* Progress Bar of Health */}
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${summary.total > 0 ? (summary.normal / summary.total) * 100 : 0}%` }}
                            className="bg-emerald-500 h-full"
                            title={`ปกติ: ${summary.normal}`}
                          />
                          <div
                            style={{ width: `${summary.total > 0 ? (summary.low / summary.total) * 100 : 0}%` }}
                            className="bg-amber-500 h-full"
                            title={`ใกล้หมด: ${summary.low}`}
                          />
                          <div
                            style={{ width: `${summary.total > 0 ? (summary.out / summary.total) * 100 : 0}%` }}
                            className="bg-rose-500 h-full"
                            title={`หมด: ${summary.out}`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span className="text-emerald-700 font-semibold">ปกติ {summary.normal}</span>
                          <span className="text-amber-700 font-semibold">ใกล้หมด {summary.low}</span>
                          <span className="text-rose-700 font-semibold">หมด {summary.out}</span>
                        </div>
                      </div>

                      {/* Action Button: Open details modal */}
                      <button
                        onClick={() => {
                          setSelectedCabinetForModal(cab);
                          setCabinetModalTab("items");
                        }}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Eye className="h-4 w-4" />
                        <span>เปิดดูรายละเอียดตู้ ({summary.total} รายการ)</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ALL CONSUMABLES VIEW (พัสดุคอนซูมทั้งหมด)                             */}
      {/* ========================================================================= */}
      {activeTab === "consumables" && (
        <div className="space-y-4">
          {filteredConsumables.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-base">ไม่พบรายการพัสดุที่ตรงกับเงื่อนไข</h3>
              <p className="text-xs text-slate-400 mt-1">ลองปรับเปลี่ยนคำค้นหา แผนก หรือสถานะสต็อก</p>
              {(searchTerm || selectedDept !== "ALL" || statusFilter !== "ALL") && (
                <button
                  onClick={() => { setSearchTerm(""); setSelectedDept("ALL"); setStatusFilter("ALL"); }}
                  className="mt-3 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          ) : displayMode === "grid" ? (
            /* GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredConsumables.map(item => {
                const targetStock = getItemTargetStock(item);
                const isOut = isItemOutOfStock(item);
                const isLow = isItemLowStock(item);
                const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Consumable Photo */}
                      <div 
                        onClick={() => {
                          if (item.imageUrl) {
                            setPreviewImage({ url: item.imageUrl, title: item.name });
                          }
                        }}
                        className={`relative h-36 bg-slate-100 overflow-hidden ${item.imageUrl ? "cursor-pointer group" : ""}`}
                        title={item.imageUrl ? "คลิกเพื่อดูรูปภาพขนาดใหญ่" : undefined}
                      >
                        <img
                          src={item.imageUrl || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400"}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {/* Status Badge */}
                        <div className="absolute top-2.5 right-2.5">
                          {isOut ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs">
                              หมดสต็อก
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-xs">
                              ต่ำกว่าเกณฑ์
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-xs">
                              ปกติ
                            </span>
                          )}
                        </div>

                        {/* Department Tag */}
                        <div className="absolute bottom-2 left-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                            แผนก {item.department}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-3.5 space-y-2">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-tight">
                          {item.name}
                        </h4>

                        <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <Building2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">{getCabinetsNameWithLocation(item.cabinetId, cabinetMap)}</span>
                        </div>

                        {/* Multi-cabinet trigger button */}
                        {multiInfo.hasMultipleCabinets && (
                          <button
                            onClick={() => setSelectedMultiStock(multiInfo)}
                            className="w-full mt-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-1">
                              <Layers className="h-3 w-3 text-indigo-600" />
                              มีในอีก {multiInfo.cabinetLocations.length - 1} ตู้ ({item.department})
                            </span>
                            <span className="font-black">รวม {multiInfo.totalQtyAcrossCabinets} {item.unit}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stock Metrics Footer & Last Checked By */}
                    <div className="p-3.5 pt-0 border-t border-slate-100 mt-2 space-y-2">
                      <div className="flex items-baseline justify-between pt-2">
                        <span className="text-[11px] text-slate-400">คงเหลือในตู้นี้</span>
                        <div className="text-right">
                          <span className={`text-lg font-black ${
                            isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-emerald-700"
                          }`}>
                            {item.currentQty}
                          </span>
                          <span className="text-xs text-slate-500 font-bold ml-1">{item.unit}</span>
                        </div>
                      </div>

                      {/* Thresholds comparison */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-md font-mono">
                        <span>เกณฑ์ Min: {item.minThreshold}</span>
                        <span>เป้า Max: {item.maxThreshold || targetStock}</span>
                      </div>

                      {/* Last Checked / Counted by info */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">นับล่าสุด: {item.lastUpdatedBy || "-"}</span>
                        </span>
                        <span>{formatShortDate(item.lastUpdated)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                      <th className="px-4 py-3">พัสดุ / รูปถ่าย</th>
                      <th className="px-4 py-3">แผนก</th>
                      <th className="px-4 py-3">ตู้จัดเก็บ / สถานที่</th>
                      <th className="px-4 py-3 text-center">คงเหลือในตู้นี้</th>
                      <th className="px-4 py-3 text-center">เกณฑ์ (Min / Max)</th>
                      <th className="px-4 py-3 text-center">สถานะ</th>
                      <th className="px-4 py-3 text-center">สต็อกข้ามตู้</th>
                      <th className="px-4 py-3 text-center">อัปเดต/นับล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredConsumables.map(item => {
                      const targetStock = getItemTargetStock(item);
                      const isOut = isItemOutOfStock(item);
                      const isLow = isItemLowStock(item);
                      const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={item.imageUrl || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400"}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                onClick={() => {
                                  if (item.imageUrl) {
                                    setPreviewImage({ url: item.imageUrl, title: item.name });
                                  }
                                }}
                                className={`h-10 w-10 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200 ${item.imageUrl ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                                title={item.imageUrl ? "คลิกเพื่อดูรูปภาพขนาดใหญ่" : undefined}
                              />
                              <div className="font-bold text-slate-900 text-xs">
                                {item.name}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider ${getDeptBadgeClass(item.department)}`}>
                              <span>แผนก {item.department}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{getCabinetName(item.cabinetId)}</div>
                            <div className="text-[10px] text-slate-400">{getCabinetsLocationOnly(item.cabinetId, cabinetMap)}</div>
                          </td>

                          <td className="px-4 py-3 text-center font-mono">
                            <span className={`text-sm font-black ${
                              isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-emerald-700"
                            }`}>
                              {item.currentQty}
                            </span>
                            <span className="text-slate-400 text-xs ml-1">{item.unit}</span>
                          </td>

                          <td className="px-4 py-3 text-center font-mono text-slate-600">
                            Min: <strong>{item.minThreshold}</strong> / Max: <strong>{item.maxThreshold || targetStock}</strong>
                          </td>

                          <td className="px-4 py-3 text-center">
                            {isOut ? (
                              <span className="px-2 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                                หมดสต็อก
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                ต่ำกว่าเกณฑ์
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ปกติ
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {multiInfo.hasMultipleCabinets ? (
                              <button
                                onClick={() => setSelectedMultiStock(multiInfo)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Layers className="h-3 w-3" />
                                <span>{multiInfo.cabinetLocations.length} ตู้ ({multiInfo.totalQtyAcrossCabinets} {item.unit})</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <div className="font-medium text-slate-800 text-[11px]">
                              {item.lastUpdatedBy || "-"}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formatShortDate(item.lastUpdated)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CONSUMPTION LOGS (ใครเบิกอะไรบ้าง)                                 */}
      {/* ========================================================================= */}
      {activeTab === "consumption" && (
        <div className="space-y-4">
          {/* Quick summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-purple-50 border border-purple-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-purple-700 uppercase">รวมรายการเบิก</span>
                <div className="text-2xl font-black text-purple-900 mt-0.5">
                  {filteredQcLogs.length} <span className="text-xs font-semibold text-purple-600">ครั้ง</span>
                </div>
              </div>
              <div className="h-10 w-10 bg-purple-200/60 rounded-xl flex items-center justify-center text-purple-800">
                <Activity className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-orange-700 uppercase">เบิกผ่าน QR หน้าตู้</span>
                <div className="text-2xl font-black text-orange-900 mt-0.5">
                  {filteredQcLogs.filter(l => l.source === "CABINET_QR").length} <span className="text-xs font-semibold text-orange-600">ครั้ง</span>
                </div>
              </div>
              <div className="h-10 w-10 bg-orange-200/60 rounded-xl flex items-center justify-center text-orange-800">
                <PackageMinus className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-700 uppercase">เบิกใช้โดยเจ้าหน้าที่ QC</span>
                <div className="text-2xl font-black text-blue-900 mt-0.5">
                  {filteredQcLogs.filter(l => l.source === "QC" || !l.source).length} <span className="text-xs font-semibold text-blue-600">ครั้ง</span>
                </div>
              </div>
              <div className="h-10 w-10 bg-blue-200/60 rounded-xl flex items-center justify-center text-blue-800">
                <User className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* List of Withdrawal Events */}
          {filteredQcLogs.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-base">ไม่พบบันทึกการเบิกที่ตรงกับเงื่อนไข</h3>
              <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา แผนก หรือช่องทางการเบิก</p>
              {(searchTerm || selectedDept !== "ALL" || qcSourceFilter !== "ALL" || selectedCabinetFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedDept("ALL");
                    setQcSourceFilter("ALL");
                    setSelectedCabinetFilter("ALL");
                  }}
                  className="mt-3 text-xs font-bold text-purple-600 hover:underline cursor-pointer"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQcLogs.map(log => {
                const isCabinetQr = log.source === "CABINET_QR";
                const dateStr = formatDate(log.consumedAt);
                const totalItemsCount = log.items?.length || 0;
                const totalUnitsTaken = log.items?.reduce((s, it) => s + (it.qtyTaken || 0), 0) || 0;

                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Who withdrew & from where */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Source Tag */}
                        {isCabinetQr ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black bg-orange-100 text-orange-800 border border-orange-200">
                            <PackageMinus className="h-3 w-3" />
                            เบิกผ่าน QR หน้าตู้
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                            <Activity className="h-3 w-3" />
                            QC หยิบใช้
                          </span>
                        )}

                        {/* Department Tag */}
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          แผนก {log.department}
                        </span>

                        {/* Date Tag */}
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {dateStr}
                        </span>
                      </div>

                      {/* User & Cabinet summary */}
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-sm shrink-0 border border-slate-200">
                          {log.consumedBy?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500">ผู้ทำรายการเบิก:</div>
                          <div className="font-extrabold text-slate-900 text-sm truncate">
                            {log.consumedBy || "ไม่ระบุชื่อ"}
                          </div>
                        </div>
                        {log.cabinetName && (
                          <div className="border-l border-slate-200 pl-3 min-w-0 hidden sm:block">
                            <div className="text-xs text-slate-500">จากตู้จัดเก็บ:</div>
                            <div className="font-bold text-slate-800 text-xs truncate">
                              {log.cabinetName}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Note / Purpose if present */}
                      {log.note && (
                        <div className="text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-150 inline-block max-w-full truncate">
                          <span className="font-bold text-slate-700">หมายเหตุ:</span> {log.note}
                        </div>
                      )}
                    </div>

                    {/* Right: What was withdrawn (Items List Preview) */}
                    <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 md:w-80 shrink-0 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1.5 border-b border-slate-200">
                        <span>พัสดุที่เบิก ({totalItemsCount} รายการ)</span>
                        <span className="text-purple-700 font-extrabold">รวม -{totalUnitsTaken} ชิ้น</span>
                      </div>

                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {log.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs gap-2">
                            <span className="font-semibold text-slate-800 truncate" title={item.name}>
                              {item.name}
                            </span>
                            <span className="font-black text-rose-600 shrink-0 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                              -{item.qtyTaken} {item.unit}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => setSelectedQcLogModal(log)}
                        className="w-full mt-1 py-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100/50 rounded-lg border border-purple-200 text-center transition-colors cursor-pointer"
                      >
                        ดูรายละเอียดครบถ้วน
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: COUNT / AUDIT HISTORY (ตรวจเช็คล่าสุดยังไงบ้าง)                      */}
      {/* ========================================================================= */}
      {activeTab === "counts" && (
        <div className="space-y-4">
          {/* Top Summary Bar */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center shrink-0">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-emerald-950 text-sm">
                  รายงานและประวัติการตรวจนับสต็อกแต่ละรอบ (Stock Audit Logs)
                </h3>
                <p className="text-xs text-emerald-800/80">
                  แสดงผลการตรวจนับของทีมงานในแต่ละรอบ ยอดก่อนตรวจ ยอดที่นับได้จริง และผลต่างเพื่อความโปร่งใส
                </p>
              </div>
            </div>

            <div className="text-right self-start sm:self-auto">
              <span className="text-xs text-emerald-700 font-bold block">บันทึกรอบตรวจทั้งหมด</span>
              <span className="text-xl font-black text-emerald-900">{filteredCountLogs.length} รอบ</span>
            </div>
          </div>

          {filteredCountLogs.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <ClipboardCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-base">ไม่พบประวัติการตรวจนับที่ตรงกับเงื่อนไข</h3>
              <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา ตู้จัดเก็บ หรือแผนก</p>
              {(searchTerm || selectedDept !== "ALL" || selectedCabinetFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedDept("ALL");
                    setSelectedCabinetFilter("ALL");
                  }}
                  className="mt-3 text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCountLogs.map(log => {
                const dateStr = formatDate(log.checkedAt);
                const items = log.items || [];
                
                // Count how many items increased, decreased, or matched
                let matchedCount = 0;
                let increasedCount = 0;
                let decreasedCount = 0;

                items.forEach(it => {
                  const diff = it.newQty - it.prevQty;
                  if (diff === 0) matchedCount++;
                  else if (diff > 0) increasedCount++;
                  else decreasedCount++;
                });

                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Header of Audit Session */}
                    <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center shrink-0 font-black">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm sm:text-base">
                              {log.cabinetName}
                            </span>
                            <span className="text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                              {getCabinetLocation(log.cabinetId)}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-1 font-semibold text-slate-800">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                              ผู้ตรวจนับ: <span className="text-indigo-700 font-bold">{log.checkedBy}</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {dateStr}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Audit Summary Badges */}
                      <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200">
                          นับทั้งหมด {items.length} รายการ
                        </span>
                        {decreasedCount > 0 && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <TrendingDown className="h-3 w-3 text-rose-600" />
                            ปรับลด {decreasedCount} รายการ
                          </span>
                        )}
                        {increasedCount > 0 && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-blue-600" />
                            ปรับเพิ่ม {increasedCount} รายการ
                          </span>
                        )}
                        {matchedCount > 0 && decreasedCount === 0 && increasedCount === 0 && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            สต็อกตรงทั้งหมด
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Table of Checked Items */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-white border-b border-slate-100 text-slate-400 font-bold text-[11px] uppercase">
                            <th className="px-4 py-2.5">รายการพัสดุ</th>
                            <th className="px-4 py-2.5">แผนก</th>
                            <th className="px-4 py-2.5 text-center">ยอดเดิมก่อนตรวจ</th>
                            <th className="px-4 py-2.5 text-center">ผลการตรวจนับจริง</th>
                            <th className="px-4 py-2.5 text-center">ส่วนต่างผลการนับ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((it, idx) => {
                            const diff = it.newQty - it.prevQty;

                            return (
                              <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-4 py-2.5 font-bold text-slate-800">
                                  {it.name}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                                    {it.department}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-center font-mono text-slate-500">
                                  {it.prevQty} {it.unit}
                                </td>
                                <td className="px-4 py-2.5 text-center font-mono font-black text-slate-900">
                                  {it.newQty} {it.unit}
                                </td>
                                <td className="px-4 py-2.5 text-center font-mono font-bold">
                                  {diff === 0 ? (
                                    <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                                      <Check className="h-3 w-3 text-emerald-500" /> ตรงเป๊ะ (0)
                                    </span>
                                  ) : diff > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-200">
                                      <TrendingUp className="h-3 w-3 text-blue-600" /> +{diff} {it.unit}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] border border-rose-200">
                                      <TrendingDown className="h-3 w-3 text-rose-600" /> {diff} {it.unit}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CABINET DETAILS (ITEMS + AUDIT LOGS + WITHDRAWALS IN THIS CABINET) */}
      {/* ========================================================================= */}
      {selectedCabinetForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between relative overflow-hidden">
              <div className="flex items-center gap-3 z-10">
                <div className="h-10 w-10 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 border border-blue-400/30">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                      รายละเอียดตู้จัดเก็บ
                    </span>
                    <span className="px-2 py-0.2 bg-white/20 text-white rounded text-[10px] font-bold">
                      {selectedCabinetForModal.departments?.join(", ") || "ไม่ระบุแผนก"}
                    </span>
                  </div>
                  <h3 className="font-black text-base sm:text-lg text-white leading-tight mt-0.5">
                    {selectedCabinetForModal.name}
                  </h3>
                  <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-blue-400" />
                    <span>{selectedCabinetForModal.location || "ไม่ระบุตำแหน่ง"}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCabinetForModal(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer z-10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs (พัสดุในตู้ / ประวัติตรวจนับตู้นี้ / ประวัติเบิกตู้นี้) */}
            <div className="px-6 pt-3 border-b border-slate-200 bg-slate-50 flex gap-2">
              <button
                onClick={() => setCabinetModalTab("items")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  cabinetModalTab === "items"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                รายการพัสดุ ({consumables.filter(c => c.cabinetId === selectedCabinetForModal.id).length})
              </button>

              <button
                onClick={() => setCabinetModalTab("counts")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  cabinetModalTab === "counts"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                ประวัติตรวจนับล่าสุด ({countLogs.filter(l => l.cabinetId === selectedCabinetForModal.id).length})
              </button>

              <button
                onClick={() => setCabinetModalTab("consumption")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  cabinetModalTab === "consumption"
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                ประวัติการเบิก ({qcLogs.filter(l => l.cabinetId === selectedCabinetForModal.id || l.items?.some(i => i.cabinetId === selectedCabinetForModal.id)).length})
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* TAB 1: Items inside */}
              {cabinetModalTab === "items" && (() => {
                const itemsInCab = consumables.filter(c => c.cabinetId === selectedCabinetForModal.id);

                return itemsInCab.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">ยังไม่มีรายการพัสดุที่ถูกจัดเก็บในตู้นี้</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {itemsInCab.map(item => {
                      const isOut = isItemOutOfStock(item);
                      const isLow = isItemLowStock(item);
                      const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);

                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 transition-all flex gap-3 items-center"
                        >
                          <img
                            src={item.imageUrl || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400"}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            onClick={() => {
                              if (item.imageUrl) {
                                setPreviewImage({ url: item.imageUrl, title: item.name });
                              }
                            }}
                            className={`h-14 w-14 rounded-xl object-cover bg-white border border-slate-200 shrink-0 ${item.imageUrl ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                            title={item.imageUrl ? "คลิกเพื่อดูรูปภาพขนาดใหญ่" : undefined}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${getDeptBadgeClass(item.department)}`}>
                                <span>แผนก {item.department}</span>
                              </span>
                              {isOut ? (
                                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded text-[9px] font-bold">
                                  หมดสต็อก
                                </span>
                              ) : isLow ? (
                                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-bold">
                                  ต่ำกว่าเกณฑ์
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">
                                  ปกติ
                                </span>
                              )}
                            </div>

                            <h5 className="font-bold text-slate-900 text-xs truncate mt-1">
                              {item.name}
                            </h5>

                            <div className="flex items-center justify-between mt-1 text-xs">
                              <span className="text-slate-500 text-[11px]">
                                คงเหลือ: <strong className={isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-emerald-700"}>{item.currentQty}</strong> {item.unit}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                (Min {item.minThreshold})
                              </span>
                            </div>

                            {multiInfo.hasMultipleCabinets && (
                              <button
                                onClick={() => setSelectedMultiStock(multiInfo)}
                                className="mt-1.5 text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Layers className="h-3 w-3" />
                                <span>ดูสต็อกข้ามตู้ (มีในอีก {multiInfo.cabinetLocations.length - 1} ตู้)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* TAB 2: Audits in this cabinet */}
              {cabinetModalTab === "counts" && (() => {
                const logsInCab = countLogs.filter(l => l.cabinetId === selectedCabinetForModal.id);

                return logsInCab.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">ยังไม่มีประวัติการตรวจนับของตู้นี้</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logsInCab.map(log => (
                      <div key={log.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(log.checkedAt)}
                          </span>
                          <span className="text-slate-600 font-medium">
                            ผู้ตรวจนับ: <strong className="text-indigo-700">{log.checkedBy}</strong>
                          </span>
                        </div>

                        <div className="divide-y divide-slate-200/60 bg-white rounded-xl p-2.5 border border-slate-200/80 text-xs">
                          {log.items?.map((it, idx) => {
                            const diff = it.newQty - it.prevQty;
                            return (
                              <div key={idx} className="py-1.5 flex items-center justify-between first:pt-0 last:pb-0">
                                <span className="font-medium text-slate-800">{it.name} ({it.department})</span>
                                <span className="font-mono text-slate-600">
                                  {it.prevQty} → <strong className="text-slate-900">{it.newQty}</strong> {it.unit}
                                  {diff !== 0 && (
                                    <span className={`ml-2 text-[10px] font-bold ${diff > 0 ? "text-blue-600" : "text-rose-600"}`}>
                                      ({diff > 0 ? `+${diff}` : diff})
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* TAB 3: Withdrawals from this cabinet */}
              {cabinetModalTab === "consumption" && (() => {
                const qcsInCab = qcLogs.filter(
                  l => l.cabinetId === selectedCabinetForModal.id || 
                  l.items?.some(i => i.cabinetId === selectedCabinetForModal.id)
                );

                return qcsInCab.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">ยังไม่มีประวัติการเบิกพัสดุจากตู้นี้</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {qcsInCab.map(log => (
                      <div key={log.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(log.consumedAt)}
                          </span>
                          <span className="text-slate-600 font-medium">
                            ผู้เบิก: <strong className="text-purple-700">{log.consumedBy}</strong>
                          </span>
                        </div>

                        <div className="divide-y divide-slate-200/60 bg-white rounded-xl p-2.5 border border-slate-200/80 text-xs">
                          {log.items?.map((it, idx) => (
                            <div key={idx} className="py-1.5 flex items-center justify-between first:pt-0 last:pb-0">
                              <span className="font-medium text-slate-800">{it.name}</span>
                              <span className="font-black text-rose-600">
                                -{it.qtyTaken} {it.unit}
                              </span>
                            </div>
                          ))}
                        </div>

                        {log.note && (
                          <div className="text-[11px] text-slate-500 italic">
                            หมายเหตุ: {log.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedCabinetForModal(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CROSS-CABINET STOCK BREAKDOWN (DEPARTMENT-SCOPED)                */}
      {/* ========================================================================= */}
      {selectedMultiStock && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-blue-200 border border-white/20">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                    สต็อกข้ามตู้ (เฉพาะแผนก {selectedMultiStock.department})
                  </span>
                  <h3 className="font-black text-white text-base truncate max-w-xs sm:max-w-sm">
                    {selectedMultiStock.displayName}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setSelectedMultiStock(null)}
                className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Overall department-scoped stock metric */}
              <div className="bg-indigo-50 border border-indigo-200/70 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-indigo-700 font-semibold block">ยอดสต็อกรวมทุกตู้ในแผนก {selectedMultiStock.department}:</span>
                  <span className="text-2xl font-black text-indigo-950">
                    {selectedMultiStock.totalQtyAcrossCabinets}
                    <span className="text-xs font-normal text-indigo-700 ml-1">{selectedMultiStock.unit}</span>
                  </span>
                </div>
                <div className="text-right text-xs text-indigo-600">
                  <span>กระจายอยู่ใน </span>
                  <strong className="text-indigo-900 text-sm">{selectedMultiStock.cabinetLocations.length}</strong>
                  <span> ตู้จัดเก็บ</span>
                </div>
              </div>

              {/* List of Cabinet locations */}
              <div className="text-xs font-bold text-slate-700">
                รายละเอียดแต่ละตู้จัดเก็บ:
              </div>

              {selectedMultiStock.cabinetLocations.map((loc, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-black text-xs shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{loc.cabinetName}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span>{getCabinetsLocationOnly(loc.cabinetId, cabinetMap) !== "-" ? getCabinetsLocationOnly(loc.cabinetId, cabinetMap) : "ไม่ได้ระบุตำแหน่ง"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-black text-sm text-slate-900">
                      {loc.currentQty} <span className="text-xs font-normal text-slate-500">{selectedMultiStock.unit}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      (Min: {loc.minThreshold})
                    </div>
                  </div>
                </div>
              ))}

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-[11px] text-amber-800 flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">การตรวจสอบก่อนสั่งซื้อหรือเบิกใช้:</span>
                  <span>
                    ระบบรวบรวมสต็อกของพัสดุชื่อเดียวกันที่อยู่<b>เฉพาะภายในแผนก {selectedMultiStock.department}</b> เท่านั้น หากพบว่ายังมีสต็อกเพียงพอในตู้อื่นของแผนกเดียวกัน สามารถเบิกมาใช้งานก่อนได้โดยไม่ต้องสั่งซื้อเพิ่ม
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMultiStock(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                เข้าใจแล้ว / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: WITHDRAWAL EVENT DETAILS (ใครเบิกอะไรบ้างแบบละเอียด)              */}
      {/* ========================================================================= */}
      {selectedQcLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-purple-200 border border-white/20">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                    รายละเอียดบันทึกการเบิกพัสดุ
                  </span>
                  <h3 className="font-black text-white text-base">
                    ผู้เบิก: {selectedQcLogModal.consumedBy}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setSelectedQcLogModal(null)}
                className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Event Metadata */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">วันที่และเวลา:</span>
                  <span className="text-slate-900 font-semibold">{formatDate(selectedQcLogModal.consumedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">ช่องทางการเบิก:</span>
                  <span className="font-bold text-purple-700">
                    {selectedQcLogModal.source === "CABINET_QR" ? "📱 เบิกผ่าน QR หน้าตู้" : "🔬 QC หยิบใช้"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">แผนก:</span>
                  <span className="text-slate-900 font-bold">แผนก {selectedQcLogModal.department}</span>
                </div>
                {selectedQcLogModal.cabinetName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">ตู้จัดเก็บ:</span>
                    <span className="text-slate-900 font-bold">{selectedQcLogModal.cabinetName}</span>
                  </div>
                )}
                {selectedQcLogModal.note && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-500 font-bold block mb-0.5">หมายเหตุ/วัตถุประสงค์:</span>
                    <p className="text-slate-800 bg-white p-2 rounded-lg border border-slate-200">
                      {selectedQcLogModal.note}
                    </p>
                  </div>
                )}
              </div>

              {/* Items Withdrawn */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  รายการพัสดุและจำนวนที่เบิก:
                </div>
                <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {selectedQcLogModal.items?.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-3">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        {item.cabinetName && (
                          <div className="text-[10px] text-slate-400">ตู้: {item.cabinetName}</div>
                        )}
                      </div>
                      <div className="font-mono font-black text-rose-600 shrink-0 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                        -{item.qtyTaken} {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedQcLogModal(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage.url}
          title={previewImage.title}
          subtitle="พัสดุคอนซูม"
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}

// Helpers for formatted cabinet location string
function getCabinetsNameWithLocation(cabinetId: string, cabinetMap: Map<string, Cabinet>): string {
  const cab = cabinetMap.get(cabinetId);
  if (!cab) return "ตู้จัดเก็บ";
  if (!cab.location) return cab.name;
  return `${cab.name} (${cab.location})`;
}

function getCabinetsLocationOnly(cabinetId: string, cabinetMap: Map<string, Cabinet>): string {
  const cab = cabinetMap.get(cabinetId);
  return cab?.location || "-";
}
