import { createClient } from '@supabase/supabase-js';
import { kvGet, kvSet } from './offline/idb';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn(
        "⚠️ Configuración de Supabase incompleta: Asegúrate de definir VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env"
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper para obtener documentos de configuración (equivalente a doc(db, 'settings', key))
 */
export async function getSettingDoc(id) {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('data')
            .eq('id', id)
            .single();

        if (error) {
            console.error(`Error loading setting "${id}":`, error);
            return (await kvGet(`cache_setting_${id}`)) || null;
        }
        if (data?.data) kvSet(`cache_setting_${id}`, data.data);
        return data?.data || null;
    } catch (err) {
        console.error(`Unexpected error getting setting "${id}":`, err);
        return (await kvGet(`cache_setting_${id}`)) || null;
    }
}

/**
 * Helper para guardar/actualizar configuraciones
 */
export async function setSettingDoc(id, value) {
    try {
        const { data: existing } = await supabase
            .from('settings')
            .select('data')
            .eq('id', id)
            .single();

        const mergedData = existing?.data ? { ...existing.data, ...value } : value;

        const { error } = await supabase
            .from('settings')
            .upsert({
                id,
                data: mergedData,
                updatedAt: new Date().toISOString()
            });

        if (error) {
            console.error(`Error updating setting "${id}":`, error);
            throw error;
        }
        return mergedData;
    } catch (err) {
        console.error(`Unexpected error saving setting "${id}":`, err);
        throw err;
    }
}

/**
 * Helper para suscribirse a cambios de una tabla o fila en Realtime
 */
export function subscribeToTable(table, onEvent) {
    const channelId = `${table}_changes_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
        .channel(channelId)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            (payload) => {
                if (onEvent) onEvent(payload);
            }
        )
        .subscribe((status, err) => {
            if (err) {
                console.warn(`Error en canal realtime para ${table}:`, err);
            }
        });

    return () => {
        try {
            supabase.removeChannel(channel);
        } catch (e) {
            console.warn(`Error al remover canal para ${table}:`, e);
        }
    };
}
