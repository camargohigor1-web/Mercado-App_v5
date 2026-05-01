// ─── Core Types ──────────────────────────────────────────────────────────────

export interface Item {
  id: string;
  name: string;
  type: "bulk" | "packaged";
  category: string;
  unit?: string;
  displayUnit?: string;
  pkgSize?: number;
  pkgUnit?: string;
  alertDays?: number; // custom threshold, default 15
}

export interface Market {
  id: string;
  name: string;
  description?: string;
}

export interface PurchaseLine {
  itemId: string;
  numPkgs: number;
  pkgQty?: number;
  totalQty?: number;
  pricePerPkg: number;
  pricePerPkgAfterDiscount?: number;
  discountTotal: number;
  discountPerPkg: number;
  pricePerUnit?: number;
  pricePerInternal?: number;
  total: number;
  brand?: string;
  note?: string;
}

export interface Purchase {
  id: string;
  marketId: string;
  date: string;
  lines: PurchaseLine[];
  total: number;
  note?: string;
}

export interface ShoppingListItem {
  itemId: string;
  done: boolean;
  saved: false;
}

export interface SavedShoppingList {
  id: string;
  name: string;
  date: string;
  items: ShoppingListItem[];
  saved: true;
}

export type ShoppingListEntry = ShoppingListItem | SavedShoppingList;

export interface WarehouseEntry {
  id: string;
  type: "update";
  date: string;
  realQty: number;
  previousStock: number;
  consumed: number;
  note?: string;
}

export interface WarehouseItem {
  id: string;
  itemId: string;
  stock: number;
  purchased: number;
  entries: WarehouseEntry[];
}

export interface ItemStats {
  avgMonthly: number;
  count: number;
  entries: StatsEntry[];
  avgPrice: number;
  minPrice: number;
  lastPrice: number;
  avgInternal?: number | null;
  minInternal?: number | null;
  lastInternal?: number | null;
}

export interface StatsEntry {
  qty?: number;
  pricePerUnit?: number;
  pricePerPkg?: number;
  pricePerInternal?: number;
  date: string;
  market: string;
  numPkgs?: number;
  pkgQty?: number;
  totalQty?: number;
  discountTotal?: number;
  discountPerPkg?: number;
  pricePerPkgAfterDiscount?: number;
  total?: number;
  brand?: string;
}

export interface AppData {
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  shoppingList: ShoppingListEntry[];
  warehouse: WarehouseItem[];
  categories: string[];
}
