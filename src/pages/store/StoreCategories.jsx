import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Loader2, Tags, Check } from 'lucide-react';
import { getCategories, saveCategory, deleteCategory, CATEGORY_ICONS, slugify } from '../../services/storeApi';

const empty = { id: null, name: '', slug: '', icon: '', parentId: '', sortOrder: 0, isUniversal: false };

const StoreCategories = () => {
    const [cats, setCats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    const load = async () => {
        try {
            setCats(await getCategories());
            setError(null);
        } catch (e) {
            setError(e.message || 'No se pudieron cargar las categorías');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const iconLabel = (k) => CATEGORY_ICONS.find(([v]) => v === k)?.[1] || '—';
    const nameOf = (id) => cats.find((c) => c.id === id)?.name;

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true);
        setFormError(null);
        try {
            await saveCategory(form);
            setForm(null);
            await load();
        } catch (err) {
            setFormError(err.code === '23505' ? 'Ya existe una categoría con esa dirección (slug).' : err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (c) => {
        const msg = c.count > 0
            ? `"${c.name}" tiene ${c.count} producto(s) publicados. Quedarán sin categoría. ¿Eliminar?`
            : `¿Eliminar la categoría "${c.name}"?`;
        if (!window.confirm(msg)) return;
        try {
            await deleteCategory(c.id);
            await load();
        } catch (err) {
            alert('No se pudo eliminar: ' + err.message);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Categorías de la tienda</h1>
                    <p className="text-secondary">Organizan el catálogo web y los filtros. Se asignan a cada producto en Inventario &gt; Tienda web.</p>
                </div>
                <button className="btn btn-primary self-start" onClick={() => { setFormError(null); setForm({ ...empty, sortOrder: cats.length + 1 }); }}>
                    <Plus size={16} /> Nueva categoría
                </button>
            </div>

            <div className="card p-0 overflow-hidden">
                {loading ? (
                    <div className="p-10 flex justify-center text-secondary"><Loader2 className="animate-spin" /></div>
                ) : error ? (
                    <p className="p-6 text-danger font-semibold">{error}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-line">
                                <tr>
                                    <th className="px-5 py-3 w-16">Orden</th>
                                    <th className="px-5 py-3">Nombre</th>
                                    <th className="px-5 py-3">Icono</th>
                                    <th className="px-5 py-3">Dentro de</th>
                                    <th className="px-5 py-3">Universal</th>
                                    <th className="px-5 py-3 text-right">Publicados</th>
                                    <th className="px-5 py-3 w-24"><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {cats.length === 0 && (
                                    <tr><td colSpan="7" className="px-5 py-10 text-center text-secondary">Sin categorías. Crea la primera.</td></tr>
                                )}
                                {cats.map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50/60">
                                        <td className="px-5 py-3 tabular-nums text-secondary">{c.sortOrder}</td>
                                        <td className="px-5 py-3">
                                            <span className="font-bold text-navy block">{c.name}</span>
                                            <span className="text-[12px] text-secondary font-mono">/catalogo/{c.slug}</span>
                                        </td>
                                        <td className="px-5 py-3 text-secondary">{iconLabel(c.icon)}</td>
                                        <td className="px-5 py-3 text-secondary">{nameOf(c.parentId) || '—'}</td>
                                        <td className="px-5 py-3">{c.isUniversal ? <Check size={16} className="text-success" aria-label="Sí" /> : <span className="text-secondary">—</span>}</td>
                                        <td className="px-5 py-3 text-right tabular-nums font-bold text-navy">{c.count}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex justify-end gap-1">
                                                <button className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-gray-100" aria-label={`Editar ${c.name}`}
                                                    onClick={() => { setFormError(null); setForm({ ...empty, ...c, parentId: c.parentId || '', icon: c.icon || '' }); }}>
                                                    <Edit2 size={15} />
                                                </button>
                                                <button className="p-2 rounded-lg text-secondary hover:text-danger hover:bg-red-50" aria-label={`Eliminar ${c.name}`} onClick={() => handleDelete(c)}>
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <p className="text-[13px] text-secondary">
                <strong className="text-navy">Universal</strong>: sus productos sirven para cualquier vehículo (aceites, refrigerantes, grasas).
                En la búsqueda por vehículo aparecen como “También para tu vehículo” aunque no tengan compatibilidad cargada.
            </p>

            {form && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <form onSubmit={handleSave} className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
                        <div className="p-5 border-b border-line flex items-center justify-between">
                            <h2 className="font-bold text-navy text-lg flex items-center gap-2"><Tags size={18} className="text-primary" />{form.id ? 'Editar categoría' : 'Nueva categoría'}</h2>
                            <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-full hover:bg-gray-100 text-secondary" aria-label="Cerrar"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            {formError && <p className="text-sm font-bold text-danger bg-red-50 rounded-xl px-3 py-2">{formError}</p>}
                            <label className="block">
                                <span className="eyebrow-label block mb-1.5">Nombre *</span>
                                <input className="field" required autoFocus value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })} />
                            </label>
                            <label className="block">
                                <span className="eyebrow-label block mb-1.5">Dirección web (slug)</span>
                                <input className="field font-mono" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                                {form.id && <span className="text-[12px] text-secondary">Cambiarla rompe los enlaces ya compartidos.</span>}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="eyebrow-label block mb-1.5">Icono</span>
                                    <select className="field" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                                        <option value="">Sin icono</option>
                                        {CATEGORY_ICONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="eyebrow-label block mb-1.5">Orden</span>
                                    <input className="field" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
                                </label>
                            </div>
                            <label className="block">
                                <span className="eyebrow-label block mb-1.5">Dentro de (opcional)</span>
                                <select className="field" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                                    <option value="">Categoría principal</option>
                                    {cats.filter((c) => c.id !== form.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-5 h-5" checked={form.isUniversal} onChange={(e) => setForm({ ...form, isUniversal: e.target.checked })} />
                                <span className="text-sm font-bold text-navy">Universal (sirve para cualquier vehículo)</span>
                            </label>
                        </div>
                        <div className="p-5 border-t border-line flex justify-end gap-2">
                            <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Cancelar</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default StoreCategories;
