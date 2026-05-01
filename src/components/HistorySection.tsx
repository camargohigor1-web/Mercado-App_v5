import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Card, Badge, Empty, StatBox, BarChart, LineChart } from "./ui";
import { fmt, fmtN, getDisplayFactor, getDisplayUnit, calcStats, calcPriceByMarket } from "../utils";
import type { Item, Market, Purchase, WarehouseItem } from "../types";

interface HistorySectionProps {
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  warehouse: WarehouseItem[];
}

export function HistorySection({ items, markets, purchases, warehouse }: HistorySectionProps) {
  const { isDark } = useTheme();
  const [subTab, setSubTab] = useState<"products" | "purchases">("products");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [selectedItem, setSelectedItem] = useState<{ item: Item; stats: ReturnType<typeof calcStats> } | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

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
        allEntries.push({ ...l, date: p.date, market: getMkt(p.marketId) });
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
          <button onClick={() => setSelectedItem(null)} className={`${isDark ? "text-slate-500 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"} p-1`}><Icon name="back" size={20} /></button>
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
              <Card key={i}>
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
                  <p className="text-teal-400 font-black text-sm">{fmt(e.total)}</p>
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
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedPurchase(null)} className={`${isDark ? "text-slate-500 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"} p-1`}><Icon name="back" size={20} /></button>
          <div className="flex-1">
            <h2 className={`text-base font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>{getMkt(p.marketId)}</h2>
            <p className="text-xs text-slate-500">{new Date(p.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <div className="space-y-2">
          {p.lines.map((l, i) => {
            const it = getItem(l.itemId); if (!it) return null;
            const factor = getDisplayFactor(it);
            const du2 = getDisplayUnit(it);
            return (
              <Card key={i}>
                <div className="flex justify-between items-start gap-3">
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
        <Card className="flex justify-between items-center">
          <span className="text-slate-500 text-sm">{p.lines.length} {p.lines.length === 1 ? "item" : "itens"}</span>
          <span className="text-teal-400 font-black text-lg">{fmt(p.total)}</span>
        </Card>
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
          <Empty icon="history" title="Nenhum dado ainda" sub="Registre compras para ver histórico de consumo e evolução de preços." />
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
          <Empty icon="cart" title="Nenhuma compra registrada" sub="Registre suas compras para ver o histórico aqui." />
        ) : filteredPurchases.length === 0 ? (
          <Empty icon="cart" title="Nenhum resultado" />
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedByDate).map(([dateKey, dayPurchases]) => (
              <div key={dateKey}>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 px-1">{dateKey}</p>
                <div className="space-y-2">
                  {dayPurchases.map(p => (
                    <Card key={p.id} onClick={() => setSelectedPurchase(p)} className={isDark ? "hover:border-slate-600" : "hover:border-slate-300"}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-bold text-sm`}>{getMkt(p.marketId)}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{p.lines.length} {p.lines.length === 1 ? "item" : "itens"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-teal-400 font-black">{fmt(p.total)}</p>
                          <span className="text-slate-600"><Icon name="chevron" size={16} /></span>
                        </div>
                      </div>
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
