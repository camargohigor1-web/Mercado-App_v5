import { useState, useCallback } from "react";
import { ThemeCtx } from "./hooks/useTheme";
import { Icon } from "./components/Icon";
import { SplashScreen } from "./components/SplashScreen";
import { HomeSection } from "./components/HomeSection";
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
const EXTRA_TABS = ["purchases", "markets", "backup", "reports", "items"];

const TITLES: Record<string, string> = {
  home:      "Início",
  shopping:  "Lista de Compras",
  purchases: "Nova Compra",
  history:   "Histórico",
  warehouse: "Armazém",
  items:     "Produtos",
  markets:   "Mercados",
  backup:    "Backup e Restauração",
  reports:   "Relatório de Compras",
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]       = useState("home");
  const [drawerOpen, setDrawer] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
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
  const [pendingKey, setPendingKey] = useState(0);
  const [reportsMonth, setReportsMonth] = useState<string | undefined>(undefined);

  function handleConvertToPurchase(lines: PurchaseLine[]) {
    setPendingLines(lines);
    setTab("purchases");
  }

  function handlePurchaseCreatedFromList() {
    setPendingLines(null);
    // Clear checked items from list after converting
    setList(list.filter(l => l.saved));
  }

  // ── Repeat purchase from home ───────────────────────────────────────────────
  function handleRepeatPurchase(purchase: Purchase) {
    setPendingLines(purchase.lines.map(l => ({ ...l })));
    setPendingKey(Date.now());
    setTab("purchases");
  }

  function handleGoToNewPurchase() {
    setPendingLines(null);
    setPendingKey(Date.now());
    setTab("purchases");
  }

  function handleGoToReports(month: string) {
    setReportsMonth(month);
    setTab("reports");
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
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <div className={`min-h-screen ${isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"} flex flex-col max-w-lg mx-auto`}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className={`sticky top-0 z-20 ${isDark ? "bg-slate-950/95" : "bg-white/95"} backdrop-blur px-4 pt-6 pb-3 ${isDark ? "border-b border-slate-900" : "border-b border-slate-100"}`}>
          <div className="flex items-center gap-3">
            {/* App icon */}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30 flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)" }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black text-teal-500 uppercase tracking-widest leading-none">MercadoApp</p>
              <p className={`text-sm font-black truncate ${isDark ? "text-slate-200" : "text-slate-800"} leading-tight mt-0.5`}>{TITLES[tab]}</p>
            </div>
            {isExtra && (
              <button
                onClick={() => setTab("home")}
                className={`${isDark ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"} p-1.5 rounded-xl transition-colors flex-shrink-0`}
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
          <div key={tab} className="animate-fade-slide-up">
          {tab === "home" && (
            <HomeSection
              items={items}
              markets={markets}
              purchases={purchases}
              warehouse={warehouse}
              shoppingList={list}
              onGoToNewPurchase={handleGoToNewPurchase}
              onGoToHistory={() => setTab("history")}
              onGoToWarehouse={() => setTab("warehouse")}
              onGoToItems={() => setTab("items")}
              onRepeatPurchase={handleRepeatPurchase}
              onGoToReports={handleGoToReports}
            />
          )}
          {tab === "shopping" && (
            <ShoppingListSection
              items={items}
              markets={markets}
              purchases={purchases}
              warehouse={warehouse}
              shoppingList={list}
              setShoppingList={setList}
              onConvertToPurchase={handleConvertToPurchase}
              onGoToItems={() => setTab("items")}
            />
          )}
          {tab === "history" && (
            <HistorySection
              items={items}
              markets={markets}
              purchases={purchases}
              warehouse={warehouse}
              onGoToNewPurchase={handleGoToNewPurchase}
              onRepeatPurchase={handleRepeatPurchase}
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
              onGoToNewPurchase={handleGoToNewPurchase}
            />
          )}
          {tab === "purchases" && (
            <PurchasesSection
              key={pendingKey}
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
              initialMonth={reportsMonth}
            />
          )}
          {tab === "backup" && (
            <BackupSection
              items={items}
              markets={markets}
              purchases={purchases}
              shoppingList={list}
              warehouse={warehouse}
              categories={categories}
              onRestore={handleRestore}
            />
          )}
          </div>{/* end animate wrapper */}
        </div>

        {/* ── Bottom Nav ─────────────────────────────────────────────────────── */}
        <div className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg ${isDark ? "bg-slate-950/95" : "bg-white/95"} backdrop-blur ${isDark ? "border-t border-slate-900" : "border-t border-slate-200"} z-20`}>
          <div className="flex items-end pb-2">

            {/* Lista */}
            <NavTab id="shopping" label="Lista" icon="list" active={tab === "shopping"} isDark={isDark} onClick={() => setTab("shopping")} />

            {/* Histórico */}
            <NavTab id="history" label="Hist." icon="history" active={tab === "history"} isDark={isDark} onClick={() => setTab("history")} />

            {/* Início — centro destacado */}
            <div className="flex-1 flex flex-col items-center pb-1">
              <button
                onClick={() => setTab("home")}
                className={`w-14 h-14 -mt-5 rounded-2xl flex items-center justify-center shadow-xl transition-all active:scale-95 border-4 fab-pulse animate-scale-in ${
                  tab === "home"
                    ? "bg-teal-500 text-white shadow-teal-500/40"
                    : isDark
                      ? "bg-slate-800 text-teal-400 shadow-slate-900/60 border-slate-950"
                      : "bg-teal-500 text-white shadow-teal-500/30"
                }`}
                style={{ borderColor: isDark ? "rgb(2 6 23)" : "rgb(255 255 255)" }}
              >
                <Icon name="store" size={22} />
              </button>
              <span className={`text-[8px] font-black uppercase tracking-wider mt-1 ${tab === "home" ? "text-teal-400" : isDark ? "text-slate-600" : "text-slate-400"}`}>
                Início
              </span>
            </div>

            {/* Armazém */}
            <NavTab id="warehouse" label="Armazém" icon="warehouse" active={tab === "warehouse"} isDark={isDark} onClick={() => setTab("warehouse")} />

            {/* Mais */}
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

// ── NavTab helper ──────────────────────────────────────────────────────────────
function NavTab({ id, label, icon, active, isDark, onClick }: {
  id: string; label: string; icon: string;
  active: boolean; isDark: boolean; onClick: () => void;
}) {
  return (
    <button
      key={id}
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all ${active ? "text-teal-400" : isDark ? "text-slate-700 hover:text-slate-500" : "text-slate-500 hover:text-slate-700"}`}
    >
      <Icon name={icon} size={18} />
      <span className="text-[8px] font-black uppercase tracking-wider leading-none">{label}</span>
      {active && <div className="w-1 h-1 rounded-full bg-teal-400 mt-0.5" />}
    </button>
  );
}
