import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Card, Empty, StatBox, BarChart } from "./ui";
import { fmt, fmtN, getLowStockItems } from "../utils";
import type { Item, Market, Purchase, WarehouseItem } from "../types";

interface ReportsSectionProps {
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  warehouse: WarehouseItem[];
  initialMonth?: string; // "YYYY-MM" — pré-filtra ao abrir
}

export function ReportsSection({ items, markets, purchases, warehouse, initialMonth }: ReportsSectionProps) {
  const { isDark } = useTheme();
  const [dateFrom, setDateFrom] = useState(initialMonth ? `${initialMonth}-01` : "");
  const [dateTo, setDateTo] = useState(() => {
    if (!initialMonth) return "";
    const [y, m] = initialMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // dia 0 do mês seguinte = último dia do mês
    return `${initialMonth}-${String(lastDay).padStart(2, "0")}`;
  });

  if (purchases.length === 0) {
    return <Empty icon="chart" title="Sem dados para relatório" sub="Registre algumas compras para visualizar os relatórios e gráficos do seu histórico." />;
  }

  const getMkt = (id: string) => markets.find(m => m.id === id)?.name || "Mercado";
  const getItem = (id: string) => items.find(i => i.id === id);

  // Apply date filter
  const filtered = purchases.filter(p => {
    if (dateFrom && p.date < dateFrom) return false;
    if (dateTo && p.date > dateTo) return false;
    return true;
  });

  const totalSpent = filtered.reduce((s, p) => s + p.total, 0);
  const uniqueProducts = new Set(filtered.flatMap(p => p.lines.map(l => l.itemId))).size;

  const monthlyMap: Record<string, number> = {};
  filtered.forEach(p => {
    const key = p.date.slice(0, 7);
    monthlyMap[key] = (monthlyMap[key] || 0) + p.total;
  });
  const allMonthKeys = Object.keys(monthlyMap).sort();
  const last12 = allMonthKeys.slice(-12);
  const monthlyData = last12.map(key => {
    const [y, m] = key.split("-");
    const label = new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    return { label, value: monthlyMap[key] };
  });

  const avgMonthlySpend = monthlyData.length > 0
    ? monthlyData.reduce((s, d) => s + d.value, 0) / monthlyData.length
    : 0;

  const marketMap: Record<string, number> = {};
  filtered.forEach(p => { const name = getMkt(p.marketId); marketMap[name] = (marketMap[name] || 0) + p.total; });
  const marketData = Object.entries(marketMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const productMap: Record<string, number> = {};
  filtered.forEach(p => { p.lines.forEach(l => { productMap[l.itemId] = (productMap[l.itemId] || 0) + l.total; }); });
  const productData = Object.entries(productMap).map(([id, value]) => ({ label: getItem(id)?.name || "Desconhecido", value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const freqMap: Record<string, number> = {};
  filtered.forEach(p => { p.lines.forEach(l => { freqMap[l.itemId] = (freqMap[l.itemId] || 0) + 1; }); });
  const freqData = Object.entries(freqMap).map(([id, value]) => ({ label: getItem(id)?.name || "Desconhecido", value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const mktCountMap: Record<string, number> = {};
  filtered.forEach(p => { const n = getMkt(p.marketId); mktCountMap[n] = (mktCountMap[n] || 0) + 1; });
  const mostVisited = Object.entries(mktCountMap).sort((a, b) => b[1] - a[1])[0];

  const sortedMonths = Object.keys(monthlyMap).sort();
  const lastMonthSpend = sortedMonths.length >= 1 ? monthlyMap[sortedMonths[sortedMonths.length - 1]] : 0;
  const prevMonthSpend = sortedMonths.length >= 2 ? monthlyMap[sortedMonths[sortedMonths.length - 2]] : null;
  const trendPct = prevMonthSpend && prevMonthSpend > 0 ? ((lastMonthSpend - prevMonthSpend) / prevMonthSpend) * 100 : null;

  const lowStockItems = getLowStockItems(items, purchases, warehouse);

  const catMap: Record<string, number> = {};
  filtered.forEach(p => { p.lines.forEach(l => { const it = getItem(l.itemId); const cat = it?.category || "Outro"; catMap[cat] = (catMap[cat] || 0) + l.total; }); });
  const catData = Object.entries(catMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const hasFilter = dateFrom || dateTo;

  return (
    <div className="space-y-5">
      {/* Date range filter */}
      <Card>
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Filtro por período</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">De</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className={`${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-all`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Até</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className={`${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-all`} />
          </div>
        </div>
        {hasFilter && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="mt-2 text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1">
            <Icon name="x" size={11} /> Limpar filtro
          </button>
        )}
        {hasFilter && <p className="text-[10px] text-slate-600 mt-1">{filtered.length} compra{filtered.length !== 1 ? "s" : ""} no período selecionado</p>}
      </Card>

      {filtered.length === 0 ? (
        <Empty icon="chart" title="Nenhuma compra no período" sub="Ajuste o filtro de datas para ver dados." />
      ) : (
        <>
          {/* Overview */}
          <div>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Visão Geral</p>
            <div className="grid grid-cols-2 gap-2">
              <StatBox label={hasFilter ? "Total no período" : "Total gasto (histórico)"} val={fmt(totalSpent)} color="teal" />
              <StatBox label="Média mensal" val={fmt(avgMonthlySpend)} color="blue" />
              <StatBox label="Nº de compras" val={String(filtered.length)} />
              <StatBox label="Produtos distintos" val={String(uniqueProducts)} />
            </div>
            {mostVisited && (
              <div className={`mt-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl px-4 py-3 flex items-center gap-3`}>
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0"><Icon name="store" size={14} /></div>
                <div>
                  <p className="text-[10px] text-slate-500">Mercado mais visitado</p>
                  <p className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{mostVisited[0]} <span className="text-slate-500 font-normal text-xs">({mostVisited[1]} visita{mostVisited[1] > 1 ? "s" : ""})</span></p>
                </div>
                {trendPct !== null && !hasFilter && (
                  <div className="ml-auto text-right">
                    <p className="text-[10px] text-slate-500">vs. mês anterior</p>
                    <p className={`text-sm font-black ${trendPct > 0 ? "text-red-400" : "text-teal-400"}`}>{trendPct > 0 ? "+" : ""}{trendPct.toFixed(1)}%</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {monthlyData.length > 0 && (
            <Card>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Gastos Mensais</p>
              <BarChart data={monthlyData} colorClass="bg-teal-500" formatValue={fmt} />
            </Card>
          )}

          {catData.length > 0 && (
            <Card>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Gastos por Categoria</p>
              <BarChart data={catData} colorClass="bg-blue-500" formatValue={fmt} />
            </Card>
          )}

          {marketData.length > 1 && (
            <Card>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Total por Mercado</p>
              <BarChart data={marketData} colorClass="bg-amber-500" formatValue={fmt} />
            </Card>
          )}

          {productData.length > 0 && (
            <Card>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Produtos com Maior Gasto</p>
              <BarChart data={productData} colorClass="bg-teal-400" formatValue={fmt} />
            </Card>
          )}

          {freqData.length > 0 && (
            <Card>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Produtos Mais Comprados (frequência)</p>
              <BarChart data={freqData} colorClass="bg-blue-400" formatValue={(v: number) => `${v}x`} />
            </Card>
          )}

          {lowStockItems.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center"><Icon name="warn" size={12} /></div>
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Alertas de Estoque Baixo</p>
              </div>
              <div className="space-y-2">
                {lowStockItems.map(({ item, stock, daysLeft, unit }) => {
                  return (
                    <div key={item.id} className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-200"} border rounded-xl`}>
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{item.name}</p>
                        <p className="text-xs text-slate-500">{fmtN(stock, item.type === "packaged" ? 0 : 2)} {unit} em estoque</p>
                      </div>
                      <span className="bg-red-500/15 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-lg">~{daysLeft} dias</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
