import React, { useState, useEffect } from 'react';
import { Plus, FileText, Calendar as CalendarIcon, CheckCircle, Clock, Trash2, Landmark } from 'lucide-react';
import { api } from '../services/api';
import BillFormModal from '../components/BillFormModal';
import AbonoFormModal from '../components/AbonoFormModal';

const Invoices = () => {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showAbonoModal, setShowAbonoModal] = useState(false);
    const [selectedBillForAbono, setSelectedBillForAbono] = useState(null);

    const fetchBills = async () => {
        try {
            const data = await api.getBills();
            // Filter to show only expenses (PAYABLE) on this page
            setBills(data.filter(b => b.type === 'PAYABLE' || !b.type));
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
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Facturas (Gastos)</h1>
                    <p className="text-secondary opacity-60">Gestión de gastos, compras a proveedores y cuentas por pagar</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="btn btn-primary flex items-center gap-2 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 w-full sm:w-auto justify-center"
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
                                    <tr key={bill.id} className="hover:bg-gray-50/30 transition-colors group align-middle">
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-bold">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-navy text-sm">{bill.title}</p>
                                                    <p className="text-xs text-secondary opacity-60">ID: #{bill.id.substring(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <p className="text-sm font-medium text-secondary">{bill.provider || '-'}</p>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 text-secondary text-sm">
                                                <CalendarIcon size={16} className="opacity-60" />
                                                <span>{new Date(bill.dueDate + 'T12:00:00').toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            {bill.status === 'COMPLETED' || bill.status === 'PAID' ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-success">
                                                    <CheckCircle size={12} /> Pagado
                                                </span>
                                            ) : bill.status === 'PARTIAL' ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-primary border border-indigo-100/50 w-fit">
                                                        <Clock size={10} /> Abonado: {formatCurrency(bill.paidAmount || 0)}
                                                    </span>
                                                    <span className="text-[10px] text-secondary opacity-60 font-semibold pl-1">
                                                        Pendiente: {formatCurrency(bill.amount - (bill.paidAmount || 0))}
                                                    </span>
                                                </div>
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
                                            <div className="flex items-center justify-end gap-3">
                                                {(bill.status !== 'PAID' && bill.status !== 'COMPLETED') && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBillForAbono(bill);
                                                            setShowAbonoModal(true);
                                                        }}
                                                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer select-none"
                                                        title="Registrar Pago de Abono"
                                                    >
                                                        <Landmark size={12} />
                                                        Abonar
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(bill.id)}
                                                    className="p-2 text-gray-300 hover:text-danger hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                                    title="Eliminar factura"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
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

            <AbonoFormModal
                isOpen={showAbonoModal}
                bill={selectedBillForAbono}
                onClose={() => {
                    setShowAbonoModal(false);
                    setSelectedBillForAbono(null);
                }}
                onAbonoAdded={fetchBills}
            />
        </div>
    );
};

export default Invoices;
