import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, Lock, Unlock, RefreshCw, FileText } from 'lucide-react';
import { api } from '../services/api';
import { getRole } from '../auth/session';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import CashCloseReport from '../components/CashCloseReport';

const usd = (n) => `$${(Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const bs = (n) => `Bs ${(Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d) => (d ? new Date(d).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function CashRegister() {
    const canOpen = getRole() !== 'cajero';
    const rates = useExchangeRates();
    const rate = Number(rates?.bcv) || 0;
    const { allMethods } = usePaymentMethods();

    const [session, setSession] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [float, setFloat] = useState('');
    const [notes, setNotes] = useState('');
    // counted[m] = { amount: '123', currency: 'VES' | 'USD' }
    const [counted, setCounted] = useState({});
    const [busy, setBusy] = useState(false);
    const [report, setReport] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [cur, hist] = await Promise.all([api.getCashSession(), api.getCashHistory()]);
            setSession(cur);
            setHistory(hist.filter((h) => h.status === 'CLOSED'));
        } catch (e) {
            setError(e.message || 'No se pudo cargar la caja. ¿Aplicaste las migraciones 0010 y 0011?');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const open = async () => {
        setBusy(true); setError('');
        try { await api.openCash(float || 0, notes); setFloat(''); setNotes(''); await load(); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };

    const expected = useMemo(() => session?.expected || {}, [session]);
    const rows = useMemo(() => {
        const names = new Set();
        allMethods.filter((m) => m.enabled).forEach((m) => names.add(m.name));
        Object.keys(expected).forEach((m) => names.add(m));
        return Array.from(names).map((name) => {
            const cfg = allMethods.find((m) => m.name === name);
            return { name, defaultCurrency: cfg?.currency || 'VES' };
        });
    }, [allMethods, expected]);

    const entry = (name, defaultCurrency) => counted[name] || { amount: '', currency: rate ? defaultCurrency : 'USD' };
    const toUsd = (e) => {
        if (e.amount === '' || e.amount === undefined) return null;
        const n = Number(e.amount) || 0;
        return round2(e.currency === 'VES' && rate ? n / rate : n);
    };
    const setEntry = (name, defaultCurrency, patch) => setCounted({ ...counted, [name]: { ...entry(name, defaultCurrency), ...patch } });

    const close = async () => {
        const countedUsd = {};
        const nativeAmounts = {};
        rows.forEach(({ name, defaultCurrency }) => {
            const e = entry(name, defaultCurrency);
            const v = toUsd(e);
            countedUsd[name] = v === null ? 0 : v;
            if (v !== null) nativeAmounts[name] = { amount: Number(e.amount) || 0, currency: e.currency };
        });
        if (!window.confirm('¿Cerrar la caja con estos montos? No se puede deshacer.')) return;
        setBusy(true); setError('');
        try {
            const closed = await api.closeCash(countedUsd, notes, nativeAmounts, rate || null);
            setCounted({}); setNotes('');
            await load();
            setReport(closed);
        } catch (e) { setError(e.message); } finally { setBusy(false); }
    };

    const totals = rows.reduce((t, { name, defaultCurrency }) => {
        const v = toUsd(entry(name, defaultCurrency));
        return { exp: t.exp + (Number(expected[name]) || 0), cnt: t.cnt + (v || 0), any: t.any || v !== null };
    }, { exp: 0, cnt: 0, any: false });

    return (
        <div className="flex flex-col gap-6 max-w-5xl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Landmark className="text-primary" size={24} />
                    <div>
                        <h1 className="text-xl font-extrabold text-navy">Cierre de caja</h1>
                        <p className="text-xs text-secondary">Apertura con fondo, conteo por método y moneda, diferencia y reporte imprimible.</p>
                    </div>
                </div>
                <button onClick={load} className="btn btn-ghost h-9 px-3" aria-label="Actualizar"><RefreshCw size={16} /></button>
            </div>

            {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-danger text-sm font-semibold">{error}</div>}

            {loading ? <p className="text-secondary text-sm">Cargando…</p> : !session ? (
                canOpen ? (
                    <div className="card bg-white rounded-2xl p-6 flex flex-col gap-4 max-w-md">
                        <div className="flex items-center gap-2 font-bold text-navy"><Unlock size={18} /> Abrir caja</div>
                        <p className="text-xs text-secondary">Mientras la caja esté cerrada, los cajeros no pueden facturar. Puedes abrirla desde cualquier equipo.</p>
                        <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Fondo inicial en efectivo ($)
                            <input type="number" min="0" step="0.01" value={float} onChange={(e) => setFloat(e.target.value)} className="field h-11 mt-1 w-full" placeholder="0.00" />
                        </label>
                        <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Notas (opcional)
                            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="field h-11 mt-1 w-full" />
                        </label>
                        <button onClick={open} disabled={busy} className="btn btn-primary h-11">Abrir caja</button>
                    </div>
                ) : (
                    <div className="card bg-white rounded-2xl p-6 max-w-md flex items-start gap-3">
                        <Lock size={20} className="text-secondary flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-navy">La caja está cerrada</p>
                            <p className="text-sm text-secondary mt-1">Un administrador debe abrirla para que puedas facturar. Se desbloquea sola cuando la abran.</p>
                        </div>
                    </div>
                )
            ) : (
                <div className="card bg-white rounded-2xl p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-bold text-navy"><Lock size={18} /> Caja abierta</div>
                        <span className="text-xs text-secondary">Desde {when(session.openedAt)} · {session.openedBy} · fondo {usd(session.openingFloat)}</span>
                    </div>
                    {!rate && <p className="text-xs text-warning font-semibold">No hay tasa BCV cargada: solo se puede contar en dólares.</p>}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs uppercase tracking-wider text-secondary">
                                <th className="py-2">Método</th><th className="py-2 text-right">Esperado</th>
                                <th className="py-2 text-right">Recibido</th><th className="py-2 text-right">Equivale</th><th className="py-2 text-right">Diferencia</th>
                            </tr></thead>
                            <tbody>
                                {rows.map(({ name, defaultCurrency }) => {
                                    const e = entry(name, defaultCurrency);
                                    const v = toUsd(e);
                                    const d = v === null ? null : round2(v - (Number(expected[name]) || 0));
                                    return (
                                        <tr key={name} className="border-t border-gray-100 align-middle">
                                            <td className="py-2 font-semibold">{name}</td>
                                            <td className="py-2 text-right tabular-nums">
                                                {usd(expected[name])}
                                                {rate > 0 && <div className="text-[11px] text-secondary">{bs((Number(expected[name]) || 0) * rate)}</div>}
                                            </td>
                                            <td className="py-2 text-right">
                                                <div className="inline-flex gap-1">
                                                    <select value={e.currency} disabled={!rate} onChange={(ev) => setEntry(name, defaultCurrency, { currency: ev.target.value })}
                                                        className="field h-9 w-20" aria-label={`Moneda de ${name}`}>
                                                        <option value="VES">Bs</option><option value="USD">$</option>
                                                    </select>
                                                    <input type="number" min="0" step="0.01" value={e.amount} aria-label={`Recibido en ${name}`}
                                                        onChange={(ev) => setEntry(name, defaultCurrency, { amount: ev.target.value })} className="field h-9 w-32 text-right" />
                                                </div>
                                            </td>
                                            <td className="py-2 text-right tabular-nums text-secondary">{v === null ? '-' : usd(v)}</td>
                                            <td className={`py-2 text-right tabular-nums font-bold ${d === null ? 'text-secondary' : Math.abs(d) < 0.005 ? 'text-success' : 'text-danger'}`}>
                                                {d === null ? '-' : usd(d)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t-2 border-gray-300 font-extrabold">
                                    <td className="py-2">Total</td>
                                    <td className="py-2 text-right tabular-nums">{usd(totals.exp)}</td>
                                    <td />
                                    <td className="py-2 text-right tabular-nums">{totals.any ? usd(totals.cnt) : '-'}</td>
                                    <td className={`py-2 text-right tabular-nums ${!totals.any ? 'text-secondary' : Math.abs(totals.cnt - totals.exp) < 0.005 ? 'text-success' : 'text-danger'}`}>
                                        {totals.any ? usd(totals.cnt - totals.exp) : '-'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-secondary">Anota lo que hay físicamente en cada método, en la moneda en que lo recibiste (Bs o $). Se convierte a dólares con la tasa BCV{rate ? ` (${bs(rate)})` : ''}. Los métodos que dejes vacíos cuentan como 0.</p>
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas del cierre (opcional)" className="field h-11" />
                    <button onClick={close} disabled={busy} className="btn btn-primary h-11">Cerrar caja y generar reporte</button>
                </div>
            )}

            {history.length > 0 && (
                <div className="card bg-white rounded-2xl p-0 overflow-hidden">
                    <div className="p-4 font-bold text-navy border-b border-gray-100">Cierres anteriores</div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/50"><tr className="text-left text-xs uppercase tracking-wider text-secondary">
                                <th className="p-3">Apertura</th><th className="p-3">Cierre</th><th className="p-3">Cajero</th><th className="p-3 text-right">Diferencia</th><th className="p-3" />
                            </tr></thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.id} className="border-t border-gray-100">
                                        <td className="p-3">{when(h.openedAt)}</td>
                                        <td className="p-3">{when(h.closedAt)}</td>
                                        <td className="p-3">{h.closedBy}</td>
                                        <td className={`p-3 text-right font-bold tabular-nums ${Number(h.difference) === 0 ? 'text-success' : 'text-danger'}`}>{usd(h.difference)}</td>
                                        <td className="p-3 text-right">
                                            <button type="button" onClick={() => setReport(h)} className="inline-flex items-center gap-1 text-primary font-bold text-xs"><FileText size={14} /> Reporte</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {report && <CashCloseReport session={report} onClose={() => setReport(null)} />}
        </div>
    );
}
