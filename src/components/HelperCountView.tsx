import React, { useState, useEffect } from "react";
import { Cabinet, Consumable } from "../types";
import { 
  getCabinets, 
  getConsumables, 
  saveCountHistory 
} from "../lib/dbService";
import ImagePreviewModal from "./ImagePreviewModal";
import { 
  Check, 
  Plus, 
  Minus, 
  MapPin, 
  User, 
  AlertTriangle, 
  ChevronLeft, 
  Loader2, 
  Sparkles, 
  Clock, 
  Search,
  Eye,
  Camera,
  Maximize2
} from "lucide-react";

interface HelperCountViewProps {
  userEmail: string;
  userName: string;
  selectedCabinetId?: string; // If loaded via QR code
  onBackToMainMenu?: () => void;
}

export default function HelperCountView({ 
  userEmail, 
  userName, 
  selectedCabinetId, 
  onBackToMainMenu 
}: HelperCountViewProps) {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // Load cabinets initially
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const cabs = await getCabinets();
        setCabinets(cabs);

        // If cabinetId is pre-selected (via QR query param)
        const activeId = selectedCabinetId || new URLSearchParams(window.location.search).get("cabinetId");
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
  }, [selectedCabinetId]);

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

  const handleSelectCabinet = async (cabinet: Cabinet) => {
    setLoading(true);
    setSelectedCabinet(cabinet);
    // Update URL query parameter in the browser without reloading to mimic real QR scanning
    const url = new URL(window.location.href);
    url.searchParams.set("cabinetId", cabinet.id);
    window.history.pushState({}, "", url.toString());
    
    await loadConsumablesForCabinet(cabinet.id);
    setLoading(false);
  };

  const handleBackToCabinets = () => {
    setSelectedCabinet(null);
    setConsumables([]);
    setCounts({});
    setSuccess(false);

    // Clean up URL parameter
    const url = new URL(window.location.href);
    url.searchParams.delete("cabinetId");
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

  const filteredCabinets = cabinets.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.departments.some(d => d.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-slate-50">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500">กำลังดึงข้อมูลระบบสแกนสต็อก...</p>
      </div>
    );
  }

  // SUCCESS SCREEN
  if (success && selectedCabinet) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center bg-slate-50 px-4 py-8 text-center font-sans">
        <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6 animate-bounce">
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

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={handleBackToCabinets}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/10 cursor-pointer transition-all"
            >
              กลับหน้าตู้ทั้งหมด
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

  // CABINET DETAILS (COUNTING PANEL)
  if (selectedCabinet) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 font-sans bg-slate-50 min-h-screen">
        {/* Navigation Breadcrumb */}
        <button
          onClick={handleBackToCabinets}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-6 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm cursor-pointer transition-all"
        >
          <ChevronLeft className="h-4 w-4" />
          กลับไปเลือกตู้อื่น
        </button>

        {/* Cabinet Hero Header */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden mb-8">
          <div 
            className="relative h-44 sm:h-52 bg-slate-900 cursor-pointer group"
            onClick={() => setPreviewImage({
              url: selectedCabinet.photoUrl,
              title: selectedCabinet.name,
              subtitle: `สถานที่: ${selectedCabinet.location} | แผนก: ${selectedCabinet.departments.join(", ")}`
            })}
            title="แตะเพื่อดูรูปตู้เก็บพัสดุขนาดใหญ่"
          >
            <img 
              src={selectedCabinet.photoUrl} 
              alt={selectedCabinet.name} 
              className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent flex flex-col justify-end p-6">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex flex-wrap gap-1.5">
                  {selectedCabinet.departments.map(dept => (
                    <span key={dept} className="bg-indigo-600/95 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                      {dept}
                    </span>
                  ))}
                </div>
                <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/20">
                  <Maximize2 className="h-3 w-3" /> แตะดูรูปตู้ใหญ่
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight font-display">
                {selectedCabinet.name}
              </h1>
              <p className="text-slate-300 text-xs flex items-center gap-1 mt-1 font-medium">
                <MapPin className="h-3 w-3 shrink-0" />
                {selectedCabinet.location}
              </p>
            </div>
          </div>
          
          <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 flex items-center gap-2.5 text-[11px] sm:text-xs text-indigo-800 font-medium">
            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>คำแนะนำ: แตะที่รูปพัสดุเพื่อดูภาพจริง คีย์จำนวนที่ตรวจพบบนชั้นวาง และกดยืนยันบันทึก</span>
          </div>
        </div>

        {/* Consumables List */}
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">รายการวัสดุสิ้นเปลืองในตู้ ({consumables.length} ชนิด)</h2>
        <div className="space-y-4 mb-8">
          {consumables.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400 text-sm">
              ไม่มีสินค้าในตู้นี้ที่แอดไซน์ไว้ กรุณาติดต่อแอดมิน
            </div>
          ) : (
            consumables.map(item => {
              const currentCount = counts[item.id] ?? item.currentQty;
              const isLow = currentCount <= item.minThreshold;

              return (
                <div 
                  key={item.id} 
                  className="bg-white rounded-xl p-4 sm:p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:shadow-md transition-all duration-150"
                >
                  {/* Left: Consumable Info with Clickable Photo */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setPreviewImage({
                        url: item.imageUrl,
                        title: item.name,
                        subtitle: `แผนก: ${item.department} | หน่วยนับ: ${item.unit} | เกณฑ์เตือนสต็อกต่ำ: ${item.minThreshold}`
                      })}
                      className="relative h-16 w-16 rounded-xl bg-slate-100 overflow-hidden border-2 border-slate-200/80 shrink-0 cursor-pointer group shadow-sm active:scale-95 transition-all text-left"
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
                        <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200/50">
                          {item.department}
                        </span>
                        {isLow && (
                          <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <AlertTriangle className="h-2 w-2" />
                            สต็อกต่ำ
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-950 text-sm sm:text-base leading-snug">
                        {item.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-semibold">
                        <Clock className="h-3 w-3 shrink-0" />
                        เช็กคราวก่อน: <span className="text-slate-700 underline font-bold">{item.currentQty} {item.unit}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Counter Controls */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t border-slate-50 sm:border-none">
                    <span className="text-xs text-slate-400 sm:hidden font-medium">ระบุจำนวนที่นับได้:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDecrement(item.id)}
                        className="h-10 w-10 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                        title="ลดจำนวน"
                      >
                        <Minus className="h-4 w-4 stroke-[2.5]" />
                      </button>
                      
                      <input
                        type="number"
                        value={currentCount === 0 && counts[item.id] === undefined ? "" : currentCount}
                        onChange={(e) => handleCountChange(item.id, parseInt(e.target.value) || 0)}
                        className="w-16 h-10 border border-slate-200 rounded-lg text-center font-extrabold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      
                      <button
                        onClick={() => handleIncrement(item.id)}
                        className="h-10 w-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 active:scale-95 rounded-lg flex items-center justify-center transition-all cursor-pointer"
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

        {/* Action Buttons */}
        {consumables.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 text-base font-display"
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

        {/* Full Image Preview Modal */}
        {previewImage && (
          <ImagePreviewModal
            imageUrl={previewImage.url}
            title={previewImage.title}
            subtitle={previewImage.subtitle}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </div>
    );
  }

  // DIRECTORY OF CABINETS (HOME SCREEN FOR HELPERS)
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-sans bg-slate-50 min-h-screen">
      {/* Intro section */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight font-display">
          สแกนตู้และเช็กจำนวนพัสดุ
        </h1>
        <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
          กรุณาเลือกตู้เก็บของด้านล่างเพื่อทำการตรวจนับ หรือสแกนคิวอาร์โค้ดหน้าตู้โดยตรงเพื่อเริ่มนับได้ทันที
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6 max-w-md mx-auto">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="ค้นหาตู้, สถานที่ตั้ง, หรือแผนก..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
        />
      </div>

      {/* Cabinets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredCabinets.length === 0 ? (
          <div className="col-span-full bg-white p-12 border border-slate-200 rounded-2xl text-center text-slate-400">
            ไม่พบข้อมูลตู้เก็บพัสดุที่สอดคล้อง
          </div>
        ) : (
          filteredCabinets.map(cabinet => (
            <div
              key={cabinet.id}
              onClick={() => handleSelectCabinet(cabinet)}
              className="bg-white rounded-2xl overflow-hidden border-2 border-slate-100 p-5 hover:border-indigo-200 shadow-sm cursor-pointer transition-all duration-200 flex group gap-4"
            >
              {/* Photo */}
              <div className="w-24 sm:w-28 h-24 bg-slate-200 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                <img 
                  src={cabinet.photoUrl} 
                  alt={cabinet.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Content */}
              <div className="flex flex-col justify-between overflow-hidden flex-1 py-1">
                <div>
                  <div className="flex gap-1 mb-1 max-w-full overflow-x-auto no-scrollbar">
                    {cabinet.departments.map(dept => (
                      <span key={dept} className="bg-indigo-50 text-indigo-600 font-bold text-[9px] px-1.5 py-0.5 rounded uppercase">
                        {dept}
                      </span>
                    ))}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-indigo-600 transition-colors truncate">
                    {cabinet.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-medium truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {cabinet.location}
                  </p>
                </div>
                
                <span className="text-[10px] font-extrabold text-indigo-600 flex items-center gap-0.5 mt-2 self-start bg-indigo-50 px-2.5 py-1 rounded-full group-hover:bg-indigo-100 transition-all">
                  เริ่มตรวจเช็ก
                  <span className="transition-transform group-hover:translate-x-0.5 inline-block">→</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Full Image Preview Modal in Directory */}
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage.url}
          title={previewImage.title}
          subtitle={previewImage.subtitle}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
