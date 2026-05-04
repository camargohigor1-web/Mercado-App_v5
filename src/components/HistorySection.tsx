import { useState, useEffect } from "react";
import { useTheme } from "../hooks/useTheme";
import { useBrowserBackClose } from "../hooks/useBrowserBackClose";
import { Icon } from "./Icon";
import { Card, Badge, Empty, StatBox, BarChart, LineChart } from "./ui";
import { fmt, fmtN, getDisplayFactor, getDisplayUnit, calcStats, calcPriceByMarket } from "../utils";
import type { Item, Market, Purchase, WarehouseItem } from "../types";

interface HistorySectionProps {
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  warehouse: WarehouseItem[];
  onGoToNewPurchase?: () => void;
  onRepeatPurchase?: (purchase: Purchase) => void;
  initialPurchaseId?: string;
  initialHighlightedProductId?: string;
  onNavigateAway?: () => void;
  initialSearch?: string;
}

export function HistorySection({ items, markets, purchases, warehouse, onGoToNewPurchase, onRepeatPurchase, initialPurchaseId, initialHighlightedProductId, onNavigateAway, initialSearch }: HistorySectionProps) {
  const { isDark } = useTheme();
  const initialPurchase = initialPurchaseId ? purchases.find(p => p.id === initialPurchaseId) ?? null : null;
  const [search, setSearch] = useState(initialSearch?.trim() ?? "");
  const [filterCat, setFilterCat] = useState("");
  const [selectedItem, setSelectedItem] = useState<{ item: Item; stats: ReturnType<typeof calcStats> } | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(initialPurchase);
  const [subTab, setSubTab] = useState<"products" | "purchases">(initialPurchase ? "purchases" : "products");
  const [highlightedProductId, setHighlightedProductId] = useState<string | undefined>(initialHighlightedProductId);
  const [returnToItem, setReturnToItem] = useState<{ item: Item; stats: ReturnType<typeof calcStats> } | null>(null);
  const closeSelectedItem = useBrowserBackClose(selectedItem !== null, () => setSelectedItem(null));
  const closeSelectedPurchase = useBrowserBackClose(selectedPurchase !== null, () => {
    setSelectedPurchase(null);
    setHighlightedProductId(undefined);
    if (returnToItem) {
      setSelectedItem(returnToItem);
      setReturnToItem(null);
    } else {
      onNavigateAway?.();
    }
  });

  // Scroll to highlighted item when purchase opens, then fade out after 2s
  useEffect(() => {
    if (highlightedProductId && selectedPurchase) {
      const el = document.getElementById(`item-${highlightedProductId}`);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
      }
      const t = setTimeout(() => setHighlightedProductId(undefined), 2500);
      return () => clearTimeout(t);
    }
  }, [highlightedProductId, selectedPurchase]);

  const getMkt = (id: string) => markets.find(m => m.id === id)?.name || "Mercado";
  const getItem = (id: string) => items.find(i => i.id === id);

  const withStats = items
    .map(item => ({ item, stats: calcStats(item.id, items, purchases, warehouse.flatMap(w => w.entries || [])) }))
    .filter(({ stats }) => stats !== null)
    .filter(({ item }) => item.name.toLowerCase().includes(search.toLowerCase()))
    .filter(({ item }) => !filterCat || item.category === filterCat)
    .sort((a, b) => b.stats!.count - a.stats!.count);

  const sortedPurchases = [...purchases].sort((a, b) => b.date.localeCompare(a.date));
  const filteredPurchases = sortedPurchases.filter(p => {
    const mktName = getMkt(p.marketId).toLowerCase();
    return mktName.includes(search.toLowerCase()) || p.date.includes(search);
  });

  const groupedByDate: Record<string, Purchase[]> = {};
  filteredPurchases.forEach(p => {
    const dateKey = new Date(p.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(p);
  });

  const groupedByCategory: Record<string, typeof withStats> = {};
  withStats.forEach(({ item, stats }) => {
    const cat = item.category || "Sem categoria";
    if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
    groupedByCategory[cat].push({ item, stats });
  });

  // ── Product detail ─────────────────────────────────────────────────────────
  if (selectedItem) {
    const { item, stats } = selectedItem;
    if (!stats) return null;
    const factor = getDisplayFactor(item);
    const du = getDisplayUnit(item);

    const allEntries: any[] = [];
    purchases.forEach(p => {
      p.lines.forEach(l => {
        if (l.itemId !== item.id) return;
        allEntries.push({ ...l, date: p.date, market: getMkt(p.marketId), purchaseId: p.id });
      });
    });
    allEntries.sort((a, b) => b.date.localeCompare(a.date));

    // Price evolution chart data (chronological)
    const chronoEntries = [...allEntries].sort((a, b) => a.date.localeCompare(b.date));
    const priceEvolution = chronoEntries.map(e => ({
      label: new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      value: item.type === "bulk" ? (e.pricePerUnit || 0) / factor : (e.pricePerPkgAfterDiscount ?? e.pricePerPkg),
    }));

    // Per-market comparison
    const byMarket = calcPriceByMarket(item.id, items, purchases, markets);

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
            </div>
          </div>
        </div>

        {/* Stats grid */}
        {item.type === "bulk" ? (
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Consumo médio/mês" val={`${fmtN(stats.avgMonthly * factor, 2)} ${du}`} />
            <StatBox label={`Preço médio/${du}`} val={fmt(stats.avgPrice / factor)} color="green" />
            <StatBox label={`Menor preço/${du}`} val={fmt(stats.minPrice / factor)} color="teal" />
            <StatBox label={`Último preço/${du}`} val={fmt(stats.lastPrice / factor)} color="blue" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Consumo médio/mês" val={`${fmtN(stats.avgMonthly, 1)} emb`} />
            <StatBox label="Preço médio/emb" val={fmt(stats.avgPrice)} color="green" />
            <StatBox label="Menor preço/emb" val={fmt(stats.minPrice)} color="teal" />
            <StatBox label="Último preço/emb" val={fmt(stats.lastPrice)} color="blue" />
          </div>
        )}

        {/* Price evolution chart */}
        {priceEvolution.length >= 2 && (
          <Card>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">
              Evolução de preço ({item.type === "bulk" ? `R$/${du}` : "R$/emb"})
            </p>
            <LineChart data={priceEvolution} formatValue={fmt} />
          </Card>
        )}

        {/* Per-market comparison */}
        {byMarket.length > 1 && (
          <Card>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">
              Preço médio por mercado ({item.type === "bulk" ? `R$/${du}` : "R$/emb"})
            </p>
            <BarChart
              data={byMarket.map(m => ({
                label: m.marketName,
                value: item.type === "bulk" ? m.avgPrice / factor : m.avgPrice,
                sub: `${m.count} compra${m.count > 1 ? "s" : ""}`,
              }))}
              colorClass="bg-blue-500"
              formatValue={fmt}
            />
          </Card>
        )}

        {/* Purchase history */}
        <div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">{allEntries.length} registro(s) de compra</p>
          <div className="space-y-2">
            {allEntries.map((e, i) => (
              <Card
                key={i}
                onClick={() => {
                  const purchase = purchases.find(p => p.id === e.purchaseId) ?? null;
                  if (purchase) {
                    setHighlightedProductId(item.id);
                    setReturnToItem(selectedItem);
                    setSelectedPurchase(purchase);
                    setSelectedItem(null);
                    setSubTab("purchases");
                  }
                }}
                className="cursor-pointer hover:border-teal-500/40 active:scale-[0.98] transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`${isDark ? "text-slate-100" : "text-slate-900"} text-sm font-semibold`}>{e.market}</p>
                      <Badge color="blue">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</Badge>
                    </div>
                    {e.brand && <p className="text-xs text-slate-500">Marca: {e.brand}</p>}
                    {item.type === "bulk" ? (
                      <>
                        <p className="text-xs text-slate-500 mt-1">
                          {e.numPkgs} emb x {fmtN(+(e.pkgQty * factor).toPrecision(10), 3).replace(/,?0+$/, "")} {du} = <span className={isDark ? "text-slate-300" : "text-slate-700"}>{fmtN(+(e.totalQty * factor).toPrecision(10), 3).replace(/,?0+$/, "")} {du}</span>
                        </p>
                        <p className="text-xs text-teal-500">{fmt(e.pricePerPkg)}/emb ▸ {fmt((e.pricePerUnit || 0) / factor)}/{du}</p>
                        {e.discountTotal > 0 && <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5"><Icon name="tag" size={10} />Desc: {fmt(e.discountTotal)} · Líquido: {fmt(e.pricePerPkgAfterDiscount)}/emb</p>}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 mt-1">{e.numPkgs} emb x {fmt(e.pricePerPkg)}/emb</p>
                        {e.discountTotal > 0 && <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5"><Icon name="tag" size={10} />Desc: {fmt(e.discountTotal)} · Líquido: {fmt(e.pricePerPkgAfterDiscount)}/emb</p>}
                        <p className="text-xs text-teal-500">{fmt(e.pricePerInternal)}/{item.pkgUnit?.replace(/s$/, "")}</p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-teal-400 font-black text-sm">{fmt(e.total)}</p>
                    {onRepeatPurchase && <Icon name="chevron" size={12} />}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Purchase detail ────────────────────────────────────────────────────────
  if (selectedPurchase) {
    const p = selectedPurchase;
    return (
      <div className="space-y-4 animate-slide-in-right">
        <div className="flex items-center gap-3">
          <button onClick={closeSelectedPurchase} className={`${isDark ? "text-slate-500 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"} p-1`}><Icon name="back" size={20} /></button>
          <div className="flex-1">
            {returnToItem && (
              <p className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1">
                <span className="truncate max-w-[120px]">{returnToItem.item.name}</span>
                <span className="text-slate-700">›</span>
                <span>Compra</span>
              </p>
            )}
            <h2 className={`text-base font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>{getMkt(p.marketId)}</h2>
            <p className="text-xs text-slate-500">{new Date(p.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <div className="space-y-2">
          {p.lines.map((l, i) => {
            const it = getItem(l.itemId); if (!it) return null;
            const factor = getDisplayFactor(it);
            const du2 = getDisplayUnit(it);
            const isHighlighted = highlightedProductId === l.itemId;
            return (
              <Card key={i} className={`highlight-fadeable${isHighlighted ? " highlighted-item" : ""}`}>
                <div id={`item-${l.itemId}`} className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`${isDark ? "text-slate-100" : "text-slate-900"} text-sm font-semibold`}>{it.name}</p>
                    {l.brand && <p className="text-xs text-slate-500 mt-0.5">Marca: {l.brand}</p>}
                    {it.type === "bulk" ? (
                      <>
                        <p className="text-xs text-slate-500 mt-1">
                          {l.numPkgs} emb x {fmtN(+((l.pkgQty || 0) * factor).toPrecision(10), 3).replace(/,?0+$/, "")} {du2} = {fmtN(+((l.totalQty || 0) * factor).toPrecision(10), 3).replace(/,?0+$/, "")} {du2}
                        </p>
                        <p className="text-xs text-teal-500">{fmt(l.pricePerPkg)}/emb ▸ {fmt((l.pricePerUnit || 0) / factor)}/{du2}</p>
                        {l.discountTotal > 0 && <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5"><Icon name="tag" size={10} />Desc: {fmt(l.discountTotal)} · Líquido: {fmt(l.pricePerPkgAfterDiscount || 0)}/emb</p>}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 mt-1">{l.numPkgs} emb x {fmt(l.pricePerPkg)}/emb</p>
                        {l.discountTotal > 0 && <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5"><Icon name="tag" size={10} />Desc: {fmt(l.discountTotal)} · Líquido: {fmt(l.pricePerPkgAfterDiscount || 0)}/emb</p>}
                        <p className="text-xs text-teal-500">{fmt(l.pricePerInternal || 0)}/{it.pkgUnit?.replace(/s$/, "")}</p>
                      </>
                    )}
                  </div>
                  <p className="text-teal-400 font-black text-sm flex-shrink-0">{fmt(l.total)}</p>
                </div>
              </Card>
            );
          })}
        </div>
        <div className="space-y-2">
          <Card className="flex justify-between items-center">
            <span className="text-slate-500 text-sm">{p.lines.length} {p.lines.length === 1 ? "item" : "itens"}</span>
            <span className="text-teal-400 font-black text-lg">{fmt(p.total)}</span>
          </Card>
          {onRepeatPurchase && (
            <button
              onClick={() => onRepeatPurchase(p)}
              className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-95 ${isDark ? "bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25" : "bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"}`}
            >
              <Icon name="copy" size={15} />
              Repetir esta compra
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className={`flex gap-2 ${isDark ? "bg-slate-900" : "bg-slate-100"} rounded-xl p-1`}>
        {[{ id: "products", label: "Produtos" }, { id: "purchases", label: "Compras" }].map(t => (
          <button key={t.id} onClick={() => { setSubTab(t.id as "products" | "purchases"); setSearch(""); setFilterCat(""); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${subTab === t.id ? "bg-teal-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={subTab === "products" ? "Buscar produto..." : "Buscar mercado ou data..."}
        className={`w-full ${isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-700" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-all`}
      />

      {/* Category chips — only on products tab */}
      {subTab === "products" && (() => {
        const catsWithData = [...new Set(
          items
            .filter(item => calcStats(item.id, items, purchases, warehouse.flatMap(w => w.entries || [])) !== null)
            .map(item => item.category)
            .filter(Boolean)
        )];
        if (catsWithData.length <= 1) return null;
        return (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterCat("")}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${!filterCat ? "bg-teal-500 text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-200 text-slate-500 hover:text-slate-700"}`}
            >
              Todas
            </button>
            {catsWithData.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(filterCat === cat ? "" : cat)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${filterCat === cat ? "bg-teal-500 text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-200 text-slate-500 hover:text-slate-700"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        );
      })()}

      {subTab === "products" && (
        purchases.length === 0 ? (
          <div className="flex flex-col items-center text-center py-12 gap-4 px-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
              <Icon name="history" size={24} />
            </div>
            <div className="space-y-1">
              <p className={`font-black text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Nenhuma compra ainda</p>
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Registre suas compras para ver o histórico de consumo e evolução de preços por produto.</p>
            </div>
            {onGoToNewPurchase && (
              <button
                onClick={onGoToNewPurchase}
                className="px-5 py-2.5 rounded-xl bg-teal-500 text-white text-xs font-black shadow-lg shadow-teal-500/25 active:scale-95 transition-transform"
              >
                Registrar primeira compra
              </button>
            )}
          </div>
        ) : withStats.length === 0 ? (
          <Empty icon="history" title="Nenhum resultado" />
        ) : (
          Object.entries(groupedByCategory).map(([cat, prods]) => (
            <div key={cat}>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 px-1">{cat}</p>
              <div className="space-y-2">
                {prods.map(({ item, stats }) => {
                  if (!stats) return null;
                  const factor = getDisplayFactor(item);
                  const du2 = getDisplayUnit(item);
                  return (
                    <Card key={item.id} onClick={() => setSelectedItem({ item, stats })} className={isDark ? "hover:border-slate-600" : "hover:border-slate-300"}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-bold text-sm`}>{item.name}</p>
                          <div className="flex gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs text-slate-500">Consumo: <span className={isDark ? "text-slate-300" : "text-slate-700"}>{item.type === "bulk" ? `${fmtN(stats.avgMonthly * factor, 2)} ${du2}/mês` : `${fmtN(stats.avgMonthly, 1)} emb/mês`}</span></span>
                            <span className="text-xs text-slate-500">Médio: <span className="text-green-400 font-semibold">{item.type === "bulk" ? `${fmt(stats.avgPrice / factor)}/${du2}` : `${fmt(stats.avgPrice)}/emb`}</span></span>
                            <span className="text-xs text-slate-500">Último: <span className="text-blue-400">{item.type === "bulk" ? `${fmt(stats.lastPrice / factor)}/${du2}` : fmt(stats.lastPrice)}</span></span>
                          </div>
                        </div>
                        <span className="text-slate-600 flex-shrink-0 ml-2"><Icon name="chevron" size={16} /></span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )
      )}

      {subTab === "purchases" && (
        sortedPurchases.length === 0 ? (
          <div className="flex flex-col items-center text-center py-12 gap-4 px-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
              <Icon name="cart" size={24} />
            </div>
            <div className="space-y-1">
              <p className={`font-black text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Nenhuma compra registrada</p>
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Suas compras vão aparecer aqui com data, mercado e valor total.</p>
            </div>
            {onGoToNewPurchase && (
              <button
                onClick={onGoToNewPurchase}
                className="px-5 py-2.5 rounded-xl bg-teal-500 text-white text-xs font-black shadow-lg shadow-teal-500/25 active:scale-95 transition-transform"
              >
                Registrar primeira compra
              </button>
            )}
          </div>
        ) : filteredPurchases.length === 0 ? (
          <Empty icon="cart" title="Nenhum resultado" />
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedByDate).map(([dateKey, dayPurchases]) => (
              <div key={dateKey}>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 px-1">{dateKey}</p>
                <div className="space-y-2">
                  {dayPurchases.map(p => (
                    <Card key={p.id} className={isDark ? "hover:border-slate-600" : "hover:border-slate-300"}>
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setSelectedPurchase(p)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-bold text-sm`}>{getMkt(p.marketId)}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{p.lines.length} {p.lines.length === 1 ? "item" : "itens"}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-teal-400 font-black">{fmt(p.total)}</p>
                          <span className="text-slate-600"><Icon name="chevron" size={16} /></span>
                        </div>
                      </div>
                      {onRepeatPurchase && (
                        <div className={`mt-2.5 pt-2.5 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                          <button
                            onClick={e => { e.stopPropagation(); onRepeatPurchase(p); }}
                            className={`w-full py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${isDark ? "text-teal-400 hover:bg-teal-500/10" : "text-teal-600 hover:bg-teal-50"}`}
                          >
                            <Icon name="copy" size={12} />
                            Repetir esta compra
                          </button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
