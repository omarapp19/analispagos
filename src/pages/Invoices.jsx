import React, { useState, useEffect } from 'react';
import { Plus, FileText, Calendar as CalendarIcon, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import BillFormModal from '../components/BillFormModal';

const Invoices = () => {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

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

    return (
        <div className="flex flex-col h-full gap-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Facturas</h1>
                    <p className="text-secondary opacity-60">Gestión de gastos y cuentas por pagar</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="btn btn-primary flex items-center gap-2 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50"
                >
                    <Plus size={18} />
                    Nueva Factura
                </button>
            </div>

            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-3xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="p-6 text-xs font-bold text-secondary uppercase tracking-wider">Detalles</th>
                                <th className="p-6 text-xs font-bold text-secondary uppercase tracking-wider">Proveedor</th>
                                <th className="p-6 text-xs font-bold text-secondary uppercase tracking-wider">Fecha Vencimiento</th>
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
                            ) : bills.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-40">
                                            <FileText size={48} />
                                            <p className="font-medium text-secondary">No hay facturas registradas</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                bills.map((bill) => (
                                    <tr key={bill.id} className="hover:bg-gray-50/30 transition-colors group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-bold">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-navy text-sm">{bill.title}</p>
                                                    <p className="text-xs text-secondary opacity-60">ID: #{bill.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <p className="text-sm font-medium text-secondary">{bill.provider || '-'}</p>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 text-secondary text-sm">
                                                <CalendarIcon size={16} className="opacity-60" />
                                                <span>{new Date(bill.dueDate).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            {bill.status === 'COMPLETED' || bill.status === 'PAID' ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-success">
                                                    <CheckCircle size={12} /> Pagado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-warning">
                                                    <Clock size={12} /> Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-6 text-right">
                                            <p className="font-bold text-navy">{formatCurrency(bill.amount)}</p>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button
                                                onClick={() => handleDelete(bill.id)}
                                                className="p-2 text-gray-300 hover:text-danger hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                title="Eliminar factura"
                                            >
                                                <Trash2 size={18} />
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
