import React, { useState } from "react";
import { Cabinet, Consumable, DepartmentRecord } from "../types";
import { saveCabinetWithdrawal } from "../lib/dbService";
import { 
  PackageMinus, 
  Check, 
  Minus, 
  Plus, 
  MapPin, 
  User, 
  Building2, 
  FileText, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Eye, 
  ArrowLeft,
  Sparkles,
  Inbox
} from "lucide-react";

interface CabinetWithdrawViewProps {
  cabinet: Cabinet;
  consumables: Consumable[];
  userEmail: string;
  userName: string;
  departments: DepartmentRecord[];
  onSuccess: () => void;
  onCancel: () => void;
  onPreviewImage: (preview: { url: string; title: string; subtitle?: string }) => void;
}

export default function CabinetWithdrawView({
  cabinet,
  consumables,
  userEmail,
  userName,
  departments,
  onSuccess,
  onCancel,
  onPreviewImage
}: CabinetWithdrawViewProps) {
  const [withdrawnBy, setWithdrawnBy] = useState(userName || userEmail);
  const [selectedDept, setSelectedDept] = useState(
    cabinet.departments[0] || (departments[0]?.name || "Production")
  );
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successDone, setSuccessDone] = useState(false);

  const handleQtyChange = (itemId: string, currentQty: number, val: number) => {
    const clamped = Math.max(0, Math.min(currentQty, val));
    setQuantities(prev => ({
      ...prev,
      [itemId]: clamped
    }));
  };

  const handleIncrement = (itemId: string, maxQty: number) => {
    setQuantities(prev => {
      const current = prev[itemId] || 0;
      return {
        ...prev,
        [itemId]: Math.min(maxQty, current + 1)
      };
    });
  };

  const handleDecrement = (itemId: string) => {
    setQuantities(prev => {
      const current = prev[itemId] || 0;
      return {
        ...prev,
        [itemId]: Math.max(0, current - 1)
      };
    });
  };

  // Selected items summary
  const selectedItems = consumables
    .filter(item => (quantities[item.id] || 0) > 0)
    .map(item => ({
      item,
      qty: quantities[item.id]
    }));

  const totalQtyWithdrawn = selectedItems.reduce((sum, i) => sum + i.qty, 0);

  const handleConfirmWithdraw = async () => {
    setErrorMsg(null);
    if (selectedItems.length === 0) {
      setErrorMsg("กรุณาเลือกจำนวนพัสดุที่ต้องการเบิกอย่างน้อย 1 รายการ");
      return;
    }

    if (!withdrawnBy.trim()) {
      setErrorMsg("กรุณาระบุชื่อผู้เบิกพัสดุ");
      return;
    }

    setSaving(true);
    try {
      const itemsPayload = selectedItems.map(({ item, qty }) => ({
        consumableId: item.id,
        name: item.name,
        qtyTaken: qty,
        unit: item.unit,
        imageUrl: item.imageUrl
      }));

      await saveCabinetWithdrawal(
        cabinet.id,
        cabinet.name,
        selectedDept,
        withdrawnBy.trim(),
        itemsPayload,
        note.trim() || undefined,
        "CABINET_QR"
      );

      setSuccessDone(true);
      setTimeout(() => {
        onSuccess();
      }, 1800);
    } catch (err: any) {
      console.error("Withdrawal error:", err);
      setErrorMsg("เกิดข้อผิดพลาดในการบันทึกการเบิกพัสดุ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  if (successDone) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-scale-up">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-emerald-100 flex flex-col items-center">
          <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-md shadow-emerald-500/10">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
            เบิกพัสดุสำเร็จเรียบร้อย!
          </h2>
          <p className="text-slate-500 text-sm font-medium mb-6">
            ระบบได้หักลดจำนวนพัสดุคงเหลือในตู้ <strong>{cabinet.name}</strong> และบันทึกลงประวัติการเบิกเรียบร้อยแล้ว
          </p>

          <div className="w-full bg-slate-50 rounded-2xl p-4 mb-6 text-left border border-slate-100 text-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">รายการที่เบิกออก:</div>
            {selectedItems.map(({ item, qty }) => (
              <div key={item.id} className="flex justify-between py-1 border-b border-slate-100 last:border-0 font-semibold">
                <span className="text-slate-700">{item.name}</span>
                <span className="text-orange-600 font-bold">-{qty} {item.unit}</span>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-400">
            กำลังพาท่านกลับสู่หน้ารายการตู้...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 font-sans">
      
      {/* Top back button */}
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl mb-4 transition-all cursor-pointer shadow-xs"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>ยกเลิก / กลับหน้ารวมตู้</span>
      </button>

      {/* Cabinet Header Banner */}
      <div className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden mb-6">
        <div className="relative h-44 sm:h-52 bg-slate-900">
          <img 
            src={cabinet.photoUrl} 
            alt={cabinet.name} 
            className="w-full h-full object-cover opacity-85"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent flex flex-col justify-end p-6">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="bg-orange-600 text-white font-black text-[11px] px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                <PackageMinus className="h-3.5 w-3.5" />
                โหมดเบิกพัสดุ (Withdrawal Mode)
              </span>
              <span className="text-[11px] text-white/80 bg-black/40 backdrop-blur-xs px-2.5 py-0.5 rounded-full">
                {cabinet.location}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight font-display">
              {cabinet.name}
            </h1>
            <p className="text-white/80 text-xs mt-1 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-orange-400" />
              <span>{cabinet.location}</span>
              <span className="text-white/40">•</span>
              <span>แผนกประจำตู้: {cabinet.departments.join(", ")}</span>
            </p>
          </div>
        </div>

        {/* Withdrawal form inputs */}
        <div className="p-5 sm:p-6 bg-orange-50/40 border-t border-orange-100/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-orange-600" />
                <span>ชื่อผู้เบิก / รหัสพนักงาน *</span>
              </label>
              <input
                type="text"
                value={withdrawnBy}
                onChange={(e) => setWithdrawnBy(e.target.value)}
                placeholder="ระบุชื่อผู้เบิกพัสดุ"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-orange-600" />
                <span>แผนกที่นำไปใช้งาน *</span>
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name} {d.description ? `(${d.description})` : ""}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-orange-600" />
              <span>วัตถุประสงค์ / หมายเหตุการเบิก (ถ้ามี)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น นำไปใช้ไลน์ประกอบ A, ซ่อมบำรุงกะดึก, เปลี่ยนตามระยะ"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 font-bold animate-fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Consumables List in Cabinet */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Inbox className="h-4 w-4 text-orange-600" />
            <span>รายการพัสดุในตู้นี้ ({consumables.length} รายการ)</span>
          </h2>
          <span className="text-xs text-slate-500 font-semibold">
            แตะที่รูปพัสดุเพื่อดูภาพจริง
          </span>
        </div>

        {consumables.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-slate-400 border border-slate-100">
            ไม่มีรายการพัสดุในตู้นี้
          </div>
        ) : (
          <div className="space-y-3">
            {consumables.map(item => {
              const qtyToTake = quantities[item.id] || 0;
              const isOutOfStock = item.currentQty <= 0;

              return (
                <div 
                  key={item.id}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-150 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm ${
                    qtyToTake > 0 
                      ? "border-orange-400 bg-orange-50/10 shadow-md shadow-orange-500/5 ring-1 ring-orange-400" 
                      : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  {/* Left info */}
                  <div className="flex items-center gap-3.5 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => onPreviewImage({
                        url: item.imageUrl,
                        title: item.name,
                        subtitle: `แผนก: ${item.department} | หน่วย: ${item.unit} | คงเหลือ: ${item.currentQty}`
                      })}
                      className="relative h-16 w-16 rounded-2xl bg-slate-100 overflow-hidden border-2 border-slate-200 shrink-0 cursor-pointer group shadow-xs active:scale-95 transition-all text-left"
                      title="แตะดูรูปภาพจริง"
                    >
                      <img 
                        src={item.imageUrl} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="h-4 w-4 drop-shadow" />
                      </div>
                      <span className="absolute bottom-0 inset-x-0 bg-slate-950/70 text-white text-[8px] font-bold text-center py-0.5">
                        แตะดูรูป
                      </span>
                    </button>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full uppercase">
                          {item.department}
                        </span>
                        {item.currentQty <= item.minThreshold && !isOutOfStock && (
                          <span className="text-[9px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.5 rounded">
                            สต็อกต่ำ
                          </span>
                        )}
                        {isOutOfStock && (
                          <span className="text-[9px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded">
                            ของหมดตู้
                          </span>
                        )}
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug">
                        {item.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>คงเหลือในตู้: <span className="font-black text-slate-800">{item.currentQty}</span> {item.unit}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[10px] text-slate-400 font-semibold">เกณฑ์ Min: {item.minThreshold} / Max: {item.maxCapacity || Math.max(item.minThreshold * 3, 20)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right stepper */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-xs sm:hidden font-bold text-slate-500">
                      จำนวนที่ต้องการเบิก:
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={qtyToTake <= 0 || isOutOfStock}
                        onClick={() => handleDecrement(item.id)}
                        className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-700 font-bold cursor-pointer transition-colors active:scale-95"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        max={item.currentQty}
                        disabled={isOutOfStock}
                        value={qtyToTake === 0 ? "" : qtyToTake}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          handleQtyChange(item.id, item.currentQty, isNaN(val) ? 0 : val);
                        }}
                        className="w-16 h-10 text-center font-black text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />

                      <button
                        type="button"
                        disabled={qtyToTake >= item.currentQty || isOutOfStock}
                        onClick={() => handleIncrement(item.id, item.currentQty)}
                        className="h-10 w-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-30 flex items-center justify-center text-white font-bold cursor-pointer transition-colors active:scale-95 shadow-xs shadow-orange-500/20"
                      >
                        <Plus className="h-4 w-4" />
                      </button>

                      <span className="text-xs font-bold text-slate-600 w-10 text-left">
                        {item.unit}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bottom Bar for Confirmation */}
      <div className="sticky bottom-4 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 z-30">
        <div className="text-center sm:text-left">
          <div className="text-xs text-slate-500 font-semibold">
            สรุปรายการเบิกพัสดุ:
          </div>
          <div className="text-sm font-black text-slate-900">
            {selectedItems.length > 0 ? (
              <span>เลือก <strong className="text-orange-600">{selectedItems.length}</strong> ชนิด (รวม <strong className="text-orange-600">{totalQtyWithdrawn}</strong> หน่วย)</span>
            ) : (
              <span className="text-slate-400 font-normal">ยังไม่ได้เลือกจำนวนที่จะเบิก</span>
            )}
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-none px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
          >
            ยกเลิก
          </button>
          
          <button
            type="button"
            disabled={saving || selectedItems.length === 0}
            onClick={handleConfirmWithdraw}
            className="flex-1 sm:flex-none px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-orange-600/20 cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>กำลังตัดสต็อกและบันทึก...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4 stroke-[3]" />
                <span>ยืนยันการเบิกพัสดุ ({selectedItems.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
