import { useContext, useRef, useState, useEffect } from "react";
import { ThemeCtx } from "../hooks/useTheme";
import { useBrowserBackClose } from "../hooks/useBrowserBackClose";
import { Icon } from "./Icon";
import type { Item } from "../types";
import { getScaleOptions } from "../utils";

// ─── Btn ──────────────────────────────────────────────────────────────────────
interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}

export function Btn({ children, onClick, variant = "primary", size = "md", className = "", disabled = false }: BtnProps) {
  const { isDark } = useContext(ThemeCtx);
  const base = "inline-flex items-center gap-1.5 font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none";
  const v: Record<string, string> = {
    primary:   "bg-teal-500 text-white hover:bg-teal-400 shadow-lg shadow-teal-500/25",
    secondary: isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-200 text-slate-700 hover:bg-slate-300",
    ghost:     isDark ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100",
    outline:   isDark ? "border border-slate-700 text-slate-300 hover:bg-slate-800" : "border border-slate-300 text-slate-600 hover:bg-slate-100",
    danger:    "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30",
    success:   "bg-teal-500/15 text-teal-400 hover:bg-teal-500/25 border border-teal-500/30",
  };
  const s: Record<string, string> = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-base" };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${v[variant]} ${s[size]} ${className}`}>
      {children}
    </button>
  );
}

// ─── Inp ──────────────────────────────────────────────────────────────────────
interface InpProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  step?: string;
  min?: string;
  max?: string;
  onEnter?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function Inp({ label, value, onChange, type = "text", placeholder, className = "", required, step, min, max, onEnter, inputRef }: InpProps) {
  const { isDark } = useContext(ThemeCtx);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); }
  };
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        className={`${isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-700" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 transition-all`}
      />
    </div>
  );
}

// ─── Sel ──────────────────────────────────────────────────────────────────────
interface SelProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function Sel({ label, value, onChange, options, placeholder, className = "", required }: SelProps) {
  const { isDark } = useContext(ThemeCtx);
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-all appearance-none`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── ProductSearch ────────────────────────────────────────────────────────────
interface ProductSearchProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  items: Item[];
  required?: boolean;
}

export function ProductSearch({ label, value, onChange, items, required }: ProductSearchProps) {
  const { isDark } = useContext(ThemeCtx);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedItem = items.find((i) => i.id === value);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = items
    .filter((i) =>
      i.name.toLowerCase().includes(query.toLowerCase()) ||
      (i.category || "").toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 20);

  function select(item: Item) {
    onChange(item.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && (
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      {selectedItem && !open ? (
        <div
          className={`${isDark ? "bg-slate-900 border-teal-500 text-slate-100" : "bg-white border-teal-500 text-slate-900"} border rounded-xl px-3 py-2.5 text-sm flex items-center justify-between cursor-pointer`}
          onClick={() => { setOpen(true); setQuery(""); }}
        >
          <span>
            {selectedItem.name}{" "}
            <span className="text-slate-500 text-xs">
              ({selectedItem.type === "bulk" ? `${selectedItem.displayUnit || selectedItem.unit}` : `${selectedItem.pkgSize}${selectedItem.pkgUnit}/emb`})
            </span>
          </span>
          <span className="text-slate-500 text-xs">trocar</span>
        </div>
      ) : (
        <input
          autoFocus={open}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selectedItem ? selectedItem.name : "Digite para buscar produto..."}
          className={`${isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-600" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 transition-all`}
        />
      )}
      {open && (
        <div className={`${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300"} border rounded-xl overflow-hidden shadow-2xl z-50 max-h-52 overflow-y-auto`}>
          {filtered.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-4">Nenhum produto encontrado</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onMouseDown={() => select(item)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 ${isDark ? "hover:bg-slate-800 border-slate-800" : "hover:bg-slate-50 border-slate-200"} transition-colors border-b last:border-0`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === "bulk" ? "bg-teal-500/20 text-teal-400" : "bg-amber-500/20 text-amber-400"}`}>
                  <Icon name={item.type === "bulk" ? "scale" : "box"} size={11} />
                </div>
                <div className="min-w-0">
                  <p className={`${isDark ? "text-slate-100" : "text-slate-900"} text-sm font-medium truncate`}>{item.name}</p>
                  <p className="text-slate-500 text-[10px]">
                    {item.category} · {item.type === "bulk" ? `${item.displayUnit || item.unit}` : `${item.pkgSize}${item.pkgUnit}/emb`}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
  const { isDark } = useContext(ThemeCtx);
  const closeModal = useBrowserBackClose(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
      <div className={`${isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"} border rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl`}>
        <div className={`flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 ${isDark ? "bg-slate-950" : "bg-white"} z-10 ${isDark ? "border-b border-slate-800" : "border-b border-slate-200"}`}>
          <h2 className={`text-sm font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>{title}</h2>
          <button onClick={closeModal} className={`${isDark ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"} p-1 rounded-lg transition-colors`}>
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", variant = "danger", onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-4">
        <div className={`flex items-start gap-3 ${variant === "danger" ? "bg-red-500/10 border-red-500/30" : "bg-amber-500/10 border-amber-500/30"} border rounded-xl p-4`}>
          <span className={`${variant === "danger" ? "text-red-400" : "text-amber-400"} flex-shrink-0 mt-0.5`}>
            <Icon name="warn" size={18} />
          </span>
          <p className={`text-sm leading-relaxed ${variant === "danger" ? "text-red-300" : "text-amber-300"}`}>{message}</p>
        </div>
        <div className="flex gap-3">
          <Btn onClick={onCancel} variant="secondary" className="flex-1">{cancelLabel}</Btn>
          <Btn onClick={onConfirm} variant={variant === "danger" ? "danger" : "primary"} className="flex-1">
            <Icon name={variant === "danger" ? "trash" : "check"} size={15} />
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  const { isDark } = useContext(ThemeCtx);
  return (
    <div
      onClick={onClick}
      className={`${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-2xl p-4 ${onClick ? `cursor-pointer ${isDark ? "hover:border-slate-700" : "hover:border-slate-300"} active:scale-[.99]` : ""} transition-all ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  color?: "slate" | "teal" | "amber" | "blue" | "red" | "green";
}

export function Badge({ children, color = "slate" }: BadgeProps) {
  const { isDark } = useContext(ThemeCtx);
  const c = isDark
    ? { slate: "bg-slate-800 text-slate-400", teal: "bg-teal-500/15 text-teal-400", amber: "bg-amber-500/15 text-amber-400", blue: "bg-blue-500/15 text-blue-400", red: "bg-red-500/15 text-red-400", green: "bg-green-500/15 text-green-400" }
    : { slate: "bg-slate-200 text-slate-600", teal: "bg-teal-100 text-teal-700", amber: "bg-amber-100 text-amber-700", blue: "bg-blue-100 text-blue-700", red: "bg-red-100 text-red-700", green: "bg-green-100 text-green-700" };
  return (
    <span className={`${c[color] || c.slate} text-[10px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap`}>
      {children}
    </span>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────
interface EmptyProps {
  icon: string;
  title: string;
  sub?: string;
}

export function Empty({ icon, title, sub }: EmptyProps) {
  const { isDark } = useContext(ThemeCtx);
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
      <div className={isDark ? "text-slate-800" : "text-slate-300"}>
        <Icon name={icon} size={44} />
      </div>
      <p className={`${isDark ? "text-slate-300" : "text-slate-700"} font-bold text-sm`}>{title}</p>
      {sub && <p className={`${isDark ? "text-slate-600" : "text-slate-500"} text-xs leading-relaxed`}>{sub}</p>}
    </div>
  );
}

// ─── InfoBox ──────────────────────────────────────────────────────────────────
interface InfoBoxProps {
  children: React.ReactNode;
  color?: "amber" | "teal" | "blue";
}

export function InfoBox({ children, color = "amber" }: InfoBoxProps) {
  const c: Record<string, string> = {
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    teal: "bg-teal-500/10 border-teal-500/30 text-teal-400",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  };
  return (
    <div className={`${c[color]} border rounded-xl px-4 py-3 text-xs flex gap-2 items-start leading-relaxed`}>
      <span className="mt-0.5 flex-shrink-0"><Icon name="info" size={14} /></span>
      <span>{children}</span>
    </div>
  );
}

// ─── StatBox ──────────────────────────────────────────────────────────────────
interface StatBoxProps {
  label: string;
  val: string;
  color?: "" | "teal" | "blue" | "red" | "green";
}

export function StatBox({ label, val, color = "" }: StatBoxProps) {
  const { isDark } = useContext(ThemeCtx);
  const bg = color === "teal" ? "bg-teal-500/10" : color === "blue" ? "bg-blue-500/10" : color === "red" ? "bg-red-500/10" : color === "green" ? "bg-green-500/10" : isDark ? "bg-slate-800/80" : "bg-slate-100";
  const tx = color === "teal" ? "text-teal-400" : color === "blue" ? "text-blue-400" : color === "red" ? "text-red-400" : color === "green" ? "text-green-400" : isDark ? "text-slate-100" : "text-slate-900";
  const lx = color === "teal" ? "text-teal-700" : color === "blue" ? "text-blue-700" : color === "red" ? "text-red-700" : color === "green" ? "text-green-700" : "text-slate-500";
  return (
    <div className={`${bg} rounded-xl p-3`}>
      <p className={`text-[10px] mb-0.5 ${lx}`}>{label}</p>
      <p className={`font-black text-sm ${tx}`}>{val}</p>
    </div>
  );
}

// ─── BarChart ─────────────────────────────────────────────────────────────────
interface BarChartItem {
  label: string;
  value: number;
  sub?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  colorClass?: string;
  formatValue: (v: number) => string;
}

export function BarChart({ data, colorClass = "bg-teal-500", formatValue }: BarChartProps) {
  const { isDark } = useContext(ThemeCtx);
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.value), 0.01);
  return (
    <div className="space-y-2.5">
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between items-baseline mb-1">
            <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"} truncate max-w-[60%]`}>{item.label}</span>
            <span className={`text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{formatValue(item.value)}</span>
          </div>
          <div className={`h-2 ${isDark ? "bg-slate-800" : "bg-slate-200"} rounded-full overflow-hidden`}>
            <div
              className={`h-full ${colorClass} rounded-full transition-all duration-500`}
              style={{ width: `${Math.max(2, (item.value / maxVal) * 100)}%` }}
            />
          </div>
          {item.sub && <p className="text-[10px] text-slate-600 mt-0.5">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── LineChart (price evolution) ──────────────────────────────────────────────
interface LineChartProps {
  data: { label: string; value: number }[];
  formatValue: (v: number) => string;
  colorClass?: string;
}

export function LineChart({ data, formatValue, colorClass = "teal" }: LineChartProps) {
  const { isDark } = useContext(ThemeCtx);
  if (!data || data.length < 2) return null;
  const values = data.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const W = 300;
  const H = 80;
  const pad = 8;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  const points = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * innerW,
    y: pad + (1 - (d.value - minV) / range) * innerH,
    ...d,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const color = colorClass === "teal" ? "#14b8a6" : "#60a5fa";
  const colorFill = colorClass === "teal" ? "#14b8a6" : "#60a5fa";

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <defs>
          <linearGradient id={`fill-${colorClass}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorFill} stopOpacity="0.25" />
            <stop offset="100%" stopColor={colorFill} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <polygon
          points={`${points[0].x},${H} ${polyline} ${points[points.length - 1].x},${H}`}
          fill={`url(#fill-${colorClass})`}
        />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-slate-600">{data[0].label}</span>
        <span className="text-[9px] text-slate-600">{data[data.length - 1].label}</span>
      </div>
      <div className="flex justify-between mt-0.5">
        <span className={`text-[10px] font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>{formatValue(data[0].value)}</span>
        <span className={`text-[10px] font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>{formatValue(data[data.length - 1].value)}</span>
      </div>
    </div>
  );
}

// ─── ScaleToggle ──────────────────────────────────────────────────────────────
interface ScaleToggleProps {
  baseUnit: string;
  displayUnit: string;
  onChange: (unit: string) => void;
}

export function ScaleToggle({ baseUnit, displayUnit, onChange }: ScaleToggleProps) {
  const { isDark } = useContext(ThemeCtx);
  const options = getScaleOptions(baseUnit);
  if (options.length <= 1) return null;
  return (
    <div className={`flex gap-2 ${isDark ? "bg-slate-900" : "bg-slate-100"} rounded-xl p-1`}>
      {options.map((opt) => (
        <button
          key={opt.unit}
          onClick={() => onChange(opt.unit)}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${displayUnit === opt.unit ? "bg-teal-500 text-white shadow" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
        >
          {opt.unit}
        </button>
      ))}
    </div>
  );
}
