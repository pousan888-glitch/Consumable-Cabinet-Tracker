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

// Fetch all cabinets
export async function getCabinets(): Promise<Cabinet[]> {
  if (isOfflineFallback) {
    return getLocalCabinets();
  }
  const snap = await getDocs(query(collection(db, "cabinets"), orderBy("createdAt", "desc")));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cabinet));
}

// Add Cabinet
export async function addCabinet(cabinet: Omit<Cabinet, "id" | "createdAt">): Promise<string> {
  const id = "cab-" + generateId();
  const newCabinet: Cabinet = {
    ...cabinet,
    id,
    createdAt: Timestamp.now()
  };

  if (isOfflineFallback) {
    const list = getLocalCabinets();
    list.unshift(newCabinet);
    setLocal("local_cabinets", list);
    return id;
  }

  await setDoc(doc(db, "cabinets", id), newCabinet);
  return id;
}

// Update Cabinet
export async function updateCabinet(id: string, updates: Partial<Cabinet>): Promise<void> {
  if (isOfflineFallback) {
    const list = getLocalCabinets();
    const index = list.findIndex(c => c.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates };
      setLocal("local_cabinets", list);
    }
    return;
  }
  await updateDoc(doc(db, "cabinets", id), updates);
}

// Delete Cabinet and its consumables
export async function deleteCabinet(id: string): Promise<void> {
  if (isOfflineFallback) {
    const list = getLocalCabinets();
    const updated = list.filter(c => c.id !== id);
    setLocal("local_cabinets", updated);

    const consumables = getLocalConsumables();
    const remainingConsumables = consumables.filter(c => c.cabinetId !== id);
    setLocal("local_consumables", remainingConsumables);
    return;
  }

  await deleteDoc(doc(db, "cabinets", id));
  const consumablesSnap = await getDocs(query(collection(db, "consumables"), where("cabinetId", "==", id)));
  const batch = writeBatch(db);
  consumablesSnap.docs.forEach(d => {
    batch.delete(d.ref);
  });
  await batch.commit();
}

// Fetch consumables
export async function getConsumables(cabinetId?: string): Promise<Consumable[]> {
  if (isOfflineFallback) {
    const list = getLocalConsumables();
    if (cabinetId) {
      return list.filter(c => c.cabinetId === cabinetId);
    }
    return list;
  }

  let q = query(collection(db, "consumables"));
  if (cabinetId) {
    q = query(collection(db, "consumables"), where("cabinetId", "==", cabinetId));
  }
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consumable));
}

// Add Consumable
export async function addConsumable(consumable: Omit<Consumable, "id" | "lastUpdated">): Promise<string> {
  const id = "con-" + generateId();
  const newConsumable: Consumable = {
    ...consumable,
    id,
    lastUpdated: Timestamp.now()
  };

  if (isOfflineFallback) {
    const list = getLocalConsumables();
    list.push(newConsumable);
    setLocal("local_consumables", list);
    return id;
  }

  await setDoc(doc(db, "consumables", id), newConsumable);
  return id;
}

// Update Consumable
export async function updateConsumable(id: string, updates: Partial<Consumable>): Promise<void> {
  if (isOfflineFallback) {
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
    return;
  }

  await updateDoc(doc(db, "consumables", id), {
    ...updates,
    lastUpdated: Timestamp.now()
  });
}

// Delete Consumable
export async function deleteConsumable(id: string): Promise<void> {
  if (isOfflineFallback) {
    const list = getLocalConsumables();
    const updated = list.filter(c => c.id !== id);
    setLocal("local_consumables", updated);
    return;
  }
  await deleteDoc(doc(db, "consumables", id));
}

// Save Count Check History
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

  if (isOfflineFallback) {
    // 1. Save count history log
    const historyList = getLocalCountHistory();
    historyList.unshift(countLog);
    setLocal("local_count_history", historyList);

    // 2. Update consumable stock quantity locally
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
    return;
  }

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
}

// Save QC Consumption History
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

  if (isOfflineFallback) {
    // 1. Save consumption log
    const qcList = getLocalQCConsumptionHistory();
    qcList.unshift(qcLog);
    setLocal("local_qc_consumption_history", qcList);

    // 2. Decrement inventory
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
    return;
  }

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
}

// Fetch Counting History Logs
export async function getCountHistory(): Promise<CountHistory[]> {
  if (isOfflineFallback) {
    return getLocalCountHistory();
  }
  const snap = await getDocs(query(collection(db, "count_history"), orderBy("checkedAt", "desc")));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CountHistory));
}

// Fetch QC Consumption History Logs
export async function getQCConsumptionHistory(): Promise<QCConsumptionHistory[]> {
  if (isOfflineFallback) {
    return getLocalQCConsumptionHistory();
  }
  const snap = await getDocs(query(collection(db, "qc_consumption_history"), orderBy("consumedAt", "desc")));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QCConsumptionHistory));
}
