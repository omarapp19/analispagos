import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Landmark, Calendar, Check, Loader2, Smartphone } from 'lucide-react';
import { api } from '../services/api';

const SalesForm = ({ onSaleAdded }) => {
    const [loading, setLoading] = useState(false);

    // State for multiple amounts
    const [amounts, setAmounts] = useState({
        Efectivo: '',
        Tarjeta: '',
        'Pago Móvil': '',
        Transferencia: '',
        Divisas: ''
    });

    const [commonData, setCommonData] = useState({
        // Use local date for default value to prevent UTC offset issues (e.g. showing tomorrow late at night)
        date: new Date().toLocaleDateString('en-CA'), // Returns YYYY-MM-DD in local time
        note: ''
    });

    const [total, setTotal] = useState(0);

    // Calculate total whenever amounts change
    useEffect(() => {
        const sum = Object.values(amounts).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
        setTotal(sum);
    }, [amounts]);

    const handleAmountChange = (method, value) => {
        setAmounts(prev => ({ ...prev, [method]: value }));
    };

    const handleCommonChange = (e) => {
        setCommonData({ ...commonData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (total <= 0) {
            alert('Por favor ingresa un monto válido');
            return;
        }

        setLoading(true);
        try {
            // Create a transaction for each non-zero amount
            const promises = Object.entries(amounts)
                .filter(([_, amount]) => parseFloat(amount) > 0)
                .map(([method, amount]) => {
                    return api.createTransaction({
                        amount: parseFloat(amount),
                        method: method, // 'Efectivo', 'Tarjeta', 'Transferencia'
                        date: commonData.date,
                        note: commonData.note,
                        type: 'INCOME',
                        category: 'Venta',
                        status: 'COMPLETED'
                    });
                });

            await Promise.all(promises);

            // Reset form
            setAmounts({ Efectivo: '', Tarjeta: '', 'Pago Móvil': '', Transferencia: '', Divisas: '' });
            setCommonData(prev => ({ ...prev, note: '' })); // Keep date? or reset? user usually wants same date

            if (onSaleAdded) onSaleAdded();
        } catch (error) {
            console.error('Error creating sale:', error);
            alert('Error al registrar la venta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card h-full flex flex-col">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-primary shadow-sm flex-shrink-0">
                    <DollarSign size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-navy">Registrar Venta</h3>
                    <p className="text-sm text-secondary opacity-60">Ingreso detallado por método</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {/* Total Display */}
                <div className="bg-primary/5 rounded-2xl p-4 text-center border border-primary/10">
                    <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-1">Total a Registrar</p>
                    <p className="text-3xl font-bold text-primary">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>

                {/* Amount Inputs */}
                <div className="space-y-3">
                    {/* Cash */}
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-6 h-6 rounded-full bg-green-50 text-success flex items-center justify-center"><DollarSign size={14} /></div>
                            <label className="text-xs font-bold text-secondary uppercase">Efectivo</label>
                        </div>
                        <input
                            id="sales-form-input" // Target for Dashboard focus
                            type="number"
                            step="0.01"
                            value={amounts.Efectivo}
                            onChange={(e) => handleAmountChange('Efectivo', e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-4 pr-4 py-3 bg-background rounded-xl border-2 border-transparent focus:border-green-400 focus:bg-white outline-none font-bold text-navy transition-all"
                        />
                    </div>

                    {/* Card */}
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"><CreditCard size={14} /></div>
                            <label className="text-xs font-bold text-secondary uppercase">Tarjeta</label>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            value={amounts.Tarjeta}
                            onChange={(e) => handleAmountChange('Tarjeta', e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-4 pr-4 py-3 bg-background rounded-xl border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none font-bold text-navy transition-all"
                        />
                    </div>

                    {/* Pago Móvil */}
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-6 h-6 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center"><Smartphone size={14} /></div>
                            <label className="text-xs font-bold text-secondary uppercase">Pago Móvil</label>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            value={amounts['Pago Móvil']}
                            onChange={(e) => handleAmountChange('Pago Móvil', e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-4 pr-4 py-3 bg-background rounded-xl border-2 border-transparent focus:border-pink-400 focus:bg-white outline-none font-bold text-navy transition-all"
                        />
                    </div>

                    {/* Transfer */}
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-6 h-6 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center"><Landmark size={14} /></div>
                            <label className="text-xs font-bold text-secondary uppercase">Transferencia</label>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            value={amounts.Transferencia}
                            onChange={(e) => handleAmountChange('Transferencia', e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-4 pr-4 py-3 bg-background rounded-xl border-2 border-transparent focus:border-purple-400 focus:bg-white outline-none font-bold text-navy transition-all"
                        />
                    </div>

                    {/* Divisas */}
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-6 h-6 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center"><DollarSign size={14} /></div>
                            <label className="text-xs font-bold text-secondary uppercase">Divisas</label>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            value={amounts.Divisas}
                            onChange={(e) => handleAmountChange('Divisas', e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-4 pr-4 py-3 bg-background rounded-xl border-2 border-transparent focus:border-orange-400 focus:bg-white outline-none font-bold text-navy transition-all"
                        />
                    </div>
                </div>

                {/* Date & Note */}
                <div className="grid grid-cols-1 gap-4 mt-2">
                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Fecha</label>
                        <div className="relative">
                            <input
                                type="date"
                                name="date"
                                value={commonData.date}
                                onChange={handleCommonChange}
                                required
                                className="w-full pl-4 pr-10 py-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none text-sm font-bold text-secondary"
                            />
                            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary pointer-events-none opacity-50" size={18} />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">Nota (Opcional)</label>
                        <textarea
                            name="note"
                            value={commonData.note}
                            onChange={handleCommonChange}
                            placeholder="Detalles..."
                            className="w-full p-4 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none text-sm font-medium text-secondary resize-none h-20 placeholder:text-gray-300"
                        ></textarea>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || total <= 0}
                    className="btn btn-primary w-full py-4 text-base mt-2 rounded-xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 disabled:opacity-70 disabled:cursor-not-allowed mb-2"
                >
                    {loading ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] mr-1"><Check size={12} strokeWidth={4} /></div>
                    )}
                    {loading ? 'Guardando...' : `Guardar Total: $${total.toLocaleString()}`}
                </button>
            </form>
        </div>
    );
};

export default SalesForm;
