import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, Car, FileSpreadsheet, Check, X, Search } from 'lucide-react';
import {
    getMakes, getModels, saveMake, saveModel, deleteMake, deleteModel, ensureVehicle,
    readSheetRows, pick, getProductCodes, addFitments, countFitmentsByModel, slugify,
} from '../../services/storeApi';

// Marcas y modelos para el buscador por vehículo de la tienda, con importación desde Excel:
// - Marcas y modelos: columnas Marca, Modelo.
// - Compatibilidades: columnas Código (del producto), Marca, Modelo, Año desde, Año hasta, Motor.

const InlineEdit = ({ initial, onSave, onCancel, placeholder }) => {
    const [v, setV] = useState(initial);
    return (
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSave(v.trim()); }}>
            <input className="field h-9" autoFocus value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && onCancel()} aria-label={placeholder} />
            <button type="submit" className="btn btn-primary h-9 px-3" aria-label="Guardar"><Check size={15} /></button>
            <button type="button" className="btn btn-ghost h-9 px-3" onClick={onCancel} aria-label="Cancelar"><X size={15} /></button>
        </form>
    );
};

const Vehicles = () => {
    const [makes, setMakes] = useState([]);
    const [models, setModels] = useState([]);
    const [fitCounts, setFitCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [editing, setEditing] = useState(null); // { type: 'make'|'model', id|null }
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(null); // 'models' | 'fitments'
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const modelsXls = useRef(null);
    const fitXls = useRef(null);

    const load = async () => {
        try {
            const [mk, md, fc] = await Promise.all([getMakes(), getModels(), countFitmentsByModel()]);
            setMakes(mk);
            setModels(md);
            setFitCounts(fc);
            setSelected((s) => s && mk.some((m) => m.id === s) ? s : mk[0]?.id || null);
            setError(null);
        } catch (e) {
            setError(e.message || 'No se pudieron cargar los vehículos');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);

    const modelCount = useMemo(() => {
        const c = {};
        for (const m of models) c[m.makeId] = (c[m.makeId] || 0) + 1;
        return c;
    }, [models]);

    const visibleMakes = makes.filter((m) => !q || slugify(m.name).includes(slugify(q)));
    const makeModels = models.filter((m) => m.makeId === selected);
    const selectedMake = makes.find((m) => m.id === selected);

    const run = async (fn) => {
        setError(null);
        try { await fn(); await load(); } catch (e) {
            setError(e.code === '23505' ? 'Ese nombre ya existe.' : (e.message || 'Error'));
        }
    };

    const removeMake = (m) => {
        const n = modelCount[m.id] || 0;
        if (!window.confirm(n ? `"${m.name}" tiene ${n} modelo(s). Se borran también ellos y su compatibilidad. ¿Eliminar?` : `¿Eliminar "${m.name}"?`)) return;
        run(() => deleteMake(m.id));
    };
    const removeModel = (m) => {
        const n = fitCounts[m.id] || 0;
        if (!window.confirm(n ? `"${m.name}" está en ${n} compatibilidad(es) de productos. Se borran también. ¿Eliminar?` : `¿Eliminar "${m.name}"?`)) return;
        run(() => deleteModel(m.id));
    };

    const importModels = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy('models');
        setReport(null);
        try {
            const rows = await readSheetRows(file);
            const cache = { makes: [...makes], models: [...models] };
            const before = cache.models.length;
            const skipped = [];
            for (const [i, r] of rows.entries()) {
                const mk = String(pick(r, 'marca', 'make'));
                const md = String(pick(r, 'modelo', 'model'));
                if (!mk || !md) { skipped.push(i + 2); continue; }
                await ensureVehicle(cache, mk, md);
            }
            setReport(`Modelos nuevos: ${cache.models.length - before}.${skipped.length ? ` Filas sin marca o modelo: ${skipped.join(', ')}.` : ''}`);
            await load();
        } catch (err) {
            setReport('No se pudo importar: ' + err.message);
        } finally {
            setBusy(null);
        }
    };

    const importFitments = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy('fitments');
        setReport(null);
        try {
            const [rows, products] = await Promise.all([readSheetRows(file), getProductCodes()]);
            const byCode = new Map(products.map((p) => [String(p.code || '').trim().toUpperCase(), p.id]));
            const cache = { makes: [...makes], models: [...models] };
            const out = [];
            const errors = [];
            for (const [i, r] of rows.entries()) {
                const line = i + 2;
                const code = String(pick(r, 'codigo', 'code', 'sku')).trim().toUpperCase();
                const productId = byCode.get(code);
                if (!productId) { errors.push(`fila ${line}: código "${code || '(vacío)'}" no existe`); continue; }
                const mk = String(pick(r, 'marca', 'make'));
                const md = String(pick(r, 'modelo', 'model'));
                if (!mk || !md) { errors.push(`fila ${line}: falta marca o modelo`); continue; }
                const yearFrom = parseInt(pick(r, 'anodesde', 'desde', 'yearfrom', 'ano')) || null;
                const yearTo = parseInt(pick(r, 'anohasta', 'hasta', 'yearto', 'ano')) || null;
                if (yearFrom && yearTo && yearFrom > yearTo) { errors.push(`fila ${line}: año desde mayor que año hasta`); continue; }
                out.push({
                    productId, modelId: await ensureVehicle(cache, mk, md), yearFrom, yearTo,
                    engine: String(pick(r, 'motor', 'engine')).trim() || null,
                });
            }
            await addFitments(out);
            setReport(`Compatibilidades agregadas: ${out.length}.${errors.length ? ` No importadas (${errors.length}): ${errors.slice(0, 8).join('; ')}${errors.length > 8 ? '…' : ''}` : ''}`);
            await load();
        } catch (err) {
            setReport('No se pudo importar: ' + err.message);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Vehículos</h1>
                    <p className="text-secondary">Marcas y modelos del buscador por vehículo de la tienda.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button className="btn btn-outline" disabled={!!busy} onClick={() => modelsXls.current?.click()}>
                        {busy === 'models' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Importar marcas y modelos
                    </button>
                    <button className="btn btn-outline" disabled={!!busy} onClick={() => fitXls.current?.click()}>
                        {busy === 'fitments' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Importar compatibilidades
                    </button>
                    <input ref={modelsXls} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importModels} />
                    <input ref={fitXls} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importFitments} />
                </div>
            </div>

            <details className="text-[13px] text-secondary">
                <summary className="cursor-pointer font-bold text-navy">Formato de los archivos de Excel</summary>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                    <li><strong>Marcas y modelos</strong>: columnas <code>Marca</code>, <code>Modelo</code>.</li>
                    <li><strong>Compatibilidades</strong>: <code>Código</code> (del producto en inventario), <code>Marca</code>, <code>Modelo</code>, <code>Año desde</code>, <code>Año hasta</code>, <code>Motor</code> (opcional). Una fila por vehículo. Las marcas y modelos que no existan se crean.</li>
                </ul>
            </details>

            {report && <p role="status" className="rounded-xl bg-white border border-line px-4 py-3 text-sm font-semibold text-navy">{report}</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}

            {loading ? (
                <div className="card flex justify-center text-secondary"><Loader2 className="animate-spin" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-[minmax(240px,320px)_1fr] gap-6 items-start">
                    {/* Marcas */}
                    <section className="card p-0 overflow-hidden" aria-label="Marcas">
                        <div className="p-3 border-b border-line space-y-2">
                            <div className="relative">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                                <input className="field h-10 pl-9" placeholder="Buscar marca" aria-label="Buscar marca" value={q} onChange={(e) => setQ(e.target.value)} />
                            </div>
                            {editing?.type === 'make' && !editing.id ? (
                                <InlineEdit initial="" placeholder="Nueva marca" onCancel={() => setEditing(null)}
                                    onSave={(name) => run(async () => { const m = await saveMake({ name }); setSelected(m.id); setEditing(null); })} />
                            ) : (
                                <button className="btn btn-ghost w-full justify-start h-9" onClick={() => setEditing({ type: 'make', id: null })}><Plus size={15} />Nueva marca</button>
                            )}
                        </div>
                        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-line">
                            {visibleMakes.map((m) => (
                                <li key={m.id}>
                                    {editing?.type === 'make' && editing.id === m.id ? (
                                        <div className="p-2"><InlineEdit initial={m.name} placeholder="Nombre de la marca" onCancel={() => setEditing(null)}
                                            onSave={(name) => run(async () => { await saveMake({ id: m.id, name }); setEditing(null); })} /></div>
                                    ) : (
                                        <div className={`flex items-center gap-1 pr-2 ${selected === m.id ? 'bg-primary-soft' : 'hover:bg-gray-50'}`}>
                                            <button className="flex-1 text-left px-4 py-2.5 flex items-center justify-between gap-2" onClick={() => setSelected(m.id)} aria-current={selected === m.id}>
                                                <span className={`font-bold ${selected === m.id ? 'text-primary-hover' : 'text-navy'}`}>{m.name}</span>
                                                <span className="text-[12px] text-secondary tabular-nums">{modelCount[m.id] || 0}</span>
                                            </button>
                                            <button className="p-1.5 rounded-md text-secondary hover:text-primary" aria-label={`Renombrar ${m.name}`} onClick={() => setEditing({ type: 'make', id: m.id })}><Edit2 size={14} /></button>
                                            <button className="p-1.5 rounded-md text-secondary hover:text-danger" aria-label={`Eliminar ${m.name}`} onClick={() => removeMake(m)}><Trash2 size={14} /></button>
                                        </div>
                                    )}
                                </li>
                            ))}
                            {visibleMakes.length === 0 && <li className="px-4 py-6 text-sm text-secondary">Sin resultados.</li>}
                        </ul>
                    </section>

                    {/* Modelos */}
                    <section className="card p-0 overflow-hidden" aria-label="Modelos">
                        <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
                            <h2 className="font-bold text-navy flex items-center gap-2"><Car size={18} className="text-primary" />{selectedMake ? `Modelos de ${selectedMake.name}` : 'Elige una marca'}</h2>
                            {selectedMake && !(editing?.type === 'model' && !editing.id) && (
                                <button className="btn btn-outline h-9" onClick={() => setEditing({ type: 'model', id: null })}><Plus size={15} />Nuevo modelo</button>
                            )}
                        </div>
                        {selectedMake && editing?.type === 'model' && !editing.id && (
                            <div className="p-3 border-b border-line">
                                <InlineEdit initial="" placeholder="Nombre del modelo" onCancel={() => setEditing(null)}
                                    onSave={(name) => run(async () => { await saveModel({ makeId: selected, name }); setEditing(null); })} />
                            </div>
                        )}
                        <table className="w-full text-left">
                            <thead className="bg-gray-50"><tr><th className="px-5 py-2.5">Modelo</th><th className="px-5 py-2.5 text-right">Productos compatibles</th><th className="w-24"><span className="sr-only">Acciones</span></th></tr></thead>
                            <tbody className="divide-y divide-line">
                                {selectedMake && makeModels.length === 0 && (
                                    <tr><td colSpan="3" className="px-5 py-8 text-center text-secondary">Sin modelos. Agrega uno o importa un Excel.</td></tr>
                                )}
                                {makeModels.map((m) => (
                                    <tr key={m.id}>
                                        <td className="px-5 py-2.5">
                                            {editing?.type === 'model' && editing.id === m.id ? (
                                                <InlineEdit initial={m.name} placeholder="Nombre del modelo" onCancel={() => setEditing(null)}
                                                    onSave={(name) => run(async () => { await saveModel({ id: m.id, makeId: m.makeId, name }); setEditing(null); })} />
                                            ) : (
                                                <>
                                                    <span className="font-bold text-navy">{m.name}</span>
                                                    <span className="ml-2 text-[12px] text-secondary font-mono">/vehiculo/{selectedMake?.slug}/{m.slug}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="px-5 py-2.5 text-right tabular-nums font-bold text-navy">{fitCounts[m.id] || 0}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex justify-end gap-1">
                                                <button className="p-1.5 rounded-md text-secondary hover:text-primary" aria-label={`Renombrar ${m.name}`} onClick={() => setEditing({ type: 'model', id: m.id })}><Edit2 size={14} /></button>
                                                <button className="p-1.5 rounded-md text-secondary hover:text-danger" aria-label={`Eliminar ${m.name}`} onClick={() => removeModel(m)}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </div>
            )}
        </div>
    );
};

export default Vehicles;
