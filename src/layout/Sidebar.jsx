import React, { useState, useEffect, useRef } from 'react';
import {
    LayoutDashboard, Settings, LogOut, Package, Receipt, Users, BarChart3,
    Boxes, ShoppingCart, Landmark, ChevronDown, X
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { subscribeToTable } from '../supabase';

export const logout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userRole');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('userDisplayName');
    window.location.href = '/login';
};

const roleLabel = { administrador: 'Administrador', supervisor: 'Supervisor', cajero: 'Cajero' };

const buildNav = ({ isAdmin, isManager }) => [
    isManager && { to: '/', icon: LayoutDashboard, label: 'Resumen', end: true },
    { to: '/pos', icon: Receipt, label: 'Punto de venta' },
    isManager && {
        id: 'ventas', icon: Users, label: 'Ventas',
        match: ['/ventas', '/finanzas/cuentas-por-cobrar'],
        children: [
            { to: '/ventas/clientes', label: 'Clientes' },
            { to: '/finanzas/cuentas-por-cobrar', label: 'Cuentas por cobrar' },
        ],
    },
    isManager && {
        id: 'inventario', icon: Boxes, label: 'Inventario',
        match: ['/inventory'],
        children: [
            { to: '/inventory', label: 'Productos', end: true },
            { to: '/inventory/kardex', label: 'Kardex' },
            isAdmin && { to: '/inventory/adjustments', label: 'Ajustes de stock' },
        ].filter(Boolean),
    },
    isManager && {
        id: 'compras', icon: ShoppingCart, label: 'Compras',
        match: ['/compras'],
        children: [
            { to: '/compras/facturas', label: 'Facturas y gastos' },
            { to: '/compras/nueva', label: 'Registrar compra' },
            { to: '/compras/proveedores', label: 'Proveedores' },
        ],
    },
    isManager && {
        id: 'finanzas', icon: Landmark, label: 'Finanzas',
        match: ['/finanzas/cuentas-por-pagar', '/calendar', '/investments'],
        children: [
            { to: '/finanzas/cuentas-por-pagar', label: 'Cuentas por pagar' },
            { to: '/calendar', label: 'Calendario de pagos' },
            { to: '/investments', label: 'Inversiones' },
        ],
    },
    isManager && { to: '/analytics', icon: BarChart3, label: 'Estadísticas' },
].filter(Boolean);

const groupForPath = (nav, path) =>
    nav.find((n) => n.children && n.match.some((m) => path === m || path.startsWith(m + '/')))?.id || null;

const Sidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const userRole = localStorage.getItem('userRole') || 'cajero';
    const userDisplayName = localStorage.getItem('userDisplayName') || 'Usuario';
    const isAdmin = userRole === 'administrador';
    const isManager = isAdmin || userRole === 'supervisor';
    const nav = buildNav({ isAdmin, isManager });

    const [storeName, setStoreName] = useState('Mi negocio');
    const [openGroup, setOpenGroup] = useState(() => groupForPath(nav, location.pathname));
    const [confirmOut, setConfirmOut] = useState(false);
    const confirmTimer = useRef(null);

    // Follow navigation: the active section opens itself, others close.
    useEffect(() => {
        const g = groupForPath(nav, location.pathname);
        if (g) setOpenGroup(g);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    useEffect(() => {
        let alive = true;
        api.getSettings('global_settings').then((data) => {
            if (alive && data?.storeName) setStoreName(data.storeName);
        });
        const unsub = subscribeToTable('settings', (payload) => {
            if (payload.new?.id === 'global_settings' && payload.new.data?.storeName) {
                setStoreName(payload.new.data.storeName);
            }
        });
        return () => { alive = false; unsub(); clearTimeout(confirmTimer.current); };
    }, []);

    const handleLogout = () => {
        if (confirmOut) return logout();
        setConfirmOut(true);
        clearTimeout(confirmTimer.current);
        confirmTimer.current = setTimeout(() => setConfirmOut(false), 3500);
    };

    const initials = userDisplayName.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase() || 'US';
    const activeGroup = groupForPath(nav, location.pathname);

    return (
        <>
            <div
                onClick={onClose}
                className={`fixed inset-0 z-40 bg-[rgba(10,17,40,0.5)] md:hidden transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden="true"
            />

            <aside
                className={`fixed inset-y-0 left-0 z-50 w-[264px] md:w-[248px] bg-shell text-white flex flex-col
                    transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                    md:static md:translate-x-0 md:h-screen
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                aria-label="Navegación principal"
            >
                {/* Brand */}
                <div className="h-16 px-5 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-[linear-gradient(135deg,#2F64F5,#1FC0E8)] shadow-[0_6px_16px_-6px_rgba(47,100,245,0.8)]">
                            <Package size={16} strokeWidth={2.4} />
                        </div>
                        <span className="font-extrabold text-[16px] tracking-[-0.01em] truncate">{storeName}</span>
                    </div>
                    <button onClick={onClose} className="md:hidden p-1.5 -mr-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10" aria-label="Cerrar menú">
                        <X size={18} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4 [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
                    <ul className="flex flex-col gap-1">
                        {nav.map((item) =>
                            item.children ? (
                                <li key={item.id}>
                                    <NavGroup
                                        item={item}
                                        open={openGroup === item.id}
                                        active={activeGroup === item.id}
                                        onToggle={() => setOpenGroup((g) => (g === item.id ? null : item.id))}
                                        onNavigate={onClose}
                                    />
                                </li>
                            ) : (
                                <li key={item.to}>
                                    <NavItem {...item} onClick={onClose} />
                                </li>
                            )
                        )}
                    </ul>
                </nav>

                {/* User */}
                <div className="p-3 border-t border-white/[0.07] flex-shrink-0">
                    <div className="flex items-center gap-3 p-2 rounded-xl">
                        <div className="w-9 h-9 rounded-full bg-shell-2 ring-1 ring-white/10 flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                            {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-bold leading-tight truncate">{userDisplayName}</p>
                            <p className="text-[12px] text-[#8E9AC0] leading-tight mt-0.5">{roleLabel[userRole] || userRole}</p>
                        </div>
                        {isAdmin && (
                            <NavLink
                                to="/settings"
                                onClick={onClose}
                                title="Configuración"
                                aria-label="Configuración"
                                className={({ isActive }) => `w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isActive ? 'bg-primary text-white' : 'text-[#8E9AC0] hover:text-white hover:bg-white/10'}`}
                            >
                                <Settings size={17} />
                            </NavLink>
                        )}
                    </div>
                    <button
                        onClick={handleLogout}
                        className={`mt-1 w-full h-9 rounded-lg flex items-center justify-center gap-2 text-[13px] font-semibold transition-colors ${
                            confirmOut ? 'bg-danger text-white' : 'text-[#8E9AC0] hover:text-white hover:bg-white/[0.06]'
                        }`}
                    >
                        <LogOut size={15} />
                        {confirmOut ? 'Toca de nuevo para salir' : 'Cerrar sesión'}
                    </button>
                </div>
            </aside>
        </>
    );
};

const rowBase = 'group w-full flex items-center gap-3 h-10 px-3 rounded-lg text-[14px] font-semibold transition-colors duration-150';

const NavItem = ({ to, icon: Icon, label, onClick, end }) => (
    <NavLink
        to={to}
        end={end}
        onClick={onClick}
        className={({ isActive }) =>
            `${rowBase} ${
                isActive
                    ? 'bg-primary text-white shadow-[0_6px_16px_-8px_rgba(47,100,245,0.9)]'
                    : 'text-[#B4BDD8] hover:text-white hover:bg-white/[0.06]'
            }`
        }
    >
        {({ isActive }) => (
            <>
                <Icon size={18} strokeWidth={2} className={isActive ? 'text-white' : 'text-[#7F8BB0] group-hover:text-white transition-colors'} />
                <span className="truncate">{label}</span>
            </>
        )}
    </NavLink>
);

const NavGroup = ({ item, open, active, onToggle, onNavigate }) => {
    const Icon = item.icon;
    const panelId = `nav-${item.id}`;
    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls={panelId}
                className={`${rowBase} ${active ? 'text-white' : 'text-[#B4BDD8] hover:text-white hover:bg-white/[0.06]'} ${active && !open ? 'bg-white/[0.06]' : ''}`}
            >
                <Icon size={18} strokeWidth={2} className={active ? 'text-[#6FA0FF]' : 'text-[#7F8BB0] group-hover:text-white transition-colors'} />
                <span className="flex-1 text-left truncate">{item.label}</span>
                <ChevronDown
                    size={15}
                    className={`text-[#7F8BB0] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Height animates via grid rows; content stays in the DOM for a smooth close */}
            <div
                id={panelId}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
                <ul className="overflow-hidden min-h-0" inert={!open ? '' : undefined}>
                    <div className="relative ml-[21px] pl-3 py-1 border-l border-white/[0.09] flex flex-col gap-0.5">
                        {item.children.map((c) => (
                            <li key={c.to}>
                                <NavLink
                                    to={c.to}
                                    end={c.end}
                                    onClick={onNavigate}
                                    className={({ isActive }) =>
                                        `relative flex items-center h-9 px-3 rounded-lg text-[13.5px] font-semibold transition-colors duration-150 ${
                                            isActive
                                                ? 'bg-primary text-white shadow-[0_6px_16px_-8px_rgba(47,100,245,0.9)]'
                                                : 'text-[#98A3C4] hover:text-white hover:bg-white/[0.06]'
                                        }`
                                    }
                                >
                                    {c.label}
                                </NavLink>
                            </li>
                        ))}
                    </div>
                </ul>
            </div>
        </div>
    );
};

export default Sidebar;
