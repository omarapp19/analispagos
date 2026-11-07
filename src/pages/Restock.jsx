import React, { useCallback, useEffect, useState } from 'react';
import { PackageSearch, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TABS = [
    { id: 'restock', label: 'Reposición' },
    { id: 'slow', label: 'Baja rotación' },
    { id: 'margin', label: 'Márgenes bajos' },
];

function MinStockCell({ row, onSaved }) {
    const [v, setV] = useState(String(row.minStock ?? 0));
    const [saving, setSaving] = useState(false);
    const save = async () => {
        if (String(row.minStock ?? 0) === v) return;
        setSaving(true);
        try { await api.updateMinStock(row.id, v); onSaved(); } finally { setSaving(false); }
    };
    return <input type="number" min="0" value={v} disabled={saving} onChange={(e) => setV(e.target.value)} onBlur={save}
        aria-label={`Mínimo de ${row.name}`} className="field h-8 w-20 text-right" />;
}

export default function Restock() {
    const [tab, setTab] = useState('restock');
    const [days, setDays] = useState(30);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            if (tab === 'restock') setRows(await api.getRestockReport(days));
            if (tab === 'slow') setRows(await api.getSlowMovers(days < 60 ? 90 : days));
            if (tab === 'margin') setRows(await api.getMarginAlerts(10));
        } catch (e) {
            setError(e.message || 'No se pudo cargar. ¿Aplicaste la migración 0010?');
            setRows([]);
        } finally { setLoading(false); }
    }, [tab, days]);

    useEffect(() => { load(); }, [load]);

    const tied = tab === 'slow' ? rows.reduce((s, r) => s + Number(r.tiedCapital || 0), 0) : 0;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <PackageSearch className="text-primary" size={24} />
                    <div>
                        <h1 className="text-xl font-extrabold text-navy">Reposición y rotación</h1>
                        <p className="text-xs text-secondary">Qué comprar, qué no se mueve y qué se vende con poco margen.</p>
                    </div>
                </div>
                <button onClick={load} className="btn btn-ghost h-9 px-3" aria-label="Actualizar"><RefreshCw size={16} /></button>
            </div>

            <div className="flex gap-2 flex-wrap items-center" role="tablist">
                {TABS.map((t) => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                        className={`px-4 h-9 rounded-xl text-sm font-bold border ${tab === t.id ? 'bg-primary text-white border-primary' : 'bg-white text-navy border-gray-200'}`}>{t.label}</button>
                ))}
                {tab !== 'margin' && (
                    <label className="ml-auto text-xs font-bold text-secondary flex items-center gap-2">Período de ventas
                        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="field h-9">
                            {[30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} días</option>)}
                        </select>
                    </label>
                )}
            </div>

            {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-danger text-sm font-semibold">{error}</div>}
            {loading && <p className="text-secondary text-sm">Cargando…</p>}
            {tab === 'slow' && !loading && <p className="text-sm text-secondary">Dinero parado en productos sin ventas: <b className="text-navy">{money(tied)}</b></p>}

            <div className="card bg-white rounded-2xl p-0 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50/50"><tr className="text-left text-xs uppercase tracking-wider text-secondary">
                        <th className="p-3">Código</th><th className="p-3">Producto</th>
                        {tab === 'restock' && (<><th className="p-3 text-right">Stock</th><th className="p-3 text-right">Mínimo</th><th className="p-3 text-right">Vendido</th><th className="p-3 text-right">Cobertura (días)</th><th className="p-3 text-right">Sugerido (30 d)</th></>)}
                        {tab === 'slow' && (<><th className="p-3 text-right">Stock</th><th className="p-3 text-right">Costo</th><th className="p-3 text-right">Capital parado</th></>)}
                        {tab === 'margin' && (<><th className="p-3 text-right">Costo</th><th className="p-3 text-right">Precio</th><th className="p-3 text-right">Margen</th></>)}
                    </tr></thead>
                    <tbody>
                        {!loading && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-secondary">Nada que mostrar. ¡Todo en orden!</td></tr>}
                        {rows.map((r) => (
                            <tr key={r.id} className="border-t border-gray-100">
                                <td className="p-3 text-secondary">{r.code || '-'}</td>
                                <td className="p-3 font-semibold">{r.name}</td>
                                {tab === 'restock' && (<>
                                    <td className={`p-3 text-right tabular-nums ${r.quantity <= r.minStock ? 'text-danger font-bold' : ''}`}>{r.quantity}</td>
                                    <td className="p-3 text-right"><MinStockCell row={r} onSaved={load} /></td>
                                    <td className="p-3 text-right tabular-nums">{r.sold}</td>
                                    <td className="p-3 text-right tabular-nums">{r.coverageDays ?? '-'}</td>
                                    <td className="p-3 text-right tabular-nums font-bold">{r.suggested}</td>
                                </>)}
                                {tab === 'slow' && (<>
                                    <td className="p-3 text-right tabular-nums">{r.quantity}</td>
                                    <td className="p-3 text-right tabular-nums">{money(r.costPrice)}</td>
                                    <td className="p-3 text-right tabular-nums font-bold">{money(r.tiedCapital)}</td>
                                </>)}
                                {tab === 'margin' && (<>
                                    <td className="p-3 text-right tabular-nums">{money(r.costPrice)}</td>
                                    <td className="p-3 text-right tabular-nums">{money(r.sellingPrice)}</td>
                                    <td className={`p-3 text-right tabular-nums font-bold ${r.marginPct < 0 ? 'text-danger' : 'text-warning'}`}>{r.marginPct}%</td>
                                </>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
