import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ProjectionChart = ({ balance, bills = [], dailyAverage = 0 }) => {

    const data = useMemo(() => {
        const today = new Date();
        const result = [];
        let currentBalance = balance;

        // Generate next 30 days
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(today.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            // Add Daily Sales Projection
            // Simpler: Just add the daily average every day
            currentBalance += dailyAverage;

            // Subtract Bills due on this day
            const billsDue = bills.filter(b => b.status === 'PENDING' && b.dueDate.startsWith(dateStr));
            const billsTotal = billsDue.reduce((sum, b) => sum + b.amount, 0);

            currentBalance -= billsTotal;

            result.push({
                date: date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
                balance: currentBalance,
                bills: billsTotal
            });
        }
        return result;
    }, [balance, bills, dailyAverage]);

    return (
        <div className="card h-full w-full p-6 bg-white shadow-card rounded-3xl">
            <div className="mb-6">
                <h3 className="text-lg font-bold text-navy">Proyección de Flujo de Caja (30 Días)</h3>
                <p className="text-sm text-secondary opacity-60">Estimación basada en saldo actual + venta promedio diaria - facturas por pagar.</p>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4318FF" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#4318FF" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#A3AED0', fontSize: 12 }}
                            interval={4}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#A3AED0', fontSize: 12 }}
                            tickFormatter={(value) => `$${value / 1000}k`}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value) => [`$${value.toLocaleString()}`, 'Saldo Proyectado']}
                        />
                        <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="#4318FF"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorBalance)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="flex gap-4 mt-4 justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#4318FF]"></div>
                    <span className="text-xs font-bold text-secondary">Saldo Estimado</span>
                </div>
            </div>
        </div>
    );
};

export default ProjectionChart;
