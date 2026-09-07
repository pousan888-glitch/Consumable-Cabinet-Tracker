import React, { useState, useEffect } from "react";
import { Cabinet, Consumable, DepartmentRecord } from "../types";
import { 
  getCabinets, 
  getConsumables, 
  saveCountHistory,
  getDepartments 
} from "../lib/dbService";
import ImagePreviewModal from "./ImagePreviewModal";
import CabinetQRModal from "./CabinetQRModal";
import CabinetWithdrawView from "./CabinetWithdrawView";
import { 
  Check, 
  Plus, 
  Minus, 
  MapPin, 
  AlertTriangle, 
  ChevronLeft, 
  Loader2, 
  Sparkles, 
  Clock, 
  Search,
  Eye,
  QrCode,
  PackageMinus,
  ClipboardCheck,
  Building2,
  Inbox
} from "lucide-react";

interface HelperCountViewProps {
  userEmail: string;
  userName: string;
  selectedCabinetId?: string; // If loaded via QR code
  initialMode?: "count" | "withdraw";
  onBackToMainMenu?: () => void;
}

export default function HelperCountView({ 
  userEmail, 
  userName, 
  selectedCabinetId, 
  initialMode = "count",
  onBackToMainMenu 
}: HelperCountViewProps) {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("ALL");
  const [currentMode, setCurrentMode] = useState<"count" | "withdraw">(initialMode);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const [qrModalCabinet, setQrModalCabinet] = useState<Cabinet | null>(null);

  // Load cabinets and departments initially
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [cabs, depts] = await Promise.all([
          getCabinets(),
          getDepartments()
        ]);
        setCabinets(cabs);
        setDepartments(depts);

        // If cabinetId is pre-selected (via QR query param)
        const urlParams = new URLSearchParams(window.location.search);
        const activeId = selectedCabinetId || urlParams.get("cabinetId");
        const urlMode = (urlParams.get("mode") as "count" | "withdraw") || initialMode;
        if (urlMode === "withdraw" || urlMode === "count") {
          setCurrentMode(urlMode);
        }

        if (activeId) {
          const matched = cabs.find(c => c.id === activeId);
          if (matched) {
            setSelectedCabinet(matched);
            await loadConsumablesForCabinet(matched.id);
          }
        }
      } catch (err) {
        console.error("Error loading cabinets for helper:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedCabinetId, initialMode]);

  // Load consumables for a selected cabinet
  const loadConsumablesForCabinet = async (cabId: string) => {
    try {
      const items = await getConsumables(cabId);
      setConsumables(items);
      
      // Initialize counts with currentQty
      const initialCounts: Record<string, number> = {};
      items.forEach(item => {
        initialCounts[item.id] = item.currentQty;
      });
      setCounts(initialCounts);
    } catch (err) {
      console.error("Error loading cabinet items:", err);
    }
  };

  const handleSelectCabinet = async (cabinet: Cabinet, mode: "count" | "withdraw" = "count") => {
    setLoading(true);
    setSelectedCabinet(cabinet);
    setCurrentMode(mode);
    
    // Update URL query parameter in the browser without reloading to mimic real QR scanning
    const url = new URL(window.location.href);
    url.searchParams.set("cabinetId", cabinet.id);
    url.searchParams.set("mode", mode);
    window.history.pushState({}, "", url.toString());
    
    await loadConsumablesForCabinet(cabinet.id);
    setLoading(false);
  };

  const handleSwitchMode = (mode: "count" | "withdraw") => {
    setCurrentMode(mode);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.pushState({}, "", url.toString());
  };

  const handleBackToCabinets = () => {
    setSelectedCabinet(null);
    setConsumables([]);
    setCounts({});
    setSuccess(false);

    // Clean up URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete("cabinetId");
    url.searchParams.delete("mode");
    window.history.pushState({}, "", url.toString());
  };

  const handleCountChange = (id: string, val: number) => {
    setCounts(prev => ({
      ...prev,
      [id]: Math.max(0, val)
    }));
  };

  const handleIncrement = (id: string) => {
    setCounts(prev => ({
      ...prev,
      [id]: (prev[id] || 0) + 1
    }));
  };

  const handleDecrement = (id: string) => {
    setCounts(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) - 1)
    }));
  };

  const handleSave = async () => {
    if (!selectedCabinet) return;
    setSaving(true);
    try {
      // Structure count logs
      const itemCountsLog = consumables.map(item => {
        const newQty = counts[item.id] ?? item.currentQty;
        return {
          consumableId: item.id,
          name: item.name,
          prevQty: item.currentQty,
          newQty,
          unit: item.unit,
          department: item.department
        };
      });

      await saveCountHistory(
        selectedCabinet.id,
        selectedCabinet.name,
        userEmail,
        itemCountsLog
      );

      setSuccess(true);
    } catch (err) {
      console.error("Failed to save count checks:", err);
      alert("เกิดข้อผิดพลาดขณะบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const filteredCabinets = cabinets.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.departments.some(d => d.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDept = 
      selectedDeptFilter === "ALL" || 
      c.departments.includes(selectedDeptFilter);

    return matchesSearch && matchesDept;
  });

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-slate-50">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500">กำลังดึงข้อมูลระบบสแกนสต็อกและตู้พัสดุ...</p>
      </div>
    );
  }

  // SUCCESS SCREEN FOR STOCK COUNTING
  if (success && selectedCabinet) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center bg-slate-50 px-4 py-8 text-center font-sans">
        <div className="bg-white p-8 sm:p-12 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center animate-scale-up">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6 shadow-sm">
            <Check className="h-10 w-10 stroke-[3]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">บันทึกสต็อกเรียบร้อย!</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            ข้อมูลจำนวนสิ่งของใน <strong>{selectedCabinet.name}</strong> ได้รับการปรับปรุงและส่งไปยังหน้าควบคุมของแอดมินเรียบร้อยแล้ว
          </p>

          <div className="bg-slate-50 p-4 rounded-xl w-full text-left space-y-3 border border-slate-100 mb-8 text-xs text-slate-600">
            <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
              <span className="font-semibold text-slate-500">ผู้นับและตรวจเช็ก:</span>
              <span className="font-medium text-slate-800">{userName}</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {consumables.map(item => {
                const prev = item.currentQty;
                const next = counts[item.id] ?? item.currentQty;
                const isDecreased = next < prev;
                const isIncreased = next > prev;

                return (
                  <div key={item.id} className="flex justify-between items-center text-[11px]">
                    <span className="truncate max-w-[160px] text-slate-700 font-medium">{item.name}</span>
                    <span className="font-bold flex items-center gap-1">
                      <span>{prev}</span>
                      <span className="text-slate-400">→</span>
                      <span className={isDecreased ? "text-rose-600" : isIncreased ? "text-emerald-600" : "text-slate-800"}>
                        {next} {item.unit}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full flex flex-col gap-2.5">
            <button
              onClick={() => {
                setSuccess(false);
                loadConsumablesForCabinet(selectedCabinet.id);
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all cursor-pointer text-xs"
            >
              ตรวจนับตู้นี้ต่อ
            </button>

            <button
              onClick={handleBackToCabinets}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/10 transition-all cursor-pointer text-xs"
            >
              กลับสู่หน้ารวมตู้เก็บพัสดุ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CABINET DETAIL VIEW (EITHER COUNT OR WITHDRAW MODE)
  if (selectedCabinet) {
    return (
      <div className="min-h-screen bg-slate-50 pb-16 font-sans">
        {/* Detail Top Bar */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <button
              onClick={handleBackToCabinets}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>กลับหน้ารวมตู้</span>
            </button>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/70">
              <button
                onClick={() => handleSwitchMode("count")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentMode === "count"
                    ? "bg-white text-indigo-600 shadow-xs border border-indigo-200/80"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                <span>ตรวจนับสต็อก</span>
              </button>

              <button
                onClick={() => handleSwitchMode("withdraw")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentMode === "withdraw"
                    ? "bg-white text-orange-600 shadow-xs border border-orange-200/80"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <PackageMinus className="h-3.5 w-3.5" />
                <span>เบิกพัสดุ</span>
              </button>
            </div>

            {/* QR Code button for this cabinet */}
            <button
              onClick={() => setQrModalCabinet(selectedCabinet)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="ดู QR Code ประจำตู้นี้"
            >
              <QrCode className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* RENDER WITHDRAW MODE */}
        {currentMode === "withdraw" ? (
          <CabinetWithdrawView
            cabinet={selectedCabinet}
            consumables={consumables}
            userEmail={userEmail}
            userName={userName}
            departments={departments}
            onSuccess={async () => {
              await loadConsumablesForCabinet(selectedCabinet.id);
              handleBackToCabinets();
            }}
            onCancel={handleBackToCabinets}
            onPreviewImage={(img) => setPreviewImage(img)}
          />
        ) : (
          /* RENDER COUNT MODE */
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 font-sans">
            {/* Cabinet Info Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6">
              <div className="relative h-44 sm:h-52 bg-slate-900">
                <img 
                  src={selectedCabinet.photoUrl} 
                  alt={selectedCabinet.name} 
                  className="w-full h-full object-cover opacity-85"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent flex flex-col justify-end p-6">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="bg-indigo-600 text-white font-black text-[11px] px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      โหมดตรวจนับสต็อก (Stock Count)
                    </span>
                    <span className="text-[11px] text-white/80 bg-black/40 backdrop-blur-xs px-2.5 py-0.5 rounded-full">
                      {selectedCabinet.location}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight font-display">
                    {selectedCabinet.name}
                  </h1>
                  <p className="text-white/80 text-xs mt-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{selectedCabinet.location}</span>
                    <span className="text-white/40">•</span>
                    <span>แผนก: {selectedCabinet.departments.join(", ")}</span>
                  </p>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 flex items-center gap-2.5 text-xs text-indigo-900 font-medium">
                <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>คำแนะนำ: ตรวจนับจำนวนพัสดุบนชั้นวางจริง แล้วพิมพ์ระบุหรือกดปุ่ม +/- เพื่ออัปเดตยอดคงเหลือ</span>
              </div>
            </div>

            {/* Consumables List */}
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Inbox className="h-3.5 w-3.5" />
                <span>รายการวัสดุสิ้นเปลืองในตู้ ({consumables.length} ชนิด)</span>
              </h2>
              <span className="text-xs text-slate-500 font-semibold">
                แตะที่รูปเพื่อดูรูปภาพของจริง
              </span>
            </div>

            <div className="space-y-3 mb-8">
              {consumables.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400 text-sm">
                  ไม่มีสินค้าในตู้นี้ที่ลงทะเบียนไว้ กรุณาติดต่อแอดมิน
                </div>
              ) : (
                consumables.map(item => {
                  const currentCount = counts[item.id] ?? item.currentQty;
                  const isLow = currentCount <= item.minThreshold;

                  return (
                    <div 
                      key={item.id} 
                      className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:shadow-md transition-all duration-150"
                    >
                      {/* Left: Consumable Info with Clickable Photo */}
                      <div className="flex items-center gap-3.5 sm:gap-4">
                        <button
                          type="button"
                          onClick={() => setPreviewImage({
                            url: item.imageUrl,
                            title: item.name,
                            subtitle: `แผนก: ${item.department} | หน่วยนับ: ${item.unit} | เกณฑ์เตือนสต็อกต่ำ: ${item.minThreshold}`
                          })}
                          className="relative h-16 w-16 rounded-2xl bg-slate-100 overflow-hidden border-2 border-slate-200/80 shrink-0 cursor-pointer group shadow-sm active:scale-95 transition-all text-left"
                          title="แตะเพื่อดูรูปภาพของจริงขนาดใหญ่"
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
                            <span className="text-[9px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-200/50 uppercase">
                              {item.department}
                            </span>
                            {isLow && (
                              <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <AlertTriangle className="h-2 w-2" />
                                สต็อกต่ำ
                              </span>
                            )}
                          </div>
                          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug">
                            {item.name}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-semibold">
                            <Clock className="h-3 w-3 shrink-0" />
                            สต็อกเดิม: <span className="text-slate-700 underline font-bold">{item.currentQty} {item.unit}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Counter Controls */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-none border-slate-50">
                        <span className="text-xs text-slate-400 sm:hidden font-medium">ระบุจำนวนที่นับได้:</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDecrement(item.id)}
                            className="h-10 w-10 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                            title="ลดจำนวน"
                          >
                            <Minus className="h-4 w-4 stroke-[2.5]" />
                          </button>
                          
                          <input
                            type="number"
                            value={currentCount === 0 && counts[item.id] === undefined ? "" : currentCount}
                            onChange={(e) => handleCountChange(item.id, parseInt(e.target.value) || 0)}
                            className="w-16 h-10 border border-slate-200 rounded-xl text-center font-extrabold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          
                          <button
                            onClick={() => handleIncrement(item.id)}
                            className="h-10 w-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 active:scale-95 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                            title="เพิ่มจำนวน"
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

            {/* Action Save Button */}
            {consumables.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 text-base font-display"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>กำลังบันทึกข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5 stroke-[2.5]" />
                    <span>บันทึกจำนวนสิ่งของในตู้นี้</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Modals */}
        {previewImage && (
          <ImagePreviewModal
            imageUrl={previewImage.url}
            title={previewImage.title}
            subtitle={previewImage.subtitle}
            onClose={() => setPreviewImage(null)}
          />
        )}

        {qrModalCabinet && (
          <CabinetQRModal
            cabinet={qrModalCabinet}
            onClose={() => setQrModalCabinet(null)}
          />
        )}
      </div>
    );
  }

  // DIRECTORY OF CABINETS (HOME SCREEN FOR HELPERS & WORKERS)
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-sans bg-slate-50 min-h-screen">
      {/* Intro section */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight font-display">
          ระบบตู้เก็บพัสดุและวัสดุสิ้นเปลือง
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1.5 max-w-lg mx-auto leading-relaxed">
          เลือกตู้เพื่อทำการ <strong>ตรวจนับสต็อก</strong> หรือ <strong>เบิกของไปใช้งาน</strong> หรือเปิดดู QR Code ประจำแต่ละตู้
        </p>
      </div>

      {/* Department Filter Badges */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
        <button
          onClick={() => setSelectedDeptFilter("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
            selectedDeptFilter === "ALL"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
          }`}
        >
          ทุกแผนก ({cabinets.length})
        </button>
        {departments.map(dept => {
          const count = cabinets.filter(c => c.departments.includes(dept.name)).length;
          return (
            <button
              key={dept.id}
              onClick={() => setSelectedDeptFilter(dept.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedDeptFilter === dept.name
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span>{dept.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedDeptFilter === dept.name ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative mb-6 max-w-md mx-auto">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="ค้นหาตู้, สถานที่ตั้ง, หรือแผนก..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm transition-all shadow-xs"
        />
      </div>

      {/* Cabinets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredCabinets.length === 0 ? (
          <div className="col-span-full bg-white p-12 border border-slate-200 rounded-3xl text-center text-slate-400">
            ไม่พบข้อมูลตู้เก็บพัสดุที่สอดคล้อง
          </div>
        ) : (
          filteredCabinets.map(cabinet => (
            <div
              key={cabinet.id}
              className="bg-white rounded-3xl overflow-hidden border border-slate-100 hover:border-indigo-200 shadow-sm transition-all duration-200 flex flex-col group"
            >
              <div className="p-4 sm:p-5 flex gap-4">
                {/* Photo with click to view */}
                <button
                  type="button"
                  onClick={() => setPreviewImage({
                    url: cabinet.photoUrl,
                    title: cabinet.name,
                    subtitle: `สถานที่: ${cabinet.location} • แผนก: ${cabinet.departments.join(", ")}`
                  })}
                  className="w-24 sm:w-28 h-24 bg-slate-100 rounded-2xl overflow-hidden shrink-0 border border-slate-200 relative group/img cursor-pointer text-left"
                  title="แตะเพื่อดูรูปตู้ขนาดใหญ่"
                >
                  <img 
                    src={cabinet.photoUrl} 
                    alt={cabinet.name} 
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-all duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-slate-950/70 text-white text-[8px] font-bold text-center py-0.5">
                    แตะดูรูปตู้
                  </span>
                </button>

                {/* Content */}
                <div className="flex flex-col justify-between overflow-hidden flex-1">
                  <div>
                    <div className="flex gap-1 mb-1 max-w-full overflow-x-auto no-scrollbar">
                      {cabinet.departments.map(dept => (
                        <span key={dept} className="bg-indigo-50 text-indigo-600 font-bold text-[9px] px-1.5 py-0.5 rounded uppercase">
                          {dept}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-sm leading-tight group-hover:text-indigo-600 transition-colors truncate">
                      {cabinet.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium truncate">
                      <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                      {cabinet.location}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={() => setQrModalCabinet(cabinet)}
                      className="text-[11px] text-slate-600 hover:text-indigo-600 font-bold flex items-center gap-1 p-1 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="ดูและพิมพ์ QR Code ตู้นี้"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>QR ตู้</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer on Cabinet Card */}
              <div className="bg-slate-50/80 p-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSelectCabinet(cabinet, "count")}
                  className="py-2.5 px-3 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                >
                  <ClipboardCheck className="h-3.5 w-3.5 text-indigo-600" />
                  <span>ตรวจนับสต็อก</span>
                </button>

                <button
                  onClick={() => handleSelectCabinet(cabinet, "withdraw")}
                  className="py-2.5 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-orange-600/20 active:scale-95"
                >
                  <PackageMinus className="h-3.5 w-3.5" />
                  <span>เบิกของจากตู้นี้</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage.url}
          title={previewImage.title}
          subtitle={previewImage.subtitle}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {qrModalCabinet && (
        <CabinetQRModal
          cabinet={qrModalCabinet}
          onClose={() => setQrModalCabinet(null)}
        />
      )}
    </div>
  );
}
