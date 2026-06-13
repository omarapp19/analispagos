import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, Check, Loader2, ArrowUpRight, ArrowDownRight, Landmark } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { api } from '../services/api';

const AbonoFormModal = ({ isOpen, onClose, bill, onAbonoAdded }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Divisas');
    const [exchangeRate, setExchangeRate] = useState('45.50');
    const [loading, setLoading] = useState(false);
    const [ratesLoading, setRatesLoading] = useState(true);

    // Fetch live daily exchange rates from Firestore on open
    useEffect(() => {
        if (!isOpen) return;
        
        const fetchRates = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'settings', 'exchange_rates'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.bcv) {
                        setExchangeRate(data.bcv.toString());
                    }
                }
            } catch (err) {
                console.error("Error loading exchange rates for abono:", err);
            } finally {
                setRatesLoading(false);
            }
        };

        fetchRates();
        setAmount('');
        setMethod('Divisas');
    }, [isOpen]);

    const remainingBalance = useMemo(() => {
        if (!bill) return 0;
        return bill.amount - (bill.paidAmount || 0);
    }, [bill]);

    // Check if the selected method is processed in Bolívares
    const isBsMethod = useMemo(() => {
        return ['Efectivo', 'Tarjeta', 'Pago Móvil', 'Transferencia'].includes(method);
    }, [method]);

    const calculatedBsAmount = useMemo(() => {
        const usd = parseFloat(amount) || 0;
        const rate = parseFloat(exchangeRate) || 0;
        return usd * rate;
    }, [amount, exchangeRate]);

    if (!isOpen || !bill) return null;

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    };

    const formatBs = (val) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(val);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const usdVal = parseFloat(amount) || 0;

        if (usdVal <= 0) {
            alert('Por favor ingrese un monto mayor a cero.');
            return;
        }

        if (usdVal > remainingBalance + 0.01) {
            alert(`El abono no puede superar el saldo pendiente de ${formatCurrency(remainingBalance)}.`);
            return;
        }

        setLoading(true);

        try {
            // 1. Calculate new paid amount & status
            const currentPaid = parseFloat(bill.paidAmount) || 0;
            const newPaid = currentPaid + usdVal;
            
            // Allow a tiny margin for float precision errors
            const isFullyPaid = Math.abs(newPaid - bill.amount) < 0.01 || newPaid >= bill.amount;
            const targetPaid = isFullyPaid ? bill.amount : newPaid;
            const newStatus = isFullyPaid ? 'PAID' : 'PARTIAL';

            // 2. Prepare transaction data for financial cash balance
            const isPayable = bill.type === 'PAYABLE' || !bill.type; // PAYABLE is expense, RECEIVABLE is income
            const txType = isPayable ? 'EXPENSE' : 'INCOME';
            const txCategory = isPayable ? 'Pago de Factura' : 'Cobro de Factura';
            
            let txNote = `Abono de ${formatCurrency(usdVal)} a Factura #${bill.invoiceNumber || bill.id.substring(0, 6)} (${bill.provider || 'Proveedor'}) - Ref: ${bill.title}`;
            if (isBsMethod) {
                txNote += ` | Cancelado en Bs. a tasa ${exchangeRate} Bs/$ (Total: ${formatBs(calculatedBsAmount)})`;
            }

            // 3. Update Bill or Client Invoice document
            if (bill.isClientInvoice) {
                await api.updateClientInvoice(bill.id, {
                    paidAmount: targetPaid,
                    status: newStatus
                });
            } else {
                await api.updateBill(bill.id, {
                    paidAmount: targetPaid,
                    status: newStatus
                });
            }

            // 4. Record Transaction in Box
            await api.createTransaction({
                amount: usdVal,
                method: method,
                date: new Date().toISOString().split('T')[0],
                note: txNote,
                type: txType,
                category: txCategory,
                status: 'COMPLETED',
                billId: bill.id
            });

            alert(`¡Abono de ${formatCurrency(usdVal)} registrado con éxito!`);
            if (onAbonoAdded) onAbonoAdded();
            onClose();
        } catch (error) {
            console.error("Error creating installment:", error);
            alert("Error al registrar el abono.");
        } finally {
            setLoading(false);
        }
    };

    const isPayable = bill.type === 'PAYABLE' || !bill.type;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in duration-200 border border-gray-100 flex flex-col max-h-[90vh]"
            >
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-navy text-lg font-black flex items-center gap-2">
                        <Landmark size={20} className="text-primary" />
                        {isPayable ? 'Registrar Abono (Pago)' : 'Registrar Abono (Cobro)'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-secondary transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
                    
                    {/* Invoice Status Card */}
                    <div className="bg-slate-50 border border-gray-100 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex justify-between text-xs text-secondary font-semibold">
                            <span>Factura / Gasto:</span>
                            <span className="font-bold text-navy max-w-[200px] truncate text-right">{bill.title}</span>
                        </div>
                        {bill.invoiceNumber && (
                            <div className="flex justify-between text-xs text-secondary font-semibold">
                                <span>Nro Factura:</span>
                                <span className="font-bold text-navy">#{bill.invoiceNumber}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-xs text-secondary font-semibold">
                            <span>{isPayable ? 'Proveedor:' : 'Cliente:'}</span>
                            <span className="font-bold text-navy">{bill.provider || '-'}</span>
                        </div>
                        <div className="h-px bg-slate-200/50 my-1"></div>
                        <div className="flex justify-between text-xs text-secondary font-semibold">
                            <span>Monto Total:</span>
                            <span className="font-bold text-navy">{formatCurrency(bill.amount)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-secondary font-semibold">
                            <span>Total Abonado:</span>
                            <span className="font-bold text-primary">{formatCurrency(bill.paidAmount || 0)}</span>
                        </div>
                        <div className="pt-2 border-t border-gray-200/50 flex justify-between items-baseline">
                            <span className="text-xs font-bold text-navy">Saldo Pendiente:</span>
                            <span className="text-lg font-black text-danger">{formatCurrency(remainingBalance)}</span>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div>
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 block">
                            Monto a Abonar (USD) *
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={remainingBalance}
                                required
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full pl-9 pr-4 py-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                            />
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={16} />
                            <button
                                type="button"
                                onClick={() => setAmount(remainingBalance.toFixed(2))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded text-[9px] font-black uppercase transition-all"
                            >
                                Saldo Total
                            </button>
                        </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div>
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 block">Método de Pago</label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {['Efectivo', 'Tarjeta', 'Pago Móvil', 'Transferencia', 'Divisas'].map((m) => {
                                const active = method === m;
                                return (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setMethod(m)}
                                        className={`py-2 px-3 rounded-xl border font-bold transition-all text-left flex items-center justify-between cursor-pointer select-none ${active ? 'bg-primary border-primary text-white' : 'border-gray-200 text-secondary hover:bg-slate-50'}`}
                                    >
                                        <span>{m}</span>
                                        {active && <Check size={12} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bolívares rate fields */}
                    {isBsMethod && (
                        <div className="p-4 bg-slate-50 border border-gray-150 rounded-xl space-y-3 animate-in slide-in-from-top-1 duration-150 text-xs">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-wider">Tasa de Cambio (Bs / $)</label>
                                    {ratesLoading && <Loader2 size={10} className="animate-spin text-primary" />}
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    required
                                    value={exchangeRate}
                                    onChange={(e) => setExchangeRate(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none font-bold text-navy text-xs focus:border-primary transition-all"
                                />
                            </div>
                            <div className="pt-2 border-t border-gray-200/50 flex justify-between items-center text-xs">
                                <span className="font-bold text-secondary">Total a Pagar en Bs:</span>
                                <span className="font-black text-primary text-sm">{formatBs(calculatedBsAmount)}</span>
                            </div>
                        </div>
                    )}

                    {/* Submit buttons */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full py-3.5 mt-2 flex justify-center text-sm font-bold shadow-lg"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                        {loading ? 'Procesando Abono...' : 'Confirmar y Guardar Abono'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AbonoFormModal;
