import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, Info, Users, Briefcase, FileText, X } from 'lucide-react';
import { api } from '../services/api';

const Providers = () => {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        rif: '',
        phone: '',
        email: '',
        address: '',
        info: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const userRole = localStorage.getItem('userRole') || 'cajero';

    const fetchProviders = async () => {
        setLoading(true);
        try {
            const data = await api.getProviders();
            setProviders(data);
        } catch (err) {
            console.error("Error fetching providers:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProviders();
    }, []);

    const handleOpenCreate = () => {
        setEditingProvider(null);
        setFormData({
            name: '',
            rif: '',
            phone: '',
            email: '',
            address: '',
            info: ''
        });
        setError(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (p) => {
        setEditingProvider(p);
        setFormData({
            name: p.name,
            rif: p.rif || '',
            phone: p.phone || '',
            email: p.email || '',
            address: p.address || '',
            info: p.info || ''
        });
        setError(null);
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setSaving(true);
        setError(null);
        try {
            if (editingProvider) {
                await api.updateProvider(editingProvider.id, formData);
            } else {
                await api.createProvider(formData);
            }
            await fetchProviders();
            setIsModalOpen(false);
        } catch (err) {
            console.error("Error saving provider:", err);
            setError(err.message || "Ocurrió un error al guardar el proveedor.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (p) => {
        if (!window.confirm(`¿Estás seguro de eliminar al proveedor "${p.name}"?`)) return;

        try {
            await api.deleteProvider(p.id);
            await fetchProviders();
        } catch (err) {
            console.error("Error deleting provider:", err);
            alert("No se pudo eliminar el proveedor.");
        }
    };

    const filteredProviders = providers.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.rif || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.phone || '').includes(searchTerm)
    );

    return (
        <div className="flex flex-col h-full gap-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Gestión de Proveedores</h1>
                    <p className="text-secondary opacity-60">Registra y administra los proveedores para tu inventario y compras</p>
                </div>
                {userRole !== 'cajero' && (
                    <button
                        onClick={handleOpenCreate}
                        className="btn btn-primary flex items-center gap-2 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 justify-center text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                    >
                        <Plus size={16} />
                        Nuevo Proveedor
                    </button>
                )}
            </div>

            {/* Providers Directory */}
            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-3xl">
                {/* Search Bar */}
                <div className="p-4 px-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/20">
                    <div className="text-sm font-bold text-navy">
                        Proveedores en lista: {filteredProviders.length}
                    </div>
                    <div className="relative w-full sm:w-80">
                        <input 
                            type="text" 
                            placeholder="Buscar proveedor por nombre, RIF o teléfono..."
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
                            <tr className="text-xs font-bold text-secondary uppercase tracking-wider font-bold">
                                <th className="p-6">Proveedor</th>
                                <th className="p-6">RIF</th>
                                <th className="p-6">Contacto</th>
                                <th className="p-6">Dirección</th>
                                <th className="p-6">Notas / Información</th>
                                {userRole !== 'cajero' && <th className="p-6 text-center">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-secondary opacity-50">Cargando proveedores...</td>
                                </tr>
                            ) : filteredProviders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-40">
                                            <Briefcase size={48} />
                                            <p className="font-medium text-secondary">
                                                {providers.length === 0 ? "No hay proveedores registrados" : "No se encontraron proveedores que coincidan con la búsqueda"}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProviders.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50/30 transition-colors group align-middle">
                                        <td className="p-6 font-bold text-navy text-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                                                    {p.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="block">{p.name}</span>
                                                    <span className="text-[10px] text-secondary opacity-50 block font-normal">Registrado: {new Date(p.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 font-mono text-xs font-bold text-secondary">
                                            {p.rif || '-'}
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col gap-1 text-xs font-semibold text-secondary">
                                                {p.phone && (
                                                    <span className="flex items-center gap-1.5">
                                                        <Phone size={12} className="text-secondary opacity-50" /> {p.phone}
                                                    </span>
                                                )}
                                                {p.email && (
                                                    <span className="flex items-center gap-1.5">
                                                        <Mail size={12} className="text-secondary opacity-50" /> {p.email}
                                                    </span>
                                                )}
                                                {!p.phone && !p.email && <span className="opacity-40">-</span>}
                                            </div>
                                        </td>
                                        <td className="p-6 text-xs text-secondary font-medium truncate max-w-xs" title={p.address}>
                                            {p.address ? (
                                                <span className="flex items-center gap-1.5">
                                                    <MapPin size={12} className="text-secondary opacity-50 flex-shrink-0" /> {p.address}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="p-6 text-xs text-secondary font-medium truncate max-w-xs" title={p.info}>
                                            {p.info ? (
                                                <span className="flex items-center gap-1.5">
                                                    <Info size={12} className="text-secondary opacity-50 flex-shrink-0" /> {p.info}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        {userRole !== 'cajero' && (
                                            <td className="p-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenEdit(p)}
                                                        className="p-1.5 rounded-lg text-secondary hover:bg-slate-50 hover:text-primary transition-colors cursor-pointer"
                                                        title="Editar Proveedor"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(p)}
                                                        className="p-1.5 rounded-lg text-secondary hover:bg-red-50 hover:text-danger transition-colors cursor-pointer"
                                                        title="Eliminar Proveedor"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
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
                                <Briefcase size={20} className="text-primary" />
                                {editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                            </h3>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="p-1.5 hover:bg-slate-100 rounded-full text-secondary hover:text-navy cursor-pointer transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 font-sans">
                            {error && (
                                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold text-center">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Nombre / Razón Social *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="ej: Inversiones Polar C.A"
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">RIF / Cédula</label>
                                    <input
                                        type="text"
                                        value={formData.rif}
                                        onChange={(e) => setFormData(prev => ({ ...prev, rif: e.target.value }))}
                                        placeholder="ej: J-12345678-9"
                                        className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Teléfono de contacto</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="ej: 0412-1234567"
                                        className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Correo Electrónico</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="ej: contacto@polar.com"
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Dirección Física</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                    placeholder="Dirección del depósito o local..."
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Información Adicional (Opcional)</label>
                                <textarea
                                    value={formData.info}
                                    onChange={(e) => setFormData(prev => ({ ...prev, info: e.target.value }))}
                                    placeholder="Horario de atención, términos de pago, etc..."
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm font-medium text-secondary h-20 resize-none focus:border-primary transition-all"
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
                                    {saving ? 'Guardando...' : 'Guardar Proveedor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Providers;
