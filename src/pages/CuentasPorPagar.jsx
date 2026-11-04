import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, FileText, CheckCircle, Clock, AlertTriangle, Landmark, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import AbonoFormModal from '../components/AbonoFormModal';

const CuentasPorPagar = () => {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Abono modal state
    const [showAbonoModal, setShowAbonoModal] = useState(false);
    const [selectedBillForAbono, setSelectedBillForAbono] = useState(null);

    const fetchBills = async () => {
        setLoading(true);
        try {
            const data = await api.getBills();
            // Filter to show only expenses (PAYABLE) that are not fully paid
            setBills(data.filter(b => (b.type === 'PAYABLE' || !b.type) && b.status !== 'PAID' && b.status !== 'COMPLETED'));
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

    // Calculate payable stats
    const stats = useMemo(() => {
        let totalPayable = 0;
        let pendingBillsCount = 0;

        bills.forEach(b => {
            const remaining = b.amount - (b.paidAmount || 0);
            totalPayable += remaining;
            pendingBillsCount++;
        });

        return {
            totalPayable,
            pendingBillsCount
        };
    }, [bills]);

    const filteredBills = useMemo(() => {
        return bills.filter(b => {
            const term = searchTerm.toLowerCase().trim();
            if (!term) return true;
            return (
                (b.provider || '').toLowerCase().includes(term) ||
                (b.title || '').toLowerCase().includes(term) ||
                (b.invoiceNumber || '').toLowerCase().includes(term)
            );
        });
    }, [bills, searchTerm]);

    return (
        <div className="flex flex-col h-full gap-8 font-sans">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-navy">Cuentas por Pagar</h1>
                <p className="text-secondary opacity-60">Control de deudas pendientes con proveedores y registro de abonos</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                <div className="card bg-white p-6 rounded-3xl flex items-center justify-between border border-transparent shadow-sm">
                    <div>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Total por Pagar</p>
                        <h3 className="text-2xl font-black text-danger">{formatCurrency(stats.totalPayable)}</h3>
                    </div>
                </div>

                <div className="card bg-white p-6 rounded-3xl flex items-center justify-between border border-transparent shadow-sm">
                    <div>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Facturas Pendientes</p>
                        <h3 className="text-2xl font-black text-navy">{stats.pendingBillsCount} compra(s)</h3>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-3xl">
                {/* Search Bar */}
                <div className="p-4 px-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/20">
                    <div className="text-sm font-bold text-navy">
                        Facturas pendientes de pago: {filteredBills.length}
                    </div>
                    <div className="relative w-full sm:w-80">
                        <input 
                            type="text" 
                            placeholder="Buscar por proveedor o concepto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-background rounded-xl border border-gray-200 outline-none text-xs text-secondary font-bold focus:border-primary transition-all"
                        />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary opacity-40" size={14} />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr className="text-xs font-bold text-secondary uppercase tracking-wider">
                                <th className="p-6">Detalles</th>
                                <th className="p-6">Proveedor</th>
                                <th className="p-6">Fecha Vencimiento</th>
                                <th className="p-6">Estado</th>
                                <th className="p-6 text-right">Monto Original</th>
                                <th className="p-6 text-right">Saldo Pendiente</th>
                                <th className="p-6 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium text-sm text-secondary">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-secondary opacity-50">Cargando cuentas por pagar...</td>
                                </tr>
                            ) : filteredBills.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center text-secondary opacity-50 font-bold">
                                        No tienes deudas pendientes de pago.
                                    </td>
                                </tr>
                            ) : (
                                filteredBills.map((bill) => {
                                    const remaining = bill.amount - (bill.paidAmount || 0);

                                    return (
                                        <tr key={bill.id} className="hover:bg-gray-50/30 transition-colors align-middle">
                                            <td className="p-6">
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <span className="font-bold text-navy block">{bill.title}</span>
                                                        <span className="text-[10px] text-secondary opacity-50 block font-normal">
                                                            {bill.invoiceNumber ? `Factura: #${bill.invoiceNumber}` : `ID: #${bill.id.substring(0, 8)}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6 text-navy font-bold">
                                                {bill.provider || '-'}
                                            </td>
                                            <td className="p-6 font-semibold">
                                                Vence: {new Date(bill.dueDate + 'T12:00:00').toLocaleDateString()}
                                            </td>
                                            <td className="p-6">
                                                {bill.status === 'PARTIAL' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-primary border border-indigo-100/50">
                                                        Abonado: {formatCurrency(bill.paidAmount || 0)}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-warning border border-orange-100/55">
                                                        Pendiente
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-6 text-right font-semibold text-secondary">
                                                {formatCurrency(bill.amount)}
                                            </td>
                                            <td className="p-6 text-right font-black text-danger text-base">
                                                {formatCurrency(remaining)}
                                            </td>
                                            <td className="p-6 text-center">
                                                <button
                                                    onClick={() => {
                                                        setSelectedBillForAbono(bill);
                                                        setShowAbonoModal(true);
                                                    }}
                                                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                                                    title="Registrar Abono"
                                                >
                                                    <Landmark size={12} />
                                                    Abonar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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

export default CuentasPorPagar;
