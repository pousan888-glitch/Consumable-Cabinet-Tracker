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
  Layers,
  CheckCircle2,
  AlertTriangle,
  Sparkles
} from "lucide-react";

interface CabinetQRModalProps {
  cabinet: Cabinet;
  onClose: () => void;
}

export default function CabinetQRModal({ cabinet, onClose }: CabinetQRModalProps) {
  const [activeTab, setActiveTab] = useState<"withdraw" | "count" | "dual">("dual");
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
    const countImg = getQRImageSrc("count", 320);
    const withdrawImg = getQRImageSrc("withdraw", 320);

    let bodyHtml = "";

    if (activeTab === "withdraw") {
      bodyHtml = `
        <div class="card withdraw-card">
          <div class="header-band withdraw-band">
            <div class="tag-title">📦 สแกนเบิกของ (WITHDRAW)</div>
            <div class="tag-subtitle">สำหรับพนักงาน / QC / ช่าง หยิบพัสดุไปใช้</div>
          </div>
          <h2>${cabinet.name}</h2>
          <div class="loc">📍 ตำแหน่ง: ${cabinet.location} | แผนก: ${cabinet.departments.join(", ")}</div>
          <div class="img-box withdraw-img-box">
            <img src="${withdrawImg}" alt="QR สแกนเบิกของ" />
          </div>
          <div class="desc withdraw-desc">
            ⚡ สแกนด้วยกล้องมือถือ เพื่อเปิดระบบเบิกของและตัดยอดสต็อกอัตโนมัติ
          </div>
          <div class="badge-notice withdraw-notice">
            ⚠️ สำหรับการเบิกของไปใช้งานจริงเท่านั้น
          </div>
          <div class="url">${withdrawUrl}</div>
        </div>
      `;
    } else if (activeTab === "count") {
      bodyHtml = `
        <div class="card count-card">
          <div class="header-band count-band">
            <div class="tag-title">📋 สแกนนับสต็อก (STOCK COUNT)</div>
            <div class="tag-subtitle">สำหรับทีมงาน Helper ตรวจเช็กจำนวนจริงบนชั้นวาง</div>
          </div>
          <h2>${cabinet.name}</h2>
          <div class="loc">📍 ตำแหน่ง: ${cabinet.location} | แผนก: ${cabinet.departments.join(", ")}</div>
          <div class="img-box count-img-box">
            <img src="${countImg}" alt="QR สแกนนับสต็อก" />
          </div>
          <div class="desc count-desc">
            🔍 สแกนด้วยกล้องมือถือ เพื่อตรวจนับและอัปเดตยอดคงเหลือจริง
          </div>
          <div class="badge-notice count-notice">
            ℹ️ โหมดตรวจนับสต็อก (ไม่ตัดสต็อก / ไม่ออกใบเบิก)
          </div>
          <div class="url">${countUrl}</div>
        </div>
      `;
    } else {
      // Dual layout - Ultra High Contrast & Distinction
      bodyHtml = `
        <div class="dual-container">
          <div class="main-header">
            <h1>${cabinet.name}</h1>
            <div class="loc">📍 สถานที่ตั้ง: ${cabinet.location} | แผนก: ${cabinet.departments.join(", ")}</div>
            <div class="alert-strip">
              ⚠️ คำแนะนำ: กรุณาเลือกสแกนให้ถูกต้องตามหน้าที่ (ทีมตรวจนับ สแกนฝั่งสีน้ำเงิน | ผู้เบิกของ สแกนฝั่งสีส้ม)
            </div>
          </div>

          <div class="dual-cards">
            <!-- Left: COUNT -->
            <div class="card count-card">
              <div class="header-band count-band">
                <div class="tag-title">📋 1. สแกนนับสต็อก</div>
                <div class="tag-subtitle">เฉพาะทีมงาน Helper (ตรวจนับยอดคงเหลือ)</div>
              </div>
              <div class="img-box count-img-box">
                <img src="${countImg}" alt="QR สแกนนับสต็อก" />
              </div>
              <div class="desc count-desc">
                สำหรับ Helper ตรวจนับจำนวนพัสดุจริงบนชั้นวาง
              </div>
              <div class="badge-notice count-notice">
                🔍 โหมดเช็กสต็อก • ไม่ตัดยอดออก
              </div>
              <div class="url">${countUrl}</div>
            </div>

            <!-- Right: WITHDRAW -->
            <div class="card withdraw-card">
              <div class="header-band withdraw-band">
                <div class="tag-title">📦 2. สแกนเบิกของ</div>
                <div class="tag-subtitle">พนักงาน / QC / ช่าง (หยิบพัสดุไปใช้)</div>
              </div>
              <div class="img-box withdraw-img-box">
                <img src="${withdrawImg}" alt="QR สแกนเบิกของ" />
              </div>
              <div class="desc withdraw-desc">
                สำหรับผู้ใช้งานที่หยิบพัสดุออกจากตู้ไปใช้
              </div>
              <div class="badge-notice withdraw-notice">
                ⚡ สแกนเพื่อตัดยอดสต็อกทันที
              </div>
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
              padding: 24px; 
              border-radius: 24px; 
              max-width: 440px; 
              margin: 0 auto;
              background: #fff;
              overflow: hidden;
            }
            
            .count-card { 
              border: 4px solid #4338ca; 
              background: #fdfdfe;
            }
            .withdraw-card { 
              border: 4px solid #ea580c; 
              background: #fffdfa;
            }

            .header-band {
              border-radius: 16px;
              padding: 12px 14px;
              margin-bottom: 16px;
              color: white;
            }
            .count-band {
              background: #312e81;
            }
            .withdraw-band {
              background: #c2410c;
            }

            .tag-title {
              font-size: 20px;
              font-weight: 900;
              letter-spacing: 0.5px;
              line-height: 1.3;
            }
            .tag-subtitle {
              font-size: 13px;
              font-weight: 700;
              opacity: 0.95;
              margin-top: 4px;
            }

            h1 { font-size: 26px; margin: 0 0 4px 0; font-weight: 900; color: #0f172a; }
            h2 { font-size: 22px; margin: 4px 0 4px 0; font-weight: 900; color: #0f172a; }
            .loc { color: #475569; font-size: 13px; margin-bottom: 16px; font-weight: 600; }
            
            .alert-strip {
              background: #fef3c7;
              border: 2px solid #f59e0b;
              color: #92400e;
              padding: 8px 16px;
              border-radius: 12px;
              font-size: 13px;
              font-weight: 800;
              margin-bottom: 20px;
              display: inline-block;
            }

            .img-box {
              padding: 14px;
              border-radius: 20px;
              display: inline-block;
              margin-bottom: 14px;
              background: #ffffff;
            }
            .count-img-box {
              border: 3px solid #c7d2fe;
            }
            .withdraw-img-box {
              border: 3px solid #fed7aa;
            }

            img { width: 220px; height: 220px; display: block; }
            
            .desc { 
              font-size: 14px; 
              font-weight: 800; 
              line-height: 1.4; 
              margin-bottom: 10px; 
            }
            .count-desc { color: #312e81; }
            .withdraw-desc { color: #9a3412; }

            .badge-notice {
              display: inline-block;
              font-size: 12px;
              font-weight: 800;
              padding: 5px 12px;
              border-radius: 9999px;
              margin-bottom: 12px;
            }
            .count-notice {
              background: #e0e7ff;
              color: #3730a3;
              border: 1px solid #c7d2fe;
            }
            .withdraw-notice {
              background: #ffedd5;
              color: #9a3412;
              border: 1px solid #fed7aa;
            }

            .url { font-size: 9px; color: #94a3b8; font-family: monospace; word-break: break-all; border-top: 1px solid #f1f5f9; padding-top: 8px; }
            
            .dual-container { 
              max-width: 880px; 
              text-align: center; 
              border: 4px solid #0f172a; 
              border-radius: 28px; 
              padding: 24px; 
              background: #ffffff;
            }
            .main-header { 
              border-bottom: 2px dashed #cbd5e1; 
              padding-bottom: 14px; 
              margin-bottom: 20px; 
            }
            .dual-cards { 
              display: flex; 
              gap: 20px; 
              justify-content: center; 
            }
            .dual-cards .card { 
              flex: 1; 
              max-width: 400px; 
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07);
            }
            .dual-cards img { width: 200px; height: 200px; }

            @media print {
              body { padding: 0; min-height: 100vh; }
              @page { margin: 0.8cm; size: auto; }
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
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden animate-scale-up flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
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

        {/* High Visibility Tab Selection */}
        <div className="p-3 bg-slate-100/80 border-b border-slate-200/90 grid grid-cols-3 gap-1.5 sm:gap-2">
          {/* Dual Tab (Recommended for Cabinets) */}
          <button
            onClick={() => setActiveTab("dual")}
            className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === "dual"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-[1.02]"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span>ป้ายพิมพ์คู่ (2 QR)</span>
          </button>

          {/* Withdraw Tab */}
          <button
            onClick={() => setActiveTab("withdraw")}
            className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === "withdraw"
                ? "bg-orange-600 text-white shadow-md shadow-orange-600/25 scale-[1.02]"
                : "text-orange-700 bg-orange-50/70 hover:bg-orange-100/80 hover:text-orange-800"
            }`}
          >
            <PackageMinus className="h-3.5 w-3.5 shrink-0" />
            <span>สแกนเบิกของ</span>
          </button>

          {/* Count Tab */}
          <button
            onClick={() => setActiveTab("count")}
            className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === "count"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-[1.02]"
                : "text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 hover:text-indigo-800"
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
            <span>สแกนนับสต็อก</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 font-sans">
          
          {/* TAB: DUAL (RECOMMENDED FOR STICKERS) */}
          {activeTab === "dual" && (
            <div className="flex flex-col items-center text-center">
              
              {/* Distinct Instruction Banner */}
              <div className="w-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-2.5 sm:p-3 mb-4 text-left shadow-2xs flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="text-xs text-amber-950 font-bold leading-snug">
                  <span className="text-amber-700 font-black">แยก 2 รหัสชัดเจน:</span> ทีม Helper สแกนฝั่งสีน้ำเงินเพื่อ <span className="underline decoration-indigo-500 decoration-2">นับสต็อก</span> | พนักงานที่หยิบของสแกนฝั่งสีส้มเพื่อ <span className="underline decoration-orange-500 decoration-2">เบิกพัสดุ</span>
                </div>
              </div>

              {/* Side-by-side Dual Cards */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-4">
                
                {/* 1. COUNT SIDE (INDIGO) */}
                <div className="border-3 border-indigo-500 rounded-3xl p-3 sm:p-3.5 bg-gradient-to-b from-indigo-50/90 to-indigo-100/30 flex flex-col items-center shadow-sm relative overflow-hidden">
                  
                  {/* Huge Bold Title Banner */}
                  <div className="w-full bg-indigo-600 text-white py-1.5 px-2 rounded-xl text-center shadow-xs mb-1.5 flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1 font-black text-xs sm:text-sm tracking-wide">
                      <ClipboardCheck className="h-4 w-4 shrink-0 text-indigo-100" />
                      <span>1. สแกนนับสต็อก</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-extrabold text-indigo-900 bg-white/95 border border-indigo-200/90 px-2.5 py-0.5 rounded-full mb-2 shadow-2xs">
                    📋 สำหรับทีม Helper
                  </span>

                  {/* QR Box with High Contrast */}
                  <div className="bg-white p-2.5 rounded-2xl shadow-xs border-2 border-indigo-200/80 mb-2">
                    <img
                      src={getQRImageSrc("count", 180)}
                      alt="QR สแกนนับสต็อก"
                      className="h-28 w-28 sm:h-36 sm:w-36 mix-blend-multiply"
                    />
                  </div>

                  {/* Role description box */}
                  <div className="w-full bg-white/95 border border-indigo-200 rounded-xl p-1.5 sm:p-2 text-center shadow-2xs">
                    <div className="text-[11px] font-black text-indigo-950 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-indigo-600" />
                      ตรวจนับจำนวนจริง
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-indigo-600 font-bold mt-0.5">
                      ไม่ออกใบเบิก / ไม่ตัดยอด
                    </div>
                  </div>
                </div>

                {/* 2. WITHDRAW SIDE (ORANGE) */}
                <div className="border-3 border-orange-500 rounded-3xl p-3 sm:p-3.5 bg-gradient-to-b from-orange-50/90 to-orange-100/30 flex flex-col items-center shadow-sm relative overflow-hidden">
                  
                  {/* Huge Bold Title Banner */}
                  <div className="w-full bg-orange-600 text-white py-1.5 px-2 rounded-xl text-center shadow-xs mb-1.5 flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1 font-black text-xs sm:text-sm tracking-wide">
                      <PackageMinus className="h-4 w-4 shrink-0 text-orange-100" />
                      <span>2. สแกนเบิกของ</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-extrabold text-orange-950 bg-white/95 border border-orange-200/90 px-2.5 py-0.5 rounded-full mb-2 shadow-2xs">
                    📦 สำหรับพนักงาน / QC
                  </span>

                  {/* QR Box with High Contrast */}
                  <div className="bg-white p-2.5 rounded-2xl shadow-xs border-2 border-orange-200/80 mb-2">
                    <img
                      src={getQRImageSrc("withdraw", 180)}
                      alt="QR สแกนเบิกของ"
                      className="h-28 w-28 sm:h-36 sm:w-36 mix-blend-multiply"
                    />
                  </div>

                  {/* Role description box */}
                  <div className="w-full bg-white/95 border border-orange-200 rounded-xl p-1.5 sm:p-2 text-center shadow-2xs">
                    <div className="text-[11px] font-black text-orange-950 flex items-center justify-center gap-1">
                      <PackageMinus className="h-3 w-3 text-orange-600" />
                      หยิบของออกจากตู้
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-orange-600 font-bold mt-0.5">
                      ตัดยอดสต็อกทันที
                    </div>
                  </div>
                </div>

              </div>

              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                คลิกปุ่ม <strong className="text-slate-800">&quot;พิมพ์ภาพ QR ป้ายคู่&quot;</strong> ด้านล่างเพื่อพิมพ์แผ่นสติกเกอร์นำไปติดที่หน้าตู้เก็บจริง
              </p>
            </div>
          )}

          {/* TAB: WITHDRAW ONLY */}
          {activeTab === "withdraw" && (
            <div className="flex flex-col items-center text-center">
              
              {/* Massive Header Badge */}
              <div className="w-full bg-gradient-to-r from-orange-600 to-amber-600 text-white py-3 px-4 rounded-2xl shadow-sm mb-2 flex items-center justify-center gap-2">
                <PackageMinus className="h-5 w-5" />
                <span className="font-black text-sm sm:text-base tracking-wide">QR สแกนเบิกของ (WITHDRAW)</span>
              </div>

              <span className="inline-block bg-orange-100 text-orange-900 border border-orange-200 font-extrabold text-xs px-3.5 py-1 rounded-full mb-3">
                👉 สำหรับพนักงาน / ช่าง / QC สแกนเลือกพัสดุและตัดสต็อก
              </span>

              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 mb-0.5">
                {cabinet.name}
              </h3>
              <p className="text-slate-500 text-xs font-semibold flex items-center gap-1 mb-4">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {cabinet.location} • แผนก: {cabinet.departments.join(", ")}
              </p>

              {/* QR Box with Orange Border */}
              <div className="p-4 bg-orange-50/50 border-3 border-orange-400 rounded-3xl mb-4 relative shadow-md">
                <img
                  src={getQRImageSrc("withdraw", 260)}
                  alt="QR สแกนเบิกของ"
                  className="h-44 w-44 sm:h-52 sm:w-52 mx-auto mix-blend-multiply"
                />
              </div>

              <p className="text-slate-700 text-xs font-semibold max-w-sm leading-relaxed mb-4">
                สแกนแผ่น QR นี้ด้วยกล้องโทรศัพท์มือถือ เพื่อเปิดหน้าจอ
                <strong className="text-orange-600 font-black"> &quot;สแกนเบิกของ&quot; </strong> 
                ระบบจะตัดยอดสต็อกในฐานข้อมูลทันทีเมื่อกดยืนยัน
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

          {/* TAB: COUNT ONLY */}
          {activeTab === "count" && (
            <div className="flex flex-col items-center text-center">
              
              {/* Massive Header Badge */}
              <div className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3 px-4 rounded-2xl shadow-sm mb-2 flex items-center justify-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                <span className="font-black text-sm sm:text-base tracking-wide">QR สแกนนับสต็อก (STOCK COUNT)</span>
              </div>

              <span className="inline-block bg-indigo-100 text-indigo-900 border border-indigo-200 font-extrabold text-xs px-3.5 py-1 rounded-full mb-3">
                👉 สำหรับทีม Helper สแกนเพื่อนับและอัปเดตจำนวนจริงบนชั้นวาง
              </span>

              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 mb-0.5">
                {cabinet.name}
              </h3>
              <p className="text-slate-500 text-xs font-semibold flex items-center gap-1 mb-4">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {cabinet.location} • แผนก: {cabinet.departments.join(", ")}
              </p>

              {/* QR Box with Indigo Border */}
              <div className="p-4 bg-indigo-50/50 border-3 border-indigo-400 rounded-3xl mb-4 relative shadow-md">
                <img
                  src={getQRImageSrc("count", 260)}
                  alt="QR สแกนนับสต็อก"
                  className="h-44 w-44 sm:h-52 sm:w-52 mx-auto mix-blend-multiply"
                />
              </div>

              <p className="text-slate-700 text-xs font-semibold max-w-sm leading-relaxed mb-4">
                สแกนแผ่น QR นี้เพื่อเข้าสู่หน้าจอ
                <strong className="text-indigo-600 font-black"> &quot;สแกนนับสต็อก&quot; </strong> 
                สำหรับทีมงาน Helper ตรวจนับจำนวนจริงและอัปเดตยอดคงเหลือ
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

        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <Printer className="h-4 w-4" />
            <span>พิมพ์ภาพ QR ({activeTab === "dual" ? "ป้ายคู่ติดหน้าตู้" : activeTab === "withdraw" ? "สแกนเบิกของ" : "สแกนนับสต็อก"})</span>
          </button>

          <button
            onClick={onClose}
            className="py-3 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
