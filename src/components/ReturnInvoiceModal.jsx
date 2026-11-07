import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';
import { usePaymentMethods } from '../hooks/usePaymentMethods';

// Devolución parcial por línea o anulación total de una factura.
export default function ReturnInvoiceModal({ invoice, onClose, onDone }) {
    const { methods: payMethods } = usePaymentMethods();
    const returned = useMemo(() => {
        const m = {};
        (invoice.returns || []).forEach((r) => (r.items || []).forEach((i) => { m[i.productId] = (m[i.productId] || 0) + Number(i.quantity); }));
        return m;
    }, [invoice]);
    const lines = useMemo(() => {
        const m = {};
        (invoice.items || []).forEach((it) => {
            const cur = m[it.productId] || { productId: it.productId, name: it.name, sold: 0 };
            cur.sold += Number(it.quantity);
            m[it.productId] = cur;
        });
        return Object.values(m).map((l) => ({ ...l, left: l.sold - (returned[l.productId] || 0) })).filter((l) => l.left > 0);
    }, [invoice, returned]);

    const [qty, setQty] = useState({});
    const [reason, setReason] = useState('');
    const [refundMethod, setRefundMethod] = useState(invoice.paymentMethod && invoice.paymentMethod !== 'Mixto' ? invoice.paymentMethod : 'Efectivo');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const chosen = lines.filter((l) => Number(qty[l.productId]) > 0).map((l) => ({ productId: l.productId, quantity: Number(qty[l.productId]) }));
    const canVoidAll = (invoice.returns || []).length === 0;

    const submit = async (all) => {
        if (!reason.trim()) { setError('Indica el motivo.'); return; }
        if (!all && chosen.length === 0) { setError('Elige al menos un producto a devolver.'); return; }
        setBusy(true); setError('');
        try {
            await api.returnInvoice(invoice.id, all ? null : chosen, reason.trim(), invoice.status === 'PAID' ? refundMethod : null);
            onDone?.();
            onClose();
        } catch (e) { setError(e.message || 'No se pudo registrar.'); } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-4 no-print" role="dialog" aria-modal="true" aria-label="Devolución">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-extrabold text-navy">Devolver / anular · {invoice.invoiceNumber}</h2>
                    <button onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
                </div>
                <div className="flex flex-col gap-2">
                    {lines.map((l) => (
                        <div key={l.productId} className="flex items-center gap-3">
                            <span className="flex-1 text-sm font-semibold">{l.name} <span className="text-secondary font-normal">(quedan {l.left})</span></span>
                            <input type="number" min="0" max={l.left} value={qty[l.productId] ?? ''} aria-label={`Cantidad a devolver de ${l.name}`}
                                onChange={(e) => setQty({ ...qty, [l.productId]: Math.min(l.left, Math.max(0, parseInt(e.target.value) || 0)) })} className="field h-9 w-20 text-right" />
                        </div>
                    ))}
                </div>
                {invoice.status === 'PAID' && (
                    <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Reembolso por
                        <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="field h-10 mt-1 w-full">
                            {payMethods.map((m) => <option key={m.name}>{m.name}</option>)}
                        </select>
                    </label>
                )}
                <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Motivo
                    <input value={reason} onChange={(e) => setReason(e.target.value)} className="field h-10 mt-1 w-full" placeholder="Ej.: producto equivocado" />
                </label>
                {error && <div role="alert" className="text-danger text-sm font-semibold">{error}</div>}
                <div className="flex gap-2 justify-end flex-wrap">
                    <button onClick={() => submit(false)} disabled={busy} className="btn btn-primary h-10 px-4">Devolver seleccionados</button>
                    {canVoidAll && <button onClick={() => { if (window.confirm('¿Anular toda la factura? Se repone el stock y se reembolsa el pago.')) submit(true); }} disabled={busy} className="btn btn-ghost h-10 px-4 text-danger">Anular factura completa</button>}
                </div>
            </div>
        </div>
    );
}
