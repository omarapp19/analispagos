import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Lock, Globe, Loader2, AlertTriangle } from 'lucide-react';
import { getStoreSettings, saveStoreSettings } from '../../services/storeApi';

// Configuración de la tienda web.
// - settings.tienda_publica: la lee cualquiera desde la tienda (datos de pago, entrega, horario...).
// - settings.tienda_privada: solo personal y funciones de la base (IVA, factura fiscal, tope y margen).

const PAYMENT_FIELDS = {
    pago_movil: { label: 'Pago Móvil', fields: [['bank', 'Banco'], ['phone', 'Teléfono'], ['document', 'Cédula / RIF']] },
    transferencia: { label: 'Transferencia en Bs', fields: [['bank', 'Banco'], ['account', 'Número de cuenta'], ['holder', 'Titular'], ['rif', 'RIF']] },
    zelle: { label: 'Zelle', fields: [['email', 'Correo'], ['holder', 'Titular']] },
    binance: { label: 'Binance Pay', fields: [['payId', 'Pay ID'], ['email', 'Correo']] },
    efectivo: { label: 'Efectivo (al retirar o al recibir)', fields: [] },
};

const IGTF_METHODS = [['zelle', 'Zelle'], ['binance', 'Binance'], ['efectivo', 'Efectivo']];

const Section = ({ title, hint, privado, children }) => (
    <section className="card p-0 overflow-hidden">
        <header className="px-6 pt-5 pb-4 border-b border-line flex items-start justify-between gap-4">
            <div>
                <h3 className="text-[15px] font-bold text-navy">{title}</h3>
                {hint && <p className="text-[13px] text-secondary mt-0.5">{hint}</p>}
            </div>
            <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] px-2 py-1 rounded-md ${privado ? 'bg-navy text-white' : 'bg-gray-100 text-secondary'}`}>
                {privado ? <Lock size={12} /> : <Globe size={12} />}
                {privado ? 'Privado' : 'Público'}
            </span>
        </header>
        <div className="p-6 space-y-5">{children}</div>
    </section>
);

const Field = ({ label, hint, children, className = '' }) => (
    <label className={`block ${className}`}>
        <span className="eyebrow-label block mb-1.5">{label}</span>
        {children}
        {hint && <span className="block text-[12px] text-secondary mt-1 font-medium">{hint}</span>}
    </label>
);

const Toggle = ({ checked, onChange, label, hint }) => (
    <label className="flex items-start gap-3 cursor-pointer select-none">
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`mt-0.5 relative w-10 h-6 rounded-full shrink-0 transition-colors duration-150 ${checked ? 'bg-primary' : 'bg-gray-300'}`}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-150 ${checked ? 'translate-x-4' : ''}`} />
        </button>
        <span>
            <span className="block text-[14px] font-bold text-navy">{label}</span>
            {hint && <span className="block text-[12.5px] text-secondary font-medium mt-0.5">{hint}</span>}
        </span>
    </label>
);

const num = (v, fallback = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
};

const StoreSettingsPanel = () => {
    const [pub, setPub] = useState(null);
    const [priv, setPriv] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [newCarrier, setNewCarrier] = useState('');
    const [newDays, setNewDays] = useState('');

    useEffect(() => {
        getStoreSettings()
            .then(({ publica, privada }) => { setPub(publica); setPriv(privada); })
            .catch((e) => setLoadError(e.message || 'No se pudo leer la configuración'));
    }, []);

    if (loadError) {
        return <div className="card text-danger font-semibold flex items-center gap-2"><AlertTriangle size={18} />{loadError}</div>;
    }
    if (!pub || !priv) {
        return <div className="card flex items-center gap-2 text-secondary"><Loader2 size={16} className="animate-spin" />Cargando configuración de la tienda…</div>;
    }

    // Actualiza una ruta anidada de tienda_publica: setAt(['payments','zelle','email'], 'x')
    const setAt = (path, value) => setPub((prev) => {
        const next = structuredClone(prev);
        let o = next;
        for (const k of path.slice(0, -1)) o = o[k];
        o[path[path.length - 1]] = value;
        return next;
    });

    const zones = pub.delivery.delivery.zones || [];
    const setZones = (z) => setAt(['delivery', 'delivery', 'zones'], z);

    const validate = () => {
        const errors = [];
        if (pub.storeOpen && !pub.whatsapp.trim()) errors.push('Agrega el WhatsApp antes de abrir la tienda.');
        if (pub.whatsapp && pub.whatsapp.replace(/\D/g, '').length < 10) errors.push('El WhatsApp debe incluir el código de país, ej. +58 412 000 0000.');
        const enabledPays = Object.entries(pub.payments).filter(([, v]) => v.enabled);
        if (pub.storeOpen && enabledPays.length === 0) errors.push('Activa al menos un método de pago.');
        for (const [k, v] of enabledPays) {
            const missing = PAYMENT_FIELDS[k].fields.filter(([f]) => !String(v[f] || '').trim());
            if (missing.length) errors.push(`${PAYMENT_FIELDS[k].label}: falta ${missing.map(([, l]) => l.toLowerCase()).join(', ')}.`);
        }
        if (pub.delivery.delivery.enabled && zones.length === 0) errors.push('Delivery activo: agrega al menos una zona.');
        const names = zones.map((z) => z.name.trim().toLowerCase());
        if (names.some((n) => !n)) errors.push('Cada zona de delivery necesita un nombre.');
        if (new Set(names).size !== names.length) errors.push('Hay zonas de delivery con el mismo nombre.');
        if (!Object.values(pub.delivery).some((d) => d.enabled)) errors.push('Activa al menos una forma de entrega.');
        if (priv.maxDiscountPct < 0 || priv.maxDiscountPct > 100) errors.push('El tope de descuento debe estar entre 0 y 100 %.');
        if (priv.minMarginPct < 0) errors.push('El margen mínimo no puede ser negativo.');
        if (pub.reservationHours < 1 || pub.cashReservationHours < 1) errors.push('Las horas de reserva deben ser 1 o más.');
        return errors;
    };

    const handleSave = async () => {
        const errors = validate();
        if (errors.length) {
            setMessage({ type: 'error', text: errors.join(' ') });
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            const cleanPub = {
                ...pub,
                whatsapp: pub.whatsapp.trim(),
                address: pub.address.trim(),
                hours: pub.hours.trim(),
                igtfPct: num(pub.igtfPct),
                reservationHours: Math.round(num(pub.reservationHours, 24)),
                cashReservationHours: Math.round(num(pub.cashReservationHours, 48)),
                creditDaysOptions: [...new Set(pub.creditDaysOptions.map((d) => parseInt(d)).filter((d) => d >= 0))].sort((a, b) => a - b),
                delivery: {
                    ...pub.delivery,
                    delivery: {
                        ...pub.delivery.delivery,
                        freeOverUsd: num(pub.delivery.delivery.freeOverUsd),
                        zones: zones.map((z) => ({ name: z.name.trim(), feeUsd: num(z.feeUsd) })),
                    },
                },
            };
            const cleanPriv = {
                ...priv,
                maxDiscountPct: num(priv.maxDiscountPct),
                minMarginPct: num(priv.minMarginPct),
            };
            await saveStoreSettings({ publica: cleanPub, privada: cleanPriv });
            setPub(cleanPub);
            setPriv(cleanPriv);
            setMessage({ type: 'success', text: 'Configuración de la tienda guardada.' });
        } catch (e) {
            console.error('Error guardando tienda web:', e);
            setMessage({ type: 'error', text: e.message || 'No se pudo guardar.' });
        } finally {
            setSaving(false);
        }
    };

    const addCarrier = () => {
        const c = newCarrier.trim();
        if (!c) return;
        const list = pub.delivery.envio_nacional.carriers || [];
        if (!list.some((x) => x.toLowerCase() === c.toLowerCase())) setAt(['delivery', 'envio_nacional', 'carriers'], [...list, c]);
        setNewCarrier('');
    };

    const addDays = () => {
        const d = parseInt(newDays);
        if (!(d >= 0)) return;
        if (!pub.creditDaysOptions.includes(d)) setAt(['creditDaysOptions'], [...pub.creditDaysOptions, d].sort((a, b) => a - b));
        setNewDays('');
    };

    return (
        <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
            <div className="rounded-xl border border-line bg-white px-5 py-4 text-[13.5px] text-secondary font-medium leading-relaxed">
                Lo marcado como <strong className="text-navy">Público</strong> lo puede leer cualquier visitante de la tienda.
                Lo <strong className="text-navy">Privado</strong> solo lo ven el personal y las funciones de la base que calculan precios.
            </div>

            <Section title="Tienda" hint="Estado, contacto y horario que se muestran en la tienda.">
                <Toggle
                    checked={pub.storeOpen}
                    onChange={(v) => setAt(['storeOpen'], v)}
                    label="Recibir pedidos"
                    hint="Apagado: el catálogo se ve, pero nadie puede confirmar pedidos."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="WhatsApp" hint="Con código de país. Se usa en los botones de contacto.">
                        <input className="field" inputMode="tel" value={pub.whatsapp} onChange={(e) => setAt(['whatsapp'], e.target.value)} placeholder="+58 412 000 0000" />
                    </Field>
                    <Field label="Horario">
                        <input className="field" value={pub.hours} onChange={(e) => setAt(['hours'], e.target.value)} placeholder="Lun–Vie 8:00–17:00 · Sáb 8:00–13:00" />
                    </Field>
                </div>
                <Field label="Dirección de la tienda" hint="Para retiro en tienda y el pie de página.">
                    <input className="field" value={pub.address} onChange={(e) => setAt(['address'], e.target.value)} placeholder="Av. 5 de Julio con calle 77, Maracaibo, Zulia" />
                </Field>
            </Section>

            <Section privado title="Precios e impuestos" hint="Cómo calcula la base el precio final de cada pedido.">
                <Toggle
                    checked={priv.pricesIncludeIva}
                    onChange={(v) => setPriv({ ...priv, pricesIncludeIva: v })}
                    label="El precio de venta ya incluye IVA"
                    hint={priv.pricesIncludeIva
                        ? 'La tienda cobra el precio de venta tal cual.'
                        : 'La tienda suma el IVA de cada producto (su % en inventario) al total del pedido.'}
                />
                <Toggle
                    checked={priv.facturaFiscal}
                    onChange={(v) => setPriv({ ...priv, facturaFiscal: v })}
                    label="Los pedidos web requieren factura fiscal"
                    hint="Se recuerda en Pedidos web al confirmar, para emitirla en la máquina fiscal o imprenta digital."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Tope de descuento (%)" hint="Máximo que pueden sumar las reglas mayoristas. Cada producto puede tener el suyo.">
                        <input className="field" type="number" min="0" max="100" step="0.5" value={priv.maxDiscountPct} onChange={(e) => setPriv({ ...priv, maxDiscountPct: e.target.value })} />
                    </Field>
                    <Field label="Margen mínimo sobre costo (%)" hint="Ningún descuento baja el precio de costo + este margen.">
                        <input className="field" type="number" min="0" step="0.5" value={priv.minMarginPct} onChange={(e) => setPriv({ ...priv, minMarginPct: e.target.value })} />
                    </Field>
                </div>
            </Section>

            <Section title="IGTF" hint="Impuesto a las grandes transacciones financieras en pagos con divisas. Déjalo en 0 si no aplica.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <Field label="IGTF (%)">
                        <input className="field" type="number" min="0" max="100" step="0.5" value={pub.igtfPct} onChange={(e) => setAt(['igtfPct'], e.target.value)} />
                    </Field>
                    <fieldset>
                        <legend className="eyebrow-label mb-2">Se cobra en</legend>
                        <div className="flex flex-wrap gap-2">
                            {IGTF_METHODS.map(([k, l]) => {
                                const on = pub.igtfMethods.includes(k);
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => setAt(['igtfMethods'], on ? pub.igtfMethods.filter((x) => x !== k) : [...pub.igtfMethods, k])}
                                        className={`h-9 px-3 rounded-lg border text-[13px] font-bold transition-colors ${on ? 'bg-primary-soft border-primary text-primary-hover' : 'bg-white border-line text-secondary hover:border-gray-300'}`}
                                    >
                                        {l}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>
                </div>
            </Section>

            <Section title="Métodos de pago" hint="Datos que ve el cliente al confirmar el pedido para pagar.">
                <div className="divide-y divide-line -my-5">
                    {Object.entries(PAYMENT_FIELDS).map(([key, def]) => {
                        const p = pub.payments[key] || { enabled: false };
                        return (
                            <div key={key} className="py-5 space-y-4">
                                <Toggle checked={!!p.enabled} onChange={(v) => setAt(['payments', key, 'enabled'], v)} label={def.label} />
                                {p.enabled && def.fields.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-[52px]">
                                        {def.fields.map(([f, label]) => (
                                            <Field key={f} label={label}>
                                                <input className="field" value={p[f] || ''} onChange={(e) => setAt(['payments', key, f], e.target.value)} />
                                            </Field>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Section>

            <Section title="Entrega" hint="Formas de entrega, zonas y tarifas de delivery en Maracaibo.">
                <Toggle checked={pub.delivery.retiro.enabled} onChange={(v) => setAt(['delivery', 'retiro', 'enabled'], v)} label="Retiro en tienda" />

                <div className="space-y-4">
                    <Toggle checked={pub.delivery.delivery.enabled} onChange={(v) => setAt(['delivery', 'delivery', 'enabled'], v)} label="Delivery por zonas" />
                    {pub.delivery.delivery.enabled && (
                        <div className="pl-[52px] space-y-4">
                            <div className="rounded-xl border border-line overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2.5">Zona</th>
                                            <th className="px-4 py-2.5 w-36">Tarifa (USD)</th>
                                            <th className="w-12" aria-label="Quitar" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {zones.length === 0 && (
                                            <tr><td colSpan="3" className="px-4 py-4 text-secondary">Sin zonas. Agrega la primera.</td></tr>
                                        )}
                                        {zones.map((z, i) => (
                                            <tr key={i}>
                                                <td className="px-2 py-1.5">
                                                    <input className="field h-10" aria-label={`Nombre de la zona ${i + 1}`} value={z.name} placeholder="Norte"
                                                        onChange={(e) => setZones(zones.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <input className="field h-10" aria-label={`Tarifa de la zona ${i + 1}`} type="number" min="0" step="0.5" value={z.feeUsd}
                                                        onChange={(e) => setZones(zones.map((x, j) => (j === i ? { ...x, feeUsd: e.target.value } : x)))} />
                                                </td>
                                                <td className="pr-2 text-right">
                                                    <button type="button" onClick={() => setZones(zones.filter((_, j) => j !== i))} className="p-2 rounded-lg text-secondary hover:text-danger hover:bg-red-50" aria-label={`Quitar zona ${z.name || i + 1}`}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-wrap items-end gap-4">
                                <button type="button" className="btn btn-outline" onClick={() => setZones([...zones, { name: '', feeUsd: 0 }])}>
                                    <Plus size={16} /> Agregar zona
                                </button>
                                <Field label="Delivery gratis desde (USD)" hint="0 = nunca gratis." className="w-56">
                                    <input className="field" type="number" min="0" step="1" value={pub.delivery.delivery.freeOverUsd} onChange={(e) => setAt(['delivery', 'delivery', 'freeOverUsd'], e.target.value)} />
                                </Field>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <Toggle checked={pub.delivery.envio_nacional.enabled} onChange={(v) => setAt(['delivery', 'envio_nacional', 'enabled'], v)} label="Envío nacional por encomienda" />
                    {pub.delivery.envio_nacional.enabled && (
                        <div className="pl-[52px] space-y-4">
                            <Field label="Cobro del envío">
                                <select className="field" value={pub.delivery.envio_nacional.mode} onChange={(e) => setAt(['delivery', 'envio_nacional', 'mode'], e.target.value)}>
                                    <option value="cobro_destino">Cobro en destino (lo paga el cliente al retirar)</option>
                                    <option value="incluido">Incluido en el precio</option>
                                </select>
                            </Field>
                            <div>
                                <span className="eyebrow-label block mb-2">Transportistas</span>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {(pub.delivery.envio_nacional.carriers || []).map((c) => (
                                        <span key={c} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-lg bg-gray-100 text-[13px] font-bold text-navy">
                                            {c}
                                            <button type="button" className="p-1 rounded-md hover:bg-gray-200 text-secondary" aria-label={`Quitar ${c}`}
                                                onClick={() => setAt(['delivery', 'envio_nacional', 'carriers'], pub.delivery.envio_nacional.carriers.filter((x) => x !== c))}>
                                                <Trash2 size={13} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2 max-w-sm">
                                    <input className="field" aria-label="Nuevo transportista" value={newCarrier} placeholder="Ej: Domesa"
                                        onChange={(e) => setNewCarrier(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCarrier(); } }} />
                                    <button type="button" className="btn btn-outline" onClick={addCarrier}><Plus size={16} />Agregar</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Section>

            <Section title="Crédito y reservas" hint="Plazos que puede elegir un mayorista aprobado y cuánto tiempo se apartan los productos.">
                <div>
                    <span className="eyebrow-label block mb-2">Plazos de crédito (días)</span>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {pub.creditDaysOptions.map((d) => (
                            <span key={d} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-lg bg-gray-100 text-[13px] font-bold text-navy tabular-nums">
                                {d === 0 ? 'Contado' : `${d} días`}
                                <button type="button" className="p-1 rounded-md hover:bg-gray-200 text-secondary" aria-label={`Quitar ${d} días`}
                                    onClick={() => setAt(['creditDaysOptions'], pub.creditDaysOptions.filter((x) => x !== d))}>
                                    <Trash2 size={13} />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2 max-w-xs">
                        <input className="field" type="number" min="0" aria-label="Nuevo plazo en días" value={newDays} placeholder="45"
                            onChange={(e) => setNewDays(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDays(); } }} />
                        <button type="button" className="btn btn-outline" onClick={addDays}><Plus size={16} />Agregar</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Reserva mientras paga (horas)" hint="Pago Móvil, transferencia, Zelle y Binance.">
                        <input className="field" type="number" min="1" value={pub.reservationHours} onChange={(e) => setAt(['reservationHours'], e.target.value)} />
                    </Field>
                    <Field label="Reserva pago en efectivo (horas)">
                        <input className="field" type="number" min="1" value={pub.cashReservationHours} onChange={(e) => setAt(['cashReservationHours'], e.target.value)} />
                    </Field>
                </div>
            </Section>

            <div className="sticky bottom-4 z-10 flex flex-col sm:flex-row sm:items-center justify-end gap-3 rounded-xl bg-white/95 border border-line shadow-lg px-4 py-3">
                {message && (
                    <p role="status" className={`text-[13.5px] font-semibold flex-1 ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>
                        {message.text}
                    </p>
                )}
                <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary shrink-0">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Guardando…' : 'Guardar tienda web'}
                </button>
            </div>
        </div>
    );
};

export default StoreSettingsPanel;
