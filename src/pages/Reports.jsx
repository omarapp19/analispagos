import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isoDay = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const TABS = [
    { id: 'ventas', label: 'Ventas y utilidad' },
    { id: 'cxc', label: 'Antigüedad de deudas' },
    { id: 'audit', label: 'Auditoría' },
];

const Table = ({ cols, rows, empty = 'Sin datos en el período.' }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead className="bg-gray-50/50"><tr className="text-left text-xs uppercase tracking-wider text-secondary">
                {cols.map((c) => <th key={c.key} className={`p-3 ${c.right ? 'text-right' : ''}`}>{c.label}</th>)}
            </tr></thead>
            <tbody>
                {rows.length === 0 ? <tr><td colSpan={cols.length} className="p-6 text-center text-secondary">{empty}</td></tr> : rows.map((r, i) => (
                    <tr key={r.id ?? i} className="border-t border-gray-100">
                        {cols.map((c) => <td key={c.key} className={`p-3 ${c.right ? 'text-right tabular-nums' : ''}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const Kpi = ({ label, value, tone }) => (
    <div className="card bg-white rounded-2xl p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-secondary">{label}</div>
        <div className={`text-2xl font-extrabold mt-1 tabular-nums ${tone || 'text-navy'}`}>{value}</div>
    </div>
);

export default function Reports() {
    const today = new Date();
    const [tab, setTab] = useState('ventas');
    const [from, setFrom] = useState(isoDay(new Date(today.getFullYear(), today.getMonth(), 1)));
    const [to, setTo] = useState(isoDay(today));
    const [sales, setSales] = useState(null);
    const [aging, setAging] = useState([]);
    const [audit, setAudit] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            if (tab === 'ventas') setSales(await api.getSalesReport(from, to));
            if (tab === 'cxc') setAging(await api.getReceivablesAging());
            if (tab === 'audit') setAudit(await api.getAuditLog());
        } catch (e) {
            setError(e.message || 'No se pudo cargar el reporte. ¿Aplicaste la migración 0010?');
        } finally { setLoading(false); }
    }, [tab, from, to]);

    useEffect(() => { load(); }, [load]);

    const buckets = useMemo(() => {
        const b = { 'Vigente': 0, '1-30': 0, '31-60': 0, '60+': 0 };
        aging.forEach((r) => { b[r.bucket] = (b[r.bucket] || 0) + Number(r.total); });
        return b;
    }, [aging]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <BarChart3 className="text-primary" size={24} />
                    <h1 className="text-xl font-extrabold text-navy">Reportes</h1>
                </div>
                <button onClick={load} className="btn btn-ghost h-9 px-3" aria-label="Actualizar"><RefreshCw size={16} /></button>
            </div>

            <div className="flex gap-2 flex-wrap" role="tablist">
                {TABS.map((t) => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                        className={`px-4 h-9 rounded-xl text-sm font-bold border ${tab === t.id ? 'bg-primary text-white border-primary' : 'bg-white text-navy border-gray-200'}`}>{t.label}</button>
                ))}
            </div>

            {tab === 'ventas' && (
                <div className="flex items-end gap-3 flex-wrap">
                    <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Desde
                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field h-10 mt-1 block" /></label>
                    <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Hasta
                        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field h-10 mt-1 block" /></label>
                </div>
            )}

            {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-danger text-sm font-semibold">{error}</div>}
            {loading && <p className="text-secondary text-sm">Cargando…</p>}

            {tab === 'ventas' && sales && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Kpi label="Ventas" value={money(sales.summary.total)} />
                        <Kpi label="Facturas" value={sales.summary.count} />
                        <Kpi label="Costo" value={money(sales.profit.cost)} />
                        <Kpi label="Utilidad" value={money(sales.profit.profit)} tone={sales.profit.profit < 0 ? 'text-danger' : 'text-success'} />
                    </div>
                    <p className="text-xs text-secondary -mt-3">La utilidad usa el costo actual de cada producto y descuenta lo devuelto. Las facturas anuladas no cuentan.</p>
                    <div className="grid lg:grid-cols-2 gap-4">
                        <div className="card bg-white rounded-2xl p-0 overflow-hidden"><div className="p-4 font-bold text-navy">Por día</div>
                            <Table cols={[{ key: 'date', label: 'Fecha' }, { key: 'count', label: 'Fact.', right: true }, { key: 'total', label: 'Total', right: true, render: (r) => money(r.total) }]} rows={sales.byDay} /></div>
                        <div className="card bg-white rounded-2xl p-0 overflow-hidden"><div className="p-4 font-bold text-navy">Por cajero</div>
                            <Table cols={[{ key: 'seller', label: 'Cajero' }, { key: 'count', label: 'Fact.', right: true }, { key: 'total', label: 'Total', right: true, render: (r) => money(r.total) }]} rows={sales.bySeller} /></div>
                    </div>
                    <div className="card bg-white rounded-2xl p-0 overflow-hidden"><div className="p-4 font-bold text-navy">Productos (top 50)</div>
                        <Table cols={[{ key: 'name', label: 'Producto' }, { key: 'qty', label: 'Cant.', right: true },
                            { key: 'revenue', label: 'Ventas', right: true, render: (r) => money(r.revenue) },
                            { key: 'cost', label: 'Costo', right: true, render: (r) => money(r.cost) },
                            { key: 'profit', label: 'Utilidad', right: true, render: (r) => <span className={r.profit < 0 ? 'text-danger font-bold' : ''}>{money(r.profit)}</span> }]}
                            rows={sales.byProduct} /></div>
                    <div className="card bg-white rounded-2xl p-0 overflow-hidden"><div className="p-4 font-bold text-navy">Clientes (top 30)</div>
                        <Table cols={[{ key: 'client', label: 'Cliente' }, { key: 'count', label: 'Fact.', right: true }, { key: 'total', label: 'Total', right: true, render: (r) => money(r.total) }]} rows={sales.byClient} /></div>
                </>
            )}

            {tab === 'cxc' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {Object.entries(buckets).map(([k, v]) => <Kpi key={k} label={k === 'Vigente' ? 'Vigente' : `${k} días vencido`} value={money(v)} tone={k === '60+' && v > 0 ? 'text-danger' : undefined} />)}
                    </div>
                    <div className="card bg-white rounded-2xl p-0 overflow-hidden">
                        <Table empty="No hay cuentas por cobrar." cols={[
                            { key: 'invoiceNumber', label: 'Factura' }, { key: 'clientName', label: 'Cliente' },
                            { key: 'dueDate', label: 'Vence' }, { key: 'daysOverdue', label: 'Días vencida', right: true },
                            { key: 'bucket', label: 'Tramo' }, { key: 'total', label: 'Monto', right: true, render: (r) => money(r.total) }]} rows={aging} />
                    </div>
                </>
            )}

            {tab === 'audit' && (
                <div className="card bg-white rounded-2xl p-0 overflow-hidden">
                    <Table empty="Sin eventos registrados." cols={[
                        { key: 'at', label: 'Fecha', render: (r) => new Date(r.at).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) },
                        { key: 'user', label: 'Usuario' }, { key: 'action', label: 'Acción' }, { key: 'entity', label: 'Entidad' },
                        { key: 'detail', label: 'Detalle', render: (r) => <code className="text-xs break-all">{JSON.stringify(r.detail)}</code> }]} rows={audit} />
                </div>
            )}
        </div>
    );
}
