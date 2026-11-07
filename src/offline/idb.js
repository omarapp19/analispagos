// Almacén clave-valor mínimo sobre IndexedDB (sin dependencias).
// Si IndexedDB no está disponible, todas las operaciones fallan en silencio.
const DB_NAME = 'analispagos-offline';
const STORE = 'kv';

let dbPromise = null;
const openDb = () => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible'));
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    return dbPromise;
};

const run = async (mode, fn) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
};

// Sin IndexedDB (modo privado, pruebas) se usa memoria: la app sigue funcionando, aunque no persista.
const mem = new Map();
const hasIdb = () => typeof indexedDB !== 'undefined';

export const kvGet = async (key) => {
    if (!hasIdb()) return mem.get(key);
    try { return await run('readonly', (s) => s.get(key)); } catch { return mem.get(key); }
};
export const kvSet = async (key, value) => {
    mem.set(key, value);
    if (!hasIdb()) return;
    try { await run('readwrite', (s) => s.put(value, key)); } catch (e) { console.warn('kvSet falló', key, e); }
};
export const kvDelete = async (key) => {
    mem.delete(key);
    if (!hasIdb()) return;
    try { await run('readwrite', (s) => s.delete(key)); } catch { /* noop */ }
};
