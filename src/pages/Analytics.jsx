import React, { useState, useEffect, useMemo } from 'react';
import { Download, Wallet, Banknote, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import ProjectionChart from '../components/ProjectionChart';
import PaymentMixChart from '../components/PaymentMixChart';
import DebtList from '../components/DebtList';

const Analytics = () => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [bills, setBills] = useState([]);
    const [monthlyIncome, setMonthlyIncome] = useState(0);
    const [dailyAverage, setDailyAverage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('next30'); // 'next30' | 'lastMonth'

    const fetchData = async () => {
        try {
            // Fetch Settings
            let settingsInclude = false;
            try {
                const settingsRef = doc(db, 'settings', 'global_settings');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    settingsInclude = settingsSnap.data().includeDivisas || false;
                }
            } catch (err) {
                console.warn("Could not fetch settings", err);
            }

            const [, txData, billsRes] = await Promise.all([
                api.getBalance(),
                api.getTransactions(),
                api.getBills()
            ]);

            // Filter for Balance Calculation
            const validTxs = settingsInclude
                ? txData
                : txData.filter(tx => tx.method !== 'Divisas');

            setBills(billsRes);

            // --- Calculations within Scope ---
            const nowObj = new Date();
            const currentMonth = nowObj.getMonth();
            const currentYear = nowObj.getFullYear();

            const calculatedIncome = validTxs.filter(tx => tx.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
            const calculatedExpense = validTxs.filter(tx => tx.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
            setBalance(calculatedIncome - calculatedExpense);

            const mIncome = validTxs
                .filter(tx => {
                    if (!tx.date) return false;
                    const dateStr = typeof tx.date === 'string' ? tx.date.split('T')[0] : '';
                    const [y, m, d] = dateStr.split('-').map(Number);
                    const dObj = new Date(y, m - 1, d);
                    return tx.type === 'INCOME' && dObj.getMonth() === currentMonth && dObj.getFullYear() === currentYear;
                })
                .reduce((acc, curr) => acc + curr.amount, 0);
            setMonthlyIncome(mIncome);

            // Daily Average: Income / Current Day of Month
            const dayOfMonth = nowObj.getDate();
            setDailyAverage(dayOfMonth > 0 ? mIncome / dayOfMonth : 0);

            setTransactions(txData); // Keep raw for charts
        } catch (error) {
            console.error('Error fetching analytics data:', error);
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

    // --- Time Reference ---
    const now = useMemo(() => new Date(), []);

    // --- Last Month Calculations ---
    const lastMonthIncomes = useMemo(() => {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = lastMonthDate.getFullYear();
        const m = lastMonthDate.getMonth(); // 0-indexed
        
        return transactions
            .filter(tx => {
                if (!tx.date || tx.type !== 'INCOME') return false;
                const d = new Date(tx.date + 'T12:00:00');
                return d.getFullYear() === y && d.getMonth() === m;
            })
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [transactions, now]);

    const lastMonthExpenses = useMemo(() => {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = lastMonthDate.getFullYear();
        const m = lastMonthDate.getMonth();
        
        return transactions
            .filter(tx => {
                if (!tx.date || tx.type !== 'EXPENSE') return false;
                const d = new Date(tx.date + 'T12:00:00');
                return d.getFullYear() === y && d.getMonth() === m;
            })
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [transactions, now]);

    const lastMonthBalance = lastMonthIncomes - lastMonthExpenses;

    const lastMonthDailyAverage = useMemo(() => {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = lastMonthDate.getFullYear();
        const m = lastMonthDate.getMonth();
        const daysInLM = new Date(y, m + 1, 0).getDate();
        return daysInLM > 0 ? lastMonthIncomes / daysInLM : 0;
    }, [lastMonthIncomes, now]);

    // Filter transactions passed to PaymentMixChart dynamically
    const displayTransactions = useMemo(() => {
        if (timeRange === 'next30') return transactions;
        
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = lastMonthDate.getFullYear();
        const m = lastMonthDate.getMonth();
        
        return transactions.filter(tx => {
            if (!tx.date) return false;
            const d = new Date(tx.date + 'T12:00:00');
            return d.getFullYear() === y && d.getMonth() === m;
        });
    }, [transactions, timeRange, now]);

    // --- Future Calculations (Next 30 Days) ---
    const thirtyDaysFromNow = useMemo(() => {
        const d = new Date(now.getTime());
        d.setDate(d.getDate() + 30);
        return d;
    }, [now]);

    const pendingBills = useMemo(() => {
        return bills.filter(b => b.type !== 'RECEIVABLE' && b.status !== 'PAID' && b.status !== 'COMPLETED' && new Date(b.dueDate) <= thirtyDaysFromNow);
    }, [bills, thirtyDaysFromNow]);

    const scheduledPaymentsTotal = useMemo(() => {
        return pendingBills.reduce((acc, curr) => {
            const outstanding = curr.amount - (curr.paidAmount || 0);
            return acc + (outstanding > 0 ? outstanding : 0);
        }, 0);
    }, [pendingBills]);

    // --- Provider & Debt Analytics Calculations ---
    const providerStats = useMemo(() => {
        const stats = {}; // key: lowercase name
        bills.forEach(bill => {
            if (bill.type === 'RECEIVABLE') return;
            const originalName = bill.provider ? bill.provider.trim() : 'Sin Proveedor';
            const key = originalName.toLowerCase();
            if (!stats[key]) {
                stats[key] = {
                    providerName: originalName,
                    billsCount: 0,
                    totalInvoiced: 0,
                    totalPaid: 0,
                    totalOwed: 0,
                };
            }
            const isFullyPaid = bill.status === 'PAID' || bill.status === 'COMPLETED';
            const paid = isFullyPaid ? bill.amount : (bill.paidAmount || 0);
            const owed = isFullyPaid ? 0 : Math.max(0, bill.amount - (bill.paidAmount || 0));

            stats[key].billsCount += 1;
            stats[key].totalInvoiced += bill.amount;
            stats[key].totalPaid += paid;
            stats[key].totalOwed += owed;
        });

        return Object.values(stats).sort((a, b) => {
            if (b.totalOwed !== a.totalOwed) {
                return b.totalOwed - a.totalOwed;
            }
            return b.totalPaid - a.totalPaid;
        });
    }, [bills]);

    const { totalProviderOwed, totalProviderPaid } = useMemo(() => {
        let owed = 0;
        let paid = 0;
        providerStats.forEach(p => {
            owed += p.totalOwed;
            paid += p.totalPaid;
        });
        return { totalProviderOwed: owed, totalProviderPaid: paid };
    }, [providerStats]);

    // Dynamic Display Metrics
    const displayBalance = timeRange === 'next30' ? balance : lastMonthBalance;
    const displayIncome = timeRange === 'next30' ? monthlyIncome : lastMonthIncomes;
    const displayPayments = timeRange === 'next30' ? scheduledPaymentsTotal : lastMonthExpenses;
    const displayDailyAverage = timeRange === 'next30' ? dailyAverage : lastMonthDailyAverage;

    // CSV Export Handler
    const handleExportData = () => {
        const periodStr = timeRange === 'next30' ? 'Proximos_30_Dias' : 'Mes_Pasado';
        const titleStr = timeRange === 'next30' ? 'Próximos 30 Días' : 'Mes Pasado';
        
        let csvContent = `Reporte de Analíticas Financieras - ANÁLISIS PAGOS\r\n`;
        csvContent += `Período: ${titleStr}\r\n`;
        csvContent += `Fecha de Exportación: ${new Date().toLocaleString()}\r\n\r\n`;
        
        csvContent += `RESUMEN FINANCIERO\r\n`;
        csvContent += `Saldo Neto,${displayBalance.toFixed(2)}\r\n`;
        csvContent += `Ingresos Totales,${displayIncome.toFixed(2)}\r\n`;
        csvContent += `Gastos/Pagos,${displayPayments.toFixed(2)}\r\n`;
        csvContent += `Venta Promedio Diaria,${displayDailyAverage.toFixed(2)}\r\n\r\n`;
        
        if (timeRange === 'next30') {
            csvContent += `CUENTAS POR PAGAR PENDIENTES (PRÓXIMOS 30 DÍAS)\r\n`;
            csvContent += `ID,Proveedor,Título,Vencimiento,Monto,Estado\r\n`;
            pendingBills.forEach(b => {
                csvContent += `"${b.id}","${b.provider || '-'}","${b.title}","${new Date(b.dueDate).toLocaleDateString()}",${b.amount},"${b.status}"\r\n`;
            });
        } else {
            csvContent += `TRANSACCIONES REGISTRADAS (MES PASADO)\r\n`;
            csvContent += `ID,Fecha,Categoría,Nota,Método,Monto,Tipo\r\n`;
            
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const y = lastMonthDate.getFullYear();
            const m = lastMonthDate.getMonth();
            
            const lastMonthTxs = transactions.filter(tx => {
                if (!tx.date) return false;
                const d = new Date(tx.date + 'T12:00:00');
                return d.getFullYear() === y && d.getMonth() === m;
            });
            
            lastMonthTxs.forEach(t => {
                csvContent += `"${t.id}","${new Date(t.date + 'T12:00:00').toLocaleDateString()}","${t.category || '-'}","${t.note || '-'}","${t.method}",${t.amount},"${t.type}"\r\n`;
            });
        }
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Reporte_Financiero_${periodStr}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert(`¡El reporte del período "${titleStr}" se ha exportado correctamente como archivo CSV!`);
    };

    return (
        <div className="flex flex-col gap-8 h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy">Analíticas y Proyecciones</h1>
                    <p className="text-secondary opacity-60">Visión estratégica de tu flujo de caja, pasivos y solvencia en tiempo real.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Modern Segmented Toggle Controls */}
                    <div className="flex bg-slate-100/80 p-1 rounded-xl border border-gray-200/50 shadow-sm flex-1 md:flex-none">
                        <button 
                            onClick={() => setTimeRange('next30')}
                            className={`flex-1 md:flex-none px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer select-none ${timeRange === 'next30' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-navy hover:bg-white/50'}`}
                        >
                            Próximos 30 días
                        </button>
                        <button 
                            onClick={() => setTimeRange('lastMonth')}
                            className={`flex-1 md:flex-none px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer select-none ${timeRange === 'lastMonth' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-navy hover:bg-white/50'}`}
                        >
                            Mes Pasado
                        </button>
                    </div>
                    {/* Modern Export button */}
                    <button 
                        onClick={handleExportData}
                        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-slate-200 hover:border-slate-300 shadow-sm cursor-pointer select-none active:scale-[0.97]"
                    >
                        <Download size={14} className="text-primary" />
                        Exportar Reporte
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title={timeRange === 'next30' ? "Saldo Disponible Hoy" : "Saldo Neto (Mes Pasado)"}
                    value={loading ? '...' : formatCurrency(displayBalance)}
                    trend={loading ? 'info' : (displayBalance >= 0 ? 'up' : 'down')}
                    trendValue={timeRange === 'next30' ? "Actualizado" : "Balance neto"}
                    icon={<Wallet size={20} className="text-teal-600" />}
                />
                <StatCard
                    title={timeRange === 'next30' ? "Ingresos (Mes Actual)" : "Ingresos (Mes Pasado)"}
                    value={loading ? '...' : formatCurrency(displayIncome)}
                    trend="info"
                    trendValue={timeRange === 'next30' ? "Acumulado" : "Total ingresos"}
                    icon={<Banknote size={20} className="text-green-500" />}
                />
                <StatCard
                    title={timeRange === 'next30' ? "Pagos Programados" : "Gastos Pagados (Mes Pasado)"}
                    value={loading ? '...' : formatCurrency(displayPayments)}
                    trend="down"
                    trendValue={timeRange === 'next30' ? `${pendingBills.length} por vencer(30d)` : "Total facturas pagadas"}
                    icon={<AlertCircle size={20} className="text-red-500" />}
                />
                <StatCard
                    title={timeRange === 'next30' ? "Venta Promedio Diaria" : "Venta Promedio (Mes Pasado)"}
                    value={loading ? '...' : formatCurrency(displayDailyAverage)}
                    trend="info"
                    trendValue={timeRange === 'next30' ? "Promedio del mes actual" : "Promedio diario"}
                    icon={<Banknote size={20} className="text-blue-500" />}
                />
            </div>

            {/* Chart Section */}
            <div>
                {timeRange === 'next30' ? (
                    <ProjectionChart balance={balance} bills={bills} dailyAverage={dailyAverage} />
                ) : (
                    <div className="card bg-white p-6 rounded-3xl shadow-card border border-gray-100 flex flex-col justify-center items-center text-center gap-2.5 h-80 select-none">
                        <AlertCircle size={36} className="text-primary opacity-40 animate-pulse" />
                        <p className="font-extrabold text-navy text-sm">Visualización del Gráfico de Flujo de Caja</p>
                        <p className="text-xs text-secondary opacity-60 max-w-sm leading-relaxed">
                            La proyección del flujo de caja refleja las estimaciones futuras de saldo para los próximos 30 días. Cambia a "Próximos 30 días" en la parte superior para visualizar la proyección detallada.
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom Section: Donut & List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <PaymentMixChart transactions={displayTransactions} />
                </div>
                <div className="lg:col-span-2">
                    <DebtList bills={bills.filter(b => b.type !== 'RECEIVABLE')} />
                </div>
            </div>

            {/* Provider and Accounts Payable Summary Section */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-1 border-t border-slate-250/30 pt-6">
                    <h2 className="text-xl font-black text-navy">Resumen de Proveedores y Cuentas por Pagar</h2>
                    <p className="text-xs text-secondary opacity-60">Visualización detallada de deudas pendientes y totales cancelados a cada proveedor.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard
                        title="Total Deuda Pendiente (¿Cuánto debo?)"
                        value={loading ? '...' : formatCurrency(totalProviderOwed)}
                        trend={totalProviderOwed > 0 ? 'down' : 'info'}
                        trendValue={totalProviderOwed > 0 ? "Saldo pendiente por liquidar" : "Sin deudas pendientes"}
                        icon={<AlertCircle size={20} className="text-danger" />}
                    />
                    <StatCard
                        title="Total Pagado a Proveedores"
                        value={loading ? '...' : formatCurrency(totalProviderPaid)}
                        trend="up"
                        trendValue="Monto histórico abonado"
                        icon={<Banknote size={20} className="text-success" />}
                    />
                </div>

                <div className="card bg-white shadow-card rounded-[20px] overflow-hidden flex flex-col p-0 border border-gray-100/50">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-navy">Desglose por Proveedor</h3>
                        <p className="text-xs text-secondary opacity-60">Resumen consolidado de facturación, abonos y progreso de pago.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="p-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider">Proveedor</th>
                                    <th className="p-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider text-center">Facturas</th>
                                    <th className="p-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider text-right">Total Facturado</th>
                                    <th className="p-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider text-right">Total Pagado</th>
                                    <th className="p-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider text-right">Deuda Pendiente</th>
                                    <th className="p-6 py-4 text-xs font-bold text-secondary uppercase tracking-wider" style={{ width: '200px' }}>Progreso de Pago</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-secondary opacity-50 font-semibold">Cargando proveedores...</td>
                                    </tr>
                                ) : providerStats.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-12 text-center text-secondary opacity-50 font-semibold">
                                            No hay datos de proveedores registrados
                                        </td>
                                    </tr>
                                ) : (
                                    providerStats.map((p, idx) => {
                                        const progressPercent = p.totalInvoiced > 0 
                                            ? Math.min(100, Math.max(0, (p.totalPaid / p.totalInvoiced) * 100))
                                            : 0;

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="p-6 py-4">
                                                    <p className="font-bold text-navy text-sm">{p.providerName}</p>
                                                </td>
                                                <td className="p-6 py-4 text-center">
                                                    <span className="inline-flex items-center justify-center bg-slate-100 text-secondary font-bold text-xs px-2.5 py-1 rounded-lg">
                                                        {p.billsCount}
                                                    </span>
                                                </td>
                                                <td className="p-6 py-4 text-right">
                                                    <p className="font-semibold text-secondary text-sm">{formatCurrency(p.totalInvoiced)}</p>
                                                </td>
                                                <td className="p-6 py-4 text-right">
                                                    <p className="font-bold text-success text-sm">{formatCurrency(p.totalPaid)}</p>
                                                </td>
                                                <td className="p-6 py-4 text-right">
                                                    <p className={`font-black text-sm ${p.totalOwed > 0 ? 'text-danger' : 'text-secondary opacity-50'}`}>
                                                        {formatCurrency(p.totalOwed)}
                                                    </p>
                                                </td>
                                                <td className="p-6 py-4">
                                                    <div className="flex flex-col gap-1.5 w-full">
                                                        <div className="flex justify-between items-center text-[10px] font-bold text-secondary">
                                                            <span>{progressPercent.toFixed(0)}% pagado</span>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 ${
                                                                    progressPercent === 100 
                                                                        ? 'bg-success' 
                                                                        : progressPercent > 50 
                                                                            ? 'bg-primary' 
                                                                            : progressPercent > 0 
                                                                                ? 'bg-warning' 
                                                                                : 'bg-slate-200'
                                                                }`}
                                                                style={{ width: `${progressPercent}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
