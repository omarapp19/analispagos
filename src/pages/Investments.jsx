import React, { useState, useEffect, useMemo } from 'react';
import { Plus, TrendingUp, Calendar, Trash2, Search, X, Loader2, ArrowUpRight, Check } from 'lucide-react';
import { api } from '../services/api';

const Investments = () => {
    const [investments, setInvestments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        investor: '',
        amount: '',
        method: 'Transferencia',
        date: new Date().toLocaleDateString('en-CA'),
        note: ''
    });

    const fetchInvestments = async () => {
        try {
            const data = await api.getInvestments();
            setInvestments(data);
        } catch (error) {
            console.error('Error fetching investments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvestments();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(formData.amount);
        if (!formData.investor.trim() || isNaN(amt) || amt <= 0) {
            alert('Por favor complete todos los datos con valores válidos.');
            return;
        }

        setSubmitLoading(true);
        try {
            await api.createInvestment({
                investor: formData.investor.trim(),
                amount: amt,
                method: formData.method,
                date: formData.date,
                note: formData.note.trim()
            });

            // Reset Form and Modal
            setFormData({
                investor: '',
                amount: '',
                method: 'Transferencia',
                date: new Date().toLocaleDateString('en-CA'),
                note: ''
            });
            setShowModal(false);
            fetchInvestments();
        } catch (error) {
            console.error('Error creating investment:', error);
            alert('Error al registrar la inversión.');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este registro de inversión? Esto también restará el monto del saldo disponible.')) {
            try {
                await api.deleteInvestment(id);
                fetchInvestments();
            } catch (error) {
                console.error('Error deleting investment:', error);
                alert('Error al eliminar la inversión.');
            }
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    };

    // Filter Investments
    const filteredInvestments = useMemo(() => {
        return investments.filter(inv => {
            const term = searchTerm.toLowerCase().trim();
            if (!term) return true;
            return (
                (inv.investor || '').toLowerCase().includes(term) ||
                (inv.note || '').toLowerCase().includes(term) ||
                (inv.method || '').toLowerCase().includes(term)
            );
        });
    }, [investments, searchTerm]);

    // Financial KPI stats
    const totalAmount = useMemo(() => {
        return investments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    }, [investments]);

    const latestInvestment = useMemo(() => {
        if (investments.length === 0) return null;
        // Since list is already sorted desc by date, the first one is the latest
        return investments[0];
    }, [investments]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const totalPages = Math.ceil(filteredInvestments.length / itemsPerPage);

    const paginatedInvestments = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredInvestments.slice(start, start + itemsPerPage);
    }, [filteredInvestments, currentPage]);

    return (
        <div className="flex flex-col h-full gap-6">
            
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
                        <TrendingUp className="text-primary" size={26} />
                        Inversiones (Inyección de Capital)
                    </h1>
                    <p className="text-secondary opacity-60">Historial y control de capital inyectado para la liquidez del negocio</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="btn btn-primary flex items-center gap-2 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 w-full sm:w-auto justify-center"
                >
                    <Plus size={18} />
                    Nueva Inversión
                </button>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Total Capital Injected */}
                <div className="card p-5 bg-white border border-gray-50/50 shadow-sm rounded-2xl flex justify-between items-center">
                    <div>
                        <p className="text-xs text-secondary font-bold opacity-60 uppercase mb-1">Total Inyectado (USD)</p>
                        <h3 className="text-3xl font-black text-teal-650">{formatCurrency(totalAmount)}</h3>
                    </div>
                    <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 shadow-sm">
                        <TrendingUp size={24} />
                    </div>
                </div>

                {/* Capital Injections Count */}
                <div className="card p-5 bg-white border border-gray-50/50 shadow-sm rounded-2xl flex justify-between items-center">
                    <div>
                        <p className="text-xs text-secondary font-bold opacity-60 uppercase mb-1">Inyecciones Realizadas</p>
                        <h3 className="text-3xl font-black text-navy">{investments.length}</h3>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-primary shadow-sm">
                        <ArrowUpRight size={24} />
                    </div>
                </div>

                {/* Latest Capital Injection */}
                <div className="card p-5 bg-white border border-gray-50/50 shadow-sm rounded-2xl flex justify-between items-center">
                    <div className="min-w-0">
                        <p className="text-xs text-secondary font-bold opacity-60 uppercase mb-1">Último Aporte</p>
                        {latestInvestment ? (
                            <div>
                                <h3 className="text-base font-bold text-navy truncate" title={latestInvestment.investor}>
                                    {latestInvestment.investor}
                                </h3>
                                <p className="text-xs font-semibold text-teal-600 mt-0.5">
                                    {formatCurrency(latestInvestment.amount)} • {new Date(latestInvestment.date + 'T12:00:00').toLocaleDateString()}
                                </p>
                            </div>
                        ) : (
                            <h3 className="text-sm font-semibold text-secondary italic">Sin registros</h3>
                        )}
                    </div>
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-warning shadow-sm flex-shrink-0">
                        <Calendar size={24} />
                    </div>
                </div>

            </div>

            {/* List Table and Toolbar */}
            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-3xl">
                
                {/* Search Bar Toolbar */}
                <div className="p-4 px-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/20">
                    <div className="text-sm font-bold text-navy whitespace-nowrap">
                        Aportes Registrados: {filteredInvestments.length}
                    </div>
                    <div className="relative w-full sm:w-64">
                        <input 
                            type="text" 
                            placeholder="Buscar por inversionista o concepto..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-9 pr-4 py-2 bg-background rounded-xl border border-gray-200 outline-none text-xs text-secondary font-bold focus:border-primary transition-all"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={14} />
                    </div>
                </div>

                {/* Table container */}
                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr className="text-xs font-bold text-secondary uppercase tracking-wider">
                                <th className="p-6">Fecha</th>
                                <th className="p-6">Inversionista</th>
                                <th className="p-6">Método de Aporte</th>
                                <th className="p-6">Concepto / Notas</th>
                                <th className="p-6 text-right">Monto</th>
                                <th className="p-6"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-secondary opacity-50">
                                        Cargando aportes de inversión...
                                    </td>
                                </tr>
                            ) : filteredInvestments.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center text-secondary opacity-40">
                                        No se encontraron aportes de inversión.
                                    </td>
                                </tr>
                            ) : (
                                paginatedInvestments.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-gray-50/30 transition-colors group align-middle">
                                        <td className="p-6 text-secondary font-semibold">
                                            {new Date(inv.date + 'T12:00:00').toLocaleDateString()}
                                        </td>
                                        <td className="p-6 font-bold text-navy">
                                            {inv.investor}
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border uppercase tracking-wider ${
                                                inv.method === 'Divisas' ? 'bg-amber-50 text-amber-700 border-amber-100/50' :
                                                inv.method === 'Efectivo' ? 'bg-blue-50 text-blue-700 border-blue-100/50' :
                                                inv.method === 'Pago Móvil' ? 'bg-purple-50 text-purple-700 border-purple-100/50' :
                                                inv.method === 'Tarjeta' ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50' :
                                                'bg-indigo-50 text-indigo-700 border-indigo-100/50'
                                            }`}>
                                                {inv.method}
                                            </span>
                                        </td>
                                        <td className="p-6 text-secondary font-medium max-w-xs truncate" title={inv.note}>
                                            {inv.note || '-'}
                                        </td>
                                        <td className="p-6 text-right font-black text-teal-600">
                                            +{formatCurrency(inv.amount)}
                                        </td>
                                        <td className="p-6 text-right">
                                            <button
                                                onClick={() => handleDelete(inv.id)}
                                                className="p-2 text-gray-300 hover:text-danger hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                                title="Eliminar registro"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Pagination Footer */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex justify-center items-center gap-4 bg-gray-50/20">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-secondary hover:bg-slate-50 disabled:opacity-30 transition-all cursor-pointer"
                        >
                            Anterior
                        </button>
                        <span className="text-xs font-bold text-secondary">
                            Página {currentPage} de {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-secondary hover:bg-slate-50 disabled:opacity-30 transition-all cursor-pointer"
                        >
                            Siguiente
                        </button>
                    </div>
                )}

            </div>

            {/* CREATION MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-navy flex items-center gap-2">
                                    <TrendingUp className="text-primary" size={20} />
                                    Registrar Inyección de Capital
                                </h3>
                                <p className="text-[11px] text-secondary opacity-60 mt-0.5">Introduce los datos del inversionista y el monto inyectado</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-50 rounded-full text-secondary transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
                            
                            {/* Investor name */}
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 block">
                                    Inversionista / Socio *
                                </label>
                                <input
                                    type="text"
                                    name="investor"
                                    required
                                    value={formData.investor}
                                    onChange={handleChange}
                                    placeholder="Nombre completo..."
                                    className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-navy text-xs transition-all"
                                />
                            </div>

                            {/* Amount and Method Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 block">
                                        Monto (USD) *
                                    </label>
                                    <input
                                        type="number"
                                        name="amount"
                                        step="0.01"
                                        min="0.01"
                                        required
                                        value={formData.amount}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-navy text-xs transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 block">
                                        Método de Pago *
                                    </label>
                                    <select
                                        name="method"
                                        value={formData.method}
                                        onChange={handleChange}
                                        className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-navy text-xs transition-all cursor-pointer"
                                    >
                                        <option value="Transferencia">Transferencia</option>
                                        <option value="Pago Móvil">Pago Móvil</option>
                                        <option value="Divisas">Divisas</option>
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Tarjeta">Tarjeta</option>
                                    </select>
                                </div>
                            </div>

                            {/* Date */}
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 block">
                                    Fecha de Aporte *
                                </label>
                                <input
                                    type="date"
                                    name="date"
                                    required
                                    value={formData.date}
                                    onChange={handleChange}
                                    className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-secondary text-xs transition-all"
                                />
                            </div>

                            {/* Description Notes */}
                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 block">
                                    Concepto / Notas (Opcional)
                                </label>
                                <textarea
                                    name="note"
                                    rows="3"
                                    value={formData.note}
                                    onChange={handleChange}
                                    placeholder="Detalles sobre este aporte..."
                                    className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-medium text-navy text-xs transition-all resize-none"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitLoading}
                                className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-500/20 disabled:opacity-75 flex items-center justify-center gap-1.5 transition-all mt-4 cursor-pointer"
                            >
                                {submitLoading ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Check size={16} />
                                )}
                                {submitLoading ? 'Registrando...' : 'Registrar Inyección'}
                            </button>

                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Investments;
