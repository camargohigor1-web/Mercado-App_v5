import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Btn, Inp, Modal, Card, Empty, ConfirmModal } from "./ui";
import { uid } from "../utils";
import type { Market } from "../types";

interface MarketsSectionProps {
  markets: Market[];
  setMarkets: (m: Market[]) => void;
}

export function MarketsSection({ markets, setMarkets }: MarketsSectionProps) {
  const { isDark } = useTheme();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setName("");
    setDescription("");
    setModal(true);
  }

  function openEdit(m: Market) {
    setEditing(m.id);
    setName(m.name);
    setDescription(m.description || "");
    setModal(true);
  }

  function saveMarket() {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: description.trim() || undefined };
    if (editing) {
      setMarkets(markets.map(m => m.id === editing ? { ...m, ...data } : m));
    } else {
      setMarkets([...markets, { id: uid(), ...data }]);
    }
    setModal(false);
  }

  function doDelete() {
    if (deleteTarget) {
      setMarkets(markets.filter(m => m.id !== deleteTarget));
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Btn onClick={openNew}><Icon name="plus" size={15} />Novo Mercado</Btn>
      </div>

      {markets.length === 0 ? (
        <Empty icon="store" title="Nenhum mercado cadastrado" sub="Cadastre os supermercados onde você faz compras." />
      ) : (
        <div className="space-y-2">
          {markets.map(m => (
            <Card key={m.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                  <Icon name="store" size={14} />
                </div>
                <div className="min-w-0">
                  <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-semibold text-sm`}>{m.name}</p>
                  {m.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{m.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-0.5 flex-shrink-0">
                <button onClick={() => openEdit(m)} className={`p-2 ${isDark ? "text-slate-600 hover:text-blue-400" : "text-slate-400 hover:text-blue-500"} transition-colors`}>
                  <Icon name="edit" size={14} />
                </button>
                <button onClick={() => setDeleteTarget(m.id)} className={`p-2 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"} transition-colors`}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editing ? "Editar Mercado" : "Novo Mercado"} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Inp label="Nome do mercado" value={name} onChange={setName} placeholder="Ex: Carrefour, Extra, Atacadão..." required onEnter={saveMarket} />
            <Inp label="Descrição (opcional)" value={description} onChange={setDescription} placeholder="Ex: Melhor para hortifruti, Atacado próximo..." onEnter={saveMarket} />
            <div className="flex gap-3">
              <Btn onClick={() => setModal(false)} variant="secondary" className="flex-1">Cancelar</Btn>
              <Btn onClick={saveMarket} disabled={!name.trim()} className="flex-1">Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal title="Remover Mercado" message="Remover este mercado? As compras associadas serão mantidas." confirmLabel="Remover" onConfirm={doDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
