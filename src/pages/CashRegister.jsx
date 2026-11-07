import React, { useCallback, useEffect, useState } from 'react';
import { Landmark, Lock, Unlock, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

const METHODS = ['Efectivo', 'Divisas', 'Pago Móvil', 'Tarjeta', 'Transferencia'];
const money = (n) => `$${(Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d) => (d ? new Date(d).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-');

export default function CashRegister() {
    const [session, setSession] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [float, setFloat] = useState('');
    const [notes, setNotes] = useState('');
    const [counted, setCounted] = useState({});
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [cur, hist] = await Promise.all([api.getCashSession(), api.getCashHistory()]);
            setSession(cur);
            setHistory(hist.filter((h) => h.status === 'CLOSED'));
        } catch (e) {
            setError(e.message || 'No se pudo cargar la caja. ¿Aplicaste la migración 0010?');
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

    const close = async () => {
        const payload = {};
        METHODS.forEach((m) => { if (counted[m] !== undefined && counted[m] !== '') payload[m] = Number(counted[m]); });
        Object.keys(session?.expected || {}).forEach((m) => { if (payload[m] === undefined) payload[m] = 0; });
        if (!window.confirm('¿Cerrar la caja con estos montos? No se puede deshacer.')) return;
        setBusy(true); setError('');
        try { await api.closeCash(payload, notes); setCounted({}); setNotes(''); await load(); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };

    const expected = session?.expected || {};
    const methods = Array.from(new Set([...METHODS, ...Object.keys(expected)])).filter((m) => m === 'Efectivo' || expected[m] !== undefined);
    const diffFor = (m) => (counted[m] === undefined || counted[m] === '' ? null : Number(counted[m]) - (expected[m] || 0));

    return (
        <div className="flex flex-col gap-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Landmark className="text-primary" size={24} />
                    <div>
                        <h1 className="text-xl font-extrabold text-navy">Cierre de caja</h1>
                        <p className="text-xs text-secondary">Apertura con fondo, conteo por método de pago y diferencia.</p>
                    </div>
                </div>
                <button onClick={load} className="btn btn-ghost h-9 px-3" aria-label="Actualizar"><RefreshCw size={16} /></button>
            </div>

            {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-danger text-sm font-semibold">{error}</div>}

            {loading ? <p className="text-secondary text-sm">Cargando…</p> : !session ? (
                <div className="card bg-white rounded-2xl p-6 flex flex-col gap-4 max-w-md">
                    <div className="flex items-center gap-2 font-bold text-navy"><Unlock size={18} /> Abrir caja</div>
                    <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Fondo inicial en efectivo ($)
                        <input type="number" min="0" step="0.01" value={float} onChange={(e) => setFloat(e.target.value)} className="field h-11 mt-1 w-full" placeholder="0.00" />
                    </label>
                    <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Notas (opcional)
                        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="field h-11 mt-1 w-full" />
                    </label>
                    <button onClick={open} disabled={busy} className="btn btn-primary h-11">Abrir caja</button>
                </div>
            ) : (
                <div className="card bg-white rounded-2xl p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-bold text-navy"><Lock size={18} /> Caja abierta</div>
                        <span className="text-xs text-secondary">Desde {when(session.openedAt)} · {session.openedBy} · fondo {money(session.openingFloat)}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs uppercase tracking-wider text-secondary">
                                <th className="py-2">Método</th><th className="py-2 text-right">Esperado</th><th className="py-2 text-right w-40">Contado</th><th className="py-2 text-right">Diferencia</th>
                            </tr></thead>
                            <tbody>
                                {methods.map((m) => {
                                    const d = diffFor(m);
                                    return (
                                        <tr key={m} className="border-t border-gray-100">
                                            <td className="py-2 font-semibold">{m}</td>
                                            <td className="py-2 text-right tabular-nums">{money(expected[m])}</td>
                                            <td className="py-2 text-right">
                                                <input type="number" min="0" step="0.01" value={counted[m] ?? ''} aria-label={`Contado ${m}`}
                                                    onChange={(e) => setCounted({ ...counted, [m]: e.target.value })} className="field h-9 w-32 text-right" />
                                            </td>
                                            <td className={`py-2 text-right tabular-nums font-bold ${d === null ? 'text-secondary' : d === 0 ? 'text-success' : 'text-danger'}`}>
                                                {d === null ? '-' : money(d)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-secondary">El esperado suma las ventas y cobros y resta las devoluciones desde la apertura (en efectivo se incluye el fondo). Los métodos que dejes vacíos se cuentan como 0.</p>
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas del cierre (opcional)" className="field h-11" />
                    <button onClick={close} disabled={busy} className="btn btn-primary h-11">Cerrar caja</button>
                </div>
            )}

            {history.length > 0 && (
                <div className="card bg-white rounded-2xl p-0 overflow-hidden">
                    <div className="p-4 font-bold text-navy border-b border-gray-100">Cierres anteriores</div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/50"><tr className="text-left text-xs uppercase tracking-wider text-secondary">
                                <th className="p-3">Apertura</th><th className="p-3">Cierre</th><th className="p-3">Cajero</th><th className="p-3 text-right">Diferencia</th>
                            </tr></thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.id} className="border-t border-gray-100">
                                        <td className="p-3">{when(h.openedAt)}</td>
                                        <td className="p-3">{when(h.closedAt)}</td>
                                        <td className="p-3">{h.closedBy}</td>
                                        <td className={`p-3 text-right font-bold tabular-nums ${Number(h.difference) === 0 ? 'text-success' : 'text-danger'}`}>{money(h.difference)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
