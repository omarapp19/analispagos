import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { subscribeToTable } from '../supabase';
import { kvGet, kvSet } from '../offline/idb';

// Estado de la caja: 'unknown' (aun no se sabe) | 'open' | 'closed'.
// Se actualiza solo: Realtime (cuando un administrador la abre o cierra desde otro equipo), cada 20 s y al volver internet.
// Sin conexion se conserva el ultimo estado conocido. El servidor es quien manda: un cajero no puede facturar con la caja cerrada.
export function useCashStatus() {
    const [state, setState] = useState({ status: 'unknown', session: null });
    const alive = useRef(true);

    const refresh = useCallback(async () => {
        try {
            const session = await api.getCashSession();
            const next = { status: session ? 'open' : 'closed', session: session || null };
            if (alive.current) setState(next);
            kvSet('cache_cash_state', next);
        } catch {
            // Sin red o sin la migracion: se queda con el ultimo estado conocido.
            const cached = await kvGet('cache_cash_state');
            if (alive.current && cached) setState((prev) => (prev.status === 'unknown' ? cached : prev));
        }
    }, []);

    useEffect(() => {
        alive.current = true;
        refresh();
        const unsub = subscribeToTable('cash_sessions', refresh);
        const timer = setInterval(refresh, 20000);
        window.addEventListener('online', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            alive.current = false;
            unsub();
            clearInterval(timer);
            window.removeEventListener('online', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [refresh]);

    return { ...state, refresh };
}
