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
import { Cabinet, Consumable, CountHistory, QCConsumptionHistory } from "../types";

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Standard image presets
export const CABINET_PRESETS = [
  "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=400", // metal locker cabinet
  "https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&q=80&w=400", // storage shelves
  "https://images.unsplash.com/photo-1540638349517-3abd5afc5847?auto=format&fit=crop&q=80&w=400", // blue industrial box
  "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=400"  // wooden cabinet
];

export const CONSUMABLE_PRESETS: Record<string, string> = {
  "glove": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400", // gloves
  "mask": "https://images.unsplash.com/photo-1586942593568-29361efcd571?auto=format&fit=crop&q=80&w=400",  // masks
  "alcohol": "https://images.unsplash.com/photo-1607619056574-7b8f304b3c86?auto=format&fit=crop&q=80&w=400", // alcohol/cleaning
  "tape": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=400",    // maintenance tape
  "paper": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&q=80&w=400",   // industrial tissue
  "grease": "https://images.unsplash.com/photo-1530124560676-10551fe77b2f?auto=format&fit=crop&q=80&w=400"  // tools/grease
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

// Global Cloud Sync Status tracking to inform the user if Firestore Rules need attention
let cloudSyncNotice: { hasError: boolean; code?: string; message?: string } = { hasError: false };

export function getCloudSyncNotice() {
  return cloudSyncNotice;
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

    // If cloud was empty but local has items, return local
    if (localList.length > 0) {
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

// Save QC Consumption History (Fault-Tolerant)
export async function saveQCConsumption(
  department: string, 
  consumedBy: string, 
  items: { consumableId: string; name: string; qtyTaken: number; unit: string; cabinetId: string; cabinetName: string }[]
): Promise<void> {
  const logId = "qc-" + generateId();
  const qcLog: QCConsumptionHistory = {
    id: logId,
    department,
    consumedAt: Timestamp.now(),
    consumedBy,
    items
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
    console.warn("Notice: QC consumption saved locally, Cloud sync deferred:", err);
  }
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
