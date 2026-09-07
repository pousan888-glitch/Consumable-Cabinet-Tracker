import React, { useState } from "react";
import { Cabinet } from "../types";
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  MapPin, 
  QrCode, 
  PackageMinus, 
  ClipboardCheck, 
  Layers 
} from "lucide-react";

interface CabinetQRModalProps {
  cabinet: Cabinet;
  onClose: () => void;
}

export default function CabinetQRModal({ cabinet, onClose }: CabinetQRModalProps) {
  const [activeTab, setActiveTab] = useState<"withdraw" | "count" | "dual">("withdraw");
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const getQRUrl = (mode: "count" | "withdraw") => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}?cabinetId=${cabinet.id}&mode=${mode}`;
  };

  const getQRImageSrc = (mode: "count" | "withdraw", size = 260) => {
    const url = getQRUrl(mode);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
  };

  const handleCopy = (mode: "count" | "withdraw") => {
    const url = getQRUrl(mode);
    navigator.clipboard.writeText(url);
    setCopiedType(mode);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("กรุณาอนุญาตป๊อปอัปในเบราว์เซอร์เพื่อพิมพ์ QR Code");
      return;
    }

    const countUrl = getQRUrl("count");
    const withdrawUrl = getQRUrl("withdraw");
    const countImg = getQRImageSrc("count", 300);
    const withdrawImg = getQRImageSrc("withdraw", 300);

    let bodyHtml = "";

    if (activeTab === "withdraw") {
      bodyHtml = `
        <div class="card withdraw-border">
          <div class="tag withdraw-tag">QR รหัสเบิกพัสดุ (WITHDRAW TAG)</div>
          <h2>${cabinet.name}</h2>
          <div class="loc">📍 ตำแหน่ง: ${cabinet.location} | แผนก: ${cabinet.departments.join(", ")}</div>
          <div class="img-box">
            <img src="${withdrawImg}" alt="QR เบิกของ" />
          </div>
          <div class="desc">สแกนด้วยกล้องสมาร์ทโฟน เพื่อเปิดระบบเบิกของและตัดยอดสต็อกทันที</div>
          <div class="url">${withdrawUrl}</div>
        </div>
      `;
    } else if (activeTab === "count") {
      bodyHtml = `
        <div class="card count-border">
          <div class="tag count-tag">QR ตรวจนับสต็อก (COUNT TAG)</div>
          <h2>${cabinet.name}</h2>
          <div class="loc">📍 ตำแหน่ง: ${cabinet.location} | แผนก: ${cabinet.departments.join(", ")}</div>
          <div class="img-box">
            <img src="${countImg}" alt="QR ตรวจนับสต็อก" />
          </div>
          <div class="desc">สแกนด้วยกล้องสมาร์ทโฟน เพื่อเปิดระบบเช็กสต็อกและตรวจนับจำนวนพัสดุ</div>
          <div class="url">${countUrl}</div>
        </div>
      `;
    } else {
      // Dual layout
      bodyHtml = `
        <div class="dual-container">
          <div class="header-banner">
            <h1>${cabinet.name}</h1>
            <div class="loc">สถานที่: ${cabinet.location} | แผนก: ${cabinet.departments.join(", ")}</div>
          </div>
          <div class="dual-cards">
            <div class="card count-border">
              <div class="tag count-tag">1. สแกนเพื่อตรวจนับสต็อก</div>
              <div class="img-box">
                <img src="${countImg}" alt="QR ตรวจนับ" />
              </div>
              <div class="desc">สำหรับทีม Helper / พนักงาน<br>ตรวจนับและอัปเดตจำนวนจริง</div>
              <div class="url">${countUrl}</div>
            </div>
            <div class="card withdraw-border">
              <div class="tag withdraw-tag">2. สแกนเพื่อเบิกพัสดุไปใช้</div>
              <div class="img-box">
                <img src="${withdrawImg}" alt="QR เบิกของ" />
              </div>
              <div class="desc">สำหรับพนักงาน / QC / ช่าง<br>สแกนเลือกของและตัดสต็อก</div>
              <div class="url">${withdrawUrl}</div>
            </div>
          </div>
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>พิมพ์ QR Code - ${cabinet.name}</title>
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 95vh; 
              background: #fff; 
              margin: 0; 
              padding: 20px; 
            }
            .card { 
              text-align: center; 
              padding: 30px; 
              border-radius: 20px; 
              max-width: 400px; 
              margin: 0 auto;
              background: #fff;
            }
            .withdraw-border { border: 3px solid #f97316; }
            .count-border { border: 3px solid #4f46e5; }
            .tag { 
              display: inline-block; 
              color: white; 
              font-weight: 800; 
              padding: 6px 16px; 
              border-radius: 9999px; 
              font-size: 13px; 
              letter-spacing: 0.5px;
            }
            .withdraw-tag { background: #ea580c; }
            .count-tag { background: #4f46e5; }
            h1 { font-size: 26px; margin: 0 0 6px 0; font-weight: 900; color: #0f172a; }
            h2 { font-size: 22px; margin: 16px 0 6px 0; font-weight: 900; color: #0f172a; }
            .loc { color: #64748b; font-size: 13px; margin-bottom: 20px; font-weight: 600; }
            .img-box {
              background: #f8fafc;
              padding: 16px;
              border-radius: 16px;
              display: inline-block;
              margin-bottom: 16px;
              border: 1px dashed #cbd5e1;
            }
            img { width: 240px; height: 240px; display: block; }
            .desc { font-size: 13px; color: #334155; font-weight: 700; line-height: 1.5; margin-bottom: 12px; }
            .url { font-size: 9px; color: #94a3b8; font-family: monospace; word-break: break-all; border-top: 1px solid #f1f5f9; padding-top: 10px; }
            
            .dual-container { max-width: 820px; text-align: center; border: 3px solid #0f172a; border-radius: 24px; padding: 25px; }
            .header-banner { border-bottom: 2px dashed #cbd5e1; padding-bottom: 15px; margin-bottom: 20px; }
            .dual-cards { display: flex; gap: 20px; justify-content: center; }
            .dual-cards .card { flex: 1; max-width: 370px; }
            .dual-cards img { width: 200px; height: 200px; }

            @media print {
              body { padding: 0; min-height: 100vh; }
              @page { margin: 1cm; size: auto; }
            }
          </style>
        </head>
        <body>
          ${bodyHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 400);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-scale-up flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/75">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                รหัส QR Code ประจำตู้
              </h2>
              <p className="text-xs text-slate-500 font-semibold truncate max-w-[240px] sm:max-w-xs">
                {cabinet.name} • {cabinet.location}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="p-3 bg-slate-100/70 border-b border-slate-200/80 flex gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveTab("withdraw")}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "withdraw"
                ? "bg-white text-orange-600 shadow-sm border border-orange-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <PackageMinus className="h-3.5 w-3.5" />
            <span>QR เบิกของ (ใหม่)</span>
          </button>

          <button
            onClick={() => setActiveTab("count")}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "count"
                ? "bg-white text-indigo-600 shadow-sm border border-indigo-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            <span>QR ตรวจนับสต็อก</span>
          </button>

          <button
            onClick={() => setActiveTab("dual")}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "dual"
                ? "bg-white text-slate-900 shadow-sm border border-slate-300"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>ป้ายพิมพ์คู่ (2 QR)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 font-sans">
          {activeTab === "withdraw" && (
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider mb-2 border border-orange-200">
                <PackageMinus className="h-3.5 w-3.5" />
                QR สำหรับเบิกของออกจากตู้
              </span>

              <h3 className="text-lg font-black text-slate-900 mt-1 mb-1">
                {cabinet.name}
              </h3>
              <p className="text-slate-500 text-xs font-semibold flex items-center gap-1 mb-4">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {cabinet.location} • แผนก: {cabinet.departments.join(", ")}
              </p>

              {/* QR Box */}
              <div className="p-4 bg-orange-50/50 border-2 border-dashed border-orange-200 rounded-2xl mb-4 relative shadow-inner">
                <img
                  src={getQRImageSrc("withdraw", 260)}
                  alt="QR เบิกของ"
                  className="h-44 w-44 sm:h-52 sm:w-52 mx-auto mix-blend-multiply"
                />
              </div>

              <p className="text-slate-600 text-xs font-medium max-w-sm leading-relaxed mb-4">
                สแกนแผ่น QR นี้ด้วยกล้องโทรศัพท์มือถือ เพื่อเข้าสู่หน้าจอ
                <strong className="text-orange-600 font-bold"> &quot;เบิกพัสดุออกจากตู้นี้&quot; </strong> 
                ตัดยอดสต็อกในระบบอัตโนมัติ และบันทึกลงประวัติ
              </p>

              {/* URL Snippet */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                <span className="truncate">{getQRUrl("withdraw")}</span>
                <button
                  onClick={() => handleCopy("withdraw")}
                  className="px-2.5 py-1 bg-white hover:bg-orange-50 text-orange-600 border border-slate-200 rounded-lg font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedType === "withdraw" ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-600">คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>คัดลอกลิงก์</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === "count" && (
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider mb-2 border border-indigo-200">
                <ClipboardCheck className="h-3.5 w-3.5" />
                QR สำหรับตรวจนับสต็อก
              </span>

              <h3 className="text-lg font-black text-slate-900 mt-1 mb-1">
                {cabinet.name}
              </h3>
              <p className="text-slate-500 text-xs font-semibold flex items-center gap-1 mb-4">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {cabinet.location} • แผนก: {cabinet.departments.join(", ")}
              </p>

              {/* QR Box */}
              <div className="p-4 bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-2xl mb-4 relative shadow-inner">
                <img
                  src={getQRImageSrc("count", 260)}
                  alt="QR ตรวจนับสต็อก"
                  className="h-44 w-44 sm:h-52 sm:w-52 mx-auto mix-blend-multiply"
                />
              </div>

              <p className="text-slate-600 text-xs font-medium max-w-sm leading-relaxed mb-4">
                สแกนแผ่น QR นี้เพื่อเข้าสู่หน้าจอ
                <strong className="text-indigo-600 font-bold"> &quot;ตรวจนับสต็อกพัสดุ&quot; </strong> 
                สำหรับทีมงาน Helper ตรวจนับจำนวนจริงบนชั้นวาง
              </p>

              {/* URL Snippet */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                <span className="truncate">{getQRUrl("count")}</span>
                <button
                  onClick={() => handleCopy("count")}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 rounded-lg font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedType === "count" ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-600">คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>คัดลอกลิงก์</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === "dual" && (
            <div className="flex flex-col items-center text-center">
              <div className="bg-slate-100 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl mb-4">
                📄 ป้ายสติกเกอร์คู่: รวม QR นับสต็อก + QR เบิกของ ในแผ่นเดียว สำหรับติดหน้าตู้จริง
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-4">
                {/* Count Side */}
                <div className="border-2 border-indigo-200 rounded-2xl p-3 bg-indigo-50/30 flex flex-col items-center">
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full mb-2">
                    1. สแกนนับสต็อก
                  </span>
                  <img
                    src={getQRImageSrc("count", 180)}
                    alt="QR Count"
                    className="h-28 w-28 sm:h-32 sm:w-32 mix-blend-multiply mb-2"
                  />
                  <span className="text-[10px] text-slate-500 font-semibold">Helper ตรวจนับของ</span>
                </div>

                {/* Withdraw Side */}
                <div className="border-2 border-orange-200 rounded-2xl p-3 bg-orange-50/30 flex flex-col items-center">
                  <span className="text-[10px] font-black text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full mb-2">
                    2. สแกนเบิกของ
                  </span>
                  <img
                    src={getQRImageSrc("withdraw", 180)}
                    alt="QR Withdraw"
                    className="h-28 w-28 sm:h-32 sm:w-32 mix-blend-multiply mb-2"
                  />
                  <span className="text-[10px] text-slate-500 font-semibold">พนักงาน/QC หยิบใช้</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                คลิกปุ่ม &quot;พิมพ์ภาพ QR&quot; ด้านล่างเพื่อพิมพ์ป้ายสติกเกอร์คู่นี้ไปติดที่หน้าบานประตูตู้
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>พิมพ์ภาพ QR ({activeTab === "dual" ? "ป้ายคู่" : activeTab === "withdraw" ? "QR เบิกของ" : "QR นับสต็อก"})</span>
          </button>

          <button
            onClick={onClose}
            className="py-3 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-all"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
