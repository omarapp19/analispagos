import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, X, ExternalLink, Building2, AlertTriangle } from 'lucide-react';
import { subscribeToTable } from '../../supabase';
import { listWholesale, reviewWholesale, customerDocUrl } from '../../services/webOrdersApi';
import { getStoreSettings } from '../../services/storeApi';

const usd = (n) => new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(Number(n) || 0);

const TABS = [
    { id: 'pending', label: 'Solicitudes' },
    { id: 'approved', label: 'Mayoristas activos' },
    { id: 'rejected', label: 'Rechazados' },
];

const WholesaleCustomers = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('pending');
    const [creditOptions, setCreditOptions] = useState([0, 15, 30]);

    const load = useCallback(async () => {
        try {
            setRows(await listWholesale());
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        getStoreSettings().then(({ publica }) => setCreditOptions(publica.creditDaysOptions)).catch(() => {});
        return subscribeToTable('web_customers', () => load());
    }, [load]);

    const visible = rows.filter((r) => r.wholesaleStatus === tab);
    const count = (id) => rows.filter((r) => r.wholesaleStatus === id).length;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-navy">Clientes mayoristas</h1>
                <p className="text-secondary">Aprueba solicitudes y define crédito y descuento especial. Las reglas de precio por volumen y forma de pago están en Reglas de precio.</p>
            </div>

            <div className="flex gap-1 border-b border-line -mb-2" role="tablist">
                {TABS.map((t) => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                        className={`relative px-3 pb-3 pt-1 text-sm font-bold whitespace-nowrap ${tab === t.id ? 'text-primary' : 'text-secondary hover:text-navy'}`}>
                        {t.label}
                        {count(t.id) > 0 && (
                            <span className={`ml-1.5 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full text-[11px] tabular-nums ${t.id === 'pending' ? 'bg-primary text-white' : 'bg-gray-100 text-secondary'}`}>{count(t.id)}</span>
                        )}
                        {tab === t.id && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-t-full" />}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="card flex justify-center text-secondary"><Loader2 className="animate-spin" /></div>
            ) : error ? (
                <p className="card text-danger font-semibold">{error}</p>
            ) : visible.length === 0 ? (
                <div className="card text-center text-secondary py-12">
                    <Building2 className="mx-auto mb-3 opacity-40" size={28} />
                    <p className="font-semibold">{tab === 'pending' ? 'No hay solicitudes por revisar.' : 'Nada por aquí.'}</p>
                </div>
            ) : (
                <ul className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {visible.map((c) => <CustomerCard key={c.userId} c={c} creditOptions={creditOptions} onDone={setRows} />)}
                </ul>
            )}
        </div>
    );
};

const CustomerCard = ({ c, creditOptions, onDone }) => {
    const [form, setForm] = useState({
        creditLimitUsd: c.creditLimitUsd || 0,
        maxCreditDays: c.maxCreditDays || 0,
        specialDiscountPct: c.specialDiscountPct || 0,
        note: '',
    });
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [rejecting, setRejecting] = useState(false);
    const nameMismatch = c.clientName && c.fullName && c.clientName.trim().toLowerCase() !== c.fullName.trim().toLowerCase();
    const available = Math.max(0, (c.creditLimitUsd || 0) - (c.creditUsedUsd || 0));

    const submit = async (approve) => {
        setBusy(approve ? 'approve' : 'reject');
        setError(null);
        try {
            onDone(await reviewWholesale(c.userId, { ...form, approve }));
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(null);
        }
    };

    const openDoc = async () => {
        try { window.open(await customerDocUrl(c.rifDocument), '_blank', 'noopener'); } catch (e) { setError(e.message); }
    };

    const days = [...new Set([0, ...creditOptions, Number(form.maxCreditDays)])].sort((a, b) => a - b);

    return (
        <li className="card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-extrabold text-navy text-[16px]">{c.businessName || c.fullName}</p>
                    <p className="text-[13px] text-secondary">
                        RIF <span className="font-mono font-bold text-navy">{c.rif || '—'}</span> · {c.fullName}
                    </p>
                    <p className="text-[13px] text-secondary break-all">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                    <p className="text-[12.5px] text-secondary">Registrado el {new Date(c.createdAt).toLocaleDateString('es-VE')} · documento <span className="font-mono">{c.documentId}</span></p>
                </div>
                {c.rifDocument && (
                    <button className="btn btn-outline h-9 shrink-0" onClick={openDoc}><ExternalLink size={14} />RIF</button>
                )}
            </div>

            {nameMismatch && (
                <p className="text-[12.5px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    Ese documento ya existía en el ERP como “{c.clientName}”. Verifica que sea la misma persona o empresa antes de aprobar.
                </p>
            )}

            {c.wholesaleStatus === 'approved' && (
                <div className="grid grid-cols-3 gap-2 text-center">
                    {[['Límite', usd(c.creditLimitUsd)], ['Usado', usd(c.creditUsedUsd)], ['Disponible', usd(available)]].map(([l, v]) => (
                        <div key={l} className="rounded-xl bg-gray-50 border border-line py-2">
                            <p className="eyebrow-label">{l}</p>
                            <p className="font-extrabold text-navy tabular-nums">{v}</p>
                        </div>
                    ))}
                </div>
            )}
            {c.wholesaleNote && <p className="text-[13px] text-secondary">Nota: {c.wholesaleNote}</p>}

            <div className="grid grid-cols-3 gap-3">
                <label className="block">
                    <span className="eyebrow-label block mb-1">Límite de crédito (USD)</span>
                    <input className="field h-10" type="number" min="0" step="10" value={form.creditLimitUsd}
                        onChange={(e) => setForm({ ...form, creditLimitUsd: e.target.value })} />
                </label>
                <label className="block">
                    <span className="eyebrow-label block mb-1">Plazo máximo</span>
                    <select className="field h-10" value={form.maxCreditDays} onChange={(e) => setForm({ ...form, maxCreditDays: e.target.value })}>
                        {days.map((d) => <option key={d} value={d}>{d === 0 ? 'Sin crédito' : `${d} días`}</option>)}
                    </select>
                </label>
                <label className="block">
                    <span className="eyebrow-label block mb-1">Descuento especial %</span>
                    <input className="field h-10" type="number" min="0" max="100" step="0.5" value={form.specialDiscountPct}
                        onChange={(e) => setForm({ ...form, specialDiscountPct: e.target.value })} />
                </label>
            </div>

            {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}

            {rejecting ? (
                <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
                    <input className="field h-10" autoFocus required value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                        placeholder="Motivo (lo verá el cliente)" aria-label="Motivo del rechazo" />
                    <button className="btn bg-danger text-white hover:opacity-90 shrink-0" disabled={!!busy}>
                        {busy === 'reject' ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}Rechazar
                    </button>
                    <button type="button" className="btn btn-ghost shrink-0" onClick={() => setRejecting(false)}>Volver</button>
                </form>
            ) : (
                <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary" disabled={!!busy} onClick={() => submit(true)}>
                        {busy === 'approve' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        {c.wholesaleStatus === 'approved' ? 'Guardar condiciones' : 'Aprobar mayorista'}
                    </button>
                    <button className="btn btn-ghost text-danger" onClick={() => setRejecting(true)}>
                        {c.wholesaleStatus === 'approved' ? 'Quitar condición de mayorista' : 'Rechazar'}
                    </button>
                </div>
            )}
        </li>
    );
};

export default WholesaleCustomers;
