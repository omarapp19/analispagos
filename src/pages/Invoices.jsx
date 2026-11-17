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
import CustomDropdown from '../components/ui/CustomDropdown';

const BILL_FILTER_OPTIONS = [
    { value: 'ALL', label: 'Todas · pendientes', icon: FileText },
    { value: 'PENDING_DESC', label: 'Pendientes (Mayor a Menor)', icon: Clock },
    { value: 'PAID', label: 'Pagadas', icon: CheckCircle }
];

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
    const [expandedNameIds, setExpandedNameIds] = useState(new Set());

    const toggleExpandName = (id) => {
        setExpandedNameIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getCleanTitle = (bill) => {
        const raw = bill.title || bill.provider || 'Sin Nombre';
        return raw.replace(/^compra\s*[-–:]\s*/i, '').trim();
    };

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
        <div className="flex flex-col h-full gap-4 sm:gap-6 lg:gap-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-navy">Facturas (Gastos)</h1>
                    <p className="text-xs sm:text-sm text-secondary opacity-60">Gestión de gastos, compras a proveedores y cuentas por pagar</p>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => navigate('/compras/nueva')}
                        className="btn btn-primary col-span-2 sm:col-span-1 justify-center py-2 text-xs sm:text-sm font-bold shadow-xs"
                    >
                        <Plus size={16} />
                        Nueva compra
                    </button>
                    <button
                        onClick={() => setShowExpenseModal(true)}
                        className="btn btn-outline justify-center py-2 text-xs sm:text-sm font-bold"
                        title="Nómina, servicios y otros gastos"
                    >
                        <Plus size={16} />
                        <span className="sm:inline hidden">Registrar gasto</span>
                        <span className="sm:hidden inline">Gasto</span>
                    </button>
                    <button
                        onClick={() => setShowRecurringModal(true)}
                        className="btn btn-outline justify-center py-2 text-xs sm:text-sm font-bold"
                    >
                        <CalendarIcon size={16} />
                        <span className="sm:inline hidden">Gastos fijos</span>
                        <span className="sm:hidden inline">Fijos</span>
                    </button>
                </div>
            </div>

            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-2xl sm:rounded-3xl border border-gray-100">
                {/* Filter Toolbar */}
                <div className="p-3 sm:p-4 md:px-6 border-b border-gray-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 bg-gray-50/30">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
                        {/* Quick Type Filter Tabs */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                            <button
                                type="button"
                                onClick={() => setTypeFilter('ALL')}
                                className={`flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
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
                                className={`flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
                                className={`flex-1 sm:flex-initial text-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
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

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full lg:w-auto">
                        <div className="text-xs font-bold text-secondary whitespace-nowrap">
                            Mostrando: <strong className="text-navy">{filteredBills.length}</strong>
                        </div>
                        <CustomDropdown
                            value={filter}
                            onChange={setFilter}
                            options={BILL_FILTER_OPTIONS}
                            prefixIcon={Filter}
                            label="Filtro:"
                            menuWidth="w-64"
                            align="right"
                            showOrderToggle={false}
                        />
                    </div>
                </div>

                {/* Vista Escritorio (Tabla) */}
                <div className="hidden md:block overflow-x-auto">
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
                                filteredBills.map((bill) => {
                                    const cleanTitle = getCleanTitle(bill);
                                    const isExpanded = expandedNameIds.has(bill.id);
                                    return (
                                        <tr key={bill.id} className="hover:bg-gray-50/30 transition-colors group align-middle">
                                            <td className="p-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-bold shrink-0">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleExpandName(bill.id)}
                                                            className={`font-bold text-navy text-sm text-left hover:text-primary transition-colors cursor-pointer ${
                                                                isExpanded ? 'whitespace-normal break-words' : 'truncate max-w-[200px] lg:max-w-xs xl:max-w-md block'
                                                            }`}
                                                            title="Clic para ver nombre completo"
                                                        >
                                                            {cleanTitle}
                                                        </button>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-xs text-secondary opacity-60">
                                                                {bill.invoiceNumber ? `Factura: #${bill.invoiceNumber}` : `ID: #${bill.id.substring(0, 8)}`}
                                                            </p>
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
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Vista Móvil (Cards) */}
                <div className="block md:hidden">
                    {loading ? (
                        <div className="p-8 text-center text-secondary opacity-50 text-sm">Cargando facturas...</div>
                    ) : filteredBills.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="flex flex-col items-center gap-3 opacity-40">
                                <FileText size={40} />
                                <p className="font-medium text-secondary text-sm">
                                    {bills.length === 0 ? "No hay facturas registradas" : "No hay facturas que coincidan con el filtro"}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredBills.map((bill) => {
                                const cleanTitle = getCleanTitle(bill);
                                const isExpanded = expandedNameIds.has(bill.id);
                                const isPaid = bill.status === 'COMPLETED' || bill.status === 'PAID';
                                const isPartial = bill.status === 'PARTIAL';
                                const pendingAmount = bill.amount - (bill.paidAmount || 0);

                                return (
                                    <div key={bill.id} className="p-3.5 sm:p-4 flex flex-col gap-3 hover:bg-gray-50/40 transition-colors">
                                        {/* Header de la tarjeta */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-bold shrink-0 mt-0.5">
                                                    <FileText size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpandName(bill.id)}
                                                        className={`font-bold text-navy text-sm text-left hover:text-primary transition-colors cursor-pointer w-full leading-snug ${
                                                            isExpanded ? 'whitespace-normal break-words' : 'truncate block'
                                                        }`}
                                                        title="Toca para ver nombre completo"
                                                    >
                                                        {cleanTitle}
                                                    </button>
                                                    {bill.provider && bill.provider.toLowerCase() !== cleanTitle.toLowerCase() && (
                                                        <p className="text-[11px] text-secondary opacity-75 truncate">{bill.provider}</p>
                                                    )}
                                                    <p className="text-[11px] text-secondary opacity-60 mt-0.5">
                                                        {bill.invoiceNumber ? `Factura: #${bill.invoiceNumber}` : `ID: #${bill.id.substring(0, 8)}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="shrink-0 mt-0.5">
                                                {isPaid ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-success border border-green-100">
                                                        <CheckCircle size={11} /> Pagado
                                                    </span>
                                                ) : isPartial ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-primary border border-indigo-100">
                                                        <Clock size={10} /> Abonado
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-warning border border-orange-100">
                                                        <Clock size={11} /> Pendiente
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bloque Fechas y Monto */}
                                        <div className="flex items-center justify-between text-xs bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                                            <div className="flex flex-col text-secondary gap-0.5">
                                                <div className="flex items-center gap-1 text-[11px] font-bold text-navy">
                                                    <CalendarIcon size={12} className="text-secondary opacity-60" />
                                                    <span>Vence: {new Date(bill.dueDate + 'T12:00:00').toLocaleDateString()}</span>
                                                </div>
                                                {bill.invoiceDate && (
                                                    <span className="text-[10px] text-secondary opacity-60 pl-4">
                                                        Emisión: {new Date(bill.invoiceDate + 'T12:00:00').toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-navy text-sm tabular-nums">
                                                    {formatCurrency(bill.amount)}
                                                </div>
                                                {isPartial && (
                                                    <div className="text-[10px] text-warning font-bold tabular-nums">
                                                        Resta: {formatCurrency(pendingAmount)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Acciones */}
                                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-50">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {bill.supportFile && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openSupportModal(bill.supportFile, bill.supportFileName)}
                                                        className="h-8 px-2.5 bg-blue-50 hover:bg-blue-100 text-primary rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-blue-100"
                                                    >
                                                        <Eye size={13} />
                                                        <span>Soporte</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedPurchaseForReceipt(bill)}
                                                    className="h-8 px-2.5 bg-slate-100 hover:bg-navy hover:text-white text-navy rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Printer size={13} />
                                                    <span>Reimprimir</span>
                                                </button>
                                                {!isPaid && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedBillForAbono(bill);
                                                            setShowAbonoModal(true);
                                                        }}
                                                        className="h-8 px-3 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <Landmark size={13} />
                                                        <span>Abonar</span>
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(bill.id)}
                                                className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-danger hover:bg-red-50 rounded-lg transition-all cursor-pointer shrink-0"
                                                title="Eliminar factura"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
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
