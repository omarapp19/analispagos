import React, { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { api } from '../services/api';

const BillFormModal = ({ onClose, onBillAdded, defaultType = 'PAYABLE' }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        provider: '',
        amount: '',
        // Use local date for default value to prevent UTC offset issues
        dueDate: new Date().toLocaleDateString('en-CA'),
        type: defaultType
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-navy">Nueva Factura</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full text-secondary">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    {/* Selector de Tipo (Gasto/Cobro) */}
                    <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, type: 'PAYABLE' }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.type === 'PAYABLE' ? 'bg-white text-danger shadow-sm border border-red-100/50' : 'text-secondary opacity-60 hover:opacity-100'}`}
                        >
                            Gasto (Por Pagar)
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, type: 'RECEIVABLE' }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.type === 'RECEIVABLE' ? 'bg-white text-teal-600 shadow-sm border border-teal-100/50' : 'text-secondary opacity-60 hover:opacity-100'}`}
                        >
                            Cobro (Por Cobrar)
                        </button>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                            {formData.type === 'PAYABLE' ? 'Proveedor' : 'Cliente'}
                        </label>
                        <input
                            type="text"
                            name="provider"
                            value={formData.provider}
                            onChange={handleChange}
                            required
                            placeholder={formData.type === 'PAYABLE' ? 'Ej. CFE, AWS, Proveedor X' : 'Ej. Juan Pérez, Cliente Y'}
                            className="w-full p-4 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Concepto / Título</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            placeholder={formData.type === 'PAYABLE' ? 'Ej. Servicio de Luz Octubre' : 'Ej. Venta a Crédito Factura #102'}
                            className="w-full p-4 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-medium text-secondary"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Monto</label>
                            <input
                                type="number"
                                name="amount"
                                step="0.01"
                                value={formData.amount}
                                onChange={handleChange}
                                required
                                placeholder="0.00"
                                className="w-full p-4 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Vencimiento</label>
                            <input
                                type="date"
                                name="dueDate"
                                value={formData.dueDate}
                                onChange={handleChange}
                                required
                                className="w-full p-4 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-secondary"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`btn w-full py-4 text-base mt-2 rounded-xl shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${formData.type === 'PAYABLE' ? 'btn-primary shadow-teal-500/30 hover:shadow-teal-500/50' : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/30 hover:shadow-teal-500/50'}`}
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                        {loading ? 'Guardando...' : formData.type === 'PAYABLE' ? 'Programar Pago' : 'Programar Cobro'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BillFormModal;
