import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, Loader2, Landmark } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    // Check if already authenticated on mount
    useEffect(() => {
        if (localStorage.getItem('isAuthenticated') === 'true') {
            navigate('/', { replace: true });
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const inputUser = username.trim().toLowerCase();

        try {
            // Live query to Firestore document settings/auth_credentials
            const authRef = doc(db, 'settings', 'auth_credentials');
            const docSnap = await getDoc(authRef);
            
            let credentials;
            if (docSnap.exists()) {
                credentials = docSnap.data();
            } else {
                // Initialize default single-user auth credentials if they don't exist yet
                const defaultCreds = {
                    username: 'omar',
                    password: 'omar123'
                };
                await setDoc(authRef, defaultCreds);
                credentials = defaultCreds;
            }

            const dbUser = credentials.username.trim().toLowerCase();

            if (inputUser === dbUser && password === credentials.password) {
                // Simulated latency for premium UX feel
                await new Promise(resolve => setTimeout(resolve, 800));
                
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('adminUser', dbUser);
                navigate('/', { replace: true });
            } else {
                setError('Usuario o contraseña incorrectos. Intente de nuevo.');
            }
        } catch (err) {
            console.error("Error validating credentials:", err);
            setError('Error de conexión con la base de datos. Intente de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900 overflow-hidden font-sans">
            
            {/* STUNNING PREMIUM BACKGROUND DECORATIVE GLOWS */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-primary/20 via-blue-500/5 to-transparent rounded-full filter blur-[80px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-teal-500/10 via-primary/5 to-transparent rounded-full filter blur-[80px] pointer-events-none"></div>
            
            {/* Grid structure background lines for corporate feel */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35"></div>

            {/* LOGIN GLASSMORPHIC CARD */}
            <div className="bg-slate-950/40 border border-slate-800/80 p-8 sm:p-10 rounded-3xl w-full max-w-md shadow-2xl backdrop-blur-xl relative z-10 animate-in zoom-in-95 duration-300 mx-4 flex flex-col items-center">
                
                {/* Brand / Logo */}
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-500/25 mb-6 hover:scale-105 active:scale-95 transition-transform duration-350">
                    <Landmark size={28} className="animate-pulse" />
                </div>

                {/* Greeting Headers */}
                <h2 className="text-xl sm:text-2xl font-black text-white text-center">Panel de Administración</h2>
                <p className="text-xs text-slate-400 text-center mt-1.5 leading-relaxed max-w-[280px]">
                    Ingresa tus credenciales personales para acceder al control de caja.
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="w-full mt-8 space-y-5">
                    {error && (
                        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold text-center animate-in fade-in-50 slide-in-from-top-1 duration-200">
                            {error}
                        </div>
                    )}
                    
                    {/* Username Input */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Usuario *</label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-3.5 bg-slate-900/60 rounded-xl border border-slate-800 focus:border-primary outline-none font-bold text-white text-sm transition-all focus:ring-1 focus:ring-primary/30"
                                placeholder="Ingresa tu usuario..."
                            />
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Contraseña *</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-12 py-3.5 bg-slate-900/60 rounded-xl border border-slate-800 focus:border-primary outline-none font-bold text-white text-sm transition-all focus:ring-1 focus:ring-primary/30"
                                placeholder="••••••••"
                            />
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            
                            {/* Toggle Show/Hide password */}
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-800/50 rounded-lg text-slate-500 hover:text-white transition-colors cursor-pointer"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 mt-4 bg-gradient-to-r from-primary to-teal-500 hover:from-teal-500 hover:to-primary text-white font-extrabold text-sm rounded-xl shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-75 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                        {loading ? 'Iniciando Sesión...' : 'Ingresar al Dashboard'}
                    </button>
                </form>
            </div>
            
            {/* Subtle footer */}
            <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-slate-600 font-medium">
                Acceso Privado Administrador • Conexión Segura SSL
            </div>
        </div>
    );
};

export default Login;
