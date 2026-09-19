export type UserRole = "ADMIN" | "HELPER" | "QC" | "VIEWER";

export interface UserProfile {
  email: string;
  name: string;
  role: UserRole;
  isSuperAdmin?: boolean;
  isSimulation?: boolean;
}

export interface AppUserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isSuperAdmin?: boolean;
  profileCompleted?: boolean;
  assignedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Cabinet {
  id: string;
  name: string;
  location: string;
  departments: string[]; // Cabinet can hold consumables for 2-3 departments
  photoUrl: string; // Cabinet visual reference
  createdAt: any;
}

export interface MasterConsumable {
  id: string;
  code?: string; // รหัสพัสดุกลาง เช่น MAT-001
  name: string; // ชื่อพัสดุมาตรฐาน
  category: string; // หมวดหมู่ เช่น บรรจุภัณฑ์, PPE, ซ่อมบำรุง
  unit: string; // หน่วยนับมาตรฐาน เช่น ชิ้น, ม้วน, กล่อง
  imageUrl: string; // รูปภาพอ้างอิงมาตรฐาน
  defaultMinThreshold?: number; // เกณฑ์เตือนขั้นต่ำแนะนำ
  defaultMaxThreshold?: number; // สต็อกสูงสุดแนะนำ
  description?: string; // รายละเอียดเพิ่มเติม / สเปก
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
}

export interface Consumable {
  id: string;
  cabinetId: string;
  masterId?: string; // Reference to MasterConsumable if cloned from catalog
  name: string;
  department: string; // The specific department it belongs to
  currentQty: number;
  minThreshold: number; // Minimum safety stock threshold (Alerts when currentQty <= minThreshold)
  maxThreshold?: number; // Maximum target stock threshold / capacity limit
  unit: string; // e.g., "ชิ้น", "กล่อง", "แพ็ค"
  imageUrl: string; // Visual reference for helpers to count correctly
  notes?: string; // Optional remarks or aggregation details
  lastUpdated: any;
  lastUpdatedBy: string;
}

export interface CountItemLog {
  consumableId: string;
  name: string;
  prevQty: number;
  newQty: number;
  unit: string;
  department: string;
}

export interface CountHistory {
  id: string;
  cabinetId: string;
  cabinetName: string;
  checkedAt: any;
  checkedBy: string;
  items: CountItemLog[];
}

export interface QCConsumedItem {
  consumableId: string;
  name: string;
  qtyTaken: number;
  unit: string;
  cabinetId: string;
  cabinetName: string;
  imageUrl?: string;
}

export interface DepartmentRecord {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt?: any;
  createdBy?: string;
}

export type ConsumptionSource = "QC" | "CABINET_QR" | "HELPER" | "DIRECT";

export interface QCConsumptionHistory {
  id: string;
  department: string;
  consumedAt: any;
  consumedBy: string;
  items: QCConsumedItem[];
  source?: ConsumptionSource;
  cabinetId?: string;
  cabinetName?: string;
  note?: string;
}
