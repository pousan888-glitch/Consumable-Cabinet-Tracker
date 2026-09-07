import React, { useState } from "react";
import { DepartmentRecord, Cabinet, Consumable } from "../types";
import { 
  addDepartment, 
  updateDepartment, 
  deleteDepartment 
} from "../lib/dbService";
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  Check, 
  Search, 
  FolderKanban, 
  Package, 
  Shield, 
  Info,
  Loader2,
  X
} from "lucide-react";

interface DepartmentSettingsProps {
  departments: DepartmentRecord[];
  cabinets: Cabinet[];
  consumables: Consumable[];
  currentUserEmail: string;
  isSuperAdmin: boolean;
  onRefresh: () => Promise<void>;
  onToast: (msg: string) => void;
}

const PRESET_COLORS = [
  { name: "Indigo (คราม)", value: "#4f46e5" },
  { name: "Purple (ม่วง)", value: "#9333ea" },
  { name: "Amber (เหลืองส้ม)", value: "#f59e0b" },
  { name: "Emerald (เขียว)", value: "#10b981" },
  { name: "Rose (แดงชมพู)", value: "#e11d48" },
  { name: "Cyan (ฟ้า)", value: "#06b6d4" },
  { name: "Slate (เทาเข้ม)", value: "#475569" },
  { name: "Teal (เขียวน้ำทะเล)", value: "#0d9488" }
];

export default function DepartmentSettings({
  departments,
  cabinets,
  consumables,
  currentUserEmail,
  isSuperAdmin,
  onRefresh,
  onToast
}: DepartmentSettingsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRecord | null>(null);
  const [deletingDept, setDeletingDept] = useState<DepartmentRecord | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState(PRESET_COLORS[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingDept(null);
    setFormName("");
    setFormDesc("");
    setFormColor(PRESET_COLORS[departments.length % PRESET_COLORS.length].value);
    setFormError(null);
    setShowAddModal(true);
  };

  const openEditModal = (dept: DepartmentRecord) => {
    setEditingDept(dept);
    setFormName(dept.name);
    setFormDesc(dept.description || "");
    setFormColor(dept.color || PRESET_COLORS[0].value);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("กรุณาระบุชื่อแผนก");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, {
          name: formName.trim(),
          description: formDesc.trim(),
          color: formColor
        });
        onToast(`อัปเดตข้อมูลแผนก "${formName.trim()}" เรียบร้อย`);
      } else {
        await addDepartment(
          formName.trim(),
          formDesc.trim(),
          formColor,
          currentUserEmail
        );
        onToast(`เพิ่มแผนกใหม่ "${formName.trim()}" เข้าสู่ระบบเรียบร้อย`);
      }

      await onRefresh();
      setShowAddModal(false);
    } catch (err: any) {
      setFormError(err?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDept) return;
    setIsSubmitting(true);
    try {
      await deleteDepartment(deletingDept.id);
      onToast(`ลบแผนก "${deletingDept.name}" ออกจากระบบแล้ว`);
      await onRefresh();
      setDeletingDept(null);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการลบ: " + (err?.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter departments by search
  const filteredDepartments = departments.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Building2 className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900 font-display">
              จัดการแผนกโรงงาน (Department Settings)
            </h2>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Admin & Super Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
            เพิ่มหรือลบแผนกได้ตามการเติบโตของโรงงาน โดยแผนกที่สร้างจะแสดงในตัวเลือกตู้เก็บของ, พัสดุ, และฟิลเตอร์การนับสต็อกของ Helper ทันที
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/10 cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>+ เพิ่มแผนกใหม่</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">จำนวนแผนกทั้งหมด</div>
            <div className="text-lg font-black text-slate-900">{departments.length} แผนก</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">ตู้เก็บพัสดุในระบบ</div>
            <div className="text-lg font-black text-slate-900">{cabinets.length} ตู้</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">พัสดุวัสดุสิ้นเปลือง</div>
            <div className="text-lg font-black text-slate-900">{consumables.length} รายการ</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อแผนก หรือคำอธิบาย..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="text-xs text-slate-400 font-medium">
          แสดง {filteredDepartments.length} จากทั้งหมด {departments.length} แผนก
        </div>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDepartments.length === 0 ? (
          <div className="col-span-full bg-white p-10 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
            ไม่พบแผนกที่ตรงกับคำค้นหา
          </div>
        ) : (
          filteredDepartments.map((dept) => {
            // Calculate usage count
            const assignedCabinets = cabinets.filter(c => c.departments?.includes(dept.name));
            const assignedConsumables = consumables.filter(item => item.department === dept.name);

            return (
              <div
                key={dept.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full shrink-0 shadow-xs border border-white"
                        style={{ backgroundColor: dept.color || "#4f46e5" }}
                      />
                      <h3 className="font-extrabold text-slate-900 text-base">
                        {dept.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(dept)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                        title="แก้ไขแผนก"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingDept(dept)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        title="ลบแผนก"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mb-4 min-h-[32px] line-clamp-2">
                    {dept.description || "ไม่มีคำอธิบายเพิ่มเติม"}
                  </p>
                </div>

                {/* Badges / Stats */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1 font-semibold">
                    <FolderKanban className="h-3.5 w-3.5 text-slate-400" />
                    <span>{assignedCabinets.length} ตู้</span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold">
                    <Package className="h-3.5 w-3.5 text-slate-400" />
                    <span>{assignedConsumables.length} พัสดุ</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: ADD / EDIT DEPARTMENT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-950">
                  {editingDept ? "แก้ไขข้อมูลแผนก" : "เพิ่มแผนกใหม่เข้าสู่ระบบ"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  กำหนดชื่อแผนกและสีสัญลักษณ์ประจำแผนก
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-sans">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  ชื่อแผนก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น QA, Packing, R&D, Sanitation"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  คำอธิบายหรือหน้าที่รับผิดชอบ
                </label>
                <input
                  type="text"
                  placeholder="เช่น ฝ่ายควบคุมคุณภาพวัตถุดิบและบรรจุภัณฑ์"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  เลือกสีประจำแผนก
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((c) => {
                    const isSelected = formColor === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFormColor(c.value)}
                        className={`py-2 px-2.5 rounded-xl border flex items-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                          isSelected
                            ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/10 shadow-xs"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: c.value }}
                        />
                        <span className="truncate">{c.name.split(" ")[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/10 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>บันทึกแผนก</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deletingDept && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-scale-up p-6">
            <div className="h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="text-base font-black text-slate-950 mb-1">
              ยืนยันการลบแผนก "{deletingDept.name}"?
            </h3>
            
            {(() => {
              const inCabinets = cabinets.filter(c => c.departments?.includes(deletingDept.name));
              const inConsumables = consumables.filter(item => item.department === deletingDept.name);

              if (inCabinets.length > 0 || inConsumables.length > 0) {
                return (
                  <div className="my-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                    <div className="font-bold mb-1 flex items-center gap-1">
                      <Info className="h-3.5 w-3.5" />
                      <span>คำเตือน: มีรายการที่ผูกกับแผนกนี้อยู่</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-700">
                      {inCabinets.length > 0 && <li>ตู้เก็บของ: {inCabinets.length} ตู้ ({inCabinets.map(c => c.name).join(", ")})</li>}
                      {inConsumables.length > 0 && <li>พัสดุวัสดุสิ้นเปลือง: {inConsumables.length} รายการ</li>}
                    </ul>
                    <p className="mt-1.5 text-[10px] text-amber-600">
                      * หากลบ ข้อมูลตู้และพัสดุเดิมจะยังคงอยู่ แต่ชื่อแผนกนี้จะไม่ปรากฏในตัวเลือกใหม่อีก
                    </p>
                  </div>
                );
              }
              return (
                <p className="text-xs text-slate-500 my-3">
                  แผนกนี้ไม่มีตู้หรือพัสดุผูกอยู่ สามารถลบได้อย่างปลอดภัย
                </p>
              );
            })()}

            <div className="flex gap-2 pt-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeletingDept(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <span>ยืนยันการลบ</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
