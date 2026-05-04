import { useState, useRef } from "react";
import { useTheme } from "../hooks/useTheme";
import { useGoogleDrive } from "../hooks/useGoogleDrive";
import { Icon } from "./Icon";
import { Btn, Modal, Card, InfoBox, ConfirmModal } from "./ui";
import type { Item, Market, Purchase, ShoppingListEntry, WarehouseItem } from "../types";

const GOOGLE_CLIENT_ID = "456075698469-ph0ub480rcs72tggj55u9ibn8jdd185f.apps.googleusercontent.com";
const LAST_BACKUP_KEY = "mkt3_last_backup_exported_at";

type BackupData = Partial<{
  _version: number;
  _exportedAt: string;
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  shoppingList: ShoppingListEntry[];
  warehouse: WarehouseItem[];
  categories: string[];
}>;

interface BackupSectionProps {
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  shoppingList: ShoppingListEntry[];
  warehouse: WarehouseItem[];
  categories: string[];
  onRestore: (data: {
    items: Item[];
    markets: Market[];
    purchases: Purchase[];
    shoppingList: ShoppingListEntry[];
    warehouse: WarehouseItem[];
    categories?: string[];
  }) => void;
}

export function BackupSection({ items, markets, purchases, shoppingList, warehouse, categories, onRestore }: BackupSectionProps) {
  const { isDark } = useTheme();
  const drive = useGoogleDrive(GOOGLE_CLIENT_ID);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingData, setPendingData] = useState<BackupData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_BACKUP_KEY) || "";
    } catch {
      return "";
    }
  });

  function getBackupSummary(data: BackupData) {
    const activeList = (data.shoppingList || []).filter(l => !l.saved).length;
    const savedLists = (data.shoppingList || []).filter(l => l.saved).length;
    const warehouseEntries = (data.warehouse || []).reduce((sum, item) => sum + (item.entries || []).length, 0);

    return {
      items: data.items?.length || 0,
      markets: data.markets?.length || 0,
      purchases: data.purchases?.length || 0,
      activeList,
      savedLists,
      warehouseItems: data.warehouse?.length || 0,
      warehouseEntries,
      categories: data.categories?.length || 0,
    };
  }

  function formatDateTime(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("pt-BR");
  }

  function showStatus(type: "success" | "error", msg: string, timeout = 4000) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), timeout);
  }

  function exportBackup() {
    const exportedAt = new Date().toISOString();
    const data = getBackupData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mercadoapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    try {
      localStorage.setItem(LAST_BACKUP_KEY, exportedAt);
      setLastBackupAt(exportedAt);
    } catch {}

    showStatus("success", `Backup exportado! (${items.length} produtos, ${purchases.length} compras)`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      try {
        const data = JSON.parse(ev.target!.result as string) as BackupData;
        if (!data.items || !data.markets || !data.purchases) throw new Error("Arquivo invalido.");
        setPendingData(data);
        setConfirmModal(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Nao foi possivel ler o arquivo.";
        showStatus("error", `Erro: ${msg}`, 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function getBackupData() {
    return { _version: 3, _exportedAt: new Date().toISOString(), items, markets, purchases, shoppingList, warehouse, categories };
  }

  function confirmRestore() {
    if (!pendingData) return;
    onRestore({
      items: pendingData.items || [],
      markets: pendingData.markets || [],
      purchases: pendingData.purchases || [],
      shoppingList: pendingData.shoppingList || [],
      warehouse: pendingData.warehouse || [],
      categories: pendingData.categories,
    });
    setConfirmModal(false);
    setPendingData(null);
    showStatus("success", "Dados restaurados com sucesso!");
  }

  function deleteAllData() {
    onRestore({ items: [], markets: [], purchases: [], shoppingList: [], warehouse: [] });
    setDeleteConfirm(false);
    showStatus("success", "Todos os dados foram deletados!");
  }

  const currentSummary = getBackupSummary({ items, markets, purchases, shoppingList, warehouse, categories });
  const pendingSummary = pendingData ? getBackupSummary(pendingData) : null;
  const exportedAt = formatDateTime(pendingData?._exportedAt);
  const lastBackupAtLabel = formatDateTime(lastBackupAt);
  const importedIsOlder =
    Boolean(pendingData?._exportedAt && lastBackupAt) &&
    new Date(pendingData!._exportedAt!).getTime() < new Date(lastBackupAt).getTime();

  const summaryTiles = [
    { label: "Produtos", val: currentSummary.items },
    { label: "Mercados", val: currentSummary.markets },
    { label: "Compras", val: currentSummary.purchases },
    { label: "Na lista", val: currentSummary.activeList },
    { label: "Listas salvas", val: currentSummary.savedLists },
    { label: "Armazem", val: currentSummary.warehouseItems },
  ];

  const pendingTiles = [
    { label: "Produtos", val: pendingSummary?.items || 0 },
    { label: "Mercados", val: pendingSummary?.markets || 0 },
    { label: "Compras", val: pendingSummary?.purchases || 0 },
    { label: "Na lista", val: pendingSummary?.activeList || 0 },
    { label: "Listas salvas", val: pendingSummary?.savedLists || 0 },
    { label: "Armazem", val: pendingSummary?.warehouseItems || 0 },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Dados atuais no app</p>
        <div className="grid grid-cols-3 gap-2">
          {summaryTiles.map(({ label, val }) => (
            <div key={label} className={`${isDark ? "bg-slate-800/60" : "bg-slate-100"} rounded-xl p-3 text-center`}>
              <p className="text-teal-400 font-black text-xl">{val}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className={`mt-3 ${isDark ? "bg-slate-800/50" : "bg-slate-100"} rounded-xl px-3 py-2`}>
          <p className="text-[10px] text-slate-500">
            Registros de armazem: <span className={isDark ? "text-slate-300 font-semibold" : "text-slate-700 font-semibold"}>{currentSummary.warehouseEntries}</span>
            <span className="mx-2 text-slate-700">-</span>
            Categorias: <span className={isDark ? "text-slate-300 font-semibold" : "text-slate-700 font-semibold"}>{currentSummary.categories}</span>
          </p>
        </div>
      </Card>

      {status && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-xs font-medium ${status.type === "success" ? "bg-teal-500/10 border-teal-500/30 text-teal-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
          <span className="mt-0.5 flex-shrink-0"><Icon name={status.type === "success" ? "check" : "warn"} size={14} /></span>
          <span>{status.msg}</span>
        </div>
      )}

      <Card>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center flex-shrink-0"><Icon name="download" size={18} /></div>
          <div>
            <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-bold text-sm`}>Exportar Backup</p>
            <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Salva todos os dados em um arquivo .json.</p>
            {lastBackupAtLabel && <p className="text-[10px] text-slate-600 mt-1">Ultimo backup neste aparelho: <span className="text-teal-400 font-semibold">{lastBackupAtLabel}</span></p>}
          </div>
        </div>
        <Btn onClick={exportBackup} className="w-full justify-center" size="lg"><Icon name="download" size={16} />Baixar Backup (.json)</Btn>
      </Card>

      <Card>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0"><Icon name="upload" size={18} /></div>
          <div>
            <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-bold text-sm`}>Importar Backup</p>
            <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Restaura os dados de um arquivo .json. <span className="text-amber-400 font-semibold">Os dados atuais serao substituidos.</span></p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
        <Btn onClick={() => fileRef.current?.click()} variant="outline" className="w-full justify-center" size="lg"><Icon name="upload" size={16} />Selecionar Arquivo (.json)</Btn>
      </Card>

      <Card>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0"><Icon name="trash" size={18} /></div>
          <div>
            <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-bold text-sm`}>Limpar Todos os Dados</p>
            <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Remove todos os registros permanentemente.</p>
          </div>
        </div>
        <Btn onClick={() => setDeleteConfirm(true)} variant="danger" className="w-full justify-center" size="lg"><Icon name="trash" size={16} />Deletar Tudo</Btn>
      </Card>

      {/* ── Google Drive sync ──────────────────────────────────────────── */}
      <Card>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6.28 3L1 12.27 3.78 17H20.22L23 12.27 17.72 3H6.28zm0 1.5h3.44L5.3 12H2.62L6.28 4.5zm5 0h1.44L16.72 12H7.28L10.28 4.5zM13.28 4.5h3.44L20.38 12h-2.66L13.28 4.5zM4.28 13.5h15.44L17.5 17.5h-11L4.28 13.5z"/></svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-bold text-sm`}>Google Drive</p>
              {drive.isLoggedIn && (
                <button onClick={drive.signOut} className="text-[10px] text-slate-500 hover:text-red-400 transition-colors font-bold">
                  Sair
                </button>
              )}
            </div>
            <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
              {drive.isLoggedIn
                ? "Conectado. Salve ou sincronize via Google Drive."
                : "Faça login para sincronizar com Google Drive."}
            </p>
          </div>
        </div>

        {/* Drive status feedback */}
        {drive.status.type !== "idle" && (
          <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-xs font-medium mb-3 ${
            drive.status.type === "success" ? "bg-teal-500/10 border-teal-500/30 text-teal-400" :
            drive.status.type === "error"   ? "bg-red-500/10 border-red-500/30 text-red-400" :
            drive.status.type === "confirm" ? "bg-blue-500/10 border-blue-500/30 text-blue-300" :
            "bg-slate-800 border-slate-700 text-slate-400"
          }`}>
            {drive.status.type === "loading" && (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
            )}
            {drive.status.type === "success" && <Icon name="check" size={14} />}
            {drive.status.type === "error"   && <Icon name="warn" size={14} />}
            {drive.status.type === "confirm" && <Icon name="warn" size={14} />}
            <div className="flex-1">
              <p>{drive.status.msg}</p>
              {drive.status.type === "confirm" && (
                <div className="mt-1 space-y-1">
                  <p className="text-blue-400 font-bold">{drive.status.fileName}</p>
                  <p className="text-slate-500">{drive.status.date}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirm sync buttons */}
        {drive.status.type === "confirm" && (
          <div className="flex gap-2 mb-3">
            <Btn onClick={() => drive.setStatus({ type: "idle" })} variant="secondary" className="flex-1">Cancelar</Btn>
            <Btn onClick={drive.status.onConfirm} className="flex-1"><Icon name="upload" size={14} />Importar</Btn>
          </div>
        )}

        {/* Action buttons */}
        {drive.status.type !== "confirm" && (
          <div className="flex gap-2">
            <Btn
              onClick={() => drive.backupToDrive(getBackupData())}
              disabled={drive.status.type === "loading"}
              variant="outline"
              className="flex-1 justify-center"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
              </svg>
              Backup na nuvem
            </Btn>
            <Btn
              onClick={() => drive.syncFromDrive(data => {
                const d = data as BackupData;
                if (!d.items || !d.markets || !d.purchases) { drive.setStatus({ type: "error", msg: "Arquivo inválido." }); return; }
                onRestore({ items: d.items, markets: d.markets, purchases: d.purchases, shoppingList: d.shoppingList || [], warehouse: d.warehouse || [], categories: d.categories });
              })}
              disabled={drive.status.type === "loading"}
              variant="outline"
              className="flex-1 justify-center"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="8 16 12 20 16 16"/><line x1="12" y1="12" x2="12" y2="20"/>
                <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
              </svg>
              Sincronizar
            </Btn>
          </div>
        )}
      </Card>

      <InfoBox color="blue">Dica: faca backup regularmente e salve na nuvem para nao perder dados.</InfoBox>

      {confirmModal && pendingData && (
        <Modal title="Confirmar Restauracao" onClose={() => { setConfirmModal(false); setPendingData(null); }}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <span className="text-amber-400 flex-shrink-0 mt-0.5"><Icon name="warn" size={18} /></span>
              <div>
                <p className="text-amber-300 font-bold text-sm">Atencao!</p>
                <p className="text-amber-400/80 text-xs mt-1 leading-relaxed">Esta acao ira substituir todos os dados atuais.</p>
              </div>
            </div>

            {importedIsOlder && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <span className="text-red-400 flex-shrink-0 mt-0.5"><Icon name="warn" size={18} /></span>
                <div>
                  <p className="text-red-300 font-bold text-sm">Backup possivelmente mais antigo</p>
                  <p className="text-red-400/80 text-xs mt-1 leading-relaxed">Este arquivo foi exportado antes do ultimo backup registrado neste aparelho.</p>
                </div>
              </div>
            )}

            <Card>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Dados no backup</p>
              {exportedAt && <p className="text-xs text-slate-500 mb-3">Exportado em: <span className={isDark ? "text-slate-300" : "text-slate-700"}>{exportedAt}</span></p>}
              <div className="grid grid-cols-3 gap-2">
                {pendingTiles.map(({ label, val }) => (
                  <div key={label} className={`${isDark ? "bg-slate-800/60" : "bg-slate-100"} rounded-xl p-2.5 text-center`}>
                    <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-black text-lg`}>{val}</p>
                    <p className="text-slate-500 text-[10px]">{label}</p>
                  </div>
                ))}
              </div>
              <div className={`mt-3 ${isDark ? "bg-slate-800/50" : "bg-slate-100"} rounded-xl px-3 py-2`}>
                <p className="text-[10px] text-slate-500">
                  Registros de armazem: <span className={isDark ? "text-slate-300 font-semibold" : "text-slate-700 font-semibold"}>{pendingSummary?.warehouseEntries || 0}</span>
                  <span className="mx-2 text-slate-700">-</span>
                  Categorias: <span className={isDark ? "text-slate-300 font-semibold" : "text-slate-700 font-semibold"}>{pendingSummary?.categories || 0}</span>
                </p>
              </div>
            </Card>

            <div className="flex gap-3">
              <Btn onClick={() => { setConfirmModal(false); setPendingData(null); }} variant="secondary" className="flex-1">Cancelar</Btn>
              <Btn onClick={confirmRestore} variant="danger" className="flex-1"><Icon name="upload" size={15} />Restaurar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Deletar Todos os Dados?"
          message="Esta acao vai remover todos os seus dados permanentemente e nao pode ser desfeita."
          confirmLabel="Deletar Tudo"
          onConfirm={deleteAllData}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
