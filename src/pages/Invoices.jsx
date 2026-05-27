import React, { useState, useEffect } from 'react';
import { Plus, FileText, Calendar as CalendarIcon, CheckCircle, Clock, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { api } from '../services/api';
import BillFormModal from '../components/BillFormModal';

const Invoices = () => {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState('PAYABLE'); // 'PAYABLE' | 'RECEIVABLE'

    const fetchBills = async () => {
        try {
            const data = await api.getBills();
            setBills(data);
        } catch (error) {
            console.error('Error fetching bills:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBills();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar esta factura?')) {
            try {
                await api.deleteBill(id);
                fetchBills();
            } catch (error) {
                console.error('Error deleting bill:', error);
            }
        }
    };

    const displayedBills = bills.filter(bill => (bill.type || 'PAYABLE') === activeTab);
    const isPayable = activeTab === 'PAYABLE';

    return (
        <div className="flex flex-col h-full gap-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Control de Facturas</h1>
                    <p className="text-secondary opacity-60">
                        {isPayable 
                            ? 'Gestión de gastos programados y cuentas por pagar' 
                            : 'Gestión de cobros pendientes y facturación a crédito'
                        }
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="btn btn-primary flex items-center gap-2 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 animate-fade-in"
                >
                    <Plus size={18} />
                    Nueva Factura
                </button>
            </div>

            {/* Premium Navigation Tabs */}
            <div className="flex gap-4 border-b border-gray-100 pb-px">
                <button
                    onClick={() => setActiveTab('PAYABLE')}
                    className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-bold transition-all relative ${
                        isPayable 
                            ? 'border-danger text-danger font-extrabold' 
                            : 'border-transparent text-secondary opacity-60 hover:opacity-100'
                    }`}
                >
                    <ArrowDownLeft size={16} className={isPayable ? "text-danger" : "opacity-60"} />
                    Cuentas por Pagar (Gastos)
                    <span className={`ml-2 px-2 py-0.5 text-[10px] rounded-full font-bold ${isPayable ? 'bg-red-50 text-danger' : 'bg-gray-100 text-secondary'}`}>
                        {bills.filter(b => (b.type || 'PAYABLE') === 'PAYABLE' && b.status === 'PENDING').length} pend.
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('RECEIVABLE')}
                    className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-bold transition-all relative ${
                        !isPayable 
                            ? 'border-success text-success font-extrabold' 
                            : 'border-transparent text-secondary opacity-60 hover:opacity-100'
                    }`}
                >
                    <ArrowUpRight size={16} className={!isPayable ? "text-success" : "opacity-60"} />
                    Cuentas por Cobrar (Crédito)
                    <span className={`ml-2 px-2 py-0.5 text-[10px] rounded-full font-bold ${!isPayable ? 'bg-green-50 text-success' : 'bg-gray-100 text-secondary'}`}>
                        {bills.filter(b => (b.type || 'PAYABLE') === 'RECEIVABLE' && b.status === 'PENDING').length} pend.
                    </span>
                </button>
            </div>

            {/* Invoices List Card */}
            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-[20px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/30 border-b border-gray-100">
                            <tr>
                                <th className="p-6 text-xs font-bold text-secondary uppercase tracking-wider">Detalles</th>
                                <th className="p-6 text-xs font-bold text-secondary uppercase tracking-wider">
                                    {isPayable ? 'Proveedor' : 'Cliente'}
                                </th>
                                <th className="p-6 text-xs font-bold text-secondary uppercase tracking-wider">
                                    {isPayable ? 'Fecha Vencimiento' : 'Fecha de Cobro'}
                                </th>
                                <th className="p-6 text-xs font-bold text-secondary uppercase tracking-wider">Estado</th>
                                <th className="p-6 text-xs font-bold text-secondary uppercase tracking-wider text-right">Monto</th>
                                <th className="p-6"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-secondary opacity-50">Cargando facturas...</td>
                                </tr>
                            ) : displayedBills.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-16 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-40 max-w-sm mx-auto">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isPayable ? 'bg-red-50 text-danger' : 'bg-green-50 text-success'}`}>
                                                <FileText size={24} />
                                            </div>
                                            <p className="font-bold text-navy text-base mt-2">No hay facturas programadas</p>
                                            <p className="text-xs text-secondary opacity-70">
                                                {isPayable 
                                                    ? 'No tienes gastos pendientes por pagar en este periodo.' 
                                                    : 'No has registrado ventas a crédito o cobros pendientes todavía.'
                                                }
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayedBills.map((bill) => (
                                    <tr key={bill.id} className="hover:bg-gray-50/20 transition-colors group text-sm align-middle">
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-sm ${
                                                    isPayable ? 'bg-red-50 text-danger' : 'bg-green-50 text-success'
                                                }`}>
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-navy leading-snug">{bill.title}</p>
                                                    <p className="text-xs text-secondary opacity-50">ID: #{bill.id.substring(0, 8)}...</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <p className="font-semibold text-secondary">{bill.provider || '-'}</p>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 text-secondary font-medium">
                                                <CalendarIcon size={16} className="opacity-50" />
                                                <span>{new Date(bill.dueDate + 'T12:00:00').toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            {bill.status === 'COMPLETED' || bill.status === 'PAID' || bill.status === 'COLLECTED' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-success border border-green-100">
                                                    <CheckCircle size={12} /> {isPayable ? 'Pagado' : 'Cobrado'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-warning border border-orange-100">
                                                    <Clock size={12} /> Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-6 text-right">
                                            <p className={`font-extrabold text-base ${isPayable ? 'text-danger' : 'text-success'}`}>
                                                {isPayable ? '-' : '+'}{formatCurrency(bill.amount)}
                                            </p>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button
                                                onClick={() => handleDelete(bill.id)}
                                                className="p-2 text-gray-300 hover:text-danger hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                title="Eliminar factura"
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
            </div>

            {showModal && (
                <BillFormModal
                    onClose={() => setShowModal(false)}
                    onBillAdded={fetchBills}
                />
            )}
        </div>
    );
};

export default Invoices;
