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
import { Cabinet, Consumable, CountHistory, QCConsumptionHistory, AppUserRecord, UserRole, DepartmentRecord } from "../types";

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

const getLocalCabinets = (): Cabinet[] => {
  const list = getLocal<any>("local_cabinets");
  return list.map(item => convertToTimestamps<Cabinet>(item));
};

const getLocalConsumables = (): Consumable[] => {
  const list = getLocal<any>("local_consumables");
  return list.map(item => convertToTimestamps<Consumable>(item));
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
  { id: "dept-prod", name: "Production", description: "ฝ่ายผลิตและประกอบชิ้นงาน", color: "#4f46e5" },
  { id: "dept-qc", name: "QC", description: "ฝ่ายควบคุมและตรวจสอบคุณภาพ", color: "#9333ea" },
  { id: "dept-maint", name: "Maintenance", description: "ฝ่ายซ่อมบำรุงและเครื่องจักร", color: "#f59e0b" },
  { id: "dept-wh", name: "Warehouse", description: "ฝ่ายคลังสินค้าและจัดส่ง", color: "#10b981" },
  { id: "dept-office", name: "Office", description: "ฝ่ายธุรการและสำนักงาน", color: "#64748b" }
];

export const getLocalDepartments = (): DepartmentRecord[] => {
  const list = getLocal<any>("local_departments");
  if (!list || list.length === 0) {
    setLocal("local_departments", DEFAULT_DEPARTMENTS);
    return DEFAULT_DEPARTMENTS;
  }
  return list.map(item => convertToTimestamps<DepartmentRecord>(item));
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

    const batch = writeBatch(db);
    for (const cab of localCabs) {
      batch.set(doc(db, "cabinets", cab.id), cab);
    }
    for (const con of localCons) {
      batch.set(doc(db, "consumables", con.id), con);
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
      message: `ซิงค์ข้อมูลขึ้น Cloud Firestore สำเร็จแล้ว (${localCabs.length} ตู้, ${localCons.length} พัสดุ) ทุกเครื่องและมือถือจะมองเห็นข้อมูลตรงกันทันที!`,
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
  if (isOfflineFallback) {
    const existingCabs = getLocalCabinets();
    if (existingCabs.length > 0) {
      console.log("[Offline Mode]: Database already has data. Skipping seed.");
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
        departments: ["QC", "Production"],
        photoUrl: CABINET_PRESETS[0],
        createdAt: Timestamp.now()
      },
      {
        id: cabinet2Id,
        name: "ตู้พัสดุและอะไหล่ซ่อมบำรุงไลน์ 3",
        location: "ไลน์การผลิต 3 หลังเครื่องปั๊ม",
        departments: ["Production", "Maintenance"],
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
        unit: "กล่อง",
        imageUrl: CONSUMABLE_PRESETS["glove"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-102",
        cabinetId: cabinet1Id,
        name: "หน้ากากอนามัย 3 ชั้นกันฝุ่น",
        department: "Production",
        currentQty: 2, // Low stock
        minThreshold: 4,
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
        unit: "แพ็ค",
        imageUrl: CONSUMABLE_PRESETS["alcohol"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-201",
        cabinetId: cabinet2Id,
        name: "เทปพันเกลียวท่อประปาเหนียวพิเศษ",
        department: "Maintenance",
        currentQty: 3, // Low stock
        minThreshold: 8,
        unit: "ม้วน",
        imageUrl: CONSUMABLE_PRESETS["tape"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-202",
        cabinetId: cabinet2Id,
        name: "จาระบีหล่อลื่นทนความร้อนสูง",
        department: "Maintenance",
        currentQty: 6,
        minThreshold: 3,
        unit: "กระป๋อง",
        imageUrl: CONSUMABLE_PRESETS["grease"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-203",
        cabinetId: cabinet2Id,
        name: "กระดาษทิชชู่ม้วนใหญ่อุตสาหกรรม",
        department: "Production",
        currentQty: 20,
        minThreshold: 8,
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
          department: "Production"
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
    return true;
  }

  // standard Cloud Firestore seeding
  try {
    const cabinetSnap = await getDocs(collection(db, "cabinets"));
    if (!cabinetSnap.empty) {
      console.log("Database already has data. Skipping seed.");
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
      departments: ["QC", "Production"],
      photoUrl: CABINET_PRESETS[0],
      createdAt: Timestamp.now()
    };

    const cabinet2: Cabinet = {
      id: cabinet2Id,
      name: "ตู้พัสดุและอะไหล่ซ่อมบำรุงไลน์ 3",
      location: "ไลน์การผลิต 3 หลังเครื่องปั๊ม",
      departments: ["Production", "Maintenance"],
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
        unit: "กล่อง",
        imageUrl: CONSUMABLE_PRESETS["glove"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-102",
        cabinetId: cabinet1Id,
        name: "หน้ากากอนามัย 3 ชั้นกันฝุ่น",
        department: "Production",
        currentQty: 2,
        minThreshold: 4,
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
        department: "Maintenance",
        currentQty: 3,
        minThreshold: 8,
        unit: "ม้วน",
        imageUrl: CONSUMABLE_PRESETS["tape"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-202",
        cabinetId: cabinet2Id,
        name: "จาระบีหล่อลื่นทนความร้อนสูง",
        department: "Maintenance",
        currentQty: 6,
        minThreshold: 3,
        unit: "กระป๋อง",
        imageUrl: CONSUMABLE_PRESETS["grease"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      },
      {
        id: "con-203",
        cabinetId: cabinet2Id,
        name: "กระดาษทิชชู่ม้วนใหญ่อุตสาหกรรม",
        department: "Production",
        currentQty: 20,
        minThreshold: 8,
        unit: "ม้วน",
        imageUrl: CONSUMABLE_PRESETS["paper"],
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: "pousan888@gmail.com"
      }
    ];

    consumables1.forEach(c => batch.set(doc(db, "consumables", c.id), c));
    consumables2.forEach(c => batch.set(doc(db, "consumables", c.id), c));

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
          department: "Production"
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

// Fetch all cabinets (Fault-Tolerant & Local-First Resilient)
export async function getCabinets(): Promise<Cabinet[]> {
  const localList = getLocalCabinets();

  if (isOfflineFallback) {
    return localList;
  }

  try {
    const snap = await withTimeout(
      getDocs(query(collection(db, "cabinets"), orderBy("createdAt", "desc"))),
      4000
    );
    const cloudList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cabinet));
    
    // Cloud connection is healthy!
    cloudSyncNotice = { hasError: false };

    // Auto-sync: If local storage has cabinets that aren't on Cloud yet, upload them now!
    for (const loc of localList) {
      if (!cloudList.some(c => c.id === loc.id)) {
        setDoc(doc(db, "cabinets", loc.id), loc).catch(e => console.warn("Auto-sync cabinet to cloud:", e));
      }
    }

    // If cloud has documents, merge or sync to local
    if (cloudList.length > 0) {
      // Merge any local items that haven't synced yet
      const combined = [...cloudList];
      for (const loc of localList) {
        if (!combined.some(c => c.id === loc.id)) {
          combined.push(loc);
        }
      }
      setLocal("local_cabinets", combined);
      return combined;
    }

    // If cloud was empty but local has items, upload all to cloud and return local
    if (localList.length > 0) {
      for (const loc of localList) {
        setDoc(doc(db, "cabinets", loc.id), loc).catch(e => console.warn("Auto-sync initial cabinet:", e));
      }
      return localList;
    }

    return [];
  } catch (err) {
    recordCloudError(err);
    console.warn("Could not fetch cabinets from Cloud, serving from local cache:", err);
    return localList;
  }
}

// Add Cabinet (Always persists locally first, then syncs to Cloud Firestore)
export async function addCabinet(cabinet: Omit<Cabinet, "id" | "createdAt">): Promise<string> {
  const id = "cab-" + generateId();
  const newCabinet: Cabinet = {
    ...cabinet,
    id,
    createdAt: Timestamp.now()
  };

  // 1. Immediately save to LocalStorage so the user NEVER loses their cabinet!
  const list = getLocalCabinets();
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
  const list = getLocalCabinets();
  const index = list.findIndex(c => c.id === id);
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

// Delete Cabinet and its consumables (Fault-Tolerant)
export async function deleteCabinet(id: string): Promise<void> {
  // 1. Delete locally
  const list = getLocalCabinets();
  const updated = list.filter(c => c.id !== id);
  setLocal("local_cabinets", updated);

  const consumables = getLocalConsumables();
  const remainingConsumables = consumables.filter(c => c.cabinetId !== id);
  setLocal("local_consumables", remainingConsumables);

  if (isOfflineFallback) return;

  // 2. Delete from Cloud Firestore
  try {
    await deleteDoc(doc(db, "cabinets", id));
    const consumablesSnap = await getDocs(query(collection(db, "consumables"), where("cabinetId", "==", id)));
    const batch = writeBatch(db);
    consumablesSnap.docs.forEach(d => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (err) {
    recordCloudError(err);
    console.warn("Notice: Cabinet deleted from local storage, Cloud sync deferred:", err);
  }
}

// Fetch consumables (Fault-Tolerant)
export async function getConsumables(cabinetId?: string): Promise<Consumable[]> {
  const localList = getLocalConsumables();

  if (isOfflineFallback) {
    return cabinetId ? localList.filter(c => c.cabinetId === cabinetId) : localList;
  }

  try {
    let q = query(collection(db, "consumables"));
    if (cabinetId) {
      q = query(collection(db, "consumables"), where("cabinetId", "==", cabinetId));
    }
    const snap = await withTimeout(getDocs(q), 4000);
    const cloudList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consumable));

    // Cloud connection is healthy!
    cloudSyncNotice = { hasError: false };

    // Auto-sync: If local items aren't on Cloud yet, upload them
    for (const loc of localList) {
      if (!cloudList.some(c => c.id === loc.id)) {
        setDoc(doc(db, "consumables", loc.id), loc).catch(e => console.warn("Auto-sync consumable to cloud:", e));
      }
    }

    if (cloudList.length > 0) {
      // Merge with local if needed
      const combined = [...cloudList];
      for (const loc of localList) {
        if (!combined.some(c => c.id === loc.id)) {
          if (!cabinetId || loc.cabinetId === cabinetId) {
            combined.push(loc);
          }
        }
      }
      setLocal("local_consumables", combined);
      return cabinetId ? combined.filter(c => c.cabinetId === cabinetId) : combined;
    }

    if (localList.length > 0) {
      for (const loc of localList) {
        setDoc(doc(db, "consumables", loc.id), loc).catch(e => console.warn("Auto-sync initial consumable:", e));
      }
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
  const newConsumable: Consumable = {
    ...consumable,
    id,
    lastUpdated: Timestamp.now()
  };

  // 1. Immediately save locally
  const list = getLocalConsumables();
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
  const list = getLocalConsumables();
  const index = list.findIndex(c => c.id === id);
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

// Delete Consumable (Fault-Tolerant)
export async function deleteConsumable(id: string): Promise<void> {
  const list = getLocalConsumables();
  const updated = list.filter(c => c.id !== id);
  setLocal("local_consumables", updated);

  if (isOfflineFallback) return;

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
): Promise<{ role: UserRole; isSuperAdmin: boolean }> {
  const emailClean = email.trim().toLowerCase();
  const isSuperAdmin = emailClean === SUPER_ADMIN_EMAIL;

  if (isSuperAdmin) {
    try {
      await saveAppUserRole(
        emailClean,
        displayName || "ผู้ดูแลระบบสูงสุด (Super Admin)",
        "ADMIN",
        "ระบบหลัก (System)"
      );
    } catch (e) {
      console.error(e);
    }
    return { role: "ADMIN", isSuperAdmin: true };
  }

  // Lookup in existing users
  const users = await getAppUsers();
  const matched = users.find(u => u.email.toLowerCase() === emailClean);

  if (matched) {
    // Return existing assigned role (ADMIN, QC, or HELPER)
    return { role: matched.role, isSuperAdmin: false };
  }

  // If first time login, register with default role HELPER
  const newRecord = await saveAppUserRole(
    emailClean,
    displayName || emailClean.split("@")[0],
    "HELPER",
    "ระบบอัตโนมัติ (ลงชื่อเข้าใช้ครั้งแรก)"
  );

  return { role: newRecord.role, isSuperAdmin: false };
}

// =========================================================================
// DEPARTMENT MANAGEMENT (ACCESSIBLE BY SUPER ADMIN & ADMIN)
// =========================================================================

export async function getDepartments(): Promise<DepartmentRecord[]> {
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

    const cloudList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DepartmentRecord));
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

