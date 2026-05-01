import { useState, useRef } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Btn, Modal, Card, InfoBox, ConfirmModal } from "./ui";
import type { Item, Market, Purchase, ShoppingListEntry, WarehouseItem } from "../types";

interface BackupSectionProps {
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  shoppingList: ShoppingListEntry[];
  warehouse: WarehouseItem[];
  onRestore: (data: { items: Item[]; markets: Market[]; purchases: Purchase[]; shoppingList: ShoppingListEntry[]; warehouse: WarehouseItem[]; categories?: string[] }) => void;
}

export function BackupSection({ items, markets, purchases, shoppingList, warehouse, onRestore }: BackupSectionProps) {
  const { isDark } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  function exportBackup() {
    const data = { _version: 3, _exportedAt: new Date().toISOString(), items, markets, purchases, shoppingList, warehouse };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mercadoapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ type: "success", msg: `Backup exportado! (${items.length} produtos, ${purchases.length} compras)` });
    setTimeout(() => setStatus(null), 4000);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      try {
        const data = JSON.parse(ev.target!.result as string);
        if (!data.items || !data.markets || !data.purchases) throw new Error("Arquivo inválido.");
        setPendingData(data);
        setConfirmModal(true);
      } catch (err: any) {
        setStatus({ type: "error", msg: `Erro: ${err.message}` });
        setTimeout(() => setStatus(null), 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
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
    setStatus({ type: "success", msg: "Dados restaurados com sucesso!" });
    setTimeout(() => setStatus(null), 4000);
  }

  function deleteAllData() {
    onRestore({ items: [], markets: [], purchases: [], shoppingList: [], warehouse: [] });
    setDeleteConfirm(false);
    setStatus({ type: "success", msg: "Todos os dados foram deletados!" });
    setTimeout(() => setStatus(null), 4000);
  }

  const exportedAt = pendingData?._exportedAt ? new Date(pendingData._exportedAt).toLocaleString("pt-BR") : null;

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Dados atuais no app</p>
        <div className="grid grid-cols-3 gap-2">
          {[{ label: "Produtos", val: items.length }, { label: "Mercados", val: markets.length }, { label: "Compras", val: purchases.length }].map(({ label, val }) => (
            <div key={label} className={`${isDark ? "bg-slate-800/60" : "bg-slate-100"} rounded-xl p-3 text-center`}>
              <p className="text-teal-400 font-black text-xl">{val}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">{label}</p>
            </div>
          ))}
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
          </div>
        </div>
        <Btn onClick={exportBackup} className="w-full justify-center" size="lg"><Icon name="download" size={16} />Baixar Backup (.json)</Btn>
      </Card>

      <Card>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0"><Icon name="upload" size={18} /></div>
          <div>
            <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-bold text-sm`}>Importar Backup</p>
            <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Restaura os dados de um arquivo .json. <span className="text-amber-400 font-semibold">Os dados atuais serão substituídos.</span></p>
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

      <InfoBox color="blue">Dica: Faça backup regularmente e salve na nuvem para não perder dados.</InfoBox>

      {/* Restore confirm */}
      {confirmModal && pendingData && (
        <Modal title="Confirmar Restauração" onClose={() => { setConfirmModal(false); setPendingData(null); }}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <span className="text-amber-400 flex-shrink-0 mt-0.5"><Icon name="warn" size={18} /></span>
              <div>
                <p className="text-amber-300 font-bold text-sm">Atenção!</p>
                <p className="text-amber-400/80 text-xs mt-1 leading-relaxed">Esta ação irá substituir todos os dados atuais.</p>
              </div>
            </div>
            <Card>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Dados no backup</p>
              {exportedAt && <p className="text-xs text-slate-500 mb-3">Exportado em: <span className={isDark ? "text-slate-300" : "text-slate-700"}>{exportedAt}</span></p>}
              <div className="grid grid-cols-3 gap-2">
                {[{ label: "Produtos", val: pendingData.items?.length || 0 }, { label: "Mercados", val: pendingData.markets?.length || 0 }, { label: "Compras", val: pendingData.purchases?.length || 0 }].map(({ label, val }) => (
                  <div key={label} className={`${isDark ? "bg-slate-800/60" : "bg-slate-100"} rounded-xl p-2.5 text-center`}>
                    <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-black text-lg`}>{val}</p>
                    <p className="text-slate-500 text-[10px]">{label}</p>
                  </div>
                ))}
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
          message="Esta ação vai remover todos os seus dados permanentemente e não pode ser desfeita."
          confirmLabel="Deletar Tudo"
          onConfirm={deleteAllData}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
