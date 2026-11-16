import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Calendar as CalendarIcon, CheckCircle, Clock, Trash2, Landmark, Filter, Search, X, Printer, ShoppingBag, Eye } from 'lucide-react';
import { api } from '../services/api';
import BillFormModal from '../components/BillFormModal';
import ExpenseFormModal from '../components/ExpenseFormModal';
import AbonoFormModal from '../components/AbonoFormModal';
import RecurringExpensesModal from '../components/RecurringExpensesModal';
import PurchaseReceiptModal from '../components/PurchaseReceiptModal';
import SupportViewerModal from '../components/SupportViewerModal';

const Invoices = () => {
    const navigate = useNavigate();
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showAbonoModal, setShowAbonoModal] = useState(false);
    const [showRecurringModal, setShowRecurringModal] = useState(false);
    const [selectedBillForAbono, setSelectedBillForAbono] = useState(null);
    const [selectedPurchaseForReceipt, setSelectedPurchaseForReceipt] = useState(null);
    const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'PURCHASES' | 'EXPENSES'
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
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount);
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

    const counts = useMemo(() => {
        let purchases = 0;
        let expenses = 0;
        bills.forEach(b => {
            const isPurchase = (Array.isArray(b.items) && b.items.length > 0) || (b.title || '').toLowerCase().includes('compra');
            if (isPurchase) purchases++;
            else expenses++;
        });
        return { total: bills.length, purchases, expenses };
    }, [bills]);

    const filteredBills = useMemo(() => {
        // Filter by provider or details search term
        const searched = bills.filter(b => {
            const isPurchase = (Array.isArray(b.items) && b.items.length > 0) || (b.title || '').toLowerCase().includes('compra');
            if (typeFilter === 'PURCHASES' && !isPurchase) return false;
            if (typeFilter === 'EXPENSES' && isPurchase) return false;

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
    }, [bills, typeFilter, filter, searchTerm]);

    return (
        <div className="flex flex-col h-full gap-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Facturas (Gastos)</h1>
                    <p className="text-secondary opacity-60">Gestión de gastos, compras a proveedores y cuentas por pagar</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => navigate('/compras/nueva')}
                        className="btn btn-primary"
                    >
                        <Plus size={16} />
                        Nueva compra
                    </button>
                    <button
                        onClick={() => setShowExpenseModal(true)}
                        className="btn btn-outline"
                        title="Nómina, servicios y otros gastos"
                    >
                        <Plus size={16} />
                        Registrar gasto
                    </button>
                    <button
                        onClick={() => setShowRecurringModal(true)}
                        className="btn btn-outline"
                    >
                        <CalendarIcon size={16} />
                        Gastos fijos
                    </button>
                </div>
            </div>

            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-3xl">
                {/* Filter Toolbar */}
                <div className="p-4 px-6 border-b border-gray-100 flex flex-col lg:flex-row justify-between items-center gap-4 bg-gray-50/20">
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                        {/* Quick Type Filter Tabs */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-full sm:w-auto overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => setTypeFilter('ALL')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                    typeFilter === 'ALL'
                                        ? 'bg-white text-navy shadow-xs'
                                        : 'text-secondary hover:text-navy'
                                }`}
                            >
                                Todas ({counts.total})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTypeFilter('PURCHASES')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                    typeFilter === 'PURCHASES'
                                        ? 'bg-navy text-white shadow-xs'
                                        : 'text-secondary hover:text-navy'
                                }`}
                            >
                                <ShoppingBag size={13} />
                                Compras ({counts.purchases})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTypeFilter('EXPENSES')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                    typeFilter === 'EXPENSES'
                                        ? 'bg-white text-navy shadow-xs'
                                        : 'text-secondary hover:text-navy'
                                }`}
                            >
                                Gastos ({counts.expenses})
                            </button>
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

                    <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                        <div className="text-xs font-bold text-secondary whitespace-nowrap">
                            Mostrando: <strong className="text-navy">{filteredBills.length}</strong>
                        </div>
                        <div className="relative flex items-center bg-background rounded-xl px-3 py-2 border border-gray-200 text-xs font-bold text-secondary w-full sm:w-auto">
                            <Filter size={14} className="text-primary mr-2" />
                            <select 
                                value={filter} 
                                onChange={(e) => setFilter(e.target.value)}
                                className="bg-transparent focus:outline-none pr-4 cursor-pointer text-navy font-bold w-full sm:w-auto"
                            >
                                <option value="ALL">Todas · pendientes primero</option>
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
                                                        {Array.isArray(bill.items) && bill.items.length > 0 && (
                                                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-md font-bold">
                                                                {bill.items.length} {bill.items.length === 1 ? 'producto' : 'productos'}
                                                            </span>
                                                        )}
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
                                                                Soporte
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
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setSelectedPurchaseForReceipt(bill)}
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-navy hover:text-white text-navy rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs select-none"
                                                    title="Ver detalle y reimprimir comprobante de compra"
                                                >
                                                    <Printer size={13} />
                                                    <span className="hidden sm:inline">Reimprimir</span>
                                                </button>
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

            {/* Support Document Modal with Interactive Zoom & Pan */}
            {showSupportModal && activeSupportFile && (
                <SupportViewerModal
                    file={activeSupportFile}
                    fileName={activeSupportFileName}
                    onClose={closeSupportModal}
                />
            )}

            {showRecurringModal && (
                <RecurringExpensesModal
                    onClose={() => setShowRecurringModal(false)}
                    onExpenseAdded={fetchBills}
                    existingBills={bills}
                />
            )}

            {/* Purchase Receipt & Print Modal */}
            {selectedPurchaseForReceipt && (
                <PurchaseReceiptModal
                    purchase={selectedPurchaseForReceipt}
                    onClose={() => setSelectedPurchaseForReceipt(null)}
                    onOpenSupport={openSupportModal}
                />
            )}
        </div>
    );
};

export default Invoices;
