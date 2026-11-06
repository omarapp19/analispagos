import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, User, Phone, Mail, MapPin, X, Shield, Landmark } from 'lucide-react';
import { api } from '../services/api';
import { getRole } from '../auth/session';


const ClientManagement = () => {
    const userRole = getRole();

    const [clients, setClients] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        documentId: '',
        phone: '',
        email: '',
        address: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cData, iData] = await Promise.all([
                api.getClients(),
                api.getClientInvoices()
            ]);
            setClients(cData);
            setInvoices(iData);
        } catch (err) {
            console.error("Error loading clients data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userRole === 'administrador' || userRole === 'supervisor') {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [userRole]);

    const handleOpenCreate = () => {
        setEditingClient(null);
        setFormData({
            name: '',
            documentId: '',
            phone: '',
            email: '',
            address: ''
        });
        setError(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (c) => {
        setEditingClient(c);
        setFormData({
            name: c.name,
            documentId: c.documentId || '',
            phone: c.phone || '',
            email: c.email || '',
            address: c.address || ''
        });
        setError(null);
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.documentId.trim()) return;

        setSaving(true);
        setError(null);
        try {
            if (editingClient) {
                await api.updateClient(editingClient.id, formData);
            } else {
                await api.createClient(formData);
            }
            await fetchData();
            setIsModalOpen(false);
        } catch (err) {
            console.error("Error saving client:", err);
            setError(err.message || "No se pudo guardar el cliente.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (c) => {
        if (!window.confirm(`¿Estás seguro de eliminar al cliente "${c.name}"?`)) return;

        try {
            await api.deleteClient(c.id);
            await fetchData();
        } catch (err) {
            console.error("Error deleting client:", err);
            alert("No se pudo eliminar el cliente.");
        }
    };

    const filteredClients = clients.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.documentId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone || '').includes(searchTerm)
    );

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount);
    };

    if (loading) {
        return <div className="p-8 text-center text-secondary">Cargando clientes...</div>;
    }

    if (userRole !== 'administrador' && userRole !== 'supervisor') {
        return (
            <div className="p-8 bg-white border border-gray-100 rounded-3xl text-center max-w-md mx-auto mt-12">
                <Shield size={48} className="text-rose-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-navy">Acceso Denegado</h2>
                <p className="text-sm text-secondary mt-2">Sólo el administrador y el supervisor tienen privilegios para gestionar clientes en esta vista.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Cartera de Clientes</h1>
                    <p className="text-secondary opacity-60">Gestiona los datos de los clientes y visualiza su historial de compras</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="btn btn-primary flex items-center gap-2 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 justify-center text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                >
                    <Plus size={16} />
                    Crear Nuevo Cliente
                </button>
            </div>

            {/* Clients card container */}
            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-3xl">
                {/* Search Bar */}
                <div className="p-4 px-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/20">
                    <div className="text-sm font-bold text-navy">
                        Clientes registrados: {filteredClients.length}
                    </div>
                    <div className="relative w-full sm:w-80">
                        <input 
                            type="text" 
                            placeholder="Buscar cliente por nombre o Cédula/RIF..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-background rounded-xl border border-gray-200 outline-none text-xs text-secondary font-bold focus:border-primary transition-all"
                        />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={14} />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr className="text-xs font-bold text-secondary uppercase tracking-wider">
                                <th className="p-6">Nombre</th>
                                <th className="p-6">Identificación</th>
                                <th className="p-6">Contacto</th>
                                <th className="p-6">Dirección</th>
                                <th className="p-6 text-right">Monto Comprado</th>
                                <th className="p-6 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium text-sm text-secondary">
                            {filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center text-secondary opacity-50 font-bold">
                                        No hay clientes registrados en la base de datos
                                    </td>
                                </tr>
                            ) : (
                                filteredClients.map((c) => {
                                    const historyCount = invoices.filter(inv => inv.clientId === c.id).length;
                                    const totalSpent = invoices
                                        .filter(inv => inv.clientId === c.id)
                                        .reduce((sum, inv) => sum + inv.total, 0);

                                    return (
                                        <tr key={c.id} className="hover:bg-gray-50/30 transition-colors align-middle">
                                            <td className="p-6 font-bold text-navy flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-bold">
                                                    <User size={16} />
                                                </div>
                                                <div>
                                                    <span className="block">{c.name}</span>
                                                    <span className="text-[10px] text-secondary opacity-50 block font-normal">Registrado: {new Date(c.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 font-mono text-xs font-bold text-secondary">
                                                {c.documentId || '-'}
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col gap-1 text-xs">
                                                    {c.phone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone size={12} className="opacity-50" /> {c.phone}
                                                        </span>
                                                    )}
                                                    {c.email && (
                                                        <span className="flex items-center gap-1">
                                                            <Mail size={12} className="opacity-50" /> {c.email}
                                                        </span>
                                                    )}
                                                    {!c.phone && !c.email && <span className="opacity-40">-</span>}
                                                </div>
                                            </td>
                                            <td className="p-6 text-xs truncate max-w-xs" title={c.address}>
                                                {c.address ? (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={12} className="opacity-50 flex-shrink-0" /> {c.address}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-6 text-right font-semibold whitespace-nowrap">
                                                <div>
                                                    <span className="font-extrabold text-primary block">{formatCurrency(totalSpent)}</span>
                                                    <span className="text-[10px] text-secondary opacity-60 font-bold">{historyCount} Factura(s)</span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenEdit(c)}
                                                        className="p-1.5 rounded-lg text-secondary hover:bg-slate-50 hover:text-primary transition-colors cursor-pointer"
                                                        title="Editar Cliente"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(c)}
                                                        className="p-1.5 rounded-lg text-secondary hover:bg-rose-50 hover:text-danger transition-colors cursor-pointer"
                                                        title="Eliminar Cliente"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-navy text-lg font-black flex items-center gap-2">
                                <User size={20} className="text-primary" />
                                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h3>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="p-1.5 hover:bg-slate-100 rounded-full text-secondary hover:text-navy cursor-pointer transition-colors"
                            >
                                <span className="font-bold text-lg leading-none">×</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 font-sans">
                            {error && (
                                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold text-center">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Nombre Completo / Razón Social *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="ej: Carlos Ruiz"
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Cédula / RIF *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.documentId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, documentId: e.target.value }))}
                                        placeholder="ej: V-12345678"
                                        className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Teléfono (opcional)</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="ej: 0412-1234567"
                                        className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Dirección (opcional)</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                    placeholder="ej: Av. Francisco de Miranda, Local A..."
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-50 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-secondary border border-gray-200 rounded-xl text-xs font-bold cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-teal-500/20 cursor-pointer disabled:opacity-50"
                                >
                                    {saving ? 'Guardando...' : 'Guardar Cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientManagement;
