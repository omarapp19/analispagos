import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Package, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase, getSettingDoc } from '../supabase';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const [storeName, setStoreName] = useState('');

    useEffect(() => {
        getSettingDoc('global_settings').then((d) => d?.storeName && setStoreName(d.storeName)).catch(() => {});
    }, []);

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
            const { data: user, error: queryErr } = await supabase
                .from('users')
                .select('*')
                .eq('username', inputUser)
                .maybeSingle();

            if (queryErr) throw queryErr;

            if (user && user.password === password) {
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userRole', user.role);
                localStorage.setItem('adminUser', user.username);
                localStorage.setItem('userDisplayName', user.name);
                navigate(user.role === 'cajero' ? '/pos' : '/', { replace: true });
            } else {
                setError('Usuario o contraseña incorrectos. Revisa los datos e intenta de nuevo.');
            }
        } catch (err) {
            console.error('Error validating credentials:', err);
            setError('No pudimos conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-shell text-white relative overflow-hidden flex">
            {/* Atmosphere */}
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_30%_40%,#000_40%,transparent_100%)]" />
            <div aria-hidden className="pointer-events-none absolute -top-40 -left-20 w-[720px] h-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(47,100,245,0.42),transparent)]" />
            <div aria-hidden className="pointer-events-none absolute bottom-[-220px] right-[-120px] w-[640px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(31,192,232,0.18),transparent)]" />

            <div className="relative z-10 w-full max-w-[1200px] mx-auto px-5 sm:px-8 py-8 flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-16">
                {/* Message */}
                <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-[11px] flex items-center justify-center bg-[linear-gradient(135deg,#2F64F5,#1FC0E8)] shadow-[0_8px_20px_-8px_rgba(47,100,245,0.9)]">
                            <Package size={18} strokeWidth={2.4} />
                        </div>
                        <span className="font-extrabold text-[17px] tracking-[-0.01em] min-h-[1em]">{storeName}</span>
                    </div>

                    <h1 className="text-white mt-10 lg:mt-16 text-[34px] sm:text-[46px] lg:text-[54px] leading-[1.04] font-extrabold tracking-[-0.035em] max-w-[560px]">
                        Tu caja al día, en <span className="text-[#6FA0FF]">dólares</span> y <span className="text-[#5FD6F2]">bolívares</span>.
                    </h1>
                    <p className="mt-5 text-[16px] sm:text-[17px] leading-relaxed text-[#A9B6D9] max-w-[460px]">
                        Ventas, inventario, compras y cuentas por cobrar y pagar en un solo lugar, con la tasa BCV sincronizada todos los días.
                    </p>

                    <ul className="hidden lg:flex mt-10 gap-8 text-[14px] text-[#A9B6D9]">
                        {['Punto de venta', 'Inventario y kardex', 'Cuentas y vencimientos'].map((t) => (
                            <li key={t} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#4F86FF]" />{t}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Form */}
                <div className="w-full lg:w-[420px] flex-shrink-0">
                    <div className="bg-white text-navy rounded-3xl p-7 sm:p-8 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] animate-in">
                        <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">Iniciar sesión</h2>
                        <p className="text-[14.5px] text-secondary mt-1">Entra con el usuario que te asignó el administrador.</p>

                        <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
                            {error && (
                                <div role="alert" className="flex gap-2.5 p-3 rounded-xl bg-[#FDECEC] text-[#B42328] text-[13.5px] font-semibold animate-fade-in">
                                    <AlertCircle size={17} className="flex-shrink-0 mt-px" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div>
                                <label htmlFor="login-user" className="block text-[13.5px] font-semibold mb-1.5">Usuario</label>
                                <input
                                    id="login-user"
                                    type="text"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    required
                                    autoFocus
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="field h-12"
                                    placeholder="tu.usuario"
                                />
                            </div>

                            <div>
                                <label htmlFor="login-pass" className="block text-[13.5px] font-semibold mb-1.5">Contraseña</label>
                                <div className="relative">
                                    <input
                                        id="login-pass"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="field h-12 pr-12"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-secondary hover:text-navy hover:bg-gray-100"
                                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" disabled={loading || !username || !password} className="btn btn-primary w-full h-12 text-[15px] mt-2">
                                {loading ? <Loader2 size={17} className="animate-spin" /> : null}
                                {loading ? 'Verificando…' : 'Entrar'}
                                {!loading && <ArrowRight size={17} />}
                            </button>
                        </form>
                    </div>
                    <p className="mt-5 text-center text-[13px] text-[#7F8BB0]">¿Olvidaste tu contraseña? Pídele al administrador que la restablezca.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
