import React, { useState } from 'react';
import { X, Check, Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { api } from '../services/api';

const BillFormModal = ({ onClose, onBillAdded }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        provider: '',
        amount: '',
        // Use local date for default value to prevent UTC offset issues
        dueDate: new Date().toLocaleDateString('en-CA'),
        type: 'PAYABLE' // 'PAYABLE' | 'RECEIVABLE'
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleTypeSelect = (typeVal) => {
        setFormData(prev => ({ ...prev, type: typeVal }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.createBill(formData);
            if (onBillAdded) onBillAdded();
            onClose();
        } catch (error) {
            console.error('Error creating bill:', error);
            alert('Error al guardar la factura');
        } finally {
            setLoading(false);
        }
    };

    const isPayable = formData.type === 'PAYABLE';

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white">
                    <div>
                        <h3 className="text-xl font-bold text-navy">Nueva Factura</h3>
                        <p className="text-xs text-secondary opacity-60">Registra un egreso o ingreso programado a plazo</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full text-secondary">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    {/* Bill Type Selector */}
                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Tipo de Factura</label>
                        <div className="grid grid-cols-2 gap-2 bg-background p-1 rounded-xl border border-gray-100">
                            <button
                                type="button"
                                onClick={() => handleTypeSelect('PAYABLE')}
                                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                                    isPayable 
                                        ? 'bg-white text-danger shadow-sm border border-red-100/50' 
                                        : 'text-secondary opacity-65 hover:opacity-100'
                                }`}
                            >
                                <ArrowDownLeft size={14} className={isPayable ? "text-danger" : ""} />
                                Por Pagar (Gasto)
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTypeSelect('RECEIVABLE')}
                                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                                    !isPayable 
                                        ? 'bg-white text-success shadow-sm border border-green-100/50' 
                                        : 'text-secondary opacity-65 hover:opacity-100'
                                }`}
                            >
                                <ArrowUpRight size={14} className={!isPayable ? "text-success" : ""} />
                                Por Cobrar (Crédito)
                            </button>
                        </div>
                    </div>

                    {/* Provider/Client Input */}
                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                            {isPayable ? 'Proveedor' : 'Cliente'}
                        </label>
                        <input
                            type="text"
                            name="provider"
                            value={formData.provider}
                            onChange={handleChange}
                            required
                            placeholder={isPayable ? "Ej. CFE, AWS, Distribuidora X" : "Ej. Distribuidora Sur, Cliente VIP, Juan Pérez"}
                            className="w-full p-4 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                        />
                    </div>

                    {/* Title Input */}
                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Concepto / Título</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            placeholder={isPayable ? "Ej. Servicio de Luz Octubre" : "Ej. Venta a Crédito Lote 23"}
                            className="w-full p-4 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-medium text-secondary text-sm transition-all"
                        />
                    </div>

                    {/* Amount & Due Date Inputs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Monto ($)</label>
                            <input
                                type="number"
                                name="amount"
                                step="0.01"
                                min="0"
                                value={formData.amount}
                                onChange={handleChange}
                                required
                                placeholder="0.00"
                                className="w-full p-4 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                                {isPayable ? 'Vencimiento' : 'Fecha de Cobro'}
                            </label>
                            <input
                                type="date"
                                name="dueDate"
                                value={formData.dueDate}
                                onChange={handleChange}
                                required
                                className="w-full p-4 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-secondary text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={`btn w-full py-4 text-base mt-2 rounded-xl shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white border-none transition-all ${
                            isPayable 
                                ? 'bg-danger/90 hover:bg-danger shadow-red-500/20 hover:shadow-red-500/30' 
                                : 'bg-success/90 hover:bg-success shadow-green-500/20 hover:shadow-green-500/30'
                        }`}
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                        {loading ? 'Guardando...' : isPayable ? 'Programar Gasto' : 'Programar Cobro'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BillFormModal;
