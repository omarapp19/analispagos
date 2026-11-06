import React, { useState, useEffect } from 'react';
import { Shield, Plus, ArrowUpRight, ArrowDownLeft, History, ArrowLeft, Search } from 'lucide-react';
import { api } from '../services/api';
import { getRole, getUsername } from '../auth/session';


const InventoryAdjustments = () => {
    const userRole = getRole();
    const username = getUsername();

    // States
    const [products, setProducts] = useState([]);
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [activeView, setActiveView] = useState('form'); // 'form' | 'history'

    // Search and selected item states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProductObj, setSelectedProductObj] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        productId: '',
        type: 'load', // 'load' (Cargar/Entrada) | 'unload' (Descargar/Salida)
        quantity: '',
        reason: 'Ajuste de conteo físico'
    });

    const reasonsList = [
        'Ajuste de conteo físico',
        'Pérdida por daño / rotura',
        'Producto vencido',
        'Muestra gratis / Donación',
        'Error de facturación previo',
        'Consumo interno'
    ];

    const fetchData = async () => {
        try {
            const [pData, kData] = await Promise.all([
                api.getInventory(),
                api.getKardex()
            ]);
            setProducts(pData);
            
            // Filter Kardex to only show entries that start with "Ajuste manual"
            const adjData = kData.filter(entry => 
                (entry.concept || '').startsWith('Ajuste manual:')
            );
            setAdjustments(adjData);

            // Re-sync selected product object if details changed
            if (formData.productId) {
                const updatedObj = pData.find(p => p.id === formData.productId);
                if (updatedObj) {
                    setSelectedProductObj(updatedObj);
                }
            }
        } catch (err) {
            console.error("Error loading data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userRole === 'administrador') {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [userRole]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        const qty = parseInt(formData.quantity) || 0;
        if (!formData.productId) {
            setErrorMessage("Debe seleccionar un producto.");
            setSubmitting(false);
            return;
        }
        if (qty <= 0) {
            setErrorMessage("La cantidad debe ser mayor que 0.");
            setSubmitting(false);
            return;
        }

        const changeQty = formData.type === 'load' ? qty : -qty;
        const finalConcept = `Ajuste manual: ${formData.reason}`;

        try {
            await api.adjustInventory(formData.productId, changeQty, finalConcept, username);
            
            setSuccessMessage("El ajuste de inventario se aplicó y registró en el Kardex correctamente.");
            setFormData({
                productId: '',
                type: 'load',
                quantity: '',
                reason: 'Ajuste de conteo físico'
            });
            setSelectedProductObj(null);
            setSearchQuery('');
            await fetchData();
        } catch (err) {
            console.error("Error creating adjustment:", err);
            setErrorMessage(err.message || "No se pudo registrar el ajuste de inventario.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-secondary">Cargando inventario...</div>;
    }

    if (userRole !== 'administrador') {
        return (
            <div className="p-8 bg-white border border-gray-100 rounded-3xl text-center max-w-md mx-auto mt-12">
                <Shield size={48} className="text-rose-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-navy">Acceso Denegado</h2>
                <p className="text-sm text-secondary mt-2">Sólo el usuario administrador tiene privilegios para realizar ajustes manuales de inventario.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                {activeView === 'form' ? (
                    <div>
                        <h1 className="text-2xl font-bold text-navy">Ajuste de Inventario</h1>
                        <p className="text-secondary opacity-60">Realiza cargas o descargas manuales de existencias y justifica el motivo</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setActiveView('form')}
                            className="p-2 bg-white border border-gray-100 hover:border-gray-200 rounded-xl transition-all cursor-pointer shadow-sm text-secondary hover:text-navy"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-navy">Historial de Ajustes Manuales</h1>
                            <p className="text-secondary opacity-60">Auditoría completa de cargas y descargas de almacén por administradores</p>
                        </div>
                    </div>
                )}

                <div>
                    {activeView === 'form' ? (
                        <button
                            onClick={() => setActiveView('history')}
                            className="px-4 py-2.5 bg-white border border-gray-100 hover:border-gray-200 text-secondary hover:text-navy rounded-xl transition-all shadow-sm hover:scale-102 flex items-center gap-2 cursor-pointer text-xs font-bold"
                        >
                            <History size={16} className="text-primary" />
                            Ver Historial de Ajustes
                        </button>
                    ) : (
                        <button
                            onClick={() => setActiveView('form')}
                            className="btn btn-primary px-4 py-2.5 rounded-xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 flex items-center gap-2 cursor-pointer text-xs font-bold"
                        >
                            <Plus size={16} />
                            Realizar Ajuste
                        </button>
                    )}
                </div>
            </div>

            {/* Toggle Views */}
            {activeView === 'form' ? (
                /* Full-Width Adjustment Form */
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
                    <h3 className="text-sm font-bold text-navy uppercase tracking-wider flex items-center gap-2">
                        <Plus size={18} className="text-primary" />
                        Nuevo Ajuste Manual
                    </h3>

                    {successMessage && (
                        <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-green-700 text-xs font-bold leading-relaxed">
                            {successMessage}
                        </div>
                    )}

                    {errorMessage && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold leading-relaxed">
                            {errorMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Search / Selected Product */}
                            {selectedProductObj ? (
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Producto Seleccionado *</label>
                                    <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl flex justify-between items-center">
                                        <div className="min-w-0">
                                            <span className="text-xs font-bold text-navy uppercase block">
                                                {selectedProductObj.code ? `[${selectedProductObj.code}] ` : ''}{selectedProductObj.name}
                                            </span>
                                            <span className="text-[10px] text-secondary opacity-70">Stock actual: {selectedProductObj.quantity} und | Costo: ${selectedProductObj.costPrice.toFixed(2)}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedProductObj(null);
                                                setFormData(prev => ({ ...prev, productId: '' }));
                                            }}
                                            className="text-xs font-bold text-primary hover:underline cursor-pointer flex-shrink-0 ml-3"
                                        >
                                            Cambiar producto
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="md:col-span-2 relative">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Buscar Producto por código o nombre *</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Escriba código o nombre para buscar..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full p-3 pl-10 bg-background rounded-xl border border-gray-200 outline-none text-sm font-bold text-navy focus:border-primary transition-all"
                                        />
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={16} />
                                    </div>

                                    {/* Dropdown matched list */}
                                    {searchQuery.trim() && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-150 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                                            {products
                                                .filter(p => p.productType !== 'service')
                                                .filter(p => 
                                                    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    (p.code || '').toLowerCase().includes(searchQuery.toLowerCase())
                                                )
                                                .slice(0, 10)
                                                .map(p => (
                                                    <button
                                                        type="button"
                                                        key={p.id}
                                                        onClick={() => {
                                                            setSelectedProductObj(p);
                                                            setFormData(prev => ({ ...prev, productId: p.id }));
                                                            setSearchQuery('');
                                                        }}
                                                        className="w-full p-3 px-4 text-left hover:bg-slate-50 text-xs font-bold text-navy border-b border-slate-50 flex justify-between items-center cursor-pointer"
                                                    >
                                                        <span>{p.code ? `[${p.code}] ` : ''}{p.name}</span>
                                                        <span className="text-secondary opacity-60 font-semibold">Stock: {p.quantity} und</span>
                                                    </button>
                                                ))
                                            }
                                            {products
                                                .filter(p => p.productType !== 'service')
                                                .filter(p => 
                                                    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    (p.code || '').toLowerCase().includes(searchQuery.toLowerCase())
                                                ).length === 0 && (
                                                <div className="p-4 text-center text-xs text-secondary opacity-60 font-bold">
                                                    No se encontraron productos coincidentes.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Quantity */}
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Cantidad a Ajustar *</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                                    placeholder="Ingrese cantidad..."
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Adjustment Type */}
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Tipo de Ajuste *</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, type: 'load' }))}
                                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            formData.type === 'load'
                                                ? 'bg-green-50 text-success border-success'
                                                : 'bg-white text-secondary border-gray-200 opacity-60 hover:opacity-100'
                                        }`}
                                    >
                                        <ArrowDownLeft size={16} />
                                        Cargar (Entrada)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, type: 'unload' }))}
                                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            formData.type === 'unload'
                                                ? 'bg-red-50 text-danger border-danger'
                                                : 'bg-white text-secondary border-gray-200 opacity-60 hover:opacity-100'
                                        }`}
                                    >
                                        <ArrowUpRight size={16} />
                                        Descargar (Salida)
                                    </button>
                                </div>
                            </div>

                            {/* Reason / Concept */}
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Justificación / Motivo *</label>
                                <select
                                    value={formData.reason}
                                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-bold focus:border-primary transition-all cursor-pointer"
                                >
                                    {reasonsList.map((r, i) => (
                                        <option key={i} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Custom motive */}
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Motivo Personalizado (Opcional)</label>
                                <input
                                    type="text"
                                    value={formData.reason}
                                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    placeholder="Escriba otro motivo personalizado..."
                                    className="w-full p-3 bg-background rounded-xl border border-gray-200 outline-none text-xs text-secondary font-bold focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-50">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-8 py-3 bg-primary hover:bg-primary/95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all disabled:opacity-70 cursor-pointer"
                            >
                                {submitting ? 'Registrando Ajuste...' : 'Aplicar Ajuste de Stock'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                /* Full Page Adjustments History */
                <div className="bg-white rounded-3xl p-0 shadow-sm border border-gray-100 overflow-hidden flex flex-col animate-in fade-in duration-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr className="text-xs font-bold text-secondary uppercase tracking-wider">
                                    <th className="p-6">Fecha / Hora</th>
                                    <th className="p-6">Producto</th>
                                    <th className="p-6">Tipo</th>
                                    <th className="p-6 text-right">Cantidad</th>
                                    <th className="p-6">Motivo</th>
                                    <th className="p-6 text-center">Usuario</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm font-medium text-secondary">
                                {adjustments.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-12 text-center text-secondary opacity-50 font-bold">
                                            No se han registrado ajustes manuales aún.
                                        </td>
                                    </tr>
                                ) : (
                                    adjustments.map((adj) => {
                                        const adjDate = new Date(adj.date);
                                        const dateStr = adjDate.toLocaleDateString() + ' ' + adjDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        const isLoad = adj.type === 'ENTRADA';

                                        return (
                                            <tr key={adj.id} className="hover:bg-gray-50/30 transition-colors align-middle">
                                                <td className="p-6 text-xs text-secondary whitespace-nowrap">
                                                    {dateStr}
                                                </td>
                                                <td className="p-6 text-navy font-bold">
                                                    {adj.productName}
                                                </td>
                                                <td className="p-6">
                                                    <span className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                        isLoad 
                                                            ? 'bg-green-50 text-success border border-green-100'
                                                            : 'bg-red-50 text-danger border border-red-100'
                                                    }`}>
                                                        {isLoad ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                                                        {isLoad ? 'Carga' : 'Descarga'}
                                                    </span>
                                                </td>
                                                <td className="p-6 text-right font-black text-navy">
                                                    {adj.quantity} und.
                                                </td>
                                                <td className="p-6 text-secondary text-xs truncate max-w-xs" title={adj.concept}>
                                                    {adj.concept.replace('Ajuste manual: ', '')}
                                                </td>
                                                <td className="p-6 text-center text-xs text-secondary font-bold">
                                                    @{adj.user}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryAdjustments;
