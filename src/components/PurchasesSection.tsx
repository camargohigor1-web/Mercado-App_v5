import { useState, useRef } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Btn, Inp, Sel, Modal, Card, Empty, InfoBox, ConfirmModal } from "./ui";
import { ProductSearch } from "./ui";
import { uid, fmt, fmtN, getDisplayFactor, getDisplayUnit } from "../utils";
import type { Item, Market, Purchase, PurchaseLine, WarehouseItem } from "../types";

interface PurchasesSectionProps {
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  setPurchases: (p: Purchase[]) => void;
  warehouse: WarehouseItem[];
  setWarehouse: (w: WarehouseItem[]) => void;
  initialLines?: PurchaseLine[];
  onCreatedFromList?: () => void;
}

export function PurchasesSection({
  items, markets, purchases, setPurchases, warehouse, setWarehouse,
  initialLines, onCreatedFromList,
}: PurchasesSectionProps) {
  const { isDark } = useTheme();
  const [view, setView] = useState<"list" | "new" | "detail">(initialLines ? "new" : "list");
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [form, setForm] = useState<{ marketId: string; date: string; note: string; lines: PurchaseLine[] }>({
    marketId: markets[0]?.id || "",
    date: new Date().toISOString().slice(0, 10),
    note: "",
    lines: initialLines || [],
  });
  const [lineModal, setLineModal] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [lf, setLf] = useState({ itemId: "", numPkgs: "", pkgQty: "", pricePerPkg: "", discount: "0", brand: "", note: "" });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  // Export selection
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const numPkgsRef = useRef<HTMLInputElement>(null);
  const pkgQtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  const getItem = (id: string) => items.find(i => i.id === id);
  const getMkt  = (id: string) => markets.find(m => m.id === id)?.name || "Mercado";

  // ── Line modal ────────────────────────────────────────────────────────────
  function openLine(idx: number | null = null) {
    if (idx !== null) {
      const l = form.lines[idx];
      const it = getItem(l.itemId);
      const factor = it ? getDisplayFactor(it) : 1;
      setLf({
        itemId: l.itemId,
        numPkgs: String(l.numPkgs),
        pkgQty: l.pkgQty != null ? String(+(l.pkgQty * factor).toPrecision(10)) : "",
        pricePerPkg: String(l.pricePerPkg),
        discount: l.discountTotal != null ? String(l.discountTotal) : "0",
        brand: l.brand || "", note: l.note || "",
      });
      setEditIdx(idx);
    } else {
      setLf({ itemId: "", numPkgs: "", pkgQty: "", pricePerPkg: "", discount: "0", brand: "", note: "" });
      setEditIdx(null);
    }
    setLineModal(true);
  }

  function saveLine() {
    const it = getItem(lf.itemId);
    if (!it || !lf.numPkgs || !lf.pricePerPkg) return;
    if (it.type === "bulk" && !lf.pkgQty) return;
    const numPkgs = parseFloat(lf.numPkgs);
    const pricePerPkg = parseFloat(lf.pricePerPkg);
    const discountTotal = Math.max(0, parseFloat(lf.discount) || 0);
    const discountPerPkg = numPkgs > 0 ? discountTotal / numPkgs : 0;
    const pricePerPkgAfterDiscount = pricePerPkg - discountPerPkg;
    const total = numPkgs * pricePerPkg - discountTotal;
    let line: PurchaseLine;
    if (it.type === "bulk") {
      const factor = getDisplayFactor(it);
      const pkgQty = parseFloat(lf.pkgQty) / factor;
      const totalQty = numPkgs * pkgQty;
      const pricePerUnit = pricePerPkgAfterDiscount / pkgQty;
      line = { itemId: lf.itemId, numPkgs, pkgQty, totalQty, pricePerPkg, pricePerPkgAfterDiscount, discountTotal, discountPerPkg, pricePerUnit, total, brand: lf.brand, note: lf.note };
    } else {
      const pricePerInternal = pricePerPkgAfterDiscount / (it.pkgSize || 1);
      line = { itemId: lf.itemId, numPkgs, pricePerPkg, pricePerPkgAfterDiscount, discountTotal, discountPerPkg, pricePerInternal, total, brand: lf.brand, note: lf.note };
    }
    if (editIdx !== null) { const ls = [...form.lines]; ls[editIdx] = line; setForm({ ...form, lines: ls }); }
    else setForm({ ...form, lines: [...form.lines, line] });
    setLineModal(false);
  }

  function removeLine(idx: number) { setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) }); }

  // ── Warehouse helpers ─────────────────────────────────────────────────────
  function applyPurchaseToWarehouse(lines: PurchaseLine[], base: WarehouseItem[]): WarehouseItem[] {
    const wh = [...base];
    lines.forEach(line => {
      const qty = line.totalQty ?? line.numPkgs;
      const idx = wh.findIndex(w => w.itemId === line.itemId);
      if (idx >= 0) { wh[idx] = { ...wh[idx], stock: (wh[idx].stock || 0) + qty, purchased: (wh[idx].purchased || 0) + qty }; }
      else { wh.push({ id: uid(), itemId: line.itemId, stock: qty, purchased: qty, entries: [] }); }
    });
    return wh;
  }

  function reverseWarehouseFromPurchase(lines: PurchaseLine[], base: WarehouseItem[]): WarehouseItem[] {
    const wh = [...base];
    lines.forEach(line => {
      const qty = line.totalQty ?? line.numPkgs;
      const idx = wh.findIndex(w => w.itemId === line.itemId);
      if (idx >= 0) { wh[idx] = { ...wh[idx], stock: Math.max(0, (wh[idx].stock || 0) - qty), purchased: Math.max(0, (wh[idx].purchased || 0) - qty) }; }
    });
    return wh;
  }

  // ── Save / edit purchase ──────────────────────────────────────────────────
  function savePurchase() {
    if (!form.date || !form.marketId || form.lines.length === 0) return;
    const total = form.lines.reduce((s, l) => s + l.total, 0);
    if (editingPurchase) {
      const reversed = reverseWarehouseFromPurchase(editingPurchase.lines, warehouse);
      setWarehouse(applyPurchaseToWarehouse(form.lines, reversed));
      setPurchases(purchases.map(p => p.id === editingPurchase.id ? { ...p, ...form, total } : p));
      setEditingPurchase(null);
    } else {
      const p: Purchase = { id: uid(), ...form, total };
      setWarehouse(applyPurchaseToWarehouse(form.lines, warehouse));
      setPurchases([...purchases, p]);
      if (onCreatedFromList) onCreatedFromList();
    }
    setView("list");
  }

  function startEdit(p: Purchase) {
    setEditingPurchase(p);
    setForm({ marketId: p.marketId, date: p.date, note: p.note || "", lines: [...p.lines] });
    setView("new");
  }

  function doDelete() {
    if (!deleteTarget) return;
    const p = purchases.find(x => x.id === deleteTarget);
    if (p) setWarehouse(reverseWarehouseFromPurchase(p.lines, warehouse));
    setPurchases(purchases.filter(p => p.id !== deleteTarget));
    setDeleteTarget(null);
    setView("list");
  }

  // ── Export selected ───────────────────────────────────────────────────────
  function exportSelected() {
    const toExport = purchases.filter(p => selectedIds.has(p.id));
    const itemIds = new Set(toExport.flatMap(p => p.lines.map(l => l.itemId)));
    const marketIds = new Set(toExport.map(p => p.marketId));
    const data = {
      _version: 3,
      _exportedAt: new Date().toISOString(),
      _type: "purchases_export",
      purchases: toExport,
      items: items.filter(i => itemIds.has(i.id)),
      markets: markets.filter(m => marketIds.has(m.id)),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compras-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSelecting(false);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }

  function toggleSelectAll() {
    if (selectedIds.size === sorted.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map(p => p.id)));
  }

  // ── Line display helper ───────────────────────────────────────────────────
  function lineDisplay(l: PurchaseLine) {
    const it = getItem(l.itemId);
    if (!it) return null;
    const hasDiscount = l.discountTotal > 0;
    if (it.type === "bulk") {
      const factor = getDisplayFactor(it);
      const du = getDisplayUnit(it);
      const pkgQtyDisplay = +((l.pkgQty || 0) * factor).toPrecision(10);
      const totalQtyDisplay = +((l.totalQty || 0) * factor).toPrecision(10);
      const pricePerDU = (l.pricePerUnit || 0) / factor;
      const originalPricePerDU = l.pricePerPkg / ((l.pkgQty || 1) * factor);
      return {
        main: `${l.numPkgs} emb x ${fmtN(pkgQtyDisplay, 3).replace(/,?0+$/, "")} ${du} = ${fmtN(totalQtyDisplay, 3).replace(/,?0+$/, "")} ${du}`,
        sub: hasDiscount
          ? `Sem desc: ${fmt(l.pricePerPkg)}/emb (${fmt(originalPricePerDU)}/${du}) ▸ Com desc: ${fmt(l.pricePerPkgAfterDiscount || 0)}/emb (${fmt(pricePerDU)}/${du})`
          : `${fmt(l.pricePerPkg)}/emb ▸ ${fmt(pricePerDU)}/${du}`,
        discount: hasDiscount ? `Desconto: ${fmt(l.discountTotal)} total · ${fmt(l.discountPerPkg)}/emb` : null,
        extra: null,
      };
    }
    return {
      main: `${l.numPkgs} emb x ${fmt(l.pricePerPkg)}/emb${hasDiscount ? ` ▸ ${fmt(l.pricePerPkgAfterDiscount || 0)}/emb` : ""}`,
      sub: null,
      discount: hasDiscount ? `Desconto: ${fmt(l.discountTotal)} total · ${fmt(l.discountPerPkg)}/emb` : null,
      extra: `${fmt(l.pricePerInternal || 0)}/${it.pkgUnit?.replace(/s$/, "")}`,
    };
  }

  const lineItem   = lf.itemId ? getItem(lf.itemId) : null;
  const isBulk     = lineItem?.type === "bulk";
  const du         = lineItem ? getDisplayUnit(lineItem) : "";
  const discountVal = parseFloat(lf.discount) || 0;
  const canPreview  = lf.numPkgs && lf.pricePerPkg && +lf.numPkgs > 0 && +lf.pricePerPkg > 0 && (!isBulk || (lf.pkgQty && +lf.pkgQty > 0));
  const sorted      = [...purchases].sort((a, b) => b.date.localeCompare(a.date));

  // ── Detail view ───────────────────────────────────────────────────────────
  if (view === "detail" && selected) {
    const p = selected;
    const mkt = markets.find(m => m.id === p.marketId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className={`${isDark ? "text-slate-500 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"} p-1`}><Icon name="back" size={20} /></button>
          <div className="flex-1">
            <h2 className={`text-base font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>{mkt?.name || "Mercado"}</h2>
            <p className="text-xs text-slate-500">{new Date(p.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
            {mkt?.description && <p className="text-xs text-slate-600 mt-0.5">{mkt.description}</p>}
          </div>
          <button onClick={() => startEdit(p)} className={`p-2 ${isDark ? "text-slate-600 hover:text-blue-400" : "text-slate-400 hover:text-blue-500"}`}><Icon name="edit" size={16} /></button>
          <button onClick={() => setDeleteTarget(p.id)} className={`p-2 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}><Icon name="trash" size={16} /></button>
        </div>
        {p.note && (
          <div className={`px-3 py-2.5 rounded-xl text-xs italic ${isDark ? "bg-slate-900 text-slate-400 border border-slate-800" : "bg-slate-50 text-slate-500 border border-slate-200"}`}>
            {p.note}
          </div>
        )}
        <div className="space-y-2">
          {p.lines.map((l, i) => {
            const it = getItem(l.itemId); if (!it) return null;
            const d = lineDisplay(l);
            return (
              <div key={i} className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-2xl p-4`}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`${isDark ? "text-slate-100" : "text-slate-900"} text-sm font-semibold`}>{it.name}</p>
                    {l.brand && <p className="text-xs text-slate-500 mt-0.5">Marca: {l.brand}</p>}
                    {l.note && <p className="text-xs text-slate-600 mt-0.5 italic">{l.note}</p>}
                    <p className="text-xs text-slate-500 mt-1">{d?.main}</p>
                    {d?.discount && <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1"><Icon name="tag" size={10} />{d.discount}</p>}
                    {d?.sub && <p className="text-xs text-teal-500 mt-0.5">{d.sub}</p>}
                    {d?.extra && <p className="text-xs text-teal-500 mt-0.5">{d.extra}</p>}
                  </div>
                  <p className="text-teal-400 font-black text-sm flex-shrink-0">{fmt(l.total)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-2xl p-4 flex justify-between items-center`}>
          <span className="text-slate-500 text-sm">{p.lines.length} {p.lines.length === 1 ? "item" : "itens"}</span>
          <span className="text-teal-400 font-black text-lg">{fmt(p.total)}</span>
        </div>
        {deleteTarget && (
          <ConfirmModal title="Remover Compra" message="Remover esta compra? O estoque será ajustado automaticamente." confirmLabel="Remover" onConfirm={doDelete} onCancel={() => setDeleteTarget(null)} />
        )}
      </div>
    );
  }

  // ── New / Edit view ───────────────────────────────────────────────────────
  if (view === "new") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView("list"); setEditingPurchase(null); }} className={`${isDark ? "text-slate-500 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"} p-1`}><Icon name="back" size={20} /></button>
          <h2 className={`text-base font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>{editingPurchase ? "Editar Compra" : "Nova Compra"}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Mercado" value={form.marketId} onChange={v => setForm({ ...form, marketId: v })} options={markets.map(m => ({ value: m.id, label: m.name }))} placeholder="Selecionar..." required />
          <Inp label="Data" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
        </div>
        <Inp label="Observação da compra (opcional)" value={form.note} onChange={v => setForm({ ...form, note: v })} placeholder="Ex: Compra de fim de mês, promoção relâmpago..." />
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Itens da compra</p>
            <Btn onClick={() => openLine()} size="sm" disabled={items.length === 0}><Icon name="plus" size={13} />Adicionar</Btn>
          </div>
          {form.lines.length === 0 ? (
            <div className={`border-2 border-dashed ${isDark ? "border-slate-800" : "border-slate-200"} rounded-2xl py-10 text-center`}>
              <p className="text-slate-600 text-sm">Nenhum item adicionado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {form.lines.map((l, i) => {
                const it = getItem(l.itemId); if (!it) return null;
                const d = lineDisplay(l);
                return (
                  <Card key={i} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`${isDark ? "text-slate-100" : "text-slate-900"} text-sm font-semibold`}>{it.name}</p>
                      {l.brand && <p className="text-xs text-slate-600">{l.brand}</p>}
                      <p className="text-xs text-slate-500 mt-1">{d?.main}</p>
                      {d?.discount && <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1"><Icon name="tag" size={10} />{d.discount}</p>}
                      {d?.sub && <p className="text-xs text-teal-500">{d.sub}</p>}
                      {d?.extra && <p className="text-xs text-teal-500">{d.extra}</p>}
                      <p className="text-xs text-teal-400 font-bold mt-0.5">{fmt(l.total)}</p>
                    </div>
                    <div className="flex gap-0.5 flex-shrink-0">
                      <button onClick={() => openLine(i)} className={`p-1.5 ${isDark ? "text-slate-600 hover:text-blue-400" : "text-slate-400 hover:text-blue-500"}`}><Icon name="edit" size={13} /></button>
                      <button onClick={() => removeLine(i)} className={`p-1.5 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}><Icon name="trash" size={13} /></button>
                    </div>
                  </Card>
                );
              })}
              <div className="flex justify-between items-center pt-1 px-1">
                <span className="text-xs text-slate-500">{form.lines.length} {form.lines.length === 1 ? "item" : "itens"}</span>
                <span className="text-teal-400 font-black">{fmt(form.lines.reduce((s, l) => s + l.total, 0))}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-1">
          <Btn onClick={() => { setView("list"); setEditingPurchase(null); }} variant="secondary" className="flex-1">Cancelar</Btn>
          <Btn onClick={savePurchase} disabled={form.lines.length === 0 || !form.date || !form.marketId} className="flex-1">{editingPurchase ? "Atualizar" : "Salvar Compra"}</Btn>
        </div>

        {lineModal && (
          <Modal title={editIdx !== null ? "Editar Item" : "Adicionar Item"} onClose={() => setLineModal(false)}>
            <div className="space-y-3">
              <ProductSearch label="Produto" value={lf.itemId} onChange={v => setLf({ ...lf, itemId: v, numPkgs: "", pkgQty: "", pricePerPkg: "", discount: "0" })} items={items} required />
              {lineItem && (
                <>
                  <div className={`flex gap-2 items-start px-3 py-2.5 rounded-xl text-xs ${isBulk ? "bg-teal-500/10 text-teal-400" : "bg-amber-500/10 text-amber-400"}`}>
                    <span className="flex-shrink-0 mt-0.5"><Icon name={isBulk ? "scale" : "box"} size={13} /></span>
                    <span>{isBulk ? `Granel — informe embalagens, ${du} por emb. e preço/emb.` : `Emb. fixa de ${fmtN(lineItem.pkgSize || 0, 0)} ${lineItem.pkgUnit} — informe qtd. e preço`}</span>
                  </div>
                  <Inp inputRef={numPkgsRef} label="Nº de embalagens" type="number" value={lf.numPkgs} onChange={v => setLf({ ...lf, numPkgs: v })} placeholder="Ex: 2" min="0.001" step="1" required onEnter={() => { if (isBulk && pkgQtyRef.current) pkgQtyRef.current.focus(); else if (priceRef.current) priceRef.current.focus(); }} />
                  {isBulk && <Inp inputRef={pkgQtyRef} label={`Qtd. de ${du} por emb.`} type="number" value={lf.pkgQty} onChange={v => setLf({ ...lf, pkgQty: v })} placeholder="Ex: 500" min="0.001" step="0.001" required onEnter={() => { if (priceRef.current) priceRef.current.focus(); }} />}
                  <Inp inputRef={priceRef} label="Preço por emb. (R$)" type="number" value={lf.pricePerPkg} onChange={v => setLf({ ...lf, pricePerPkg: v })} placeholder="0,00" min="0.01" step="0.01" required onEnter={() => { if (discountRef.current) discountRef.current.focus(); }} />
                  <Inp inputRef={discountRef} label="Desconto total no item (R$)" type="number" value={lf.discount} onChange={v => setLf({ ...lf, discount: v })} placeholder="0,00 (opcional)" min="0" step="0.01" onEnter={() => { if (brandRef.current) brandRef.current.focus(); }} />
                  {canPreview && (
                    <div className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl px-4 py-3 space-y-1.5`}>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Resumo</p>
                      {isBulk && (
                        <>
                          <div className="flex justify-between text-xs"><span className="text-slate-500">Total em {du}</span><span className={`${isDark ? "text-slate-300" : "text-slate-700"} font-semibold`}>{fmtN(+lf.numPkgs * +lf.pkgQty, 3).replace(/,?0+$/, "")} {du}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-slate-500">Preço/{du} original</span><span className={`${isDark ? "text-slate-300" : "text-slate-700"} font-semibold`}>{fmt(+lf.pricePerPkg / +lf.pkgQty)}</span></div>
                        </>
                      )}
                      {!isBulk && lineItem.pkgSize && (
                        <div className="flex justify-between text-xs"><span className="text-slate-500">Preço/{lineItem.pkgUnit?.replace(/s$/, "")} original</span><span className={`${isDark ? "text-slate-300" : "text-slate-700"} font-semibold`}>{fmt(+lf.pricePerPkg / lineItem.pkgSize)}</span></div>
                      )}
                      {discountVal > 0 && (
                        <div className={`${isDark ? "border-t border-slate-800" : "border-t border-slate-200"} pt-1.5 mt-1 space-y-1`}>
                          <div className="flex justify-between text-xs"><span className="text-amber-400 flex items-center gap-1"><Icon name="tag" size={10} />Desconto total</span><span className="text-amber-400 font-bold">- {fmt(discountVal)}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-slate-500">Preço/emb c/ desconto</span><span className="text-green-400 font-bold">{fmt(+lf.pricePerPkg - discountVal / +lf.numPkgs)}</span></div>
                        </div>
                      )}
                      <div className={`flex justify-between text-xs ${isDark ? "border-t border-slate-800" : "border-t border-slate-200"} pt-1.5 mt-1`}><span className="text-slate-500">Total a pagar</span><span className="text-teal-400 font-black">{fmt(+lf.numPkgs * +lf.pricePerPkg - discountVal)}</span></div>
                    </div>
                  )}
                  <Inp inputRef={brandRef} label="Marca (opcional)" value={lf.brand} onChange={v => setLf({ ...lf, brand: v })} placeholder="Ex: Camil, Yoki..." onEnter={() => { if (noteRef.current) noteRef.current.focus(); }} />
                  <Inp inputRef={noteRef} label="Observações (opcional)" value={lf.note} onChange={v => setLf({ ...lf, note: v })} placeholder="Anotação livre..." onEnter={saveLine} />
                </>
              )}
              <div className="flex gap-3 pt-1">
                <Btn onClick={() => setLineModal(false)} variant="secondary" className="flex-1">Cancelar</Btn>
                <Btn onClick={saveLine} disabled={!lf.itemId || !lf.numPkgs || !lf.pricePerPkg || (isBulk && !lf.pkgQty)} className="flex-1">Confirmar</Btn>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {sorted.length > 0 && (
            <Btn
              onClick={() => { setSelecting(!selecting); setSelectedIds(new Set()); }}
              variant={selecting ? "success" : "outline"}
              size="sm"
            >
              <Icon name="download" size={13} />{selecting ? "Cancelar" : "Exportar"}
            </Btn>
          )}
          {selecting && selectedIds.size > 0 && (
            <Btn onClick={exportSelected} size="sm">
              <Icon name="download" size={13} />Baixar ({selectedIds.size})
            </Btn>
          )}
        </div>
        <Btn
          onClick={() => { setForm({ marketId: markets[0]?.id || "", date: new Date().toISOString().slice(0, 10), note: "", lines: [] }); setEditingPurchase(null); setView("new"); }}
          disabled={items.length === 0 || markets.length === 0}
        >
          <Icon name="plus" size={15} />Nova Compra
        </Btn>
      </div>

      {selecting && sorted.length > 0 && (
        <div className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl`}>
          <p className="text-xs text-slate-500">{selectedIds.size} de {sorted.length} selecionadas</p>
          <button onClick={toggleSelectAll} className="text-xs text-teal-400 font-bold hover:text-teal-300">
            {selectedIds.size === sorted.length ? "Desmarcar todas" : "Selecionar todas"}
          </button>
        </div>
      )}

      {(items.length === 0 || markets.length === 0) && (
        <InfoBox>{items.length === 0 ? "Cadastre produtos antes de registrar uma compra." : "Cadastre ao menos um mercado primeiro."}</InfoBox>
      )}

      {sorted.length === 0 ? (
        <Empty icon="cart" title="Nenhuma compra registrada" sub="Registre suas compras para acompanhar consumo e preços ao longo do tempo." />
      ) : (
        <div className="space-y-2">
          {sorted.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              {selecting && (
                <button
                  onClick={() => toggleSelect(p.id)}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selectedIds.has(p.id) ? "bg-teal-500 border-teal-500" : isDark ? "border-slate-600" : "border-slate-300"}`}
                >
                  {selectedIds.has(p.id) && <Icon name="check" size={10} />}
                </button>
              )}
              <div className="flex-1">
                <Card onClick={selecting ? () => toggleSelect(p.id) : () => { setSelected(p); setView("detail"); }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-bold text-sm`}>{getMkt(p.marketId)}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {new Date(p.date + "T12:00:00").toLocaleDateString("pt-BR")} · {p.lines.length} {p.lines.length === 1 ? "item" : "itens"}
                      </p>
                      {p.note && <p className="text-xs text-slate-600 mt-0.5 italic truncate max-w-[200px]">{p.note}</p>}
                    </div>
                    <p className="text-teal-400 font-black">{fmt(p.total)}</p>
                  </div>
                </Card>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal title="Remover Compra" message="Remover esta compra? O estoque será ajustado automaticamente." confirmLabel="Remover" onConfirm={doDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
