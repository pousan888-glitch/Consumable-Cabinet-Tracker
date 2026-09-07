import React, { useState, useRef } from "react";
import { 
  Upload, 
  Camera, 
  Image as ImageIcon, 
  Link2, 
  Check, 
  Loader2, 
  AlertCircle, 
  Eye, 
  Trash2,
  Sparkles
} from "lucide-react";
import { compressImage, FALLBACK_ITEM_IMAGE } from "../lib/imageUtils";

interface PresetItem {
  key: string;
  label: string;
  url: string;
}

interface ImageUploadInputProps {
  value: string;
  onChange: (newUrl: string) => void;
  label: string;
  helperText?: string;
  presets?: PresetItem[];
  fallbackUrl?: string;
  onPreviewFullImage?: (url: string) => void;
}

export default function ImageUploadInput({
  value,
  onChange,
  label,
  helperText,
  presets = [],
  fallbackUrl = FALLBACK_ITEM_IMAGE,
  onPreviewFullImage
}: ImageUploadInputProps) {
  const [mode, setMode] = useState<"upload" | "presets" | "url">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState(value && !value.startsWith("data:") ? value : "");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection (from camera or file picker)
  const handleFile = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)");
      return;
    }

    setIsProcessing(true);
    try {
      // Auto compress to light, high-quality JPEG Data URL (<80KB)
      const compressedDataUrl = await compressImage(file, 800, 800, 0.82);
      onChange(compressedDataUrl);
    } catch (err: any) {
      setUploadError(err?.message || "ไม่สามารถแปลงรูปภาพได้");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUploadError(null);
    }
  };

  const displayImage = value || fallbackUrl;
  const isCustomUploaded = value?.startsWith("data:");

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
          {label}
        </label>
        {helperText && (
          <span className="text-[11px] text-slate-400 font-medium">
            {helperText}
          </span>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === "upload"
              ? "bg-white text-indigo-700 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span>ถ่ายรูป / อัปโหลด</span>
        </button>

        {presets.length > 0 && (
          <button
            type="button"
            onClick={() => setMode("presets")}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === "presets"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>เลือกจากตัวอย่าง</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === "url"
              ? "bg-white text-indigo-700 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Link2 className="h-3.5 w-3.5" />
          <span>ใส่ลิงก์ URL</span>
        </button>
      </div>

      {/* Active Tab Content */}
      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
        {/* TAB 1: File Upload / Camera */}
        {mode === "upload" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
              isDragging
                ? "border-indigo-500 bg-indigo-50/50"
                : "border-slate-300 hover:border-indigo-400 bg-white"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInputChange}
            />

            {isProcessing ? (
              <div className="flex flex-col items-center py-2">
                <Loader2 className="h-6 w-6 text-indigo-600 animate-spin mb-2" />
                <span className="text-xs font-semibold text-slate-700">กำลังบีบอัดและประมวลผลรูปภาพ...</span>
              </div>
            ) : (
              <>
                <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-2">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="font-bold text-xs text-slate-800 mb-0.5">
                  คลิกเพื่อเลือกไฟล์ หรือ ถ่ายภาพจากมือถือ
                </div>
                <div className="text-[11px] text-slate-400">
                  รองรับ JPG, PNG, WEBP (ระบบจะย่อขนาดให้อัตโนมัติ)
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: Presets Grid */}
        {mode === "presets" && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 mb-2">
              คลิกเลือกรูปภาพตัวอย่างมาตรฐานที่ต้องการ:
            </div>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((preset) => {
                const isSelected = value === preset.url;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      onChange(preset.url);
                      setUploadError(null);
                    }}
                    className={`h-16 rounded-lg overflow-hidden border-2 relative cursor-pointer group transition-all text-left ${
                      isSelected
                        ? "border-indigo-600 shadow-sm ring-2 ring-indigo-500/20"
                        : "border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 text-white text-[9px] font-bold px-1 py-0.5 truncate text-center">
                      {preset.label}
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 h-4 w-4 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: Direct URL */}
        {mode === "url" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="วางลิงก์รูปภาพ เช่น https://images.unsplash.com/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="button"
                onClick={handleUrlSubmit}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer transition-all shrink-0"
              >
                นำมาใช้
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              * ต้องเป็นลิงก์รูปภาพสาธารณะที่สามารถเข้าถึงได้โดยตรง
            </p>
          </div>
        )}

        {uploadError && (
          <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] font-medium flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Current Preview Banner */}
      {value && (
        <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="h-14 w-14 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0 relative group">
            <img
              src={displayImage}
              alt="Preview"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {onPreviewFullImage && (
              <button
                type="button"
                onClick={() => onPreviewFullImage(displayImage)}
                className="absolute inset-0 bg-slate-950/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                title="คลิกเพื่อขยายภาพ"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                {isCustomUploaded ? "รูปถ่ายจริง / กำหนดเอง" : "รูปตัวอย่างมาตรฐาน"}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800 truncate">
              พร้อมใช้งานสำหรับการตรวจนับของ Helper
            </p>
          </div>

          <div className="flex items-center gap-1">
            {onPreviewFullImage && (
              <button
                type="button"
                onClick={() => onPreviewFullImage(displayImage)}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                title="ดูขนาดใหญ่"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onChange("");
                setUrlInput("");
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
              title="ลบรูปภาพนี้"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
