import { Consumable } from "../types";

/**
 * Returns the effective target stock capacity for an item:
 * 1) If maxThreshold is set and > 0, return maxThreshold.
 * 2) Otherwise, fallback to minThreshold * 2 (or at least 1).
 */
export function getItemTargetStock(item: Consumable): number {
  if (item.maxThreshold !== undefined && item.maxThreshold !== null && item.maxThreshold > 0) {
    return item.maxThreshold;
  }
  return item.minThreshold > 0 ? item.minThreshold * 2 : 1;
}

/**
 * Checks if an item is out of stock (วิกฤต - 0 ชิ้น)
 */
export function isItemOutOfStock(item: Consumable): boolean {
  return (item.currentQty ?? 0) <= 0;
}

/**
 * Checks if an item needs replenishment / is below safety threshold:
 * 1) If currentQty is 0 -> true (Always out of stock)
 * 2) If item has reached or exceeded maxThreshold -> false (It is already full / at capacity)
 * 3) If maxThreshold <= minThreshold (e.g. min: 1, max: 1):
 *    -> Only low if currentQty < minThreshold (e.g. 0). When currentQty == 1, it's at max capacity!
 * 4) If maxThreshold > minThreshold (e.g. min: 5, max: 10):
 *    -> Low if currentQty <= minThreshold
 * 5) If maxThreshold is not set:
 *    -> If minThreshold === 1 and currentQty >= 1 -> false (1 item is present)
 *    -> If currentQty <= minThreshold -> true
 */
export function isItemLowStock(item: Consumable): boolean {
  const qty = item.currentQty ?? 0;
  if (qty <= 0) return true;

  const max = item.maxThreshold;
  const min = item.minThreshold ?? 0;

  // If item has a positive maxThreshold and currentQty is already at or above maxThreshold,
  // it is FULL and does NOT need refill!
  if (max !== undefined && max !== null && max > 0 && qty >= max) {
    return false;
  }

  // If maxThreshold is equal to or less than minThreshold (like min: 1, max: 1)
  if (max !== undefined && max !== null && max > 0 && max <= min) {
    return qty < min;
  }

  // If maxThreshold is not set and minThreshold is 1:
  // having 1 piece means it's not out of stock and satisfies the single unit
  if ((max === undefined || max === null || max === 0) && min === 1) {
    return qty < 1;
  }

  // Standard case: currentQty <= minThreshold
  return qty <= min;
}

/**
 * Calculates recommended order deficit:
 * target - currentQty, bounded below by 0.
 */
export function getItemOrderDeficit(item: Consumable): number {
  const target = getItemTargetStock(item);
  const qty = item.currentQty ?? 0;
  const deficit = target - qty;
  return Math.max(0, deficit);
}

/**
 * Normalizes consumable name for reliable cross-cabinet matching
 */
export function normalizeConsumableName(name: string): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface CabinetStockItem {
  consumableId: string;
  cabinetId: string;
  cabinetName: string;
  department: string;
  currentQty: number;
  minThreshold: number;
  maxThreshold?: number;
  unit: string;
  isOutOfStock: boolean;
  isLowStock: boolean;
}

export interface MultiCabinetStockInfo {
  normalizedName: string;
  displayName: string;
  unit: string;
  totalQtyAcrossCabinets: number;
  cabinetLocations: CabinetStockItem[];
  hasMultipleCabinets: boolean;
  otherCabinets: CabinetStockItem[];
  breakdownText: string;
}

/**
 * Calculates cross-cabinet stock information for a consumable
 * (e.g. checks if the same item exists in CMT cabinet and QA/QC cabinet)
 */
export function getMultiCabinetStockInfo(
  targetItem: Consumable,
  allConsumables: Consumable[],
  getCabinetName: (id: string) => string
): MultiCabinetStockInfo {
  const norm = normalizeConsumableName(targetItem.name);
  const matching = allConsumables.filter(c => normalizeConsumableName(c.name) === norm);

  const cabinetLocations: CabinetStockItem[] = matching.map(c => ({
    consumableId: c.id,
    cabinetId: c.cabinetId,
    cabinetName: getCabinetName(c.cabinetId) || "ตู้ไม่ระบุ",
    department: c.department || "-",
    currentQty: c.currentQty ?? 0,
    minThreshold: c.minThreshold ?? 0,
    maxThreshold: c.maxThreshold,
    unit: c.unit || targetItem.unit || "ชิ้น",
    isOutOfStock: isItemOutOfStock(c),
    isLowStock: isItemLowStock(c)
  }));

  const totalQtyAcrossCabinets = matching.reduce((sum, c) => sum + (c.currentQty ?? 0), 0);
  const hasMultipleCabinets = cabinetLocations.length > 1;
  const otherCabinets = cabinetLocations.filter(loc => loc.consumableId !== targetItem.id);

  const breakdownText = cabinetLocations
    .map(loc => `${loc.cabinetName}: ${loc.currentQty} ${loc.unit}`)
    .join(" • ");

  return {
    normalizedName: norm,
    displayName: targetItem.name,
    unit: targetItem.unit || "ชิ้น",
    totalQtyAcrossCabinets,
    cabinetLocations,
    hasMultipleCabinets,
    otherCabinets,
    breakdownText
  };
}
