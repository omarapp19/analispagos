// Estado de sesión en memoria (NO en localStorage). Lo llena AuthProvider cuando carga el perfil
// desde staff_profiles. Los componentes que solo necesitan leer rol o nombre lo usan de forma síncrona.
// La seguridad real la da RLS en la base: alterar esto en el navegador no da acceso a datos.
let current = { userId: null, username: '', name: '', role: null };

export const setCurrentProfile = (profile) => {
    current = profile
        ? { userId: profile.userId, username: profile.username || '', name: profile.name || '', role: profile.role }
        : { userId: null, username: '', name: '', role: null };
};

export const getRole = () => current.role || 'cajero';
export const getUsername = () => current.username || '';
export const getDisplayName = (fallback = 'Usuario') => current.name || fallback;
export const getUserId = () => current.userId;
