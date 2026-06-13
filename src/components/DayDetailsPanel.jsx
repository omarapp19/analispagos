import React from 'react';
import { X, AlertCircle, Landmark, Clock, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

const DayDetailsPanel = ({ onClose, date, bills = [], onBillUpdate, onAbonoClick }) => {
    const [selectedIds, setSelectedIds] = React.useState([]);
    const [showSupportModal, setShowSupportModal] = React.useState(false);
    const [activeSupportFile, setActiveSupportFile] = React.useState(null);
    const [activeSupportFileName, setActiveSupportFileName] = React.useState('');

    const openSupportModal = (file, name) => {
        setActiveSupportFile(file);
        setActiveSupportFileName(name);
        setShowSupportModal(true);
    };

    const closeSupportModal = () => {
        setShowSupportModal(false);
        setActiveSupportFile(null);
        setActiveSupportFileName('');
    };

    // Split bills
    const payables = bills.filter(b => b.type === 'PAYABLE' || !b.type);
    const receivables = bills.filter(b => b.type === 'RECEIVABLE');

    // Calculate totals based on outstanding pending amounts
    const payablesTotal = payables.reduce((sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0);
    const receivablesTotal = receivables.reduce((sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0);

    // Selected outstanding total
    const selectedTotal = bills
        .filter(b => selectedIds.includes(b.id))
        .reduce((sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0);

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

    // Bulk payment logic
    const handlePaySelected = async () => {
        if (selectedIds.length === 0) return alert('Selecciona al menos un compromiso');

        if (confirm(`¿Marcar ${selectedIds.length} compromisos seleccionados como TOTALMENTE PAGADOS/COBRADOS?`)) {
            try {
                for (const id of selectedIds) {
                    const bill = bills.find(b => b.id === id);
                    if (bill) {
                        const isPayable = bill.type === 'PAYABLE' || !bill.type;
                        const outstanding = bill.amount - (bill.paidAmount || 0);
                        
                        // 1. Update bill or client invoice status to PAID
                        if (bill.isClientInvoice) {
                            await api.updateClientInvoice(id, {
                                paidAmount: bill.amount,
                                status: 'PAID'
                            });
                        } else {
                            await api.updateBill(id, { 
                                paidAmount: bill.amount,
                                status: 'PAID' 
                            });
                        }

                        // 2. Create Transaction to reflect in box
                        await api.createTransaction({
                            amount: outstanding,
                            type: isPayable ? 'EXPENSE' : 'INCOME',
                            category: isPayable ? 'Pago de Factura' : 'Cobro de Factura',
                            note: `Pago total: ${bill.provider || (isPayable ? 'Proveedor' : 'Cliente')} (${bill.title})`,
                            date: new Date().toISOString().split('T')[0],
                            method: 'Transferencia',
                            status: 'COMPLETED',
                            billId: id
                        });
                    }
                }
                if (onBillUpdate) onBillUpdate();
                setSelectedIds([]);
                onClose();
            } catch (e) {
                console.error(e);
                alert('Error al procesar los pagos seleccionados');
            }
        }
    };

    const handleRescheduleSelected = async () => {
        if (selectedIds.length === 0) return alert('Selecciona al menos un compromiso');

        const newDateStr = prompt('Ingresa la nueva fecha para los compromisos seleccionados (YYYY-MM-DD):');
        if (newDateStr) {
            const newDate = new Date(newDateStr);
            if (!isNaN(newDate.getTime())) {
                try {
                    for (const id of selectedIds) {
                        const bill = bills.find(b => b.id === id);
                        if (bill && bill.isClientInvoice) {
                            await api.updateClientInvoice(id, { dueDate: newDate.toISOString().split('T')[0] });
                        } else {
                            await api.updateBill(id, { dueDate: newDate.toISOString().split('T')[0] });
                        }
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

    return (
        <div className="bg-white h-full w-full border-l border-gray-100 flex flex-col shadow-2xl relative z-10 animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start flex-shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-navy">
                        Compromisos del {formatDate(date)}
                    </h2>
                    <p className="text-sm text-secondary opacity-60 capitalize">{getDayName(date)}</p>
                </div>
                <button onClick={onClose} className="text-secondary hover:bg-gray-100 p-2 rounded-full cursor-pointer transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                {/* Summary Row */}
                <div className="grid grid-cols-2 gap-4 font-bold bg-slate-50 p-4 rounded-xl border border-gray-100">
                    <div>
                        <p className="text-[10px] font-bold text-secondary opacity-60 uppercase mb-0.5">Por Recibir (Cobros)</p>
                        <p className="text-base font-black text-teal-600">+{formatCurrency(receivablesTotal)}</p>
                    </div>
                    <div className="border-l pl-4 border-gray-200">
                        <p className="text-[10px] font-bold text-secondary opacity-60 uppercase mb-0.5">Por Pagar (Gastos)</p>
                        <p className="text-base font-black text-danger">-{formatCurrency(payablesTotal)}</p>
                    </div>
                </div>

                {/* List of Day Bills */}
                <div>
                    <h3 className="text-xs font-bold text-secondary uppercase mb-4 opacity-60">
                        Compromisos Pendientes ({bills.filter(b => b.status !== 'PAID' && b.status !== 'COMPLETED').length})
                    </h3>

                    <div className="flex flex-col gap-3">
                        {bills.length === 0 ? (
                            <p className="text-sm text-secondary opacity-50 italic">
                                No hay compromisos programados para este día.
                            </p>
                        ) : (
                            bills.map((bill) => {
                                const isPayable = bill.type === 'PAYABLE' || !bill.type;
                                const remaining = bill.amount - (bill.paidAmount || 0);
                                const isSelected = selectedIds.includes(bill.id);
                                const isDone = bill.status === 'PAID' || bill.status === 'COMPLETED';

                                return (
                                    <div
                                        key={bill.id}
                                        className={`border rounded-xl p-4 transition-all flex flex-col gap-3 cursor-pointer ${
                                            isSelected 
                                                ? 'border-primary bg-blue-50/20 ring-1 ring-primary' 
                                                : 'border-gray-100 hover:shadow-sm bg-white'
                                        }`}
                                        onClick={() => !isDone && toggleSelect(bill.id)}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex gap-3 items-center min-w-0">
                                                {/* Checkbox UI */}
                                                {!isDone && (
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                                        isSelected ? 'bg-primary border-primary text-white' : 'border-gray-300 bg-white'
                                                    }`}>
                                                        {isSelected && <span className="text-[10px] font-black">✓</span>}
                                                    </div>
                                                )}
                                                
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <p className="text-sm font-bold text-navy truncate" title={bill.title}>
                                                            {bill.title}
                                                        </p>
                                                        {bill.supportFile && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openSupportModal(bill.supportFile, bill.supportFileName);
                                                                }}
                                                                className="text-primary hover:text-primary-dark transition-colors inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-[9px] font-bold border border-blue-100 cursor-pointer select-none"
                                                                title="Ver documento de soporte"
                                                            >
                                                                📎 Soporte
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-secondary opacity-60 mt-0.5 truncate">
                                                        {isPayable ? `Proveedor: ${bill.provider || '-'}` : `Cliente: ${bill.provider || '-'}`}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-black text-navy">{formatCurrency(bill.amount)}</p>
                                                {bill.paidAmount > 0 && !isDone && (
                                                    <p className="text-[9px] text-primary font-bold">Abonado: {formatCurrency(bill.paidAmount)}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status and Action Row */}
                                        <div className="flex justify-between items-center border-t border-gray-50 pt-2.5 mt-0.5">
                                            {/* Status Badge */}
                                            {isDone ? (
                                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-black bg-green-50 text-success border border-green-100 animate-fade-in">
                                                    <CheckCircle size={10} /> Pagado
                                                </span>
                                            ) : bill.status === 'PARTIAL' ? (
                                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-black bg-indigo-50 text-primary border border-indigo-150/30">
                                                    <Clock size={10} /> Abonado • Restan {formatCurrency(remaining)}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-black bg-orange-50 text-warning border border-amber-100/50">
                                                    <Clock size={10} /> Pendiente
                                                </span>
                                            )}

                                            {/* Type Badge */}
                                            <div className="flex items-center gap-1.5">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                                    isPayable 
                                                        ? 'bg-red-50 text-danger border border-red-100/30' 
                                                        : 'bg-teal-50 text-teal-600 border border-teal-100/30'
                                                }`}>
                                                    {isPayable ? 'Debes (Gasto)' : 'Te deben (Cobro)'}
                                                </span>

                                                {/* Inline Abonar Button */}
                                                {!isDone && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onAbonoClick(bill);
                                                        }}
                                                        className="px-2.5 py-1 bg-primary text-white hover:bg-primary-dark rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer select-none"
                                                    >
                                                        <Landmark size={10} />
                                                        Abonar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-semibold text-secondary">
                        {selectedIds.length === 0 ? 'Ninguno seleccionado' : `Seleccionados: ${selectedIds.length}`}
                    </span>
                    <button
                        onClick={handleSelectAll}
                        className="text-primary text-xs font-extrabold hover:underline cursor-pointer"
                    >
                        {selectedIds.length === bills.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleRescheduleSelected}
                        disabled={selectedIds.length === 0}
                        className="btn btn-outline bg-white hover:bg-gray-50 text-secondary border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 rounded-xl text-xs font-black cursor-pointer"
                    >
                        Reprogramar
                    </button>
                    <button
                        onClick={handlePaySelected}
                        disabled={selectedIds.length === 0}
                        className="btn bg-primary text-white border-none hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed py-2.5 rounded-xl text-xs font-black cursor-pointer shadow-md shadow-teal-500/20"
                    >
                        Completar ({formatCurrency(selectedTotal)})
                    </button>
                </div>
            </div>

            {/* Support Document Modal */}
            {showSupportModal && activeSupportFile && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-navy flex items-center gap-2">
                                    📎 Documento de Soporte
                                </h3>
                                <p className="text-xs text-secondary opacity-60 mt-0.5 truncate max-w-lg">
                                    {activeSupportFileName}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = activeSupportFile;
                                        link.download = activeSupportFileName || 'soporte_factura';
                                        link.click();
                                    }}
                                    className="px-3 py-1.5 bg-primary text-white hover:bg-primary-dark rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    Descargar
                                </button>
                                <button 
                                    onClick={closeSupportModal} 
                                    className="p-2 rounded-full text-secondary hover:bg-gray-100 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Body (Preview) */}
                        <div className="flex-1 overflow-auto p-6 bg-slate-50 flex items-center justify-center">
                            {activeSupportFile.startsWith('data:application/pdf') ? (
                                <iframe 
                                    src={activeSupportFile} 
                                    className="w-full h-[65vh] rounded-xl border border-gray-200 bg-white" 
                                    title="Soporte PDF"
                                />
                            ) : (
                                <img 
                                    src={activeSupportFile} 
                                    alt="Documento Soporte" 
                                    className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md bg-white border border-gray-100"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.style.display = 'none';
                                        alert('No se pudo previsualizar la imagen.');
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DayDetailsPanel;
