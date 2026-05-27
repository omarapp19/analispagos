import React, { useState, useEffect } from 'react';
import { Landmark, DollarSign, ArrowRightLeft, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import ExchangeRatesCard from '../components/ExchangeRatesCard';
import RecentActivity from '../components/RecentActivity';

const DashboardFlow = () => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    const [nextBill, setNextBill] = useState(null);
    const [stats, setStats] = useState({ income: 0, expenses: 0, salePercentage: 0, expensePercentage: 0 });
    const [totalDivisas, setTotalDivisas] = useState(0);
    const [includeDivisas, setIncludeDivisas] = useState(false);
    const [settings, setSettings] = useState({ storeName: 'Galpón', adminName: 'Omar Pérez' });

    const fetchData = async () => {
        try {
            // 1. Fetch Settings First
            let settingsInclude = false;
            let settingsData = { storeName: 'Galpón', adminName: 'Omar Pérez', includeDivisas: false };
            
            try {
                const settingsRef = doc(db, 'settings', 'global_settings');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    const sData = settingsSnap.data();
                    settingsData = {
                        storeName: sData.storeName || 'Galpón',
                        adminName: sData.adminName || 'Omar Pérez',
                        includeDivisas: sData.includeDivisas || false
                    };
                    settingsInclude = sData.includeDivisas || false;
                }
            } catch (err) {
                console.warn("Could not fetch settings", err);
            }
            setSettings(settingsData);
            setIncludeDivisas(settingsInclude);

            // 2. Fetch Transactions & Bills
            const [balanceData, txData, upcomingBillData] = await Promise.all([
                api.getBalance(),
                api.getTransactions(),
                api.getUpcomingBill()
            ]);

            setTransactions(txData);
            setNextBill(upcomingBillData);

            // 3. Separate Divisas
            const divisasTxs = txData.filter(tx => tx.method === 'Divisas' && tx.type === 'INCOME');
            const totalDivisasAmount = divisasTxs.reduce((acc, curr) => acc + curr.amount, 0);
            setTotalDivisas(totalDivisasAmount);

            // 4. Filter for Main Stats & Balance
            const validTxs = settingsInclude
                ? txData
                : txData.filter(tx => tx.method !== 'Divisas');

            // Calculate Balance based on validTxs
            const calculatedIncome = validTxs.filter(tx => tx.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
            const calculatedExpense = validTxs.filter(tx => tx.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
            setBalance(calculatedIncome - calculatedExpense);

            // 5. Calculate monthly stats
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            const monthlyTxs = validTxs.filter(tx => {
                if (!tx.date) return false;
                const dateStr = typeof tx.date === 'string' ? tx.date.split('T')[0] : '';
                const [y, m, d] = dateStr.split('-').map(Number);
                return (m - 1) === currentMonth && y === currentYear;
            });

            const income = monthlyTxs.filter(tx => tx.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
            const expenses = monthlyTxs.filter(tx => tx.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
            const total = income + expenses;

            setStats({
                income,
                expenses,
                salePercentage: total > 0 ? Math.round((income / total) * 100) : 0,
                expensePercentage: total > 0 ? Math.round((expenses / total) * 100) : 0
            });

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return '¡Buenos días';
        if (hour < 18) return '¡Buenas tardes';
        return '¡Buenas noches';
    };

    // Calculate next bill urgency
    const daysUntilDue = nextBill ? Math.ceil((new Date(nextBill.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    const isUrgent = nextBill ? daysUntilDue <= 1 : false;

    return (
        <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1 custom-scrollbar">
            {/* Dynamic Greeting Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-50/20 via-slate-50/40 to-teal-50/20 p-6 rounded-3xl border border-gray-100/50 shadow-sm relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                <div className="relative z-10">
                    <h1 className="text-xl font-black text-navy flex items-center gap-2">
                        {getGreeting()}, {settings.adminName.split(' ')[0]}! <span className="animate-bounce">👋</span>
                    </h1>
                    <p className="text-xs text-secondary font-medium mt-1">
                        Control de caja y liquidez de <span className="text-primary font-bold">{settings.storeName}</span>. Aquí tienes el estado financiero para hoy.
                    </p>
                </div>
                <div className="px-3 py-1.5 bg-white rounded-xl shadow-sm border border-gray-150 flex items-center gap-2 text-[10px] font-black text-navy flex-shrink-0 relative z-10">
                    <span className="w-2 h-2 rounded-full bg-primary inline-block animate-pulse"></span>
                    <span className="capitalize">
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                </div>
            </div>

            {/* Top Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Card 1: Saldo Disponible */}
                <Link 
                    to="/calendar" 
                    className="card bg-white p-5 rounded-2xl shadow-card border border-gray-100 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 flex flex-col justify-between h-[140px] group cursor-pointer relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-3xl opacity-30 group-hover:scale-110 transition-transform"></div>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 opacity-60">Saldo Disponible (Caja)</p>
                            <h3 className={`text-2xl font-black ${balance >= 0 ? 'text-navy' : 'text-danger'}`}>
                                {loading ? '...' : formatCurrency(balance)}
                            </h3>
                        </div>
                        <div className="w-10 h-10 bg-blue-50 text-primary rounded-xl flex items-center justify-center shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                            <Landmark size={20} />
                        </div>
                    </div>
                    <div className="text-[9px] font-extrabold text-secondary opacity-60 flex items-center justify-between pt-2 border-t border-gray-50">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${includeDivisas ? 'bg-success animate-pulse' : 'bg-primary'}`}></span>
                            <span>{includeDivisas ? "Inc. Divisas" : "Excluye Divisas"}</span>
                        </div>
                        <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-all text-primary" />
                    </div>
                </Link>

                {/* Card 2: Total Divisas */}
                <Link 
                    to="/calendar"
                    className="card bg-white p-5 rounded-2xl shadow-card border border-gray-100 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 flex flex-col justify-between h-[140px] group cursor-pointer relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-bl-3xl opacity-30 group-hover:scale-110 transition-transform"></div>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 opacity-60">Caja Divisas (Dólares)</p>
                            <h3 className="text-2xl font-black text-navy">{loading ? '...' : formatCurrency(totalDivisas)}</h3>
                        </div>
                        <div className="w-10 h-10 bg-amber-50 text-warning rounded-xl flex items-center justify-center shadow-sm group-hover:bg-warning group-hover:text-white transition-all">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <div className="text-[9px] font-extrabold text-warning bg-amber-50 border border-amber-100/50 w-fit px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>
                        Reserva
                    </div>
                </Link>

                {/* Card 3: Desempeño Mensual */}
                <div className="card bg-white p-5 rounded-2xl shadow-card border border-gray-100 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between h-[140px] relative overflow-hidden group">
                    <div>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 opacity-60">Desempeño del Mes</p>
                        <div className="flex justify-between items-baseline mb-2">
                            <span className="text-lg font-black text-navy">{formatCurrency(stats.income)}</span>
                            <span className="text-[10px] font-bold text-secondary opacity-60">Ingresos</span>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-100">
                            <div className="h-full bg-primary shadow-sm transition-all duration-500" style={{ width: `${stats.salePercentage}%` }}></div>
                            <div className="h-full bg-danger shadow-sm transition-all duration-500" style={{ width: `${stats.expensePercentage}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[8px] font-black text-secondary uppercase tracking-wider">
                            <span className="text-primary">Ventas ({stats.salePercentage}%)</span>
                            <span className="text-danger">Gastos ({stats.expensePercentage}%)</span>
                        </div>
                    </div>
                </div>

                {/* Card 4: Próximo Vencimiento */}
                <Link 
                    to={nextBill ? "/calendar" : "/invoices"}
                    className="card bg-white p-5 rounded-2xl shadow-card border border-gray-100 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 flex flex-col justify-between h-[140px] group cursor-pointer relative overflow-hidden"
                >
                    {/* Urgency border indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isUrgent ? 'bg-danger animate-pulse' : 'bg-success'}`}></div>
                    
                    <div className="flex justify-between items-start pl-1.5">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 opacity-60">
                                {nextBill ? 'Próximo Pago' : 'Sin Deudas'}
                            </p>
                            <h4 className="text-xs font-black text-navy truncate max-w-[130px]">{nextBill ? nextBill.title : 'Todo al día'}</h4>
                        </div>
                        {nextBill && (
                            <div className="bg-red-50 text-danger border border-red-100/50 px-2.5 py-0.5 rounded-lg text-xs font-black flex-shrink-0">
                                {formatCurrency(nextBill.amount)}
                            </div>
                        )}
                    </div>
                    
                    <div className="pl-1.5 text-[9px] font-extrabold text-secondary opacity-70 flex justify-between items-center">
                        {nextBill ? (
                            <span>
                                Vence: <span className={`font-black uppercase ${isUrgent ? 'text-danger animate-pulse' : 'text-navy'}`}>
                                    {daysUntilDue < 0 ? 'Vencido' :
                                     daysUntilDue === 0 ? 'Hoy' :
                                     daysUntilDue === 1 ? 'Mañana' :
                                     `En ${daysUntilDue} días`}
                                </span>
                            </span>
                        ) : (
                            <span className="text-success uppercase tracking-wider flex items-center gap-1">
                                <CheckCircle size={10} fill="currentColor" className="text-white" />
                                Caja limpia
                            </span>
                        )}
                        <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-all text-primary" />
                    </div>
                </Link>

            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch">
                {/* Left Column (4/12): Exchange Rates */}
                <div className="lg:col-span-4 h-full flex flex-col">
                    <ExchangeRatesCard />
                </div>

                {/* Right Column (8/12): Activity List */}
                <div className="lg:col-span-8 h-full flex flex-col">
                    <RecentActivity transactions={transactions} onTransactionDeleted={fetchData} />
                </div>
            </div>
        </div>
    );
};

export default DashboardFlow;
