import React, { useState, useMemo } from "react";
import { DepartmentRecord, Cabinet, Consumable } from "../types";
import { printElementById } from "../lib/printHelper";
import { 
  isItemLowStock, 
  isItemOutOfStock, 
  getItemTargetStock,
  normalizeConsumableName,
  getMultiCabinetStockInfo, 
  getDeptBadgeClass,
  MultiCabinetStockInfo 
} from "../lib/stockUtils";
import { 
  Building2, 
  Package, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Printer, 
  RotateCcw, 
  Eye, 
  Layers, 
  Minus, 
  ChevronDown,
  ArrowUpDown,
  Filter,
  MapPin,
  X,
  FileText,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  LayoutGrid,
  List,
  FileSpreadsheet,
  Download,
  Copy
} from "lucide-react";

interface DepartmentConsumablesViewProps {
  departments: DepartmentRecord[];
  cabinets: Cabinet[];
  consumables: Consumable[];
  currentUserEmail?: string;
  onUpdateQty: (item: Consumable, newQty: number) => Promise<void>;
  onEditConsumable: (item: Consumable) => void;
  onDeleteConsumable: (id: string) => void;
  onAddConsumableForDept: (deptName: string) => void;
  onPreviewImage: (image: { url: string; title: string; subtitle?: string }) => void;
  getCabinetName: (id: string) => string;
  onToast: (msg: string) => void;
}

export default function DepartmentConsumablesView({
  departments,
  cabinets,
  consumables,
  currentUserEmail = "admin",
  onUpdateQty,
  onEditConsumable,
  onDeleteConsumable,
  onAddConsumableForDept,
  onPreviewImage,
  getCabinetName,
  onToast
}: DepartmentConsumablesViewProps) {
  // Selected department state (default to "ALL" or first department)
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OUT" | "LOW" | "OK">("ALL");
  const [onlyMultiCabinet, setOnlyMultiCabinet] = useState(false);
  const [sortBy, setSortBy] = useState<"DEFAULT" | "QTY_ASC" | "NAME">("DEFAULT");
  const [viewLayout, setViewLayout] = useState<"table" | "grid">("table");

  // Aggregate view toggle: default to true when viewing a specific department or overall
  const [aggregateByDepartment, setAggregateByDepartment] = useState(true);

  // Cabinet selection picker modal for Edit / Delete on aggregated items with multiple cabinets
  const [cabinetActionPrompt, setCabinetActionPrompt] = useState<{
    mode: "edit" | "delete";
    items: Consumable[];
    itemName: string;
    deptName: string;
  } | null>(null);

  // Multi-Cabinet Stock Detail Modal State
  const [selectedMultiStock, setSelectedMultiStock] = useState<MultiCabinetStockInfo | null>(null);

  // Print Inventory Sheet Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printStatusFilter, setPrintStatusFilter] = useState<"ALL" | "NEED_REFILL" | "OUT" | "OK">("ALL");
  const [printIncludeImages, setPrintIncludeImages] = useState(false);
  const [printIncludeChecklistColumn, setPrintIncludeChecklistColumn] = useState(true);
  const [printOrientation, setPrintOrientation] = useState<"portrait" | "landscape">("portrait");

  // Export Excel Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState<"CURRENT_FILTER" | "CURRENT_DEPT" | "ALL_ITEMS">("CURRENT_FILTER");
  const [exportIncludeImages, setExportIncludeImages] = useState(false);
  const [exportIncludeMultiCabinetDetails, setExportIncludeMultiCabinetDetails] = useState(true);

  // Compute union of all departments (strictly excluding Production)
  const allDeptNames = useMemo(() => {
    const names = new Set<string>();
    departments.forEach(d => {
      if (d.name && d.name.toLowerCase() !== "production") {
        names.add(d.name);
      }
    });
    consumables.forEach(c => {
      if (c.department && c.department.toLowerCase() !== "production") {
        names.add(c.department);
      }
    });
    if (names.size === 0) {
      ["CMT", "DNM", "WL", "SBS", "QC"].forEach(n => names.add(n));
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [departments, consumables]);

  // Aggregate stats per department for the top boxes
  const deptStats = useMemo(() => {
    const stats: Record<string, { totalItems: number; totalQty: number; lowStockCount: number; outOfStockCount: number }> = {};
    
    // Total for ALL
    stats["ALL"] = {
      totalItems: consumables.length,
      totalQty: consumables.reduce((acc, cur) => acc + (cur.currentQty || 0), 0),
      lowStockCount: consumables.filter(c => isItemLowStock(c) && !isItemOutOfStock(c)).length,
      outOfStockCount: consumables.filter(c => isItemOutOfStock(c)).length
    };

    allDeptNames.forEach(dept => {
      const itemsInDept = consumables.filter(c => c.department?.toLowerCase() === dept.toLowerCase());
      stats[dept] = {
        totalItems: itemsInDept.length,
        totalQty: itemsInDept.reduce((acc, cur) => acc + (cur.currentQty || 0), 0),
        lowStockCount: itemsInDept.filter(c => isItemLowStock(c) && !isItemOutOfStock(c)).length,
        outOfStockCount: itemsInDept.filter(c => isItemOutOfStock(c)).length
      };
    });

    return stats;
  }, [allDeptNames, consumables]);

  // Filter consumables based on selected department, search, status, and aggregation mode
  const filteredConsumables = useMemo(() => {
    // 1. First get items belonging to selected department
    const deptMatches = consumables.filter(item => {
      if (selectedDept !== "ALL" && item.department?.toLowerCase() !== selectedDept.toLowerCase()) {
        return false;
      }
      return true;
    });

    // 2. If aggregateByDepartment is enabled, aggregate items by normalized name per department
    let displayList: Consumable[] = [];
    if (aggregateByDepartment) {
      const groups = new Map<string, Consumable[]>();
      deptMatches.forEach(item => {
        const normName = normalizeConsumableName(item.name);
        const deptKey = (item.department || "").trim().toLowerCase();
        const key = `${deptKey}:::${normName}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(item);
      });

      groups.forEach((items) => {
        if (items.length === 1) {
          displayList.push(items[0]);
        } else {
          // Sort to find primary item (one with image or highest currentQty)
          const primary = [...items].sort((a, b) => {
            if (a.imageUrl && !b.imageUrl) return -1;
            if (!a.imageUrl && b.imageUrl) return 1;
            return (b.currentQty || 0) - (a.currentQty || 0);
          })[0];

          const totalCurrentQty = items.reduce((acc, it) => acc + (it.currentQty || 0), 0);
          const totalMinThreshold = items.reduce((acc, it) => acc + (it.minThreshold || 0), 0);
          const totalMaxThreshold = items.some(it => it.maxThreshold !== undefined && it.maxThreshold !== null)
            ? items.reduce((acc, it) => acc + (it.maxThreshold || 0), 0)
            : undefined;

          // Combined cabinet label e.g., "3 ตู้จัดเก็บ (CMT-01, CMT-02...)"
          const cabNames = Array.from(new Set(items.map(it => getCabinetName(it.cabinetId)))).filter(Boolean);
          const aggregatedCabinetLabel = cabNames.join(", ");

          displayList.push({
            ...primary,
            id: primary.id, // Primary ID
            currentQty: totalCurrentQty,
            minThreshold: totalMinThreshold,
            maxThreshold: totalMaxThreshold,
            // Keep original details for cabinet breakdown
            cabinetId: primary.cabinetId,
            notes: `รวมจาก ${items.length} ตู้: ${aggregatedCabinetLabel}`
          });
        }
      });
    } else {
      displayList = [...deptMatches];
    }

    // 3. Apply search, status filter, and multi-cabinet filter
    return displayList.filter(item => {
      // Search match
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesDept = item.department?.toLowerCase().includes(query);
        const matchesCab = getCabinetName(item.cabinetId).toLowerCase().includes(query) || (item.notes || "").toLowerCase().includes(query);
        if (!matchesName && !matchesDept && !matchesCab) return false;
      }

      // Status match
      if (statusFilter === "OUT") {
        return isItemOutOfStock(item);
      }
      if (statusFilter === "LOW") {
        return isItemLowStock(item) && !isItemOutOfStock(item);
      }
      if (statusFilter === "OK") {
        return !isItemLowStock(item);
      }

      // Multi-cabinet filter
      if (onlyMultiCabinet) {
        const info = getMultiCabinetStockInfo(item, consumables, getCabinetName);
        if (!info.hasMultipleCabinets) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "QTY_ASC") {
        return a.currentQty - b.currentQty;
      }
      if (sortBy === "NAME") {
        return a.name.localeCompare(b.name, "th");
      }
      return 0; // Default order
    });
  }, [consumables, selectedDept, aggregateByDepartment, searchTerm, statusFilter, onlyMultiCabinet, sortBy, getCabinetName]);

  // Items in current department (accounting for aggregation if on)
  const currentDeptItems = useMemo(() => {
    const deptMatches = consumables.filter(item => {
      if (selectedDept !== "ALL" && item.department?.toLowerCase() !== selectedDept.toLowerCase()) {
        return false;
      }
      return true;
    });

    if (!aggregateByDepartment) return deptMatches;

    const groups = new Map<string, Consumable[]>();
    deptMatches.forEach(item => {
      const normName = normalizeConsumableName(item.name);
      const deptKey = (item.department || "").trim().toLowerCase();
      const key = `${deptKey}:::${normName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

    const result: Consumable[] = [];
    groups.forEach(items => {
      if (items.length === 1) {
        result.push(items[0]);
      } else {
        const primary = [...items].sort((a, b) => {
          if (a.imageUrl && !b.imageUrl) return -1;
          if (!a.imageUrl && b.imageUrl) return 1;
          return (b.currentQty || 0) - (a.currentQty || 0);
        })[0];
        const totalCurrentQty = items.reduce((acc, it) => acc + (it.currentQty || 0), 0);
        const totalMinThreshold = items.reduce((acc, it) => acc + (it.minThreshold || 0), 0);
        const totalMaxThreshold = items.some(it => it.maxThreshold !== undefined && it.maxThreshold !== null)
          ? items.reduce((acc, it) => acc + (it.maxThreshold || 0), 0)
          : undefined;

        result.push({
          ...primary,
          currentQty: totalCurrentQty,
          minThreshold: totalMinThreshold,
          maxThreshold: totalMaxThreshold
        });
      }
    });
    return result;
  }, [consumables, selectedDept, aggregateByDepartment]);

  const totalInCurrentDept = currentDeptItems.length;
  const outInCurrentDept = currentDeptItems.filter(c => isItemOutOfStock(c)).length;
  const lowInCurrentDept = currentDeptItems.filter(c => isItemLowStock(c) && !isItemOutOfStock(c)).length;
  const okInCurrentDept = currentDeptItems.filter(c => !isItemLowStock(c)).length;
  const multiCabinetInCurrentDept = useMemo(() => {
    return currentDeptItems.filter(c => getMultiCabinetStockInfo(c, consumables, getCabinetName).hasMultipleCabinets).length;
  }, [currentDeptItems, consumables, getCabinetName]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setOnlyMultiCabinet(false);
    setSortBy("DEFAULT");
    onToast("รีเซ็ตตัวกรองการค้นหาเรียบร้อย");
  };

  // Computations for Printable Inventory Document
  const printItems = useMemo(() => {
    const list = consumables.filter(item => {
      // 1. Department match
      if (selectedDept !== "ALL" && item.department?.toLowerCase() !== selectedDept.toLowerCase()) {
        return false;
      }
      // 2. Status match
      if (printStatusFilter === "NEED_REFILL") {
        return isItemLowStock(item);
      }
      if (printStatusFilter === "OUT") {
        return isItemOutOfStock(item);
      }
      if (printStatusFilter === "OK") {
        return !isItemLowStock(item);
      }
      return true;
    });

    // Sort cleanly by department then item name
    return list.sort((a, b) => {
      const deptA = a.department || "";
      const deptB = b.department || "";
      const deptComp = deptA.localeCompare(deptB, "th");
      if (deptComp !== 0) return deptComp;
      return a.name.localeCompare(b.name, "th");
    });
  }, [consumables, selectedDept, printStatusFilter]);

  const totalPrintPieces = useMemo(() => {
    return printItems.reduce((acc, it) => acc + (it.currentQty || 0), 0);
  }, [printItems]);

  const totalPrintNeedRefill = useMemo(() => {
    return printItems.filter(it => isItemLowStock(it)).length;
  }, [printItems]);

  const totalPrintOutOfStock = useMemo(() => {
    return printItems.filter(it => isItemOutOfStock(it)).length;
  }, [printItems]);

  const handlePrintList = () => {
    // Sync the print filter with current view filter if appropriate
    if (statusFilter === "OUT") {
      setPrintStatusFilter("OUT");
    } else if (statusFilter === "LOW") {
      setPrintStatusFilter("NEED_REFILL");
    } else {
      setPrintStatusFilter("ALL");
    }
    setShowPrintModal(true);
  };

  // Helper to get cabinets location
  const getCabinetLocation = (cabId: string) => {
    return cabinets.find(c => c.id === cabId)?.location || "-";
  };

  // Aggregated Item action dispatcher for Edit
  const handleRequestEdit = (item: Consumable) => {
    const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);
    if (multiInfo.hasMultipleCabinets) {
      // Find all matching items across cabinets in this department
      const matchingItems = consumables.filter(c => 
        normalizeConsumableName(c.name) === multiInfo.normalizedName &&
        (c.department || "").trim().toLowerCase() === (item.department || "").trim().toLowerCase()
      );
      if (matchingItems.length > 1) {
        setCabinetActionPrompt({
          mode: "edit",
          items: matchingItems,
          itemName: item.name,
          deptName: item.department || "-"
        });
        return;
      }
    }
    // Single cabinet: open edit directly
    onEditConsumable(item);
  };

  // Aggregated Item action dispatcher for Delete
  const handleRequestDelete = (item: Consumable) => {
    const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);
    if (multiInfo.hasMultipleCabinets) {
      const matchingItems = consumables.filter(c => 
        normalizeConsumableName(c.name) === multiInfo.normalizedName &&
        (c.department || "").trim().toLowerCase() === (item.department || "").trim().toLowerCase()
      );
      if (matchingItems.length > 1) {
        setCabinetActionPrompt({
          mode: "delete",
          items: matchingItems,
          itemName: item.name,
          deptName: item.department || "-"
        });
        return;
      }
    }
    onDeleteConsumable(item.id);
  };

  // Export Excel: get items based on chosen scope
  const getExportItems = () => {
    if (exportScope === "CURRENT_FILTER") return filteredConsumables;
    if (exportScope === "CURRENT_DEPT") return currentDeptItems;
    return consumables;
  };

  // Action: Export to CSV (Formatted for Microsoft Excel with UTF-8 BOM)
  const handleExportExcel = () => {
    const items = getExportItems();
    if (items.length === 0) {
      onToast("ไม่พบรายการพัสดุสำหรับส่งออก");
      return;
    }

    const deptTag = exportScope === "CURRENT_DEPT" 
      ? (selectedDept === "ALL" ? "ALL-DEPTS" : selectedDept)
      : exportScope === "ALL_ITEMS" 
      ? "ALL-INVENTORY" 
      : `FILTERED_${selectedDept}`;
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `Consumables_Inventory_${deptTag}_${dateStr}.csv`;

    const headers = [
      "ลำดับ",
      "รหัสพัสดุ",
      "ชื่อรายการพัสดุ",
      "แผนก",
      "ตู้จัดเก็บ",
      "สถานที่ตั้งตู้",
      "จำนวนคงเหลือที่มีจริง",
      "หน่วยนับ",
      "เกณฑ์เป้าหมาย (Max)",
      "เกณฑ์ขั้นต่ำ (Min)",
      "จำนวนที่ต้องเติมสต็อก",
      "สถานะสต็อก",
      "มีในหลายตู้หรือไม่",
      "สต็อกรวมทุกตู้ของแผนก",
      "รายละเอียดตู้จัดเก็บทั้งหมด",
      ...(exportIncludeImages ? ["ลิงก์รูปถ่ายพัสดุ"] : [])
    ];

    const rows = items.map((item, idx) => {
      const targetStock = getItemTargetStock(item);
      const isOut = isItemOutOfStock(item);
      const isLow = isItemLowStock(item) && !isOut;
      const status = isOut ? "หมดสต็อก (วิกฤต)" : isLow ? "ใกล้หมด (ต่ำกว่าเกณฑ์)" : "ปกติ (พร้อมใช้)";
      const refillNeeded = Math.max(0, targetStock - (item.currentQty || 0));
      const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);
      const cabName = getCabinetName(item.cabinetId);
      const cabLoc = getCabinetLocation(item.cabinetId);

      const row = [
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
        `"${(multiInfo.hasMultipleCabinets ? multiInfo.breakdownText : cabName).replace(/"/g, '""')}"`,
        ...(exportIncludeImages ? [`"${(item.imageUrl || "").replace(/"/g, '""')}"`] : [])
      ];
      return row.join(",");
    });

    // Add UTF-8 BOM (\uFEFF) so Microsoft Excel opens Thai fonts correctly
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
    onToast(`ส่งออกไฟล์ Excel (${filename}) จำนวน ${items.length} รายการสำเร็จเรียบร้อย!`);
  };

  // Action: Copy as TSV to Clipboard for direct paste in Excel / Google Sheets
  const handleCopyExcelToClipboard = () => {
    const items = getExportItems();
    if (items.length === 0) {
      onToast("ไม่พบรายการพัสดุสำหรับคัดลอก");
      return;
    }

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
      "สต็อกรวมทุกตู้ของแผนก",
      "รายละเอียดตู้จัดเก็บ"
    ];

    const rows = items.map((item, idx) => {
      const targetStock = getItemTargetStock(item);
      const isOut = isItemOutOfStock(item);
      const isLow = isItemLowStock(item) && !isOut;
      const status = isOut ? "หมดสต็อก" : isLow ? "ใกล้หมด" : "ปกติ";
      const refillNeeded = Math.max(0, targetStock - (item.currentQty || 0));
      const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);
      const cabName = getCabinetName(item.cabinetId);
      const cabLoc = getCabinetLocation(item.cabinetId);

      return [
        idx + 1,
        item.id,
        item.name || "",
        item.department || "",
        cabName,
        cabLoc,
        item.currentQty ?? 0,
        item.unit || "ชิ้น",
        targetStock,
        item.minThreshold ?? 0,
        refillNeeded,
        status,
        multiInfo.hasMultipleCabinets ? multiInfo.totalQtyAcrossCabinets : (item.currentQty ?? 0),
        multiInfo.hasMultipleCabinets ? multiInfo.breakdownText : cabName
      ].join("\t");
    });

    const tsvContent = [headers.join("\t"), ...rows].join("\n");
    navigator.clipboard.writeText(tsvContent).then(() => {
      setShowExportModal(false);
      onToast(`คัดลอกข้อมูล ${items.length} รายการลงคลิปบอร์ดแล้ว! สามารถกด Paste (Ctrl+V) ลงใน Excel ได้ทันที`);
    }).catch(() => {
      onToast("ไม่สามารถคัดลอกลงคลิปบอร์ดได้ กรุณากดปุ่มดาวน์โหลดไฟล์แทน");
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP DEPARTMENT BOXES (BOX ของแผนก - คล้ายรูปแรก) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-700" />
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
              เลือกดูตามแผนก (Department Units)
            </h2>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              — คลิกที่กล่องแผนกเพื่อดูและปรับสต็อกพัสดุด้านล่าง
            </span>
          </div>
          <button
            onClick={() => onAddConsumableForDept(selectedDept === "ALL" ? (allDeptNames[0] || "CMT") : selectedDept)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>เพิ่มพัสดุในแผนกนี้</span>
          </button>
        </div>

        {/* Responsive Grid of Department Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Card: รวมทุกแผนก */}
          {(() => {
            const isSelected = selectedDept === "ALL";
            const stats = deptStats["ALL"] || { totalItems: 0, totalQty: 0, lowStockCount: 0, outOfStockCount: 0 };
            const hasShortage = (stats.lowStockCount + stats.outOfStockCount) > 0;
            return (
              <button
                key="ALL"
                onClick={() => setSelectedDept("ALL")}
                className={`text-left p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ios-press ${
                  isSelected
                    ? "ios-glass border-2 border-indigo-400/80 ring-4 ring-indigo-500/10 shadow-lg shadow-indigo-100/50 bg-indigo-50/40 backdrop-blur-xl"
                    : "ios-glass-card border border-white/80 hover:border-indigo-200 shadow-sm hover:shadow-md"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-indigo-600 rounded-bl-xl" />
                )}
                <div className="flex items-start gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                  <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100/90 text-slate-600"
                  }`}>
                    <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-xs sm:text-sm truncate text-slate-800">
                      รวมทุกแผนก
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                      {cabinets.length} ตู้จัดเก็บ
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100/80 text-[10px] sm:text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px] sm:text-[10px] font-semibold">คงเหลือ</span>
                    <span className="font-extrabold text-slate-900">{stats.totalQty} ชิ้น</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] sm:text-[10px] font-semibold">ต้องเติม</span>
                    {hasShortage ? (
                      <span className="font-extrabold text-rose-600 truncate block">
                        ขาด {stats.lowStockCount + stats.outOfStockCount}
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-600 truncate block">ครบเกณฑ์</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })()}

          {/* Cards for each Department */}
          {allDeptNames.map(dept => {
            const isSelected = selectedDept.toLowerCase() === dept.toLowerCase();
            const stats = deptStats[dept] || { totalItems: 0, totalQty: 0, lowStockCount: 0, outOfStockCount: 0 };
            const deptRecord = departments.find(d => d.name.toLowerCase() === dept.toLowerCase());
            const hasShortage = (stats.lowStockCount + stats.outOfStockCount) > 0;

            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`text-left p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ios-press ${
                  isSelected
                    ? "ios-glass border-2 border-indigo-400/80 ring-4 ring-indigo-500/10 shadow-lg shadow-indigo-100/50 bg-indigo-50/40 backdrop-blur-xl"
                    : "ios-glass-card border border-white/80 hover:border-indigo-200 shadow-sm hover:shadow-md"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-indigo-600 rounded-bl-xl" />
                )}
                <div className="flex items-start gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                  <div 
                    className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100/90 text-slate-600"
                    }`}
                  >
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-xs sm:text-sm truncate uppercase text-slate-800">
                      {dept}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                      {stats.totalItems} รายการ
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100/80 text-[10px] sm:text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px] sm:text-[10px] font-semibold">คงเหลือ</span>
                    <span className="font-extrabold text-slate-900">{stats.totalQty} ชิ้น</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] sm:text-[10px] font-semibold">สถานะ</span>
                    {hasShortage ? (
                      <span className="font-extrabold text-rose-600 truncate block">
                        ขาด {stats.lowStockCount + stats.outOfStockCount}
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-600 truncate block">ครบเกณฑ์</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SUBHEADER & FILTER CONTROLS (คล้ายแถบควบคุมในรูปแรก) */}
      <div className="ios-glass-card p-3.5 sm:p-5 rounded-3xl border border-white/80 shadow-lg shadow-slate-200/40 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-900 font-extrabold text-sm sm:text-lg">
              รายการพัสดุ:
            </span>
            <span className="px-3 py-1 bg-white/80 backdrop-blur-md text-slate-800 font-black text-xs sm:text-sm rounded-xl border border-white/90 shadow-2xs uppercase">
              {selectedDept === "ALL" ? "รวมทุกแผนก" : selectedDept}
            </span>
            <span className="px-2.5 py-1 bg-emerald-50/80 backdrop-blur-xs text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200/80">
              มาตรฐาน {totalInCurrentDept} รายการ
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Aggregation Toggle: แสดงรวมยอดของแผนก หรือ แยกรายตู้ */}
            <button
              type="button"
              onClick={() => setAggregateByDepartment(!aggregateByDepartment)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer shadow-2xs ${
                aggregateByDepartment
                  ? "bg-indigo-50 border-indigo-200 text-indigo-800 ring-1 ring-indigo-200"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
              }`}
              title={aggregateByDepartment ? "กำลังแสดงรวมยอดสต็อกแต่ละแผนก (ไม่แยกตู้)" : "กำลังแสดงแยกตามตู้จัดเก็บ"}
            >
              <Layers className={`h-3.5 w-3.5 ${aggregateByDepartment ? "text-indigo-600" : "text-slate-400"}`} />
              <span className="hidden sm:inline">
                {aggregateByDepartment ? "แสดงรวมของแผนก (ไม่แยกตู้)" : "แสดงแยกตามตู้"}
              </span>
              <span className="sm:hidden">
                {aggregateByDepartment ? "รวมแผนก" : "แยกตู้"}
              </span>
            </button>

            {/* View Layout Toggle (Table vs Grid) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewLayout("table")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewLayout === "table"
                    ? "bg-white text-slate-950 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="มุมมองตาราง (Compact Table)"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ตาราง</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("grid")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewLayout === "grid"
                    ? "bg-white text-slate-950 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="มุมมองการ์ดรูปภาพ (Visual Grid)"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">การ์ดรูป</span>
              </button>
            </div>

            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>รีเซ็ต</span>
            </button>
            <button
              onClick={handlePrintList}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs rounded-xl border border-sky-200 cursor-pointer transition-colors shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5 text-sky-600" />
              <span>พิมพ์รายการ</span>
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
              title="ดึงข้อมูลพัสดุเป็นไฟล์ Excel (.csv) รองรับภาษาไทยสมบูรณ์"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-100" />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>

        {/* Search, Status Filters, and Sorter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Search bar */}
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อพัสดุ..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
            />
          </div>

          {/* Status Tabs and Sorter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Horizontal Scrollable Status Chips on mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full shrink-0">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === "ALL"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                ทั้งหมด ({totalInCurrentDept})
              </button>
              <button
                onClick={() => setStatusFilter("OUT")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === "OUT"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-rose-50 hover:bg-rose-100 text-rose-700"
                }`}
              >
                หมดสต็อก ({outInCurrentDept})
              </button>
              <button
                onClick={() => setStatusFilter("LOW")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === "LOW"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-700"
                }`}
              >
                ใกล้หมด ({lowInCurrentDept})
              </button>
              <button
                onClick={() => setStatusFilter("OK")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === "OK"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                }`}
              >
                สต็อกปกติ ({okInCurrentDept})
              </button>

              <button
                onClick={() => setOnlyMultiCabinet(!onlyMultiCabinet)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  onlyMultiCabinet
                    ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300"
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                }`}
                title="กรองเฉพาะพัสดุที่มีสต็อกกระจายในหลายตู้ (เช่น เก็บทั้งในตู้ CMT และตู้ QA/QC)"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>มีในหลายตู้ ({multiCabinetInCurrentDept})</span>
              </button>
            </div>

            {/* Sorter */}
            <div className="relative sm:ml-auto w-full sm:w-auto">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="w-full sm:w-auto text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <option value="DEFAULT">เรียงตามลำดับมาตรฐาน</option>
                <option value="QTY_ASC">เรียงตามคงเหลือ (น้อย → มาก)</option>
                <option value="NAME">เรียงตามชื่อพัสดุ (ก-ฮ)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONSUMABLES VIEW: GRID OR TABLE */}
      <div className="ios-glass-card rounded-3xl border border-white/80 shadow-xl shadow-slate-200/40 overflow-hidden">
        {viewLayout === "grid" ? (
          /* GRID VIEW (VISUAL CARDS) */
          <div className="p-3.5 sm:p-5 bg-white/30 backdrop-blur-sm min-h-[300px]">
            {filteredConsumables.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Package className="h-10 w-10 text-slate-300 mx-auto mb-2 opacity-60" />
                <p className="font-semibold text-sm">ไม่พบรายการพัสดุตามเงื่อนไขที่เลือก</p>
                <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "เพิ่มพัสดุในแผนกนี้" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                {filteredConsumables.map((item, index) => {
                  const isOutOfStock = isItemOutOfStock(item);
                  const isLow = isItemLowStock(item) && !isOutOfStock;
                  const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);

                  return (
                    <div
                      key={item.id}
                      className={`ios-glass-card rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-md hover:shadow-xl ${
                        isOutOfStock
                          ? "border-rose-300/80 ring-2 ring-rose-400/20"
                          : isLow
                          ? "border-amber-300/80 ring-2 ring-amber-400/20"
                          : "border-white/80 hover:border-indigo-200"
                      }`}
                    >
                      <div>
                        {/* Photo & Status Badge */}
                        <div className="relative h-44 w-full bg-slate-100 overflow-hidden group">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                            onClick={() => onPreviewImage({
                              url: item.imageUrl,
                              title: item.name,
                              subtitle: `แผนก: ${item.department} | ตู้: ${getCabinetName(item.cabinetId)} | คงเหลือ: ${item.currentQty} ${item.unit}`
                            })}
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-2.5 left-2.5">
                            <span className="px-2 py-0.5 bg-slate-950/75 backdrop-blur-xs text-white text-[10px] font-mono font-bold rounded-lg shadow-xs">
                              #{index + 1}
                            </span>
                          </div>
                          <div className="absolute top-2.5 right-2.5">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600/90 backdrop-blur-xs text-white font-black text-[10px] rounded-full shadow-xs">
                                <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                                หมดสต็อก (0)
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/90 backdrop-blur-xs text-white font-black text-[10px] rounded-full shadow-xs">
                                <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                                ใกล้หมด ({item.currentQty})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600/90 backdrop-blur-xs text-white font-bold text-[10px] rounded-full shadow-xs">
                                <span className="h-1.5 w-1.5 bg-white rounded-full" />
                                ปกติ ({item.currentQty})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-3.5 space-y-3">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider ${getDeptBadgeClass(item.department)}`}>
                                <Building2 className="h-3 w-3 shrink-0" />
                                <span>แผนก {item.department}</span>
                              </span>
                              {multiInfo.hasMultipleCabinets && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedMultiStock(multiInfo)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 cursor-pointer transition-colors"
                                  title="พัสดุนี้มีเก็บในหลายตู้ คลิกเพื่อดูรายละเอียด"
                                >
                                  <Layers className="h-3 w-3" />
                                  <span>กระจาย {multiInfo.cabinetLocations.length} ตู้</span>
                                </button>
                              )}
                            </div>
                            <h4 className="font-extrabold text-slate-900 text-sm line-clamp-2 leading-snug" title={item.name}>
                              {item.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {aggregateByDepartment && multiInfo.hasMultipleCabinets
                                  ? `รวม ${multiInfo.cabinetLocations.length} ตู้จัดเก็บ`
                                  : getCabinetName(item.cabinetId)}
                              </span>
                            </p>
                          </div>

                          {/* Stock Quantity Stats & Quick Adjust */}
                          <div className="bg-white/60 backdrop-blur-md p-3 rounded-2xl border border-white/80 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 text-[11px] font-semibold">จำนวนคงเหลือ</span>
                              <div className="flex items-baseline gap-1">
                                <span className={`text-base font-black ${
                                  isOutOfStock ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
                                }`}>
                                  {item.currentQty}
                                </span>
                                <span className="text-slate-400 text-[11px]">/ เกณฑ์ {item.minThreshold} {item.unit}</span>
                              </div>
                            </div>

                            {/* Quick +/- Adjusters */}
                            <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/50">
                              <span className="text-[10px] text-slate-400 font-bold">ปรับยอด:</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => onUpdateQty(item, Math.max(0, item.currentQty - 1))}
                                  className="h-7 w-7 rounded-xl bg-white/90 hover:bg-white border border-slate-200/80 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer ios-press transition-all shadow-2xs"
                                  title="ลด 1"
                                >
                                  -1
                                </button>
                                <button
                                  onClick={() => onUpdateQty(item, item.currentQty + 1)}
                                  className="h-7 w-7 rounded-xl bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs cursor-pointer ios-press transition-all shadow-2xs"
                                  title="เพิ่ม 1"
                                >
                                  +1
                                </button>
                                <button
                                  onClick={() => onUpdateQty(item, item.currentQty + 5)}
                                  className="h-7 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px] cursor-pointer ios-press transition-all shadow-2xs"
                                  title="เติม +5"
                                >
                                  +5
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Card Actions */}
                      <div className="p-3 bg-white/50 backdrop-blur-md border-t border-white/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 truncate">
                          หน่วย: <b className="text-slate-700 font-bold">{item.unit}</b>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleRequestEdit(item)}
                            className="p-1.5 bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border border-white/90 rounded-xl cursor-pointer transition-colors shadow-2xs ios-press"
                            title="แก้ไขข้อมูลพัสดุ"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRequestDelete(item)}
                            className="p-1.5 bg-white/80 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-white/90 hover:border-rose-200 rounded-xl cursor-pointer transition-colors shadow-2xs ios-press"
                            title="ลบพัสดุนี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* MOBILE VIEW: Cards optimized for mobile phone touch (md:hidden) */}
            <div className="block md:hidden divide-y divide-slate-100">
          {filteredConsumables.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400">
              <Package className="h-10 w-10 text-slate-300 mx-auto mb-2 opacity-60" />
              <p className="font-semibold text-sm">ไม่พบรายการพัสดุตามเงื่อนไขที่เลือก</p>
              <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "เพิ่มพัสดุในแผนกนี้"</p>
            </div>
          ) : (
            filteredConsumables.map((item, index) => {
              const isOutOfStock = isItemOutOfStock(item);
              const isLow = isItemLowStock(item) && !isOutOfStock;
              const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);

              return (
                <div 
                  key={item.id} 
                  className={`p-3.5 space-y-3 transition-colors ${
                    isOutOfStock ? "bg-rose-50/20" : isLow ? "bg-amber-50/15" : ""
                  }`}
                >
                  {/* Top: Index, Image, Name & Quick Actions */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Thumbnail */}
                      <div
                        onClick={() => onPreviewImage({
                          url: item.imageUrl,
                          title: item.name,
                          subtitle: `แผนก: ${item.department} | ตู้: ${getCabinetName(item.cabinetId)} | คงเหลือ: ${item.currentQty} ${item.unit}`
                        })}
                        className="relative h-12 w-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer shadow-2xs"
                        title="คลิกเพื่อดูรูปภาพขยาย"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-white opacity-0 active:opacity-100">
                          <Eye className="h-3.5 w-3.5" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            #{index + 1}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider ${getDeptBadgeClass(item.department)}`}>
                            <Building2 className="h-2.5 w-2.5 shrink-0" />
                            <span>แผนก {item.department}</span>
                          </span>
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug break-words mt-0.5">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>
                            {aggregateByDepartment && multiInfo.hasMultipleCabinets
                              ? `รวม ${multiInfo.cabinetLocations.length} ตู้จัดเก็บ`
                              : `ตู้: ${getCabinetName(item.cabinetId)}`}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Edit / Delete Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleRequestEdit(item)}
                        className="p-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                        title="แก้ไขข้อมูลพัสดุ"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRequestDelete(item)}
                        className="p-2 bg-slate-50 hover:bg-rose-50 active:bg-rose-100 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                        title="ลบพัสดุนี้"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Middle & Bottom: Status, Target & Quantity Display */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/80">
                    {/* Left: Status & Target */}
                    <div>
                      <div className="text-[11px] font-medium text-slate-500 mb-1">
                        เกณฑ์มาตรฐาน: <span className="font-extrabold text-slate-800">{item.minThreshold} {item.unit}</span>
                      </div>
                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-full font-bold text-[10px]">
                          <span className="h-1.5 w-1.5 bg-rose-600 rounded-full animate-pulse" />
                          ยังไม่มีในตู้ (0)
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-full font-bold text-[10px]">
                          <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />
                          ใกล้หมดสต็อก
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full font-bold text-[10px]">
                          <span className="h-1.5 w-1.5 bg-emerald-600 rounded-full" />
                          สต็อกปกติ
                        </span>
                      )}
                    </div>

                    {/* Right: Clean Quantity Display */}
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold mb-0.5">
                        จำนวนในตู้นี้
                      </div>
                      <div className={`inline-flex items-center justify-center min-w-[54px] px-3 py-1.5 rounded-xl border font-black text-sm shadow-2xs ${
                        isOutOfStock 
                          ? "bg-rose-50 border-rose-200 text-rose-600" 
                          : isLow 
                          ? "bg-amber-50 border-amber-200 text-amber-600" 
                          : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}>
                        <span>{item.currentQty}</span>
                        <span className="text-[11px] font-bold text-slate-500 ml-1">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Cabinet Breakdown Box (เมื่อพบในหลายตู้ เช่น ตู้ CMT และ ตู้ QA/QC) */}
                  {multiInfo.hasMultipleCabinets && (
                    <div className="p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-indigo-950">
                        <span className="flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span>กระจายใน {multiInfo.cabinetLocations.length} ตู้จัดเก็บ:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedMultiStock(multiInfo)}
                          className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg font-black text-[10px] cursor-pointer transition-all shadow-2xs"
                        >
                          รวมทุกตู้ {multiInfo.totalQtyAcrossCabinets} {item.unit}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {multiInfo.cabinetLocations.map(loc => {
                          const isThisCabinet = loc.consumableId === item.id;
                          return (
                            <div 
                              key={loc.consumableId} 
                              className={`flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                                isThisCabinet 
                                  ? "bg-white font-bold text-indigo-950 shadow-2xs border border-indigo-200" 
                                  : "bg-indigo-100/60 text-slate-700"
                              }`}
                            >
                              <span className="truncate pr-1 flex items-center gap-1">
                                <span className={`h-1.5 w-1.5 rounded-full ${isThisCabinet ? "bg-indigo-600" : "bg-slate-400"}`} />
                                <span>{loc.cabinetName} ({loc.department})</span>
                                {isThisCabinet && <span className="text-[10px] text-indigo-600 font-black">[ตู้นี้]</span>}
                              </span>
                              <span className={`font-black shrink-0 ${loc.isOutOfStock ? "text-rose-600" : loc.isLowStock ? "text-amber-600" : "text-emerald-700"}`}>
                                {loc.currentQty} {loc.unit}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP VIEW: Full 8-Column Table (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 sticky top-0 z-10 shadow-2xs">
                <th className="py-4 px-4 w-14 text-center">ลำดับ</th>
                <th className="py-3.5 px-5">รายการพัสดุ (CONSUMABLE ITEM)</th>
                <th className="py-3.5 px-4 text-center">เป้าหมายมาตรฐาน</th>
                <th className="py-3.5 px-4 text-center">จำนวนที่มีจริง</th>
                <th className="py-3.5 px-3 text-center">หน่วยนับ</th>
                <th className="py-3.5 px-4">ตู้จัดเก็บ</th>
                <th className="py-3.5 px-4 text-center">สถานะ</th>
                <th className="py-3.5 px-4 text-right w-24">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredConsumables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Package className="h-10 w-10 text-slate-300 mx-auto mb-2 opacity-60" />
                    <p className="font-semibold">ไม่พบรายการพัสดุตามเงื่อนไขที่เลือก</p>
                    <p className="text-[11px] text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "เพิ่มพัสดุในแผนกนี้" เพื่อเริ่มต้น</p>
                  </td>
                </tr>
              ) : (
                filteredConsumables.map((item, index) => {
                  const isOutOfStock = isItemOutOfStock(item);
                  const isLow = isItemLowStock(item) && !isOutOfStock;
                  const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isOutOfStock ? "bg-rose-50/30" : isLow ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Index */}
                      <td className="py-4 px-4 text-center font-bold text-slate-400 text-xs">
                        {index + 1}
                      </td>

                      {/* Item Details */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => onPreviewImage({
                              url: item.imageUrl,
                              title: item.name,
                              subtitle: `แผนก: ${item.department} | ตู้: ${getCabinetName(item.cabinetId)} | คงเหลือ: ${item.currentQty} ${item.unit}`
                            })}
                            className="relative h-11 w-11 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer group shadow-2xs"
                            title="คลิกเพื่อดูรูปภาพขยาย"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="h-3 w-3" />
                            </div>
                          </div>
                          <div>
                            <span className="font-black text-slate-900 text-xs sm:text-sm block leading-tight">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md uppercase tracking-wider ${getDeptBadgeClass(item.department)}`}>
                                <Building2 className="h-3 w-3 shrink-0" />
                                <span>แผนก {item.department}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {item.id.slice(-6)}
                              </span>
                              {multiInfo.hasMultipleCabinets && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedMultiStock(multiInfo)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[9px] font-black cursor-pointer"
                                  title="คลิกดูสต็อกกระจายทุกตู้"
                                >
                                  <Layers className="h-2.5 w-2.5 text-indigo-600" />
                                  <span>{multiInfo.cabinetLocations.length} ตู้</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Safety Standard Target */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs">
                          {item.minThreshold} {item.unit}
                        </div>
                      </td>

                      {/* Current Real Quantity (จำนวนที่มีจริง) */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div
                            className={`inline-flex items-center justify-center min-w-[52px] px-3 py-1 rounded-lg border font-black text-sm shadow-2xs ${
                              isOutOfStock
                                ? "bg-rose-50 border-rose-200 text-rose-600"
                                : isLow
                                ? "bg-amber-50 border-amber-200 text-amber-600"
                                : "bg-slate-50 border-slate-200 text-slate-800"
                            }`}
                          >
                            <span>{item.currentQty}</span>
                          </div>
                          {multiInfo.hasMultipleCabinets && (
                            <button
                              type="button"
                              onClick={() => setSelectedMultiStock(multiInfo)}
                              className="mt-1 text-[10px] font-extrabold text-indigo-700 hover:text-indigo-900 cursor-pointer underline decoration-dotted decoration-indigo-300"
                              title="คลิกดูสต็อกกระจายทุกตู้"
                            >
                              (รวม: {multiInfo.totalQtyAcrossCabinets})
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-4 px-3 text-center font-bold text-slate-600 text-xs">
                        {item.unit}
                      </td>

                      {/* Cabinet Name & Multi-Cabinet Information */}
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-800 block truncate max-w-[160px]" title={getCabinetName(item.cabinetId)}>
                          {getCabinetName(item.cabinetId)}
                        </span>
                        {multiInfo.hasMultipleCabinets ? (
                          <div className="mt-1 flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedMultiStock(multiInfo)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-md font-bold text-[10px] cursor-pointer transition-colors w-fit"
                              title="คลิกดูสต็อกในตู้ทั้งหมด"
                            >
                              <Layers className="h-2.5 w-2.5 text-indigo-600" />
                              <span>พบใน {multiInfo.cabinetLocations.length} ตู้</span>
                            </button>
                            <span className="text-[10px] text-slate-500 truncate max-w-[180px]" title={multiInfo.breakdownText}>
                              {multiInfo.breakdownText}
                            </span>
                          </div>
                        ) : (
                          item.department?.toLowerCase() !== getCabinetName(item.cabinetId).toLowerCase() && (
                            <span className={`inline-flex items-center gap-1 mt-1 text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider ${getDeptBadgeClass(item.department)}`}>
                              <Building2 className="h-2.5 w-2.5 shrink-0" />
                              <span>แผนก {item.department}</span>
                            </span>
                          )
                        )}
                      </td>

                      {/* Status Indicator (คล้ายรูปแรก เช่น ยังไม่มีพัสดุในตู้ / สต็อกปกติ) */}
                      <td className="py-4 px-4 text-center">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full font-bold text-[11px]">
                            <span className="h-1.5 w-1.5 bg-rose-600 rounded-full animate-pulse" />
                            ยังไม่มีในตู้ (0)
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full font-bold text-[11px]">
                            <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />
                            ใกล้หมด ({item.currentQty})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full font-bold text-[11px]">
                            <span className="h-1.5 w-1.5 bg-emerald-600 rounded-full" />
                            สต็อกปกติ ({item.currentQty})
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRequestEdit(item)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                            title="แก้ไขข้อมูลพัสดุ"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRequestDelete(item)}
                            className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg cursor-pointer transition-colors"
                            title="ลบพัสดุนี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      </>
    )}
  </div>

      {/* 5. PRINTABLE INVENTORY SHEET MODAL (เอกสารสำหรับพิมพ์ตรวจนับพัสดุ) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print-modal-overlay">
          <style>{`
            @media print {
              @page {
                size: ${printOrientation};
                margin: 1cm;
              }
            }
          `}</style>
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden my-4 border border-slate-200 flex flex-col max-h-[92vh] print-modal-container">
            
            {/* Modal Header & Controls (Non-printable) */}
            <div className="p-3 sm:p-4 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 no-print border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                    พิมพ์ใบรายการพัสดุและตรวจนับสต็อก (Printable Inventory Sheet)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    ระบบจัดเตรียมเอกสารแบบฟอร์มกระดาษ A4 สะอาด คมชัด ไม่ติดหน้าจอหรือปุ่มควบคุม
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => printElementById("printable-inventory-sheet", "ใบสรุปรายการพัสดุและยอดสต็อกคงคลัง", printOrientation)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
                  title="ส่งคำสั่งพิมพ์ไปยังเครื่องพิมพ์ / PDF"
                >
                  <Printer className="h-4 w-4" />
                  <span>สั่งพิมพ์กระดาษ A4</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                  title="ปิดหน้าต่างนี้"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Non-printable Toolbar (Filter, Column toggles, Orientation) */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
              {/* Filter Selection */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-500 text-[11px]">เลือกรายการ:</span>
                <button
                  onClick={() => setPrintStatusFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    printStatusFilter === "ALL"
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  ทั้งหมด ({totalInCurrentDept})
                </button>
                <button
                  onClick={() => setPrintStatusFilter("NEED_REFILL")}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    printStatusFilter === "NEED_REFILL"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  เฉพาะที่ต้องเติม ({outInCurrentDept + lowInCurrentDept})
                </button>
                <button
                  onClick={() => setPrintStatusFilter("OUT")}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    printStatusFilter === "OUT"
                      ? "bg-rose-600 text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  หมดสต็อก ({outInCurrentDept})
                </button>
              </div>

              {/* Display Toggles & Orientation */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printIncludeChecklistColumn}
                    onChange={(e) => setPrintIncludeChecklistColumn(e.target.checked)}
                    className="rounded text-sky-700 focus:ring-sky-700 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span>ช่องจดนับจริง [____]</span>
                </label>

                <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printIncludeImages}
                    onChange={(e) => setPrintIncludeImages(e.target.checked)}
                    className="rounded text-sky-700 focus:ring-sky-700 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span>แสดงรูปภาพ</span>
                </label>

                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                  <button
                    onClick={() => setPrintOrientation("portrait")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      printOrientation === "portrait" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    แนวตั้ง
                  </button>
                  <button
                    onClick={() => setPrintOrientation("landscape")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      printOrientation === "landscape" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    แนวนอน
                  </button>
                </div>
              </div>
            </div>

            {/* Printable Document Sheet Body */}
            <div id="printable-inventory-sheet" className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white text-slate-900 print-section">
              
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-900 text-white font-extrabold text-[10px] tracking-wider rounded uppercase">
                        INVENTORY REPORT
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        ระบบบริหารจัดการตู้เก็บพัสดุและวัสดุโรงงาน
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                      ใบสรุปรายการพัสดุและยอดสต็อกคงคลัง (CONSUMABLE INVENTORY LIST)
                    </h1>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      เอกสารสำหรับตรวจนับสต็อกพัสดุจริงประจำจุด และตรวจสอบสถานะความพร้อมใช้งาน
                    </p>
                  </div>

                  <div className="text-right text-xs shrink-0">
                    <p className="font-extrabold text-slate-900">
                      เลขที่เอกสาร: <span className="font-mono">INV-{new Date().toISOString().slice(0, 10).replace(/-/g, "")}-{selectedDept === "ALL" ? "ALL" : selectedDept.slice(0, 4).toUpperCase()}</span>
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      วันที่พิมพ์: {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                    <p className="text-slate-500">
                      เวลา: {new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">แผนกที่เรียกดู:</span>
                    <span className="font-black text-slate-900 text-sm uppercase">
                      {selectedDept === "ALL" ? "รวมทุกแผนก (ALL DEPARTMENTS)" : `แผนก ${selectedDept}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">เงื่อนไขการพิมพ์:</span>
                    <span className="font-bold text-slate-800">
                      {printStatusFilter === "ALL" ? "รายการทั้งหมด" : printStatusFilter === "NEED_REFILL" ? "เฉพาะที่ต้องเติม" : printStatusFilter === "OUT" ? "เฉพาะหมดสต็อก" : "สต็อกปกติ"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">จำนวนรายการ:</span>
                    <span className="font-extrabold text-slate-900">
                      {printItems.length} รายการ
                    </span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">ผู้พิมพ์รายงาน:</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {currentUserEmail}
                    </span>
                  </div>
                </div>
              </div>

              {/* Printable Table */}
              <table className="w-full text-left border-collapse border border-slate-300 text-xs mb-4">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold text-slate-800">
                    <th className="p-2 border border-slate-300 text-center w-8">ลำดับ</th>
                    {printIncludeImages && (
                      <th className="p-2 border border-slate-300 text-center w-12">รูป</th>
                    )}
                    <th className="p-2 border border-slate-300">รายการพัสดุสิ้นเปลือง</th>
                    <th className="p-2 border border-slate-300 text-center w-20">แผนก</th>
                    <th className="p-2 border border-slate-300 w-32">ตู้จัดเก็บ</th>
                    <th className="p-2 border border-slate-300 text-center w-16">เกณฑ์มาตรฐาน</th>
                    <th className="p-2 border border-slate-300 text-center w-16">คงเหลือระบบ</th>
                    <th className="p-2 border border-slate-300 text-center w-14">หน่วยนับ</th>
                    <th className="p-2 border border-slate-300 text-center w-24">สถานะ</th>
                    {printIncludeChecklistColumn && (
                      <th className="p-2 border border-slate-300 text-center w-24">ยอดนับจริง</th>
                    )}
                    <th className="p-2 border border-slate-300 w-28">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {printItems.length === 0 ? (
                    <tr>
                      <td colSpan={printIncludeImages && printIncludeChecklistColumn ? 11 : 10} className="p-6 text-center text-slate-400 italic">
                        ไม่มีรายการพัสดุตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    printItems.map((item, idx) => {
                      const isOutOfStock = isItemOutOfStock(item);
                      const isLow = isItemLowStock(item) && !isOutOfStock;
                      const multiInfo = getMultiCabinetStockInfo(item, consumables, getCabinetName);

                      return (
                        <tr key={item.id} className="border-b border-slate-200">
                          <td className="p-2 border border-slate-200 text-center font-mono font-bold text-slate-500">
                            {idx + 1}
                          </td>

                          {printIncludeImages && (
                            <td className="p-1.5 border border-slate-200 text-center">
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="h-8 w-8 object-cover rounded mx-auto border border-slate-200"
                              />
                            </td>
                          )}

                          <td className="p-2 border border-slate-200">
                            <span className="font-bold text-slate-900 block leading-tight">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[9px] text-slate-400 font-mono">
                                ID: {item.id.slice(-6)}
                              </span>
                              {multiInfo.hasMultipleCabinets && (
                                <span className="text-[9px] font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                  มีใน {multiInfo.cabinetLocations.length} ตู้: {multiInfo.breakdownText}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-2 border border-slate-200 text-center font-bold uppercase text-slate-700 text-[11px]">
                            {item.department}
                          </td>

                          <td className="p-2 border border-slate-200 text-slate-700 text-[11px]">
                            {getCabinetName(item.cabinetId)}
                          </td>

                          <td className="p-2 border border-slate-200 text-center font-semibold text-slate-700">
                            {item.minThreshold}
                          </td>

                          <td className="p-2 border border-slate-200 text-center font-black">
                            <span className={isOutOfStock ? "text-rose-700 font-black" : isLow ? "text-amber-700 font-black" : "text-slate-900"}>
                              {item.currentQty}
                            </span>
                            {multiInfo.hasMultipleCabinets && (
                              <span className="text-[9px] text-indigo-700 block font-bold mt-0.5">
                                (รวมทุกตู้ {multiInfo.totalQtyAcrossCabinets})
                              </span>
                            )}
                          </td>

                          <td className="p-2 border border-slate-200 text-center font-medium text-slate-600">
                            {item.unit}
                          </td>

                          <td className="p-2 border border-slate-200 text-center text-[10px] font-bold">
                            {isOutOfStock ? (
                              <span className="text-rose-700">หมดสต็อก (0)</span>
                            ) : isLow ? (
                              <span className="text-amber-800">ใกล้หมด</span>
                            ) : (
                              <span className="text-emerald-800">สต็อกปกติ</span>
                            )}
                          </td>

                          {printIncludeChecklistColumn && (
                            <td className="p-2 border border-slate-200 text-center">
                              <div className="h-6 w-16 mx-auto border border-slate-300 rounded bg-slate-50/50" />
                            </td>
                          )}

                          <td className="p-2 border border-slate-200 text-slate-400 text-[10px]">
                            ....................
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-xs">
                    <td colSpan={printIncludeImages ? 6 : 5} className="p-2 text-right">
                      รวมจำนวนพัสดุในระบบ:
                    </td>
                    <td className="p-2 text-center text-sm font-black text-slate-900 bg-slate-200/60">
                      {totalPrintPieces}
                    </td>
                    <td colSpan={printIncludeChecklistColumn ? 4 : 3} className="p-2 text-left text-slate-600">
                      หน่วย (ต้องเติม {totalPrintNeedRefill} รายการ, หมดสต็อก {totalPrintOutOfStock} รายการ)
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Document Signatures Footer */}
              <div className="grid grid-cols-3 gap-6 pt-8 mt-6 border-t border-slate-300 text-center text-xs print-avoid-break">
                <div>
                  <div className="border-b border-slate-400 w-40 mx-auto mb-2 h-10" />
                  <p className="font-bold text-slate-900">ผู้จัดพิมพ์รายงาน (Prepared by)</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">({currentUserEmail || "................................................"})</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">วันที่: ...../...../..........</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-40 mx-auto mb-2 h-10" />
                  <p className="font-bold text-slate-900">เจ้าหน้าที่ตรวจนับสต็อกจริง (Checker)</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">(................................................)</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">วันที่: ...../...../..........</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-40 mx-auto mb-2 h-10" />
                  <p className="font-bold text-slate-900">หัวหน้าแผนก / ผู้ตรวจสอบ (Verified by)</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">(................................................)</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">วันที่: ...../...../..........</p>
                </div>
              </div>

            </div>

            {/* Modal Footer Controls (Non-printable) */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between no-print">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                onClick={() => printElementById("printable-inventory-sheet", "ใบสรุปรายการพัสดุและยอดสต็อกคงคลัง", printOrientation)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <Printer className="h-4 w-4" />
                <span>สั่งพิมพ์กระดาษ A4 เดี๋ยวนี้ (Print Clean A4)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. MULTI-CABINET STOCK RESULT MODAL (ดูผลลัพธ์สต็อกข้ามตู้ เช่น CMT และ QA/QC) */}
      {selectedMultiStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-indigo-200 shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider block">
                      ตรวจสอบสต็อกข้ามตู้ (Cross-Cabinet Stock)
                    </span>
                    <span className="px-1.5 py-0.2 bg-white/20 text-white rounded text-[9px] font-bold uppercase">
                      แผนก {selectedMultiStock.department}
                    </span>
                  </div>
                  <h3 className="font-black text-sm sm:text-base leading-tight truncate mt-0.5">
                    {selectedMultiStock.displayName}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMultiStock(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors shrink-0 ml-2"
                title="ปิดหน้าต่าง"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Total Stock Banner */}
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-indigo-900 block">
                  ยอดรวมสต็อกของแผนก {selectedMultiStock.department}
                </span>
                <span className="text-[11px] text-indigo-600">
                  พบใน {selectedMultiStock.cabinetLocations.length} ตู้จัดเก็บของแผนกนี้ ({selectedMultiStock.breakdownText})
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-indigo-950 font-mono">
                  {selectedMultiStock.totalQtyAcrossCabinets}
                </span>
                <span className="text-xs font-bold text-indigo-700 ml-1">
                  {selectedMultiStock.unit}
                </span>
              </div>
            </div>

            {/* Cabinet Breakdown List */}
            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-[50vh]">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                รายละเอียดสต็อกแยกตามตู้จัดเก็บในแผนก {selectedMultiStock.department}:
              </div>
              {selectedMultiStock.cabinetLocations.map((loc, idx) => (
                <div 
                  key={loc.consumableId} 
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-600 flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                            {loc.cabinetName}
                          </h4>
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[9px] font-bold uppercase">
                            {loc.department}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span>ตู้ ID: {loc.cabinetId.slice(-6)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="shrink-0">
                      {loc.isOutOfStock ? (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-[10px]">
                          หมดสต็อก (0)
                        </span>
                      ) : loc.isLowStock ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold text-[10px]">
                          ใกล้หมด
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold text-[10px]">
                          สต็อกปกติ
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">มีในตู้นี้</span>
                      <span className="font-black text-slate-900 text-sm">{loc.currentQty} {loc.unit}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">เกณฑ์ Min</span>
                      <span className="font-bold text-slate-700 text-sm">{loc.minThreshold} {loc.unit}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">เกณฑ์ Max</span>
                      <span className="font-bold text-slate-700 text-sm">
                        {loc.maxThreshold ? `${loc.maxThreshold} ${loc.unit}` : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Tip / Guidance Note */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-amber-900 text-xs flex items-start gap-2 leading-relaxed">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">การรวมสต็อกอิงตามแผนก:</span>
                  <span>
                    ระบบจะรวบรวมสต็อกของพัสดุชื่อเดียวกันที่อยู่<b>เฉพาะภายในแผนก {selectedMultiStock.department}</b> เท่านั้น (เช่น มีในหลายตู้ของแผนก) โดยไม่นำพัสดุชื่อเดียวกันของแผนกอื่นมารวม เพื่อให้การนับสต็อกและการบริหารจัดการของแต่ละแผนกแยกออกจากกันอย่างถูกต้อง
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMultiStock(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-xs"
              >
                เข้าใจแล้ว / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. EXPORT EXCEL MODAL DIALOG */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-xs">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-200" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                    ส่งออกข้อมูลพัสดุเป็นไฟล์ Excel
                  </h3>
                  <p className="text-[11px] text-emerald-200/90 mt-0.5">
                    ดาวน์โหลด .CSV รองรับ Microsoft Excel ภาษาไทย 100% หรือคัดลอกลงตาราง
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Option 1: Select Export Scope */}
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  1. เลือกขอบเขตข้อมูลที่ต้องการส่งออก
                </label>
                <div className="space-y-2">
                  {/* Current Filter */}
                  <label 
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      exportScope === "CURRENT_FILTER"
                        ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-2xs"
                        : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      checked={exportScope === "CURRENT_FILTER"}
                      onChange={() => setExportScope("CURRENT_FILTER")}
                      className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          รายการตามตัวกรองปัจจุบันที่แสดงอยู่
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[11px] rounded-full">
                          {filteredConsumables.length} รายการ
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        ส่งออกเฉพาะพัสดุที่ตรงกับแผนก ({selectedDept === "ALL" ? "รวมทุกแผนก" : selectedDept})
                        {statusFilter !== "ALL" && `, สถานะ: ${statusFilter}`}
                        {searchTerm && `, ค้นหา: "${searchTerm}"`}
                      </p>
                    </div>
                  </label>

                  {/* Current Department */}
                  <label 
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      exportScope === "CURRENT_DEPT"
                        ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-2xs"
                        : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      checked={exportScope === "CURRENT_DEPT"}
                      onChange={() => setExportScope("CURRENT_DEPT")}
                      className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          ทุกรายการของแผนก {selectedDept === "ALL" ? "รวมทุกแผนก" : selectedDept}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-extrabold text-[11px] rounded-full">
                          {currentDeptItems.length} รายการ
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        ไม่จำกัดคำค้นหาหรือตัวกรองสถานะ ดึงครบทุกรายการในแผนกนี้
                      </p>
                    </div>
                  </label>

                  {/* All Items in System */}
                  <label 
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      exportScope === "ALL_ITEMS"
                        ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-2xs"
                        : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      checked={exportScope === "ALL_ITEMS"}
                      onChange={() => setExportScope("ALL_ITEMS")}
                      className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          รายการพัสดุทั้งหมดทุกแผนกในระบบ (ทั้งคลัง)
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-extrabold text-[11px] rounded-full">
                          {consumables.length} รายการ
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        รวบรวมสต็อกของทุกแผนก ทุกตู้จัดเก็บ รวมทั้งหมดที่มีในฐานข้อมูล
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Option 2: Column Customizations */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  2. ตัวเลือกคอลัมน์เพิ่มเติม
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl cursor-pointer text-xs transition-colors">
                    <input
                      type="checkbox"
                      checked={exportIncludeImages}
                      onChange={(e) => setExportIncludeImages(e.target.checked)}
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span className="font-medium text-slate-700">
                      รวมคอลัมน์ลิงก์รูปถ่ายพัสดุ (Image URL)
                    </span>
                  </label>
                </div>
              </div>

              {/* File details & Thai font note */}
              <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/80 text-emerald-950 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>รองรับภาษาไทยสำหรับ Microsoft Excel สมบูรณ์ (UTF-8 with BOM)</span>
                </div>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed pl-5.5">
                  เมื่อดาวน์โหลดแล้ว ดับเบิ้ลคลิกเปิดด้วยโปรแกรม <b>Microsoft Excel</b> หรือ <b>Google Sheets</b> ได้ทันทีโดยไม่ต้องตั้งค่าฟอนต์ภาษาไทยใหม่ ข้อมูลจะแยกเป็นคอลัมน์พร้อมใช้งาน
                </p>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer text-center"
              >
                ยกเลิก
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Copy to clipboard */}
                <button
                  type="button"
                  onClick={handleCopyExcelToClipboard}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="คัดลอกตารางไป Paste (Ctrl+V) ลงใน Excel หรือ Google Sheets ที่เปิดค้างไว้ได้ทันที"
                >
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>คัดลอกลงคลิปบอร์ด</span>
                </button>

                {/* Download Excel file */}
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>ดาวน์โหลดไฟล์ Excel ({getExportItems().length} รายการ)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 6. CABINET ACTION PROMPT MODAL (เมื่อเลือก แก้ไข หรือ ลบ พัสดุที่รวมสต็อกมาจากหลายตู้) */}
      {cabinetActionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className={`p-4 text-white flex items-center justify-between ${
              cabinetActionPrompt.mode === "delete"
                ? "bg-rose-700"
                : "bg-indigo-700"
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center text-white shrink-0">
                  {cabinetActionPrompt.mode === "delete" ? (
                    <Trash2 className="h-4 w-4" />
                  ) : (
                    <Edit className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">
                    {cabinetActionPrompt.mode === "delete" ? "เลือกตู้ที่ต้องการลบพัสดุ" : "เลือกตู้ที่ต้องการแก้ไขพัสดุ"}
                  </h3>
                  <p className="text-[11px] text-white/80 mt-0.5">
                    พัสดุ "{cabinetActionPrompt.itemName}" มีจัดเก็บใน {cabinetActionPrompt.items.length} ตู้
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCabinetActionPrompt(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List of Cabinets */}
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-slate-500 mb-2">
                เนื่องจากพัสดุนี้ถูกรวมมาจากหลายตู้จัดเก็บ โปรดเลือกตู้จัดเก็บรายการที่ท่านต้องการดำเนินการ:
              </p>
              {cabinetActionPrompt.items.map(subItem => (
                <div
                  key={subItem.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-xs text-slate-900 truncate">
                        {getCabinetName(subItem.cabinetId)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-semibold">
                        {subItem.department}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      คงเหลือในตู้นี้: <b className="text-slate-800">{subItem.currentQty} {subItem.unit}</b>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const mode = cabinetActionPrompt.mode;
                      const target = subItem;
                      setCabinetActionPrompt(null);
                      if (mode === "edit") {
                        onEditConsumable(target);
                      } else {
                        onDeleteConsumable(target.id);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors text-white ${
                      cabinetActionPrompt.mode === "delete"
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {cabinetActionPrompt.mode === "delete" ? "ลบออกจากตู้นี้" : "แก้ไขตู้นี้"}
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setCabinetActionPrompt(null)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
