/**
 * Image processing utilities for client-side image compression,
 * file uploading, and reliable fallbacks.
 */

// Compress user-uploaded image to safe lightweight JPEG data URL
export function compressImage(
  file: File,
  maxWidth = 720,
  maxHeight = 720,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      reject(new Error("ไฟล์ที่เลือกไม่ใช่ไฟล์รูปภาพ"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("เกิดข้อผิดพลาดในการอ่านไฟล์"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("ไม่สามารถเปิดไฟล์รูปภาพได้"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new aspect-ratio-preserved dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("ไม่สามารถประมวลผลรูปภาพได้"));
          return;
        }

        // Draw image smoothly onto canvas
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to lightweight JPEG data URL
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Fallback SVG image data URL when any image fails to load
export const FALLBACK_ITEM_IMAGE = 
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f1f5f9'/%3E%3Cpath d='M100 70 L140 90 L140 130 L100 150 L60 130 L60 90 Z' fill='none' stroke='%2394a3b8' stroke-width='6' stroke-linejoin='round'/%3E%3Cpath d='M100 70 L100 110 L60 90 M100 110 L140 90' fill='none' stroke='%2394a3b8' stroke-width='6' stroke-linejoin='round'/%3E%3Ctext x='100' y='175' font-family='sans-serif' font-size='14' font-weight='bold' fill='%2364748b' text-anchor='middle'%3Eพัสดุโรงงาน%3C/text%3E%3C/svg%3E";

export const FALLBACK_CABINET_IMAGE = 
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23e2e8f0'/%3E%3Crect x='60' y='30' width='180' height='140' rx='8' fill='%23334155'/%3E%3Cline x1='150' y1='30' x2='150' y2='170' stroke='%23475569' stroke-width='3'/%3E%3Ccircle cx='138' cy='100' r='5' fill='%2394a3b8'/%3E%3Ccircle cx='162' cy='100' r='5' fill='%2394a3b8'/%3E%3Ctext x='150' y='188' font-family='sans-serif' font-size='12' font-weight='bold' fill='%2364748b' text-anchor='middle'%3Eตู้เก็บพัสดุ%3C/text%3E%3C/svg%3E";
