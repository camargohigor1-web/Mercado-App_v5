import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Badge } from "./ui";
import { fmt, getLowStockItems } from "../utils";
import type { Item, Market, Purchase, WarehouseItem, ShoppingListEntry } from "../types";

interface HomeSectionProps {
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  warehouse: WarehouseItem[];
  shoppingList: ShoppingListEntry[];
  onGoToNewPurchase: () => void;
  onGoToHistory: () => void;
  onGoToWarehouse: () => void;
  onGoToItems: () => void;
  onRepeatPurchase: (purchase: Purchase) => void;
  onGoToReports: (month: string) => void;
}

function cap(str: string) { return str.charAt(0).toUpperCase() + str.slice(1); }

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function getWeekday() {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function shortMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return cap(new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""));
}

// Build last N months array
function buildMonths(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (n - 1 - i));
    return d.toISOString().slice(0, 7);
  });
}

const CHART_COLORS = [
  { bar: "#14b8a6", text: "#2dd4bf" },
  { bar: "#3b82f6", text: "#60a5fa" },
  { bar: "#8b5cf6", text: "#a78bfa" },
  { bar: "#f59e0b", text: "#fbbf24" },
  { bar: "#f43f5e", text: "#fb7185" },
];

// ── Gasto por categoria ────────────────────────────────────────────────────────
function CategoryChart({ purchases, items, month, isDark }: {
  purchases: Purchase[]; items: Item[]; month: string; isDark: boolean;
}) {
  const byCategory: Record<string, number> = {};
  purchases.filter(p => p.date.startsWith(month)).forEach(p =>
    p.lines.forEach(l => {
      const cat = items.find(i => i.id === l.itemId)?.category || "Outros";
      byCategory[cat] = (byCategory[cat] || 0) + l.total;
    })
  );
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = Math.max(...entries.map(e => e[1]), 1);

  if (entries.length === 0) return (
    <p className={`text-xs text-center py-4 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
      Sem compras neste mês
    </p>
  );

  return (
    <div className="space-y-3">
      {entries.map(([cat, value], i) => {
        const c = CHART_COLORS[i % CHART_COLORS.length];
        const pct = Math.max((value / max) * 100, 3);
        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.bar }} />
                <span className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>{cat}</span>
              </div>
              <span className="text-xs font-black" style={{ color: c.text }}>{fmt(value)}</span>
            </div>
            <div className={`w-full h-2 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
              <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c.bar }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Gastos mensais clicáveis ───────────────────────────────────────────────────
function MonthlyChart({ purchases, selectedMonth, onSelectMonth, isDark }: {
  purchases: Purchase[];
  selectedMonth: string;
  onSelectMonth: (m: string) => void;
  isDark: boolean;
}) {
  const months = buildMonths(6);
  const totals = months.map(key => ({
    key,
    label: shortMonthLabel(key),
    total: purchases.filter(p => p.date.startsWith(key)).reduce((s, p) => s + p.total, 0),
  }));
  const max = Math.max(...totals.map(m => m.total), 1);
  const hasData = totals.some(m => m.total > 0);

  if (!hasData) return (
    <p className={`text-xs text-center py-4 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
      Sem histórico ainda
    </p>
  );

  const currentKey = new Date().toISOString().slice(0, 7);

  // compare vs previous month
  const selIdx = months.indexOf(selectedMonth);
  const selTotal = totals[selIdx]?.total ?? 0;
  const prevTotal = selIdx > 0 ? totals[selIdx - 1]?.total ?? 0 : 0;
  const diff = prevTotal > 0 ? ((selTotal - prevTotal) / prevTotal) * 100 : null;

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: "72px" }}>
        {totals.map(m => {
          const isSelected = m.key === selectedMonth;
          const isCurrent = m.key === currentKey;
          const h = m.total > 0 ? Math.max((m.total / max) * 64, 6) : 3;
          return (
            <button
              key={m.key}
              onClick={() => onSelectMonth(m.key)}
              className="flex-1 flex flex-col items-center justify-end focus:outline-none group"
              style={{ height: "72px" }}
            >
              <div
                className="w-full rounded-t-lg transition-all duration-300 group-active:scale-95"
                style={{
                  height: `${h}px`,
                  background: isSelected
                    ? "#14b8a6"
                    : isCurrent
                      ? "rgba(20,184,166,0.35)"
                      : isDark ? "#1e293b" : "#e2e8f0",
                  boxShadow: isSelected ? "0 0 14px rgba(20,184,166,0.4)" : "none",
                  transform: isSelected ? "scaleY(1.04)" : "scaleY(1)",
                  transformOrigin: "bottom",
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {totals.map(m => (
          <button
            key={m.key}
            onClick={() => onSelectMonth(m.key)}
            className="flex-1 text-center focus:outline-none"
          >
            <span
              className="text-[9px] font-black"
              style={{ color: m.key === selectedMonth ? "#2dd4bf" : isDark ? "#475569" : "#94a3b8" }}
            >
              {m.label}
            </span>
          </button>
        ))}
      </div>
      {/* Comparativo */}
      <div className={`flex items-center justify-between mt-3 pt-3 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
        <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          {cap(monthLabel(selectedMonth))}
        </span>
        <div className="flex items-center gap-2">
          {diff !== null && selTotal > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              diff > 0
                ? isDark ? "bg-red-500/15 text-red-400" : "bg-red-50 text-red-500"
                : isDark ? "bg-teal-500/15 text-teal-400" : "bg-teal-50 text-teal-600"
            }`}>
              {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
            </span>
          )}
          <span className={`text-sm font-black ${selTotal > 0 ? "text-teal-400" : isDark ? "text-slate-600" : "text-slate-300"}`}>
            {selTotal > 0 ? fmt(selTotal) : "Sem compras"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Botão Nova Compra ──────────────────────────────────────────────────────────
function NewPurchaseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-4 rounded-2xl bg-teal-500 text-white font-black text-base shadow-xl shadow-teal-500/30 active:scale-[0.97] transition-all flex items-center justify-center gap-3 group"
    >
      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center group-active:scale-90 transition-transform">
        <Icon name="plus" size={17} />
      </div>
      Nova compra
    </button>
  );
}

// ── Greeting ───────────────────────────────────────────────────────────────────
function Greeting({ isDark }: { isDark: boolean }) {
  return (
    <div className="pt-1 pb-1">
      <p className={`text-xl font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>
        {getGreeting()} 👋
      </p>
      <p className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
        {cap(getWeekday())}
      </p>
    </div>
  );
}

// ── HomeSection principal ──────────────────────────────────────────────────────
export function HomeSection({
  items, markets, purchases, warehouse,
  onGoToNewPurchase, onGoToHistory, onGoToWarehouse, onGoToItems,
  onRepeatPurchase, onGoToReports,
}: HomeSectionProps) {
  const { isDark } = useTheme();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const sorted       = [...purchases].sort((a, b) => b.date.localeCompare(a.date));
  const lastPurchase = sorted[0] ?? null;

  // Stats for selected month
  const monthPurchases = purchases.filter(p => p.date.startsWith(selectedMonth));
  const monthTotal     = monthPurchases.reduce((s, p) => s + p.total, 0);
  const isCurrentMonth = selectedMonth === currentMonth;

  const low      = getLowStockItems(items, purchases, warehouse);
  const critical = low.filter(l => l.daysLeft <= 7);
  const warning  = low.filter(l => l.daysLeft > 7 && l.daysLeft <= 15);
  const getMkt   = (id: string) => markets.find(m => m.id === id)?.name ?? "Mercado";

  const card  = `rounded-2xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} p-4`;
  const lbl   = `text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`;
  const ttl   = `font-black ${isDark ? "text-slate-100" : "text-slate-900"}`;
  const sub   = `text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`;

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (purchases.length === 0 && items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-14 space-y-6 text-center animate-fade-slide-up">
      <div className="w-20 h-20 rounded-3xl bg-teal-500/15 flex items-center justify-center">
        <Icon name="cart" size={36} />
      </div>
      <div className="space-y-1.5">
        <p className={`text-xl font-black ${ttl}`}>Bem-vindo ao MercadoApp</p>
        <p className={sub}>Registre compras e acompanhe seus gastos.</p>
      </div>
      <div className="space-y-3 w-full max-w-xs">
        <button onClick={onGoToNewPurchase} className="w-full py-4 rounded-2xl bg-teal-500 text-white font-black text-sm shadow-lg shadow-teal-500/25 active:scale-95 transition-transform flex items-center justify-center gap-2">
          <Icon name="plus" size={16} />Registrar primeira compra
        </button>
        <button onClick={onGoToItems} className={`w-full py-3 rounded-2xl text-sm font-bold border transition-colors ${isDark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>
          Cadastrar produtos antes
        </button>
      </div>
    </div>
  );

  // ── Sem compras ainda ──────────────────────────────────────────────────────
  if (purchases.length === 0) return (
    <div className="space-y-5 animate-fade-slide-up">
      <Greeting isDark={isDark} />
      <NewPurchaseBtn onClick={onGoToNewPurchase} />
      <div className={`rounded-2xl border p-4 ${isDark ? "bg-teal-500/10 border-teal-500/30" : "bg-teal-50 border-teal-200"}`}>
        <p className={`text-sm font-black ${isDark ? "text-teal-300" : "text-teal-700"}`}>Tudo pronto para sua primeira compra</p>
        <p className={`text-xs mt-1 ${isDark ? "text-teal-400/70" : "text-teal-600/80"}`}>
          {items.length} produto{items.length !== 1 ? "s" : ""} cadastrado{items.length !== 1 ? "s" : ""}. Comece agora.
        </p>
      </div>
    </div>
  );

  // ── Normal ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Saudação */}
      <div className="animate-fade-slide-up">
        <Greeting isDark={isDark} />
      </div>

      {/* Botão principal */}
      <div className="animate-fade-slide-up stagger-1">
        <NewPurchaseBtn onClick={onGoToNewPurchase} />
      </div>

      {/* Gráfico — Gastos mensais (clicável) */}
      <div className="animate-fade-slide-up stagger-1">
        <p className={`${lbl} mb-2.5`}>Gastos — últimos 6 meses</p>
        <div className={card}>
          <MonthlyChart
            purchases={purchases}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Resumo do mês selecionado */}
      <div className="animate-fade-slide-up stagger-2">
        <div className="flex items-center justify-between mb-2.5">
          <p className={lbl}>{cap(monthLabel(selectedMonth))}</p>
          {!isCurrentMonth && (
            <button
              onClick={() => setSelectedMonth(currentMonth)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors ${isDark ? "text-teal-400 hover:bg-teal-500/10" : "text-teal-600 hover:bg-teal-50"}`}
            >
              Voltar ao atual
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Card gasto — clicável para relatório */}
          <button
            onClick={() => monthTotal > 0 && onGoToReports(selectedMonth)}
            disabled={monthTotal === 0}
            className={`${card} text-left transition-all active:scale-95 ${monthTotal > 0 ? "cursor-pointer hover:border-teal-500/40" : "cursor-default"}`}
          >
            <p className={lbl}>Gasto no mês</p>
            <p className={`text-2xl font-black mt-1.5 ${monthTotal > 0 ? "text-teal-400" : isDark ? "text-slate-700" : "text-slate-300"}`}>
              {monthTotal > 0 ? fmt(monthTotal) : "R$ —"}
            </p>
            {monthTotal > 0 && (
              <p className={`text-[10px] mt-1 flex items-center gap-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                Ver relatório <Icon name="chevron" size={9} />
              </p>
            )}
          </button>
          <div className={card}>
            <p className={lbl}>Compras</p>
            <p className={`text-2xl font-black mt-1.5 ${monthPurchases.length > 0 ? (isDark ? "text-slate-100" : "text-slate-800") : isDark ? "text-slate-700" : "text-slate-300"}`}>
              {monthPurchases.length > 0 ? monthPurchases.length : "—"}
            </p>
            {monthPurchases.length === 0 && (
              <p className={`text-[10px] mt-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                {isCurrentMonth ? "nenhuma ainda" : "sem registros"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Alertas críticos */}
      {critical.length > 0 && (
        <div className="animate-fade-slide-up stagger-2">
          <p className={`${lbl} mb-2.5`}>Acabando agora</p>
          <div className={`rounded-2xl border p-4 ${isDark ? "bg-red-500/10 border-red-500/30" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="warn" size={14} />
              <p className={`text-xs font-black ${isDark ? "text-red-300" : "text-red-700"}`}>
                {critical.length} item{critical.length !== 1 ? "s" : ""} com menos de 7 dias
              </p>
            </div>
            <div className="space-y-2">
              {critical.slice(0, 3).map(({ item, daysLeft }) => (
                <div key={item.id} className="flex items-center justify-between">
                  <p className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{item.name}</p>
                  <Badge color="red">{daysLeft <= 0 ? "acabou" : `${daysLeft}d`}</Badge>
                </div>
              ))}
              {critical.length > 3 && <p className={`text-xs ${isDark ? "text-red-400/60" : "text-red-400"}`}>+{critical.length - 3} outros</p>}
            </div>
            <button onClick={onGoToWarehouse} className={`w-full mt-3 py-2 rounded-xl text-xs font-bold border transition-colors ${isDark ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-red-200 text-red-600 hover:bg-red-50"}`}>
              Ver armazém →
            </button>
          </div>
        </div>
      )}

      {/* Alertas de atenção */}
      {warning.length > 0 && critical.length === 0 && (
        <div className="animate-fade-slide-up stagger-2">
          <p className={`${lbl} mb-2.5`}>Atenção no estoque</p>
          <div className={`rounded-2xl border p-4 ${isDark ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex flex-wrap gap-1.5">
              {warning.map(({ item, daysLeft }) => (
                <span key={item.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${isDark ? "bg-amber-500/15 text-amber-300" : "bg-amber-100 text-amber-700"}`}>
                  {item.name} <span className="opacity-60">{daysLeft}d</span>
                </span>
              ))}
            </div>
            <button onClick={onGoToWarehouse} className={`w-full mt-3 py-2 rounded-xl text-xs font-bold border transition-colors ${isDark ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" : "border-amber-200 text-amber-600 hover:bg-amber-50"}`}>
              Ver armazém →
            </button>
          </div>
        </div>
      )}

      {/* Gráfico — Gasto por categoria do mês selecionado */}
      <div className="animate-fade-slide-up stagger-3">
        <p className={`${lbl} mb-2.5`}>
          Por categoria — {cap(monthLabel(selectedMonth))}
        </p>
        <div className={card}>
          <CategoryChart purchases={purchases} items={items} month={selectedMonth} isDark={isDark} />
        </div>
      </div>

      {/* Última compra */}
      {lastPurchase && (
        <div className="animate-fade-slide-up stagger-3">
          <p className={`${lbl} mb-2.5`}>Última compra</p>
          <div className={card}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                  <Icon name="store" size={15} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-black truncate ${ttl}`}>{getMkt(lastPurchase.marketId)}</p>
                  <p className={`text-[11px] mt-0.5 ${sub}`}>
                    {new Date(lastPurchase.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    {" · "}{lastPurchase.lines.length} {lastPurchase.lines.length === 1 ? "item" : "itens"}
                  </p>
                </div>
              </div>
              <p className="text-base font-black text-teal-400 flex-shrink-0">{fmt(lastPurchase.total)}</p>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => onRepeatPurchase(lastPurchase)} className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${isDark ? "bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25" : "bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"}`}>
                <Icon name="copy" size={12} />Repetir
              </button>
              <button onClick={onGoToHistory} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${isDark ? "border border-slate-700 text-slate-400 hover:bg-slate-800" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                <Icon name="history" size={12} />Ver histórico
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
