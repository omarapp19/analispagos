import React from 'react';
import { X, AlertCircle, ArrowUpRight, ArrowDownLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

const DayDetailsPanel = ({ onClose, date, bills = [], onBillUpdate }) => {
    const [selectedIds, setSelectedIds] = React.useState([]);

    // Split bills by type (receivable vs payable)
    const payables = bills.filter(b => (b.type || 'PAYABLE') === 'PAYABLE');
    const receivables = bills.filter(b => (b.type || 'PAYABLE') === 'RECEIVABLE');

    // Calculate daily totals
    const totalPayable = payables.reduce((sum, b) => sum + b.amount, 0);
    const totalReceivable = receivables.reduce((sum, b) => sum + b.amount, 0);

    // Calculate selected totals
    const selectedPayables = payables.filter(b => selectedIds.includes(b.id));
    const selectedReceivables = receivables.filter(b => selectedIds.includes(b.id));

    const selectedPayableTotal = selectedPayables.reduce((sum, b) => sum + b.amount, 0);
    const selectedReceivableTotal = selectedReceivables.reduce((sum, b) => sum + b.amount, 0);

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === bills.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(bills.map(b => b.id));
        }
    };

    // Helper formats
    const formatDate = (dateObj) => {
        if (!dateObj) return '';
        return new Date(dateObj).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    const getDayName = (dateObj) => {
        if (!dateObj) return '';
        return new Date(dateObj).toLocaleDateString('es-ES', { weekday: 'long' });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // Unified processing handler (processes payments for payables, collections for receivables)
    const handleProcessSelected = async () => {
        if (selectedIds.length === 0) return alert('Selecciona al menos una factura');

        let msg = '¿Deseas procesar ';
        if (selectedPayables.length > 0) {
            msg += `${selectedPayables.length} pagos (${formatCurrency(selectedPayableTotal)})`;
        }
        if (selectedPayables.length > 0 && selectedReceivables.length > 0) {
            msg += ' y ';
        }
        if (selectedReceivables.length > 0) {
            msg += `${selectedReceivables.length} cobros (${formatCurrency(selectedReceivableTotal)})`;
        }
        msg += '?';

        if (confirm(msg)) {
            try {
                // 1. Process Payables (mark PAID + create EXPENSE)
                for (const bill of selectedPayables) {
                    await api.updateBill(bill.id, { status: 'PAID' });
                    await api.createTransaction({
                        amount: bill.amount,
                        type: 'EXPENSE',
                        category: 'Pago de Factura',
                        note: `Pago a: ${bill.provider || 'Proveedor'} (${bill.title})`,
                        date: new Date().toISOString().split('T')[0],
                        method: 'Transferencia', // Default
                        status: 'COMPLETED'
                    });
                }

                // 2. Process Receivables (mark COLLECTED + create INCOME)
                for (const bill of selectedReceivables) {
                    await api.updateBill(bill.id, { status: 'COLLECTED' }); // or PAID
                    await api.createTransaction({
                        amount: bill.amount,
                        type: 'INCOME',
                        category: 'Cobro de Crédito',
                        note: `Cobro a cliente: ${bill.provider || 'Cliente'} (${bill.title})`,
                        date: new Date().toISOString().split('T')[0],
                        method: 'Transferencia', // Default
                        status: 'COMPLETED'
                    });
                }

                if (onBillUpdate) onBillUpdate();
                setSelectedIds([]);
                onClose();
            } catch (e) {
                console.error(e);
                alert('Error al procesar las transacciones');
            }
        }
    };

    const handleRescheduleSelected = async () => {
        if (selectedIds.length === 0) return alert('Selecciona al menos una factura');

        const newDateStr = prompt('Ingresa la nueva fecha para las facturas seleccionadas (YYYY-MM-DD):');
        if (newDateStr) {
            const newDate = new Date(newDateStr);
            if (!isNaN(newDate.getTime())) {
                try {
                    for (const id of selectedIds) {
                        await api.updateBill(id, { dueDate: newDateStr }); // save YYYY-MM-DD
                    }
                    if (onBillUpdate) onBillUpdate();
                    setSelectedIds([]);
                    onClose();
                } catch (e) {
                    console.error(e);
                    alert('Error al reprogramar');
                }
            } else {
                alert('Fecha inválida');
            }
        }
    };

    // Calculate action button text dynamically
    const getActionButtonText = () => {
        if (selectedPayables.length > 0 && selectedReceivables.length > 0) {
            return `Procesar (${formatCurrency(selectedPayableTotal + selectedReceivableTotal)})`;
        }
        if (selectedReceivables.length > 0) {
            return `Cobrar (${formatCurrency(selectedReceivableTotal)})`;
        }
        if (selectedPayables.length > 0) {
            return `Pagar (${formatCurrency(selectedPayableTotal)})`;
        }
        return 'Procesar';
    };

    const getActionButtonColor = () => {
        if (selectedPayables.length > 0 && selectedReceivables.length > 0) {
            return 'bg-primary hover:bg-primary/90';
        }
        if (selectedReceivables.length > 0) {
            return 'bg-success hover:bg-success/90 shadow-green-500/10';
        }
        return 'bg-danger hover:bg-danger/90 shadow-red-500/10';
    };

    return (
        <div className="bg-white h-full w-full lg:w-[420px] border-l border-gray-100 flex flex-col shadow-xl absolute right-0 top-0 z-10 lg:static animate-slide-in">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold text-navy">Plan del {formatDate(date)}</h2>
                    <p className="text-sm text-secondary opacity-60 capitalize font-medium">{getDayName(date)}</p>
                </div>
                <button onClick={onClose} className="text-secondary hover:bg-gray-100 p-2 rounded-full transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {/* Summary Cash Flow Row */}
                <div className="flex gap-4 bg-background p-4 rounded-2xl border border-gray-50 text-center">
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-secondary opacity-60 uppercase mb-0.5">Ingresos (Cobros)</p>
                        <p className="text-lg font-extrabold text-success">+{formatCurrency(totalReceivable)}</p>
                    </div>
                    <div className="flex-1 border-l border-gray-200/60">
                        <p className="text-[10px] font-bold text-secondary opacity-60 uppercase mb-0.5">Egresos (Pagos)</p>
                        <p className="text-lg font-extrabold text-danger">-{formatCurrency(totalPayable)}</p>
                    </div>
                    <div className="flex-1 border-l border-gray-200/60">
                        <p className="text-[10px] font-bold text-secondary opacity-60 uppercase mb-0.5">Balance Neto</p>
                        <p className={`text-lg font-extrabold ${totalReceivable - totalPayable >= 0 ? 'text-success' : 'text-danger'}`}>
                            {totalReceivable - totalPayable >= 0 ? '+' : ''}{formatCurrency(totalReceivable - totalPayable)}
                        </p>
                    </div>
                </div>

                {/* Liquidity Alert */}
                {totalPayable > 0 && totalReceivable === 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3">
                        <AlertCircle size={20} className="text-danger flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-danger mb-0.5">Alerta de Egreso Único</p>
                            <p className="text-[11px] text-danger opacity-85 leading-snug">Tienes egresos programados sin ingresos proyectados para este día. Planifica tus saldos.</p>
                        </div>
                    </div>
                )}

                {/* Section: Cuentas por Cobrar */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-success uppercase tracking-wider flex items-center gap-2">
                        <ArrowUpRight size={14} />
                        Cuentas por Cobrar ({receivables.length})
                    </h3>
                    
                    {receivables.length === 0 ? (
                        <p className="text-xs text-secondary opacity-50 italic pl-1">No hay cobros programados para esta fecha.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {receivables.map(b => (
                                <div
                                    key={b.id}
                                    onClick={() => toggleSelect(b.id)}
                                    className={`border rounded-xl p-3.5 transition-all cursor-pointer flex items-center justify-between ${
                                        selectedIds.includes(b.id) 
                                            ? 'border-success bg-green-50/20 ring-1 ring-success shadow-sm' 
                                            : 'border-gray-100 hover:bg-slate-50/30'
                                    }`}
                                >
                                    <div className="flex gap-3 items-center min-w-0">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                            selectedIds.includes(b.id) ? 'bg-success border-success text-white' : 'border-gray-300 bg-white'
                                        }`}>
                                            {selectedIds.includes(b.id) && <span className="text-[10px] font-black">✓</span>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-navy truncate">{b.provider || 'Cliente'}</p>
                                            <p className="text-xs text-secondary opacity-60 truncate font-medium">{b.title}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-extrabold text-success flex-shrink-0">+{formatCurrency(b.amount)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section: Cuentas por Pagar */}
                <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-danger uppercase tracking-wider flex items-center gap-2">
                        <ArrowDownLeft size={14} />
                        Cuentas por Pagar ({payables.length})
                    </h3>
                    
                    {payables.length === 0 ? (
                        <p className="text-xs text-secondary opacity-50 italic pl-1">No hay pagos programados para esta fecha.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {payables.map(b => (
                                <div
                                    key={b.id}
                                    onClick={() => toggleSelect(b.id)}
                                    className={`border rounded-xl p-3.5 transition-all cursor-pointer flex items-center justify-between ${
                                        selectedIds.includes(b.id) 
                                            ? 'border-danger bg-red-50/20 ring-1 ring-danger shadow-sm' 
                                            : 'border-gray-100 hover:bg-slate-50/30'
                                    }`}
                                >
                                    <div className="flex gap-3 items-center min-w-0">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                            selectedIds.includes(b.id) ? 'bg-danger border-danger text-white' : 'border-gray-300 bg-white'
                                        }`}>
                                            {selectedIds.includes(b.id) && <span className="text-[10px] font-black">✓</span>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-navy truncate">{b.provider || 'Proveedor'}</p>
                                            <p className="text-xs text-secondary opacity-60 truncate font-medium">{b.title}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-extrabold text-danger flex-shrink-0">-{formatCurrency(b.amount)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-100 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-secondary">
                        {selectedIds.length === 0 ? 'Ninguna seleccionada' : `Seleccionadas: ${selectedIds.length}`}
                    </span>
                    <button
                        onClick={handleSelectAll}
                        className="text-primary text-xs font-bold hover:underline"
                    >
                        {selectedIds.length === bills.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleRescheduleSelected}
                        disabled={selectedIds.length === 0}
                        className="btn btn-outline bg-white hover:bg-gray-50 text-secondary border-gray-300 text-xs font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all"
                    >
                        Reprogramar
                    </button>
                    <button
                        onClick={handleProcessSelected}
                        disabled={selectedIds.length === 0}
                        className={`btn text-white text-xs font-bold py-3 border-none disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md ${getActionButtonColor()}`}
                    >
                        <CheckCircle2 size={15} />
                        {getActionButtonText()}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DayDetailsPanel;
