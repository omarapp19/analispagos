import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { setCurrentProfile } from './session';

const AuthContext = createContext(null);

export const staffEmail = (username) => `${String(username).trim().toLowerCase()}@staff.valkar.local`;

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Sesión de Supabase Auth. El callback no hace llamadas a la base (evita bloqueos del cliente).
    useEffect(() => {
        let active = true;
        supabase.auth.getSession().then(({ data }) => {
            if (!active) return;
            setSession(data.session ?? null);
            if (!data.session) setLoading(false);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(next ?? null);
            if (!next) {
                setProfile(null);
                setCurrentProfile(null);
                setLoading(false);
            }
        });
        return () => { active = false; sub.subscription.unsubscribe(); };
    }, []);

    // El rol sale de staff_profiles (protegido por RLS), nunca del navegador.
    const userId = session?.user?.id;
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        setLoading(true);
        supabase
            .from('staff_profiles')
            .select('userId, username, name, role, active')
            .eq('userId', userId)
            .maybeSingle()
            .then(async ({ data, error }) => {
                if (cancelled) return;
                if (error || !data || !data.active) {
                    // Cuenta de Auth sin perfil activo de personal: no es del ERP.
                    await supabase.auth.signOut();
                    setProfile(null);
                    setCurrentProfile(null);
                } else {
                    setCurrentProfile(data);
                    setProfile(data);
                }
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [userId]);

    const signIn = useCallback(async (username, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: staffEmail(username), password });
        if (error) throw error;
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setCurrentProfile(null);
    }, []);

    const value = useMemo(() => ({ session, profile, loading, signIn, signOut }), [session, profile, loading, signIn, signOut]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
    return ctx;
};
