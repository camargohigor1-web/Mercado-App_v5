import { useState, useRef } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Btn, Inp, Sel, Modal, Card, Badge, Empty, ConfirmModal } from "./ui";
import { uid, fmtN, getScaleOptions, BULK_UNITS, PKG_UNITS, DEFAULT_CATEGORIES } from "../utils";
import type { Item } from "../types";

interface ItemsSectionProps {
  items: Item[];
  setItems: (items: Item[]) => void;
  categories: string[];
  setCategories: (cats: string[]) => void;
  initialSearch?: string;
}

export function ItemsSection({ items, setItems, categories, setCategories, initialSearch }: ItemsSectionProps) {
  const { isDark } = useTheme();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch?.trim() ?? "");
  const [catModal, setCatModal] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("");
  const [form, setForm] = useState({
    name: "", type: "bulk", unit: "kg", displayUnit: "kg",
    pkgSize: "", pkgUnit: "un", category: categories[0] || "Mercearia",
    alertDays: "15",
  });
  const nameRef = useRef<HTMLInputElement>(null);
  const pkgSizeRef = useRef<HTMLInputElement>(null);

  function openNew() {
    setEditing(null);
    setForm({ name: "", type: "bulk", unit: "kg", displayUnit: "kg", pkgSize: "", pkgUnit: "un", category: categories[0] || "Mercearia", alertDays: "15" });
    setModal(true);
  }

  function openEdit(it: Item) {
    setEditing(it.id);
    setForm({
      name: it.name, type: it.type, unit: it.unit || "kg",
      displayUnit: it.displayUnit || it.unit || "kg",
      pkgSize: it.pkgSize ? String(it.pkgSize) : "",
      pkgUnit: it.pkgUnit || "un",
      category: it.category || categories[0] || "Mercearia",
      alertDays: it.alertDays ? String(it.alertDays) : "15",
    });
    setModal(true);
  }

  function saveItem() {
    if (!form.name.trim()) return;
    if (form.type === "packaged" && !form.pkgSize) return;
    const scaleOptions = getScaleOptions(form.unit);
    const validDisplayUnit = scaleOptions.some(o => o.unit === form.displayUnit) ? form.displayUnit : form.unit;
    const data: Partial<Item> = {
      name: form.name.trim(), type: form.type as Item["type"], category: form.category,
      unit: form.type === "bulk" ? form.unit : undefined,
      displayUnit: form.type === "bulk" ? validDisplayUnit : undefined,
      pkgSize: form.type === "packaged" ? parseFloat(form.pkgSize) : undefined,
      pkgUnit: form.type === "packaged" ? form.pkgUnit : undefined,
      alertDays: parseInt(form.alertDays) >= 0 ? parseInt(form.alertDays) : 15,
    };
    if (editing) {
      setItems(items.map(i => i.id === editing ? { ...i, ...data } : i));
    } else {
      setItems([...items, { id: uid(), ...data } as Item]);
    }
    setModal(false);
  }

  function confirmDelete(id: string) { setDeleteTarget(id); }
  function doDelete() {
    if (deleteTarget) {
      setItems(items.filter(i => i.id !== deleteTarget));
      setDeleteTarget(null);
    }
  }

  function addCategory() {
    const name = newCat.trim();
    if (!name || categories.includes(name)) return;
    setCategories([...categories, name]);
    setNewCat("");
  }

  function saveEditCat() {
    const name = editCatName.trim();
    if (!name || !editCat) return;
    setCategories(categories.map(c => c === editCat ? name : c));
    setItems(items.map(it => it.category === editCat ? { ...it, category: name } : it));
    setEditCat(null); setEditCatName("");
  }

  function deleteCategory(cat: string) {
    setCategories(categories.filter(c => c !== cat));
    setItems(items.map(it => it.category === cat ? { ...it, category: "Outro" } : it));
  }

  const filtered = items
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    .filter(i => !filterCat || i.category === filterCat);
  const grouped: Record<string, Item[]> = {};
  categories.forEach(cat => {
    const g = filtered.filter(i => i.category === cat);
    if (g.length) grouped[cat] = g;
  });
  const uncat = filtered.filter(i => !i.category || !categories.includes(i.category));
  if (uncat.length) grouped["Sem categoria"] = uncat;

  const scaleOptions = getScaleOptions(form.unit);
  const hasScales = scaleOptions.length > 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Inp value={search} onChange={setSearch} placeholder="Buscar produto..." className="flex-1" />
        <Btn onClick={() => setCatModal(true)} variant="outline" size="sm"><Icon name="settings" size={13} /></Btn>
        <Btn onClick={openNew}><Icon name="plus" size={15} />Novo</Btn>
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCat("")}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${!filterCat ? "bg-teal-500 text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-200 text-slate-500 hover:text-slate-700"}`}
          >
            Todas
          </button>
          {categories.filter(cat => items.some(i => i.category === cat)).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(filterCat === cat ? "" : cat)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${filterCat === cat ? "bg-teal-500 text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-200 text-slate-500 hover:text-slate-700"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        search ? (
          <Empty icon="package" title="Nenhum resultado" />
        ) : (
          <div className="flex flex-col items-center text-center py-12 gap-4 px-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
              <Icon name="package" size={24} />
            </div>
            <div className="space-y-1">
              <p className={`font-black text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Nenhum produto cadastrado</p>
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Cadastre os produtos que você compra regularmente para ter histórico de preços e controle de estoque.
              </p>
            </div>
            <button
              onClick={() => { setEditing(null); setModal(true); }}
              className="px-5 py-2.5 rounded-xl bg-teal-500 text-white text-xs font-black shadow-lg shadow-teal-500/25 active:scale-95 transition-transform flex items-center gap-2"
            >
              <Icon name="plus" size={14} />
              Cadastrar primeiro produto
            </button>
          </div>
        )
      ) : (
        Object.entries(grouped).map(([cat, group]) => (
          <div key={cat}>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 px-1">{cat}</p>
            <div className="space-y-2">
              {group.map(it => (
                <Card key={it.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${it.type === "bulk" ? "bg-teal-500/20 text-teal-400" : "bg-amber-500/20 text-amber-400"}`}>
                      <Icon name={it.type === "bulk" ? "scale" : "box"} size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className={`${isDark ? "text-slate-100" : "text-slate-900"} font-semibold text-sm truncate`}>{it.name}</p>
                      <div className="flex gap-1.5 mt-0.5 flex-wrap">
                        <Badge color={it.type === "bulk" ? "teal" : "amber"}>{it.type === "bulk" ? "Granel" : "Emb. fixa"}</Badge>
                        {it.type === "bulk" ? (
                          <>
                            <Badge>base: {it.unit}</Badge>
                            {it.displayUnit && it.displayUnit !== it.unit && <Badge color="blue">exibe: {it.displayUnit}</Badge>}
                          </>
                        ) : (
                          <Badge>{fmtN(it.pkgSize || 0, 0)} {it.pkgUnit}/emb</Badge>
                        )}
                        {it.alertDays === 0 ? (
                          <Badge color="slate">sem alerta</Badge>
                        ) : (it.alertDays || 15) !== 15 ? (
                          <Badge color="amber">alerta: {it.alertDays}d</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={() => openEdit(it)} className={`p-2 ${isDark ? "text-slate-600 hover:text-blue-400" : "text-slate-400 hover:text-blue-500"} transition-colors`}><Icon name="edit" size={14} /></button>
                    <button onClick={() => confirmDelete(it.id)} className={`p-2 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"} transition-colors`}><Icon name="trash" size={14} /></button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Product Modal */}
      {modal && (
        <Modal title={editing ? "Editar Produto" : "Novo Produto"} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <Inp inputRef={nameRef} label="Nome do produto" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Ex: Feijão Carioca, Banana Nanica..." required
              onEnter={() => { if (form.type === "packaged" && pkgSizeRef.current) pkgSizeRef.current.focus(); else if (form.name.trim()) saveItem(); }} />
            <Sel label="Categoria" value={form.category} onChange={v => setForm({ ...form, category: v })}
              options={categories.map(c => ({ value: c, label: c }))} placeholder="Selecionar..." />
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tipo de produto <span className="text-red-400">*</span></p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: "bulk", icon: "scale", label: "Granel / Variável", sub: "Frutas, carnes, feijão, arroz..." },
                  { val: "packaged", icon: "box", label: "Embalagem fixa", sub: "Bolacha, papel higiênico..." },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setForm({ ...form, type: opt.val })}
                    className={`flex flex-col gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${form.type === opt.val ? "border-teal-500 bg-teal-500/10" : isDark ? "border-slate-700 bg-slate-900 hover:border-slate-600" : "border-slate-300 bg-white hover:border-slate-400"}`}>
                    <div className={form.type === opt.val ? "text-teal-400" : "text-slate-600"}><Icon name={opt.icon} size={18} /></div>
                    <p className={`text-xs font-bold ${form.type === opt.val ? "text-teal-300" : isDark ? "text-slate-400" : "text-slate-600"}`}>{opt.label}</p>
                    <p className="text-[10px] text-slate-600 leading-tight">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>
            {form.type === "bulk" && (
              <>
                <Sel label="Unidade de medida" value={form.unit} onChange={v => setForm({ ...form, unit: v, displayUnit: v })} options={BULK_UNITS.map(u => ({ value: u, label: u }))} required />
                {hasScales && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Escala de visualização</p>
                    <div className={`flex gap-2 ${isDark ? "bg-slate-900" : "bg-slate-100"} rounded-xl p-1`}>
                      {scaleOptions.map(opt => (
                        <button key={opt.unit} onClick={() => setForm({ ...form, displayUnit: opt.unit })}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${form.displayUnit === opt.unit ? "bg-teal-500 text-white shadow" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                          {opt.unit}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {form.type === "packaged" && (
              <div className="grid grid-cols-2 gap-3">
                <Inp inputRef={pkgSizeRef} label="Qtd. na embalagem" type="number" value={form.pkgSize} onChange={v => setForm({ ...form, pkgSize: v })} placeholder="Ex: 80" min="0.001" step="0.001" required onEnter={saveItem} />
                <Sel label="Unidade interna" value={form.pkgUnit} onChange={v => setForm({ ...form, pkgUnit: v })} options={PKG_UNITS.map(u => ({ value: u, label: u }))} required />
              </div>
            )}
            <Inp label="Alerta de estoque (dias)" type="number" value={form.alertDays} onChange={v => setForm({ ...form, alertDays: v })} placeholder="15" min="0" step="1" />
            <p className={`text-[10px] mt-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}>0 = sem alerta para este produto</p>
            <p className="text-[10px] text-slate-600">Padrão: 15 dias. Alerta quando estoque calculado for menor que este valor.</p>
            <div className="flex gap-3 pt-1">
              <Btn onClick={() => setModal(false)} variant="secondary" className="flex-1">Cancelar</Btn>
              <Btn onClick={saveItem} disabled={!form.name.trim() || (form.type === "packaged" && !form.pkgSize)} className="flex-1">Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Categories Modal */}
      {catModal && (
        <Modal title="Gerenciar Categorias" onClose={() => setCatModal(false)}>
          <div className="space-y-4">
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat} className={`flex items-center gap-2 px-3 py-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl`}>
                  {editCat === cat ? (
                    <>
                      <input value={editCatName} onChange={e => setEditCatName(e.target.value)}
                        className={`flex-1 text-sm bg-transparent outline-none ${isDark ? "text-slate-100" : "text-slate-900"}`}
                        onKeyDown={e => { if (e.key === "Enter") saveEditCat(); if (e.key === "Escape") { setEditCat(null); setEditCatName(""); } }}
                        autoFocus />
                      <button onClick={saveEditCat} className="text-teal-400 hover:text-teal-300 transition-colors p-1"><Icon name="check" size={14} /></button>
                      <button onClick={() => { setEditCat(null); setEditCatName(""); }} className="text-slate-500 hover:text-slate-300 transition-colors p-1"><Icon name="x" size={14} /></button>
                    </>
                  ) : (
                    <>
                      <p className={`flex-1 text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>{cat}</p>
                      <button onClick={() => { setEditCat(cat); setEditCatName(cat); }} className={`p-1 ${isDark ? "text-slate-600 hover:text-blue-400" : "text-slate-400 hover:text-blue-500"} transition-colors`}><Icon name="edit" size={13} /></button>
                      {!DEFAULT_CATEGORIES.includes(cat) && (
                        <button onClick={() => deleteCategory(cat)} className={`p-1 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"} transition-colors`}><Icon name="trash" size={13} /></button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Inp value={newCat} onChange={setNewCat} placeholder="Nova categoria..." className="flex-1" onEnter={addCategory} />
              <Btn onClick={addCategory} disabled={!newCat.trim()}><Icon name="plus" size={15} /></Btn>
            </div>
            <Btn onClick={() => setCatModal(false)} variant="secondary" className="w-full justify-center">Fechar</Btn>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Remover Produto"
          message="Remover este produto? O histórico de compras será mantido."
          confirmLabel="Remover"
          onConfirm={doDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
