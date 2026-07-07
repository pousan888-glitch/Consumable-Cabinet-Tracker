import React, { useState, useEffect } from "react";
import { Cabinet, Consumable } from "../types";
import { 
  getCabinets, 
  getConsumables, 
  saveQCConsumption 
} from "../lib/dbService";
import { 
  Check, 
  Minus, 
  Plus, 
  Loader2, 
  Flame, 
  User, 
  Activity, 
  Clock, 
  Sparkles, 
  ClipboardCheck, 
  Inbox 
} from "lucide-react";

interface QCConsumeViewProps {
  userEmail: string;
  userName: string;
  onBackToMainMenu?: () => void;
}

export default function QCConsumeView({ userEmail, userName, onBackToMainMenu }: QCConsumeViewProps) {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [allConsumables, setAllConsumables] = useState<Consumable[]>([]);
  const [filteredConsumables, setFilteredConsumables] = useState<Consumable[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [selectedCabinetId, setSelectedCabinetId] = useState<string>("ALL");
  
  const [consumptionQty, setConsumptionQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // List of unique departments
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const cabs = await getCabinets();
        setCabinets(cabs);

        const items = await getConsumables();
        setAllConsumables(items);
        setFilteredConsumables(items);

        // Get unique departments from consumables
        const depts = Array.from(new Set(items.map(i => i.department)));
        setDepartments(depts);
      } catch (err) {
        console.error("Error loading QC consumables data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter items based on department and cabinet
  useEffect(() => {
    let result = allConsumables;
    if (selectedDept !== "ALL") {
      result = result.filter(item => item.department === selectedDept);
    }
    if (selectedCabinetId !== "ALL") {
      result = result.filter(item => item.cabinetId === selectedCabinetId);
    }
    setFilteredConsumables(result);
  }, [selectedDept, selectedCabinetId, allConsumables]);

  const handleQtyChange = (id: string, currentQty: number, val: number) => {
    // Cannot consume more than what exists in the cabinet
    const finalVal = Math.min(currentQty, Math.max(0, val));
    setConsumptionQty(prev => ({
      ...prev,
      [id]: finalVal
    }));
  };

  const handleIncrement = (id: string, maxQty: number) => {
    setConsumptionQty(prev => {
      const cur = prev[id] || 0;
      return {
        ...prev,
        [id]: Math.min(maxQty, cur + 1)
      };
    });
  };

  const handleDecrement = (id: string) => {
    setConsumptionQty(prev => {
      const cur = prev[id] || 0;
      return {
        ...prev,
        [id]: Math.max(0, cur - 1)
      };
    });
  };

  const getCabinetName = (cabId: string) => {
    const cab = cabinets.find(c => c.id === cabId);
    return cab ? cab.name : "ตู้เก็บของนิรนาม";
  };

  const handleSave = async () => {
    // Filter items where consumptionQty > 0
    const itemsToConsume = filteredConsumables
      .filter(item => (consumptionQty[item.id] || 0) > 0)
      .map(item => ({
        consumableId: item.id,
        name: item.name,
        qtyTaken: consumptionQty[item.id],
        unit: item.unit,
        cabinetId: item.cabinetId,
        cabinetName: getCabinetName(item.cabinetId)
      }));

    if (itemsToConsume.length === 0) {
      alert("กรุณากรอกจำนวนที่หยิบใช้อย่างน้อย 1 รายการก่อนกดยืนยัน");
      return;
    }

    setSaving(true);
    try {
      await saveQCConsumption(
        selectedDept === "ALL" ? "QC (General)" : selectedDept,
        userEmail,
        itemsToConsume
      );

      setSuccess(true);
    } catch (err) {
      console.error("Error logging QC Consumption:", err);
      alert("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConsumptionQty({});
    setSuccess(false);
    // Reload items to see new quantities
    async function reload() {
      setLoading(true);
      const items = await getConsumables();
      setAllConsumables(items);
      setLoading(false);
    }
    reload();
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500">กำลังดึงข้อมูลวัสดุฝ่าย QC...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center bg-slate-50 px-4 py-8 text-center font-sans">
        <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center">
          <div className="h-16 w-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <ClipboardCheck className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">เบิกใช้สำเร็จ!</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            ระบบได้หักยอดสต็อกสินค้าและบันทึกประวัติการเบิกใช้ของ <strong>ฝ่าย QC</strong> แล้วเรียบร้อย
          </p>

          <div className="bg-slate-50 p-4 rounded-xl w-full text-left space-y-2.5 border border-slate-100 mb-8 text-xs text-slate-600">
            <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
              <span className="font-semibold text-slate-500">ผู้เบิกใช้:</span>
              <span className="font-medium text-slate-800">{userName}</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {filteredConsumables
                .filter(item => (consumptionQty[item.id] || 0) > 0)
                .map(item => {
                  const taken = consumptionQty[item.id];
                  const remaining = Math.max(0, item.currentQty - taken);

                  return (
                    <div key={item.id} className="flex justify-between items-center text-[11px]">
                      <span className="truncate max-w-[170px] text-slate-700 font-medium">{item.name}</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="text-rose-600">- {taken}</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-500">คงเหลือ {remaining} {item.unit}</span>
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={handleReset}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-purple-600/10 cursor-pointer transition-all"
            >
              เบิกสินค้าเพิ่ม
            </button>
            {onBackToMainMenu && (
              <button
                onClick={onBackToMainMenu}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl cursor-pointer transition-all text-xs"
              >
                กลับหน้าหลัก
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-sans bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              QC DEPARTMENT
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight font-display">
            ระบบลงทะเบียนหยิบใช้ของ (QC Consumables)
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            ลงทะเบียนหักสต็อกพัสดุประเภทสิ่งของที่ฝ่ายควบคุมคุณภาพ (QC) หยิบยืมหรือเบิกนำไปใช้ทดสอบในแล็บ
          </p>
        </div>
        {onBackToMainMenu && (
          <button
            onClick={onBackToMainMenu}
            className="self-start md:self-auto text-xs bg-white border border-slate-200 text-slate-600 hover:text-slate-850 font-semibold px-4 py-2.5 rounded-lg shadow-sm cursor-pointer transition-all shrink-0"
          >
            กลับหน้าหลัก
          </button>
        )}
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="dept-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            คัดกรองตามแผนกวัสดุ
          </label>
          <select
            id="dept-select"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all cursor-pointer"
          >
            <option value="ALL">แสดงพัสดุทุกแผนก</option>
            {departments.map(d => (
              <option key={d} value={d}>แผนก: {d}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label htmlFor="cabinet-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            คัดกรองตามตู้เก็บของ
          </label>
          <select
            id="cabinet-select"
            value={selectedCabinetId}
            onChange={(e) => setSelectedCabinetId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all cursor-pointer"
          >
            <option value="ALL">แสดงพัสดุจากทุกตู้</option>
            {cabinets.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.location})</option>
            ))}
          </select>
        </div>
      </div>

      {/* ITEMS TO CONSUME */}
      <div className="space-y-4 mb-8">
        {filteredConsumables.length === 0 ? (
          <div className="bg-white p-12 border border-slate-200 rounded-2xl text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Inbox className="h-10 w-10 text-slate-300" />
            <span>ไม่พบพัสดุวัสดุสิ้นเปลืองตามตัวกรองนี้</span>
          </div>
        ) : (
          filteredConsumables.map(item => {
            const currentQty = item.currentQty;
            const chosenQty = consumptionQty[item.id] || 0;
            const isCritical = currentQty <= item.minThreshold;

            return (
              <div 
                key={item.id} 
                className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-slate-100 hover:border-indigo-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all duration-205"
              >
                {/* Consumable basic info */}
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-lg bg-slate-100 overflow-hidden border border-slate-200/60 shrink-0">
                    <img 
                      src={item.imageUrl} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-1.5 items-center mb-1">
                      <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-100 font-bold px-1.5 py-0.5 rounded">
                        {item.department}
                      </span>
                      <span className="text-[9px] bg-slate-100 text-slate-500 font-medium px-1.5 py-0.5 rounded truncate max-w-[140px]">
                        {getCabinetName(item.cabinetId)}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-950 text-sm sm:text-base leading-snug">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-semibold">
                      คงเหลือในตู้: 
                      <span className={`font-bold ${isCritical ? "text-rose-600" : "text-slate-800"}`}>
                        {currentQty} {item.unit}
                      </span>
                      {isCritical && <span className="text-[10px] text-rose-500 font-medium">(วิกฤต/สต็อกต่ำ)</span>}
                    </p>
                  </div>
                </div>

                {/* Consumer controller */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t border-slate-50 sm:border-none">
                  <span className="text-xs font-semibold text-purple-700">หยิบไปใช้งาน:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDecrement(item.id)}
                      disabled={currentQty === 0}
                      className="h-10 w-10 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 active:scale-95 text-slate-600 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                      title="ลดจำนวนเบิก"
                    >
                      <Minus className="h-4 w-4 stroke-[2.5]" />
                    </button>
                    
                    <input
                      type="number"
                      value={chosenQty || ""}
                      onChange={(e) => handleQtyChange(item.id, currentQty, parseInt(e.target.value) || 0)}
                      disabled={currentQty === 0}
                      placeholder="0"
                      className="w-16 h-10 border border-slate-200 rounded-lg text-center font-extrabold text-indigo-800 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-300"
                    />
                    
                    <button
                      onClick={() => handleIncrement(item.id, currentQty)}
                      disabled={currentQty === 0 || chosenQty >= currentQty}
                      className="h-10 w-10 bg-purple-50 hover:bg-purple-100 text-purple-600 active:scale-95 disabled:opacity-30 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                      title="เพิ่มจำนวนเบิก"
                    >
                      <Plus className="h-4 w-4 stroke-[2.5]" />
                    </button>

                    <span className="text-xs font-bold text-slate-500 w-10 text-center">
                      {item.unit}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FOOTER CONFIRM */}
      {filteredConsumables.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-600/15 hover:shadow-purple-600/25 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 text-base"
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>กำลังส่งข้อมูลการเบิกใช้...</span>
            </>
          ) : (
            <>
              <Check className="h-5 w-5 stroke-[2.5]" />
              <span>ยืนยันและบันทึกการเบิกใช้สิ่งของ ({filteredConsumables.filter(item => (consumptionQty[item.id] || 0) > 0).length} ชิ้น)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
