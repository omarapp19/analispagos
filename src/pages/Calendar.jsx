import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../services/api';
import DayDetailsPanel from '../components/DayDetailsPanel';
import AbonoFormModal from '../components/AbonoFormModal';

const CalendarPage = () => {
    const [selectedDate, setSelectedDate] = useState(null);
    const [bills, setBills] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Installments Modal States
    const [showAbonoModal, setShowAbonoModal] = useState(false);
    const [selectedBillForAbono, setSelectedBillForAbono] = useState(null);

    const fetchData = async () => {
        try {
            const [billsData, transactionsData, clientInvoicesData] = await Promise.all([
                api.getBills(),
                api.getTransactions(),
                api.getClientInvoices()
            ]);

            // Map pending credit client invoices as RECEIVABLE commitments
            const mappedClientInvoices = clientInvoicesData
                .filter(inv => inv.isCredit && inv.status !== 'PAID' && inv.status !== 'COMPLETED')
                .map(inv => ({
                    id: inv.id,
                    title: `Factura Crédito #${inv.invoiceNumber}`,
                    provider: inv.clientName,
                    amount: inv.total,
                    paidAmount: inv.paidAmount || 0,
                    dueDate: inv.dueDate, // "YYYY-MM-DD"
                    status: inv.status, // 'PENDING' or 'PARTIAL'
                    type: 'RECEIVABLE',
                    isClientInvoice: true
                }));

            // Filter payable bills to exclude PAID or COMPLETED
            const pendingBillsData = billsData.filter(b => b.status !== 'PAID' && b.status !== 'COMPLETED');

            setBills([...pendingBillsData, ...mappedClientInvoices]);
            setTransactions(transactionsData);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Get current month details
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    // Days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];
    // Previous month filler
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        days.push({ date: daysInPrevMonth - i, currentMonth: false, fullDate: new Date(year, month - 1, daysInPrevMonth - i, 12, 0, 0) });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ date: i, currentMonth: true, fullDate: new Date(year, month, i, 12, 0, 0) });
    }
    // Next month filler
    const remainingCells = 42 - days.length; // 6 rows * 7 cols
    for (let i = 1; i <= remainingCells; i++) {
        days.push({ date: i, currentMonth: false, fullDate: new Date(year, month + 1, i, 12, 0, 0) });
    }

    // Helper to find bills for a specific date (both Payable and Receivable)
    const getBillsForDate = (dateObj) => {
        return bills.filter(bill => {
            if (!bill.dueDate) return false;
            
            // Parse YYYY-MM-DD explicitly to avoid timezone issues
            const dateStr = typeof bill.dueDate === 'string' ? bill.dueDate.split('T')[0] : '';
            const [y, m, d] = dateStr.split('-').map(Number);
            const billDate = new Date(y, m - 1, d, 12, 0, 0);

            return billDate.getDate() === dateObj.getDate() &&
                billDate.getMonth() === dateObj.getMonth() &&
                billDate.getFullYear() === dateObj.getFullYear();
        });
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Calculations for unified metrics
    const totalPayablesPending = useMemo(() => {
        return bills
            .filter(b => (b.type === 'PAYABLE' || !b.type) && b.status !== 'PAID' && b.status !== 'COMPLETED')
            .reduce((sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0);
    }, [bills]);

    const totalReceivablesPending = useMemo(() => {
        return bills
            .filter(b => b.type === 'RECEIVABLE' && b.status !== 'PAID' && b.status !== 'COMPLETED')
            .reduce((sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0);
    }, [bills]);

    const balanceNeto = totalReceivablesPending - totalPayablesPending;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="flex h-full gap-8 overflow-hidden relative">
            <div className="flex-1 flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar">
                <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-navy">Calendario de Cobros y Pagos</h1>
                        <p className="text-sm text-secondary opacity-60">Visualización unificada de compromisos financieros por fecha de vencimiento</p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Card 1: Total por Cobrar (Te Deben) */}
                    <div className="card p-5 flex justify-between items-center bg-white border border-gray-50/50 shadow-sm rounded-2xl">
                        <div>
                            <p className="text-xs text-secondary font-bold opacity-60 uppercase mb-2">Total por Cobrar (Te deben)</p>
                            <div className="flex items-end gap-3">
                                <h3 className="text-3xl font-black text-teal-600">{formatCurrency(totalReceivablesPending)}</h3>
                                <span className="bg-teal-50 text-teal-650 text-[10px] px-2 py-0.5 rounded-full font-bold mb-1 border border-teal-100/50">
                                    Activo
                                </span>
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-teal-50/50 rounded-xl flex items-center justify-center text-teal-600">
                            <TrendingUp size={24} />
                        </div>
                    </div>

                    {/* Card 2: Total por Pagar (Debes) */}
                    <div className="card p-5 flex justify-between items-center bg-white border border-gray-50/50 shadow-sm rounded-2xl">
                        <div>
                            <p className="text-xs text-secondary font-bold opacity-60 uppercase mb-2">Total por Pagar (Debes)</p>
                            <div className="flex items-end gap-3">
                                <h3 className="text-3xl font-black text-danger">{formatCurrency(totalPayablesPending)}</h3>
                                <span className="bg-red-50 text-danger text-[10px] px-2 py-0.5 rounded-full font-bold mb-1 border border-red-100/50">
                                    Pasivo
                                </span>
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-red-50/50 rounded-xl flex items-center justify-center text-danger">
                            <TrendingDown size={24} />
                        </div>
                    </div>
                </div>

                {/* Calendar Navigation Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                        <button 
                            onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            className="p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                        >
                            <ChevronLeft size={20} className="text-secondary" />
                        </button>
                        <h2 className="text-lg font-bold text-navy min-w-[140px] text-center capitalize">{monthNames[month]} {year}</h2>
                        <button 
                            onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            className="p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                        >
                            <ChevronRight size={20} className="text-secondary" />
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="bg-white rounded-3xl shadow-card flex-1 flex flex-col min-h-[600px] overflow-hidden">
                    <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/30">
                        {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(day => (
                            <div key={day} className="py-4 text-center text-xs font-bold text-secondary opacity-50 tracking-widest">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                        {days.map((dayObj, i) => {
                            const dayBills = getBillsForDate(dayObj.fullDate);
                            const activePendingBills = dayBills.filter(b => b.status !== 'PAID' && b.status !== 'COMPLETED');
                            const hasBills = activePendingBills.length > 0;
                            const isSelected = selectedDate && selectedDate.getTime() === dayObj.fullDate.getTime();

                            const payables = activePendingBills.filter(b => b.type === 'PAYABLE' || !b.type);
                            const receivables = activePendingBills.filter(b => b.type === 'RECEIVABLE');

                            const payablesTotal = payables.reduce((sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0);
                            const receivablesTotal = receivables.reduce((sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0);

                            const isToday = dayObj.fullDate.getDate() === new Date().getDate() &&
                                dayObj.fullDate.getMonth() === new Date().getMonth() &&
                                dayObj.fullDate.getFullYear() === new Date().getFullYear();

                            return (
                                <div
                                    key={i}
                                    onClick={() => setSelectedDate(dayObj.fullDate)}
                                    className={`
                                        border-b border-r border-gray-50 p-2 relative cursor-pointer hover:bg-blue-50/30 transition-all flex flex-col gap-1.5
                                        ${!dayObj.currentMonth ? 'bg-gray-50/30 text-gray-300' : 'text-secondary'}
                                        ${isSelected ? 'ring-2 ring-primary ring-inset z-10 bg-blue-50/10' : ''}
                                        ${isToday && !isSelected ? 'bg-blue-50/5' : ''}
                                        min-h-[100px]
                                    `}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-sm font-bold p-1 transition-colors ${!dayObj.currentMonth ? '' : 'text-navy'} ${isToday ? 'bg-primary text-white rounded-full w-7 h-7 flex items-center justify-center shadow-md' : ''}`}>
                                            {dayObj.date}
                                        </span>
                                        {isToday && <span className="text-[10px] font-bold text-primary uppercase tracking-wider pr-1">Hoy</span>}
                                    </div>

                                    {hasBills && (
                                        <div className="flex flex-col gap-1 mt-auto w-full no-print">
                                            {payables.length > 0 && (
                                                <div className="text-[9px] px-1.5 py-0.5 rounded border bg-red-50 text-danger border-red-100/50 font-black truncate flex justify-between items-center" title="Gastos por Pagar">
                                                    <span>Debes</span>
                                                    <span>-${payablesTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                </div>
                                            )}
                                            {receivables.length > 0 && (
                                                <div className="text-[9px] px-1.5 py-0.5 rounded border bg-teal-50 text-teal-650 border-teal-100/50 font-black truncate flex justify-between items-center" title="Cobros por Recibir">
                                                    <span>Cobrar</span>
                                                    <span>+${receivablesTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {selectedDate && (
                <div 
                    className="fixed lg:static inset-0 lg:inset-auto right-0 z-50 lg:z-auto w-full lg:w-[400px] lg:flex-shrink-0 bg-black/40 lg:bg-transparent flex justify-end transition-all animate-in fade-in duration-200"
                    onClick={() => setSelectedDate(null)}
                >
                    <div className="h-full w-full sm:w-[400px] lg:w-auto animate-in slide-in-from-right duration-350" onClick={(e) => e.stopPropagation()}>
                        <DayDetailsPanel
                            onClose={() => setSelectedDate(null)}
                            date={selectedDate}
                            bills={getBillsForDate(selectedDate)}
                            onBillUpdate={fetchData}
                            onAbonoClick={(bill) => {
                                setSelectedBillForAbono(bill);
                                setShowAbonoModal(true);
                            }}
                        />
                    </div>
                </div>
            )}

            <AbonoFormModal
                isOpen={showAbonoModal}
                bill={selectedBillForAbono}
                onClose={() => {
                    setShowAbonoModal(false);
                    setSelectedBillForAbono(null);
                }}
                onAbonoAdded={fetchData}
            />
        </div>
    );
};

export default CalendarPage;
