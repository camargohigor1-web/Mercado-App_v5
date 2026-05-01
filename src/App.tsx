import { useState, useCallback } from "react";
import { ThemeCtx } from "./hooks/useTheme";
import { Icon } from "./components/Icon";
import { ItemsSection } from "./components/ItemsSection";
import { MarketsSection } from "./components/MarketsSection";
import { PurchasesSection } from "./components/PurchasesSection";
import { HistorySection } from "./components/HistorySection";
import { WarehouseSection } from "./components/WarehouseSection";
import { ShoppingListSection } from "./components/ShoppingListSection";
import { ReportsSection } from "./components/ReportsSection";
import { BackupSection } from "./components/BackupSection";
import { RightDrawer } from "./components/RightDrawer";
import { KEYS, load, save, DEFAULT_CATEGORIES } from "./utils";
import type { Item, Market, Purchase, ShoppingListEntry, WarehouseItem, PurchaseLine } from "./types";

// ─── Tab config ───────────────────────────────────────────────────────────────
const MAIN_TABS = [
  { id: "shopping",  label: "Lista",   icon: "list"      },
  { id: "history",   label: "Hist.",   icon: "history"   },
  { id: "warehouse", label: "Armazém", icon: "warehouse" },
];

const EXTRA_TABS = ["purchases", "items", "markets", "backup", "reports"];

const TITLES: Record<string, string> = {
  shopping:  "Lista de Compras",
  purchases: "Minhas Compras",
  history:   "Histórico",
  warehouse: "Armazém",
  items:     "Produtos",
  markets:   "Mercados",
  backup:    "Backup e Restauração",
  reports:   "Relatório de Compras",
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]       = useState("shopping");
  const [drawerOpen, setDrawer] = useState(false);
  const [theme, setThemeRaw]    = useState<string>(() => load(KEYS.theme, "dark"));

  const [items,     setItemsRaw]     = useState<Item[]>            (() => load(KEYS.items,        []));
  const [markets,   setMarketsRaw]   = useState<Market[]>          (() => load(KEYS.markets,      []));
  const [purchases, setPurchasesRaw] = useState<Purchase[]>        (() => load(KEYS.purchases,    []));
  const [list,      setListRaw]      = useState<ShoppingListEntry[]>(() => load(KEYS.shoppingList, []));
  const [warehouse, setWarehouseRaw] = useState<WarehouseItem[]>   (() => load(KEYS.warehouse,    []));
  const [categories, setCategoriesRaw] = useState<string[]>(() => {
    const stored = load(KEYS.categories, null);
    return stored ?? DEFAULT_CATEGORIES;
  });

  // Persisted setters
  const setTheme     = useCallback((v: string)              => { setThemeRaw(v);        save(KEYS.theme,        v); }, []);
  const setItems     = useCallback((v: Item[])              => { setItemsRaw(v);         save(KEYS.items,        v); }, []);
  const setMarkets   = useCallback((v: Market[])            => { setMarketsRaw(v);       save(KEYS.markets,      v); }, []);
  const setPurchases = useCallback((v: Purchase[])          => { setPurchasesRaw(v);     save(KEYS.purchases,    v); }, []);
  const setList      = useCallback((v: ShoppingListEntry[]) => { setListRaw(v);          save(KEYS.shoppingList, v); }, []);
  const setWarehouse = useCallback((v: WarehouseItem[])     => { setWarehouseRaw(v);     save(KEYS.warehouse,    v); }, []);
  const setCategories = useCallback((v: string[])           => { setCategoriesRaw(v);    save(KEYS.categories,   v); }, []);

  // ── Convert shopping list → new purchase ───────────────────────────────────
  const [pendingLines, setPendingLines] = useState<PurchaseLine[] | null>(null);

  function handleConvertToPurchase(lines: PurchaseLine[]) {
    setPendingLines(lines);
    setTab("purchases");
  }

  function handlePurchaseCreatedFromList() {
    setPendingLines(null);
    // Clear checked items from list after converting
    setList(list.filter(l => l.saved));
  }

  // ── Restore from backup ────────────────────────────────────────────────────
  function handleRestore(data: {
    items: Item[];
    markets: Market[];
    purchases: Purchase[];
    shoppingList: ShoppingListEntry[];
    warehouse: WarehouseItem[];
    categories?: string[];
  }) {
    setItems(data.items);
    setMarkets(data.markets);
    setPurchases(data.purchases);
    setList(data.shoppingList);
    setWarehouse(data.warehouse || []);
    if (data.categories) setCategories(data.categories);
    setTab("shopping");
  }

  const isDark   = theme === "dark";
  const isExtra  = EXTRA_TABS.includes(tab);

  return (
    <ThemeCtx.Provider value={{ isDark }}>
      <div className={`min-h-screen ${isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"} flex flex-col max-w-lg mx-auto`}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className={`sticky top-0 z-20 ${isDark ? "bg-slate-950/95" : "bg-white/95"} backdrop-blur px-4 pt-6 pb-3 ${isDark ? "border-b border-slate-900" : "border-b border-slate-200"}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <Icon name="cart" size={13} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-teal-500 uppercase tracking-widest leading-none">MercadoApp</p>
              <p className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"} leading-tight mt-0.5`}>{TITLES[tab]}</p>
            </div>
            {isExtra && (
              <button
                onClick={() => setTab("shopping")}
                className={`${isDark ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"} p-1.5 rounded-xl transition-colors`}
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
          {tab === "shopping" && (
            <ShoppingListSection
              items={items}
              markets={markets}
              purchases={purchases}
              warehouse={warehouse}
              shoppingList={list}
              setShoppingList={setList}
              onConvertToPurchase={handleConvertToPurchase}
            />
          )}
          {tab === "history" && (
            <HistorySection
              items={items}
              markets={markets}
              purchases={purchases}
              warehouse={warehouse}
            />
          )}
          {tab === "warehouse" && (
            <WarehouseSection
              items={items}
              purchases={purchases}
              warehouse={warehouse}
              setWarehouse={setWarehouse}
              categories={categories}
              shoppingList={list}
              setShoppingList={setList}
            />
          )}
          {tab === "purchases" && (
            <PurchasesSection
              items={items}
              markets={markets}
              purchases={purchases}
              setPurchases={setPurchases}
              warehouse={warehouse}
              setWarehouse={setWarehouse}
              initialLines={pendingLines ?? undefined}
              onCreatedFromList={pendingLines ? handlePurchaseCreatedFromList : undefined}
            />
          )}
          {tab === "items" && (
            <ItemsSection
              items={items}
              setItems={setItems}
              categories={categories}
              setCategories={setCategories}
            />
          )}
          {tab === "markets" && (
            <MarketsSection
              markets={markets}
              setMarkets={setMarkets}
            />
          )}
          {tab === "reports" && (
            <ReportsSection
              items={items}
              markets={markets}
              purchases={purchases}
              warehouse={warehouse}
            />
          )}
          {tab === "backup" && (
            <BackupSection
              items={items}
              markets={markets}
              purchases={purchases}
              shoppingList={list}
              warehouse={warehouse}
              onRestore={handleRestore}
            />
          )}
        </div>

        {/* ── Bottom Nav ─────────────────────────────────────────────────────── */}
        <div className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg ${isDark ? "bg-slate-950/95" : "bg-white/95"} backdrop-blur ${isDark ? "border-t border-slate-900" : "border-t border-slate-200"} z-20`}>
          <div className="flex">
            {MAIN_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all ${tab === t.id ? "text-teal-400" : isDark ? "text-slate-700 hover:text-slate-500" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Icon name={t.icon} size={18} />
                <span className="text-[8px] font-black uppercase tracking-wider leading-none">{t.label}</span>
                {tab === t.id && <div className="w-1 h-1 rounded-full bg-teal-400 mt-0.5" />}
              </button>
            ))}
            <button
              onClick={() => setDrawer(true)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all ${isExtra ? "text-teal-400" : isDark ? "text-slate-700 hover:text-slate-500" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Icon name="menu" size={18} />
              <span className="text-[8px] font-black uppercase tracking-wider leading-none">Mais</span>
              {isExtra && <div className="w-1 h-1 rounded-full bg-teal-400 mt-0.5" />}
            </button>
          </div>
        </div>

        {/* ── Right Drawer ───────────────────────────────────────────────────── */}
        <RightDrawer
          open={drawerOpen}
          onClose={() => setDrawer(false)}
          tab={tab}
          setTab={setTab}
          theme={theme}
          setTheme={setTheme}
        />
      </div>
    </ThemeCtx.Provider>
  );
}
