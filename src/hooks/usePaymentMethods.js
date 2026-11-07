import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { subscribeToTable } from '../supabase';

// Metodos de pago configurables (Configuracion > Metodos de pago), guardados en settings.global_settings.paymentMethods.
// currency: moneda en la que se recibe ('VES' bolivares, 'USD' dolares). Los montos de la base siempre estan en USD.
// cash: pide "monto recibido" y calcula el vuelto. discountPct: descuento que se aplica al elegir ese metodo.
export const DEFAULT_METHODS = [
    { name: 'Efectivo', currency: 'VES', enabled: true, discountPct: 0, cash: true, builtin: true },
    { name: 'Divisas', currency: 'USD', enabled: true, discountPct: 0, cash: true, builtin: true },
    { name: 'Pago Móvil', currency: 'VES', enabled: true, discountPct: 0, cash: false, builtin: true },
    { name: 'Tarjeta', currency: 'VES', enabled: true, discountPct: 0, cash: false, builtin: true },
    { name: 'Transferencia', currency: 'VES', enabled: true, discountPct: 0, cash: false, builtin: true },
];

export const normalizeMethods = (saved) => {
    if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_METHODS;
    const clean = saved
        .filter((m) => m && String(m.name || '').trim())
        .map((m) => ({
            name: String(m.name).trim(),
            currency: m.currency === 'USD' ? 'USD' : 'VES',
            enabled: m.enabled !== false,
            discountPct: Math.min(100, Math.max(0, Number(m.discountPct) || 0)),
            cash: !!m.cash,
            builtin: DEFAULT_METHODS.some((d) => d.name === String(m.name).trim()),
        }));
    // Los metodos de fabrica no se pierden: si faltan, se agregan desactivados.
    DEFAULT_METHODS.forEach((d) => { if (!clean.some((m) => m.name === d.name)) clean.push({ ...d, enabled: false }); });
    return clean;
};

let cache = null;
const listeners = new Set();
let started = false;
const emit = (list) => { cache = list; listeners.forEach((fn) => fn(list)); };
const load = () => api.getSettings('global_settings').then((d) => emit(normalizeMethods(d?.paymentMethods))).catch(() => {});

export const refreshPaymentMethods = load;

export function usePaymentMethods() {
    const [all, setAll] = useState(cache || DEFAULT_METHODS);
    useEffect(() => {
        if (!started) { started = true; load(); subscribeToTable('settings', load); }
        listeners.add(setAll);
        return () => listeners.delete(setAll);
    }, []);
    return {
        allMethods: all,
        methods: all.filter((m) => m.enabled),
        find: (name) => all.find((m) => m.name === name),
    };
}
