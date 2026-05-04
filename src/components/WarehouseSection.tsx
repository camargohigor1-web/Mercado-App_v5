import { useState, useRef, useEffect } from "react";
import { useTheme } from "../hooks/useTheme";
import { useBrowserBackClose } from "../hooks/useBrowserBackClose";
import { Icon } from "./Icon";
import { Btn, Inp, Modal, Card, Badge, Empty, InfoBox, StatBox, ConfirmModal } from "./ui";
import { uid, fmt, fmtN, getDisplayFactor, getWarehouseUnit, calcStats, getLowStockItems } from "../utils";
import type { Item, Purchase, ShoppingListEntry, WarehouseItem } from "../types";

interface WarehouseSectionProps {
  items: Item[];
  purchases: Purchase[];
  warehouse: WarehouseItem[];
  setWarehouse: (w: WarehouseItem[]) => void;
  categories: string[];
  shoppingList: ShoppingListEntry[];
  setShoppingList: (l: ShoppingListEntry[]) => void;
  onGoToNewPurchase?: () => void;
  onSelectionChange?: (count: number) => void;
  initialSearch?: string;
}

export function WarehouseSection({ items, purchases, warehouse, setWarehouse, categories, shoppingList, setShoppingList, onGoToNewPurchase, onSelectionChange, initialSearch }: WarehouseSectionProps) {
  const { isDark } = useTheme();
  const [view, setView] = useState<"current" | "alerts">("current");
  const [search, setSearch] = useState(initialSearch?.trim() ?? "");
  const [filterCat, setFilterCat] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updateModal, setUpdateModal] = useState(false);
  const [updateForm, setUpdateForm] = useState({ qty: "", date: new Date().toISOString().slice(0, 10), note: "" });
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showZeroModal, setShowZeroModal] = useState(false);
  const [zeroFeedback, setZeroFeedback] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<WarehouseItem[] | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [sortBy, setSortBy] = useState<"category" | "stock" | "days">("category");
  const closeSelectedItem = useBrowserBackClose(selectedId !== null && !updateModal, () => setSelectedId(null));
  const qtyRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  // Notify parent of selection count changes
  useEffect(() => {
    onSelectionChange?.(selectedIds.size);
  }, [selectedIds.size]);

  const getItem = (id: string) => items.find(i => i.id === id);
  function getWarehouseItem(itemId: string): WarehouseItem {
    return warehouse.find(x => x.itemId === itemId) || { id: "", itemId, stock: 0, purchased: 0, entries: [] };
  }

  const purchasedItemIds = new Set<string>();
  purchases.forEach(p => p.lines.forEach(l => purchasedItemIds.add(l.itemId)));
  warehouse.forEach(w => purchasedItemIds.add(w.itemId));

  const warehouseItems = items
    .filter(item => purchasedItemIds.has(item.id))
    .map(item => {
      const w = getWarehouseItem(item.id);
      const stats = calcStats(item.id, items, purchases, w.entries || []);
      return { item, w, stats };
    })
    .filter(({ item }) => item.name.toLowerCase().includes(search.toLowerCase()))
    .filter(({ item }) => !filterCat || item.category === filterCat)
    .sort((a, b) => {
      if (sortBy === "stock") {
        const fa = a.item.type === "bulk" ? getDisplayFactor(a.item) : 1;
        const fb = b.item.type === "bulk" ? getDisplayFactor(b.item) : 1;
        return (a.w.stock || 0) * fa - (b.w.stock || 0) * fb;
      }
      if (sortBy === "days") {
        const getDays = ({ item, w, stats }: typeof a) => {
          const f = item.type === "bulk" ? getDisplayFactor(item) : 1;
          const avg = stats ? stats.avgMonthly * f : 0;
          const stock = (w.stock || 0) * f;
          return avg > 0 ? Math.round((stock / avg) * 30) : 9999;
        };
        return getDays(a) - getDays(b);
      }
      return (b.item.category || "").localeCompare(a.item.category || "");
    });
  const allLowStockItems = getLowStockItems(items, purchases, warehouse);
  const lowStockItems = allLowStockItems
    .filter(({ item }) => item.name.toLowerCase().includes(search.toLowerCase()))
    .filter(({ item }) => !filterCat || item.category === filterCat);

  function openUpdate(itemId: string) {
    setSelectedId(itemId);
    setUpdateForm({ qty: "", date: new Date().toISOString().slice(0, 10), note: "" });
    setUpdateModal(true);
  }

  function isInActiveShoppingList(itemId: string): boolean {
    return shoppingList.some(l => !l.saved && l.itemId === itemId);
  }

  function addToShoppingList(itemId: string) {
    if (isInActiveShoppingList(itemId)) return;
    setShoppingList([...shoppingList, { itemId, done: false, saved: false }]);
  }

  function saveUpdate() {
    if (!updateForm.qty || !updateForm.date || !selectedId) return;
    const item = getItem(selectedId);
    const factor = (item && item.type === "bulk") ? getDisplayFactor(item) : 1;
    const realQtyBase = parseFloat(updateForm.qty) / factor;
    const w = getWarehouseItem(selectedId);
    const currentStock = w.stock || 0;
    const consumed = Math.max(0, currentStock - realQtyBase);
    const entry = { id: uid(), type: "update" as const, date: updateForm.date, realQty: realQtyBase, previousStock: currentStock, consumed, note: updateForm.note };
    const newWarehouse = [...warehouse];
    const idx = newWarehouse.findIndex(x => x.itemId === selectedId);
    if (idx >= 0) {
      newWarehouse[idx] = { ...newWarehouse[idx], stock: realQtyBase, entries: [...(newWarehouse[idx].entries || []), entry] };
    } else {
      newWarehouse.push({ id: uid(), itemId: selectedId, stock: realQtyBase, purchased: 0, entries: [entry] });
    }
    setWarehouse(newWarehouse);
    setUpdateModal(false);
  }

  function toggleSelect(itemId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  function doZeroSelected() {
    const count = selectedIds.size;
    const snapshot = warehouse.map(item => ({ ...item }));
    setUndoSnapshot(snapshot);
    setWarehouse(warehouse.map(item =>
      selectedIds.has(item.itemId) ? { ...item, stock: 0 } : item
    ));
    setSelectedIds(new Set());
    setShowZeroModal(false);
    setZeroFeedback(`${count} ${count === 1 ? "item zerado" : "itens zerados"}`);
    if (undoTimer) clearTimeout(undoTimer);
    const t = setTimeout(() => { setZeroFeedback(null); setUndoSnapshot(null); }, 5000);
    setUndoTimer(t);
  }

  function doUndo() {
    if (!undoSnapshot) return;
    setWarehouse(undoSnapshot);
    setUndoSnapshot(null);
    setZeroFeedback(null);
    if (undoTimer) clearTimeout(undoTimer);
    setUndoTimer(null);
  }

  function removeFromZeroList(itemId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      if (next.size === 0) {
        setTimeout(() => setShowZeroModal(false), 150);
      }
      return next;
    });
  }

  function doDeleteEntry() {
    if (!deleteEntryTarget || !selectedId) return;
    const entryId = deleteEntryTarget;
    const newWarehouse = warehouse.map(w => {
      if (w.itemId !== selectedId) return w;
      const entries = (w.entries || []).filter(e => e.id !== entryId);
      let newStock = w.purchased || 0;
      entries.forEach(e => { if (e.consumed > 0) newStock -= e.consumed; });
      return { ...w, entries, stock: Math.max(0, newStock) };
    });
    setWarehouse(newWarehouse);
    setDeleteEntryTarget(null);
  }

  // ── Item detail ────────────────────────────────────────────────────────────
  if (selectedId && !updateModal) {
    const item = getItem(selectedId);
    if (!item) return null;
    const w = getWarehouseItem(selectedId);
    const stats = calcStats(selectedId, items, purchases, w.entries || []);
    const factor = item.type === "bulk" ? getDisplayFactor(item) : 1;
    const du = getWarehouseUnit(item);
    const stockDisplay = (w.stock || 0) * factor;
    const purchasedDisplay = (w.purchased || 0) * factor;
    const avgMonthlyDisplay = stats ? stats.avgMonthly * factor : 0;
    const sortedEntries = [...(w.entries || [])].sort((a, b) => b.date.localeCompare(a.date));

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={closeSelectedItem} className={`${isDark ? "text-slate-500 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"} p-1`}><Icon name="back" size={20} /></button>
          <div className="flex-1">
            <h2 className={`text-base font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>{item.name}</h2>
            <div className="flex gap-1.5 mt-0.5 flex-wrap">
              <Badge color={item.type === "bulk" ? "teal" : "amber"}>{item.type === "bulk" ? "Granel" : "Emb. fixa"}</Badge>
              <Badge>{item.category}</Badge>
              {item.type === "bulk" && item.displayUnit && item.displayUnit !== item.unit && <Badge color="blue">escala: {du}</Badge>}
              {item.type === "packaged" && item.pkgSize && <Badge color="amber">{fmtN(item.pkgSize, 0)} {item.pkgUnit}/emb</Badge>}
              {item.alertDays === 0 ? (
                <Badge color="slate">sem alerta</Badge>
              ) : (
                <Badge color="amber">alerta: {item.alertDays ?? 15}d</Badge>
              )}
            </div>
          </div>
          <Btn onClick={() => openUpdate(selectedId)} size="sm" variant="success"><Icon name="refresh" size={13} />Atualizar</Btn>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatBox label="Em estoque" val={`${fmtN(stockDisplay, item.type === "packaged" ? 0 : 2)} ${du}`} color="teal" />
          <StatBox label="Total comprado" val={`${fmtN(purchasedDisplay, item.type === "packaged" ? 0 : 2)} ${du}`} />
          {stats && <StatBox label="Consumo médio/mês" val={`${fmtN(avgMonthlyDisplay, item.type === "packaged" ? 1 : 2)} ${du}`} color="blue" />}
          {stats && <StatBox label="Último preço" val={item.type === "packaged" ? `${fmt(stats.lastPrice)}/emb` : fmt(stats.lastPrice)} />}
        </div>
        {sortedEntries.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Histórico de atualizações</p>
            <div className="space-y-2">
              {sortedEntries.map(e => (
                <Card key={e.id}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge color="blue">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</Badge>
                        <Badge color="teal">Contagem real</Badge>
                      </div>
                      <p className={`${isDark ? "text-slate-200" : "text-slate-800"} text-sm font-semibold`}>Qtd real: {fmtN(e.realQty * factor, item.type === "packaged" ? 0 : 2)} {du}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Estoque anterior: {fmtN(e.previousStock * factor, item.type === "packaged" ? 0 : 2)} {du}</p>
                      {e.consumed > 0 && <p className="text-xs text-amber-400 mt-0.5">Consumo deduzido: {fmtN(e.consumed * factor, item.type === "packaged" ? 0 : 2)} {du}</p>}
                      {e.note && <p className="text-xs text-slate-600 mt-0.5 italic">{e.note}</p>}
                    </div>
                    <button onClick={() => setDeleteEntryTarget(e.id)} className={`p-1.5 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"} transition-colors flex-shrink-0`}><Icon name="trash" size={13} /></button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
        {deleteEntryTarget && (
          <ConfirmModal title="Remover atualização" message="Remover este registro de atualização de estoque?" confirmLabel="Remover" onConfirm={doDeleteEntry} onCancel={() => setDeleteEntryTarget(null)} />
        )}
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  const grouped: Record<string, typeof warehouseItems> = {};
  categories.forEach(cat => {
    const g = warehouseItems.filter(({ item }) => item.category === cat);
    if (g.length) grouped[cat] = g;
  });
  const ungrouped = warehouseItems.filter(({ item }) => !item.category || !categories.includes(item.category));
  if (ungrouped.length) grouped["Sem categoria"] = ungrouped;

  return (
    <div className="space-y-4">
      <div className={`flex gap-2 ${isDark ? "bg-slate-900" : "bg-slate-100"} rounded-xl p-1`}>
        <button
          onClick={() => setView("current")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === "current" ? "bg-teal-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
        >
          Atual
        </button>
        <button
          onClick={() => setView("alerts")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === "alerts" ? "bg-red-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
        >
          Alertas {allLowStockItems.length > 0 ? `(${allLowStockItems.length})` : ""}
        </button>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={view === "alerts" ? "Buscar alerta de estoque..." : "Buscar produto no armazém..."}
        className={`w-full ${isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-700" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-all`}
      />

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCat("")}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${!filterCat ? "bg-teal-500 text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-200 text-slate-500 hover:text-slate-700"}`}
          >
            Todas
          </button>
          {categories.filter(cat => warehouseItems.some(({ item }) => item.category === cat)).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(filterCat === cat ? "" : cat)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${filterCat === cat ? "bg-teal-500 text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-200 text-slate-500 hover:text-slate-700"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {view === "current" && (
        <InfoBox color="blue">O armazém controla seu estoque. Compras aumentam o estoque automaticamente. Use "Atualizar Quantidade" para registrar a contagem real.</InfoBox>
      )}

      {/* Sort controls — only on current view */}
      {view === "current" && warehouseItems.length > 0 && (
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase tracking-widest flex-shrink-0 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Ordenar</span>
          <div className="flex gap-1.5 flex-wrap">
            {([
              { id: "category", label: "Categoria" },
              { id: "stock",    label: "Menor estoque" },
              { id: "days",     label: "Menos dias" },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${sortBy === opt.id ? "bg-teal-500 text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-200 text-slate-500 hover:text-slate-700"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "alerts" && (
        lowStockItems.length === 0 ? (
          <Empty icon="warehouse" title="Nenhum alerta de estoque" sub="Os produtos com estoque abaixo do limite configurado aparecerão aqui." />
        ) : (
          <div className="space-y-2">
            <div className={`flex items-center gap-3 ${isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-200"} border rounded-xl px-4 py-3`}>
              <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                <Icon name="warn" size={14} />
              </div>
              <div>
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Estoque baixo</p>
                <p className="text-xs text-slate-500">{lowStockItems.length} produto{lowStockItems.length === 1 ? "" : "s"} abaixo do limite de alerta.</p>
              </div>
            </div>

            {lowStockItems.map(({ item, stock, avgMonthly, daysLeft, threshold, unit }) => {
              const alreadyInList = isInActiveShoppingList(item.id);
              return (
              <Card key={item.id} onClick={() => setSelectedId(item.id)} className={isDark ? "hover:border-red-500/40" : "hover:border-red-300"}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                    <Icon name="warn" size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-semibold text-sm truncate`}>{item.name}</p>
                      <Badge color="red">~{daysLeft} dias</Badge>
                    </div>
                    <div className="flex gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-500">Estoque: <span className="text-red-400 font-bold">{fmtN(stock, item.type === "packaged" ? 0 : 2)} {unit}</span></span>
                      <span className="text-xs text-slate-500">Consumo: <span className={isDark ? "text-slate-300" : "text-slate-700"}>{fmtN(avgMonthly, item.type === "packaged" ? 1 : 2)}/mês</span></span>
                      <span className="text-xs text-slate-500">Limite: <span className="text-amber-400">{threshold} dias</span></span>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button
                        onClick={e => { e.stopPropagation(); addToShoppingList(item.id); }}
                        disabled={alreadyInList}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-60 disabled:pointer-events-none ${alreadyInList ? isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-500" : "bg-teal-500/15 text-teal-400 hover:bg-teal-500/25 border border-teal-500/30"}`}
                      >
                        <Icon name={alreadyInList ? "check" : "plus"} size={12} />
                        {alreadyInList ? "Na lista" : "Adicionar à lista"}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openUpdate(item.id); }}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 transition-all"
                      >
                        <Icon name="refresh" size={12} />
                        Atualizar estoque
                      </button>
                    </div>
                  </div>
                  <span className="text-slate-600 flex-shrink-0"><Icon name="chevron" size={16} /></span>
                </div>
              </Card>
              );
            })}
          </div>
        )
      )}

      {view === "current" && (warehouseItems.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12 gap-4 px-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
            <Icon name="warehouse" size={24} />
          </div>
          <div className="space-y-1">
            <p className={`font-black text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Armazém vazio</p>
            <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              O estoque é atualizado automaticamente quando você registra compras. Registre sua primeira compra para começar.
            </p>
          </div>
          {onGoToNewPurchase && (
            <button
              onClick={onGoToNewPurchase}
              className="px-5 py-2.5 rounded-xl bg-teal-500 text-white text-xs font-black shadow-lg shadow-teal-500/25 active:scale-95 transition-transform"
            >
              Registrar compra
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Selection bar */}
          {selectedIds.size > 0 && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${isDark ? "bg-amber-500/10 border border-amber-500/30" : "bg-amber-50 border border-amber-200"}`}>
              <span className={`text-xs font-bold ${isDark ? "text-amber-400" : "text-amber-700"}`}>{selectedIds.size} {selectedIds.size === 1 ? "item selecionado" : "itens selecionados"}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-700"}`}
                >
                  Limpar
                </button>
                <button
                  onClick={() => setShowZeroModal(true)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${isDark ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30" : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"}`}
                >
                  Zerar selecionados
                </button>
              </div>
            </div>
          )}
          {sortBy !== "category" ? (
            // Flat list (sorted by stock or days)
            <div className="space-y-2">
              {warehouseItems.map(({ item, w, stats }) => {
                const factor = item.type === "bulk" ? getDisplayFactor(item) : 1;
                const du = getWarehouseUnit(item);
                const stock = (w.stock || 0) * factor;
                const avgMonthly = stats ? stats.avgMonthly * factor : 0;
                const daysLeft = avgMonthly > 0 ? Math.round((stock / avgMonthly) * 30) : null;
                const threshold = item.alertDays ?? 15;
                const isLow = daysLeft !== null && daysLeft < threshold && item.alertDays !== 0;
                const isChecked = selectedIds.has(item.id);
                return (
                  <Card key={item.id} onClick={() => setSelectedId(item.id)} className={`${isDark ? "hover:border-slate-600" : "hover:border-slate-300"} ${isChecked ? (isDark ? "border-amber-500/40 bg-amber-500/5" : "border-amber-300 bg-amber-50/50") : ""}`}>
                    <div className="flex items-center gap-3">
                      <button onClick={e => { e.stopPropagation(); toggleSelect(item.id); }} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? "bg-amber-500 border-amber-500" : isDark ? "border-slate-600 hover:border-slate-400" : "border-slate-300 hover:border-slate-500"}`}>
                        {isChecked && <svg viewBox="0 0 10 8" width="10" height="8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4l2.5 2.5L9 1" /></svg>}
                      </button>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isLow ? "bg-amber-500/15 text-amber-400" : "bg-teal-500/20 text-teal-400"}`}><Icon name="warehouse" size={15} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-semibold text-sm truncate`}>{item.name}</p>
                          <span className={`text-[9px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>{item.category}</span>
                          {isLow && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide ${isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-100 text-amber-700"}`}>Estoque baixo</span>}
                        </div>
                        <div className="flex gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-slate-500">Estoque: <span className={`font-bold ${isLow ? "text-amber-400" : "text-teal-400"}`}>{fmtN(stock, item.type === "packaged" ? 0 : 2)} {du}</span></span>
                          {avgMonthly > 0 && <span className="text-xs text-slate-500">Consumo: <span className={isDark ? "text-slate-300" : "text-slate-700"}>{fmtN(avgMonthly, item.type === "packaged" ? 1 : 2)}/mês</span></span>}
                          {daysLeft !== null && <span className={`text-xs font-bold ${isLow ? "text-amber-400" : "text-slate-500"}`}>~{daysLeft} dias</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); openUpdate(item.id); }} className={`p-1.5 ${isDark ? "text-slate-600 hover:text-teal-400" : "text-slate-400 hover:text-teal-500"} transition-colors`}><Icon name="refresh" size={14} /></button>
                        <span className="text-slate-600"><Icon name="chevron" size={16} /></span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
          // Grouped by category
          Object.entries(grouped).map(([cat, catItems]) => {
            const catIds = catItems.map(({ item }) => item.id);
            const allSelected = catIds.every(id => selectedIds.has(id));
            const someSelected = catIds.some(id => selectedIds.has(id));
            function toggleCat() {
              setSelectedIds(prev => {
                const next = new Set(prev);
                if (allSelected) { catIds.forEach(id => next.delete(id)); }
                else { catIds.forEach(id => next.add(id)); }
                return next;
              });
            }
            return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{cat}</p>
                <button
                  onClick={toggleCat}
                  className={`text-[10px] font-bold transition-all ${allSelected ? (isDark ? "text-amber-400 hover:text-amber-300" : "text-amber-600 hover:text-amber-700") : someSelected ? (isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700") : (isDark ? "text-slate-600 hover:text-slate-400" : "text-slate-400 hover:text-slate-600")}`}
                >
                  {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              </div>
              <div className="space-y-2">
                {catItems.map(({ item, w, stats }) => {
                  const factor = item.type === "bulk" ? getDisplayFactor(item) : 1;
                  const du = getWarehouseUnit(item);
                  const stock = (w.stock || 0) * factor;
                  const avgMonthly = stats ? stats.avgMonthly * factor : 0;
                  const daysLeft = avgMonthly > 0 ? Math.round((stock / avgMonthly) * 30) : null;
                  const threshold = item.alertDays ?? 15;
                  const isLow = daysLeft !== null && daysLeft < threshold && item.alertDays !== 0;
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <Card key={item.id} onClick={() => setSelectedId(item.id)} className={`${isDark ? "hover:border-slate-600" : "hover:border-slate-300"} ${isChecked ? (isDark ? "border-amber-500/40 bg-amber-500/5" : "border-amber-300 bg-amber-50/50") : ""}`}>
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleSelect(item.id); }}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? "bg-amber-500 border-amber-500" : isDark ? "border-slate-600 hover:border-slate-400" : "border-slate-300 hover:border-slate-500"}`}
                        >
                          {isChecked && (
                            <svg viewBox="0 0 10 8" width="10" height="8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 4l2.5 2.5L9 1" />
                            </svg>
                          )}
                        </button>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isLow ? "bg-amber-500/15 text-amber-400" : "bg-teal-500/20 text-teal-400"}`}><Icon name="warehouse" size={15} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-semibold text-sm truncate`}>{item.name}</p>
                            {isLow && (
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide ${isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-100 text-amber-700"}`}>
                                Estoque baixo
                              </span>
                            )}
                          </div>
                          <div className="flex gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-slate-500">Estoque: <span className={`font-bold ${isLow ? "text-amber-400" : "text-teal-400"}`}>{fmtN(stock, item.type === "packaged" ? 0 : 2)} {du}</span></span>
                            {avgMonthly > 0 && <span className="text-xs text-slate-500">Consumo: <span className={isDark ? "text-slate-300" : "text-slate-700"}>{fmtN(avgMonthly, item.type === "packaged" ? 1 : 2)}/mês</span></span>}
                            {daysLeft !== null && <span className={`text-xs font-bold ${isLow ? "text-amber-400" : "text-slate-500"}`}>~{daysLeft} dias</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={e => { e.stopPropagation(); openUpdate(item.id); }} className={`p-1.5 ${isDark ? "text-slate-600 hover:text-teal-400" : "text-slate-400 hover:text-teal-500"} transition-colors`}><Icon name="refresh" size={14} /></button>
                          <span className="text-slate-600"><Icon name="chevron" size={16} /></span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
            );
          })
          )}
        </>
      ))}

      {/* Zero stock confirmation modal */}
      {showZeroModal && (
        <Modal title="Zerar estoque" onClose={() => setShowZeroModal(false)}>
          <div className="space-y-4">
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Confirme os itens que terão o estoque zerado:
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Array.from(selectedIds).map(itemId => {
                const item = getItem(itemId);
                const w = getWarehouseItem(itemId);
                if (!item) return null;
                const factor = item.type === "bulk" ? getDisplayFactor(item) : 1;
                const du = getWarehouseUnit(item);
                const stock = (w.stock || 0) * factor;
                return (
                  <Card key={itemId} className="py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"} truncate`}>{item.name}</p>
                        <p className="text-xs text-slate-500">Estoque atual: <span className="text-teal-400 font-bold">{fmtN(stock, item.type === "packaged" ? 0 : 2)} {du}</span></p>
                      </div>
                      <button
                        onClick={() => removeFromZeroList(itemId)}
                        className={`p-1.5 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"} transition-colors flex-shrink-0`}
                      >
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
            {selectedIds.size === 0 && (
              <div className={`flex flex-col items-center gap-2 py-4 rounded-xl ${isDark ? "bg-slate-800/50" : "bg-slate-50"}`}>
                <span className={`text-xl`}>✅</span>
                <p className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Nenhum item restante</p>
                <p className={`text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>O modal será fechado automaticamente</p>
              </div>
            )}
            {selectedIds.size > 0 && (
              <div className="flex gap-3 pt-1">
                <Btn onClick={() => setShowZeroModal(false)} variant="secondary" className="flex-1">Cancelar</Btn>
                <Btn onClick={doZeroSelected} variant="danger" className="flex-1">Zerar {selectedIds.size} {selectedIds.size === 1 ? "item" : "itens"}</Btn>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Feedback toast with undo */}
      {zeroFeedback && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold shadow-xl border border-slate-700 animate-fade-slide-up whitespace-nowrap">
          <span className="text-slate-200">{zeroFeedback}</span>
          {undoSnapshot && (
            <button
              onClick={doUndo}
              className="text-teal-400 font-black hover:text-teal-300 transition-colors border-l border-slate-700 pl-3 ml-1"
            >
              Desfazer
            </button>
          )}
        </div>
      )}

      {updateModal && selectedId && (() => {
        const item = getItem(selectedId);
        const w = getWarehouseItem(selectedId);
        const factor = (item && item.type === "bulk") ? getDisplayFactor(item) : 1;
        const du = item ? getWarehouseUnit(item) : "un";
        const currentStockDisplay = (w.stock || 0) * factor;
        return (
          <Modal title="Atualizar Quantidade" onClose={() => setUpdateModal(false)}>
            <div className="space-y-4">
              <InfoBox color="teal">Informe a quantidade real que você contou. O app vai calcular o consumo automaticamente.</InfoBox>
              <Card className="text-center">
                <p className="text-xs text-slate-500 mb-1">Estoque atual calculado</p>
                <p className="text-2xl font-black text-teal-400">{fmtN(currentStockDisplay, item?.type === "packaged" ? 0 : 2)} <span className="text-base">{du}</span></p>
              </Card>
              <Inp inputRef={qtyRef} label={`Quantidade real contada (${du})`} type="number" value={updateForm.qty} onChange={v => setUpdateForm({ ...updateForm, qty: v })} placeholder={item?.type === "packaged" ? "Ex: 5" : "Ex: 250"} min="0" step={item?.type === "packaged" ? "1" : "0.001"} required onEnter={() => { if (dateRef.current) dateRef.current.focus(); }} />
              <Inp inputRef={dateRef} label="Data da contagem" type="date" value={updateForm.date} onChange={v => setUpdateForm({ ...updateForm, date: v })} required onEnter={() => { if (noteRef.current) noteRef.current.focus(); }} />
              <Inp inputRef={noteRef} label="Observação (opcional)" value={updateForm.note} onChange={v => setUpdateForm({ ...updateForm, note: v })} placeholder="Ex: Encontrei escondido no armário..." onEnter={saveUpdate} />
              {updateForm.qty !== "" && +updateForm.qty >= 0 && (
                <div className={`${isDark ? "bg-slate-800/60" : "bg-slate-100"} rounded-xl p-3`}>
                  <p className="text-xs text-slate-500 mb-1">Consumo a ser registrado</p>
                  <p className="text-lg font-black text-amber-400">{fmtN(Math.max(0, currentStockDisplay - +updateForm.qty), item?.type === "packaged" ? 0 : 2)} {du}</p>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <Btn onClick={() => setUpdateModal(false)} variant="secondary" className="flex-1">Cancelar</Btn>
                <Btn onClick={saveUpdate} disabled={!updateForm.qty || !updateForm.date} className="flex-1">Salvar</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
