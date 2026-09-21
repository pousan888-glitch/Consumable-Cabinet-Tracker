import React, { useState, useMemo } from "react";
import { MasterConsumable, Consumable, Cabinet, DepartmentRecord } from "../types";
import { 
  addMasterConsumable, 
  updateMasterConsumable, 
  deleteMasterConsumable,
  syncAllMasterConsumablesToCabinets,
  CONSUMABLE_PRESETS
} from "../lib/dbService";
import ImageUploadInput from "./ImageUploadInput";
import { 
  Boxes, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Sparkles, 
  Layers, 
  Tag, 
  Check, 
  X, 
  Building2, 
  Package, 
  ArrowRight, 
  Filter,
  Eye,
  AlertCircle,
  FolderSync,
  HelpCircle,
  RefreshCw
} from "lucide-react";

interface MasterCatalogViewProps {
  masterItems: MasterConsumable[];
  consumables: Consumable[];
  cabinets: Cabinet[];
  departments: DepartmentRecord[];
  onRefresh: () => void;
  onDeployToCabinet: (masterItem: MasterConsumable, cabinetId: string, department: string, initialQty: number, minThresh: number, maxThresh: number) => Promise<void>;
  onToast: (msg: string) => void;
  userEmail: string;
}

const CATEGORIES = [
  "ทั้งหมด",
  "บรรจุภัณฑ์",
  "อุปกรณ์ PPE",
  "เทป & กาว",
  "เครื่องมือ & ซ่อมบำรุง",
  "อุปกรณ์เซฟตี้ & ขนย้าย",
  "สลักภัณฑ์ & น็อต",
  "เคมีภัณฑ์ & ทำความสะอาด",
  "ทั่วไป"
];

export default function MasterCatalogView({
  masterItems,
  consumables,
  cabinets,
  departments,
  onRefresh,
  onDeployToCabinet,
  onToast,
  userEmail
}: MasterCatalogViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Add/Edit Master Item Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterConsumable | null>(null);
  const [itemForm, setItemForm] = useState({
    code: "",
    name: "",
    category: "บรรจุภัณฑ์",
    unit: "ชิ้น",
    imageUrl: CONSUMABLE_PRESETS["tape"],
    defaultMinThreshold: 5,
    defaultMaxThreshold: 20,
    description: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deploy to Cabinet Modal
  const [deployingItem, setDeployingItem] = useState<MasterConsumable | null>(null);
  const [deployForm, setDeployForm] = useState({
    cabinetId: "",
    department: "",
    initialQty: 10,
    minThreshold: 5,
    maxThreshold: 25
  });
  const [isDeploying, setIsDeploying] = useState(false);

  // Delete Confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync All to Cabinets state
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Filtered master items
  const filteredItems = useMemo(() => {
    return masterItems.filter(item => {
      const matchSearch = 
        !searchTerm.trim() ||
        (item.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.category || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchCategory = 
        selectedCategory === "ทั้งหมด" || 
        item.category?.toLowerCase() === selectedCategory.toLowerCase();

      return matchSearch && matchCategory;
    });
  }, [masterItems, searchTerm, selectedCategory]);

  // Map of usage across cabinets and departments for each master item
  const itemUsageMap = useMemo(() => {
    const map: Record<string, { totalStock: number; departments: Set<string>; cabinetCount: number }> = {};

    masterItems.forEach(m => {
      map[m.id] = { totalStock: 0, departments: new Set<string>(), cabinetCount: 0 };
    });

    consumables.forEach(c => {
      // match either by masterId or by standardized name
      let matchedMaster = masterItems.find(m => m.id === c.masterId);
      if (!matchedMaster) {
        matchedMaster = masterItems.find(m => m.name.trim().toLowerCase() === c.name.trim().toLowerCase());
      }

      if (matchedMaster && map[matchedMaster.id]) {
        map[matchedMaster.id].totalStock += (c.currentQty || 0);
        if (c.department) map[matchedMaster.id].departments.add(c.department);
        map[matchedMaster.id].cabinetCount += 1;
      }
    });

    return map;
  }, [masterItems, consumables]);

  // Open Edit Modal
  const handleOpenEdit = (item: MasterConsumable) => {
    setEditingItem(item);
    setItemForm({
      code: item.code || "",
      name: item.name,
      category: item.category || "ทั่วไป",
      unit: item.unit,
      imageUrl: item.imageUrl || CONSUMABLE_PRESETS["tape"],
      defaultMinThreshold: item.defaultMinThreshold || 5,
      defaultMaxThreshold: item.defaultMaxThreshold || 20,
      description: item.description || ""
    });
    setShowItemModal(true);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    setItemForm({
      code: "MAT-" + Math.floor(100 + Math.random() * 900),
      name: "",
      category: "บรรจุภัณฑ์",
      unit: "ชิ้น",
      imageUrl: CONSUMABLE_PRESETS["tape"],
      defaultMinThreshold: 5,
      defaultMaxThreshold: 20,
      description: ""
    });
    setShowItemModal(true);
  };

  // Save Master Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim()) {
      alert("กรุณากรอกชื่อพัสดุมาตรฐาน");
      return;
    }
    if (!itemForm.unit.trim()) {
      alert("กรุณาระบุหน่วยนับมาตรฐาน");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        const res = await updateMasterConsumable(editingItem.id, {
          code: itemForm.code.trim(),
          name: itemForm.name.trim(),
          category: itemForm.category,
          unit: itemForm.unit.trim(),
          imageUrl: itemForm.imageUrl,
          defaultMinThreshold: Number(itemForm.defaultMinThreshold) || 5,
          defaultMaxThreshold: Number(itemForm.defaultMaxThreshold) || 20,
          description: itemForm.description.trim()
        });
        if (res && res.updatedCabinetItemsCount > 0) {
          onToast(`แก้ไขพัสดุ "${itemForm.name}" และซิงค์ชื่อ/รูปภาพไปยัง ${res.updatedCabinetItemsCount} รายการในตู้เรียบร้อยแล้ว`);
        } else {
          onToast(`แก้ไขพัสดุ "${itemForm.name}" ในแคตตาล็อกเรียบร้อยแล้ว`);
        }
      } else {
        await addMasterConsumable({
          code: itemForm.code.trim(),
          name: itemForm.name.trim(),
          category: itemForm.category,
          unit: itemForm.unit.trim(),
          imageUrl: itemForm.imageUrl,
          defaultMinThreshold: Number(itemForm.defaultMinThreshold) || 5,
          defaultMaxThreshold: Number(itemForm.defaultMaxThreshold) || 20,
          description: itemForm.description.trim(),
          createdBy: userEmail
        });
        onToast(`เพิ่มพัสดุมาตรฐาน "${itemForm.name}" เรียบร้อยแล้ว`);
      }
      setShowItemModal(false);
      onRefresh();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + (err?.message || "ไม่สามารถบันทึกได้"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync all master items' names and images to cabinet consumables
  const handleSyncAllToCabinets = async () => {
    if (masterItems.length === 0) {
      onToast("ยังไม่มีพัสดุมาตรฐานในแคตตาล็อก");
      return;
    }
    if (!confirm("คุณต้องการซิงค์ชื่อและรูปภาพจากพัสดุมาตรฐานทั้งหมด ไปยังพัสดุที่อยู่ในตู้จัดเก็บทุกตู้หรือไม่?")) {
      return;
    }
    setIsSyncingAll(true);
    try {
      const res = await syncAllMasterConsumablesToCabinets();
      if (res.affectedCabinetItemsCount > 0) {
        onToast(`ซิงค์ชื่อและรูปภาพไปยังพัสดุในตู้สำเร็จ! (อัปเดต ${res.affectedCabinetItemsCount} รายการในตู้ จาก ${res.syncedMastersCount} พัสดุมาตรฐาน)`);
      } else {
        onToast("พัสดุในตู้ทั้งหมดซิงค์ตรงกับพัสดุมาตรฐานอยู่แล้ว");
      }
      onRefresh();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการซิงค์: " + (err?.message || ""));
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Delete Master Item
  const handleDeleteItem = async (id: string) => {
    try {
      await deleteMasterConsumable(id);
      onToast("ลบพัสดุมาตรฐานออกจากแคตตาล็อกแล้ว");
      setDeletingId(null);
      onRefresh();
    } catch (err: any) {
      alert("ลบไม่สำเร็จ: " + (err?.message || "เกิดข้อผิดพลาด"));
    }
  };

  // Open Deploy to Cabinet
  const handleOpenDeploy = (item: MasterConsumable) => {
    setDeployingItem(item);
    const firstCab = cabinets[0];
    const defaultDept = firstCab?.departments?.[0] || departments[0]?.name || "CMT";
    setDeployForm({
      cabinetId: firstCab ? firstCab.id : "",
      department: defaultDept,
      initialQty: 10,
      minThreshold: item.defaultMinThreshold || 5,
      maxThreshold: item.defaultMaxThreshold || 25
    });
  };

  // Submit Deploy
  const handleConfirmDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployingItem || !deployForm.cabinetId) {
      alert("กรุณาเลือกตู้จัดเก็บ");
      return;
    }

    setIsDeploying(true);
    try {
      await onDeployToCabinet(
        deployingItem,
        deployForm.cabinetId,
        deployForm.department,
        deployForm.initialQty,
        deployForm.minThreshold,
        deployForm.maxThreshold
      );
      setDeployingItem(null);
      onToast(`นำ "${deployingItem.name}" เข้าตู้แผนก ${deployForm.department} สำเร็จแล้ว!`);
      onRefresh();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + (err?.message || "ไม่สามารถเพิ่มเข้าตู้ได้"));
    } finally {
      setIsDeploying(false);
    }
  };

  // Scan and import unique items from existing consumables to Master Catalog
  const handleAutoImportFromConsumables = async () => {
    const existingNames = new Set(masterItems.map(m => m.name.trim().toLowerCase()));
    const candidates: Consumable[] = [];

    consumables.forEach(c => {
      const clean = c.name.trim().toLowerCase();
      if (!existingNames.has(clean)) {
        existingNames.add(clean); // prevent duplicate in candidates
        candidates.push(c);
      }
    });

    if (candidates.length === 0) {
      onToast("พัสดุทั้งหมดในตู้มีอยู่ในแคตตาล็อกมาตรฐานครบถ้วนแล้ว");
      return;
    }

    if (!confirm(`พบพัสดุในตู้ที่ยังไม่มีในแคตตาล็อกกลางจำนวน ${candidates.length} รายการ ต้องการดึงเข้ามาในแคตตาล็อกมาตรฐานอัตโนมัติหรือไม่?`)) {
      return;
    }

    let addedCount = 0;
    for (const c of candidates) {
      try {
        await addMasterConsumable({
          code: "MAT-" + Math.floor(100 + Math.random() * 900),
          name: c.name.trim(),
          category: "ทั่วไป",
          unit: c.unit || "ชิ้น",
          imageUrl: c.imageUrl || CONSUMABLE_PRESETS["tape"],
          defaultMinThreshold: c.minThreshold || 5,
          defaultMaxThreshold: c.maxThreshold || 25,
          description: `นำเข้าอัตโนมัติจากสต็อกแผนก ${c.department}`,
          createdBy: userEmail
        });
        addedCount++;
      } catch (e) {
        console.warn("Import error:", e);
      }
    }

    onToast(`ดึงพัสดุเข้าแคตตาล็อกมาตรฐานสำเร็จแล้ว ${addedCount} รายการ`);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* 1. HERO & EXPLANATION BANNER */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 rounded-3xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden border border-indigo-800/50">
        <div className="absolute -right-8 -bottom-8 w-60 h-60 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 backdrop-blur-xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
              <span>แคตตาล็อกพัสดุมาตรฐานส่วนกลาง (MASTER ITEM CATALOG)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white font-display">
              รายการพัสดุมาตรฐานสำหรับทุกแผนก (CMT, DNM, WL, SBS, QC)
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              สร้างรายการพัสดุต้นตอมาตรฐานเพียงครั้งเดียว เพื่อให้ทุกแผนกดึงข้อมูลรูปภาพ ชื่อ และหน่วยนับไปใส่ในตู้ของตนเองได้ทันที 
              ช่วยให้การสั่งซื้อแบบรวมศูนย์แม่นยำ และไม่เกิดชื่อพัสดุซ้ำซ้อน
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSyncAllToCabinets}
              disabled={isSyncingAll}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600/70 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs border border-indigo-400/50 transition-all cursor-pointer shadow-xs active:scale-98 disabled:opacity-50"
              title="ซิงค์รูปภาพและชื่อของพัสดุมาตรฐานทั้งหมด ไปยังพัสดุในตู้จัดเก็บทุกตู้ทันที"
            >
              <RefreshCw className={`h-4 w-4 text-indigo-200 ${isSyncingAll ? "animate-spin" : ""}`} />
              <span>{isSyncingAll ? "กำลังซิงค์ข้อมูล..." : "ซิงค์รูปและชื่อไปยังทุกตู้"}</span>
            </button>

            <button
              onClick={handleAutoImportFromConsumables}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs border border-white/20 transition-all cursor-pointer shadow-xs active:scale-98"
              title="สแกนพัสดุในตู้ปัจจุบันและดึงเข้าแคตตาล็อกอัตโนมัติ"
            >
              <FolderSync className="h-4 w-4 text-indigo-300" />
              <span>ดึงจากสต็อกปัจจุบัน</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md cursor-pointer active:scale-98"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>+ เพิ่มพัสดุมาตรฐาน</span>
            </button>
          </div>
        </div>

        {/* Catalog Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[11px] font-bold text-slate-300">พัสดุมาตรฐานทั้งหมด</div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">
              {masterItems.length} <span className="text-xs font-normal text-slate-300">รายการ</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[11px] font-bold text-slate-300">หมวดหมู่วัสดุ</div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">
              {CATEGORIES.length - 1} <span className="text-xs font-normal text-slate-300">หมวด</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[11px] font-bold text-slate-300">สต็อกรวมทุกตู้</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">
              {consumables.reduce((sum, c) => sum + (c.currentQty || 0), 0)} <span className="text-xs font-normal text-slate-300">ชิ้น/หน่วย</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <div className="text-[11px] font-bold text-slate-300">แผนกที่ใช้งานร่วมกัน</div>
            <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
              {departments.length} <span className="text-xs font-normal text-slate-300">แผนก</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & CATEGORY FILTER */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อพัสดุมาตรฐาน, รหัส SKU, หรือรายละเอียดสเปก..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
            แสดง {filteredItems.length} จากทั้งหมด {masterItems.length} รายการ
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3. CATALOG ITEMS GRID */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs">
          <Boxes className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-extrabold text-slate-800">ไม่พบพัสดุที่ตรงกับการค้นหา</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            ลองเปลี่ยนคำค้นหา หรือกดปุ่ม <b>"+ เพิ่มพัสดุมาตรฐาน"</b> เพื่อลงทะเบียนพัสดุใหม่เข้าแคตตาล็อกส่วนกลาง
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>เพิ่มพัสดุใหม่ตอนนี้</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const usage = itemUsageMap[item.id] || { totalStock: 0, departments: new Set(), cabinetCount: 0 };
            const deptList = Array.from(usage.departments);

            return (
              <div 
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
              >
                {/* Top Image & Code Header */}
                <div className="p-4 flex items-start gap-3.5 border-b border-slate-100">
                  <div 
                    onClick={() => setPreviewImage(item.imageUrl)}
                    className="h-16 w-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 relative cursor-pointer group-hover:ring-2 ring-indigo-500/20 transition-all"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="h-4 w-4 text-white drop-shadow" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {item.code || "STD-ITEM"}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                        {item.category || "ทั่วไป"}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900 mt-1 leading-snug line-clamp-2" title={item.name}>
                      {item.name}
                    </h3>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span>หน่วยนับ: <b className="text-slate-800">{item.unit}</b></span>
                      <span>•</span>
                      <span>เกณฑ์เตือน: <b className="text-rose-600">{item.defaultMinThreshold || 5} {item.unit}</b></span>
                    </div>
                  </div>
                </div>

                {/* Middle: Description & Cross-Department Usage */}
                <div className="p-4 flex-1 space-y-3 bg-slate-50/50 text-xs">
                  {item.description && (
                    <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-200/60 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-500">แผนกที่มีพัสดุนี้ในตู้:</span>
                      <span className="font-black text-slate-800">
                        สต็อกรวม {usage.totalStock} {item.unit}
                      </span>
                    </div>

                    {deptList.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {deptList.map(dept => (
                          <span 
                            key={dept}
                            className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200"
                          >
                            ✓ {dept}
                          </span>
                        ))}
                        <span className="text-[10px] text-slate-400 self-center ml-1">
                          ({usage.cabinetCount} ตู้)
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">
                        ยังไม่ได้นำเข้าตู้ของแผนกใด
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="p-3 border-t border-slate-100 bg-white flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenDeploy(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs active:scale-98"
                    title="นำพัสดุนี้ไปใส่ในตู้ของแผนกที่ต้องการ"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ ใส่ในตู้แผนก</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                      title="แก้ไขข้อมูลมาตรฐาน"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingId(item.id)}
                      className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                      title="ลบออกจากแคตตาล็อก"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD / EDIT MASTER ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scale-up my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingItem ? "แก้ไขพัสดุมาตรฐาน" : "เพิ่มพัสดุมาตรฐานใหม่ (Master Item)"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    ข้อมูลนี้จะเป็นแม่แบบกลางให้ทุกแผนกดึงไปใช้ในตู้
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editingItem && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200/90 rounded-2xl flex items-start gap-2.5">
                <RefreshCw className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950 leading-relaxed">
                  <span className="font-extrabold text-emerald-900">⚡ ซิงค์อัตโนมัติไปยังทุกตู้ (Auto-Sync):</span>{" "}
                  เมื่อบันทึกการแก้ไข <span className="font-bold underline">ชื่อ</span> หรือ <span className="font-bold underline">รูปภาพ</span> ระบบจะอัปเดตไปยังรายการพัสดุในตู้จัดเก็บทุกตู้ที่ตรงกันโดยอัตโนมัติทันที
                  {itemUsageMap[editingItem.id]?.cabinetCount > 0 && (
                    <span className="block mt-1 font-bold text-emerald-700">
                      (พบพัสดุที่อ้างอิงรายการนี้อยู่ใน {itemUsageMap[editingItem.id].cabinetCount} ตู้จัดเก็บ)
                    </span>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    รหัสพัสดุกลาง (SKU / Code)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น MAT-WRAP-01"
                    value={itemForm.code}
                    onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    หมวดหมู่วัสดุ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {CATEGORIES.filter(c => c !== "ทั้งหมด").map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  ชื่อพัสดุมาตรฐาน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ตัวอย่าง: พลาสติกแรป (PLASTIC WRAP) หรือ ถุงมือไนไตรสีฟ้า"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    หน่วยนับมาตรฐาน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ม้วน, ชิ้น, กล่อง"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-rose-600 mb-1">
                    เกณฑ์เตือนแนะนำ (Min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={itemForm.defaultMinThreshold}
                    onChange={(e) => setItemForm({ ...itemForm, defaultMinThreshold: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-rose-50/40 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-indigo-600 mb-1">
                    สต็อกสูงสุดแนะนำ (Max)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={itemForm.defaultMaxThreshold}
                    onChange={(e) => setItemForm({ ...itemForm, defaultMaxThreshold: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-indigo-50/40 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  รายละเอียดเพิ่มเติม / สเปกสินค้า (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="เช่น ขนาด 50 ซม. หนา 15 ไมครอน หรือ มาตรฐาน มอก./ANSI"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  รูปภาพอ้างอิงมาตรฐาน
                </label>
                <ImageUploadInput
                  label="รูปภาพอ้างอิงมาตรฐาน"
                  helperText="รูปมาตรฐานจะถูกนำไปใช้ในตู้ของทุกแผนกที่ดึงรายการนี้ไปใช้"
                  value={itemForm.imageUrl}
                  onChange={(url) => setItemForm({ ...itemForm, imageUrl: url })}
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
                  onPreviewFullImage={(url) => setPreviewImage(url)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? "กำลังบันทึก..." : editingItem ? "บันทึกการแก้ไข" : "บันทึกเข้าแคตตาล็อก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DEPLOY TO CABINET (นำพัสดุเข้าตู้ของแผนก) */}
      {deployingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    นำพัสดุมาตรฐานไปใส่ในตู้
                  </h3>
                  <p className="text-xs text-slate-500">
                    ดึงข้อมูลพัสดุจากแคตตาล็อกกลางไปยังตู้ที่ระบุ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeployingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Selected Master Item Banner */}
            <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
              <img
                src={deployingItem.imageUrl}
                alt={deployingItem.name}
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded-xl object-cover border border-slate-200"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-indigo-600">{deployingItem.code}</div>
                <div className="text-xs font-black text-slate-900 truncate">{deployingItem.name}</div>
                <div className="text-[10px] text-slate-500">หน่วย: {deployingItem.unit} • เกณฑ์เตือน: {deployingItem.defaultMinThreshold}</div>
              </div>
            </div>

            <form onSubmit={handleConfirmDeploy} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  เลือกตู้จัดเก็บเป้าหมาย <span className="text-rose-500">*</span>
                </label>
                <select
                  value={deployForm.cabinetId}
                  onChange={(e) => {
                    const cabId = e.target.value;
                    const cab = cabinets.find(c => c.id === cabId);
                    setDeployForm(prev => ({
                      ...prev,
                      cabinetId: cabId,
                      department: cab?.departments?.[0] || prev.department
                    }));
                  }}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="" disabled>-- กรุณาเลือกตู้ --</option>
                  {cabinets.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.location})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  แผนกผู้รับผิดชอบพัสดุในตู้นี้ <span className="text-rose-500">*</span>
                </label>
                <select
                  value={deployForm.department}
                  onChange={(e) => setDeployForm({ ...deployForm, department: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name} ({d.description || d.name})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    สต็อกตั้งต้น ({deployingItem.unit})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={deployForm.initialQty}
                    onChange={(e) => setDeployForm({ ...deployForm, initialQty: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-rose-600 mb-1">
                    จุดเตือน (Min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={deployForm.minThreshold}
                    onChange={(e) => setDeployForm({ ...deployForm, minThreshold: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-rose-200 bg-rose-50/30 rounded-xl text-xs font-bold text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-indigo-600 mb-1">
                    สต็อกสูงสุด (Max)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={deployForm.maxThreshold}
                    onChange={(e) => setDeployForm({ ...deployForm, maxThreshold: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/30 rounded-xl text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeployingItem(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isDeploying}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isDeploying ? "กำลังนำเข้าตู้..." : "ยืนยันนำเข้าตู้"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-scale-up">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl w-12 h-12 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">ยืนยันการลบพัสดุมาตรฐาน?</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              การลบรายการนี้จะไม่กระทบพัสดุที่เคยนำไปใส่ในตู้แล้ว แต่แผนกอื่นๆ จะไม่สามารถดึงรายการนี้จากแคตตาล็อกได้อีก
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDeleteItem(deletingId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={previewImage}
              alt="Preview"
              referrerPolicy="no-referrer"
              className="w-full max-h-[75vh] object-contain bg-slate-950"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
