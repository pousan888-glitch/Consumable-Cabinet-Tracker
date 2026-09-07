export type UserRole = "ADMIN" | "HELPER" | "QC";

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

export interface Consumable {
  id: string;
  cabinetId: string;
  name: string;
  department: string; // The specific department it belongs to
  currentQty: number;
  minThreshold: number; // Alerts when currentQty <= minThreshold
  unit: string; // e.g., "ชิ้น", "กล่อง", "แพ็ค"
  imageUrl: string; // Visual reference for helpers to count correctly
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
}

export interface DepartmentRecord {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt?: any;
  createdBy?: string;
}

export interface QCConsumptionHistory {
  id: string;
  department: string;
  consumedAt: any;
  consumedBy: string;
  items: QCConsumedItem[];
}
