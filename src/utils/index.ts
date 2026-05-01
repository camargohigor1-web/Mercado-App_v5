import type { Item, ItemStats, Purchase, WarehouseEntry } from "../types";

// ─── Storage ──────────────────────────────────────────────────────────────────
export const KEYS = {
  items:        "mkt3_items",
  markets:      "mkt3_markets",
  purchases:    "mkt3_purchases",
  shoppingList: "mkt3_list",
  warehouse:    "mkt3_warehouse",
  theme:        "mkt3_theme",
  categories:   "mkt3_categories",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function load(key: string, fb: any): any {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function save(key: string, val: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// ─── Formatting ──────────────────────────────────────────────────────────────
export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function fmt(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtN(n: number, d = 2): string {
  return Number(n).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

// ─── Unit Scale System ────────────────────────────────────────────────────────
export const BULK_UNITS = ["kg", "L", "m", "un", "dz"];
export const PKG_UNITS = [
  "un", "g", "kg", "mL", "L", "m", "rolos", "folhas", "pares", "caps", "saches", "doses",
];

export const DEFAULT_CATEGORIES = [
  "Hortifruti", "Carnes e Aves", "Laticinios", "Padaria", "Bebidas",
  "Limpeza", "Higiene", "Mercearia", "Congelados", "Outro",
];

export const UNIT_SCALE_MAP: Record<string, { unit: string; factor: number }[]> = {
  kg: [{ unit: "kg", factor: 1 }, { unit: "g", factor: 1000 }],
  L:  [{ unit: "L", factor: 1 }, { unit: "mL", factor: 1000 }],
  m:  [{ unit: "m", factor: 1 }, { unit: "cm", factor: 100 }],
};

export function getScaleOptions(baseUnit: string): { unit: string; factor: number }[] {
  return UNIT_SCALE_MAP[baseUnit] || [{ unit: baseUnit, factor: 1 }];
}

export function getDisplayFactor(item: Item): number {
  if (!item || item.type !== "bulk") return 1;
  const options = getScaleOptions(item.unit!);
  const opt = options.find((o) => o.unit === item.displayUnit);
  return opt ? opt.factor : 1;
}

export function getDisplayUnit(item: Item): string {
  if (!item) return "";
  if (item.type !== "bulk") return item.pkgUnit || "un";
  return item.displayUnit || item.unit || "";
}

export function getWarehouseUnit(item: Item): string {
  if (!item) return "";
  if (item.type !== "bulk") return "emb";
  return item.displayUnit || item.unit || "";
}

// ─── Stats Calculation ────────────────────────────────────────────────────────
export function calcStats(
  itemId: string,
  items: Item[],
  purchases: Purchase[],
  warehouseEntries: WarehouseEntry[]
): ItemStats | null {
  const item = items.find((i) => i.id === itemId);
  if (!item) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = [];
  purchases.forEach((p) => {
    p.lines.forEach((l) => {
      if (l.itemId !== itemId) return;
      if (item.type === "bulk") {
        entries.push({
          qty: l.totalQty,
          pricePerUnit: l.pricePerUnit,
          date: p.date,
          market: p.marketId,
          numPkgs: l.numPkgs,
          pkgQty: l.pkgQty,
          totalQty: l.totalQty,
          discountTotal: l.discountTotal,
          discountPerPkg: l.discountPerPkg,
          pricePerPkg: l.pricePerPkg,
          pricePerPkgAfterDiscount: l.pricePerPkgAfterDiscount,
          total: l.total,
          brand: l.brand,
        });
      } else {
        const effectivePricePerPkg =
          l.pricePerPkgAfterDiscount ?? l.pricePerPkg;
        const effectivePricePerInternal =
          l.discountTotal > 0
            ? effectivePricePerPkg / (item.pkgSize || 1)
            : l.pricePerInternal;
        entries.push({
          qty: l.numPkgs,
          pricePerPkg: effectivePricePerPkg,
          pricePerInternal: effectivePricePerInternal,
          date: p.date,
          market: p.marketId,
          numPkgs: l.numPkgs,
          discountTotal: l.discountTotal,
          discountPerPkg: l.discountPerPkg,
          pricePerPkgAfterDiscount: l.pricePerPkgAfterDiscount,
          total: l.total,
          brand: l.brand,
        });
      }
    });
  });

  // ── Consumo médio mensal ─────────────────────────────────────────────────
  // Baseado apenas nas compras. Denominador = meses distintos com compra,
  // evitando distorção por meses sem registro e por somar consumo do armazém.
  const byMonth: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entries.forEach(({ qty, date }: any) => {
    const k = date.slice(0, 7);
    byMonth[k] = (byMonth[k] || 0) + qty;
  });
  const monthValues = Object.values(byMonth);
  const avgMonthly = monthValues.length
    ? monthValues.reduce((a, b) => a + b, 0) / monthValues.length
    : 0;

  if (item.type === "bulk") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prices = entries.map((e: any) => e.pricePerUnit);
    return {
      avgMonthly,
      count: entries.length,
      entries,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      minPrice: Math.min(...prices),
      lastPrice: prices[prices.length - 1],
    };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkgPrices = entries.map((e: any) => e.pricePerPkg);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const intPrices = entries.map((e: any) => e.pricePerInternal).filter(Boolean);
    return {
      avgMonthly,
      count: entries.length,
      entries,
      avgPrice: pkgPrices.reduce((a, b) => a + b, 0) / pkgPrices.length,
      minPrice: Math.min(...pkgPrices),
      lastPrice: pkgPrices[pkgPrices.length - 1],
      avgInternal: intPrices.length
        ? intPrices.reduce((a, b) => a + b, 0) / intPrices.length
        : null,
      minInternal: intPrices.length ? Math.min(...intPrices) : null,
      lastInternal: intPrices.length ? intPrices[intPrices.length - 1] : null,
    };
  }
}

// ─── Price by Market ──────────────────────────────────────────────────────────
export function calcPriceByMarket(
  itemId: string,
  items: Item[],
  purchases: Purchase[],
  markets: { id: string; name: string }[]
): { marketName: string; avgPrice: number; count: number }[] {
  const item = items.find((i) => i.id === itemId);
  if (!item) return [];

  const byMarket: Record<string, number[]> = {};
  purchases.forEach((p) => {
    p.lines.forEach((l) => {
      if (l.itemId !== itemId) return;
      const mktName = markets.find((m) => m.id === p.marketId)?.name || "?";
      if (!byMarket[mktName]) byMarket[mktName] = [];
      if (item.type === "bulk") {
        byMarket[mktName].push(l.pricePerUnit || 0);
      } else {
        byMarket[mktName].push(
          l.pricePerPkgAfterDiscount ?? l.pricePerPkg
        );
      }
    });
  });

  return Object.entries(byMarket)
    .map(([marketName, prices]) => ({
      marketName,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      count: prices.length,
    }))
    .sort((a, b) => a.avgPrice - b.avgPrice);
}
