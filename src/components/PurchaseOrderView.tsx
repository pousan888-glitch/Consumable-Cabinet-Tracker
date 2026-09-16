import React, { useState, useMemo } from "react";
import { DepartmentRecord, Cabinet, Consumable } from "../types";
import { 
  ShoppingCart, 
  Building2, 
  Printer, 
  FileSpreadsheet, 
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Plus, 
  Minus, 
  Check, 
  Filter, 
  Layers, 
  Share2, 
  Eye, 
  RotateCcw,
  Sparkles,
  X
} from "lucide-react";

interface PurchaseOrderViewProps {
  departments: DepartmentRecord[];
  cabinets: Cabinet[];
  consumables: Consumable[];
  onUpdateQty: (item: Consumable, newQty: number) => Promise<void>;
  getCabinetName: (id: string) => string;
  onToast: (msg: string) => void;
  currentUserEmail: string;
}

export default function PurchaseOrderView({
  departments,
  cabinets,
  consumables,
  onUpdateQty,
  getCabinetName,
  onToast,
  currentUserEmail
}: PurchaseOrderViewProps) {
  // Department filter for purchasing (แยกแผนกกัน)
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [onlyBelowThreshold, setOnlyBelowThreshold] = useState<boolean>(true);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Custom order quantities overrides per item ID: { [consumableId]: number }
  const [customOrderQtys, setCustomOrderQtys] = useState<Record<string, number>>({});

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

  // Default calculation for refill quantity:
  // If item has maxThreshold: maxThreshold - currentQty
  // Otherwise: (minThreshold * 2) - currentQty, minimum 1
  const getDefaultOrderQty = (item: Consumable): number => {
    if (customOrderQtys[item.id] !== undefined) {
      return customOrderQtys[item.id];
    }
    const target = item.maxThreshold && item.maxThreshold > item.minThreshold 
      ? item.maxThreshold 
      : Math.max(item.minThreshold * 2, 10);
    const deficit = target - item.currentQty;
    return Math.max(1, deficit);
  };

  const handleAdjustOrderQty = (item: Consumable, delta: number) => {
    const current = getDefaultOrderQty(item);
    const next = Math.max(1, current + delta);
    setCustomOrderQtys(prev => ({
      ...prev,
      [item.id]: next
    }));
  };

  const handleSetOrderQty = (item: Consumable, val: number) => {
    const next = Math.max(1, val || 1);
    setCustomOrderQtys(prev => ({
      ...prev,
      [item.id]: next
    }));
  };

  // Filter items for the Purchase Order
  const poItems = useMemo(() => {
    return consumables.filter(item => {
      // 1. Department Filter
      if (selectedDept !== "ALL" && item.department?.toLowerCase() !== selectedDept.toLowerCase()) {
        return false;
      }

      // 2. Only items below safety threshold (or out of stock)
      if (onlyBelowThreshold) {
        if (item.currentQty > item.minThreshold) {
          return false;
        }
      }

      // 3. Search Filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDept = item.department?.toLowerCase().includes(q);
        const matchesCab = getCabinetName(item.cabinetId).toLowerCase().includes(q);
        if (!matchesName && !matchesDept && !matchesCab) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort: Out of stock first, then lowest stock percentage
      if (a.currentQty === 0 && b.currentQty > 0) return -1;
      if (b.currentQty === 0 && a.currentQty > 0) return 1;
      return a.currentQty - b.currentQty;
    });
  }, [consumables, selectedDept, onlyBelowThreshold, searchTerm, getCabinetName]);

  // Aggregate Metrics (คล้ายรูปที่ 3)
  const totalItemsToOrder = poItems.length;
  const totalPiecesToOrder = poItems.reduce((acc, item) => acc + getDefaultOrderQty(item), 0);
  const outOfStockCount = poItems.filter(item => item.currentQty === 0).length;

  // 1. Action: Copy formatted order for LINE
  const handleCopyForLine = () => {
    const deptTitle = selectedDept === "ALL" ? "รวมทุกแผนกในบริษัท" : `แผนก ${selectedDept.toUpperCase()}`;
    const today = new Date().toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    let msg = `🛒 [ใบสั่งซื้อพัสดุเพิ่มทันที - ${deptTitle}]\n`;
    msg += `📅 วันที่สั่งซื้อ: ${today}\n`;
    msg += `👤 ผู้ทำรายการ: แอดมิน (${currentUserEmail})\n`;
    msg += `--------------------------------------\n`;

    if (poItems.length === 0) {
      msg += `ไม่มีรายการพัสดุที่ขาดในขณะนี้ (สต็อกครบตามเกณฑ์)\n`;
    } else {
      poItems.forEach((item, index) => {
        const orderQty = getDefaultOrderQty(item);
        const cab = getCabinetName(item.cabinetId);
        const status = item.currentQty === 0 ? "⚠️ หมดสต็อก" : "⚡ ต่ำกว่าเกณฑ์";
        msg += `${index + 1}. ${item.name} (${item.department})\n`;
        msg += `   • สั่งซื้อ: ${orderQty} ${item.unit}\n`;
        msg += `   • สต็อกปัจจุบัน: ${item.currentQty} / เกณฑ์ ${item.minThreshold} ${item.unit} [${status}]\n`;
        msg += `   • ตำแหน่งจัดเก็บ: ${cab}\n\n`;
      });
      msg += `--------------------------------------\n`;
      msg += `📊 รวมรายการสั่งซื้อทั้งหมด: ${totalItemsToOrder} รายการ\n`;
      msg += `📦 จำนวนชิ้นสั่งรวมสุทธิ: ${totalPiecesToOrder} ชิ้น/หน่วย`;
    }

    navigator.clipboard.writeText(msg).then(() => {
      onToast("คัดลอกข้อความใบสั่งซื้อสำหรับส่ง LINE เรียบร้อยแล้ว!");
    }).catch(() => {
      onToast("ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาลองใหม่อีกครั้ง");
    });
  };

  // 2. Action: Export Excel (CSV with UTF-8 BOM for Thai Excel)
  const handleExportExcel = () => {
    const deptTitle = selectedDept === "ALL" ? "ALL-DEPARTMENTS" : selectedDept.toUpperCase();
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `Purchase_Order_${deptTitle}_${dateStr}.csv`;

    const headers = [
      "ลำดับ",
      "รหัสพัสดุ",
      "ชื่อรายการวัสดุสิ้นเปลือง",
      "แผนก",
      "ตู้จัดเก็บ",
      "สต็อกคงเหลือจริง",
      "เกณฑ์ขั้นต่ำ (Min)",
      "เกณฑ์เป้าหมาย (Max)",
      "จำนวนที่ต้องสั่งซื้อ",
      "หน่วยนับ",
      "สถานะความเร่งด่วน"
    ];

    const rows = poItems.map((item, index) => {
      const orderQty = getDefaultOrderQty(item);
      const cab = getCabinetName(item.cabinetId);
      const status = item.currentQty === 0 ? "วิกฤต (หมดสต็อก)" : item.currentQty <= item.minThreshold ? "ต่ำกว่าเกณฑ์" : "สั่งซื้อสำรอง";

      return [
        index + 1,
        `"${item.id}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.department}"`,
        `"${cab.replace(/"/g, '""')}"`,
        item.currentQty,
        item.minThreshold,
        item.maxThreshold || "-",
        orderQty,
        `"${item.unit}"`,
        `"${status}"`
      ].join(",");
    });

    // Add UTF-8 BOM (\uFEFF) so Microsoft Excel opens Thai fonts correctly
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onToast(`ส่งออกไฟล์ Excel (${filename}) สำเร็จเรียบร้อย!`);
  };

  // 3. Action: Trigger Print
  const handlePrint = () => {
    setShowPrintModal(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & DEPARTMENT SELECTOR (คล้ายรูปที่ 3) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          {/* Header Title */}
          <div className="flex items-start gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-black text-slate-900 leading-tight">
                  ใบสั่งซื้อพัสดุเพิ่มทันที (Auto Stock Refill)
                </h2>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-bold text-[10px] rounded-md uppercase">
                  PO Management
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                แผงคัดสรรใบสั่งพัสดุขาดโดยคำนวณตามเกณฑ์ความปลอดภัย เพื่ออำนวยความสะดวกในการจัดซื้อและสั่งแยกตามแผนกได้ทันที
              </p>
            </div>
          </div>

          {/* DEPARTMENT PILLS FILTER (แยกแผนกกัน - วงกลมเขียวบนรูป 3) */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setSelectedDept("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDept === "ALL"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              รวมทุกแผนก ({cabinets.length} ตู้)
            </button>

            {allDeptNames.map(dept => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer uppercase ${
                  selectedDept.toLowerCase() === dept.toLowerCase()
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {/* 2. THREE SUMMARY KPI CARDS (คล้ายรูปที่ 3) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          {/* Card 1: จำนวนรายการพัสดุที่ต้องสั่งซื้อ */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                จำนวนตัวยา/พัสดุที่ต้องสั่งซื้อ
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {totalItemsToOrder}
                </span>
                <span className="text-xs font-bold text-slate-600">รายการ</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                จากรายการตรวจนับทั้งหมด {consumables.length} ชนิด
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </div>

          {/* Card 2: จำนวนชิ้นที่ต้องสั่งรวม */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                จำนวนชิ้นที่ต้องสั่งรวม
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-emerald-800">
                  {totalPiecesToOrder}
                </span>
                <span className="text-xs font-bold text-slate-600">ชิ้น/กล่อง/ม้วน</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                รวมยอดสั่งซื้อสุทธิเพื่อให้ครบปริมาณมาตรฐาน
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>

          {/* Card 3: ปริมาณหมดสต็อกคัดออก / แผนกเป้าหมาย */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                พัสดุหมดสต็อก (วิกฤต 0 ชิ้น)
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={`text-2xl sm:text-3xl font-black ${
                  outOfStockCount > 0 ? "text-rose-600" : "text-slate-900"
                }`}>
                  {outOfStockCount}
                </span>
                <span className="text-xs font-bold text-slate-600">รายการ</span>
              </div>
              <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">
                {outOfStockCount > 0 ? "ของหมดจากตู้แล้ว ต้องเร่งสั่งซื้อด่วน" : "ไม่มีพัสดุหมดเกลี้ยงสต็อก"}
              </span>
            </div>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              outOfStockCount > 0 ? "bg-rose-50 text-rose-600 animate-pulse" : "bg-slate-100 text-slate-500"
            }`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. TOOLBAR & EXPORT CONTROLS (วงกลมเขียวล่างในรูปที่ 3) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Target badge & toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>
              ตู้/แผนกเป้าหมาย:{" "}
              <b className="text-emerald-950 uppercase">
                {selectedDept === "ALL" ? `รวมยอดทุกตู้ในบริษัท (${cabinets.length} ตู้)` : `แผนก ${selectedDept}`}
              </b>
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 select-none">
            <input
              type="checkbox"
              checked={onlyBelowThreshold}
              onChange={(e) => setOnlyBelowThreshold(e.target.checked)}
              className="rounded text-emerald-700 focus:ring-emerald-700 h-4 w-4 cursor-pointer"
            />
            <span>แสดงเฉพาะรายการที่ต้องสั่ง (สต็อกต่ำกว่าเกณฑ์)</span>
          </label>
        </div>

        {/* Right: Print / Excel / Line Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Orientation Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setOrientation("portrait")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                orientation === "portrait" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
              }`}
            >
              แนวตั้ง
            </button>
            <button
              onClick={() => setOrientation("landscape")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                orientation === "landscape" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
              }`}
            >
              แนวนอน
            </button>
          </div>

          {/* Action 1: Print PO */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>พิมพ์ใบสั่งซื้อ ({orientation === "portrait" ? "แนวตั้ง" : "แนวนอน"})</span>
          </button>

          {/* Action 2: Export Excel */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>ส่งออกไฟล์ Excel</span>
          </button>

          {/* Action 3: Copy for LINE */}
          <button
            onClick={handleCopyForLine}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs cursor-pointer transition-all active:scale-95"
          >
            <Copy className="h-3.5 w-3.5 text-slate-600" />
            <span>คัดลอกส่งต่อ (LINE)</span>
          </button>
        </div>
      </div>

      {/* 4. PURCHASE ORDER TABLE (คล้ายรูปที่ 3) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 w-12 text-center">ลำดับ</th>
                <th className="py-3.5 px-5">รายการพัสดุที่ขาด (CONSUMABLE ITEM)</th>
                <th className="py-3.5 px-4">แผนก / ตู้จัดเก็บ</th>
                <th className="py-3.5 px-4 text-center">คงเหลือ / เกณฑ์</th>
                <th className="py-3.5 px-3 text-center">หน่วย</th>
                <th className="py-3.5 px-5 text-center">จำนวนที่ต้องสั่งซื้อ</th>
                <th className="py-3.5 px-4 text-center">ระดับความเร่งด่วน</th>
                <th className="py-3.5 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {poItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-extrabold text-slate-800 text-sm">
                      สต็อกพัสดุครบตามเกณฑ์มาตรฐานความปลอดภัยแล้ว!
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      ไม่มีรายการพัสดุที่ต้องสั่งซื้อเพิ่มในแผนก {selectedDept === "ALL" ? "ทั้งหมด" : selectedDept}
                    </p>
                  </td>
                </tr>
              ) : (
                poItems.map((item, index) => {
                  const orderQty = getDefaultOrderQty(item);
                  const isOutOfStock = item.currentQty === 0;
                  const isBelowThreshold = item.currentQty <= item.minThreshold;

                  return (
                    <tr 
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isOutOfStock ? "bg-rose-50/30" : isBelowThreshold ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Index */}
                      <td className="py-4 px-4 text-center font-bold text-slate-400 text-xs">
                        {index + 1}
                      </td>

                      {/* Item Name & Details */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-10 w-10 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="font-black text-slate-900 text-xs sm:text-sm block leading-tight">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                              ID: {item.id.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department & Cabinet */}
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded uppercase">
                          {item.department}
                        </span>
                        <span className="text-slate-500 font-medium text-[11px] block mt-1 truncate max-w-[140px]">
                          {getCabinetName(item.cabinetId)}
                        </span>
                      </td>

                      {/* Stock vs Min/Max */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`font-black text-xs sm:text-sm ${
                            isOutOfStock ? "text-rose-600 font-black" : isBelowThreshold ? "text-amber-600" : "text-slate-800"
                          }`}>
                            {item.currentQty} / {item.minThreshold}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            (เป้าหมาย Max: {item.maxThreshold || item.minThreshold * 2})
                          </span>
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-4 px-3 text-center font-bold text-slate-600 text-xs">
                        {item.unit}
                      </td>

                      {/* Order Quantity Stepper [-] [number] [+] (คล้ายรูปที่ 3) */}
                      <td className="py-4 px-5 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
                          <button
                            onClick={() => handleAdjustOrderQty(item, -1)}
                            disabled={orderQty <= 1}
                            className="h-7 w-7 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                            title="ลดจำนวนที่สั่ง (-1)"
                          >
                            <Minus className="h-3 w-3" />
                          </button>

                          <input
                            type="number"
                            min="1"
                            value={orderQty}
                            onChange={(e) => handleSetOrderQty(item, parseInt(e.target.value, 10))}
                            className="w-12 text-center text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none"
                          />

                          <button
                            onClick={() => handleAdjustOrderQty(item, 1)}
                            className="h-7 w-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                            title="เพิ่มจำนวนที่สั่ง (+1)"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Urgency Badge */}
                      <td className="py-4 px-4 text-center">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full font-extrabold text-[10px] border border-rose-200 animate-pulse">
                            วิกฤต (0 ชิ้น)
                          </span>
                        ) : isBelowThreshold ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full font-bold text-[10px] border border-amber-200">
                            ต่ำกว่าเกณฑ์
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-100 text-sky-800 rounded-full font-bold text-[10px] border border-sky-200">
                            สั่งสต็อกสำรอง
                          </span>
                        )}
                      </td>

                      {/* Quick Restock Fill Button */}
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={async () => {
                            await onUpdateQty(item, item.currentQty + orderQty);
                            onToast(`เติมสต็อก ${item.name} +${orderQty} ${item.unit} เรียบร้อย!`);
                          }}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                          title="ทำเครื่องหมายว่าของมาส่งแล้ว ปรับยอดคงเหลือทันที"
                        >
                          รับของเข้าตู้
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINT PREVIEW MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-sm sm:text-base">
                  พิมพ์ใบสั่งซื้อ / ใบขอซื้อพัสดุ (Purchase Order Sheet)
                </h3>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Printable Sheet Body */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white text-slate-900 print-section">
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-black text-slate-900">
                      ใบขอซื้อ / ใบสั่งเติมวัสดุสิ้นเปลือง (PURCHASE REQUISITION)
                    </h1>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      ระบบบริหารจัดการวัสดุสิ้นเปลืองโรงงาน (Factory Consumables System)
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold text-slate-800">
                      เลขที่เอกสาร: <span className="font-mono">PO-{new Date().toISOString().slice(0, 10).replace(/-/g, "")}-{selectedDept === "ALL" ? "ALL" : selectedDept.slice(0, 4).toUpperCase()}</span>
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      วันที่: {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block">แผนกผู้ขอสั่งซื้อ:</span>
                    <span className="font-black text-slate-900 text-sm uppercase">
                      {selectedDept === "ALL" ? "รวมทุกแผนกในบริษัท" : selectedDept}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 font-bold block">ผู้ทำรายการขอซื้อ:</span>
                    <span className="font-bold text-slate-800">{currentUserEmail}</span>
                  </div>
                </div>
              </div>

              {/* Printable Table */}
              <table className="w-full text-left border-collapse border border-slate-300 text-xs mb-6">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold text-slate-700">
                    <th className="p-2 border-r border-slate-300 text-center w-10">ลำดับ</th>
                    <th className="p-2 border-r border-slate-300">รายการพัสดุ</th>
                    <th className="p-2 border-r border-slate-300">แผนก</th>
                    <th className="p-2 border-r border-slate-300">ตู้จัดเก็บ</th>
                    <th className="p-2 border-r border-slate-300 text-center">คงเหลือ</th>
                    <th className="p-2 border-r border-slate-300 text-center">เกณฑ์มาตรฐาน</th>
                    <th className="p-2 border-r border-slate-300 text-center font-black">จำนวนที่สั่ง</th>
                    <th className="p-2 text-center">หน่วยนับ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {poItems.map((item, idx) => (
                    <tr key={item.id} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-bold">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{item.name}</td>
                      <td className="p-2 border-r border-slate-200 uppercase">{item.department}</td>
                      <td className="p-2 border-r border-slate-200">{getCabinetName(item.cabinetId)}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-semibold">{item.currentQty}</td>
                      <td className="p-2 border-r border-slate-200 text-center">{item.minThreshold}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-black text-slate-900 bg-slate-50">
                        {getDefaultOrderQty(item)}
                      </td>
                      <td className="p-2 text-center font-semibold">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                    <td colSpan={6} className="p-2 text-right">รวมจำนวนชิ้นสั่งซื้อทั้งหมด:</td>
                    <td className="p-2 text-center text-sm font-black text-slate-900 bg-emerald-50">
                      {totalPiecesToOrder}
                    </td>
                    <td className="p-2 text-center">ชิ้น/หน่วย</td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures Footer */}
              <div className="grid grid-cols-3 gap-6 pt-10 border-t border-slate-200 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 w-36 mx-auto mb-2 h-10" />
                  <p className="font-bold text-slate-800">ผู้ขอสั่งซื้อ (Requester)</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">วันที่: ...../...../..........</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-36 mx-auto mb-2 h-10" />
                  <p className="font-bold text-slate-800">หัวหน้าแผนก / ผู้อนุมัติ</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">วันที่: ...../...../..........</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-36 mx-auto mb-2 h-10" />
                  <p className="font-bold text-slate-800">เจ้าหน้าที่จัดซื้อ (Purchasing)</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">วันที่: ...../...../..........</p>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <Printer className="h-4 w-4" />
                <span>สั่งพิมพ์เดี๋ยวนี้ (Print Now)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
