import { Icon } from "./Icon";

interface RightDrawerProps {
  open: boolean;
  onClose: () => void;
  tab: string;
  setTab: (t: string) => void;
  theme: string;
  setTheme: (t: string) => void;
}

const drawerTabs = [
  { id: "purchases", label: "Compras",   icon: "cart",    desc: "Registre e acompanhe suas compras" },
  { id: "items",     label: "Produtos",  icon: "package", desc: "Cadastre os produtos que você compra" },
  { id: "markets",   label: "Mercados",  icon: "store",   desc: "Gerencie os supermercados" },
  { id: "reports",   label: "Relatório", icon: "chart",   desc: "Gráficos e estatísticas das suas compras" },
  { id: "backup",    label: "Backup",    icon: "shield",  desc: "Exporte e importe seus dados" },
];

export function RightDrawer({ open, onClose, tab, setTab, theme, setTheme }: RightDrawerProps) {
  const isDark = theme === "dark";
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] z-40 ${isDark ? "bg-slate-950 border-l border-slate-800" : "bg-white border-l border-slate-200"} shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className={`flex items-center justify-between px-5 pt-8 pb-4 ${isDark ? "border-b border-slate-800" : "border-b border-slate-200"}`}>
          <div>
            <p className="text-[10px] font-black text-teal-500 uppercase tracking-widest">MercadoApp</p>
            <p className={`text-sm font-black ${isDark ? "text-slate-100" : "text-slate-900"} mt-0.5`}>Mais opções</p>
          </div>
          <button onClick={onClose} className={`${isDark ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"} p-1.5 rounded-xl transition-colors`}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="px-3 py-4 space-y-1">
          {drawerTabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); onClose(); }}
              className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-all ${tab === t.id ? (isDark ? "bg-teal-500/15 border border-teal-500/30" : "bg-teal-50 border border-teal-300") : (isDark ? "hover:bg-slate-800/60" : "hover:bg-slate-50")}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tab === t.id ? (isDark ? "bg-teal-500/20 text-teal-400" : "bg-teal-100 text-teal-700") : (isDark ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-500")}`}>
                <Icon name={t.icon} size={16} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${tab === t.id ? (isDark ? "text-teal-400" : "text-teal-700") : (isDark ? "text-slate-300" : "text-slate-700")}`}>{t.label}</p>
                <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">{t.desc}</p>
              </div>
              {tab === t.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />}
            </button>
          ))}
          <div className={`mt-4 pt-4 ${isDark ? "border-t border-slate-800" : "border-t border-slate-200"}`}>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-3 mb-2">Tema</p>
            <div className="flex gap-2 px-3">
              {[
                { val: "dark", icon: "moon", label: "Escuro" },
                { val: "light", icon: "sun", label: "Claro" },
              ].map(opt => (
                <button key={opt.val} onClick={() => setTheme(opt.val)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${theme === opt.val ? "bg-teal-500 text-white" : (isDark ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-200 text-slate-700 hover:bg-slate-300")}`}>
                  <Icon name={opt.icon} size={13} />{opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
