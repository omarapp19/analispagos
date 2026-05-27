import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Landmark, Calendar, Check, Loader2, Smartphone, Coins } from 'lucide-react';
import { api } from '../services/api';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const SalesForm = ({ onSaleAdded }) => {
    const [loading, setLoading] = useState(false);

    // State for exchange rates loaded from configuration
    const [rates, setRates] = useState({
        tasaBcv: 40.50,
        tasaEuro: 44.00,
        tasaBinance: 41.80,
        tasaPromedio: 41.50
    });

    // Currencies configuration - Tarjeta, Pago Móvil, and Transferencia are locked strictly to Bs. (Tasa BCV)
    const [currencies, setCurrencies] = useState({
        Efectivo: 'tasaPromedio',
        Tarjeta: 'tasaBcv', // Locked
        'Pago Móvil': 'tasaBcv', // Locked
        Transferencia: 'tasaBcv', // Locked
        Divisas: 'USD' // Fixed USD
    });

    // State for multiple amounts (entered raw values in local currency or USD)
    const [amounts, setAmounts] = useState({
        Efectivo: '',
        Tarjeta: '',
        'Pago Móvil': '',
        Transferencia: '',
        Divisas: ''
    });

    const [commonData, setCommonData] = useState({
        // Use local date for default value to prevent UTC offset issues
        date: new Date().toLocaleDateString('en-CA'),
        note: ''
    });

    const [total, setTotal] = useState(0);

    // Fetch exchange rates from Firestore settings on mount
    useEffect(() => {
        const fetchRates = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'settings', 'global_settings'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setRates({
                        tasaBcv: parseFloat(data.tasaBcv) || 40.50,
                        tasaEuro: parseFloat(data.tasaEuro) || 44.00,
                        tasaBinance: parseFloat(data.tasaBinance) || 41.80,
                        tasaPromedio: parseFloat(data.tasaPromedio) || 41.50
                    });
                }
            } catch (err) {
                console.warn("Could not fetch rates in SalesForm:", err);
            }
        };
        fetchRates();
    }, []);

    // Calculate converted USD value for a specific field
    const getConvertedAmount = (method, value) => {
        const numVal = parseFloat(value) || 0;
        const currency = currencies[method];
        if (currency === 'USD') return numVal;
        
        const rate = rates[currency] || 1;
        return rate > 0 ? numVal / rate : 0;
    };

    // Calculate total USD sum whenever amounts, currencies or rates change
    useEffect(() => {
        const sum = Object.entries(amounts).reduce((acc, [method, val]) => {
            return acc + getConvertedAmount(method, val);
        }, 0);
        setTotal(sum);
    }, [amounts, currencies, rates]);

    const handleAmountChange = (method, value) => {
        setAmounts(prev => ({ ...prev, [method]: value }));
    };

    const handleCommonChange = (e) => {
        setCommonData({ ...commonData, [e.target.name]: e.target.value });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (total <= 0) {
            alert('Por favor ingresa un monto válido');
            return;
        }

        setLoading(true);
        try {
            // Create a transaction in USD for each non-zero amount
            const promises = Object.entries(amounts)
                .filter(([_, amount]) => parseFloat(amount) > 0)
                .map(([method, amount]) => {
                    const convertedUsd = getConvertedAmount(method, amount);
                    const curr = currencies[method];
                    
                    // Generate specific conversion details for the note
                    let conversionNote = '';
                    if (curr !== 'USD') {
                        const rateName = curr.replace('tasa', '').toUpperCase();
                        const rateVal = rates[curr];
                        conversionNote = `[Bs. ${parseFloat(amount).toLocaleString()} convertidos a Tasa ${rateName}: ${rateVal.toFixed(2)}]`;
                    }

                    const txNote = commonData.note 
                        ? `${commonData.note} ${conversionNote}`.trim()
                        : `${method} ${conversionNote}`.trim();

                    return api.createTransaction({
                        amount: parseFloat(convertedUsd.toFixed(2)),
                        method: method, // 'Efectivo', 'Tarjeta', etc.
                        date: commonData.date,
                        note: txNote,
                        type: 'INCOME',
                        category: 'Venta',
                        status: 'COMPLETED'
                    });
                });

            await Promise.all(promises);

            // Reset form
            setAmounts({ Efectivo: '', Tarjeta: '', 'Pago Móvil': '', Transferencia: '', Divisas: '' });
            setCommonData(prev => ({ ...prev, note: '' })); // Keep date

            if (onSaleAdded) onSaleAdded();
        } catch (error) {
            console.error('Error creating sale:', error);
            alert('Error al registrar la venta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card h-full flex flex-col bg-white">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-primary shadow-sm flex-shrink-0">
                    <Coins size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-navy">Registrar Venta</h3>
                    <p className="text-sm text-secondary opacity-60">Ingreso multimoneda con conversión automática</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {/* Total Display */}
                <div className="bg-primary/5 rounded-2xl p-4 text-center border border-primary/10">
                    <p className="text-[10px] font-bold text-secondary opacity-60 uppercase tracking-wider mb-0.5">Total a Registrar (USD)</p>
                    <p className="text-3xl font-black text-primary">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>

                {/* Amount Inputs */}
                <div className="space-y-4">
                    {/* Cash */}
                    <div className="relative">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-green-50 text-success flex items-center justify-center"><DollarSign size={12} /></div>
                                <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Efectivo</label>
                            </div>
                            <select 
                                value={currencies.Efectivo} 
                                onChange={(e) => setCurrencies(prev => ({ ...prev, Efectivo: e.target.value }))}
                                className="text-[10px] font-extrabold text-secondary bg-background rounded-lg px-2 py-0.5 outline-none cursor-pointer border border-gray-100 focus:border-primary"
                            >
                                <option value="tasaPromedio">Bs. (Promedio)</option>
                                <option value="tasaBcv">Bs. (BCV)</option>
                                <option value="tasaBinance">Bs. (Binance)</option>
                                <option value="USD">USD ($)</option>
                            </select>
                        </div>
                        <input
                            id="sales-form-input"
                            type="number"
                            step="0.01"
                            value={amounts.Efectivo}
                            onChange={(e) => handleAmountChange('Efectivo', e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border-2 border-transparent focus:border-green-400 focus:bg-white outline-none font-bold text-navy text-sm transition-all"
                        />
                        {amounts.Efectivo && currencies.Efectivo !== 'USD' && (
                            <p className="text-[10px] font-bold text-success/80 mt-1 pl-1 bg-green-50/30 py-0.5 rounded-lg w-fit px-2">
                                ≈ {formatCurrency(getConvertedAmount('Efectivo', amounts.Efectivo))} USD (Tasa: {rates[currencies.Efectivo].toFixed(2)})
                            </p>
                        )}
                    </div>

                    {/* Card (Locked to Bs. Tasa BCV) */}
                    <div className="relative">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"><CreditCard size={12} /></div>
                                <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Tarjeta</label>
                            </div>
                            <span className="text-[9px] font-extrabold text-secondary opacity-60 bg-background rounded-md px-2 py-0.5 border border-gray-150">
                                Bs. (Tasa BCV)
                            </span>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            value={amounts.Tarjeta}
                            onChange={(e) => handleAmountChange('Tarjeta', e.target.value)}
                            placeholder="0.00 Bs."
                            className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none font-bold text-navy text-sm transition-all"
                        />
                        {amounts.Tarjeta && (
                            <p className="text-[10px] font-bold text-blue-500/80 mt-1 pl-1 bg-blue-50/30 py-0.5 rounded-lg w-fit px-2">
                                ≈ {formatCurrency(getConvertedAmount('Tarjeta', amounts.Tarjeta))} USD (Tasa: {rates.tasaBcv.toFixed(2)})
                            </p>
                        )}
                    </div>

                    {/* Pago Móvil (Locked to Bs. Tasa BCV) */}
                    <div className="relative">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center"><Smartphone size={12} /></div>
                                <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Pago Móvil</label>
                            </div>
                            <span className="text-[9px] font-extrabold text-secondary opacity-60 bg-background rounded-md px-2 py-0.5 border border-gray-150">
                                Bs. (Tasa BCV)
                            </span>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            value={amounts['Pago Móvil']}
                            onChange={(e) => handleAmountChange('Pago Móvil', e.target.value)}
                            placeholder="0.00 Bs."
                            className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border-2 border-transparent focus:border-pink-400 focus:bg-white outline-none font-bold text-navy text-sm transition-all"
                        />
                        {amounts['Pago Móvil'] && (
                            <p className="text-[10px] font-bold text-pink-500/80 mt-1 pl-1 bg-pink-50/30 py-0.5 rounded-lg w-fit px-2">
                                ≈ {formatCurrency(getConvertedAmount('Pago Móvil', amounts['Pago Móvil']))} USD (Tasa: {rates.tasaBcv.toFixed(2)})
                            </p>
                        )}
                    </div>

                    {/* Transferencia (Locked to Bs. Tasa BCV) */}
                    <div className="relative">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center"><Landmark size={12} /></div>
                                <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Transferencia</label>
                            </div>
                            <span className="text-[9px] font-extrabold text-secondary opacity-60 bg-background rounded-md px-2 py-0.5 border border-gray-150">
                                Bs. (Tasa BCV)
                            </span>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            value={amounts.Transferencia}
                            onChange={(e) => handleAmountChange('Transferencia', e.target.value)}
                            placeholder="0.00 Bs."
                            className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border-2 border-transparent focus:border-purple-400 focus:bg-white outline-none font-bold text-navy text-sm transition-all"
                        />
                        {amounts.Transferencia && (
                            <p className="text-[10px] font-bold text-purple-500/80 mt-1 pl-1 bg-purple-50/30 py-0.5 rounded-lg w-fit px-2">
                                ≈ {formatCurrency(getConvertedAmount('Transferencia', amounts.Transferencia))} USD (Tasa: {rates.tasaBcv.toFixed(2)})
                            </p>
                        )}
                    </div>

                    {/* Divisas (fijo en USD) */}
                    <div className="relative">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center"><DollarSign size={12} /></div>
                                <label className="text-[11px] font-bold text-secondary uppercase tracking-wider">Divisas (USD / Zelle)</label>
                            </div>
                            <span className="text-[9px] font-extrabold text-secondary opacity-60 bg-background rounded-md px-2 py-0.5 border border-gray-150">
                                USD ($)
                            </span>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            value={amounts.Divisas}
                            onChange={(e) => handleAmountChange('Divisas', e.target.value)}
                            placeholder="0.00 $"
                            className="w-full pl-4 pr-4 py-2.5 bg-background rounded-xl border-2 border-transparent focus:border-orange-400 focus:bg-white outline-none font-bold text-navy text-sm transition-all"
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
                                className="w-full pl-4 pr-10 py-2.5 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none text-sm font-bold text-secondary"
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
                            placeholder="Detalles sobre el registro de venta..."
                            className="w-full p-4 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none text-sm font-medium text-secondary resize-none h-20 placeholder:text-gray-300"
                        ></textarea>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || total <= 0}
                    className="btn btn-primary w-full py-4 text-base mt-2 rounded-xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 disabled:opacity-70 disabled:cursor-not-allowed mb-2 cursor-pointer"
                >
                    {loading ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : (
                        <Check size={20} />
                    )}
                    {loading ? 'Guardando...' : `Registrar Total: $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </button>
            </form>
        </div>
    );
};

export default SalesForm;
