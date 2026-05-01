import { useState, useRef } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Btn, Inp, Modal, Card, Badge, Empty, InfoBox, ConfirmModal } from "./ui";
import { uid, fmt, fmtN, getDisplayFactor, getDisplayUnit, calcStats } from "../utils";
import type { Item, Market, Purchase, WarehouseItem, ShoppingListEntry, ShoppingListItem, SavedShoppingList, PurchaseLine } from "../types";

interface ShoppingListSectionProps {
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  warehouse: WarehouseItem[];
  shoppingList: ShoppingListEntry[];
  setShoppingList: (l: ShoppingListEntry[]) => void;
  onConvertToPurchase: (lines: PurchaseLine[]) => void;
}

export function ShoppingListSection({
  items, markets, purchases, warehouse, shoppingList, setShoppingList, onConvertToPurchase,
}: ShoppingListSectionProps) {
  const { isDark } = useTheme();
  const [listMode, setListMode] = useState<"plan" | "market">("plan");
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [savedListsModal, setSavedListsModal] = useState(false);
  const [decisionItem, setDecisionItem] = useState<Item | null>(null);
  const [priceCompareModal, setPriceCompareModal] = useState(false);
  const [compareItem, setCompareItem] = useState<Item | null>(null);
  const [compareOptions, setCompareOptions] = useState<{ sizeNum: number; priceNum: number; unit: string }[]>([]);
  const [newOption, setNewOption] = useState({ size: "", price: "" });
  const [convertModal, setConvertModal] = useState(false);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const sizeRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const activeList = shoppingList.filter((l): l is ShoppingListItem => !l.saved);
  const savedLists = shoppingList.filter((l): l is SavedShoppingList => l.saved);
  const inList = new Set(activeList.map(l => l.itemId));

  const withStats = items.map(i => ({
    item: i,
    stats: calcStats(i.id, items, purchases, warehouse.flatMap(w => w.entries || [])),
  }));
  const available = withStats.filter(({ item }) => !inList.has(item.id));
  const filtAvail = available.filter(({ item }) => item.name.toLowerCase().includes(search.toLowerCase()));

  function add(itemId: string) { setShoppingList([...shoppingList, { itemId, done: false, saved: false }]); }
  function remove(itemId: string) { setShoppingList(shoppingList.filter(l => l.saved || (l as ShoppingListItem).itemId !== itemId)); }
  function toggle(itemId: string) {
    setShoppingList(shoppingList.map(l => (!l.saved && (l as ShoppingListItem).itemId === itemId) ? { ...l, done: !(l as ShoppingListItem).done } : l));
  }
  function clearDone() { setShoppingList(shoppingList.filter(l => l.saved || !(l as ShoppingListItem).done)); }
  function clearAll() { setShoppingList(shoppingList.filter(l => l.saved)); setClearAllConfirm(false); }

  function saveList() {
    if (!editName.trim() || activeList.length === 0) return;
    const saved: SavedShoppingList = { id: uid(), name: editName.trim(), date: new Date().toISOString().slice(0, 10), items: activeList, saved: true };
    setShoppingList([...shoppingList.filter(l => l.saved), saved, ...shoppingList.filter(l => !l.saved)]);
    setEditModal(false); setEditName("");
  }

  function loadSavedList(list: SavedShoppingList) {
    const newItems = list.items.filter(i => !inList.has(i.itemId));
    setShoppingList([...shoppingList.filter(l => !l.saved), ...shoppingList.filter(l => l.saved), ...newItems]);
    setSavedListsModal(false);
  }

  function deleteSavedList(id: string) {
    setShoppingList(shoppingList.filter(l => !(l.saved && (l as SavedShoppingList).id === id)));
  }

  function autoSuggest() {
    const ids = available
      .filter(({ stats }) => stats !== null)
      .sort((a, b) => b.stats!.avgMonthly - a.stats!.avgMonthly)
      .slice(0, 8)
      .map(({ item }) => item.id);
    const toAdd = ids.filter(id => !inList.has(id)).map(id => ({ itemId: id, done: false, saved: false as const }));
    setShoppingList([...shoppingList, ...toAdd]);
  }

  // Convert active list to purchase lines (only items with history)
  function handleConvertToPurchase() {
    const lines: PurchaseLine[] = activeList
      .map(li => {
        const item = items.find(i => i.id === li.itemId);
        if (!item) return null;
        const stats = calcStats(li.itemId, items, purchases, warehouse.flatMap(w => w.entries || []));
        if (!stats || !stats.entries.length) return null;
        // Use last known price and qty
        const last = stats.entries[stats.entries.length - 1];
        if (item.type === "bulk") {
          const pricePerUnit = last.pricePerUnit || 0;
          const pkgQty = last.pkgQty || 1;
          const numPkgs = 1;
          const totalQty = numPkgs * pkgQty;
          const pricePerPkg = pricePerUnit * pkgQty;
          return {
            itemId: li.itemId, numPkgs, pkgQty, totalQty,
            pricePerPkg, pricePerPkgAfterDiscount: pricePerPkg,
            discountTotal: 0, discountPerPkg: 0, pricePerUnit, total: pricePerPkg,
          } as PurchaseLine;
        } else {
          const pricePerPkg = last.pricePerPkg || 0;
          const pricePerInternal = last.pricePerInternal || 0;
          return {
            itemId: li.itemId, numPkgs: 1,
            pricePerPkg, pricePerPkgAfterDiscount: pricePerPkg,
            discountTotal: 0, discountPerPkg: 0, pricePerInternal, total: pricePerPkg,
          } as PurchaseLine;
        }
      })
      .filter(Boolean) as PurchaseLine[];
    if (lines.length > 0) {
      onConvertToPurchase(lines);
      setConvertModal(false);
    }
  }

  // Decision guide modal
  function openDecision(item: Item) { setDecisionItem(item); }

  // Price compare (manual market options)
  function openPriceCompare(item: Item) {
    setCompareItem(item);
    setCompareOptions([]);
    setNewOption({ size: "", price: "" });
    setPriceCompareModal(true);
  }

  function addCompareOption() {
    if (newOption.size && newOption.price && compareItem) {
      const size = Number(newOption.size.replace(",", "."));
      const price = Number(newOption.price.replace(",", "."));
      if (size > 0 && price >= 0) {
        const du = getDisplayUnit(compareItem);
        setCompareOptions([...compareOptions, { sizeNum: size, priceNum: price, unit: du }]);
        setNewOption({ size: "", price: "" });
        if (sizeRef.current) sizeRef.current.focus();
      }
    }
  }

  function calculateBestOption() {
    if (compareOptions.length === 0) return null;
    const analyzed = compareOptions.map(opt => ({ ...opt, pricePerUnit: opt.priceNum / opt.sizeNum }));
    return analyzed.reduce((min, curr) => curr.pricePerUnit < min.pricePerUnit ? curr : min);
  }

  function getItemInsights(item: Item, stats: ReturnType<typeof calcStats>) {
    if (!stats) return null;
    const factor = getDisplayFactor(item);
    const du = getDisplayUnit(item);
    if (item.type === "bulk") {
      return {
        consumption: `${fmtN(stats.avgMonthly * factor, 2)} ${du}/mês`,
        avg: `${fmt(stats.avgPrice / factor)}/${du}`,
        last: `${fmt(stats.lastPrice / factor)}/${du}`,
        min: `${fmt(stats.minPrice / factor)}/${du}`,
      };
    }
    return {
      consumption: `${fmtN(stats.avgMonthly, 1)} emb/mês`,
      avg: `${fmt(stats.avgPrice)}/emb`,
      last: `${fmt(stats.lastPrice)}/emb`,
      min: `${fmt(stats.minPrice)}/emb`,
    };
  }

  const listFull = activeList.map(l => ({
    ...l,
    item: items.find(i => i.id === l.itemId),
    stats: calcStats(l.itemId, items, purchases, warehouse.flatMap(w => w.entries || [])),
  })).filter(l => l.item);

  const pending = listFull.filter(l => !l.done);
  const done = listFull.filter(l => l.done);

  const pendingByCategory: Record<string, typeof pending> = {};
  pending.forEach(({ itemId, item, stats, done }) => {
    const cat = item!.category || "Sem categoria";
    if (!pendingByCategory[cat]) pendingByCategory[cat] = [];
    pendingByCategory[cat].push({ itemId, item, stats, done, saved: false });
  });

  return (
    <div className="space-y-4">
      <div className={`flex gap-2 ${isDark ? "bg-slate-900" : "bg-slate-100"} rounded-xl p-1`}>
        <button
          onClick={() => setListMode("plan")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${listMode === "plan" ? "bg-teal-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
        >
          Planejar
        </button>
        <button
          onClick={() => setListMode("market")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${listMode === "market" ? "bg-blue-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
        >
          Mercado
        </button>
      </div>

      {/* Toolbar */}
      {listMode === "plan" && <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          {available.some(({ stats }) => stats !== null) && (
            <Btn onClick={autoSuggest} variant="outline" size="sm"><Icon name="history" size={13} />Sugerir</Btn>
          )}
          {savedLists.length > 0 && (
            <Btn onClick={() => setSavedListsModal(true)} variant="outline" size="sm"><Icon name="list" size={13} />Listas ({savedLists.length})</Btn>
          )}
        </div>
        <div className="flex gap-2">
          {listFull.some(l => l.done) && <Btn onClick={clearDone} variant="ghost" size="sm">Limpar marcados</Btn>}
          {activeList.length > 0 && (
            <>
              <Btn onClick={() => setClearAllConfirm(true)} variant="danger" size="sm"><Icon name="trash" size={13} />Limpar tudo</Btn>
              <Btn onClick={() => setConvertModal(true)} variant="outline" size="sm"><Icon name="cart" size={13} />Compra</Btn>
              <Btn onClick={() => { setEditName(""); setEditModal(true); }} variant="success" size="sm"><Icon name="check" size={13} />Salvar</Btn>
            </>
          )}
        </div>
      </div>}

      {/* Market mode */}
      {listMode === "market" && (
        listFull.length === 0 ? (
          <Empty icon="list" title="Lista vazia" sub="Volte para Planejar e adicione os produtos antes de ir ao mercado." />
        ) : (
          <div className="space-y-3">
            <div className={`flex items-center justify-between px-4 py-3 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl`}>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modo mercado</p>
                <p className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{pending.length} pendente{pending.length === 1 ? "" : "s"} · {done.length} comprado{done.length === 1 ? "" : "s"}</p>
              </div>
              {done.length > 0 && <Btn onClick={clearDone} variant="ghost" size="sm">Limpar</Btn>}
            </div>

            {pending.length === 0 ? (
              <Empty icon="check" title="Tudo marcado" sub="Os itens da lista foram marcados como comprados." />
            ) : (
              Object.entries(pendingByCategory).map(([cat, catItems]) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-1">{cat}</p>
                  <div className="space-y-2">
                    {catItems.map(({ itemId, item, stats }) => {
                      const it = item!;
                      const du = getDisplayUnit(it);
                      const insights = getItemInsights(it, stats);
                      return (
                        <Card key={itemId} className={isDark ? "border-slate-800" : "border-slate-200"}>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggle(itemId)}
                                className="mt-0.5 w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30 flex-shrink-0 flex items-center justify-center"
                                title="Marcar comprado"
                              >
                                <Icon name="check" size={17} />
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`${isDark ? "text-slate-100" : "text-slate-900"} text-base font-black`}>{it.name}</p>
                                  <Badge color={it.type === "bulk" ? "teal" : "amber"}>{it.type === "bulk" ? du : `${fmtN(it.pkgSize || 0, 0)} ${it.pkgUnit}`}</Badge>
                                </div>
                                {insights ? (
                                  <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className={`${isDark ? "bg-slate-800/70" : "bg-slate-100"} rounded-xl px-2.5 py-2`}>
                                      <p className="text-[9px] text-slate-500">Consumo</p>
                                      <p className="text-[11px] font-bold text-slate-300">{insights.consumption}</p>
                                    </div>
                                    <div className="bg-green-500/10 rounded-xl px-2.5 py-2">
                                      <p className="text-[9px] text-green-700">Médio</p>
                                      <p className="text-[11px] font-bold text-green-400">{insights.avg}</p>
                                    </div>
                                    <div className="bg-blue-500/10 rounded-xl px-2.5 py-2">
                                      <p className="text-[9px] text-blue-700">Último</p>
                                      <p className="text-[11px] font-bold text-blue-400">{insights.last}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-600 mt-1">Sem histórico de compras</p>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Btn onClick={() => openPriceCompare(it)} variant="outline" size="sm" className="justify-center"><Icon name="scale" size={13} />Comparar</Btn>
                              <Btn onClick={() => remove(itemId)} variant="ghost" size="sm" className="justify-center"><Icon name="x" size={13} />Remover</Btn>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {done.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest pt-1">Já comprado ({done.length})</p>
                {done.map(({ itemId, item }) => (
                  <Card key={itemId} className="opacity-50">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggle(itemId)} className="w-8 h-8 rounded-xl border border-teal-500 bg-teal-500 flex-shrink-0 flex items-center justify-center"><Icon name="check" size={14} /></button>
                      <p className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"} line-through flex-1`}>{item!.name}</p>
                      <button onClick={() => remove(itemId)} className={`p-1 ${isDark ? "text-slate-700 hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}><Icon name="x" size={13} /></button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* Active list */}
      {listMode === "plan" && listFull.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Para comprar ({pending.length})</p>
          {Object.entries(pendingByCategory).map(([cat, catItems]) => (
            <div key={cat}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-1">{cat}</p>
              <div className="space-y-2">
                {catItems.map(({ itemId, item, stats }) => {
                  const it = item!;
                  const du = getDisplayUnit(it);
                  const insights = getItemInsights(it, stats);
                  const factor = getDisplayFactor(it);
                  return (
                    <Card key={itemId}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggle(itemId)} className={`mt-1 w-5 h-5 rounded-full border-2 ${isDark ? "border-slate-700" : "border-slate-300"} flex-shrink-0 hover:border-teal-500 transition-colors`} />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDecision(it)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`${isDark ? "text-slate-100" : "text-slate-900"} text-sm font-semibold`}>{it.name}</p>
                            <Badge color={it.type === "bulk" ? "teal" : "amber"}>{it.type === "bulk" ? du : `${fmtN(it.pkgSize || 0, 0)} ${it.pkgUnit}`}</Badge>
                          </div>
                          {insights && <p className="text-[10px] text-slate-600 mt-1">Consumo: <span className={isDark ? "text-slate-300" : "text-slate-700"}>{insights.consumption}</span></p>}
                          {stats ? (
                            <div className="flex flex-wrap gap-x-3 mt-1">
                              <span className="text-[10px] text-slate-600">Médio: <span className="text-green-400 font-semibold">{it.type === "bulk" ? `${fmt(stats.avgPrice / factor)}/${du}` : `${fmt(stats.avgPrice)}/emb`}</span></span>
                              <span className="text-[10px] text-slate-600">Menor: <span className="text-teal-400">{it.type === "bulk" ? fmt(stats.minPrice / factor) : fmt(stats.minPrice)}</span></span>
                              <span className="text-[10px] text-slate-600">Último: <span className="text-blue-400">{it.type === "bulk" ? fmt(stats.lastPrice / factor) : fmt(stats.lastPrice)}</span></span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-700 mt-1">Sem histórico de compras</p>
                          )}
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0 mt-0.5">
                          <button onClick={() => openPriceCompare(it)} className={`p-1 ${isDark ? "text-slate-700 hover:text-blue-400" : "text-slate-400 hover:text-blue-500"} transition-colors`} title="Comparar preços"><Icon name="scale" size={13} /></button>
                          <button onClick={() => remove(itemId)} className={`p-1 ${isDark ? "text-slate-700 hover:text-red-400" : "text-slate-400 hover:text-red-500"} transition-colors`}><Icon name="x" size={13} /></button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {done.length > 0 && (
            <>
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest pt-1">Já comprado ({done.length})</p>
              {done.map(({ itemId, item }) => (
                <Card key={itemId} className="opacity-40">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggle(itemId)} className="w-5 h-5 rounded-full border-2 border-teal-500 bg-teal-500 flex-shrink-0 flex items-center justify-center"><Icon name="check" size={11} /></button>
                    <p className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"} line-through flex-1`}>{item!.name}</p>
                    <button onClick={() => remove(itemId)} className={`p-1 ${isDark ? "text-slate-800" : "text-slate-300"}`}><Icon name="x" size={13} /></button>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* Add items */}
      {listMode === "plan" && <div>
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Adicionar à lista</p>
        <Inp value={search} onChange={setSearch} placeholder="Buscar produto..." />
        {filtAvail.length === 0 ? (
          <p className="text-slate-700 text-xs text-center py-5">{search ? "Nenhum resultado" : items.length === inList.size ? "Todos os itens já estão na lista" : "Nenhum item cadastrado"}</p>
        ) : (
          <div className="space-y-2 mt-2">
            {filtAvail.map(({ item, stats }) => {
              const du = getDisplayUnit(item);
              const factor = getDisplayFactor(item);
              return (
                <button key={item.id} onClick={() => add(item.id)} className="w-full text-left">
                  <Card className={`flex items-center justify-between ${isDark ? "hover:border-teal-500/40" : "hover:border-teal-400"}`}>
                    <div>
                      <p className={`${isDark ? "text-slate-200" : "text-slate-800"} text-sm font-medium`}>{item.name}</p>
                      <p className="text-[10px] mt-0.5">
                        {stats
                          ? <span>Médio <span className="text-green-400 font-semibold">{item.type === "bulk" ? `${fmt(stats.avgPrice / factor)}/${du}` : `${fmt(stats.avgPrice)}/emb`}</span></span>
                          : <span className="text-slate-600">Sem histórico</span>
                        }
                      </p>
                    </div>
                    <div className="text-teal-500 flex-shrink-0"><Icon name="plus" size={16} /></div>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>}

      {/* Decision Guide Modal */}
      {decisionItem && (() => {
        const item = decisionItem;
        const stats = calcStats(item.id, items, purchases, warehouse.flatMap(w => w.entries || []));
        const factor = getDisplayFactor(item);
        const du = getDisplayUnit(item);
        const allEntries: any[] = [];
        purchases.forEach(p => {
          p.lines.forEach(l => {
            if (l.itemId !== item.id) return;
            const mkt = markets.find(m => m.id === p.marketId)?.name || "?";
            allEntries.push({ ...l, date: p.date, market: mkt });
          });
        });
        allEntries.sort((a, b) => b.date.localeCompare(a.date));
        const recentEntries = allEntries.slice(0, 5);

        return (
          <Modal title={`Guia — ${item.name}`} onClose={() => setDecisionItem(null)}>
            <div className="space-y-4">
              <div className="flex gap-1.5 flex-wrap">
                <Badge color={item.type === "bulk" ? "teal" : "amber"}>{item.type === "bulk" ? "Granel" : "Emb. fixa"}</Badge>
                <Badge>{item.category}</Badge>
                {item.type === "bulk" && <Badge>{du}</Badge>}
                {item.type === "packaged" && item.pkgSize && <Badge>{fmtN(item.pkgSize, 0)} {item.pkgUnit}/emb</Badge>}
              </div>

              {!stats ? (
                <InfoBox>Nenhuma compra registrada para este produto ainda.</InfoBox>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {item.type === "bulk" ? (
                      <>
                        <div className="bg-teal-500/10 rounded-xl p-3">
                          <p className="text-[10px] text-teal-700 mb-0.5">Menor preço/{du}</p>
                          <p className="font-black text-sm text-teal-400">{fmt(stats.minPrice / factor)}</p>
                        </div>
                        <div className="bg-green-500/10 rounded-xl p-3">
                          <p className="text-[10px] text-green-700 mb-0.5">Preço médio/{du}</p>
                          <p className="font-black text-sm text-green-400">{fmt(stats.avgPrice / factor)}</p>
                        </div>
                        <div className="bg-blue-500/10 rounded-xl p-3">
                          <p className="text-[10px] text-blue-700 mb-0.5">Último preço/{du}</p>
                          <p className="font-black text-sm text-blue-400">{fmt(stats.lastPrice / factor)}</p>
                        </div>
                        <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} rounded-xl p-3`}>
                          <p className="text-[10px] text-slate-500 mb-0.5">Consumo médio/mês</p>
                          <p className="font-black text-sm">{fmtN(stats.avgMonthly * factor, 2)} {du}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-teal-500/10 rounded-xl p-3">
                          <p className="text-[10px] text-teal-700 mb-0.5">Menor preço/emb</p>
                          <p className="font-black text-sm text-teal-400">{fmt(stats.minPrice)}</p>
                        </div>
                        <div className="bg-green-500/10 rounded-xl p-3">
                          <p className="text-[10px] text-green-700 mb-0.5">Preço médio/emb</p>
                          <p className="font-black text-sm text-green-400">{fmt(stats.avgPrice)}</p>
                        </div>
                        <div className="bg-blue-500/10 rounded-xl p-3">
                          <p className="text-[10px] text-blue-700 mb-0.5">Último preço/emb</p>
                          <p className="font-black text-sm text-blue-400">{fmt(stats.lastPrice)}</p>
                        </div>
                        <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} rounded-xl p-3`}>
                          <p className="text-[10px] text-slate-500 mb-0.5">Consumo médio/mês</p>
                          <p className="font-black text-sm">{fmtN(stats.avgMonthly, 1)} emb</p>
                        </div>
                      </>
                    )}
                  </div>

                  {recentEntries.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Últimas compras</p>
                      <div className="space-y-2">
                        {recentEntries.map((e, i) => (
                          <div key={i} className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl`}>
                            <div>
                              <p className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{e.market}</p>
                              <p className="text-[10px] text-slate-500">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-teal-400">
                                {item.type === "bulk"
                                  ? `${fmt((e.pricePerUnit || 0) / factor)}/${du}`
                                  : `${fmt(e.pricePerPkgAfterDiscount ?? e.pricePerPkg)}/emb`
                                }
                              </p>
                              {e.discountTotal > 0 && <p className="text-[10px] text-amber-400">c/ desc</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <Btn onClick={() => { setDecisionItem(null); openPriceCompare(item); }} variant="outline" className="flex-1" size="sm"><Icon name="scale" size={13} />Comparar emb.</Btn>
                <Btn onClick={() => setDecisionItem(null)} variant="secondary" className="flex-1" size="sm">Fechar</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Price Compare Modal */}
      {priceCompareModal && compareItem && (() => {
        const best = calculateBestOption();
        const du = getDisplayUnit(compareItem);
        return (
          <Modal title={`Comparar Preços — ${compareItem.name}`} onClose={() => setPriceCompareModal(false)}>
            <div className="space-y-4">
              <InfoBox color="blue">Compare diferentes tamanhos/embalagens disponíveis no mercado para encontrar o melhor custo-benefício por unidade.</InfoBox>
              {compareOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Opções registradas</p>
                  {compareOptions.map((opt, idx) => {
                    const pricePerUnit = opt.priceNum / opt.sizeNum;
                    const isBest = best && Math.abs(best.pricePerUnit - pricePerUnit) < 0.001;
                    return (
                      <Card key={idx} className={isBest ? "border-teal-500/50 bg-teal-500/5" : ""}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{fmtN(opt.sizeNum, 3).replace(/,?0+$/, "")} {opt.unit}</p>
                              {isBest && <Badge color="teal">Melhor custo</Badge>}
                            </div>
                            <p className="text-xs text-slate-500">{fmt(opt.priceNum)} · <span className="text-teal-400 font-semibold">{fmt(pricePerUnit)}/{opt.unit}</span></p>
                          </div>
                          <button onClick={() => setCompareOptions(compareOptions.filter((_, i) => i !== idx))} className={`p-1 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"} transition-colors flex-shrink-0`}><Icon name="trash" size={13} /></button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
              {compareOptions.length === 0 && (
                <div className={`${isDark ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl px-4 py-5 text-center`}>
                  <p className="text-xs font-semibold text-slate-500">Nenhuma opÃ§Ã£o adicionada</p>
                  <p className="text-[10px] text-slate-600 mt-1">Digite abaixo os preÃ§os e quantidades encontrados no mercado.</p>
                </div>
              )}
              <div className={`space-y-3 ${isDark ? "bg-slate-900/50" : "bg-slate-50"} rounded-xl p-3`}>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Adicionar nova opção</p>
                <div className="grid grid-cols-2 gap-2">
                  <Inp inputRef={sizeRef} label={`Quantidade (${du})`} type="number" value={newOption.size} onChange={v => setNewOption({ ...newOption, size: v })} placeholder="Ex: 500" min="0.001" step="0.001"
                    onEnter={() => { if (priceRef.current) priceRef.current.focus(); }} />
                  <Inp inputRef={priceRef} label="Preço (R$)" type="number" value={newOption.price} onChange={v => setNewOption({ ...newOption, price: v })} placeholder="1,99" min="0.01" step="0.01" onEnter={addCompareOption} />
                </div>
                <Btn onClick={addCompareOption} className="w-full" size="sm"><Icon name="plus" size={13} />Adicionar opção</Btn>
              </div>
              <Btn onClick={() => setPriceCompareModal(false)} variant="secondary" className="w-full justify-center">Fechar</Btn>
            </div>
          </Modal>
        );
      })()}

      {/* Saved Lists Modal */}
      {savedListsModal && (
        <Modal title="Listas Salvas" onClose={() => setSavedListsModal(false)}>
          <div className="space-y-3">
            {savedLists.length === 0 ? (
              <Empty icon="list" title="Nenhuma lista salva" />
            ) : (
              savedLists.map(list => (
                <Card key={list.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{list.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{new Date(list.date + "T12:00:00").toLocaleDateString("pt-BR")} · {list.items.length} {list.items.length === 1 ? "item" : "itens"}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {list.items.slice(0, 4).map(li => {
                          const it = items.find(i => i.id === li.itemId);
                          return it ? <Badge key={li.itemId}>{it.name}</Badge> : null;
                        })}
                        {list.items.length > 4 && <Badge>+{list.items.length - 4}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Btn onClick={() => loadSavedList(list)} size="sm" variant="success"><Icon name="copy" size={12} />Carregar</Btn>
                      <button onClick={() => deleteSavedList(list.id)} className={`p-1.5 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"} transition-colors`}><Icon name="trash" size={13} /></button>
                    </div>
                  </div>
                </Card>
              ))
            )}
            <Btn onClick={() => setSavedListsModal(false)} variant="secondary" className="w-full justify-center">Fechar</Btn>
          </div>
        </Modal>
      )}

      {/* Save List Modal */}
      {editModal && (
        <Modal title="Salvar Lista de Compras" onClose={() => setEditModal(false)}>
          <div className="space-y-4">
            <Inp label="Nome da lista" value={editName} onChange={setEditName} placeholder="Ex: Compras do mês, Lista semanal..." required onEnter={saveList} />
            <div className="flex gap-3">
              <Btn onClick={() => setEditModal(false)} variant="secondary" className="flex-1">Cancelar</Btn>
              <Btn onClick={saveList} disabled={!editName.trim()} className="flex-1">Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Convert to Purchase Modal */}
      {convertModal && (
        <Modal title="Converter em Compra" onClose={() => setConvertModal(false)}>
          <div className="space-y-4">
            <InfoBox color="teal">Os itens com histórico de preços serão adicionados à nova compra com o último preço registrado. Você poderá ajustar os valores antes de salvar.</InfoBox>
            <div className="space-y-1.5">
              {activeList.map(li => {
                const item = items.find(i => i.id === li.itemId);
                const stats = calcStats(li.itemId, items, purchases, warehouse.flatMap(w => w.entries || []));
                if (!item) return null;
                const hasHistory = stats && stats.entries.length > 0;
                return (
                  <div key={li.itemId} className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl`}>
                    <p className={`text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>{item.name}</p>
                    {hasHistory ? <Badge color="teal">incluso</Badge> : <Badge color="slate">sem histórico</Badge>}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Btn onClick={() => setConvertModal(false)} variant="secondary" className="flex-1">Cancelar</Btn>
              <Btn onClick={handleConvertToPurchase} className="flex-1"><Icon name="cart" size={15} />Criar Compra</Btn>
            </div>
          </div>
        </Modal>
      )}

      {clearAllConfirm && (
        <ConfirmModal
          title="Limpar lista inteira"
          message="Remover todos os itens da lista ativa? Os itens marcados como comprados também serão removidos."
          confirmLabel="Limpar tudo"
          onConfirm={clearAll}
          onCancel={() => setClearAllConfirm(false)}
        />
      )}
    </div>
  );
}
