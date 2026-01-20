import React, { useMemo } from 'react';

const DebtList = ({ bills = [] }) => {

    const providers = useMemo(() => {
        // Aggregate pending bills by provider
        const grouped = bills.reduce((acc, bill) => {
            if (bill.status === 'PENDING') {
                const name = bill.provider || 'Sin Proveedor';
                acc[name] = (acc[name] || 0) + bill.amount;
            }
            return acc;
        }, {});

        const sorted = Object.entries(grouped)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5); // Top 5

        const maxAmount = sorted.length > 0 ? sorted[0].amount : 1;

        return sorted.map(p => ({
            ...p,
            total: maxAmount // for bar ratio
        }));
    }, [bills]);

    return (
        <div className="card w-full h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-secondary">Deuda por Proveedor</h3>
                    <p className="text-xs text-secondary opacity-60">Top 5 acreedores pendientes de pago</p>
                </div>
                <button className="text-primary text-sm font-bold hover:underline">Ver todos</button>
            </div>

            <div className="flex flex-col gap-5">
                {providers.length === 0 ? (
                    <p className="text-secondary opacity-50 text-center py-4">No hay deudas pendientes</p>
                ) : (
                    providers.map((p, i) => (
                        <div key={i}>
                            <div className="flex justify-between text-sm font-medium text-secondary mb-1">
                                <span>{p.name} {i === 0 && <span className="text-danger">•</span>}</span>
                                <span className={i === 0 ? 'text-danger' : ''}>
                                    ${p.amount.toLocaleString()}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${i === 0 ? 'bg-danger' : 'bg-teal-600'}`}
                                    style={{ width: `${(p.amount / p.total) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DebtList;
