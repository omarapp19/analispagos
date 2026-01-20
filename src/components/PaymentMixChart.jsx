import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const PaymentMixChart = ({ transactions = [] }) => {

    const data = useMemo(() => {
        const mix = transactions.reduce((acc, tx) => {
            if (tx.type === 'INCOME') {
                const method = tx.method || 'Otros';
                acc[method] = (acc[method] || 0) + 1;
            }
            return acc;
        }, {});

        const total = Object.values(mix).reduce((a, b) => a + b, 0);

        // Map expected methods to colors
        const colors = {
            'Efectivo': '#05CD99', // Success Green
            'Tarjeta': '#4318FF',  // Primary Blue
            'Transferencia': '#11CDEF', // Info Cyan
            'Otros': '#A3AED0'
        };

        return Object.entries(mix).map(([name, value]) => ({
            name,
            value: total > 0 ? Math.round((value / total) * 100) : 0,
            count: value,
            color: colors[name] || colors['Otros']
        }));
    }, [transactions]);

    const totalTx = transactions.filter(t => t.type === 'INCOME').length;

    // Custom Legend
    const renderLegend = () => {
        return (
            <div className="flex flex-col gap-4 mt-6 w-full px-4">
                {data.map((entry, index) => (
                    <div key={`item-${index}`} className="flex items-center justify-between w-full p-3 rounded-xl bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color }}></div>
                            <span className="text-secondary font-bold text-sm">{entry.name}</span>
                        </div>
                        <span className="font-bold text-navy text-lg">{entry.value}%</span>
                    </div>
                ))}
                {data.length === 0 && <p className="text-center text-secondary text-sm opacity-50">No hay datos de ventas</p>}
            </div>
        );
    };

    return (
        <div className="card w-full h-full flex flex-col items-center">
            <div className="w-full text-left mb-4">
                <h3 className="text-lg font-bold text-navy">Mix de Pagos</h3>
                <p className="text-sm text-secondary opacity-60">Distribución por método de pago</p>
            </div>

            <div className="relative w-[220px] h-[220px] my-2">
                {/* Center Text */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10 bg-white/80 p-4 rounded-full backdrop-blur-sm">
                    <p className="text-3xl font-bold text-navy">Total</p>
                    <p className="text-sm text-secondary font-medium">{totalTx} Tx</p>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data.length > 0 ? data : [{ name: 'Sin datos', value: 100, color: '#E0E5F2' }]}
                            cx="50%"
                            cy="50%"
                            innerRadius={75}
                            outerRadius={95}
                            paddingAngle={5}
                            cornerRadius={10}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.length > 0 ? data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            )) : <Cell fill="#E0E5F2" />}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {renderLegend()}
        </div>
    );
};

export default PaymentMixChart;
