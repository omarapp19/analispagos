import React, { useState, useEffect, useMemo } from 'react';
import { Plus, FileText, Calendar as CalendarIcon, CheckCircle, Clock, Trash2, Landmark, Filter, Search } from 'lucide-react';
import { api } from '../services/api';
import BillFormModal from '../components/BillFormModal';
import ExpenseFormModal from '../components/ExpenseFormModal';
import AbonoFormModal from '../components/AbonoFormModal';

const Invoices = () => {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showAbonoModal, setShowAbonoModal] = useState(false);
    const [selectedBillForAbono, setSelectedBillForAbono] = useState(null);
    const [filter, setFilter] = useState('ALL'); // 'ALL' | 'PENDING_DESC' | 'PAID'
    const [searchTerm, setSearchTerm] = useState('');
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [activeSupportFile, setActiveSupportFile] = useState(null);
    const [activeSupportFileName, setActiveSupportFileName] = useState('');

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

    const filteredBills = useMemo(() => {
        // Filter by provider or details search term
        const searched = bills.filter(b => {
            const term = searchTerm.toLowerCase().trim();
            if (!term) return true;
            return (
                (b.provider || '').toLowerCase().includes(term) ||
                (b.title || '').toLowerCase().includes(term) ||
                (b.invoiceNumber || '').toLowerCase().includes(term)
            );
        });

        const pending = searched.filter(b => b.status !== 'PAID' && b.status !== 'COMPLETED');
        const paid = searched.filter(b => b.status === 'PAID' || b.status === 'COMPLETED');

        // Sort pending: de mayor a menor (highest to lowest amount)
        const sortedPending = [...pending].sort((a, b) => b.amount - a.amount);
        // Sort paid: de mayor a menor (highest to lowest amount)
        const sortedPaid = [...paid].sort((a, b) => b.amount - a.amount);

        if (filter === 'PENDING_DESC') {
            return sortedPending;
        } else if (filter === 'PAID') {
            return sortedPaid;
        } else {
            // 'ALL' -> pending de mayor a menor first, paid at the end
            return [...sortedPending, ...sortedPaid];
        }
    }, [bills, filter, searchTerm]);

    return (
        <div className="flex flex-col h-full gap-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Facturas (Gastos)</h1>
                    <p className="text-secondary opacity-60">Gestión de gastos, compras a proveedores y cuentas por pagar</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn btn-primary flex items-center gap-2 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 justify-center text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                    >
                        <Plus size={16} />
                        Nueva Compra (Inventario)
                    </button>
                    <button
                        onClick={() => setShowExpenseModal(true)}
                        className="btn bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2 shadow-lg justify-center text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                        <Plus size={16} />
                        Registrar Gasto (Nómina/Servicios)
                    </button>
                </div>
            </div>

            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-3xl">
                {/* Filter Toolbar */}
                <div className="p-4 px-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/20">
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        <div className="text-sm font-bold text-navy whitespace-nowrap">
                            Facturas: {filteredBills.length}
                        </div>
                        {/* Search Input for Provider / Details */}
                        <div className="relative w-full sm:w-64">
                            <input 
                                type="text" 
                                placeholder="Buscar por proveedor o detalle..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-background rounded-xl border border-gray-200 outline-none text-xs text-secondary font-bold focus:border-primary transition-all"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={14} />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <div className="relative flex items-center bg-background rounded-xl px-3 py-2 border border-gray-200 text-xs font-bold text-secondary w-full sm:w-auto">
                            <Filter size={14} className="text-primary mr-2" />
                            <select 
                                value={filter} 
                                onChange={(e) => setFilter(e.target.value)}
                                className="bg-transparent focus:outline-none pr-4 cursor-pointer text-navy font-bold w-full sm:w-auto"
                            >
                                <option value="ALL">Todas (Pendientes primero de mayor a menor, Pagadas al final)</option>
                                <option value="PENDING_DESC">Pendientes (Mayor a Menor)</option>
                                <option value="PAID">Pagadas</option>
                            </select>
                        </div>
                    </div>
                </div>

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
                            ) : filteredBills.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-40">
                                            <FileText size={48} />
                                            <p className="font-medium text-secondary">
                                                {bills.length === 0 ? "No hay facturas registradas" : "No hay facturas que coincidan con el filtro"}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredBills.map((bill) => (
                                    <tr key={bill.id} className="hover:bg-gray-50/30 transition-colors group align-middle">
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-bold">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-bold text-navy text-sm">{bill.title}</p>
                                                        {bill.category && (
                                                            <span className="bg-slate-100 text-secondary border border-gray-200 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider">
                                                                {bill.category}
                                                            </span>
                                                        )}
                                                        {bill.supportFile && (
                                                            <button
                                                                onClick={() => openSupportModal(bill.supportFile, bill.supportFileName)}
                                                                className="text-primary hover:text-primary-dark transition-colors inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-blue-50 text-[10px] font-bold border border-blue-100 cursor-pointer select-none"
                                                                title="Ver documento de soporte"
                                                            >
                                                                📎 Soporte
                                                            </button>
                                                        )}
                                                    </div>
                                                     <p className="text-xs text-secondary opacity-60">
                                                         {bill.invoiceNumber ? `Factura: #${bill.invoiceNumber}` : `ID: #${bill.id.substring(0, 8)}`}
                                                     </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <p className="text-sm font-medium text-secondary">{bill.provider || '-'}</p>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-start gap-2 text-secondary text-sm">
                                                <CalendarIcon size={16} className="opacity-60 mt-0.5" />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-navy text-xs" title="Fecha de Vencimiento">Vence: {new Date(bill.dueDate + 'T12:00:00').toLocaleDateString()}</span>
                                                    {bill.invoiceDate && (
                                                        <span className="text-[10px] text-secondary opacity-60 font-semibold" title="Fecha de Facturación">Factura: {new Date(bill.invoiceDate + 'T12:00:00').toLocaleDateString()}</span>
                                                    )}
                                                </div>
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

            {showExpenseModal && (
                <ExpenseFormModal
                    onClose={() => setShowExpenseModal(false)}
                    onExpenseAdded={fetchBills}
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

            {/* Support Document Modal */}
            {showSupportModal && activeSupportFile && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
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
                                    className="w-full h-[65vh] rounded-xl border border-gray-200 bg-white animate-fade-in" 
                                    title="Soporte PDF"
                                />
                            ) : (
                                <img 
                                    src={activeSupportFile} 
                                    alt="Documento Soporte" 
                                    className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md bg-white border border-gray-100 animate-fade-in"
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

export default Invoices;
