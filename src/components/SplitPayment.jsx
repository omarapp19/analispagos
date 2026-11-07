import React from 'react';

// Reparte el total en varios métodos de pago (en USD). `value` = [{method, amount}].
export default function SplitPayment({ total, methods, value, onChange }) {
    const sum = value.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const left = Math.round((total - sum) * 100) / 100;
    const set = (i, patch) => onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

    return (
        <div className="flex flex-col gap-2 animate-fade-in" aria-label="Pago dividido">
            {value.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                    <select value={p.method} onChange={(e) => set(i, { method: e.target.value })} className="field h-11 flex-1" aria-label={`Método ${i + 1}`}>
                        {methods.map((m) => <option key={m}>{m}</option>)}
                    </select>
                    <input type="number" min="0" step="0.01" value={p.amount} onChange={(e) => set(i, { amount: e.target.value })}
                        className="field h-11 w-32 text-right" aria-label={`Monto ${i + 1} en dólares`} placeholder="$ 0.00" />
                    {value.length > 2 && <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-danger text-sm font-bold" aria-label="Quitar">×</button>}
                </div>
            ))}
            <div className="flex items-center justify-between text-[13px] font-semibold">
                <button type="button" onClick={() => onChange([...value, { method: methods[0], amount: left > 0 ? String(left) : '' }])} className="underline text-primary">+ Añadir método</button>
                <span className={Math.abs(left) < 0.005 ? 'text-success' : 'text-danger'}>
                    {Math.abs(left) < 0.005 ? 'Cuadra con el total' : left > 0 ? `Faltan $${left.toFixed(2)}` : `Sobran $${Math.abs(left).toFixed(2)}`}
                </span>
            </div>
        </div>
    );
}
