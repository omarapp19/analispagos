import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    X, Loader2, Check, Ban, Receipt, MessageCircle, Truck, Store, PackageCheck, FileText, ExternalLink,
    AlertTriangle, ShoppingBag, ChevronRight, RefreshCw,
} from 'lucide-react';
import { subscribeToTable } from '../../supabase';
import {
    STATUS, ORDER_TABS, PAYMENT_LABELS, DELIVERY_LABELS, listOrders, getOrderDetail, reviewPayment, confirmOrder,
    setOrderStatus, setOrderNotes, proofUrl, waLink, waMessage,
} from '../../services/webOrdersApi';

const usd = (n) => new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(Number(n) || 0);
const bs = (n) => `Bs ${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d) => d ? new Date(d).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const TONE = {
    action: 'bg-primary text-white',
    warn: 'bg-amber-100 text-amber-800',
    ok: 'bg-green-50 text-green-700 border border-green-100',
    done: 'bg-gray-100 text-navy',
    off: 'bg-gray-100 text-secondary',
};

const StatusChip = ({ status }) => (
    <span className={`inline-flex items-center h-6 px-2 rounded-md text-[11.5px] font-bold whitespace-nowrap ${TONE[STATUS[status]?.tone] || TONE.off}`}>
        {STATUS[status]?.label || status}
    </span>
);

const WebOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') || 'pago';
    const openId = params.get('pedido');

    const load = useCallback(async () => {
        try {
            setOrders(await listOrders());
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Tiempo real: pedidos nuevos, cambios de estado y comprobantes recién reportados.
    const timer = useRef(null);
    useEffect(() => {
        load();
        const refresh = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 400); };
        const u1 = subscribeToTable('web_orders', refresh);
        const u2 = subscribeToTable('web_payment_reports', refresh);
        return () => { u1(); u2(); clearTimeout(timer.current); };
    }, [load]);

    const counts = useMemo(() => {
        const c = {};
        for (const t of ORDER_TABS) c[t.id] = orders.filter((o) => t.statuses.includes(o.status)).length;
        return c;
    }, [orders]);

    const current = ORDER_TABS.find((t) => t.id === tab) || ORDER_TABS[0];
    const rows = orders.filter((o) => current.statuses.includes(o.status));

    const setParam = (k, v) => {
        const next = new URLSearchParams(params);
        if (v) next.set(k, v); else next.delete(k);
        setParams(next, { replace: k === 'tab' });
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Pedidos web</h1>
                    <p className="text-secondary">Verifica pagos, factura y avanza cada pedido. El cliente ve cada cambio en su cuenta.</p>
                </div>
                <button className="btn btn-outline self-start" onClick={() => { setLoading(true); load(); }}>
                    <RefreshCw size={15} /> Actualizar
                </button>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-line -mb-2" role="tablist" aria-label="Estados">
                {ORDER_TABS.map((t) => (
                    <button
                        key={t.id}
                        role="tab"
                        aria-selected={t.id === current.id}
                        onClick={() => setParam('tab', t.id)}
                        className={`relative px-3 pb-3 pt-1 text-sm font-bold whitespace-nowrap transition-colors ${t.id === current.id ? 'text-primary' : 'text-secondary hover:text-navy'}`}
                    >
                        {t.label}
                        {counts[t.id] > 0 && (
                            <span className={`ml-1.5 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full text-[11px] tabular-nums ${['pago', 'confirmar'].includes(t.id) ? 'bg-primary text-white' : 'bg-gray-100 text-secondary'}`}>
                                {counts[t.id]}
                            </span>
                        )}
                        {t.id === current.id && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-t-full" />}
                    </button>
                ))}
            </div>

            <div className="card p-0 overflow-hidden">
                {loading ? (
                    <div className="p-10 flex justify-center text-secondary"><Loader2 className="animate-spin" /></div>
                ) : error ? (
                    <p className="p-6 text-danger font-semibold">{error}</p>
                ) : rows.length === 0 ? (
                    <div className="p-12 text-center text-secondary">
                        <ShoppingBag className="mx-auto mb-3 opacity-40" size={28} />
                        <p className="font-semibold">No hay pedidos en “{current.label}”.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-line">
                                <tr>
                                    <th className="px-5 py-3">Pedido</th>
                                    <th className="px-5 py-3">Cliente</th>
                                    <th className="px-5 py-3">Entrega</th>
                                    <th className="px-5 py-3">Pago</th>
                                    <th className="px-5 py-3 text-right">Total</th>
                                    <th className="px-5 py-3">Estado</th>
                                    <th className="w-10" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {rows.map((o) => (
                                    <tr key={o.id} onClick={() => setParam('pedido', o.id)} className="cursor-pointer hover:bg-gray-50/70">
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <button className="font-bold text-navy font-mono hover:text-primary" onClick={(e) => { e.stopPropagation(); setParam('pedido', o.id); }}>
                                                {o.number}
                                            </button>
                                            <span className="block text-[12px] text-secondary">{when(o.createdAt)}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="font-semibold text-navy">{o.customerName || o.clientName || '—'}</span>
                                            {o.customerType === 'mayor' && <span className="ml-1.5 text-[10.5px] font-extrabold uppercase bg-warning/25 text-amber-900 px-1.5 py-0.5 rounded">Mayor</span>}
                                            <span className="block text-[12px] text-secondary font-mono">{o.documentId}</span>
                                        </td>
                                        <td className="px-5 py-3 text-secondary">
                                            {DELIVERY_LABELS[o.deliveryMethod]}{o.deliveryZone ? ` · ${o.deliveryZone}` : ''}{o.carrier ? ` · ${o.carrier}` : ''}
                                        </td>
                                        <td className="px-5 py-3 text-secondary">
                                            {PAYMENT_LABELS[o.paymentMethod]}{o.paymentMethod === 'credito' ? ` ${o.creditDays} d` : ''}
                                            {o.pendingPayments > 0 && <span className="block text-[12px] font-bold text-primary">{o.pendingPayments} comprobante(s) por revisar</span>}
                                        </td>
                                        <td className="px-5 py-3 text-right whitespace-nowrap">
                                            <span className="font-bold text-navy tabular-nums">{usd(o.totalUsd)}</span>
                                            <span className="block text-[12px] text-secondary tabular-nums">{bs(o.totalBs)}</span>
                                        </td>
                                        <td className="px-5 py-3"><StatusChip status={o.status} /></td>
                                        <td className="pr-4 text-secondary"><ChevronRight size={16} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {openId && <OrderDrawer orderId={openId} onClose={() => setParam('pedido', null)} onChanged={load} />}
        </div>
    );
};

// ---------- Detalle ----------
const Section = ({ title, children, right }) => (
    <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
            <h3 className="eyebrow-label">{title}</h3>
            {right}
        </div>
        {children}
    </section>
);

const OrderDrawer = ({ orderId, onClose, onChanged }) => {
    const navigate = useNavigate();
    const [o, setO] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [busy, setBusy] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [rejecting, setRejecting] = useState(null); // id del comprobante
    const [rejectNote, setRejectNote] = useState('');
    const [ship, setShip] = useState({ carrier: '', tracking: '' });
    const [cancelNote, setCancelNote] = useState('');
    const [showCancel, setShowCancel] = useState(false);
    const [notes, setNotes] = useState('');
    const [notesSaved, setNotesSaved] = useState(true);

    const load = useCallback(async () => {
        try {
            const d = await getOrderDetail(orderId);
            if (!d) throw new Error('Pedido no encontrado');
            setO(d);
            setNotes(d.staffNotes || '');
            setNotesSaved(true);
            setShip((s) => ({ carrier: s.carrier || d.carrier || '', tracking: s.tracking || d.trackingNumber || '' }));
            setLoadError(null);
        } catch (e) {
            setLoadError(e.message);
        }
    }, [orderId]);

    useEffect(() => {
        setO(null);
        load();
        const u1 = subscribeToTable('web_orders', (p) => { if (p.new?.id === orderId) load(); });
        const u2 = subscribeToTable('web_payment_reports', (p) => { if (p.new?.orderId === orderId) load(); });
        return () => { u1(); u2(); };
    }, [orderId, load]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const act = async (key, fn) => {
        setBusy(key);
        setActionError(null);
        try {
            const res = await fn();
            if (res && typeof res === 'object' && res.number) {
                setO(res);
                setNotes(res.staffNotes || '');
            } else {
                await load();
            }
            onChanged();
            return true;
        } catch (e) {
            setActionError(e.message);
            return false;
        } finally {
            setBusy(null);
        }
    };

    const openProof = async (path) => {
        try {
            const url = await proofUrl(path);
            window.open(url, '_blank', 'noopener');
        } catch (e) {
            setActionError('No se pudo abrir el comprobante: ' + e.message);
        }
    };

    const nextStep = o && {
        CONFIRMADO: { status: 'PREPARANDO', label: 'Marcar preparando', icon: PackageCheck },
        PREPARANDO: o.deliveryMethod === 'retiro'
            ? { status: 'LISTO_RETIRO', label: 'Listo para retiro', icon: Store }
            : o.deliveryMethod === 'delivery'
                ? { status: 'EN_CAMINO', label: 'Salió el delivery', icon: Truck }
                : { status: 'ENVIADO', label: 'Marcar enviado', icon: Truck },
        LISTO_RETIRO: { status: 'ENTREGADO', label: 'Entregado', icon: Check },
        EN_CAMINO: { status: 'ENTREGADO', label: 'Entregado', icon: Check },
        ENVIADO: { status: 'ENTREGADO', label: 'Entregado', icon: Check },
    }[o.status];

    const beforeConfirm = o && ['PENDIENTE_PAGO', 'POR_CONFIRMAR', 'PAGO_REPORTADO'].includes(o.status);
    const wa = o && waLink(o.customer?.phone || o.customer?.clientPhone || o.deliveryAddress?.phone, waMessage(o));
    const pendingReports = o?.payments?.filter((p) => p.status === 'pendiente') || [];

    // Efectivo y crédito se confirman directo. Con pagos electrónicos lo normal es aprobar el comprobante:
    // confirmar sin él queda como acción secundaria (pago verificado por otra vía).
    const confirmText = o && ({
        POR_CONFIRMAR: o.paymentMethod === 'credito' ? 'Confirmar y facturar a crédito' : 'Confirmar y facturar',
        PAGO_REPORTADO: 'Confirmar sin aprobar comprobante',
        PENDIENTE_PAGO: 'Confirmar sin pago reportado',
    }[o.status]);
    const confirmPrimary = o?.status === 'POR_CONFIRMAR';

    return (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/40" onClick={onClose}>
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={o ? `Pedido ${o.number}` : 'Pedido'}
                onClick={(e) => e.stopPropagation()}
                className="bg-background w-full max-w-2xl h-full overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-4"
            >
                <header className="sticky top-0 z-10 bg-white border-b border-line px-5 py-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-extrabold text-navy font-mono">{o?.number || '…'}</h2>
                            {o && <StatusChip status={o.status} />}
                            {o?.customerType === 'mayor' && <span className="text-[11px] font-extrabold uppercase bg-warning/25 text-amber-900 px-1.5 py-0.5 rounded">Mayor</span>}
                        </div>
                        {o && <p className="text-[13px] text-secondary mt-0.5">{when(o.createdAt)}{o.reservedUntil ? ` · apartado hasta ${when(o.reservedUntil)}` : ''}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-secondary" aria-label="Cerrar"><X size={18} /></button>
                </header>

                {loadError && <p className="m-5 text-danger font-semibold">{loadError}</p>}
                {!o && !loadError && <div className="p-10 flex justify-center text-secondary"><Loader2 className="animate-spin" /></div>}

                {o && (
                    <div className="p-5 space-y-6">
                        {actionError && (
                            <p role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-semibold text-danger flex gap-2">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />{actionError}
                            </p>
                        )}
                        {o.facturaFiscal && beforeConfirm && (
                            <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-800 flex gap-2">
                                <FileText size={16} className="mt-0.5 shrink-0" />Los pedidos web requieren factura fiscal: emítela en la máquina fiscal al confirmar.
                            </p>
                        )}

                        {/* Acciones */}
                        <div className="card p-4 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {beforeConfirm && (
                                    <button className={`btn ${confirmPrimary ? 'btn-primary' : 'btn-outline'}`} disabled={!!busy}
                                        onClick={() => {
                                            const warn = o.status !== 'POR_CONFIRMAR'
                                                ? `El pedido ${o.number} no tiene un pago aprobado. ¿Confirmar y facturar de todas formas?`
                                                : `¿Confirmar ${o.number} y generar la factura? Se descuenta el stock.`;
                                            if (window.confirm(warn)) act('confirm', () => confirmOrder(o.id));
                                        }}>
                                        {busy === 'confirm' ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}{confirmText}
                                    </button>
                                )}
                                {nextStep && nextStep.status !== 'ENVIADO' && (
                                    <button className="btn btn-primary" disabled={!!busy} onClick={() => act('next', () => setOrderStatus(o.id, nextStep.status))}>
                                        {busy === 'next' ? <Loader2 size={16} className="animate-spin" /> : <nextStep.icon size={16} />}{nextStep.label}
                                    </button>
                                )}
                                {o.invoiceNumber && (
                                    <button className="btn btn-outline" onClick={() => navigate(`/pos?factura=${encodeURIComponent(o.invoiceNumber)}`)}>
                                        <Receipt size={16} />Factura {o.invoiceNumber}
                                    </button>
                                )}
                                {wa && (
                                    <a className="btn btn-outline" href={wa} target="_blank" rel="noreferrer">
                                        <MessageCircle size={16} />WhatsApp
                                    </a>
                                )}
                                {beforeConfirm && !showCancel && (
                                    <button className="btn btn-ghost text-danger" disabled={!!busy} onClick={() => setShowCancel(true)}>
                                        <Ban size={16} />Cancelar pedido
                                    </button>
                                )}
                            </div>

                            {nextStep?.status === 'ENVIADO' && (
                                <form className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end"
                                    onSubmit={(e) => { e.preventDefault(); act('next', () => setOrderStatus(o.id, 'ENVIADO', ship)); }}>
                                    <label className="block">
                                        <span className="eyebrow-label block mb-1">Transportista</span>
                                        <input className="field h-10" required value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} placeholder="MRW" />
                                    </label>
                                    <label className="block">
                                        <span className="eyebrow-label block mb-1">Número de guía</span>
                                        <input className="field h-10" required value={ship.tracking} onChange={(e) => setShip({ ...ship, tracking: e.target.value })} />
                                    </label>
                                    <button className="btn btn-primary" disabled={!!busy}>
                                        {busy === 'next' ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}Marcar enviado
                                    </button>
                                </form>
                            )}

                            {showCancel && (
                                <form className="flex flex-col sm:flex-row gap-2"
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (await act('cancel', () => setOrderStatus(o.id, 'CANCELADO', { note: cancelNote }))) setShowCancel(false);
                                    }}>
                                    <input className="field h-10" autoFocus value={cancelNote} onChange={(e) => setCancelNote(e.target.value)}
                                        placeholder="Motivo (lo verá el cliente)" aria-label="Motivo de la cancelación" />
                                    <button className="btn bg-danger text-white hover:opacity-90 shrink-0" disabled={!!busy}>
                                        {busy === 'cancel' ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}Cancelar pedido
                                    </button>
                                    <button type="button" className="btn btn-ghost shrink-0" onClick={() => setShowCancel(false)}>Volver</button>
                                </form>
                            )}
                        </div>

                        {/* Comprobantes */}
                        {o.payments.length > 0 && (
                            <Section title={`Comprobantes${pendingReports.length ? ` · ${pendingReports.length} por revisar` : ''}`}>
                                <ul className="space-y-2">
                                    {o.payments.map((p) => (
                                        <li key={p.id} className={`card p-4 ${p.status === 'pendiente' ? 'ring-2 ring-primary/30' : ''}`}>
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-bold text-navy tabular-nums">
                                                        {p.currency === 'USD' ? usd(p.amount) : bs(p.amount)}
                                                        <span className="font-semibold text-secondary"> · {PAYMENT_LABELS[p.method] || p.method}</span>
                                                    </p>
                                                    <p className="text-[13px] text-secondary">
                                                        Ref. <span className="font-mono font-bold text-navy">{p.reference}</span> · {p.paidAt}{p.bankFrom ? ` · ${p.bankFrom}` : ''}
                                                    </p>
                                                    {p.currency === 'VES' && (
                                                        <p className="text-[12px] text-secondary">≈ {usd(p.amount / o.bcvRate)} a la tasa del pedido</p>
                                                    )}
                                                    {p.reviewNote && <p className="text-[13px] text-navy mt-1">Nota: {p.reviewNote}</p>}
                                                </div>
                                                <span className={`text-[11.5px] font-bold px-2 py-1 rounded-md ${p.status === 'aprobado' ? 'bg-green-50 text-green-700' : p.status === 'rechazado' ? 'bg-red-50 text-danger' : 'bg-primary-soft text-primary-hover'}`}>
                                                    {p.status === 'pendiente' ? 'Por revisar' : p.status === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {p.proofPath ? (
                                                    <button className="btn btn-outline h-9" onClick={() => openProof(p.proofPath)}><ExternalLink size={14} />Ver comprobante</button>
                                                ) : <span className="text-[12.5px] text-secondary self-center">Sin archivo adjunto</span>}
                                                {p.status === 'pendiente' && o.status === 'PAGO_REPORTADO' && rejecting !== p.id && (
                                                    <>
                                                        <button className="btn btn-primary h-9" disabled={!!busy}
                                                            onClick={() => act('pay' + p.id, () => reviewPayment(p.id, true))}>
                                                            {busy === 'pay' + p.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Aprobar
                                                        </button>
                                                        <button className="btn btn-ghost h-9 text-danger" onClick={() => { setRejecting(p.id); setRejectNote(''); }}>Rechazar…</button>
                                                    </>
                                                )}
                                            </div>
                                            {rejecting === p.id && (
                                                <form className="flex flex-col sm:flex-row gap-2 mt-3"
                                                    onSubmit={async (e) => {
                                                        e.preventDefault();
                                                        if (await act('pay' + p.id, () => reviewPayment(p.id, false, rejectNote))) setRejecting(null);
                                                    }}>
                                                    <input className="field h-10" autoFocus required value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                                                        placeholder="Motivo (ej. falta 5 USD, referencia no aparece)" aria-label="Motivo del rechazo" />
                                                    <button className="btn bg-danger text-white hover:opacity-90 shrink-0" disabled={!!busy}>Rechazar</button>
                                                    <button type="button" className="btn btn-ghost shrink-0" onClick={() => setRejecting(null)}>Volver</button>
                                                </form>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        {/* Productos y totales */}
                        <Section title="Productos">
                            <div className="card p-0 overflow-hidden">
                                <ul className="divide-y divide-line">
                                    {o.items.map((it, i) => (
                                        <li key={i} className="px-4 py-3">
                                            <div className="flex justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-bold text-navy">{it.productName}</p>
                                                    <p className="text-[12.5px] text-secondary">
                                                        {it.code && <span className="font-mono">{it.code} · </span>}
                                                        {it.quantity} × {usd(it.unitPriceUsd)}
                                                        {Number(it.discountPct) !== 0 && <span> (base {usd(it.unitBaseUsd)}, {Number(it.discountPct) > 0 ? '−' : '+'}{Math.abs(it.discountPct)} %)</span>}
                                                    </p>
                                                    {it.appliedRules?.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {it.appliedRules.map((r) => (
                                                                <span key={r.id} className="text-[11px] font-bold bg-gray-100 text-secondary px-1.5 py-0.5 rounded">
                                                                    {r.name} {Number(r.discountPct) > 0 ? '−' : '+'}{Math.abs(r.discountPct)} %
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="font-bold text-navy tabular-nums whitespace-nowrap">{usd(it.lineTotalUsd)}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                <dl className="border-t border-line bg-gray-50/60 px-4 py-3 space-y-1 text-[13.5px]">
                                    <div className="flex justify-between"><dt className="text-secondary">Subtotal</dt><dd className="tabular-nums">{usd(o.subtotalUsd)}</dd></div>
                                    {Number(o.discountUsd) !== 0 && <div className="flex justify-between"><dt className="text-secondary">Descuentos</dt><dd className="tabular-nums">−{usd(o.discountUsd)}</dd></div>}
                                    {Number(o.deliveryFeeUsd) > 0 && <div className="flex justify-between"><dt className="text-secondary">Delivery</dt><dd className="tabular-nums">{usd(o.deliveryFeeUsd)}</dd></div>}
                                    {Number(o.taxUsd) > 0 && <div className="flex justify-between"><dt className="text-secondary">IVA</dt><dd className="tabular-nums">{usd(o.taxUsd)}</dd></div>}
                                    {Number(o.igtfUsd) > 0 && <div className="flex justify-between"><dt className="text-secondary">IGTF</dt><dd className="tabular-nums">{usd(o.igtfUsd)}</dd></div>}
                                    <div className="flex justify-between font-extrabold text-navy text-[15px] pt-1"><dt>Total</dt><dd className="tabular-nums">{usd(o.totalUsd)}</dd></div>
                                    <div className="flex justify-between text-secondary"><dt>En bolívares (tasa {Number(o.bcvRate).toLocaleString('es-VE')})</dt><dd className="tabular-nums">{bs(o.totalBs)}</dd></div>
                                </dl>
                            </div>
                        </Section>

                        {/* Cliente y entrega */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Section title="Cliente">
                                <div className="card p-4 text-[13.5px] space-y-0.5">
                                    <p className="font-bold text-navy">{o.customer.fullName || o.customer.clientName}</p>
                                    {o.customer.clientName && o.customer.clientName !== o.customer.fullName && (
                                        <p className="text-secondary">En el ERP: {o.customer.clientName}</p>
                                    )}
                                    <p className="text-secondary font-mono">{o.customer.documentId}</p>
                                    {o.customer.phone && <p className="text-secondary">{o.customer.phone}</p>}
                                    {o.customer.email && <p className="text-secondary break-all">{o.customer.email}</p>}
                                    {o.customer.businessName && <p className="text-secondary">{o.customer.businessName} · {o.customer.rif}</p>}
                                </div>
                            </Section>
                            <Section title="Entrega y pago">
                                <div className="card p-4 text-[13.5px] space-y-0.5">
                                    <p className="font-bold text-navy">{DELIVERY_LABELS[o.deliveryMethod]}{o.deliveryZone ? ` · zona ${o.deliveryZone}` : ''}</p>
                                    {o.carrier && <p className="text-secondary">{o.carrier}{o.trackingNumber ? ` · guía ${o.trackingNumber}` : ''}</p>}
                                    {o.deliveryAddress && (
                                        <p className="text-secondary">
                                            {o.deliveryAddress.fullName} · {o.deliveryAddress.phone}<br />
                                            {o.deliveryAddress.line1}, {o.deliveryAddress.city}{o.deliveryAddress.state ? `, ${o.deliveryAddress.state}` : ''}
                                            {o.deliveryAddress.reference && <><br />Ref.: {o.deliveryAddress.reference}</>}
                                        </p>
                                    )}
                                    <p className="text-navy font-semibold pt-1">{PAYMENT_LABELS[o.paymentMethod]}{o.paymentMethod === 'credito' ? ` a ${o.creditDays} días` : ''}</p>
                                    {o.notes && <p className="text-secondary pt-1">Nota del cliente: {o.notes}</p>}
                                </div>
                            </Section>
                        </div>

                        {/* Notas internas */}
                        <Section title="Notas internas" right={!notesSaved && (
                            <button className="btn btn-outline h-8 text-xs" disabled={busy === 'notes'}
                                onClick={async () => {
                                    setBusy('notes');
                                    try { await setOrderNotes(o.id, notes); setNotesSaved(true); } catch (e) { setActionError(e.message); } finally { setBusy(null); }
                                }}>
                                {busy === 'notes' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Guardar
                            </button>
                        )}>
                            <textarea className="field h-20 py-2.5 resize-y font-medium" value={notes} placeholder="Solo las ve el personal"
                                onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }} aria-label="Notas internas" />
                        </Section>

                        {/* Historial */}
                        <Section title="Historial (lo ve el cliente)">
                            <ol className="relative border-l border-line ml-2 space-y-3">
                                {o.events.map((e, i) => (
                                    <li key={i} className="pl-4 relative">
                                        <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${i === o.events.length - 1 ? 'bg-primary' : 'bg-gray-300'}`} />
                                        <p className="text-[13.5px] font-bold text-navy">{STATUS[e.status]?.label || e.status}{e.byStaff && <span className="font-medium text-secondary"> · personal</span>}</p>
                                        {e.note && <p className="text-[13px] text-secondary">{e.note}</p>}
                                        <p className="text-[12px] text-secondary">{when(e.createdAt)}</p>
                                    </li>
                                ))}
                            </ol>
                        </Section>
                    </div>
                )}
            </aside>
        </div>
    );
};

export default WebOrders;
