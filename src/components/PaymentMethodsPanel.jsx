import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { api } from '../services/api';
import { normalizeMethods, refreshPaymentMethods } from '../hooks/usePaymentMethods';

// Configuracion de metodos de pago: activar/desactivar, moneda, "pide monto recibido" y descuento por metodo.
export default function PaymentMethodsPanel() {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    useEffect(() => {
        api.getSettings('global_settings').then((d) => setList(normalizeMethods(d?.paymentMethods))).finally(() => setLoading(false));
    }, []);

    const set = (i, patch) => setList((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
    const add = () => setList((prev) => [...prev, { name: '', currency: 'VES', enabled: true, discountPct: 0, cash: false, builtin: false }]);

    const save = async () => {
        const names = list.map((m) => m.name.trim().toLowerCase());
        if (list.some((m) => !m.name.trim())) { setMsg({ ok: false, text: 'Todos los métodos necesitan un nombre.' }); return; }
        if (new Set(names).size !== names.length) { setMsg({ ok: false, text: 'Hay nombres repetidos.' }); return; }
        if (!list.some((m) => m.enabled)) { setMsg({ ok: false, text: 'Deja al menos un método activo.' }); return; }
        setSaving(true); setMsg(null);
        try {
            const paymentMethods = list.map((m) => ({
                name: m.name.trim(), currency: m.currency, enabled: m.enabled,
                discountPct: Math.min(100, Math.max(0, Number(m.discountPct) || 0)), cash: !!m.cash,
            }));
            await api.updateSettings('global_settings', { paymentMethods });
            await refreshPaymentMethods();
            setMsg({ ok: true, text: 'Métodos de pago guardados.' });
        } catch (e) {
            setMsg({ ok: false, text: e.message || 'No se pudo guardar.' });
        } finally { setSaving(false); }
    };

    if (loading) return <p className="text-secondary text-sm">Cargando…</p>;

    return (
        <div className="flex flex-col gap-4 max-w-4xl">
            <p className="text-sm text-secondary">
                Activa o desactiva métodos, define en qué moneda se recibe cada uno y, si quieres, un <b>descuento</b> que se aplica solo cuando el cliente paga con ese método
                (por ejemplo, 10% en Divisas). El descuento no aplica a ventas a crédito ni a pagos divididos. Los nombres de los métodos de fábrica no se pueden cambiar porque el historial los usa.
            </p>
            <div className="card bg-white rounded-2xl p-0 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50/50"><tr className="text-left text-xs uppercase tracking-wider text-secondary">
                        <th className="p-3">Activo</th><th className="p-3">Nombre</th><th className="p-3">Moneda</th>
                        <th className="p-3 text-center">Pide monto recibido</th><th className="p-3 text-right">Descuento %</th><th className="p-3" />
                    </tr></thead>
                    <tbody>
                        {list.map((m, i) => (
                            <tr key={i} className="border-t border-gray-100">
                                <td className="p-3"><input type="checkbox" checked={m.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} aria-label={`Activar ${m.name || 'método'}`} /></td>
                                <td className="p-3">
                                    <input value={m.name} disabled={m.builtin} onChange={(e) => set(i, { name: e.target.value })} className="field h-9 w-44" placeholder="Nombre" aria-label="Nombre del método" />
                                </td>
                                <td className="p-3">
                                    <select value={m.currency} onChange={(e) => set(i, { currency: e.target.value })} className="field h-9" aria-label="Moneda">
                                        <option value="VES">Bolívares (Bs)</option><option value="USD">Dólares ($)</option>
                                    </select>
                                </td>
                                <td className="p-3 text-center"><input type="checkbox" checked={m.cash} onChange={(e) => set(i, { cash: e.target.checked })} aria-label="Pide monto recibido" /></td>
                                <td className="p-3 text-right"><input type="number" min="0" max="100" step="0.5" value={m.discountPct} onChange={(e) => set(i, { discountPct: e.target.value })} className="field h-9 w-24 text-right" aria-label="Descuento por ese método" /></td>
                                <td className="p-3 text-right">
                                    {!m.builtin && <button type="button" onClick={() => setList((prev) => prev.filter((_, idx) => idx !== i))} className="text-danger" aria-label="Eliminar método"><Trash2 size={16} /></button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {msg && <div role="status" className={`p-3 rounded-xl text-sm font-semibold ${msg.ok ? 'bg-green-50 text-success' : 'bg-red-50 text-danger'}`}>{msg.text}</div>}
            <div className="flex gap-3">
                <button type="button" onClick={add} className="btn btn-ghost h-10 px-4 inline-flex items-center gap-2"><Plus size={16} /> Agregar método</button>
                <button type="button" onClick={save} disabled={saving} className="btn btn-primary h-10 px-5 inline-flex items-center gap-2"><Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
        </div>
    );
}
