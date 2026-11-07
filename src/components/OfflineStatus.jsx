import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { getQueue, subscribeQueue, syncQueue, discardEntry } from '../offline/salesQueue';

// Barra fija: avisa si no hay conexión y muestra las ventas pendientes de sincronizar.
export default function OfflineStatus() {
    const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
    const [queue, setQueue] = useState([]);
    const [busy, setBusy] = useState(false);

    const sync = useCallback(async () => {
        setBusy(true);
        try { await syncQueue(api.sendQueuedInvoice); } finally { setBusy(false); }
    }, []);

    useEffect(() => {
        getQueue().then(setQueue);
        const unsub = subscribeQueue(setQueue);
        const goOnline = () => { setOnline(true); sync(); };
        const goOffline = () => setOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        if (navigator.onLine) sync();
        return () => { unsub(); window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
    }, [sync]);

    const failed = queue.filter((e) => e.error);
    if (online && queue.length === 0) return null;

    return (
        <div className="no-print" style={{
            position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
            background: online ? '#92400e' : '#991b1b', color: '#fff', padding: '8px 14px',
            borderRadius: 10, fontSize: 13, boxShadow: '0 4px 14px rgba(0,0,0,.3)', maxWidth: '92vw'
        }}>
            <span>
                {!online && 'Sin conexión · '}
                {queue.length > 0 ? `${queue.length} venta(s) pendiente(s) de sincronizar` : 'Modo sin conexión: las ventas se guardan en este equipo'}
                {failed.length > 0 && ` · ${failed.length} con error`}
            </span>
            {online && queue.length > 0 && (
                <button onClick={sync} disabled={busy} style={{ marginLeft: 10, background: '#fff', color: '#111', borderRadius: 6, padding: '2px 10px', fontWeight: 600 }}>
                    {busy ? 'Sincronizando…' : 'Sincronizar'}
                </button>
            )}
            {failed.map((e) => (
                <div key={e.id} style={{ marginTop: 4, fontSize: 12 }}>
                    {e.id}: {e.error}
                    <button onClick={() => discardEntry(e.id)} style={{ marginLeft: 8, textDecoration: 'underline' }}>descartar</button>
                </div>
            ))}
        </div>
    );
}
