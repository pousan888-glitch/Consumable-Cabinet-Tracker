import React, { useState } from "react";
import { 
  Trash2, 
  AlertTriangle, 
  Clock, 
  Activity, 
  CheckCircle2, 
  X, 
  Loader2, 
  Database,
  PackageMinus,
  ShieldAlert
} from "lucide-react";
import { 
  clearCountHistory, 
  clearQCConsumptionHistory, 
  clearAllHistories 
} from "../lib/dbService";

interface ClearHistoryModalProps {
  initialType?: "ALL" | "COUNT" | "QC";
  totalCountLogs: number;
  totalQcLogs: number;
  onClose: () => void;
  onSuccess: (summary: string) => void;
}

export default function ClearHistoryModal({
  initialType = "ALL",
  totalCountLogs,
  totalQcLogs,
  onClose,
  onSuccess
}: ClearHistoryModalProps) {
  const [selectedType, setSelectedType] = useState<"ALL" | "COUNT" | "QC">(initialType);
  const [retentionDays, setRetentionDays] = useState<number>(0); // 0 = all, 7, 30, 90
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalSelectedCount = 
    selectedType === "COUNT" ? totalCountLogs :
    selectedType === "QC" ? totalQcLogs :
    (totalCountLogs + totalQcLogs);

  const handleExecuteClear = async () => {
    if (!confirmChecked && totalSelectedCount > 0) {
      setErrorMsg("กรุณาทำเครื่องหมายถูกเพื่อยืนยันการล้างประวัติ");
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const daysParam = retentionDays > 0 ? retentionDays : undefined;
      let summaryText = "";

      if (selectedType === "COUNT") {
        const res = await clearCountHistory(daysParam);
        summaryText = `ล้างประวัติการตรวจนับสต็อกสำเร็จ (${res.deletedCount} รายการ)`;
      } else if (selectedType === "QC") {
        const res = await clearQCConsumptionHistory(daysParam);
        summaryText = `ล้างประวัติการเบิกและหยิบใช้ของสำเร็จ (${res.deletedCount} รายการ)`;
      } else {
        const res = await clearAllHistories(daysParam);
        summaryText = `ล้างประวัติทั้งหมดสำเร็จ (การนับสต็อก ${res.countDeleted} รายการ, การเบิกพัสดุ ${res.qcDeleted} รายการ)`;
      }

      onSuccess(summaryText);
      onClose();
    } catch (err) {
      console.error("Clear history error:", err);
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการล้างประวัติ");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                เมนูเคลียร์และล้างประวัติกิจกรรม
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                History Management & Cleanup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Category selector */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5">
              1. เลือกประเภทประวัติที่ต้องการล้าง
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option: Count logs */}
              <button
                type="button"
                onClick={() => setSelectedType("COUNT")}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  selectedType === "COUNT"
                    ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Clock className={`h-4 w-4 ${selectedType === "COUNT" ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {totalCountLogs} รายการ
                  </span>
                </div>
                <span className="font-extrabold text-xs text-slate-800 block">ประวัตินับสต็อก</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Stock Count</span>
              </button>

              {/* Option: QC/Withdrawal logs */}
              <button
                type="button"
                onClick={() => setSelectedType("QC")}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  selectedType === "QC"
                    ? "bg-purple-50 border-purple-300 ring-2 ring-purple-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <PackageMinus className={`h-4 w-4 ${selectedType === "QC" ? "text-purple-600" : "text-slate-400"}`} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    {totalQcLogs} รายการ
                  </span>
                </div>
                <span className="font-extrabold text-xs text-slate-800 block">ประวัติการเบิกของ</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Withdrawal Logs</span>
              </button>

              {/* Option: All logs */}
              <button
                type="button"
                onClick={() => setSelectedType("ALL")}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  selectedType === "ALL"
                    ? "bg-rose-50 border-rose-300 ring-2 ring-rose-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Database className={`h-4 w-4 ${selectedType === "ALL" ? "text-rose-600" : "text-slate-400"}`} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    {totalCountLogs + totalQcLogs} รายการ
                  </span>
                </div>
                <span className="font-extrabold text-xs text-slate-800 block">ล้างประวัติทั้งหมด</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">All Histories</span>
              </button>
            </div>
          </div>

          {/* 2. Retention Period */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5">
              2. เลือกช่วงเวลาที่ต้องการล้าง
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "ล้างทั้งหมด", days: 0, desc: "ล้างทุกรายการ" },
                { label: "เก่ากว่า 7 วัน", days: 7, desc: "เก็บ 7 วันล่าสุด" },
                { label: "เก่ากว่า 30 วัน", days: 30, desc: "เก็บ 30 วันล่าสุด" },
                { label: "เก่ากว่า 90 วัน", days: 90, desc: "เก็บ 90 วันล่าสุด" },
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setRetentionDays(opt.days)}
                  className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                    retentionDays === opt.days
                      ? "bg-slate-900 border-slate-900 text-white shadow-xs font-bold"
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold"
                  }`}
                >
                  <span className="text-xs block">{opt.label}</span>
                  <span className={`text-[10px] block mt-0.5 ${retentionDays === opt.days ? "text-slate-300" : "text-slate-400"}`}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Safety Notice Callout */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>ข้อควรทราบก่อนการล้างประวัติ:</span>
            </div>
            <ul className="text-amber-800 text-[11.5px] leading-relaxed space-y-1 list-disc pl-4">
              <li>การล้างประวัติจะมีผลทั้งใน Local Storage และ Cloud Firestore ทันที</li>
              <li><b>ไม่มีผลกระทบต่อยอดสต็อกคงเหลือปัจจุบัน</b> ของสินค้าในตู้ (ยอดคงเหลือยังคงเดิม)</li>
              <li>หากต้องการสำรองข้อมูลไว้ สามารถกดปุ่ม <b>"ส่งออก CSV"</b> ในแท็บประวัติก่อนกดล้างได้</li>
            </ul>
          </div>

          {/* 4. Checkbox Confirmation */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-800">
              ฉันเข้าใจและยืนยันที่จะลบข้อมูลประวัติที่เลือก ({totalSelectedCount} รายการ) อย่างถาวร
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleExecuteClear}
            disabled={isProcessing || (!confirmChecked && totalSelectedCount > 0)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-md shadow-rose-600/20 transition-all active:scale-98"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>กำลังล้างข้อมูล...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>ยืนยันการเคลียร์ประวัติ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
