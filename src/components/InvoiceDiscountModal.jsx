import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';

const usd = (n) => `$${(Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Descuento sobre una factura a credito pendiente (solo administrador; el servidor tambien lo exige).
export default function InvoiceDiscountModal({ invoice, onClose, onDone }) {
    const [type, setType] = useState('pct');
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const total = Number(invoice.total) || 0;
    const v = parseFloat(String(value).replace(',', '.')) || 0;
    const amount = Math.round((type === 'pct' ? total * v / 100 : v) * 100) / 100;
    const valid = amount > 0 && amount < total && reason.trim().length > 0;

    const submit = async () => {
        setBusy(true); setError('');
        try {
            await api.discountInvoice(invoice.id, amount, reason.trim());
            onDone?.();
            onClose();
        } catch (e) { setError(e.message || 'No se pudo aplicar el descuento.'); } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Descuento a factura">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-extrabold text-navy">Descuento · {invoice.invoiceNumber}</h2>
                    <button onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
                </div>
                <p className="text-sm text-secondary">Total pendiente: <b className="text-navy">{usd(total)}</b></p>
                <div className="flex gap-2">
                    <select value={type} onChange={(e) => setType(e.target.value)} className="field h-11 w-24" aria-label="Tipo de descuento">
                        <option value="pct">%</option><option value="amt">$</option>
                    </select>
                    <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="field h-11 flex-1" placeholder={type === 'pct' ? 'Ej.: 5' : 'Ej.: 2.50'} aria-label="Valor del descuento" />
                </div>
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="field h-11" placeholder="Motivo (obligatorio)" aria-label="Motivo" />
                {amount > 0 && <p className="text-sm">Descuento <b>{usd(amount)}</b> → nuevo total <b>{usd(total - amount)}</b></p>}
                {error && <div role="alert" className="text-danger text-sm font-semibold">{error}</div>}
                <button onClick={submit} disabled={!valid || busy} className="btn btn-primary h-11">Aplicar descuento</button>
            </div>
        </div>
    );
}
