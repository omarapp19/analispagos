import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, AlertCircle, AlertTriangle, Plus } from 'lucide-react';
import { api } from '../services/api';
import DayDetailsPanel from '../components/DayDetailsPanel';
import BillFormModal from '../components/BillFormModal';

const CalendarPage = () => {
    const [selectedDate, setSelectedDate] = useState(null);
    const [bills, setBills] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState('PAYABLE'); // 'PAYABLE' or 'RECEIVABLE'

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

    // Helper to find bills for a specific date and active tab
    const getBillsForDate = (dateObj, tabType = activeTab) => {
        return bills.filter(bill => {
            if (!bill.dueDate) return false;
            
            // Default to PAYABLE for backward compatibility
            const billType = bill.type || 'PAYABLE';
            if (billType !== tabType) return false;

            // Parse YYYY-MM-DD explicitly to avoid timezone issues
            const dateStr = typeof bill.dueDate === 'string' ? bill.dueDate.split('T')[0] : '';
            const [y, m, d] = dateStr.split('-').map(Number);
            const billDate = new Date(y, m - 1, d, 12, 0, 0);

            return bill.status === 'PENDING' && // Filter to only show pending
                billDate.getDate() === dateObj.getDate() &&
                billDate.getMonth() === dateObj.getMonth() &&
                billDate.getFullYear() === dateObj.getFullYear();
        });
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Calculations for metrics
    const activeBillsPending = bills.filter(b => (b.type || 'PAYABLE') === activeTab && b.status === 'PENDING');
    const totalPendingAmount = activeBillsPending.reduce((sum, b) => sum + b.amount, 0);

    const hasOverdue = bills.some(b => 
        (b.type || 'PAYABLE') === activeTab && 
        b.status === 'PENDING' && 
        new Date(b.dueDate.split('T')[0] + 'T23:59:59') < new Date()
    );

    return (
        <div className="flex h-full gap-8 overflow-hidden relative">
            <div className="flex-1 flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar">
                <div className="mb-6 flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-navy">Cuentas por Pagar / Cobrar</h1>
                        <p className="text-sm text-secondary opacity-60">Gestión visual de liquidez y vencimientos</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className={`btn flex items-center gap-2 shadow-lg hover:shadow-teal-500/50 ${
                            activeTab === 'PAYABLE' 
                                ? 'btn-primary shadow-teal-500/30' 
                                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/30'
                        }`}
                    >
                        <Plus size={18} />
                        Nueva Factura
                    </button>
                </div>

                {/* Segmented Control Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-100 max-w-md mb-6">
                    <button
                        onClick={() => {
                            setActiveTab('PAYABLE');
                            setSelectedDate(null);
                        }}
                        className={`flex-1 py-3 px-6 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'PAYABLE'
                                ? 'bg-white text-danger shadow-md border border-red-100/30'
                                : 'text-secondary opacity-60 hover:opacity-100'
                        }`}
                    >
                        Cuentas por Pagar
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            activeTab === 'PAYABLE' ? 'bg-red-50 text-danger' : 'bg-gray-200 text-secondary'
                        }`}>
                            {bills.filter(b => (b.type || 'PAYABLE') === 'PAYABLE' && b.status === 'PENDING').length}
                        </span>
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('RECEIVABLE');
                            setSelectedDate(null);
                        }}
                        className={`flex-1 py-3 px-6 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'RECEIVABLE'
                                ? 'bg-white text-teal-600 shadow-md border border-teal-100/30'
                                : 'text-secondary opacity-60 hover:opacity-100'
                        }`}
                    >
                        Cuentas por Cobrar
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            activeTab === 'RECEIVABLE' ? 'bg-teal-50 text-teal-600' : 'bg-gray-200 text-secondary'
                        }`}>
                            {bills.filter(b => b.type === 'RECEIVABLE' && b.status === 'PENDING').length}
                        </span>
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {(() => {
                        // Calculate Projected Sales
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
                            <div className="card p-5 flex justify-between items-center bg-white border border-gray-50/50 shadow-sm">
                                <div>
                                    <p className="text-xs text-secondary font-bold opacity-60 uppercase mb-2">Venta Proyectada (Restante)</p>
                                    <div className="flex items-end gap-3">
                                        <h3 className="text-3xl font-bold text-navy">${projectedRemaining.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                                        <span className="bg-blue-50 text-primary text-[10px] px-2 py-1 rounded-full font-bold mb-1">
                                            {remainingDays} días rest.
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-secondary opacity-50 mt-1">Base: ${dailyAverage.toLocaleString(undefined, { maximumFractionDigits: 0 })}/día prom.</p>
                                </div>
                                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-secondary opacity-40">
                                    <TrendingUp size={24} />
                                </div>
                            </div>
                        );
                    })()}

                    <div className="card p-5 flex justify-between items-center bg-white border border-gray-50/50 shadow-sm">
                        <div>
                            <p className="text-xs text-secondary font-bold opacity-60 uppercase mb-2">
                                {activeTab === 'PAYABLE' ? 'Total por Pagar' : 'Total por Cobrar'}
                            </p>
                            <div className="flex items-end gap-3">
                                <h3 className="text-3xl font-bold text-navy">${totalPendingAmount.toLocaleString()}</h3>
                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold mb-1 ${
                                    activeTab === 'PAYABLE' ? 'bg-red-50 text-danger' : 'bg-teal-50 text-teal-600'
                                }`}>
                                    {activeTab === 'PAYABLE' ? 'Pasivo' : 'Activo'}
                                </span>
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-secondary opacity-40">
                            <TrendingDown size={24} className={activeTab === 'PAYABLE' ? 'text-danger' : 'text-teal-600'} />
                        </div>
                    </div>

                    <div className={`card p-5 flex items-center gap-4 border shadow-none transition-all ${
                        hasOverdue 
                            ? 'bg-red-50 border-red-100' 
                            : 'bg-green-50 border-green-100'
                    }`}>
                        <div className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center flex-shrink-0 ${
                            hasOverdue 
                                ? 'bg-white text-danger' 
                                : 'bg-white text-success'
                        }`}>
                            {hasOverdue ? <AlertTriangle size={20} fill="currentColor" className="text-white" /> : <TrendingUp size={20} />}
                        </div>
                        <div>
                            <p className={`text-sm font-bold ${hasOverdue ? 'text-danger' : 'text-success'}`}>
                                {activeTab === 'PAYABLE' ? 'Estado de Liquidez' : 'Estado de Cartera'}
                            </p>
                            <p className={`text-[11px] opacity-80 leading-snug ${hasOverdue ? 'text-danger' : 'text-success'}`}>
                                {activeTab === 'PAYABLE' 
                                    ? (hasOverdue ? 'Facturas vencidas detectadas' : 'Al día con los pagos')
                                    : (hasOverdue ? 'Cobros pendientes vencidos' : 'Al día con las cobranzas')
                                }
                            </p>
                        </div>
                    </div>
                </div>

                {/* Calendar Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                        <button 
                            onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={20} className="text-secondary" />
                        </button>
                        <h2 className="text-lg font-bold text-navy min-w-[140px] text-center capitalize">{monthNames[month]} {year}</h2>
                        <button 
                            onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
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
                            const hasBills = dayBills.length > 0;
                            const isSelected = selectedDate && selectedDate.getTime() === dayObj.fullDate.getTime();
                            const totalAmount = dayBills.reduce((sum, b) => sum + b.amount, 0);

                            const isToday = dayObj.fullDate.getDate() === new Date().getDate() &&
                                dayObj.fullDate.getMonth() === new Date().getMonth() &&
                                dayObj.fullDate.getFullYear() === new Date().getFullYear();

                            return (
                                <div
                                    key={i}
                                    onClick={() => setSelectedDate(dayObj.fullDate)}
                                    className={`
                                        border-b border-r border-gray-50 p-2 relative cursor-pointer hover:bg-blue-50/30 transition-all flex flex-col gap-1
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
                                        <div className="flex flex-col gap-1 mt-auto">
                                            <div className={`text-[10px] px-2 py-1 rounded-md font-bold w-full truncate border ${
                                                activeTab === 'PAYABLE' 
                                                    ? 'bg-red-50/50 text-danger border-red-100/50' 
                                                    : 'bg-teal-50/50 text-teal-600 border-teal-100/50'
                                            }`}>
                                                <span className="block opacity-75 mb-0.5">
                                                    {dayBills.length} {activeTab === 'PAYABLE' ? 'Gastos' : 'Cobros'}
                                                </span>
                                                <span>
                                                    {activeTab === 'PAYABLE' ? '-' : '+'}${totalAmount.toLocaleString()}
                                                </span>
                                            </div>
                                            {dayBills.some(b => b.status === 'PENDING') && (
                                                <div className="absolute top-2 right-2 text-warning">
                                                    <AlertCircle size={14} fill="currentColor" className="text-white" />
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
                    <div className="h-full w-full sm:w-[400px] lg:w-auto" onClick={(e) => e.stopPropagation()}>
                        <DayDetailsPanel
                            onClose={() => setSelectedDate(null)}
                            date={selectedDate}
                            bills={getBillsForDate(selectedDate)}
                            onBillUpdate={fetchData}
                            type={activeTab}
                        />
                    </div>
                </div>
            )}

            {showModal && (
                <BillFormModal
                    onClose={() => setShowModal(false)}
                    onBillAdded={fetchData}
                    defaultType={activeTab}
                />
            )}
        </div>
    );
};

export default CalendarPage;
