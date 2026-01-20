import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

const DayDetailsPanel = ({ onClose, date, bills = [], onBillUpdate }) => {
    const [selectedIds, setSelectedIds] = React.useState([]);

    // Calculate totals
    const totalAmount = bills.reduce((sum, bill) => sum + bill.amount, 0);

    // Calculate selected total
    const selectedTotal = bills
        .filter(b => selectedIds.includes(b.id))
        .reduce((sum, b) => sum + b.amount, 0);

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

    // Handlers
    const handlePaySelected = async () => {
        if (selectedIds.length === 0) return alert('Selecciona al menos una factura');

        if (confirm(`¿Pagar ${selectedIds.length} facturas por ${formatCurrency(selectedTotal)}?`)) {
            try {
                for (const id of selectedIds) {
                    await api.updateBill(id, { status: 'PAID' });
                }
                if (onBillUpdate) onBillUpdate();
                setSelectedIds([]);
                onClose();
            } catch (e) {
                console.error(e);
                alert('Error al procesar pagos');
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
                        await api.updateBill(id, { dueDate: newDate.toISOString() });
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
        <div className="bg-white h-full w-full lg:w-[400px] border-l border-gray-100 flex flex-col shadow-xl absolute right-0 top-0 z-10 lg:static">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold text-secondary">Pagos del {formatDate(date)}</h2>
                    <p className="text-sm text-secondary opacity-60 capitalize">{getDayName(date)}</p>
                </div>
                <button onClick={onClose} className="text-secondary hover:bg-gray-100 p-2 rounded-full">
                    <X size={20} />
                </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
                {/* Summary Row */}
                <div className="flex gap-4 mb-6">
                    <div className="flex-1">
                        <p className="text-xs font-bold text-secondary opacity-60 uppercase mb-1">Proyectado</p>
                        <p className="text-lg font-bold text-success">+$0.00</p>
                    </div>
                    <div className="flex-1 border-l pl-4 border-gray-100">
                        <p className="text-xs font-bold text-secondary opacity-60 uppercase mb-1">Por Pagar</p>
                        <p className="text-lg font-bold text-danger">-{formatCurrency(totalAmount)}</p>
                    </div>
                </div>

                {/* Alert (Conditional) */}
                {totalAmount > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex gap-3 mb-6">
                        <AlertCircle size={20} className="text-danger flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-danger mb-1">Aviso de Liquidez</p>
                            <p className="text-xs text-danger opacity-80">Tienes {bills.length} pagos programados para este día.</p>
                        </div>
                    </div>
                )}

                {/* Invoices List */}
                <div className="mb-4">
                    <h3 className="text-xs font-bold text-secondary uppercase mb-4 opacity-60">Facturas Pendientes ({bills.length})</h3>

                    <div className="flex flex-col gap-3">
                        {bills.length === 0 ? (
                            <p className="text-sm text-secondary opacity-50 italic">No hay pagos programados.</p>
                        ) : (
                            bills.map((bill) => (
                                <div
                                    key={bill.id}
                                    className={`border rounded-lg p-4 transition-all cursor-pointer ${selectedIds.includes(bill.id) ? 'border-primary bg-blue-50/50 ring-1 ring-primary' : 'border-gray-100 hover:shadow-sm'}`}
                                    onClick={() => toggleSelect(bill.id)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex gap-3 items-center">
                                            {/* Checkbox UI */}
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.includes(bill.id) ? 'bg-primary border-primary text-white' : 'border-gray-300 bg-white'}`}>
                                                {selectedIds.includes(bill.id) && <span className="text-xs font-bold">✓</span>}
                                            </div>

                                            <div>
                                                <p className="text-sm font-bold text-secondary">{bill.provider || 'Proveedor'}</p>
                                                <p className="text-xs text-secondary opacity-60">{bill.title}</p>
                                            </div>
                                        </div>
                                        <p className="text-sm font-bold text-secondary">{formatCurrency(bill.amount)}</p>
                                    </div>
                                    <div className={`ml-8 px-2 py-1 rounded text-[10px] inline-block font-bold ${bill.status === 'PENDING' ? 'bg-orange-50 text-warning' : 'bg-green-50 text-success'}`}>
                                        {bill.status === 'PENDING' ? 'Pendiente' : 'Pagado'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-100 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-secondary">
                        {selectedIds.length === 0 ? 'Ninguna seleccionada' : `Seleccionados: ${selectedIds.length}`}
                    </span>
                    <button
                        onClick={handleSelectAll}
                        className="text-primary text-sm font-bold hover:underline"
                    >
                        {selectedIds.length === bills.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleRescheduleSelected}
                        disabled={selectedIds.length === 0}
                        className="btn btn-outline bg-white hover:bg-gray-50 text-secondary border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Reprogramar
                    </button>
                    <button
                        onClick={handlePaySelected}
                        disabled={selectedIds.length === 0}
                        className="btn btn-primary bg-teal-700 hover:bg-teal-800 border-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Pagar ({formatCurrency(selectedTotal)})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DayDetailsPanel;
