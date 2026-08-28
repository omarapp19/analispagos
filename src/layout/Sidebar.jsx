import React, { useState, useEffect } from 'react';
import { 
    LayoutDashboard, FileText, Settings, LogOut, Calendar, Package, 
    Receipt, ChevronDown, ChevronRight, Users, Coins, Layers, ClipboardList, Briefcase,
    BarChart3
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { db } from '../firebase'; 
import { doc, onSnapshot } from 'firebase/firestore';

const Sidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    
    // User Session States
    const userRole = localStorage.getItem('userRole') || 'cajero';
    const userDisplayName = localStorage.getItem('userDisplayName') || 'Usuario';
    const username = localStorage.getItem('adminUser') || 'usuario';

    const [settings, setSettings] = useState({
        storeName: 'ANÁLISIS PAGOS',
    });

    // Submenu toggles
    const [comprasOpen, setComprasOpen] = useState(false);
    const [inventarioOpen, setInventarioOpen] = useState(false);
    const [finanzasOpen, setFinanzasOpen] = useState(false);

    useEffect(() => {
        // Suscribirse a cambios en tiempo real
        const unsub = onSnapshot(doc(db, 'settings', 'global_settings'), (doc) => {
            if (doc.exists()) {
                setSettings(doc.data());
            }
        });
        return () => unsub();
    }, []);

    // Auto-open parent accordion if subroute is active
    useEffect(() => {
        if (location.pathname.startsWith('/compras')) {
            setComprasOpen(true);
        }
        if (location.pathname.startsWith('/inventory')) {
            setInventarioOpen(true);
        }
        if (location.pathname.startsWith('/finanzas')) {
            setFinanzasOpen(true);
        }
    }, [location.pathname]);

    const handleLogout = () => {
        if (window.confirm('¿Cerrar sesión en el sistema?')) {
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('userRole');
            localStorage.removeItem('adminUser');
            localStorage.removeItem('userDisplayName');
            window.location.href = '/login';
        }
    };

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden glass"
                    onClick={onClose}
                ></div>
            )}

            <div className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen flex flex-col
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Brand */}
                <div className="p-6 flex items-center justify-between border-b border-gray-100/50 pb-6">
                    <h1 className="text-xl font-bold text-navy flex items-center gap-2 truncate">
                        <span className="text-primary truncate">{settings.storeName}</span>
                    </h1>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto font-sans">
                    
                    {/* 1. Dashboard (Admin and Supervisor only) */}
                    {(userRole === 'administrador' || userRole === 'supervisor') && (
                        <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={onClose} end />
                    )}

                    {/* 1b. Estadísticas (Admin and Supervisor only) */}
                    {(userRole === 'administrador' || userRole === 'supervisor') && (
                        <NavItem to="/analytics" icon={<BarChart3 size={18} />} label="Estadísticas" onClick={onClose} />
                    )}

                    {/* 2. POS (All roles) */}
                    <NavItem to="/pos" icon={<Receipt size={18} />} label="POS" onClick={onClose} />

                    {/* 3. Inventario Submenu (Admin and Supervisor) */}
                    {(userRole === 'administrador' || userRole === 'supervisor') && (
                        <div className="flex flex-col">
                            <button
                                onClick={() => setInventarioOpen(!inventarioOpen)}
                                className={`flex items-center justify-between w-full px-4 py-2.5 my-0.5 rounded-lg text-[15px] font-bold transition-all text-slate-700 hover:bg-slate-50/70 ${
                                    location.pathname.startsWith('/inventory') ? 'text-primary font-extrabold bg-teal-50/30' : ''
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Package size={18} className={location.pathname.startsWith('/inventory') ? 'text-primary' : ''} />
                                    <span>Inventario</span>
                                </div>
                                {inventarioOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            {inventarioOpen && (
                                <div className="pl-6 flex flex-col gap-0.5 border-l-2 border-gray-100 ml-6 mt-0.5 mb-1 animate-in slide-in-from-top-1 duration-150">
                                    <SubNavItem to="/inventory" label="Productos" onClick={onClose} end />
                                    {userRole === 'administrador' && (
                                        <SubNavItem to="/inventory/adjustments" label="Ajuste Inventario" onClick={onClose} />
                                    )}
                                    <SubNavItem to="/inventory/kardex" label="Kardex Inventario" onClick={onClose} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. Compras Submenu (Admin and Supervisor) */}
                    {(userRole === 'administrador' || userRole === 'supervisor') && (
                        <div className="flex flex-col">
                            <button
                                onClick={() => setComprasOpen(!comprasOpen)}
                                className={`flex items-center justify-between w-full px-4 py-2.5 my-0.5 rounded-lg text-[15px] font-bold transition-all text-slate-700 hover:bg-slate-50/70 ${
                                    location.pathname.startsWith('/compras') ? 'text-primary font-extrabold bg-teal-50/30' : ''
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Briefcase size={18} className={location.pathname.startsWith('/compras') ? 'text-primary' : ''} />
                                    <span>Compras</span>
                                </div>
                                {comprasOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            {comprasOpen && (
                                <div className="pl-6 flex flex-col gap-0.5 border-l-2 border-gray-100 ml-6 mt-0.5 mb-1 animate-in slide-in-from-top-1 duration-150">
                                    <SubNavItem to="/compras/proveedores" label="Proveedores" onClick={onClose} />
                                    <SubNavItem to="/compras/facturas" label="Facturas" onClick={onClose} />
                                    <SubNavItem to="/compras/nueva" label="Nueva Compra" onClick={onClose} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* 5. Ventas Submenu (Admin and Supervisor) */}
                    {(userRole === 'administrador' || userRole === 'supervisor') && (
                        <div className="flex flex-col">
                            <NavItem to="/ventas/clientes" icon={<Users size={18} />} label="Clientes" onClick={onClose} />
                        </div>
                    )}

                    {/* 6. Calendario (Admin and Supervisor) */}
                    {(userRole === 'administrador' || userRole === 'supervisor') && (
                        <NavItem to="/calendar" icon={<Calendar size={18} />} label="Calendario" onClick={onClose} />
                    )}

                    {/* 7. Finanzas Submenu (Admin and Supervisor) */}
                    {(userRole === 'administrador' || userRole === 'supervisor') && (
                        <div className="flex flex-col">
                            <button
                                onClick={() => setFinanzasOpen(!finanzasOpen)}
                                className={`flex items-center justify-between w-full px-4 py-2.5 my-0.5 rounded-lg text-[15px] font-bold transition-all text-slate-700 hover:bg-slate-50/70 ${
                                    location.pathname.startsWith('/finanzas') ? 'text-primary font-extrabold bg-teal-50/30' : ''
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Coins size={18} className={location.pathname.startsWith('/finanzas') ? 'text-primary' : ''} />
                                    <span>Finanzas</span>
                                </div>
                                {finanzasOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            {finanzasOpen && (
                                <div className="pl-6 flex flex-col gap-0.5 border-l-2 border-gray-100 ml-6 mt-0.5 mb-1 animate-in slide-in-from-top-1 duration-150">
                                    <SubNavItem to="/finanzas/cuentas-por-cobrar" label="Cuentas por Cobrar" onClick={onClose} />
                                    <SubNavItem to="/finanzas/cuentas-por-pagar" label="Cuentas por Pagar" onClick={onClose} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Spacer */}
                    <div className="flex-1"></div>
                    
                    {/* Logout item for mobile/cajeros when profile card is not visible or as backup */}
                    {userRole === 'cajero' && (
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-2.5 my-1 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50/50 cursor-pointer w-full text-left transition-all"
                        >
                            <LogOut size={18} />
                            <span>Cerrar Sesión</span>
                        </button>
                    )}
                </nav>

                {/* User Profile Card */}
                {userRole === 'administrador' ? (
                    <NavLink 
                        to="/settings"
                        onClick={onClose}
                        className="p-4 mx-4 mb-4 rounded-2xl bg-gradient-to-br from-[#868CFF] to-[#4318FF] text-white shadow-2xl shadow-blue-500/30 relative overflow-hidden block hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer group"
                    >
                        <div className="absolute top-0 right-0 w-20 h-20 bg-white opacity-[0.08] rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform duration-350"></div>
                        
                        <div className="flex items-center justify-between relative z-10 gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-white font-black text-sm shadow-inner flex-shrink-0">
                                    {userDisplayName ? userDisplayName.substring(0, 2).toUpperCase() : 'AD'}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-white leading-tight truncate">{userDisplayName}</p>
                                    <p className="text-[9px] text-white/80 font-medium tracking-wide mt-0.5 uppercase">
                                        Administrador
                                    </p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:bg-white/20 transition-all duration-300 flex-shrink-0">
                                <Settings size={15} className="transition-transform duration-500 ease-out group-hover:rotate-90 text-white" />
                            </div>
                        </div>
                    </NavLink>
                ) : (
                    /* Simple Supervisor profile layout with logout button */
                    userRole !== 'cajero' && (
                        <div className="p-4 mx-4 mb-4 rounded-2xl bg-slate-50 border border-gray-100 flex flex-col gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-navy font-black text-sm shadow-sm flex-shrink-0">
                                    {userDisplayName.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-navy leading-tight truncate">{userDisplayName}</p>
                                    <p className="text-[8px] text-secondary font-black tracking-wide mt-0.5 uppercase opacity-65">
                                        {userRole}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="w-full py-1.5 bg-rose-50 hover:bg-rose-100/50 text-rose-600 rounded-xl text-xs font-bold transition-all border border-rose-100 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <LogOut size={12} />
                                Cerrar Sesión
                            </button>
                        </div>
                    )
                )}
            </div>
        </>
    );
};

const NavItem = ({ to, icon, label, onClick, end }) => {
    return (
        <NavLink
            to={to}
            onClick={onClick}
            end={end}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 my-0.5 rounded-lg transition-all text-[15px] font-bold relative ${isActive
                    ? 'text-primary font-extrabold bg-teal-50/40 shadow-sm'
                    : 'text-slate-700 hover:bg-slate-50/70 hover:text-navy'
                }`
            }
        >
            {({ isActive }) => (
                <>
                    <span className={`${isActive ? 'text-primary' : 'text-slate-500'}`}>
                        {icon}
                    </span>
                    <span>
                        {label}
                    </span>
                    {isActive && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-l-lg"></div>
                    )}
                </>
            )}
        </NavLink>
    );
};

const SubNavItem = ({ to, label, onClick, end }) => {
    return (
        <NavLink
            to={to}
            onClick={onClick}
            end={end}
            className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 my-0.5 rounded-md transition-all text-sm font-bold relative ${isActive
                    ? 'text-primary font-extrabold bg-teal-50/20'
                    : 'text-slate-600 hover:bg-slate-50/45 hover:text-navy'
                }`
            }
        >
            {({ isActive }) => (
                <>
                    <span className={`w-1.5 h-1.5 rounded-full transition-transform ${isActive ? 'bg-primary scale-125' : 'bg-slate-400 opacity-60'}`}></span>
                    <span>{label}</span>
                </>
            )}
        </NavLink>
    );
};

export default Sidebar;
