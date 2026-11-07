import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, FileText, CheckCircle, Clock, AlertTriangle, Landmark, X } from 'lucide-react';
import { api } from '../services/api';

const CuentasPorCobrar = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Pay Modal State
    const [showPayModal, setShowPayModal] = useState(false);
    const [payingInvoice, setPayingInvoice] = useState(null);
    const [payMethod, setPayMethod] = useState('Efectivo');
    const [submittingPayment, setSubmittingPayment] = useState(false);

    const [clients, setClients] = useState([]);
    useEffect(() => { api.getClients().then(setClients).catch(() => {}); }, []);

    // Estado de cuenta del cliente por WhatsApp: todas sus facturas pendientes.
    const sendStatement = (inv) => {
        const client = clients.find((c) => String(c.id) === String(inv.clientId));
        const pending = invoices.filter((i) => i.isCredit && i.status === 'PENDING' && (i.clientId ? String(i.clientId) === String(inv.clientId) : i.clientName === inv.clientName));
        const total = pending.reduce((s, i) => s + Number(i.total), 0);
        const today = new Date().toLocaleDateString('en-CA');
        const lines = pending.map((i) => `• ${i.invoiceNumber} — vence ${new Date(i.dueDate + 'T12:00:00').toLocaleDateString('es-VE')} — ${formatCurrency(i.total)}${i.dueDate < today ? ' (VENCIDA)' : ''}`);
        const text = ['Hola ' + inv.clientName + ', este es su estado de cuenta:', '', ...lines, '', '*Total pendiente: ' + formatCurrency(total) + '*', '', 'Gracias por su preferencia.'].join('\n');
        const phone = String(client?.phone || '').replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    };

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const data = await api.getClientInvoices();
            setInvoices(data);
        } catch (err) {
            console.error("Error loading credit invoices:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount);
    };

    // Calculate receivable metrics
    const stats = useMemo(() => {
        let totalReceivables = 0;
        let totalOverdue = 0;
        let pendingInvoicesCount = 0;
        const todayStr = new Date().toLocaleDateString('en-CA');

        invoices
            .filter(inv => inv.isCredit && inv.status === 'PENDING')
            .forEach(inv => {
                totalReceivables += inv.total;
                pendingInvoicesCount++;
                if (inv.dueDate < todayStr) {
                    totalOverdue += inv.total;
                }
            });

        return {
            totalReceivables,
            totalOverdue,
            pendingInvoicesCount
        };
    }, [invoices]);

    const filteredInvoices = useMemo(() => {
        return invoices
            .filter(inv => inv.isCredit && inv.status === 'PENDING')
            .filter(inv => 
                (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (inv.clientName || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [invoices, searchTerm]);

    const handlePayInvoiceSubmit = async (e) => {
        e.preventDefault();
        if (!payingInvoice) return;

        setSubmittingPayment(true);
        try {
            await api.payClientInvoice(payingInvoice.id, payMethod);
            alert(`Cobro registrado para la factura #${payingInvoice.invoiceNumber} exitosamente.`);
            setShowPayModal(false);
            setPayingInvoice(null);
            await fetchInvoices();
        } catch (err) {
            console.error("Error registering collection:", err);
            alert("No se pudo registrar el cobro: " + (err.message || err));
        } finally {
            setSubmittingPayment(false);
        }
    };

    return (
        <div className="flex flex-col h-full gap-8 font-sans">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-navy">Cuentas por Cobrar</h1>
                <p className="text-secondary opacity-60">Control de créditos otorgados a clientes y registro de cobros</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card bg-white p-6 rounded-3xl flex items-center justify-between border border-transparent shadow-sm">
                    <div>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Total por Cobrar</p>
                        <h3 className="text-2xl font-black text-navy">{formatCurrency(stats.totalReceivables)}</h3>
                    </div>
                </div>

                <div className="card bg-white p-6 rounded-3xl flex items-center justify-between border border-red-50 shadow-sm">
                    <div>
                        <p className="text-[10px] font-bold text-danger uppercase tracking-wider mb-1">Monto Vencido</p>
                        <h3 className="text-2xl font-black text-danger">{formatCurrency(stats.totalOverdue)}</h3>
                    </div>
                </div>

                <div className="card bg-white p-6 rounded-3xl flex items-center justify-between border border-transparent shadow-sm">
                    <div>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1 font-bold">Créditos Pendientes</p>
                        <h3 className="text-2xl font-black text-navy">{stats.pendingInvoicesCount} factura(s)</h3>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="card flex-1 overflow-hidden flex flex-col p-0 bg-white shadow-card rounded-3xl">
                {/* Search Bar */}
                <div className="p-4 px-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/20">
                    <div className="text-sm font-bold text-navy">
                        Facturas pendientes de cobro: {filteredInvoices.length}
                    </div>
                    <div className="relative w-full sm:w-80">
                        <input 
                            type="text" 
                            placeholder="Buscar por cliente o número de factura..."
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
                                <th className="p-6">Factura</th>
                                <th className="p-6">Cliente</th>
                                <th className="p-6">Fecha Emisión</th>
                                <th className="p-6">Vencimiento</th>
                                <th className="p-6 text-center">Estado Cobro</th>
                                <th className="p-6 text-right">Total Pendiente</th>
                                <th className="p-6 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium text-sm text-secondary">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center text-secondary opacity-50 font-bold">
                                        No hay cuentas por cobrar pendientes.
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((inv) => {
                                    const todayStr = new Date().toLocaleDateString('en-CA');
                                    const isOverdue = inv.dueDate < todayStr;
                                    
                                    // Calculate days remaining or past
                                    const diffTime = new Date(inv.dueDate + 'T12:00:00') - new Date(todayStr + 'T12:00:00');
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                    return (
                                        <tr key={inv.id} className="hover:bg-gray-50/30 transition-colors align-middle">
                                            <td className="p-6 font-bold text-navy">
                                                #{inv.invoiceNumber}
                                            </td>
                                            <td className="p-6">
                                                <div>
                                                    <span className="font-bold text-navy block">{inv.clientName}</span>
                                                    <span className="text-xs text-secondary opacity-50 block font-normal">{inv.clientDocument || 'Sin Documento'}</span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                {new Date(inv.date + 'T12:00:00').toLocaleDateString()}
                                            </td>
                                            <td className="p-6 font-bold">
                                                <span className={isOverdue ? 'text-danger' : 'text-secondary'}>
                                                    {new Date(inv.dueDate + 'T12:00:00').toLocaleDateString()}
                                                </span>
                                                <p className="text-[10px] opacity-75 font-semibold">
                                                    {isOverdue ? (
                                                        <span className="text-danger">Hace {Math.abs(diffDays)} día(s)</span>
                                                    ) : (
                                                        <span className="text-primary">Faltan {diffDays} día(s)</span>
                                                    )}
                                                </p>
                                            </td>
                                            <td className="p-6 text-center">
                                                {isOverdue ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-danger border border-red-100">
                                                        <AlertTriangle size={12} /> Vencida
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-orange-500 border border-amber-100">
                                                        <Clock size={12} /> Pendiente
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-6 text-right font-black text-navy text-base">
                                                {formatCurrency(inv.total)}
                                            </td>
                                            <td className="p-6 text-center">
                                                <button
                                                    onClick={() => {
                                                        setPayingInvoice(inv);
                                                        setPayMethod('Efectivo');
                                                        setShowPayModal(true);
                                                    }}
                                                    className="btn btn-primary py-1.5 px-3 rounded-lg text-xs hover:-translate-y-0.5 shadow-teal-500/20 cursor-pointer"
                                                >
                                                    Registrar Cobro
                                                </button>
                                                <button
                                                    onClick={() => sendStatement(inv)}
                                                    className="btn btn-ghost py-1.5 px-3 rounded-lg text-xs ml-2 cursor-pointer"
                                                    title="Enviar estado de cuenta por WhatsApp"
                                                >
                                                    WhatsApp
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

            {/* Pay Modal */}
            {showPayModal && payingInvoice && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl relative overflow-hidden animate-in zoom-in duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-navy text-base font-black flex items-center gap-2">
                                <Landmark size={18} className="text-primary" />
                                Registrar Cobro
                            </h3>
                            <button 
                                onClick={() => setShowPayModal(false)}
                                className="p-1 text-secondary hover:text-navy cursor-pointer rounded-full hover:bg-slate-50"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handlePayInvoiceSubmit} className="p-6 space-y-4">
                            <div className="bg-slate-50 rounded-xl p-3 text-xs font-semibold text-secondary space-y-2">
                                <div className="flex justify-between">
                                    <span>Factura:</span>
                                    <span className="font-bold text-navy">#{payingInvoice.invoiceNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Cliente:</span>
                                    <span className="font-bold text-navy">{payingInvoice.clientName}</span>
                                </div>
                                <div className="flex justify-between border-t border-gray-100 pt-2 text-sm font-extrabold">
                                    <span>Total a Cobrar:</span>
                                    <span className="text-primary">{formatCurrency(payingInvoice.total)}</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5 block">Método de Pago *</label>
                                <select
                                    value={payMethod}
                                    onChange={(e) => setPayMethod(e.target.value)}
                                    className="w-full p-2.5 bg-background rounded-xl border border-gray-200 outline-none text-xs font-bold text-navy focus:border-primary cursor-pointer"
                                >
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Pago Móvil">Pago Móvil</option>
                                    <option value="Tarjeta">Tarjeta de Débito/Crédito</option>
                                    <option value="Transferencia">Transferencia Bancaria</option>
                                    <option value="Divisas">Divisas (Dólares)</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={submittingPayment}
                                className="w-full py-2.5 bg-primary hover:bg-primary/95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all cursor-pointer"
                            >
                                {submittingPayment ? 'Registrando Cobro...' : 'Confirmar Cobro y Depositar'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CuentasPorCobrar;
