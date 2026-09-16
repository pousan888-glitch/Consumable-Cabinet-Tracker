import React, { useState, useMemo } from "react";
import { DepartmentRecord, Cabinet, Consumable } from "../types";
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
  Filter
} from "lucide-react";

interface DepartmentConsumablesViewProps {
  departments: DepartmentRecord[];
  cabinets: Cabinet[];
  consumables: Consumable[];
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
  const [sortBy, setSortBy] = useState<"DEFAULT" | "QTY_ASC" | "NAME">("DEFAULT");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
      lowStockCount: consumables.filter(c => c.currentQty <= c.minThreshold && c.currentQty > 0).length,
      outOfStockCount: consumables.filter(c => c.currentQty === 0).length
    };

    allDeptNames.forEach(dept => {
      const itemsInDept = consumables.filter(c => c.department?.toLowerCase() === dept.toLowerCase());
      stats[dept] = {
        totalItems: itemsInDept.length,
        totalQty: itemsInDept.reduce((acc, cur) => acc + (cur.currentQty || 0), 0),
        lowStockCount: itemsInDept.filter(c => c.currentQty <= c.minThreshold && c.currentQty > 0).length,
        outOfStockCount: itemsInDept.filter(c => c.currentQty === 0).length
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
        return item.currentQty === 0;
      }
      if (statusFilter === "LOW") {
        return item.currentQty > 0 && item.currentQty <= item.minThreshold;
      }
      if (statusFilter === "OK") {
        return item.currentQty > item.minThreshold;
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
  }, [consumables, selectedDept, searchTerm, statusFilter, sortBy, getCabinetName]);

  // Counts for status chips
  const currentDeptItems = useMemo(() => {
    if (selectedDept === "ALL") return consumables;
    return consumables.filter(c => c.department?.toLowerCase() === selectedDept.toLowerCase());
  }, [consumables, selectedDept]);

  const totalInCurrentDept = currentDeptItems.length;
  const outInCurrentDept = currentDeptItems.filter(c => c.currentQty === 0).length;
  const lowInCurrentDept = currentDeptItems.filter(c => c.currentQty > 0 && c.currentQty <= c.minThreshold).length;
  const okInCurrentDept = currentDeptItems.filter(c => c.currentQty > c.minThreshold).length;

  const handleStepQty = async (item: Consumable, delta: number) => {
    const nextQty = Math.max(0, (item.currentQty || 0) + delta);
    setUpdatingId(item.id);
    try {
      await onUpdateQty(item, nextQty);
    } finally {
      setTimeout(() => setUpdatingId(null), 300);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setSortBy("DEFAULT");
    onToast("รีเซ็ตตัวกรองการค้นหาเรียบร้อย");
  };

  const handlePrintList = () => {
    window.print();
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
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {/* Card: รวมทุกแผนก */}
          {(() => {
            const isSelected = selectedDept === "ALL";
            const stats = deptStats["ALL"] || { totalItems: 0, totalQty: 0, lowStockCount: 0, outOfStockCount: 0 };
            const hasShortage = (stats.lowStockCount + stats.outOfStockCount) > 0;
            return (
              <button
                key="ALL"
                onClick={() => setSelectedDept("ALL")}
                className={`text-left p-4 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? "bg-emerald-50/70 border-2 border-emerald-700 shadow-md ring-2 ring-emerald-700/20"
                    : "bg-white border-2 border-slate-100 hover:border-slate-300 shadow-xs hover:shadow-sm"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-700 rounded-bl-lg" />
                )}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-600"
                  }`}>
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-black text-sm truncate ${isSelected ? "text-emerald-950" : "text-slate-900"}`}>
                      รวมทุกแผนก
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      ภาพรวมทั้งบริษัท ({cabinets.length} ตู้)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/80 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">คงเหลือ</span>
                    <span className="font-extrabold text-slate-900">{stats.totalQty} ชิ้น</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">ต้องเติม</span>
                    {hasShortage ? (
                      <span className="font-extrabold text-rose-600">
                        ขาด {stats.lowStockCount + stats.outOfStockCount} ตัว
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-600">ครบตามเกณฑ์</span>
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
                className={`text-left p-4 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? "bg-emerald-50/70 border-2 border-emerald-700 shadow-md ring-2 ring-emerald-700/20"
                    : "bg-white border-2 border-slate-100 hover:border-slate-300 shadow-xs hover:shadow-sm"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-700 rounded-bl-lg" />
                )}
                <div className="flex items-start gap-3 mb-3">
                  <div 
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-black text-sm truncate uppercase ${isSelected ? "text-emerald-950" : "text-slate-900"}`}>
                      {dept}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {deptRecord?.description || `แผนก ${dept}`} ({stats.totalItems} รายการ)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/80 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">คงเหลือ</span>
                    <span className="font-extrabold text-slate-900">{stats.totalQty} ชิ้น</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">สถานะ</span>
                    {hasShortage ? (
                      <span className="font-extrabold text-rose-600">
                        ขาด {stats.lowStockCount + stats.outOfStockCount} ตัว
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-600">ครบตามเกณฑ์</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SUBHEADER & FILTER CONTROLS (คล้ายแถบควบคุมในรูปแรก) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-slate-900 font-extrabold text-base sm:text-lg">
              รายการพัสดุ:
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-800 font-black text-xs sm:text-sm rounded-lg border border-slate-200 uppercase">
              {selectedDept === "ALL" ? "รวมทุกแผนก" : selectedDept}
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-200">
              มาตรฐาน {totalInCurrentDept} รายการ
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-2xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>รีเซ็ต</span>
            </button>
            <button
              onClick={handlePrintList}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs rounded-xl border border-sky-200 cursor-pointer transition-colors shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5 text-sky-600" />
              <span>พิมพ์รายการ</span>
            </button>
          </div>
        </div>

        {/* Search, Status Filters, and Sorter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อยา/พัสดุ เช่น ดักเทป, ซิลิโคน, ถุงมือ..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
            />
          </div>

          {/* Status Tabs (คล้ายแถบในรูปแรก) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              ทั้งหมด ({totalInCurrentDept})
            </button>
            <button
              onClick={() => setStatusFilter("OUT")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "OUT"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-700"
              }`}
            >
              หมดสต็อก ({outInCurrentDept})
            </button>
            <button
              onClick={() => setStatusFilter("LOW")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "LOW"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-700"
              }`}
            >
              ใกล้หมด ({lowInCurrentDept})
            </button>
            <button
              onClick={() => setStatusFilter("OK")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "OK"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
              }`}
            >
              สต็อกปกติ ({okInCurrentDept})
            </button>

            {/* Sorter */}
            <div className="relative ml-auto">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <option value="DEFAULT">เรียงตามลำดับมาตรฐาน</option>
                <option value="QTY_ASC">เรียงตามคงเหลือ (น้อย → มาก)</option>
                <option value="NAME">เรียงตามชื่อพัสดุ (ก-ฮ)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONSUMABLES TABLE (ตารางพัสดุคอนซูม คล้ายรูปแรก) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
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
                  const isOutOfStock = item.currentQty === 0;
                  const isLow = item.currentQty > 0 && item.currentQty <= item.minThreshold;
                  const isUpdating = updatingId === item.id;

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
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Safety Standard Target (คล้ายรูปแรก) */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs">
                          {item.minThreshold} {item.unit}
                        </div>
                      </td>

                      {/* Current Real Quantity with Stepper [-] [number] [+] */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
                          <button
                            onClick={() => handleStepQty(item, -1)}
                            disabled={item.currentQty <= 0 || isUpdating}
                            className="h-7 w-7 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                            title="ลดจำนวน (-1)"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          
                          <input
                            type="number"
                            min="0"
                            value={item.currentQty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                onUpdateQty(item, Math.max(0, val));
                              }
                            }}
                            className={`w-12 text-center text-xs sm:text-sm font-black bg-transparent outline-none ${
                              isOutOfStock 
                                ? "text-rose-600 font-black" 
                                : isLow 
                                ? "text-amber-600 font-black" 
                                : "text-slate-900"
                            }`}
                          />

                          <button
                            onClick={() => handleStepQty(item, 1)}
                            disabled={isUpdating}
                            className="h-7 w-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                            title="เพิ่มจำนวน (+1)"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-4 px-3 text-center font-bold text-slate-600 text-xs">
                        {item.unit}
                      </td>

                      {/* Cabinet Name */}
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-700 block truncate max-w-[150px]" title={getCabinetName(item.cabinetId)}>
                          {getCabinetName(item.cabinetId)}
                        </span>
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
    </div>
  );
}
