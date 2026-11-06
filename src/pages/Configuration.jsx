import React, { useState, useEffect } from 'react';
import { Save, Building2, User, FileText, Phone, MapPin, Lock, LogOut, Plus, Trash2, Edit2, Shield } from 'lucide-react';
import { api } from '../services/api';
import { supabase } from '../supabase';
import { getRole, getUsername } from '../auth/session';
import StoreSettingsPanel from '../components/store/StoreSettingsPanel';

const TABS = [
    ['general', 'Datos del Comercio'],
    ['users', 'Gestión de Usuarios y Roles'],
    ['tienda', 'Tienda web'],
];

const Configuration = () => {
    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'users' | 'tienda'
    
    // Check role
    const currentUserRole = getRole();
    const currentUsername = getUsername();

    // Settings State
    const [settings, setSettings] = useState({
        storeName: 'Galpon',
        adminName: 'Omar Pérez',
        storeTaxId: 'J-12345678-9',
        storePhone: '0212-5555555',
        storeAddress: 'Caracas, Venezuela',
        includeDivisas: false 
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Users Management State
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({
        username: '',
        name: '',
        password: '',
        role: 'cajero'
    });
    const [savingUser, setSavingUser] = useState(false);
    const [userError, setUserError] = useState(null);

    useEffect(() => {
        fetchSettings();
        if (currentUserRole === 'administrador') {
            fetchUsers();
        }
    }, [currentUserRole]);

    const fetchSettings = async () => {
        try {
            const data = await api.getSettings('global_settings');
            if (data) {
                setSettings(data);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (err) {
            console.error("Error fetching users:", err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await api.updateSettings('global_settings', settings);
            setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage({ type: 'error', text: 'Error al conectar con la base de datos' });
        } finally {
            setSaving(false);
        }
    };

    const handleBulkImport = async () => {
        if (!window.confirm('¿Estás seguro de importar los datos históricos? Esto agregará múltiples transacciones.')) return;

        setSaving(true);
        setMessage({ type: 'info', text: 'Importando datos..., por favor espera.' });

        const historicalData = [
            { "date": "2026-01-01", "sales": [] },
            { "date": "2026-01-02", "sales": [{ "method": "Efectivo", "amount": 224.54 }, { "method": "Tarjeta", "amount": 1782.9 }, { "method": "Pago Móvil", "amount": 217.58 }, { "method": "Transferencia", "amount": 46.0 }, { "method": "divisas", "amount": 552.0 }] },
            { "date": "2026-01-03", "sales": [{ "method": "Efectivo", "amount": 200.47 }, { "method": "Tarjeta", "amount": 3470.26 }, { "method": "Pago Móvil", "amount": 1305.39 }, { "method": "divisas", "amount": 1155.91 }] },
            { "date": "2026-01-04", "sales": [{ "method": "Efectivo", "amount": 212.26 }, { "method": "Tarjeta", "amount": 1823.4 }, { "method": "Pago Móvil", "amount": 198.25 }, { "method": "divisas", "amount": 244.06 }] },
            { "date": "2026-01-05", "sales": [{ "method": "Efectivo", "amount": 227.88 }, { "method": "Tarjeta", "amount": 1000.35 }, { "method": "Pago Móvil", "amount": 142.6 }, { "method": "divisas", "amount": 269.0 }] },
            { "date": "2026-01-06", "sales": [{ "method": "Efectivo", "amount": 263.93 }, { "method": "Tarjeta", "amount": 1427.09 }, { "method": "Pago Móvil", "amount": 243.37 }, { "method": "divisas", "amount": 460.44 }] },
            { "date": "2026-01-07", "sales": [{ "method": "Efectivo", "amount": 110.4 }, { "method": "Tarjeta", "amount": 751.8 }, { "method": "Pago Móvil", "amount": 144.71 }, { "method": "divisas", "amount": 134.0 }] },
            { "date": "2026-01-08", "sales": [{ "method": "Efectivo", "amount": 29.72 }, { "method": "Tarjeta", "amount": 941.07 }, { "method": "Pago Móvil", "amount": 190.28 }, { "method": "Transferencia", "amount": 46.0 }, { "method": "divisas", "amount": 201.18 }] },
            { "date": "2026-01-09", "sales": [{ "method": "Efectivo", "amount": 40.6 }, { "method": "Tarjeta", "amount": 688.76 }, { "method": "Pago Móvil", "amount": 83.22 }, { "method": "divisas", "amount": 69.0 }] },
            { "date": "2026-01-10", "sales": [{ "method": "Efectivo", "amount": 46.64 }, { "method": "Tarjeta", "amount": 373.23 }, { "method": "Pago Móvil", "amount": 101.25 }, { "method": "divisas", "amount": 27.0 }] },
            { "date": "2026-01-11", "sales": [{ "method": "Efectivo", "amount": 71.49 }, { "method": "Tarjeta", "amount": 1230.09 }, { "method": "Pago Móvil", "amount": 166.97 }, { "method": "divisas", "amount": 307.0 }] },
            { "date": "2026-01-12", "sales": [{ "method": "Efectivo", "amount": 87.26 }, { "method": "Tarjeta", "amount": 711.5 }, { "method": "Pago Móvil", "amount": 191.9 }, { "method": "divisas", "amount": 48.0 }] },
            { "date": "2026-01-13", "sales": [{ "method": "Efectivo", "amount": 75.16 }, { "method": "Tarjeta", "amount": 372.38 }, { "method": "Pago Móvil", "amount": 79.88 }, { "method": "Transferencia", "amount": 96.0 }, { "method": "divisas", "amount": 176.0 }] },
            { "date": "2026-01-14", "sales": [{ "method": "Efectivo", "amount": 84.38 }, { "method": "Tarjeta", "amount": 397.66 }, { "method": "Pago Móvil", "amount": 100.15 }, { "method": "divisas", "amount": 183.0 }] },
            { "date": "2026-01-15", "sales": [{ "method": "Efectivo", "amount": 53.78 }, { "method": "Tarjeta", "amount": 663.98 }, { "method": "Pago Móvil", "amount": 187.25 }, { "method": "divisas", "amount": 275.0 }] },
            { "date": "2026-01-16", "sales": [{ "method": "Efectivo", "amount": 41.17 }, { "method": "Tarjeta", "amount": 921.37 }, { "method": "Pago Móvil", "amount": 231.85 }, { "method": "divisas", "amount": 172.0 }] },
            { "date": "2026-01-17", "sales": [{ "method": "Efectivo", "amount": 88.79 }, { "method": "Tarjeta", "amount": 1393.8 }, { "method": "Pago Móvil", "amount": 308.85 }, { "method": "Transferencia", "amount": 262.6 }, { "method": "divisas", "amount": 459.69 }] },
            { "date": "2026-01-18", "sales": [{ "method": "Efectivo", "amount": 136.08 }, { "method": "Tarjeta", "amount": 1070.37 }, { "method": "Pago Móvil", "amount": 190.66 }, { "method": "divisas", "amount": 307.9 }] },
            { "date": "2026-01-19", "sales": [{ "method": "Efectivo", "amount": 120.37 }, { "method": "Tarjeta", "amount": 858.07 }, { "method": "Pago Móvil", "amount": 155.53 }, { "method": "divisas", "amount": 143.5 }] },
            { "date": "2026-01-20", "sales": [{ "method": "Efectivo", "amount": 104.15 }, { "method": "Tarjeta", "amount": 460.66 }, { "method": "Pago Móvil", "amount": 98.07 }, { "method": "Transferencia", "amount": 22.0 }, { "method": "divisas", "amount": 119.0 }] }
        ];

        try {
            let count = 0;
            for (const day of historicalData) {
                for (const sale of day.sales) {
                    await api.createTransaction({
                        amount: parseFloat(sale.amount),
                        method: sale.method === 'divisas' ? 'Divisas' : sale.method,
                        date: day.date,
                        note: 'Carga Histórica',
                        type: 'INCOME',
                        category: 'Venta',
                        status: 'COMPLETED'
                    });
                    count++;
                }
            }
            setMessage({ type: 'success', text: `¡Éxito! Se importaron ${count} ventas.` });
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Error en la importación. Revisa la consola.' });
        } finally {
            setSaving(false);
        }
    };

    // User CRUD actions
    const handleOpenCreateUser = () => {
        setEditingUser(null);
        setUserForm({
            username: '',
            name: '',
            password: '',
            role: 'cajero'
        });
        setUserError(null);
        setShowUserModal(true);
    };

    const handleOpenEditUser = (u) => {
        setEditingUser(u);
        setUserForm({
            username: u.username,
            name: u.name,
            password: '',
            role: u.role
        });
        setUserError(null);
        setShowUserModal(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setSavingUser(true);
        setUserError(null);

        try {
            if (!userForm.username.trim() || !userForm.name.trim()) {
                throw new Error("Por favor completa todos los campos.");
            }
            if (!editingUser && userForm.password.length < 8) {
                throw new Error("La contraseña debe tener al menos 8 caracteres.");
            }
            if (editingUser && userForm.password && userForm.password.length < 8) {
                throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
            }

            if (editingUser) {
                await api.updateUser(editingUser.id, {
                    name: userForm.name,
                    password: userForm.password || undefined, // vacío = no cambiar
                    role: userForm.role
                });
            } else {
                // Check if username already exists
                const userExists = users.some(u => u.username.toLowerCase() === userForm.username.trim().toLowerCase());
                if (userExists) {
                    throw new Error("El nombre de usuario ya existe en el sistema.");
                }
                await api.createUser(userForm);
            }
            await fetchUsers();
            setShowUserModal(false);
        } catch (err) {
            console.error(err);
            setUserError(err.message || "No se pudo guardar el usuario.");
        } finally {
            setSavingUser(false);
        }
    };

    const handleDeleteUser = async (userToDelete) => {
        if (userToDelete.username.toLowerCase() === currentUsername.toLowerCase()) {
            alert("No puedes eliminar tu propio usuario.");
            return;
        }
        if (!window.confirm(`¿Estás seguro de eliminar al usuario "${userToDelete.name}"?`)) return;

        try {
            await api.deleteUser(userToDelete.id);
            await fetchUsers();
        } catch (err) {
            console.error(err);
            alert("No se pudo eliminar el usuario.");
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-secondary">Cargando configuración...</div>;
    }

    // Block non-admins from view
    if (currentUserRole !== 'administrador') {
        return (
            <div className="p-8 bg-white border border-gray-100 rounded-3xl text-center max-w-md mx-auto mt-12">
                <Shield size={48} className="text-rose-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-navy">Acceso Denegado</h2>
                <p className="text-sm text-secondary mt-2">Sólo los administradores del sistema tienen permiso para ingresar a esta sección.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Configuración</h1>
                    <p className="text-secondary opacity-60">Gestiona los datos del comercio y control de usuarios</p>
                </div>
                
                <button
                    onClick={async () => {
                        if (window.confirm('¿Cerrar sesión en el sistema?')) {
                            await supabase.auth.signOut();
                            window.location.href = '/login';
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100/80 text-rose-600 border border-rose-100 hover:border-rose-200 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer self-start sm:self-auto select-none"
                >
                    <LogOut size={16} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>

            {/* Sub Tabs Navigation */}
            <div className="flex border-b border-gray-200 gap-6 overflow-x-auto" role="tablist">
                {TABS.map(([key, label]) => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={activeTab === key}
                        onClick={() => setActiveTab(key)}
                        className={`pb-3 font-bold text-sm transition-all relative whitespace-nowrap ${
                            activeTab === key ? 'text-primary' : 'text-secondary opacity-60 hover:opacity-100'
                        }`}
                    >
                        {label}
                        {activeTab === key && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Tienda web */}
            {activeTab === 'tienda' && <StoreSettingsPanel />}

            {/* General Tab */}
            {activeTab === 'general' && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-2xl animate-in fade-in duration-200">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {message && (
                            <div className={`p-4 rounded-xl text-sm font-semibold border ${
                                message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-navy mb-2">
                                    <div className="flex items-center gap-2">
                                        <Building2 size={16} className="text-primary" />
                                        Nombre del Local
                                    </div>
                                </label>
                                <input
                                    type="text"
                                    name="storeName"
                                    value={settings.storeName}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm font-bold"
                                    placeholder="Ej: Mi Negocio"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-navy mb-2">
                                    <div className="flex items-center gap-2">
                                        <User size={16} className="text-primary" />
                                        Nombre del Administrador Principal
                                    </div>
                                </label>
                                <input
                                    type="text"
                                    name="adminName"
                                    value={settings.adminName}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm font-bold"
                                    placeholder="Ej: Omar Pérez"
                                    required
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-bold text-navy mb-3">Datos del Comercio (Facturación / POS)</h3>
                                <p className="text-xs text-secondary opacity-60 mb-4">Esta información aparecerá automáticamente impresa en la parte superior de los tickets del POS.</p>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-wider">RIF / Identificación Fiscal</label>
                                        <input
                                            type="text"
                                            name="storeTaxId"
                                            value={settings.storeTaxId || ''}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-mono text-sm"
                                            placeholder="Ej: J-12345678-9"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-wider">Teléfono de Contacto</label>
                                            <input
                                                type="text"
                                                name="storePhone"
                                                value={settings.storePhone || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
                                                placeholder="Ej: 0212-5555555"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-navy mb-2 uppercase tracking-wider">Dirección Física</label>
                                            <input
                                                type="text"
                                                name="storeAddress"
                                                value={settings.storeAddress || ''}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
                                                placeholder="Ej: Caracas, Venezuela"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>


                        <div className="pt-4 border-t border-gray-100 flex justify-between gap-4">
                            <button
                                type="button"
                                onClick={handleBulkImport}
                                disabled={saving}
                                className="text-primary hover:bg-primary/5 px-4 py-2.5 rounded-xl font-bold transition-colors text-xs disabled:opacity-50 cursor-pointer"
                            >
                                Importar Datos Históricos
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 disabled:opacity-50 text-xs shadow-md shadow-teal-500/20 cursor-pointer"
                            >
                                <Save size={16} />
                                {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <div className="text-sm font-bold text-navy">
                            Usuarios Registrados: {users.length}
                        </div>
                        <button
                            onClick={handleOpenCreateUser}
                            className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-teal-500/10 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                            <Plus size={16} />
                            Agregar Usuario
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-background text-secondary text-xs uppercase font-bold tracking-wider">
                                        <th className="py-4 px-6">Nombre de Usuario</th>
                                        <th className="py-4 px-6">Nombre Completo</th>
                                        <th className="py-4 px-6">Rol</th>
                                        <th className="py-4 px-6">Acceso</th>
                                        <th className="py-4 px-6 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingUsers ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-secondary opacity-50 text-sm">
                                                Cargando usuarios...
                                            </td>
                                        </tr>
                                    ) : users.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-12 text-center text-secondary opacity-50 font-medium">
                                                No hay usuarios registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((u) => (
                                            <tr key={u.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors text-sm">
                                                <td className="py-4 px-6 font-bold text-navy">
                                                    @{u.username}
                                                </td>
                                                <td className="py-4 px-6 font-medium text-secondary">
                                                    {u.name}
                                                </td>
                                                <td className="py-4 px-6 font-medium text-secondary">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                        u.role === 'administrador'
                                                            ? 'bg-purple-50 text-purple-600 border border-purple-100'
                                                            : u.role === 'supervisor'
                                                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                            : 'bg-green-50 text-green-600 border border-green-100'
                                                    }`}>
                                                        {u.role.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-xs font-bold text-secondary">Contraseña cifrada</td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleOpenEditUser(u)}
                                                            className="p-2 text-secondary hover:text-primary hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                                                            title="Editar Usuario"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(u)}
                                                            className="p-2 text-secondary hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                                            title="Eliminar Usuario"
                                                            disabled={u.username.toLowerCase() === currentUsername.toLowerCase()}
                                                        >
                                                            <Trash2 size={16} className={u.username.toLowerCase() === currentUsername.toLowerCase() ? 'opacity-40' : ''} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Crear / Editar Usuario */}
            {showUserModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-navy text-lg font-black flex items-center gap-2">
                                <User size={20} className="text-primary" />
                                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h3>
                            <button 
                                onClick={() => setShowUserModal(false)} 
                                className="p-1.5 hover:bg-slate-100 rounded-full text-secondary"
                            >
                                <Lock size={20} className="opacity-0" />
                                <span className="font-bold text-lg leading-none cursor-pointer">×</span>
                            </button>
                        </div>

                        <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                            {userError && (
                                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold text-center">
                                    {userError}
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Nombre de Usuario *</label>
                                <input
                                    type="text"
                                    required
                                    disabled={!!editingUser}
                                    value={userForm.username}
                                    onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                                    placeholder="ej: carlos.r"
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary disabled:opacity-50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Nombre Completo *</label>
                                <input
                                    type="text"
                                    required
                                    value={userForm.name}
                                    onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="ej: Carlos Ruiz"
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">{editingUser ? 'Nueva contraseña (opcional)' : 'Contraseña * (mín. 8)'}</label>
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    required={!editingUser}
                                    minLength={editingUser ? undefined : 8}
                                    value={userForm.password}
                                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder={editingUser ? "Dejar vacío para no cambiarla" : "Mínimo 8 caracteres"}
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all font-mono"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Rol del Usuario *</label>
                                <select
                                    value={userForm.role}
                                    onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all cursor-pointer"
                                >
                                    <option value="administrador">Administrador</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="cajero">Cajero</option>
                                </select>
                            </div>

                            <div className="pt-4 border-t border-gray-50 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowUserModal(false)}
                                    className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-secondary border border-gray-200 rounded-xl text-xs font-bold cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingUser}
                                    className="px-6 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-teal-500/20 cursor-pointer disabled:opacity-50"
                                >
                                    {savingUser ? 'Guardando...' : 'Guardar Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Configuration;