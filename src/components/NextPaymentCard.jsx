import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

const NextPaymentCard = ({ bill }) => {
    const daysUntilDue = bill ? Math.ceil((new Date(bill.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    const dueDateDisplay = bill ? new Date(bill.dueDate).toLocaleDateString() : '-';

    // Determine urgency color/text
    let urgencyText = "No hay pagos pendientes";
    let isUrgent = false;

    if (bill) {
        if (daysUntilDue < 0) { urgencyText = "Vencido"; isUrgent = true; }
        else if (daysUntilDue === 0) { urgencyText = "Vence Hoy"; isUrgent = true; }
        else if (daysUntilDue === 1) { urgencyText = "Mañana"; isUrgent = true; }
        else { urgencyText = `En ${daysUntilDue} días`; isUrgent = false; }
    }

    return (
        <div className="card h-full relative overflow-hidden flex flex-col justify-between">
            {/* Left Border Accent */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isUrgent ? 'bg-warning' : 'bg-success'}`}></div>

            <div className="flex justify-between items-start mb-2 pl-2">
                <div className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-widest px-2 py-1 rounded ${isUrgent ? 'text-warning bg-orange-50' : 'text-success bg-green-50'}`}>
                    {isUrgent ? <AlertTriangle size={12} fill="currentColor" /> : null}
                    {bill ? 'PRÓXIMO PAGO' : 'SIN DEUDAS'}
                </div>
                {bill && (
                    <div className="bg-orange-50 text-warning px-3 py-1 rounded-xl text-xs font-bold flex flex-col items-end leading-tight border border-orange-100/50">
                        <span className="text-[9px] opacity-70 uppercase tracking-wider">Monto</span>
                        ${(bill.amount || 0).toLocaleString()}
                    </div>
                )}
            </div>

            <div className="pl-2 mt-1">
                <h4 className="text-xl font-bold text-navy mb-1 truncate" title={bill?.title}>{bill ? bill.title : 'Todo al día'}</h4>
                {bill && <p className="text-sm text-secondary font-medium">Vence: <span className={`font-bold ${isUrgent ? 'text-danger' : 'text-navy'}`}>{urgencyText} ({dueDateDisplay})</span></p>}
            </div>

            <div className="mt-4 pl-2 flex items-center gap-2 text-sm font-bold text-primary cursor-pointer hover:gap-3 transition-all group">
                {bill ? 'Ver detalles' : 'Ver calendario'} <ArrowRight size={16} className="group-hover:text-primary transition-colors" />
            </div>
        </div>
    );
};

export default NextPaymentCard;
