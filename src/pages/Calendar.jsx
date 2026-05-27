import React, { useState, useEffect } from 'react';
import { 
    ChevronLeft, ChevronRight, TrendingDown, TrendingUp, 
    AlertCircle, AlertTriangle, Plus, ArrowUpRight, ArrowDownLeft 
} from 'lucide-react';
import { api } from '../services/api';
import DayDetailsPanel from '../components/DayDetailsPanel';
import BillFormModal from '../components/BillFormModal';

const CalendarPage = () => {
    const [selectedDate, setSelectedDate] = useState(null);
    const [bills, setBills] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showModal, setShowModal] = useState(false);

    const fetchData = async () => {
        try {
            const [billsData, transactionsData] = await Promise.all([
                api.getBills(),
                api.getTransactions()
            ]);
            setBills(billsData);
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
        days.push({ 
            date: daysInPrevMonth - i, 
            currentMonth: false, 
            fullDate: new Date(year, month - 1, daysInPrevMonth - i, 12, 0, 0) 
        });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ 
            date: i, 
            currentMonth: true, 
            fullDate: new Date(year, month, i, 12, 0, 0) 
        });
    }
    // Next month filler
    const remainingCells = 42 - days.length; // 6 rows * 7 cols
    for (let i = 1; i <= remainingCells; i++) {
        days.push({ 
            date: i, 
            currentMonth: false, 
            fullDate: new Date(year, month + 1, i, 12, 0, 0) 
        });
    }

    // Helper to find all pending bills (receivables + payables) for a specific date
    const getBillsForDate = (dateObj) => {
        return bills.filter(bill => {
            if (!bill.dueDate) return false;
            const dateStr = typeof bill.dueDate === 'string' ? bill.dueDate.split('T')[0] : '';
            const [y, m, d] = dateStr.split('-').map(Number);
            const billDate = new Date(y, m - 1, d, 12, 0, 0);

            return bill.status === 'PENDING' &&
                billDate.getDate() === dateObj.getDate() &&
                billDate.getMonth() === dateObj.getMonth() &&
                billDate.getFullYear() === dateObj.getFullYear();
        });
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Aggregate statistics
    const totals = React.useMemo(() => {
        const pendingReceivables = bills
            .filter(b => (b.type || 'PAYABLE') === 'RECEIVABLE' && b.status === 'PENDING')
            .reduce((sum, b) => sum + b.amount, 0);
        
        const pendingPayables = bills
            .filter(b => (b.type || 'PAYABLE') === 'PAYABLE' && b.status === 'PENDING')
            .reduce((sum, b) => sum + b.amount, 0);

        return {
            pendingReceivables,
            pendingPayables
        };
    }, [bills]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="flex h-full gap-8 overflow-hidden relative">
            <div className="flex-1 flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar animate-fade-in">
                {/* Header */}
                <div className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-navy">Calendario Financiero</h1>
                        <p className="text-sm text-secondary opacity-60">Visualización de cuentas por cobrar (ingresos) y cuentas por pagar (gastos)</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn btn-primary flex items-center gap-2 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50"
                    >
                        <Plus size={18} />
                        Nueva Factura
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Projected Sales (Current Month) */}
                    {(() => {
                        const now = new Date();
                        const currentDay = now.getDate();
                        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                        const remainingDays = lastDayOfMonth - currentDay;

                        const currentMonthTransactions = transactions.filter(t => {
                            const d = new Date(t.date);
                            return t.type === 'INCOME' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                        });

                        const monthlyTotal = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
                        const dailyAverage = currentDay > 0 ? monthlyTotal / currentDay : 0;
                        const projectedRemaining = dailyAverage * remainingDays;

                        return (
                            <div className="card p-5 flex justify-between items-center bg-white border border-gray-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-5">
                                    <TrendingUp size={70} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-secondary font-bold opacity-60 uppercase mb-1">Venta Proyectada (Restante)</p>
                                    <div className="flex items-end gap-2">
                                        <h3 className="text-2xl font-extrabold text-navy">${projectedRemaining.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                                        <span className="bg-blue-50 text-primary text-[9px] px-2 py-0.5 rounded-full font-bold mb-1">
                                            {remainingDays} d. rest.
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-secondary opacity-50 mt-1">Ventas promedio: {formatCurrency(dailyAverage)}/día</p>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Cuentas por Cobrar Card */}
                    <div className="card p-5 flex justify-between items-center bg-white border border-green-50 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-5">
                            <ArrowUpRight size={70} className="text-success" />
                        </div>
                        <div>
                            <p className="text-[10px] text-secondary font-bold opacity-60 uppercase mb-1">Por Cobrar (Ventas a Crédito)</p>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-extrabold text-success">{formatCurrency(totals.pendingReceivables)}</h3>
                                <span className="bg-green-50 text-success text-[9px] px-2 py-0.5 rounded-full font-bold mb-1">
                                    {bills.filter(b => (b.type || 'PAYABLE') === 'RECEIVABLE' && b.status === 'PENDING').length} facturas
                                </span>
                            </div>
                            <p className="text-[10px] text-secondary opacity-50 mt-1">Flujo positivo programado</p>
                        </div>
                    </div>

                    {/* Cuentas por Pagar Card */}
                    <div className="card p-5 flex justify-between items-center bg-white border border-red-50 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-5">
                            <ArrowDownLeft size={70} className="text-danger" />
                        </div>
                        <div>
                            <p className="text-[10px] text-secondary font-bold opacity-60 uppercase mb-1">Por Pagar (Gastos Pendientes)</p>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-extrabold text-danger">{formatCurrency(totals.pendingPayables)}</h3>
                                <span className="bg-red-50 text-danger text-[9px] px-2 py-0.5 rounded-full font-bold mb-1">
                                    {bills.filter(b => (b.type || 'PAYABLE') === 'PAYABLE' && b.status === 'PENDING').length} facturas
                                </span>
                            </div>
                            <p className="text-[10px] text-secondary opacity-50 mt-1">Egresos previstos a pagar</p>
                        </div>
                    </div>
                </div>

                {/* Calendar Month Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-gray-100">
                        <button 
                            onClick={handlePrevMonth}
                            className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors text-secondary"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <h2 className="text-sm font-extrabold text-navy min-w-[120px] text-center capitalize">
                            {monthNames[month]} {year}
                        </h2>
                        <button 
                            onClick={handleNextMonth}
                            className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors text-secondary"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="bg-white rounded-3xl shadow-card flex-1 flex flex-col min-h-[580px] overflow-hidden border border-gray-50">
                    {/* Days of the week header */}
                    <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/20">
                        {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(day => (
                            <div key={day} className="py-3 text-center text-[10px] font-extrabold text-secondary opacity-50 tracking-widest">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Month cells */}
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                        {days.map((dayObj, i) => {
                            const dayBills = getBillsForDate(dayObj.fullDate);
                            
                            // Separate payables and receivables
                            const dayPayables = dayBills.filter(b => (b.type || 'PAYABLE') === 'PAYABLE');
                            const dayReceivables = dayBills.filter(b => (b.type || 'PAYABLE') === 'RECEIVABLE');
                            
                            const totalPayableAmount = dayPayables.reduce((sum, b) => sum + b.amount, 0);
                            const totalReceivableAmount = dayReceivables.reduce((sum, b) => sum + b.amount, 0);

                            const isSelected = selectedDate && selectedDate.getDate() === dayObj.fullDate.getDate() &&
                                selectedDate.getMonth() === dayObj.fullDate.getMonth() &&
                                selectedDate.getFullYear() === dayObj.fullDate.getFullYear();

                            const isToday = dayObj.fullDate.getDate() === new Date().getDate() &&
                                dayObj.fullDate.getMonth() === new Date().getMonth() &&
                                dayObj.fullDate.getFullYear() === new Date().getFullYear();

                            return (
                                <div
                                    key={i}
                                    onClick={() => setSelectedDate(dayObj.fullDate)}
                                    className={`
                                        border-b border-r border-gray-50 p-2 relative cursor-pointer hover:bg-blue-50/20 transition-all flex flex-col justify-between
                                        ${!dayObj.currentMonth ? 'bg-gray-50/10 text-gray-300' : 'text-secondary'}
                                        ${isSelected ? 'ring-2 ring-primary ring-inset z-10 bg-blue-50/5' : ''}
                                        ${isToday && !isSelected ? 'bg-primary/5' : ''}
                                        min-h-[90px]
                                    `}
                                >
                                    {/* Day Number */}
                                    <div className="flex justify-between items-start">
                                        <span className={`text-xs font-bold p-1 rounded-lg transition-all ${
                                            !dayObj.currentMonth ? 'text-gray-300' : 'text-navy'
                                        } ${
                                            isToday ? 'bg-primary text-white shadow-sm px-2 py-0.5 rounded-full flex items-center justify-center font-black' : ''
                                        }`}>
                                            {dayObj.date}
                                        </span>
                                        {isToday && <span className="text-[8px] font-black text-primary uppercase tracking-wider pr-1 pt-1">Hoy</span>}
                                    </div>

                                    {/* Cash Flow indicators inside the cells */}
                                    <div className="flex flex-col gap-1 mt-1 text-[9px]">
                                        {/* Pending Receivables (Green / Plus) */}
                                        {dayReceivables.length > 0 && (
                                            <div className="bg-green-50 text-success px-1.5 py-0.5 rounded border border-green-100/50 font-bold truncate flex items-center justify-between" title={`${dayReceivables.length} cobros pendientes`}>
                                                <span className="opacity-70">Cobros</span>
                                                <span className="font-extrabold">+{formatCurrency(totalReceivableAmount)}</span>
                                            </div>
                                        )}

                                        {/* Pending Payables (Red/Gray / Minus) */}
                                        {dayPayables.length > 0 && (
                                            <div className="bg-red-50 text-danger px-1.5 py-0.5 rounded border border-red-100/50 font-bold truncate flex items-center justify-between" title={`${dayPayables.length} pagos pendientes`}>
                                                <span className="opacity-70">Pagos</span>
                                                <span className="font-extrabold">-{formatCurrency(totalPayableAmount)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Alert Icon indicator for items */}
                                    {dayBills.length > 0 && (
                                        <div className="absolute top-2 right-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Sidebar Details Panel */}
            {selectedDate && (
                <div className="w-[420px] flex-shrink-0">
                    <DayDetailsPanel
                        onClose={() => setSelectedDate(null)}
                        date={selectedDate}
                        bills={getBillsForDate(selectedDate)}
                        onBillUpdate={fetchData}
                    />
                </div>
            )}

            {/* Bill Form Modal */}
            {showModal && (
                <BillFormModal
                    onClose={() => setShowModal(false)}
                    onBillAdded={fetchData}
                />
            )}
        </div>
    );
};

export default CalendarPage;
