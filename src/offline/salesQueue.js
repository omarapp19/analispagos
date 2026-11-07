// Cola de ventas hechas sin conexión. Se guardan en IndexedDB y se envían en orden
// al RPC erp_create_invoice cuando vuelve internet.
import { kvGet, kvSet } from './idb.js';

const QUEUE_KEY = 'sales_queue';
const COUNTER_KEY = 'sales_offline_counter';
const listeners = new Set();
let syncing = false;

export const isNetworkError = (err) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    const msg = String(err?.message || err || '');
    return err?.status === 0 || /failed to fetch|networkerror|network request failed|load failed|timeout|fetch/i.test(msg);
};

export const getQueue = async () => (await kvGet(QUEUE_KEY)) || [];
const saveQueue = async (q) => { await kvSet(QUEUE_KEY, q); listeners.forEach((fn) => fn(q)); };

export const subscribeQueue = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const nextOfflineNumber = async () => {
    const n = ((await kvGet(COUNTER_KEY)) || 0) + 1;
    await kvSet(COUNTER_KEY, n);
    return `OFF-${String(n).padStart(6, '0')}`;
};

// Guarda la venta y devuelve una factura provisional con la forma que espera el recibo.
export const enqueueSale = async (payload, original) => {
    const invoiceNumber = payload.invoiceNumber || await nextOfflineNumber();
    const entry = { id: invoiceNumber, payload: { ...payload, invoiceNumber }, queuedAt: new Date().toISOString(), error: null };
    await saveQueue([...(await getQueue()), entry]);
    return {
        ...original,
        id: invoiceNumber,
        invoiceNumber,
        status: payload.isCredit ? 'PENDING' : 'PAID',
        createdAt: entry.queuedAt,
        offline: true
    };
};

// Envía la cola en orden. `send(payload)` debe lanzar si falla.
// Errores de red detienen el envío; errores de negocio (p. ej. sin stock) se marcan y se sigue.
export const syncQueue = async (send) => {
    if (syncing) return { sent: 0, failed: 0 };
    syncing = true;
    let sent = 0;
    try {
        const queue = await getQueue();
        const remaining = [];
        let stop = false;
        for (const entry of queue) {
            if (stop) { remaining.push(entry); continue; }
            try {
                await send(entry.payload);
                sent += 1;
            } catch (err) {
                if (isNetworkError(err)) { stop = true; remaining.push(entry); continue; }
                // Si el número ya existe, la venta ya llegó al servidor: se descarta de la cola.
                if (/ya existe|duplicate|already exists/i.test(String(err?.message || ''))) { sent += 1; continue; }
                remaining.push({ ...entry, error: err?.message || 'Error desconocido' });
            }
        }
        await saveQueue(remaining);
        return { sent, failed: remaining.filter((e) => e.error).length };
    } finally {
        syncing = false;
    }
};

export const discardEntry = async (id) => saveQueue((await getQueue()).filter((e) => e.id !== id));
