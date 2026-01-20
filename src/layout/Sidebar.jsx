import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ArrowRightLeft, FileText, PieChart, Settings, LogOut, DollarSign } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const Sidebar = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState({
        storeName: 'Mi Negocio',
        adminName: 'Carlos Ruiz'
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/settings');
            if (response.ok) {
                const data = await response.json();
                setSettings({
                    storeName: data.storeName,
                    adminName: data.adminName
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
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
                fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Brand */}
                <div className="p-8 flex items-center justify-between border-b border-gray-100/50 pb-8">
                    <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
                        <span className="text-primary">{settings.storeName.split(' ')[0]}</span> {settings.storeName.split(' ').slice(1).join(' ')}
                    </h1>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 flex flex-col gap-2 overflow-y-auto">
                    <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={onClose} />
                    <NavItem to="/analytics" icon={<ArrowRightLeft size={20} />} label="Movimientos" onClick={onClose} />
                    <NavItem to="/daily-sales" icon={<DollarSign size={20} />} label="Ventas Diarias" onClick={onClose} />
                    <NavItem to="/invoices" icon={<FileText size={20} />} label="Facturas" onClick={onClose} />
                    <NavItem to="/calendar" icon={<FileText size={20} />} label="Calendario" onClick={onClose} />

                    {/* Divider or Spacer */}
                    <div className="flex-1"></div>

                    <NavItem to="/settings" icon={<Settings size={20} />} label="Configuración" onClick={onClose} />
                </nav>

                {/* User Profile */}
                <div className="p-4 mx-4 mb-4 rounded-2xl bg-gradient-to-br from-[#868CFF] to-[#4318FF] text-white shadow-2xl shadow-blue-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-white font-bold">
                            {settings.adminName ? settings.adminName.substring(0, 2).toUpperCase() : 'AD'}
                        </div>
                        <div>
                            <p className="text-sm font-bold">{settings.adminName}</p>
                            <p className="text-xs opacity-80">Configuración</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const NavItem = ({ to, icon, label, onClick }) => {
    return (
        <NavLink
            to={to}
            onClick={onClick}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 my-1 rounded-lg transition-all text-sm font-medium relative ${isActive
                    ? 'text-secondary font-bold'
                    : 'text-secondary opacity-60 hover:opacity-100 hover:bg-gray-50'
                }`
            }
        >
            {({ isActive }) => (
                <>
                    <span className={`${isActive ? 'text-primary' : ''}`}>
                        {icon}
                    </span>
                    <span className={`${isActive ? 'text-secondary' : ''}`}>
                        {label}
                    </span>
                    {isActive && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-l-lg"></div>
                    )}
                </>
            )}
        </NavLink>
    );
};

export default Sidebar;
