import React from "react";
import { X, ZoomIn, ExternalLink } from "lucide-react";

interface ImagePreviewModalProps {
  imageUrl: string | null;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export default function ImagePreviewModal({
  imageUrl,
  title,
  subtitle,
  onClose
}: ImagePreviewModalProps) {
  if (!imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-950 flex items-center gap-2">
              <ZoomIn className="h-5 w-5 text-indigo-600" />
              <span>{title}</span>
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Photo Container */}
        <div className="p-4 bg-slate-900 flex items-center justify-center max-h-[70vh] overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-md"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">รูปภาพพัสดุสำหรับอ้างอิงตอนตรวจเช็กสต็อก</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer transition-all text-xs"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
