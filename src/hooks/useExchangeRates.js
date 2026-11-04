import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { subscribeToTable } from '../supabase';

// Shared, module-level cache so every component that shows a Bs
// equivalent reads the same rate without refetching.
let cache = null;
const listeners = new Set();
let started = false;

const emit = (rates) => {
    cache = rates;
    listeners.forEach((fn) => fn(rates));
};

const start = () => {
    if (started) return;
    started = true;
    api.getSettings('exchange_rates')
        .then((data) => { if (data) emit(data); })
        .catch(() => {});
    subscribeToTable('settings', (payload) => {
        if (payload?.new?.id === 'exchange_rates' && payload.new.data) {
            emit(payload.new.data);
        }
    });
};

export function useExchangeRates() {
    const [rates, setRates] = useState(cache);

    useEffect(() => {
        start();
        listeners.add(setRates);
        if (cache) setRates(cache);
        return () => listeners.delete(setRates);
    }, []);

    return rates;
}

export const formatUSD = (amount = 0) =>
    new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(amount) || 0);

export const formatBs = (amount = 0) =>
    'Bs ' +
    new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
