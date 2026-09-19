import React, { useState, useMemo } from "react";
import { DepartmentRecord, Cabinet, Consumable } from "../types";
import { printElementById } from "../lib/printHelper";
import { 
  getItemTargetStock, 
  getItemOrderDeficit, 
  isItemLowStock, 
  isItemOutOfStock,
  getMultiCabinetStockInfo,
  MultiCabinetStockInfo
} from "../lib/stockUtils";
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
  PackageCheck,
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

export interface GroupedCabinetStock {
  cabinetId: string;
  cabinetName: string;
  currentQty: number;
  minThreshold: number;
  targetStock: number;
  deficit: number;
  consumable: Consumable;
}

export interface GroupedPOItem {
  key: string;
  id: string;
  name: string;
  department: string;
  unit: string;
  imageUrl: string;
  isMultiCabinet: boolean;
  cabinets: GroupedCabinetStock[];
  subItems: Consumable[];
  totalCurrentQty: number;
  totalMinThreshold: number;
  totalTargetStock: number;
  totalDeficit: number;
  isOutOfStock: boolean;
  isBelowThreshold: boolean;
  isNormal: boolean;
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
  // Multi-cabinet consumable grouping (เปิดใช้งานเป็นค่าเริ่มต้นตามที่ผู้ใช้ร้องขอ)
  const [groupMultiCabinet, setGroupMultiCabinet] = useState<boolean>(true);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [selectedMultiStock, setSelectedMultiStock] = useState<MultiCabinetStockInfo | null>(null);

  // Restock distribution modal state for multi-cabinet items
  const [restockModalItem, setRestockModalItem] = useState<GroupedPOItem | null>(null);
  const [restockDistributions, setRestockDistributions] = useState<Record<string, number>>({});

  // Custom order quantities overrides per item Key/ID: { [key]: number }
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
  // target capacity - currentQty (0 if already at or above target)
  const getDefaultOrderQty = (item: GroupedPOItem): number => {
    if (customOrderQtys[item.key] !== undefined) {
      return customOrderQtys[item.key];
    }
    if (customOrderQtys[item.id] !== undefined) {
      return customOrderQtys[item.id];
    }
    return Math.max(0, item.totalDeficit);
  };

  const handleAdjustOrderQty = (item: GroupedPOItem, delta: number) => {
    const current = getDefaultOrderQty(item);
    const next = Math.max(0, current + delta);
    setCustomOrderQtys(prev => ({
      ...prev,
      [item.key]: next
    }));
  };

  const handleSetOrderQty = (item: GroupedPOItem, val: number) => {
    const next = Math.max(0, val || 0);
    setCustomOrderQtys(prev => ({
      ...prev,
      [item.key]: next
    }));
  };

  // Filter items for the Purchase Order with multi-cabinet grouping
  const poItems = useMemo((): GroupedPOItem[] => {
    const filteredRaw = consumables.filter(item => {
      // 1. Department Filter
      if (selectedDept !== "ALL" && item.department?.toLowerCase() !== selectedDept.toLowerCase()) {
        return false;
      }

      // 2. Search Filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDept = item.department?.toLowerCase().includes(q);
        const matchesCab = getCabinetName(item.cabinetId).toLowerCase().includes(q);
        if (!matchesName && !matchesDept && !matchesCab) return false;
      }

      return true;
    });

    if (!groupMultiCabinet) {
      // Flat list (no grouping)
      return filteredRaw
        .filter(item => (onlyBelowThreshold ? isItemLowStock(item) : true))
        .map(item => {
          const targetStock = getItemTargetStock(item);
          const deficit = getItemOrderDeficit(item);
          const isOut = isItemOutOfStock(item);
          const isLow = isItemLowStock(item);
          const cabName = getCabinetName(item.cabinetId);
          return {
            key: item.id,
            id: item.id,
            name: item.name,
            department: item.department || "-",
            unit: item.unit || "ชิ้น",
            imageUrl: item.imageUrl || "",
            isMultiCabinet: false,
            cabinets: [{
              cabinetId: item.cabinetId,
              cabinetName: cabName,
              currentQty: item.currentQty || 0,
              minThreshold: item.minThreshold || 0,
              targetStock,
              deficit,
              consumable: item
            }],
            subItems: [item],
            totalCurrentQty: item.currentQty || 0,
            totalMinThreshold: item.minThreshold || 0,
            totalTargetStock: targetStock,
            totalDeficit: deficit,
            isOutOfStock: isOut,
            isBelowThreshold: isLow,
            isNormal: !isLow && !isOut
          };
        })
        .sort((a, b) => {
          if (a.totalCurrentQty === 0 && b.totalCurrentQty > 0) return -1;
          if (b.totalCurrentQty === 0 && a.totalCurrentQty > 0) return 1;
          return a.totalCurrentQty - b.totalCurrentQty;
        });
    }

    // Grouping by: Department + Normalized Item Name
    const groupMap = new Map<string, Consumable[]>();
    filteredRaw.forEach(item => {
      const deptKey = (item.department || "").trim().toUpperCase();
      const nameKey = (item.name || "").trim().toLowerCase();
      const groupKey = `${deptKey}___${nameKey}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(item);
    });

    const result: GroupedPOItem[] = [];

    groupMap.forEach((items, groupKey) => {
      const firstItem = items[0];
      const imageUrl = items.find(i => i.imageUrl)?.imageUrl || firstItem.imageUrl || "";
      const unit = firstItem.unit || "ชิ้น";
      const department = firstItem.department || "-";
      const name = firstItem.name;

      const cabinetsData: GroupedCabinetStock[] = items.map(item => {
        const targetStock = getItemTargetStock(item);
        const deficit = getItemOrderDeficit(item);
        return {
          cabinetId: item.cabinetId,
          cabinetName: getCabinetName(item.cabinetId),
          currentQty: item.currentQty || 0,
          minThreshold: item.minThreshold || 0,
          targetStock,
          deficit,
          consumable: item
        };
      });

      const totalCurrentQty = cabinetsData.reduce((acc, c) => acc + c.currentQty, 0);
      const totalMinThreshold = cabinetsData.reduce((acc, c) => acc + c.minThreshold, 0);
      const totalTargetStock = cabinetsData.reduce((acc, c) => acc + c.targetStock, 0);
      const totalDeficit = cabinetsData.reduce((acc, c) => acc + c.deficit, 0);

      const isOutOfStock = totalCurrentQty === 0;
      // An item needs reorder if total current is below min OR deficit > 0 OR any sub-cabinet is below threshold
      const hasAnySubItemLow = items.some(i => isItemLowStock(i));
      const isBelowThreshold = totalCurrentQty < totalMinThreshold || hasAnySubItemLow || totalDeficit > 0;

      if (onlyBelowThreshold && !isBelowThreshold) {
        return;
      }

      result.push({
        key: groupKey,
        id: firstItem.id,
        name,
        department,
        unit,
        imageUrl,
        isMultiCabinet: items.length > 1,
        cabinets: cabinetsData,
        subItems: items,
        totalCurrentQty,
        totalMinThreshold,
        totalTargetStock,
        totalDeficit,
        isOutOfStock,
        isBelowThreshold,
        isNormal: !isBelowThreshold && !isOutOfStock
      });
    });

    // Sort: Out of stock first, then lowest total current qty
    return result.sort((a, b) => {
      if (a.isOutOfStock && !b.isOutOfStock) return -1;
      if (!a.isOutOfStock && b.isOutOfStock) return 1;
      return a.totalCurrentQty - b.totalCurrentQty;
    });
  }, [consumables, selectedDept, onlyBelowThreshold, searchTerm, groupMultiCabinet, getCabinetName]);

  // Aggregate Metrics
  const totalItemsToOrder = poItems.length;
  const totalPiecesToOrder = poItems.reduce((acc, item) => acc + getDefaultOrderQty(item), 0);
  const outOfStockCount = poItems.filter(item => item.isOutOfStock).length;

  // Open Multi-Cabinet Restock Distribution Modal
  const handleOpenRestockModal = (item: GroupedPOItem) => {
    const defaultDist: Record<string, number> = {};
    const totalOrder = getDefaultOrderQty(item);

    let remaining = totalOrder;
    item.cabinets.forEach(cab => {
      const needed = Math.max(0, cab.deficit);
      const allocated = Math.min(needed, remaining);
      defaultDist[cab.consumable.id] = allocated;
      remaining -= allocated;
    });

    // If there is any leftover quantity, allocate to the first cabinet
    if (remaining > 0 && item.cabinets.length > 0) {
      const firstId = item.cabinets[0].consumable.id;
      defaultDist[firstId] = (defaultDist[firstId] || 0) + remaining;
    }

    setRestockDistributions(defaultDist);
    setRestockModalItem(item);
  };

  // Confirm Multi-Cabinet Restock
  const handleConfirmRestockModal = async () => {
    if (!restockModalItem) return;
    try {
      let totalAdded = 0;
      for (const cab of restockModalItem.cabinets) {
        const addQty = restockDistributions[cab.consumable.id] || 0;
        if (addQty > 0) {
          await onUpdateQty(cab.consumable, cab.consumable.currentQty + addQty);
          totalAdded += addQty;
        }
      }
      onToast(`รับของเข้าตู้ ${restockModalItem.name} เข้าตู้เรียบร้อย (+${totalAdded} ${restockModalItem.unit})`);
      setRestockModalItem(null);
    } catch (err) {
      console.error(err);
      onToast("เกิดข้อผิดพลาดในการรับของเข้าตู้");
    }
  };

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
        const status = item.isOutOfStock ? "⚠️ หมดสต็อก" : item.isBelowThreshold ? "⚡ ต่ำกว่าเกณฑ์" : "📦 สั่งสำรอง";
        msg += `${index + 1}. ${item.name} (${item.department})\n`;
        msg += `   • สั่งซื้อ: ${orderQty} ${item.unit}\n`;
        msg += `   • สต็อกรวม: ${item.totalCurrentQty} / เกณฑ์ขั้นต่ำ ${item.totalMinThreshold} ${item.unit} [${status}]\n`;
        if (item.isMultiCabinet) {
          const breakdown = item.cabinets.map(c => `${c.cabinetName}: มี ${c.currentQty} (ขาด ${c.deficit})`).join(", ");
          msg += `   • 📍 มีใน ${item.cabinets.length} ตู้: ${breakdown}\n`;
        } else {
          msg += `   • ตำแหน่งจัดเก็บ: ${item.cabinets[0]?.cabinetName || "-"}\n`;
        }
        msg += `\n`;
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
      "ชื่อรายการวัสดุสิ้นเปลือง",
      "แผนก",
      "ตู้จัดเก็บ",
      "สต็อกคงเหลือรวม",
      "เกณฑ์ขั้นต่ำรวม (Min)",
      "เกณฑ์เป้าหมายรวม (Max)",
      "จำนวนที่ต้องสั่งซื้อ",
      "หน่วยนับ",
      "สถานะความเร่งด่วน",
      "จำนวนตู้จัดเก็บ",
      "รายละเอียดสต็อกแยกตามตู้"
    ];

    const rows = poItems.map((item, index) => {
      const orderQty = getDefaultOrderQty(item);
      const cabNames = item.cabinets.map(c => c.cabinetName).join(", ");
      const breakdown = item.cabinets.map(c => `${c.cabinetName}: คงเหลือ ${c.currentQty}/${c.minThreshold} (ขาด ${c.deficit})`).join(" | ");
      const status = item.isOutOfStock ? "วิกฤต (หมดสต็อก)" : item.isBelowThreshold ? "ต่ำกว่าเกณฑ์" : "ปกติ/สต็อกเต็ม";

      return [
        index + 1,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.department}"`,
        `"${cabNames.replace(/"/g, '""')}"`,
        item.totalCurrentQty,
        item.totalMinThreshold,
        item.totalTargetStock,
        orderQty,
        `"${item.unit}"`,
        `"${status}"`,
        item.isMultiCabinet ? `มีใน ${item.cabinets.length} ตู้` : "1 ตู้",
        `"${breakdown.replace(/"/g, '""')}"`
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
                {groupMultiCabinet ? "รวบรวมพัสดุชื่อเดียวกันให้แสดงเป็น 1 รายการ" : `จากรายการตรวจนับทั้งหมด ${consumables.length} ชนิด`}
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

          {/* Group Multi-Cabinet Toggle (เปิดไว้เป็นค่าเริ่มต้นเพื่อให้แสดง 1 ช่องตามที่ต้องการ) */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none bg-emerald-50/70 border border-emerald-200/80 px-2.5 py-1.5 rounded-xl hover:bg-emerald-100/70 transition-colors">
            <input
              type="checkbox"
              checked={groupMultiCabinet}
              onChange={(e) => setGroupMultiCabinet(e.target.checked)}
              className="rounded text-emerald-700 focus:ring-emerald-700 h-4 w-4 cursor-pointer"
            />
            <Layers className="h-3.5 w-3.5 text-emerald-700" />
            <span>รวมรายการแยกตู้เป็น 1 แถว</span>
          </label>
        </div>

        {/* Right: Print / Excel / Line Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
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
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>พิมพ์ ({orientation === "portrait" ? "แนวตั้ง" : "แนวนอน"})</span>
          </button>

          {/* Action 2: Export Excel */}
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>ส่งออก Excel</span>
          </button>

          {/* Action 3: Copy for LINE */}
          <button
            onClick={handleCopyForLine}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs cursor-pointer transition-all active:scale-95 whitespace-nowrap"
          >
            <Copy className="h-3.5 w-3.5 text-slate-600" />
            <span>คัดลอกส่ง LINE</span>
          </button>
        </div>
      </div>

      {/* 4. PURCHASE ORDER: MOBILE CARDS & DESKTOP TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* MOBILE VIEW (md:hidden): Card Layout with zero horizontal overflow */}
        <div className="block md:hidden divide-y divide-slate-100">
          {poItems.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-extrabold text-slate-800 text-sm">
                สต็อกพัสดุครบตามเกณฑ์มาตรฐานแล้ว!
              </p>
              <p className="text-xs text-slate-400 mt-1">
                ไม่มีรายการพัสดุที่ต้องสั่งซื้อเพิ่มในแผนก {selectedDept === "ALL" ? "ทั้งหมด" : selectedDept}
              </p>
            </div>
          ) : (
            poItems.map((item, index) => {
              const orderQty = getDefaultOrderQty(item);
              const isOutOfStock = item.isOutOfStock;
              const isBelowThreshold = item.isBelowThreshold;

              return (
                <div 
                  key={item.key}
                  className={`p-3.5 space-y-3 transition-colors ${
                    isOutOfStock ? "bg-rose-50/25" : isBelowThreshold ? "bg-amber-50/15" : ""
                  }`}
                >
                  {/* Top: Thumbnail, Name, Department & Urgency */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-11 w-11 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            #{index + 1}
                          </span>
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 font-bold text-[9px] rounded uppercase">
                            {item.department}
                          </span>
                          {item.isMultiCabinet && (
                            <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[9px] rounded flex items-center gap-1">
                              <Layers className="h-2.5 w-2.5" />
                              <span>รวม {item.cabinets.length} ตู้</span>
                            </span>
                          )}
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug break-words mt-0.5">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          ตู้: {item.cabinets.map(c => c.cabinetName).join(", ")}
                        </p>
                      </div>
                    </div>

                    {/* Urgency Badge */}
                    <div className="shrink-0">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-extrabold text-[10px] border border-rose-200 animate-pulse">
                          วิกฤต (0 ชิ้น)
                        </span>
                      ) : isBelowThreshold ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-bold text-[10px] border border-amber-200">
                          ต่ำกว่าเกณฑ์
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] border border-emerald-200">
                          ปกติ (สต็อกเต็ม)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Current vs Min Target */}
                  <div className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-500 font-medium">สต็อกรวม / เกณฑ์ขั้นต่ำรวม:</span>
                    <span className="font-extrabold text-slate-800">
                      <span className={isOutOfStock ? "text-rose-600" : isBelowThreshold ? "text-amber-600" : "text-emerald-700"}>
                        {item.totalCurrentQty}
                      </span>
                      {" / "}{item.totalMinThreshold} {item.unit}
                    </span>
                  </div>

                  {/* Multi-Cabinet Breakdown on Mobile */}
                  {item.isMultiCabinet && (
                    <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-200/80 space-y-1 text-xs">
                      <div className="font-bold text-indigo-900 text-[11px] flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-indigo-600" />
                        <span>รายละเอียดสต็อกแยกตาม {item.cabinets.length} ตู้:</span>
                      </div>
                      <div className="space-y-1 pt-0.5">
                        {item.cabinets.map(cab => (
                          <div key={cab.cabinetId} className="flex items-center justify-between text-[11px] bg-white/80 p-1 px-2 rounded border border-indigo-100">
                            <span className="font-medium text-slate-800 truncate">{cab.cabinetName}</span>
                            <span className="font-bold text-slate-600 shrink-0">
                              มี {cab.currentQty} / เกณฑ์ {cab.minThreshold} (ขาด {cab.deficit})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom: Stepper Order Qty & Restock Button */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {/* Stepper */}
                    <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        onClick={() => handleAdjustOrderQty(item, -1)}
                        disabled={orderQty <= 0}
                        className="h-8 w-8 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                        title="ลดจำนวนที่สั่ง (-1)"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>

                      <div className="px-1 text-center min-w-[50px]">
                        <input
                          type="number"
                          min="0"
                          value={orderQty}
                          onChange={(e) => handleSetOrderQty(item, parseInt(e.target.value, 10))}
                          className="w-full text-center text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none"
                        />
                        <span className="text-[9px] text-slate-400 font-bold block leading-none">
                          {item.unit}
                        </span>
                      </div>

                      <button
                        onClick={() => handleAdjustOrderQty(item, 1)}
                        className="h-8 w-8 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                        title="เพิ่มจำนวนที่สั่ง (+1)"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Quick Restock Fill Button */}
                    <button
                      onClick={async () => {
                        if (item.isMultiCabinet) {
                          handleOpenRestockModal(item);
                        } else {
                          await onUpdateQty(item.subItems[0], item.subItems[0].currentQty + orderQty);
                          onToast(`เติมสต็อก ${item.name} +${orderQty} ${item.unit} เรียบร้อย!`);
                        }
                      }}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                    >
                      {item.isMultiCabinet ? "จัดสรรเข้าตู้" : "รับของเข้าตู้"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP VIEW (hidden md:block): 8-Column Table */}
        <div className="hidden md:block overflow-x-auto">
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
                  const isOutOfStock = item.isOutOfStock;
                  const isBelowThreshold = item.isBelowThreshold;

                  return (
                    <tr 
                      key={item.key}
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
                            {item.isMultiCabinet ? (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[10px]">
                                <Layers className="h-3 w-3 text-indigo-600" />
                                <span>รวม {item.cabinets.length} ตู้จัดเก็บ</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                                ID: {item.id.slice(-6)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Department & Cabinet */}
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded uppercase">
                          {item.department}
                        </span>
                        {item.isMultiCabinet ? (
                          <div className="mt-1 space-y-1">
                            {item.cabinets.map(cab => (
                              <div key={cab.cabinetId} className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 p-1 px-1.5 rounded border border-slate-200/60 max-w-[210px]">
                                <span className="font-medium text-slate-700 truncate">{cab.cabinetName}</span>
                                <span className="font-bold text-slate-500 shrink-0 text-[10px]">
                                  ({cab.currentQty}/{cab.minThreshold})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600 font-medium text-[11px] block mt-1 truncate max-w-[150px]">
                            {item.cabinets[0]?.cabinetName || "-"}
                          </span>
                        )}
                      </td>

                      {/* Stock vs Min/Max */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`font-black text-xs sm:text-sm ${
                            isOutOfStock ? "text-rose-600 font-black" : isBelowThreshold ? "text-amber-600" : "text-emerald-700"
                          }`}>
                            {item.totalCurrentQty} / {item.totalMinThreshold}
                          </span>
                          {item.isMultiCabinet ? (
                            <span className="text-[10px] text-indigo-700 font-bold mt-0.5">
                              (รวม {item.cabinets.length} ตู้ | เป้าหมาย: {item.totalTargetStock})
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              (เป้าหมาย Max: {item.totalTargetStock})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-4 px-3 text-center font-bold text-slate-600 text-xs">
                        {item.unit}
                      </td>

                      {/* Order Quantity Stepper [-] [number] [+] */}
                      <td className="py-4 px-5 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
                          <button
                            onClick={() => handleAdjustOrderQty(item, -1)}
                            disabled={orderQty <= 0}
                            className="h-7 w-7 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                            title="ลดจำนวนที่สั่ง (-1)"
                          >
                            <Minus className="h-3 w-3" />
                          </button>

                          <input
                            type="number"
                            min="0"
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
                        {item.isMultiCabinet && (
                          <span className="text-[9px] text-slate-400 block mt-0.5">
                            (ขาด: {item.cabinets.map(c => `${c.cabinetName.split(' ')[0]} ${c.deficit}`).join(' + ')})
                          </span>
                        )}
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] border border-emerald-200">
                            ปกติ (สต็อกเต็ม)
                          </span>
                        )}
                      </td>

                      {/* Quick Restock Fill Button */}
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={async () => {
                            if (item.isMultiCabinet) {
                              handleOpenRestockModal(item);
                            } else {
                              await onUpdateQty(item.subItems[0], item.subItems[0].currentQty + orderQty);
                              onToast(`เติมสต็อก ${item.name} เข้าตู้ +${orderQty} ${item.unit} เรียบร้อย!`);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 font-bold text-[11px] rounded-lg border border-emerald-200 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                          title={item.isMultiCabinet ? "กระจายรับของเข้าตู้ทั้ง 2 ตู้" : "ทำเครื่องหมายว่าของมาส่งแล้ว ปรับยอดคงเหลือทันที"}
                        >
                          {item.isMultiCabinet ? "จัดสรรเข้าตู้" : "รับของเข้าตู้"}
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

      {/* 5. MULTI-CABINET RESTOCK DISTRIBUTION MODAL */}
      {restockModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900 to-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-200 shrink-0">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">
                      จัดสรรรับของเข้าตู้ (Multi-Cabinet Restock)
                    </span>
                    <span className="px-1.5 py-0.2 bg-white/20 text-white rounded text-[9px] font-bold uppercase">
                      แผนก {restockModalItem.department}
                    </span>
                  </div>
                  <h3 className="font-black text-sm sm:text-base leading-tight truncate mt-0.5">
                    {restockModalItem.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestockModalItem(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors shrink-0 ml-2"
                title="ปิดหน้าต่าง"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Total Order Summary Banner */}
            <div className="p-3.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-emerald-950 block">
                  ยอดสั่งซื้อรวมทั้งหมด: <b className="text-sm">{getDefaultOrderQty(restockModalItem)}</b> {restockModalItem.unit}
                </span>
                <span className="text-emerald-700 text-[11px]">
                  กรุณากำหนดจำนวนที่ต้องการเติมเข้าแต่ละตู้ด้านล่าง (ระบบคำนวณตามยอดที่ขาดให้อัตโนมัติ)
                </span>
              </div>
            </div>

            {/* Cabinet Allocation Rows */}
            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-[50vh]">
              {restockModalItem.cabinets.map((cab) => {
                const currentRestock = restockDistributions[cab.consumable.id] || 0;
                return (
                  <div 
                    key={cab.cabinetId}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-all shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">
                          {cab.cabinetName}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          สต็อกปัจจุบัน: <b className="text-slate-800">{cab.currentQty}</b> / เกณฑ์ Min: <b>{cab.minThreshold}</b> {restockModalItem.unit} (ขาด {cab.deficit})
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold">
                        เป้าหมาย Max: {cab.targetStock}
                      </span>
                    </div>

                    {/* Stepper for this cabinet */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-xs font-bold text-slate-600">
                        จำนวนที่เติมเข้าตู้นี้:
                      </span>
                      <div className="inline-flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            setRestockDistributions(prev => ({
                              ...prev,
                              [cab.consumable.id]: Math.max(0, (prev[cab.consumable.id] || 0) - 1)
                            }));
                          }}
                          disabled={currentRestock <= 0}
                          className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-all"
                        >
                          <Minus className="h-3 w-3" />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={currentRestock}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setRestockDistributions(prev => ({
                              ...prev,
                              [cab.consumable.id]: val
                            }));
                          }}
                          className="w-12 text-center text-xs sm:text-sm font-black text-slate-900 bg-transparent outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            setRestockDistributions(prev => ({
                              ...prev,
                              [cab.consumable.id]: (prev[cab.consumable.id] || 0) + 1
                            }));
                          }}
                          className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-all"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-400 pr-1">
                          {restockModalItem.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRestockModalItem(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmRestockModal}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <Check className="h-4 w-4" />
                <span>
                  ยืนยันรับของเข้าตู้ (รวม {(Object.values(restockDistributions) as number[]).reduce((a: number, b: number) => a + b, 0)} {restockModalItem.unit})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print-modal-overlay">
          <style>{`
            @media print {
              @page {
                size: ${orientation};
                margin: 1cm;
              }
            }
          `}</style>
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200 flex flex-col max-h-[90vh] print-modal-container">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-sm sm:text-base">
                  พิมพ์ใบสั่งซื้อ / ใบขอซื้อพัสดุ (Purchase Order Sheet)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printElementById("printable-po-sheet", "ใบขอซื้อ-ใบสั่งเติมพัสดุ", orientation)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
                >
                  <Printer className="h-4 w-4" />
                  <span>สั่งพิมพ์ A4</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Sheet Body */}
            <div id="printable-po-sheet" className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white text-slate-900 print-section">
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
                    <th className="p-2 border-r border-slate-300 text-center">คงเหลือรวม</th>
                    <th className="p-2 border-r border-slate-300 text-center">เกณฑ์มาตรฐาน</th>
                    <th className="p-2 border-r border-slate-300 text-center font-black">จำนวนที่สั่ง</th>
                    <th className="p-2 text-center">หน่วยนับ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {poItems.map((item, idx) => {
                    const cabText = item.cabinets.map(c => c.cabinetName).join(", ");
                    return (
                      <tr key={item.key} className="border-b border-slate-200">
                        <td className="p-2 border-r border-slate-200 text-center font-bold">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200 font-bold text-slate-900">
                          <div>{item.name}</div>
                          {item.isMultiCabinet && (
                            <div className="text-[9px] font-normal text-indigo-700 mt-0.5">
                              * มีใน {item.cabinets.length} ตู้: {item.cabinets.map(c => `${c.cabinetName} (${c.currentQty}/${c.minThreshold})`).join(", ")}
                            </div>
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-200 uppercase">{item.department}</td>
                        <td className="p-2 border-r border-slate-200">{cabText}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-semibold">
                          {item.totalCurrentQty}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center">{item.totalMinThreshold}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-black text-slate-900 bg-slate-50">
                          {getDefaultOrderQty(item)}
                        </td>
                        <td className="p-2 text-center font-semibold">{item.unit}</td>
                      </tr>
                    );
                  })}
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
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between no-print">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                onClick={() => printElementById("printable-po-sheet", "ใบขอซื้อ-ใบสั่งเติมพัสดุ", orientation)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <Printer className="h-4 w-4" />
                <span>สั่งพิมพ์กระดาษ A4 เดี๋ยวนี้ (Print Clean A4)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Cabinet Stock Breakdown Modal */}
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
                      ตรวจสอบสต็อกข้ามตู้ (Cross-Cabinet Stock Check)
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
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          ตู้ ID: {loc.cabinetId.slice(-6)}
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
                          ต่ำกว่าเกณฑ์
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

              {/* Note */}
              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200/70 text-indigo-950 text-xs flex items-start gap-2 leading-relaxed">
                <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">การตรวจสอบก่อนสั่งซื้อ:</span>
                  <span>
                    ระบบรวบรวมสต็อกของพัสดุชื่อเดียวกันที่อยู่<b>เฉพาะภายในแผนก {selectedMultiStock.department}</b> เท่านั้น (เช่น ตู้หลักและตู้สำรองของแผนก) หากพบว่ายังมีสต็อกเพียงพอในตู้อื่นของแผนกเดียวกัน สามารถเบิกมาใช้งานก่อนได้โดยไม่ต้องสั่งซื้อเพิ่ม
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
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
