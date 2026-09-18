import React, { useState, useMemo } from "react";
import { DepartmentRecord, Cabinet, Consumable } from "../types";
import { printElementById } from "../lib/printHelper";
import { 
  isItemLowStock, 
  isItemOutOfStock, 
  getMultiCabinetStockInfo, 
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
  Sparkles
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

  // Multi-Cabinet Stock Detail Modal State
  const [selectedMultiStock, setSelectedMultiStock] = useState<MultiCabinetStockInfo | null>(null);

  // Print Inventory Sheet Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printStatusFilter, setPrintStatusFilter] = useState<"ALL" | "NEED_REFILL" | "OUT" | "OK">("ALL");
  const [printIncludeImages, setPrintIncludeImages] = useState(false);
  const [printIncludeChecklistColumn, setPrintIncludeChecklistColumn] = useState(true);
  const [printOrientation, setPrintOrientation] = useState<"portrait" | "landscape">("portrait");

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

  // Filter consumables based on selected department, search, and status
  const filteredConsumables = useMemo(() => {
    return consumables.filter(item => {
      // 1. Department match
      if (selectedDept !== "ALL" && item.department?.toLowerCase() !== selectedDept.toLowerCase()) {
        return false;
      }

      // 2. Search match
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesDept = item.department?.toLowerCase().includes(query);
        const matchesCab = getCabinetName(item.cabinetId).toLowerCase().includes(query);
        if (!matchesName && !matchesDept && !matchesCab) return false;
      }

      // 3. Status match
      if (statusFilter === "OUT") {
        return isItemOutOfStock(item);
      }
      if (statusFilter === "LOW") {
        return isItemLowStock(item) && !isItemOutOfStock(item);
      }
      if (statusFilter === "OK") {
        return !isItemLowStock(item);
      }

      // 4. Multi-cabinet filter
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
  }, [consumables, selectedDept, searchTerm, statusFilter, onlyMultiCabinet, sortBy, getCabinetName]);

  // Counts for status chips
  const currentDeptItems = useMemo(() => {
    if (selectedDept === "ALL") return consumables;
    return consumables.filter(c => c.department?.toLowerCase() === selectedDept.toLowerCase());
  }, [consumables, selectedDept]);

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
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5">
          {/* Card: รวมทุกแผนก */}
          {(() => {
            const isSelected = selectedDept === "ALL";
            const stats = deptStats["ALL"] || { totalItems: 0, totalQty: 0, lowStockCount: 0, outOfStockCount: 0 };
            const hasShortage = (stats.lowStockCount + stats.outOfStockCount) > 0;
            return (
              <button
                key="ALL"
                onClick={() => setSelectedDept("ALL")}
                className={`text-left p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? "bg-emerald-50/70 border-2 border-emerald-700 shadow-md ring-2 ring-emerald-700/20"
                    : "bg-white border-2 border-slate-100 hover:border-slate-300 shadow-2xs hover:shadow-xs"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-700 rounded-bl-lg" />
                )}
                <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-600"
                  }`}>
                    <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-black text-xs sm:text-sm truncate ${isSelected ? "text-emerald-950" : "text-slate-900"}`}>
                      รวมทุกแผนก
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
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
                className={`text-left p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? "bg-emerald-50/70 border-2 border-emerald-700 shadow-md ring-2 ring-emerald-700/20"
                    : "bg-white border-2 border-slate-100 hover:border-slate-300 shadow-2xs hover:shadow-xs"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-700 rounded-bl-lg" />
                )}
                <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div 
                    className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-black text-xs sm:text-sm truncate uppercase ${isSelected ? "text-emerald-950" : "text-slate-900"}`}>
                      {dept}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
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
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-900 font-extrabold text-sm sm:text-lg">
              รายการพัสดุ:
            </span>
            <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-slate-100 text-slate-800 font-black text-xs sm:text-sm rounded-lg border border-slate-200 uppercase">
              {selectedDept === "ALL" ? "รวมทุกแผนก" : selectedDept}
            </span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-200">
              มาตรฐาน {totalInCurrentDept} รายการ
            </span>
          </div>

          <div className="flex items-center gap-2">
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
              placeholder="ค้นหาชื่อยา/พัสดุ..."
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

      {/* 3. CONSUMABLES VIEW: MOBILE CARDS (NO HORIZONTAL OVERFLOW) & DESKTOP TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
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
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            #{index + 1}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded uppercase">
                            {item.department}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug break-words mt-0.5">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>ตู้: {getCabinetName(item.cabinetId)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Edit / Delete Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onEditConsumable(item)}
                        className="p-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                        title="แก้ไขข้อมูลพัสดุ"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteConsumable(item.id)}
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
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 w-14 text-center">ลำดับ</th>
                <th className="py-3.5 px-5">ชื่อยา / รายการเวชภัณฑ์ & พัสดุ</th>
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
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {item.id.slice(-6)}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded uppercase">
                                {item.department}
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
                            <span className="text-[10px] text-slate-400 block truncate">
                              สังกัด: {item.department}
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
                            onClick={() => onEditConsumable(item)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                            title="แก้ไขข้อมูลพัสดุ"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteConsumable(item.id)}
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
                        ระบบบริหารจัดการตู้เก็บพัสดุและเวชภัณฑ์โรงงาน
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
                    <th className="p-2 border border-slate-300">รายการพัสดุ / เวชภัณฑ์</th>
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
                  <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider block">
                    ตรวจสอบสต็อกข้ามตู้ (Cross-Cabinet Stock Result)
                  </span>
                  <h3 className="font-black text-sm sm:text-base leading-tight truncate">
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
                <span className="text-[11px] font-bold text-indigo-900 block">ยอดรวมสต็อกที่มีทั้งหมดในโรงงาน</span>
                <span className="text-[11px] text-indigo-600">
                  พบใน {selectedMultiStock.cabinetLocations.length} ตู้จัดเก็บ ({selectedMultiStock.breakdownText})
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
                รายละเอียดสต็อกแยกตามตู้จัดเก็บ:
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
                  <span className="font-bold block mb-0.5">คำแนะนำการเก็บพัสดุข้ามตู้:</span>
                  <span>
                    เมื่อพัสดุชื่อเดียวกันถูกจัดเก็บแยกไว้ในหลายตู้ (เช่น ตู้ CMT และ ตู้ QA/QC) ระบบจะรวบรวมยอดสต็อกคงเหลือจริงของทุกตู้มาแสดงคู่กันเสมอ เพื่อให้ตรวจสอบจำนวนทั้งสองตู้ได้ในที่เดียว และป้องกันการสั่งซื้อซ้ำซ้อน
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
    </div>
  );
}
