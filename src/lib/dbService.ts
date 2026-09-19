import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  writeBatch,
  isOfflineFallback
} from "./firebase";
import { Cabinet, Consumable, MasterConsumable, CountHistory, QCConsumptionHistory, AppUserRecord, UserRole, DepartmentRecord } from "../types";

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Standard image presets (tested and reliable)
export const CABINET_PRESETS = [
  "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=400", // metal locker cabinet
  "https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&q=80&w=400", // storage shelves
  "https://images.unsplash.com/photo-1540638349517-3abd5afc5847?auto=format&fit=crop&q=80&w=400", // blue industrial box
  "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&q=80&w=400"  // workshop metal cabinet
];

export const CONSUMABLE_PRESETS: Record<string, string> = {
  "glove": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400", // nitrile gloves
  "mask": "https://images.unsplash.com/photo-1586942593568-29361efcd571?auto=format&fit=crop&q=80&w=400",  // 3-ply mask
  "alcohol": "https://images.unsplash.com/photo-1584483766114-2cea6facdf57?auto=format&fit=crop&q=80&w=400", // alcohol sanitizer spray
  "tape": "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=400",    // industrial tape
  "paper": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&q=80&w=400",   // industrial wipes
  "grease": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400",  // lubricant / grease
  "goggles": "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&q=80&w=400", // safety goggles
  "tubes": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&q=80&w=400"    // lab test tubes / bottles
};

// Local storage helper functions for offline/demo fallback
const getLocal = <T>(key: string): T[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setLocal = <T>(key: string, data: T[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
};

// Deeply search an object to convert serialized `{ seconds, nanoseconds }` back to real Firestore Timestamps
function convertToTimestamps<T>(obj: any): T {
  if (!obj) return obj;
  if (typeof obj !== "object") return obj;

  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in newObj) {
    const val = newObj[key];
    if (val && typeof val === "object") {
      if (val.seconds !== undefined) {
        newObj[key] = Timestamp.fromMillis(val.seconds * 1000);
      } else {
        newObj[key] = convertToTimestamps(val);
      }
    }
  }
  return newObj as T;
}

// Persistent tombstones to prevent deleted items from resurrecting/reappearing upon sync
const DELETED_CONSUMABLES_KEY = "cabinet_deleted_consumables_tombstone";
const DELETED_CABINETS_KEY = "cabinet_deleted_cabinets_tombstone";
const DATABASE_SEEDED_KEY = "cabinet_database_seeded_flag";

export const getDeletedConsumableIds = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_CONSUMABLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed as any[]).flat(Infinity).map(x => String(x).trim()).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
};

export const recordDeletedConsumableId = (id: string) => {
  if (!id || typeof window === "undefined") return;
  const current = getDeletedConsumableIds();
  if (!current.includes(id)) {
    current.push(id);
    localStorage.setItem(DELETED_CONSUMABLES_KEY, JSON.stringify(current));
  }
};

export const unrecordDeletedConsumableId = (id: string) => {
  if (!id || typeof window === "undefined") return;
  const current = getDeletedConsumableIds().filter(x => x !== id);
  localStorage.setItem(DELETED_CONSUMABLES_KEY, JSON.stringify(current));
};

export const getDeletedCabinetIds = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_CABINETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed as any[]).flat(Infinity).map(x => String(x).trim()).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
};

export const recordDeletedCabinetId = (id: string) => {
  if (!id || typeof window === "undefined") return;
  const current = getDeletedCabinetIds();
  if (!current.includes(id)) {
    current.push(id);
    localStorage.setItem(DELETED_CABINETS_KEY, JSON.stringify(current));
  }
};

export const unrecordDeletedCabinetId = (id: string) => {
  if (!id || typeof window === "undefined") return;
  const current = getDeletedCabinetIds().filter(x => x !== id);
  localStorage.setItem(DELETED_CABINETS_KEY, JSON.stringify(current));
};

// Sync deletion tombstones with Cloud Firestore so deletions are shared across all devices and never bounce back
export async function syncCloudTombstones(): Promise<{ deletedCabIds: string[]; deletedConsIds: string[] }> {
  const localCabIds = getDeletedCabinetIds();
  const localConsIds = getDeletedConsumableIds();

  if (isOfflineFallback) {
    return { deletedCabIds: localCabIds, deletedConsIds: localConsIds };
  }

  try {
    const tombSnap = await withTimeout(getDocs(collection(db, "_tombstones")), 3500);
    const cloudCabIds: string[] = [];
    const cloudConsIds: string[] = [];

    tombSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const type = data?.type;
      const targetId = docSnap.id;
      if (type === "cabinet" || targetId.startsWith("cab-")) {
        cloudCabIds.push(targetId);
      } else if (type === "consumable" || targetId.startsWith("con-")) {
        cloudConsIds.push(targetId);
      }
    });

    // Merge cloud tombstones into local
    cloudCabIds.forEach(id => recordDeletedCabinetId(id));
    cloudConsIds.forEach(id => recordDeletedConsumableId(id));

    // Upload local tombstones to cloud if missing
    for (const id of localCabIds) {
      if (!cloudCabIds.includes(id)) {
        setDoc(doc(db, "_tombstones", id), {
          type: "cabinet",
          deletedAt: Timestamp.now()
        }).catch(() => {});
      }
    }
    for (const id of localConsIds) {
      if (!cloudConsIds.includes(id)) {
        setDoc(doc(db, "_tombstones", id), {
          type: "consumable",
          deletedAt: Timestamp.now()
        }).catch(() => {});
      }
    }

    return {
      deletedCabIds: getDeletedCabinetIds(),
      deletedConsIds: getDeletedConsumableIds()
    };
  } catch {
    return { deletedCabIds: localCabIds, deletedConsIds: localConsIds };
  }
}

const getLocalCabinets = (): Cabinet[] => {
  const deletedCabIds = getDeletedCabinetIds();
  const list = getLocal<any>("local_cabinets");
  return list
    .map(item => convertToTimestamps<Cabinet>(item))
    .filter(item => !deletedCabIds.includes(item.id));
};

const getLocalConsumables = (): Consumable[] => {
  const deletedIds = getDeletedConsumableIds();
  const deletedCabIds = getDeletedCabinetIds();
  const list = getLocal<any>("local_consumables");
  return list
    .map(item => convertToTimestamps<Consumable>(item))
    .filter(item => !deletedIds.includes(item.id) && !deletedCabIds.includes(item.cabinetId));
};

const getLocalCountHistory = (): CountHistory[] => {
  const list = getLocal<any>("local_count_history");
  return list.map(item => convertToTimestamps<CountHistory>(item));
};

const getLocalQCConsumptionHistory = (): QCConsumptionHistory[] => {
  const list = getLocal<any>("local_qc_consumption_history");
  return list.map(item => convertToTimestamps<QCConsumptionHistory>(item));
};

const getLocalUsers = (): AppUserRecord[] => {
  const list = getLocal<any>("local_users");
  return list.map(item => convertToTimestamps<AppUserRecord>(item));
};

export const DEFAULT_DEPARTMENTS: DepartmentRecord[] = [
  { id: "dept-cmt", name: "CMT", description: "ฝ่าย CMT", color: "#10b981" },
  { id: "dept-dnm", name: "DNM", description: "ฝ่าย DNM", color: "#4f46e5" },
  { id: "dept-wl", name: "WL", description: "ฝ่าย WL", color: "#06b6d4" },
  { id: "dept-sbs", name: "SBS", description: "ฝ่าย SBS", color: "#f59e0b" },
  { id: "dept-qc", name: "QC", description: "ฝ่ายควบคุมและตรวจสอบคุณภาพ (QC)", color: "#9333ea" }
];

const DELETED_DEPARTMENTS_KEY = "deleted_department_ids";
export const getDeletedDepartmentIds = (): string[] => {
  return getLocal<string>(DELETED_DEPARTMENTS_KEY) || [];
};
export const addDeletedDepartmentId = (id: string): void => {
  const current = getDeletedDepartmentIds();
  if (!current.includes(id)) {
    setLocal(DELETED_DEPARTMENTS_KEY, [...current, id]);
  }
};

export const getLocalDepartments = (): DepartmentRecord[] => {
  const deletedIds = getDeletedDepartmentIds();
  let list = getLocal<any>("local_departments");
  if (!list || list.length === 0) {
    setLocal("local_departments", DEFAULT_DEPARTMENTS);
    list = DEFAULT_DEPARTMENTS;
  }
  // Filter out any departments that were deleted or named "Production"
  return list
    .map(item => convertToTimestamps<DepartmentRecord>(item))
    .filter(d => !deletedIds.includes(d.id) && d.name?.toLowerCase() !== "production");
};

// Global Cloud Sync Status tracking to inform the user if Firestore Rules need attention
let cloudSyncNotice: { hasError: boolean; code?: string; message?: string } = { hasError: false };

export function getCloudSyncNotice() {
  return cloudSyncNotice;
}

export function resetCloudSyncNotice() {
  cloudSyncNotice = { hasError: false };
}

function recordCloudError(err: any) {
  const code = err?.code || "";
  const msg = err?.message || "";
  console.warn("[Cloud Firestore Sync Alert]:", code, msg);
  if (code === "permission-denied" || code.includes("permission")) {
    cloudSyncNotice = {
      hasError: true,
      code: "permission-denied",
      message: "Firestore Security Rules ใน Firebase Console ปฏิเสธการเขียน/อ่าน (Permission Denied)"
    };
  } else if (code === "unavailable" || code.includes("unavailable")) {
    cloudSyncNotice = {
      hasError: true,
      code: "unavailable",
      message: "ไม่สามารถเชื่อมต่อไปยัง Cloud Firestore ได้ในขณะนี้ กำลังทำงานด้วยข้อมูลในเครื่อง"
    };
  }
}

// Race promise with timeout so Firestore operations don't hang if network is blocked
function withTimeout<T>(promise: Promise<T>, ms = 4500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Firestore operation timed out")), ms))
  ]);
}

// Push all local items to Cloud Firestore and verify connection
export async function testAndSyncAllToCloud(): Promise<{
  success: boolean;
  code?: string;
  message: string;
  syncedCabinets: number;
  syncedConsumables: number;
}> {
  if (isOfflineFallback) {
    return {
      success: false,
      code: "offline-mode",
      message: "ระบบกำลังทำงานในโหมด Offline จำลอง",
      syncedCabinets: 0,
      syncedConsumables: 0
    };
  }

  try {
    // 1. Test ping to check Firestore Rules permission
    const pingId = "ping-" + generateId();
    await withTimeout(
      setDoc(doc(db, "_sync_test", pingId), {
        testAt: Timestamp.now(),
        author: "admin"
      }),
      4000
    );
    // clean up ping
    await deleteDoc(doc(db, "_sync_test", pingId)).catch(() => {});

    // 2. Permission is GRANTED! Now push all local items up to Cloud Firestore
    const localCabs = getLocalCabinets();
    const localCons = getLocalConsumables();
    const localCount = getLocalCountHistory();
    const localQC = getLocalQCConsumptionHistory();
    const localUsers = getLocalUsers();
    const localDepts = getLocalDepartments();
    const localMasters = getLocalMasterConsumables();

    const batch = writeBatch(db);

    // Also purge any deleted tombstones from Cloud
    const deletedConsIds = getDeletedConsumableIds();
    const deletedCabIds = getDeletedCabinetIds();
    const deletedMasterIds = getDeletedMasterConsumableIds();
    for (const delId of deletedConsIds) {
      batch.delete(doc(db, "consumables", delId));
    }
    for (const delCabId of deletedCabIds) {
      batch.delete(doc(db, "cabinets", delCabId));
    }
    for (const delMId of deletedMasterIds) {
      batch.delete(doc(db, "master_consumables", delMId));
    }

    for (const cab of localCabs) {
      batch.set(doc(db, "cabinets", cab.id), cab);
    }
    for (const con of localCons) {
      batch.set(doc(db, "consumables", con.id), con);
    }
    for (const master of localMasters) {
      batch.set(doc(db, "master_consumables", master.id), master);
    }
    for (const log of localCount) {
      batch.set(doc(db, "count_history", log.id), log);
    }
    for (const qc of localQC) {
      batch.set(doc(db, "qc_consumption_history", qc.id), qc);
    }
    for (const usr of localUsers) {
      batch.set(doc(db, "users", usr.id), usr);
    }
    for (const dept of localDepts) {
      batch.set(doc(db, "departments", dept.id), dept);
    }

    await batch.commit();

    // 3. Reset error state
    cloudSyncNotice = { hasError: false };

    return {
      success: true,
      message: `ซิงค์ข้อมูลขึ้น Cloud Firestore สำเร็จแล้ว (${localCabs.length} ตู้, ${localCons.length} พัสดุ, ${localMasters.length} แคตตาล็อกกลาง) ทุกเครื่องและมือถือจะมองเห็นข้อมูลตรงกันทันที!`,
      syncedCabinets: localCabs.length,
      syncedConsumables: localCons.length
    };
  } catch (err: any) {
    recordCloudError(err);
    const code = err?.code || "";
    if (code === "permission-denied" || code.includes("permission")) {
      return {
        success: false,
        code: "permission-denied",
        message: "ยังติดสิทธิ์ Permission Denied: กรุณาเข้าไปที่ Firebase Console > Firestore Database > Rules และตั้งค่าให้อนุญาต (allow read, write: if true;) แล้วกด Publish ก่อนกดปุ่มนี้อีกครั้ง",
        syncedCabinets: 0,
        syncedConsumables: 0
      };
    }
    return {
      success: false,
      code: "error",
      message: err?.message || "ไม่สามารถเชื่อมต่อ Cloud Firestore ได้",
      syncedCabinets: 0,
      syncedConsumables: 0
    };
  }
}

// Seed initial data if database is empty (Handles both Cloud Firestore and local fallback)
export async function seedDatabaseIfEmpty() {
  const isAlreadySeeded = localStorage.getItem(DATABASE_SEEDED_KEY) === "true";
  if (isAlreadySeeded) {
    return false;
  }

  // Check and sync cloud tombstones first
  try {
    await syncCloudTombstones();
  } catch {
    // Non-blocking
  }

  const deletedCons = getDeletedConsumableIds();
  const deletedCabs = getDeletedCabinetIds();
  if (deletedCons.length > 0 || deletedCabs.length > 0) {
    localStorage.setItem(DATABASE_SEEDED_KEY, "true");
    return false;
  }

  if (isOfflineFallback) {
    const existingCabs = getLocalCabinets();
    if (existingCabs.length > 0) {
      console.log("[Offline Mode]: Database already has data. Skipping seed.");
      localStorage.setItem(DATABASE_SEEDED_KEY, "true");
      return false;
    }

    console.log("[Offline Mode]: Database is empty. Seeding beautiful initial data locally...");
    const cabinet1Id = "cab-001";
    const cabinet2Id = "cab-002";

    const localCabinets: Cabinet[] = [
      {
        id: cabinet1Id,
        name: "ตู้เก็บวัสดุแผนก QC & แล็บ 1",
        location: "ห้องแล็บเคมี ตึก A ชั้น 2",
        departments: ["QC", "CMT"],
        photoUrl: CABINET_PRESETS[0],
        createdAt: Timestamp.now()
      },
      {
        id: cabinet2Id,
        name: "ตู้พัสดุและอะไหล่ซ่อมบำรุงไลน์ 3",
        location: "ไลน์การผลิต 3 หลังเครื่องปั๊ม",
        departments: ["CMT", "DNM"],
        photoUrl: CABINET_PRESETS[1],
        createdAt: Timestamp.now()
      }
    ];

    const localConsumables: Consumable[] = [
      {
        id: "con-101",
        cabinetId: cabinet1Id,
        name: "ถุงมือยางไนไตรสีฟ้า (Size M)",
        department: "QC",
        currentQty: 12,
        minThreshold: 5,
        maxThreshold: 50,
        unit: "กล่อง",
        imageUrl: CONSUMABLE_PRESETS["glove"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-102",
        cabinetId: cabinet1Id,
        name: "หน้ากากอนามัย 3 ชั้นกันฝุ่น",
        department: "CMT",
        currentQty: 2, // Low stock
        minThreshold: 4,
        maxThreshold: 30,
        unit: "กล่อง",
        imageUrl: CONSUMABLE_PRESETS["mask"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-103",
        cabinetId: cabinet1Id,
        name: "แอลกอฮอล์ฆ่าเชื้อชนิดแผ่น 70%",
        department: "QC",
        currentQty: 15,
        minThreshold: 10,
        maxThreshold: 60,
        unit: "แพ็ค",
        imageUrl: CONSUMABLE_PRESETS["alcohol"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-201",
        cabinetId: cabinet2Id,
        name: "เทปพันเกลียวท่อประปาเหนียวพิเศษ",
        department: "DNM",
        currentQty: 3, // Low stock
        minThreshold: 8,
        maxThreshold: 40,
        unit: "ม้วน",
        imageUrl: CONSUMABLE_PRESETS["tape"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-202",
        cabinetId: cabinet2Id,
        name: "จาระบีหล่อลื่นทนความร้อนสูง",
        department: "DNM",
        currentQty: 6,
        minThreshold: 3,
        maxThreshold: 20,
        unit: "กระป๋อง",
        imageUrl: CONSUMABLE_PRESETS["grease"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-203",
        cabinetId: cabinet2Id,
        name: "กระดาษทิชชู่ม้วนใหญ่อุตสาหกรรม",
        department: "CMT",
        currentQty: 20,
        minThreshold: 8,
        maxThreshold: 50,
        unit: "ม้วน",
        imageUrl: CONSUMABLE_PRESETS["paper"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      }
    ];

    const initialHistory: CountHistory = {
      id: "log-001",
      cabinetId: cabinet1Id,
      cabinetName: "ตู้เก็บวัสดุแผนก QC & แล็บ 1",
      checkedAt: Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      checkedBy: "pousan888@gmail.com",
      items: [
        {
          consumableId: "con-101",
          name: "ถุงมือยางไนไตรสีฟ้า (Size M)",
          prevQty: 15,
          newQty: 12,
          unit: "กล่อง",
          department: "QC"
        },
        {
          consumableId: "con-102",
          name: "หน้ากากอนามัย 3 ชั้นกันฝุ่น",
          prevQty: 5,
          newQty: 2,
          unit: "กล่อง",
          department: "CMT"
        },
        {
          consumableId: "con-103",
          name: "แอลกอฮอล์ฆ่าเชื้อชนิดแผ่น 70%",
          prevQty: 18,
          newQty: 15,
          unit: "แพ็ค",
          department: "QC"
        }
      ]
    };

    setLocal("local_cabinets", localCabinets);
    setLocal("local_consumables", localConsumables);
    setLocal("local_count_history", [initialHistory]);
    setLocal("local_qc_consumption_history", []);
    localStorage.setItem(DATABASE_SEEDED_KEY, "true");
    return true;
  }

  // standard Cloud Firestore seeding
  try {
    const cabinetSnap = await getDocs(collection(db, "cabinets"));
    const tombSnap = await getDocs(collection(db, "_tombstones")).catch(() => null);
    if (!cabinetSnap.empty || (tombSnap && !tombSnap.empty)) {
      console.log("Database already has data or tombstones. Skipping seed.");
      localStorage.setItem(DATABASE_SEEDED_KEY, "true");
      return false;
    }

    console.log("Database is empty. Seeding beautiful initial data to Cloud...");
    const batch = writeBatch(db);

    const cabinet1Id = "cab-001";
    const cabinet2Id = "cab-002";

    const cabinet1: Cabinet = {
      id: cabinet1Id,
      name: "ตู้เก็บวัสดุแผนก QC & แล็บ 1",
      location: "ห้องแล็บเคมี ตึก A ชั้น 2",
      departments: ["QC", "CMT"],
      photoUrl: CABINET_PRESETS[0],
      createdAt: Timestamp.now()
    };

    const cabinet2: Cabinet = {
      id: cabinet2Id,
      name: "ตู้พัสดุและอะไหล่ซ่อมบำรุงไลน์ 3",
      location: "ไลน์การผลิต 3 หลังเครื่องปั๊ม",
      departments: ["CMT", "DNM"],
      photoUrl: CABINET_PRESETS[1],
      createdAt: Timestamp.now()
    };

    batch.set(doc(db, "cabinets", cabinet1Id), cabinet1);
    batch.set(doc(db, "cabinets", cabinet2Id), cabinet2);

    const consumables1: Consumable[] = [
      {
        id: "con-101",
        cabinetId: cabinet1Id,
        name: "ถุงมือยางไนไตรสีฟ้า (Size M)",
        department: "QC",
        currentQty: 12,
        minThreshold: 5,
        maxThreshold: 50,
        unit: "กล่อง",
        imageUrl: CONSUMABLE_PRESETS["glove"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-102",
        cabinetId: cabinet1Id,
        name: "หน้ากากอนามัย 3 ชั้นกันฝุ่น",
        department: "CMT",
        currentQty: 2,
        minThreshold: 4,
        maxThreshold: 30,
        unit: "กล่อง",
        imageUrl: CONSUMABLE_PRESETS["mask"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-103",
        cabinetId: cabinet1Id,
        name: "แอลกอฮอล์ฆ่าเชื้อชนิดแผ่น 70%",
        department: "QC",
        currentQty: 15,
        minThreshold: 10,
        maxThreshold: 60,
        unit: "แพ็ค",
        imageUrl: CONSUMABLE_PRESETS["alcohol"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      }
    ];

    const consumables2: Consumable[] = [
      {
        id: "con-201",
        cabinetId: cabinet2Id,
        name: "เทปพันเกลียวท่อประปาเหนียวพิเศษ",
        department: "DNM",
        currentQty: 3,
        minThreshold: 8,
        maxThreshold: 40,
        unit: "ม้วน",
        imageUrl: CONSUMABLE_PRESETS["tape"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-202",
        cabinetId: cabinet2Id,
        name: "จาระบีหล่อลื่นทนความร้อนสูง",
        department: "DNM",
        currentQty: 6,
        minThreshold: 3,
        maxThreshold: 20,
        unit: "กระป๋อง",
        imageUrl: CONSUMABLE_PRESETS["grease"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-203",
        cabinetId: cabinet2Id,
        name: "กระดาษทิชชู่ม้วนใหญ่อุตสาหกรรม",
        department: "CMT",
        currentQty: 20,
        minThreshold: 8,
        maxThreshold: 50,
        unit: "ม้วน",
        imageUrl: CONSUMABLE_PRESETS["paper"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      }
    ];

    consumables1.forEach(c => batch.set(doc(db, "consumables", c.id), c));
    consumables2.forEach(c => batch.set(doc(db, "consumables", c.id), c));
    localStorage.setItem(DATABASE_SEEDED_KEY, "true");

    const historyId = "log-001";
    const initialHistory: CountHistory = {
      id: historyId,
      cabinetId: cabinet1Id,
      cabinetName: cabinet1.name,
      checkedAt: Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000),
      checkedBy: "pousan888@gmail.com",
      items: [
        {
          consumableId: "con-101",
          name: "ถุงมือยางไนไตรสีฟ้า (Size M)",
          prevQty: 15,
          newQty: 12,
          unit: "กล่อง",
          department: "QC"
        },
        {
          consumableId: "con-102",
          name: "หน้ากากอนามัย 3 ชั้นกันฝุ่น",
          prevQty: 5,
          newQty: 2,
          unit: "กล่อง",
          department: "CMT"
        },
        {
          consumableId: "con-103",
          name: "แอลกอฮอล์ฆ่าเชื้อชนิดแผ่น 70%",
          prevQty: 18,
          newQty: 15,
          unit: "แพ็ค",
          department: "QC"
        }
      ]
    };

    batch.set(doc(db, "count_history", historyId), initialHistory);
    await batch.commit();
    console.log("Cloud Database seeded successfully!");
    return true;
  } catch (err) {
    console.error("Error seeding database:", err);
    return false;
  }
}

// Fetch all cabinets (Fault-Tolerant & Local-First Resilient with Cloud Tombstone Shield)
export async function getCabinets(): Promise<Cabinet[]> {
  // 1. Sync tombstones from Cloud so all browsers/devices know what was deleted
  try {
    await syncCloudTombstones();
  } catch {
    // Non-blocking
  }

  const deletedCabIds = getDeletedCabinetIds();
  const localList = getLocalCabinets(); // Already filtered by tombstone

  if (isOfflineFallback) {
    return localList;
  }

  try {
    // Use simple collection query to avoid missing documents if createdAt is not indexed
    const snap = await withTimeout(
      getDocs(collection(db, "cabinets")),
      4000
    );

    // Clean up any cloud docs that were deleted locally or in tombstones
    for (const d of snap.docs) {
      if (deletedCabIds.includes(d.id)) {
        deleteDoc(d.ref).catch(() => {});
      }
    }

    const cloudList = snap.docs
      .filter(doc => !deletedCabIds.includes(doc.id))
      .map(doc => ({ id: doc.id, ...doc.data() } as Cabinet));
    
    // Sort in memory by createdAt descending
    cloudList.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    // Cloud connection is healthy!
    cloudSyncNotice = { hasError: false };

    // Auto-sync: If local storage has cabinets that aren't on Cloud yet, upload them (ONLY IF NOT IN TOMBSTONES!)
    for (const loc of localList) {
      if (!cloudList.some(c => c.id === loc.id) && !deletedCabIds.includes(loc.id)) {
        setDoc(doc(db, "cabinets", loc.id), loc).catch(e => console.warn("Auto-sync cabinet to cloud:", e));
      }
    }

    // Merge and deduplicate by ID, strictly filtering out any tombstoned IDs
    const cabinetMap = new Map<string, Cabinet>();
    cloudList.forEach(c => {
      if (!deletedCabIds.includes(c.id)) {
        cabinetMap.set(c.id, c);
      }
    });
    localList.forEach(loc => {
      if (!deletedCabIds.includes(loc.id) && !cabinetMap.has(loc.id)) {
        cabinetMap.set(loc.id, loc);
      }
    });

    const combined = Array.from(cabinetMap.values());
    combined.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    setLocal("local_cabinets", combined);
    return combined;
  } catch (err) {
    recordCloudError(err);
    console.warn("Could not fetch cabinets from Cloud, serving from local cache:", err);
    return localList;
  }
}

// Add Cabinet (Always persists locally first, then syncs to Cloud Firestore)
export async function addCabinet(cabinet: Omit<Cabinet, "id" | "createdAt">): Promise<string> {
  const id = "cab-" + generateId();
  unrecordDeletedCabinetId(id);

  const newCabinet: Cabinet = {
    ...cabinet,
    id,
    createdAt: Timestamp.now()
  };

  // 1. Immediately save to LocalStorage so the user NEVER loses their cabinet!
  const list = getLocal<any>("local_cabinets") || [];
  list.unshift(newCabinet);
  setLocal("local_cabinets", list);

  // 2. If in offline fallback, return immediately
  if (isOfflineFallback) {
    return id;
  }

  // 3. Attempt to save to Cloud Firestore without blocking the UI if it errors
  try {
    await setDoc(doc(db, "cabinets", id), newCabinet);
    console.log("Cabinet successfully synced to Cloud Firestore:", id);
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: Cabinet saved to local storage, Cloud Firestore sync deferred:", err);
  }

  return id;
}

// Update Cabinet (Fault-Tolerant)
export async function updateCabinet(id: string, updates: Partial<Cabinet>): Promise<void> {
  // 1. Update in local storage
  const list = getLocal<any>("local_cabinets") || [];
  const index = list.findIndex((c: any) => c.id === id);
  if (index !== -1) {
    list[index] = { ...list[index], ...updates };
    setLocal("local_cabinets", list);
  }

  if (isOfflineFallback) return;

  // 2. Update in Cloud Firestore
  try {
    await updateDoc(doc(db, "cabinets", id), updates);
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: Cabinet updated in local storage, Cloud sync deferred:", err);
  }
}

// Delete Cabinet and its consumables (Fault-Tolerant & Permanent Cloud Tombstone)
export async function deleteCabinet(id: string): Promise<void> {
  // 1. Record in permanent local tombstone blacklist
  recordDeletedCabinetId(id);

  const allConsumables = getLocal<any>("local_consumables") || [];
  const itemsInCabinet = allConsumables.filter((c: any) => c.cabinetId === id);
  itemsInCabinet.forEach((c: any) => recordDeletedConsumableId(c.id));

  // 2. Delete locally immediately so UI is 100% clean
  const list = getLocal<any>("local_cabinets") || [];
  const updated = list.filter((c: any) => c.id !== id);
  setLocal("local_cabinets", updated);

  const remainingConsumables = allConsumables.filter((c: any) => c.cabinetId !== id);
  setLocal("local_consumables", remainingConsumables);

  if (isOfflineFallback) return;

  // 3. Record in Cloud Firestore Tombstones so no other device will ever resurrect or auto-sync it
  setDoc(doc(db, "_tombstones", id), {
    type: "cabinet",
    id,
    deletedAt: Timestamp.now()
  }).catch(() => {});

  // 4. Delete from Cloud Firestore
  try {
    await deleteDoc(doc(db, "cabinets", id));
    
    // Find any remaining consumables in this cabinet on Cloud and delete them
    try {
      const consumablesSnap = await getDocs(query(collection(db, "consumables"), where("cabinetId", "==", id)));
      if (!consumablesSnap.empty) {
        for (const d of consumablesSnap.docs) {
          recordDeletedConsumableId(d.id);
          deleteDoc(d.ref).catch(() => {});
          setDoc(doc(db, "_tombstones", d.id), {
            type: "consumable",
            id: d.id,
            cabinetId: id,
            deletedAt: Timestamp.now()
          }).catch(() => {});
        }
      }
    } catch {
      // Non-blocking
    }
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: Cabinet deleted from local storage, Cloud sync deferred:", err);
  }
}

// Fetch consumables (Fault-Tolerant with Tombstone Shield)
export async function getConsumables(cabinetId?: string): Promise<Consumable[]> {
  const deletedIds = getDeletedConsumableIds();
  const deletedCabIds = getDeletedCabinetIds();
  const localList = getLocalConsumables(); // Already filtered by tombstones

  if (isOfflineFallback) {
    return cabinetId ? localList.filter(c => c.cabinetId === cabinetId) : localList;
  }

  try {
    let q = query(collection(db, "consumables"));
    if (cabinetId) {
      q = query(collection(db, "consumables"), where("cabinetId", "==", cabinetId));
    }
    const snap = await withTimeout(getDocs(q), 4000);

    // Clean up any cloud docs that were deleted by user
    for (const d of snap.docs) {
      if (deletedIds.includes(d.id) || deletedCabIds.includes(d.data().cabinetId)) {
        deleteDoc(d.ref).catch(() => {});
      }
    }

    const cloudList = snap.docs
      .filter(doc => !deletedIds.includes(doc.id) && !deletedCabIds.includes(doc.data().cabinetId))
      .map(doc => ({ id: doc.id, ...doc.data() } as Consumable));

    // Cloud connection is healthy!
    cloudSyncNotice = { hasError: false };

    // Auto-sync: If local items aren't on Cloud yet, upload them (if not deleted!)
    for (const loc of localList) {
      if (!cloudList.some(c => c.id === loc.id) && !deletedIds.includes(loc.id) && !deletedCabIds.includes(loc.cabinetId)) {
        setDoc(doc(db, "consumables", loc.id), loc).catch(e => console.warn("Auto-sync consumable to cloud:", e));
      }
    }

    if (cloudList.length > 0) {
      // Merge with local if needed, strictly rejecting any tombstoned IDs
      const combined = [...cloudList];
      for (const loc of localList) {
        if (!combined.some(c => c.id === loc.id) && !deletedIds.includes(loc.id) && !deletedCabIds.includes(loc.cabinetId)) {
          if (!cabinetId || loc.cabinetId === cabinetId) {
            combined.push(loc);
          }
        }
      }

      // Auto-migrate any legacy "Production" items to CMT (so orphaned/ghost production department never persists)
      for (const item of combined) {
        if (item.department && item.department.toLowerCase() === "production") {
          item.department = "CMT";
          if (!isOfflineFallback) {
            updateDoc(doc(db, "consumables", item.id), { department: "CMT" }).catch(() => {});
          }
        }
      }

      setLocal("local_consumables", combined);
      return cabinetId ? combined.filter(c => c.cabinetId === cabinetId) : combined;
    }

    if (localList.length > 0) {
      for (const loc of localList) {
        if (loc.department && loc.department.toLowerCase() === "production") {
          loc.department = "CMT";
        }
        if (!deletedIds.includes(loc.id) && !deletedCabIds.includes(loc.cabinetId)) {
          setDoc(doc(db, "consumables", loc.id), loc).catch(e => console.warn("Auto-sync initial consumable:", e));
        }
      }
      setLocal("local_consumables", localList);
      return cabinetId ? localList.filter(c => c.cabinetId === cabinetId) : localList;
    }

    return [];
  } catch (err) {
    recordCloudError(err);
    console.warn("Could not fetch consumables from Cloud, serving from local cache:", err);
    return cabinetId ? localList.filter(c => c.cabinetId === cabinetId) : localList;
  }
}

// Add Consumable (Fault-Tolerant)
export async function addConsumable(consumable: Omit<Consumable, "id" | "lastUpdated">): Promise<string> {
  const id = "con-" + generateId();
  unrecordDeletedConsumableId(id);

  const newConsumable: Consumable = {
    ...consumable,
    id,
    lastUpdated: Timestamp.now()
  };

  // 1. Immediately save locally
  const list = getLocal<any>("local_consumables") || [];
  list.push(newConsumable);
  setLocal("local_consumables", list);

  if (isOfflineFallback) return id;

  // 2. Sync to Cloud
  try {
    await setDoc(doc(db, "consumables", id), newConsumable);
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: Consumable saved locally, Cloud sync deferred:", err);
  }

  return id;
}

// Update Consumable (Fault-Tolerant)
export async function updateConsumable(id: string, updates: Partial<Consumable>): Promise<void> {
  // 1. Update locally
  const list = getLocal<any>("local_consumables") || [];
  const index = list.findIndex((c: any) => c.id === id);
  if (index !== -1) {
    list[index] = { 
      ...list[index], 
      ...updates, 
      lastUpdated: Timestamp.now() 
    };
    setLocal("local_consumables", list);
  }

  if (isOfflineFallback) return;

  // 2. Update Cloud
  try {
    await updateDoc(doc(db, "consumables", id), {
      ...updates,
      lastUpdated: Timestamp.now()
    });
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: Consumable updated locally, Cloud sync deferred:", err);
  }
}

// Delete Consumable (Fault-Tolerant & Permanent Cloud Tombstone)
export async function deleteConsumable(id: string): Promise<void> {
  // 1. Immediately mark ID in persistent tombstone blacklist
  recordDeletedConsumableId(id);

  // 2. Remove from local storage immediately
  const list = getLocal<any>("local_consumables") || [];
  const updated = list.filter((c: any) => c.id !== id);
  setLocal("local_consumables", updated);

  if (isOfflineFallback) return;

  // 3. Record in Cloud Firestore Tombstones
  setDoc(doc(db, "_tombstones", id), {
    type: "consumable",
    id,
    deletedAt: Timestamp.now()
  }).catch(() => {});

  // 4. Delete from Cloud Firestore
  try {
    await deleteDoc(doc(db, "consumables", id));
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: Consumable deleted locally, Cloud sync deferred:", err);
  }
}

// Save Count Check History (Fault-Tolerant)
export async function saveCountHistory(
  cabinetId: string, 
  cabinetName: string, 
  checkedBy: string, 
  itemCounts: { consumableId: string; name: string; prevQty: number; newQty: number; unit: string; department: string }[]
): Promise<void> {
  const logId = "log-" + generateId();
  const countLog: CountHistory = {
    id: logId,
    cabinetId,
    cabinetName,
    checkedAt: Timestamp.now(),
    checkedBy,
    items: itemCounts
  };

  // 1. Update local storage immediately
  const historyList = getLocalCountHistory();
  historyList.unshift(countLog);
  setLocal("local_count_history", historyList);

  const consumables = getLocalConsumables();
  itemCounts.forEach(item => {
    const idx = consumables.findIndex(c => c.id === item.consumableId);
    if (idx !== -1) {
      consumables[idx].currentQty = item.newQty;
      consumables[idx].lastUpdated = Timestamp.now();
      consumables[idx].lastUpdatedBy = checkedBy;
    }
  });
  setLocal("local_consumables", consumables);

  if (isOfflineFallback) return;

  // 2. Sync to Cloud
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "count_history", logId), countLog);

    itemCounts.forEach(item => {
      const ref = doc(db, "consumables", item.consumableId);
      batch.update(ref, {
        currentQty: item.newQty,
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: checkedBy
      });
    });

    await batch.commit();
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: Count audit saved locally, Cloud sync deferred:", err);
  }
}

// Save QC / Cabinet Consumption History (Fault-Tolerant)
export async function saveQCConsumption(
  department: string, 
  consumedBy: string, 
  items: { consumableId: string; name: string; qtyTaken: number; unit: string; cabinetId: string; cabinetName: string; imageUrl?: string }[],
  extra?: {
    source?: "QC" | "CABINET_QR" | "HELPER" | "DIRECT";
    cabinetId?: string;
    cabinetName?: string;
    note?: string;
  }
): Promise<void> {
  const logId = (extra?.source === "CABINET_QR" ? "wd-" : "qc-") + generateId();
  const qcLog: QCConsumptionHistory = {
    id: logId,
    department,
    consumedAt: Timestamp.now(),
    consumedBy,
    items,
    source: extra?.source || "QC",
    cabinetId: extra?.cabinetId,
    cabinetName: extra?.cabinetName,
    note: extra?.note
  };

  // 1. Update locally
  const qcList = getLocalQCConsumptionHistory();
  qcList.unshift(qcLog);
  setLocal("local_qc_consumption_history", qcList);

  const consumables = getLocalConsumables();
  items.forEach(item => {
    const idx = consumables.findIndex(c => c.id === item.consumableId);
    if (idx !== -1) {
      const currentQty = consumables[idx].currentQty || 0;
      consumables[idx].currentQty = Math.max(0, currentQty - item.qtyTaken);
      consumables[idx].lastUpdated = Timestamp.now();
      consumables[idx].lastUpdatedBy = consumedBy;
    }
  });
  setLocal("local_consumables", consumables);

  if (isOfflineFallback) return;

  // 2. Sync to Cloud
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "qc_consumption_history", logId), qcLog);

    for (const item of items) {
      const consumableRef = doc(db, "consumables", item.consumableId);
      const docSnap = await getDoc(consumableRef);
      if (docSnap.exists()) {
        const currentQty = docSnap.data().currentQty || 0;
        const newQty = Math.max(0, currentQty - item.qtyTaken);
        batch.update(consumableRef, {
          currentQty: newQty,
          lastUpdated: Timestamp.now(),
          lastUpdatedBy: consumedBy
        });
      }
    }

    await batch.commit();
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: Consumption saved locally, Cloud sync deferred:", err);
  }
}

// Dedicated helper for Cabinet Withdrawals (From QR code or Helper view)
export async function saveCabinetWithdrawal(
  cabinetId: string,
  cabinetName: string,
  department: string,
  withdrawnBy: string,
  items: { consumableId: string; name: string; qtyTaken: number; unit: string; imageUrl?: string }[],
  note?: string,
  source: "CABINET_QR" | "HELPER" | "DIRECT" = "CABINET_QR"
): Promise<void> {
  const formattedItems = items.map(item => ({
    consumableId: item.consumableId,
    name: item.name,
    qtyTaken: item.qtyTaken,
    unit: item.unit,
    cabinetId,
    cabinetName,
    imageUrl: item.imageUrl
  }));

  return saveQCConsumption(department, withdrawnBy, formattedItems, {
    source,
    cabinetId,
    cabinetName,
    note
  });
}

// Fetch Counting History Logs (Fault-Tolerant)
export async function getCountHistory(): Promise<CountHistory[]> {
  const localList = getLocalCountHistory();
  if (isOfflineFallback) return localList;

  try {
    const snap = await withTimeout(
      getDocs(query(collection(db, "count_history"), orderBy("checkedAt", "desc"))),
      4000
    );
    const cloudList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CountHistory));
    if (cloudList.length > 0) {
      setLocal("local_count_history", cloudList);
      return cloudList;
    }
    return localList;
  } catch (err) {
    recordCloudError(err);
    return localList;
  }
}

// Fetch QC Consumption History Logs (Fault-Tolerant)
export async function getQCConsumptionHistory(): Promise<QCConsumptionHistory[]> {
  const localList = getLocalQCConsumptionHistory();
  if (isOfflineFallback) return localList;

  try {
    const snap = await withTimeout(
      getDocs(query(collection(db, "qc_consumption_history"), orderBy("consumedAt", "desc"))),
      4000
    );
    const cloudList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QCConsumptionHistory));
    if (cloudList.length > 0) {
      setLocal("local_qc_consumption_history", cloudList);
      return cloudList;
    }
    return localList;
  } catch (err) {
    recordCloudError(err);
    return localList;
  }
}

// ==========================================
// HISTORY CLEAR & PURGE OPERATIONS
// ==========================================

function parseLogDateMs(val: any): number {
  if (!val) return 0;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (typeof val.toDate === "function") return val.toDate().getTime();
  if (typeof val.seconds === "number") return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

async function deleteFirestoreDocsInChunks(collectionName: string, docIds: string[]): Promise<void> {
  if (isOfflineFallback || docIds.length === 0) return;
  const CHUNK_SIZE = 300;
  for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
    const chunk = docIds.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      chunk.forEach(id => {
        batch.delete(doc(db, collectionName, id));
      });
      await batch.commit();
    } catch (err) {
      recordCloudError(err);
      console.warn(`Notice: Batch delete in ${collectionName} warning:`, err);
    }
  }
}

// Delete a single count log entry
export async function deleteCountHistoryItem(id: string): Promise<void> {
  const list = getLocalCountHistory();
  const updated = list.filter(item => item.id !== id);
  setLocal("local_count_history", updated);

  if (!isOfflineFallback) {
    try {
      await deleteDoc(doc(db, "count_history", id));
    } catch (err) {
      recordCloudError(err);
    }
  }
}

// Delete a single consumption/dispense log entry
export async function deleteQCConsumptionItem(id: string): Promise<void> {
  const list = getLocalQCConsumptionHistory();
  const updated = list.filter(item => item.id !== id);
  setLocal("local_qc_consumption_history", updated);

  if (!isOfflineFallback) {
    try {
      await deleteDoc(doc(db, "qc_consumption_history", id));
    } catch (err) {
      recordCloudError(err);
    }
  }
}

// Bulk clear count history (all or older than N days)
export async function clearCountHistory(olderThanDays?: number): Promise<{ deletedCount: number }> {
  const list = getLocalCountHistory();
  const cutoffMs = olderThanDays && olderThanDays > 0 ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000 : null;

  const toDelete = cutoffMs
    ? list.filter(item => parseLogDateMs(item.checkedAt) < cutoffMs)
    : list;
  const toKeep = cutoffMs
    ? list.filter(item => parseLogDateMs(item.checkedAt) >= cutoffMs)
    : [];

  setLocal("local_count_history", toKeep);

  if (!isOfflineFallback) {
    try {
      if (cutoffMs) {
        const docIds = toDelete.map(d => d.id);
        await deleteFirestoreDocsInChunks("count_history", docIds);
      } else {
        const snap = await getDocs(collection(db, "count_history"));
        const docIds = snap.docs.map(d => d.id);
        await deleteFirestoreDocsInChunks("count_history", docIds);
      }
    } catch (err) {
      recordCloudError(err);
    }
  }

  return { deletedCount: toDelete.length };
}

// Bulk clear withdrawal & QC consumption history (all or older than N days)
export async function clearQCConsumptionHistory(olderThanDays?: number): Promise<{ deletedCount: number }> {
  const list = getLocalQCConsumptionHistory();
  const cutoffMs = olderThanDays && olderThanDays > 0 ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000 : null;

  const toDelete = cutoffMs
    ? list.filter(item => parseLogDateMs(item.consumedAt) < cutoffMs)
    : list;
  const toKeep = cutoffMs
    ? list.filter(item => parseLogDateMs(item.consumedAt) >= cutoffMs)
    : [];

  setLocal("local_qc_consumption_history", toKeep);

  if (!isOfflineFallback) {
    try {
      if (cutoffMs) {
        const docIds = toDelete.map(d => d.id);
        await deleteFirestoreDocsInChunks("qc_consumption_history", docIds);
      } else {
        const snap = await getDocs(collection(db, "qc_consumption_history"));
        const docIds = snap.docs.map(d => d.id);
        await deleteFirestoreDocsInChunks("qc_consumption_history", docIds);
      }
    } catch (err) {
      recordCloudError(err);
    }
  }

  return { deletedCount: toDelete.length };
}

// Clear all types of histories together
export async function clearAllHistories(olderThanDays?: number): Promise<{ countDeleted: number; qcDeleted: number }> {
  const resCount = await clearCountHistory(olderThanDays);
  const resQC = await clearQCConsumptionHistory(olderThanDays);
  return { countDeleted: resCount.deletedCount, qcDeleted: resQC.deletedCount };
}

// ==========================================
// USER PERMISSION & ROLE MANAGEMENT API
// ==========================================

const SUPER_ADMIN_EMAIL = "pousan888@gmail.com";

// Fetch all registered users
export async function getAppUsers(): Promise<AppUserRecord[]> {
  let localList = getLocalUsers();

  // Always ensure Super Admin pousan888@gmail.com exists in local
  const superAdminIndex = localList.findIndex(u => u.email.toLowerCase() === SUPER_ADMIN_EMAIL);
  if (superAdminIndex === -1) {
    const superAdminRecord: AppUserRecord = {
      id: "usr-superadmin",
      email: SUPER_ADMIN_EMAIL,
      name: "ผู้ดูแลระบบสูงสุด (Super Admin)",
      role: "ADMIN",
      isSuperAdmin: true,
      assignedBy: "ระบบหลัก (System Default)",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    localList.unshift(superAdminRecord);
    setLocal("local_users", localList);
  } else {
    // Keep super admin properties strictly guaranteed
    localList[superAdminIndex].role = "ADMIN";
    localList[superAdminIndex].isSuperAdmin = true;
  }

  if (isOfflineFallback) return localList;

  try {
    const snap = await withTimeout(
      getDocs(collection(db, "users")),
      4000
    );
    let cloudList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUserRecord));
    
    // Ensure Super Admin is always in cloud list as well
    const cloudSuperIndex = cloudList.findIndex(u => u.email.toLowerCase() === SUPER_ADMIN_EMAIL);
    if (cloudSuperIndex === -1) {
      const superAdminDoc: AppUserRecord = {
        id: "usr-superadmin",
        email: SUPER_ADMIN_EMAIL,
        name: "ผู้ดูแลระบบสูงสุด (Super Admin)",
        role: "ADMIN",
        isSuperAdmin: true,
        assignedBy: "ระบบหลัก (System Default)",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      cloudList.unshift(superAdminDoc);
      // Auto push to cloud if possible
      setDoc(doc(db, "users", "usr-superadmin"), superAdminDoc).catch(() => {});
    } else {
      cloudList[cloudSuperIndex].role = "ADMIN";
      cloudList[cloudSuperIndex].isSuperAdmin = true;
    }

    if (cloudList.length > 0) {
      setLocal("local_users", cloudList);
      return cloudList;
    }
    return localList;
  } catch (err) {
    recordCloudError(err);
    return localList;
  }
}

// Add or update a user's role (ADMIN, QC, HELPER)
export async function saveAppUserRole(
  email: string,
  name: string,
  role: UserRole,
  assignedBy: string
): Promise<AppUserRecord> {
  const emailClean = email.trim().toLowerCase();
  const isSuperAdmin = emailClean === SUPER_ADMIN_EMAIL;
  // Super Admin can NEVER be downgraded from ADMIN
  const finalRole: UserRole = isSuperAdmin ? "ADMIN" : role;

  const localUsers = getLocalUsers();
  const existingIdx = localUsers.findIndex(u => u.email.toLowerCase() === emailClean);
  const now = Timestamp.now();

  let userRecord: AppUserRecord;
  if (existingIdx !== -1) {
    userRecord = {
      ...localUsers[existingIdx],
      name: name.trim() || localUsers[existingIdx].name,
      role: finalRole,
      isSuperAdmin,
      assignedBy,
      updatedAt: now
    };
    localUsers[existingIdx] = userRecord;
  } else {
    userRecord = {
      id: isSuperAdmin ? "usr-superadmin" : "usr-" + generateId(),
      email: emailClean,
      name: name.trim() || emailClean.split("@")[0],
      role: finalRole,
      isSuperAdmin,
      assignedBy,
      createdAt: now,
      updatedAt: now
    };
    localUsers.push(userRecord);
  }

  setLocal("local_users", localUsers);

  if (isOfflineFallback) return userRecord;

  try {
    await setDoc(doc(db, "users", userRecord.id), userRecord, { merge: true });
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: User role saved locally, Cloud sync deferred:", err);
  }

  return userRecord;
}

// Delete / remove user from database
export async function deleteAppUser(userId: string): Promise<void> {
  const localUsers = getLocalUsers();
  const targetUser = localUsers.find(u => u.id === userId);
  if (targetUser && (targetUser.isSuperAdmin || targetUser.email.toLowerCase() === SUPER_ADMIN_EMAIL)) {
    throw new Error("ไม่สามารถลบหรือลดสิทธิ์ของผู้ดูแลระบบสูงสุดได้");
  }

  const updated = localUsers.filter(u => u.id !== userId);
  setLocal("local_users", updated);

  if (isOfflineFallback) return;

  try {
    await deleteDoc(doc(db, "users", userId));
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: User deleted locally, Cloud sync deferred:", err);
  }
}

// Fetch or auto-register user on Google Login
export async function fetchOrRegisterUser(
  email: string,
  displayName: string
): Promise<{ role: UserRole; isSuperAdmin: boolean; name: string }> {
  const emailClean = email.trim().toLowerCase();
  const isSuperAdmin = emailClean === SUPER_ADMIN_EMAIL;

  if (isSuperAdmin) {
    const existingUsers = getLocalUsers();
    const existingSuper = existingUsers.find(u => u.email.toLowerCase() === emailClean);
    const finalName = existingSuper?.name || displayName || "ผู้ดูแลระบบสูงสุด (Super Admin)";

    try {
      await saveAppUserRole(
        emailClean,
        finalName,
        "ADMIN",
        "ระบบหลัก (System)"
      );
    } catch (e) {
      console.error(e);
    }
    return { role: "ADMIN", isSuperAdmin: true, name: finalName };
  }

  // Lookup in existing users
  const users = await getAppUsers();
  const matched = users.find(u => u.email.toLowerCase() === emailClean);

  if (matched) {
    // Return existing assigned role (ADMIN, QC, or HELPER) and saved customized name
    return { role: matched.role, isSuperAdmin: false, name: matched.name || displayName || emailClean.split("@")[0] };
  }

  // If first time login, register with default role HELPER
  const defaultName = displayName || emailClean.split("@")[0];
  const newRecord = await saveAppUserRole(
    emailClean,
    defaultName,
    "HELPER",
    "ระบบอัตโนมัติ (ลงชื่อเข้าใช้ครั้งแรก)"
  );

  return { role: newRecord.role, isSuperAdmin: false, name: newRecord.name };
}

// Update user's full name (ชื่อ-นามสกุล)
export async function updateAppUserName(email: string, newName: string): Promise<AppUserRecord | null> {
  const emailClean = email.trim().toLowerCase();
  const cleanName = newName.trim();
  if (!cleanName) return null;

  const localUsers = getLocalUsers();
  const idx = localUsers.findIndex(u => u.email.toLowerCase() === emailClean);
  if (idx === -1) return null;

  localUsers[idx].name = cleanName;
  localUsers[idx].updatedAt = Timestamp.now();
  setLocal("local_users", localUsers);

  if (!isOfflineFallback) {
    try {
      await updateDoc(doc(db, "users", localUsers[idx].id), {
        name: cleanName,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      recordCloudError(err);
      console.warn("Notice: Name updated locally, Cloud sync deferred:", err);
    }
  }

  return localUsers[idx];
}

// =========================================================================
// DEPARTMENT MANAGEMENT (ACCESSIBLE BY SUPER ADMIN & ADMIN)
// =========================================================================

export async function getDepartments(): Promise<DepartmentRecord[]> {
  const deletedIds = getDeletedDepartmentIds();
  const localList = getLocalDepartments();
  if (isOfflineFallback) {
    return localList;
  }

  try {
    const q = query(collection(db, "departments"), orderBy("name", "asc"));
    const snapshot = await withTimeout(getDocs(q), 3500);
    if (snapshot.empty) {
      // Seed default departments to Cloud Firestore
      for (const d of localList) {
        setDoc(doc(db, "departments", d.id), {
          ...d,
          createdAt: Timestamp.now()
        }).catch(() => {});
      }
      return localList;
    }

    // Clean up any cloud docs that were deleted locally or are legacy "Production"
    for (const d of snapshot.docs) {
      if (deletedIds.includes(d.id) || d.data().name?.toLowerCase() === "production") {
        deleteDoc(d.ref).catch(() => {});
      }
    }

    const cloudList = snapshot.docs
      .filter(doc => !deletedIds.includes(doc.id) && doc.data().name?.toLowerCase() !== "production")
      .map(doc => ({ id: doc.id, ...doc.data() } as DepartmentRecord));
    setLocal("local_departments", cloudList);
    return cloudList;
  } catch (err) {
    recordCloudError(err);
    return localList;
  }
}

export async function addDepartment(
  name: string,
  description?: string,
  color?: string,
  createdBy?: string
): Promise<DepartmentRecord> {
  const cleanName = name.trim();
  const id = "dept-" + generateId();
  const newDept: DepartmentRecord = {
    id,
    name: cleanName,
    description: description?.trim() || "",
    color: color || "#4f46e5",
    createdAt: Timestamp.now(),
    createdBy: createdBy || "admin"
  };

  const list = getLocalDepartments();
  // Check duplicate
  const existingIdx = list.findIndex(d => d.name.toLowerCase() === cleanName.toLowerCase());
  if (existingIdx !== -1) {
    throw new Error(`แผนก "${cleanName}" มีอยู่ในระบบแล้ว`);
  }

  list.push(newDept);
  setLocal("local_departments", list);

  if (!isOfflineFallback) {
    try {
      await setDoc(doc(db, "departments", id), newDept);
    } catch (err) {
      recordCloudError(err);
    }
  }

  return newDept;
}

export async function updateDepartment(
  id: string,
  updates: Partial<DepartmentRecord>
): Promise<void> {
  const list = getLocalDepartments();
  const idx = list.findIndex(d => d.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    setLocal("local_departments", list);
  }

  if (!isOfflineFallback) {
    try {
      await updateDoc(doc(db, "departments", id), updates);
    } catch (err) {
      recordCloudError(err);
    }
  }
}

export async function deleteDepartment(id: string): Promise<void> {
  addDeletedDepartmentId(id);
  const list = getLocalDepartments();
  const target = list.find(d => d.id === id);
  if (!target) return;

  const updated = list.filter(d => d.id !== id);
  setLocal("local_departments", updated);

  if (!isOfflineFallback) {
    try {
      await deleteDoc(doc(db, "departments", id));
    } catch (err) {
      recordCloudError(err);
    }
  }
}

export async function reassignDepartmentConsumables(
  oldDeptName: string, 
  targetDeptName: string
): Promise<number> {
  const list = getLocalConsumables();
  let count = 0;
  const oldLower = oldDeptName.toLowerCase();
  
  for (const item of list) {
    if (item.department && item.department.toLowerCase() === oldLower) {
      item.department = targetDeptName;
      count++;
      if (!isOfflineFallback) {
        updateDoc(doc(db, "consumables", item.id), { department: targetDeptName }).catch(() => {});
      }
    }
  }

  if (count > 0) {
    setLocal("local_consumables", list);
  }
  return count;
}

// ==========================================
// MASTER CONSUMABLE CATALOG (รายการพัสดุมาตรฐานส่วนกลาง)
// ==========================================

export const DEFAULT_MASTER_CONSUMABLES: MasterConsumable[] = [
  {
    id: "mc-wrap",
    code: "MAT-WRAP-01",
    name: "พลาสติกแรป (PLASTIC WRAP)",
    category: "บรรจุภัณฑ์",
    unit: "ม้วน",
    imageUrl: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&q=80&w=400",
    defaultMinThreshold: 5,
    defaultMaxThreshold: 25,
    description: "ฟิล์มยืดพลาสติกแรปใสสำหรับพันสินค้าและพาเลท หน้ากว้าง 50 ซม."
  },
  {
    id: "mc-glove",
    code: "PPE-GLOVE-01",
    name: "ถุงมือไนไตรสีฟ้า (Nitrile Gloves)",
    category: "อุปกรณ์ PPE",
    unit: "กล่อง",
    imageUrl: CONSUMABLE_PRESETS["glove"],
    defaultMinThreshold: 5,
    defaultMaxThreshold: 30,
    description: "ถุงมือยางสังเคราะห์ไนไตร ไร้แป้ง ป้องกันสารเคมีและสิ่งสกปรก (กล่องละ 100 ชิ้น)"
  },
  {
    id: "mc-mask",
    code: "PPE-MASK-01",
    name: "หน้ากากอนามัย 3 ชั้น (3-Ply Mask)",
    category: "อุปกรณ์ PPE",
    unit: "กล่อง",
    imageUrl: CONSUMABLE_PRESETS["mask"],
    defaultMinThreshold: 5,
    defaultMaxThreshold: 30,
    description: "หน้ากากอนามัยทางการแพทย์ 3 ชั้น มีแถบปรับสันจมูก (กล่องละ 50 ชิ้น)"
  },
  {
    id: "mc-tape",
    code: "MAT-TAPE-01",
    name: "ดักเทปสีเทา (Cloth Duct Tape)",
    category: "เทป & กาว",
    unit: "ม้วน",
    imageUrl: CONSUMABLE_PRESETS["tape"],
    defaultMinThreshold: 5,
    defaultMaxThreshold: 20,
    description: "เทปผ้ากาวยางธรรมชาติ เหนียวแน่น ทนแรงดึงสูง ขนาด 2 นิ้ว"
  },
  {
    id: "mc-brush",
    code: "TOOL-BRUSH-01",
    name: "แปรงทาสี 1 นิ้ว (Paint Brush 1 Inch)",
    category: "เครื่องมือ & ซ่อมบำรุง",
    unit: "อัน",
    imageUrl: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=400",
    defaultMinThreshold: 3,
    defaultMaxThreshold: 15,
    description: "แปรงทาสีขนสัตว์แท้ ด้ามไม้ สำหรับทาสี ทาน้ำมัน และปัดฝุ่นชิ้นงาน"
  },
  {
    id: "mc-ratchet",
    code: "SAFE-BELT-01",
    name: "รัชชิ่งเบล สายรัดก๊อกแก๊ก (Ratchet Belt)",
    category: "อุปกรณ์เซฟตี้ & ขนย้าย",
    unit: "ชุด",
    imageUrl: "https://images.unsplash.com/photo-1540638349517-3abd5afc5847?auto=format&fit=crop&q=80&w=400",
    defaultMinThreshold: 2,
    defaultMaxThreshold: 10,
    description: "สายรัดโพลีเอสเตอร์พร้อมตัวโยกก๊อกแก๊ก สำหรับผูกรัดสินค้าบนรถและพาเลท"
  },
  {
    id: "mc-sling2m",
    code: "LIFT-SLING-2M",
    name: "Webbing sling 2 MT – 2 M long (สลิงยก 2 ตัน 2 ม.)",
    category: "อุปกรณ์เซฟตี้ & ขนย้าย",
    unit: "เส้น",
    imageUrl: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&q=80&w=400",
    defaultMinThreshold: 2,
    defaultMaxThreshold: 8,
    description: "สลิงผ้าใบโพลีเอสเตอร์แบน รับน้ำหนัก 2 ตัน ยาว 2 เมตร มีห่วงหัวท้าย"
  },
  {
    id: "mc-sling3m",
    code: "LIFT-SLING-3M",
    name: "Webbing sling 3 MT – 2 M long (สลิงยก 3 ตัน 2 ม.)",
    category: "อุปกรณ์เซฟตี้ & ขนย้าย",
    unit: "เส้น",
    imageUrl: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&q=80&w=400",
    defaultMinThreshold: 2,
    defaultMaxThreshold: 8,
    description: "สลิงผ้าใบโพลีเอสเตอร์แบน รับน้ำหนัก 3 ตัน ยาว 2 เมตร มีห่วงหัวท้าย"
  },
  {
    id: "mc-cotterpin",
    code: "FAST-PIN-M4",
    name: "GAVZ COTTER PIN M 4 X 40 (สลักปิ้นล็อค)",
    category: "สลักภัณฑ์ & น็อต",
    unit: "กล่อง",
    imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400",
    defaultMinThreshold: 2,
    defaultMaxThreshold: 6,
    description: "ปิ้นสลักล็อคเหล็กชุบขาวป้องกันสนิม ขนาด M4 x 40 มม. (กล่องละ 100 ชิ้น)"
  },
  {
    id: "mc-cabletie",
    code: "MAT-CABLETIE-01",
    name: "CABLE TIE CT-310-4C (เคเบิ้ลไทร์ 310x4.8mm)",
    category: "บรรจุภัณฑ์",
    unit: "ถุง",
    imageUrl: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=400",
    defaultMinThreshold: 3,
    defaultMaxThreshold: 15,
    description: "สายรัดเคเบิ้ลไทร์ไนลอนสีขาว/ดำ ขนาด 310mm x 4.8mm (ถุงละ 100 เส้น)"
  },
  {
    id: "mc-alcohol",
    code: "CHEM-ALC-75",
    name: "สเปรย์แอลกอฮอล์ 75% (Alcohol Spray)",
    category: "เคมีภัณฑ์ & ทำความสะอาด",
    unit: "ขวด",
    imageUrl: CONSUMABLE_PRESETS["alcohol"],
    defaultMinThreshold: 5,
    defaultMaxThreshold: 20,
    description: "สเปรย์แอลกอฮอล์ทำความสะอาดและฆ่าเชื้อโรค ขนาด 500 มล."
  },
  {
    id: "mc-goggles",
    code: "PPE-GOGGLE-01",
    name: "แว่นตานิรภัยกันสะเก็ด (Safety Goggles)",
    category: "อุปกรณ์ PPE",
    unit: "อัน",
    imageUrl: CONSUMABLE_PRESETS["goggles"],
    defaultMinThreshold: 3,
    defaultMaxThreshold: 15,
    description: "แว่นตานิรภัยเลนส์ใส มาตรฐาน ANSI ป้องกันสะเก็ดและรังสี UV"
  },
  {
    id: "mc-wipes",
    code: "CLEAN-WIPE-01",
    name: "กระดาษเช็ดอุตสาหกรรม (Industrial Wipes)",
    category: "เคมีภัณฑ์ & ทำความสะอาด",
    unit: "ม้วน",
    imageUrl: CONSUMABLE_PRESETS["paper"],
    defaultMinThreshold: 4,
    defaultMaxThreshold: 16,
    description: "กระดาษหนาพิเศษซับน้ำมันและคราบจารบี ไม่เปื่อยยุ่ย ไม่เป็นขุย"
  },
  {
    id: "mc-grease",
    code: "LUB-GREASE-01",
    name: "จารบีหล่อลื่นทนความร้อนสูง (Industrial Grease)",
    category: "เคมีภัณฑ์ & ทำความสะอาด",
    unit: "กระป๋อง",
    imageUrl: CONSUMABLE_PRESETS["grease"],
    defaultMinThreshold: 2,
    defaultMaxThreshold: 10,
    description: "จารบีลิเธียมคอมเพล็กซ์ทนความร้อนสูง ป้องกันสนิมและการสึกหรอ"
  }
];

const DELETED_MASTER_CONSUMABLES_KEY = "cabinet_deleted_master_consumables_tombstone";

export const getDeletedMasterConsumableIds = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_MASTER_CONSUMABLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed as any[]).flat(Infinity).map(x => String(x).trim()).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
};

export const addDeletedMasterConsumableId = (id: string) => {
  if (!id || typeof window === "undefined") return;
  const current = getDeletedMasterConsumableIds();
  if (!current.includes(id)) {
    current.push(id);
    localStorage.setItem(DELETED_MASTER_CONSUMABLES_KEY, JSON.stringify(current));
  }
};

export const getLocalMasterConsumables = (): MasterConsumable[] => {
  const deletedIds = getDeletedMasterConsumableIds();
  let list = getLocal<any>("local_master_consumables");
  if (!list || list.length === 0) {
    setLocal("local_master_consumables", DEFAULT_MASTER_CONSUMABLES);
    list = DEFAULT_MASTER_CONSUMABLES;
  }
  return list
    .map(item => convertToTimestamps<MasterConsumable>(item))
    .filter(item => !deletedIds.includes(item.id));
};

export async function getMasterConsumables(): Promise<MasterConsumable[]> {
  const deletedIds = getDeletedMasterConsumableIds();
  const localList = getLocalMasterConsumables();

  if (isOfflineFallback) {
    return localList;
  }

  try {
    const snap = await withTimeout(
      getDocs(collection(db, "master_consumables")),
      4000
    );

    for (const d of snap.docs) {
      if (deletedIds.includes(d.id)) {
        deleteDoc(d.ref).catch(() => {});
      }
    }

    const cloudList = snap.docs
      .filter(doc => !deletedIds.includes(doc.id))
      .map(doc => ({ id: doc.id, ...doc.data() } as MasterConsumable));

    cloudList.sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));

    // Auto-sync local to cloud if cloud is empty or missing items
    for (const loc of localList) {
      if (!cloudList.some(c => c.id === loc.id) && !deletedIds.includes(loc.id)) {
        setDoc(doc(db, "master_consumables", loc.id), loc).catch(() => {});
      }
    }

    const map = new Map<string, MasterConsumable>();
    cloudList.forEach(m => map.set(m.id, m));
    localList.forEach(m => {
      if (!map.has(m.id)) map.set(m.id, m);
    });

    const result = Array.from(map.values()).filter(m => !deletedIds.includes(m.id));
    result.sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));
    setLocal("local_master_consumables", result);
    return result;
  } catch (err) {
    recordCloudError(err);
    return localList;
  }
}

export async function addMasterConsumable(
  data: Omit<MasterConsumable, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<MasterConsumable> {
  const id = data.id || "mc-" + generateId();
  const newMaster: MasterConsumable = {
    id,
    code: data.code?.trim() || "",
    name: data.name.trim(),
    category: data.category?.trim() || "ทั่วไป",
    unit: data.unit.trim(),
    imageUrl: data.imageUrl || CONSUMABLE_PRESETS["tape"],
    defaultMinThreshold: Number(data.defaultMinThreshold) || 5,
    defaultMaxThreshold: Number(data.defaultMaxThreshold) || 20,
    description: data.description?.trim() || "",
    createdAt: Timestamp.now(),
    createdBy: data.createdBy || "admin"
  };

  const list = getLocalMasterConsumables();
  const existingIdx = list.findIndex(m => m.id === id || m.name.toLowerCase() === newMaster.name.toLowerCase());
  if (existingIdx !== -1) {
    list[existingIdx] = { ...list[existingIdx], ...newMaster };
  } else {
    list.unshift(newMaster);
  }
  setLocal("local_master_consumables", list);

  if (!isOfflineFallback) {
    try {
      await setDoc(doc(db, "master_consumables", id), newMaster);
    } catch (err) {
      recordCloudError(err);
    }
  }

  return newMaster;
}

export async function updateMasterConsumable(
  id: string,
  updates: Partial<MasterConsumable>
): Promise<void> {
  const list = getLocalMasterConsumables();
  const idx = list.findIndex(m => m.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates, updatedAt: Timestamp.now() };
    setLocal("local_master_consumables", list);
  }

  if (!isOfflineFallback) {
    try {
      await updateDoc(doc(db, "master_consumables", id), {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      recordCloudError(err);
    }
  }
}

export async function deleteMasterConsumable(id: string): Promise<void> {
  addDeletedMasterConsumableId(id);
  const list = getLocalMasterConsumables();
  const updated = list.filter(m => m.id !== id);
  setLocal("local_master_consumables", updated);

  if (!isOfflineFallback) {
    try {
      await deleteDoc(doc(db, "master_consumables", id));
    } catch (err) {
      recordCloudError(err);
    }
  }
}


