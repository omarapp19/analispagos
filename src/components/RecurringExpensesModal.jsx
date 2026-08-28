import React, { useState, useEffect } from 'react';
import { X, Plus, Calendar, Coins, Sparkles, CheckCircle, Trash2, Loader2, Clock } from 'lucide-react';
import { api } from '../services/api';

const RecurringExpensesModal = ({ onClose, onExpenseAdded, existingBills }) => {
    const [loading, setLoading] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('list'); // 'list' | 'new'
    const [recurringExpenses, setRecurringExpenses] = useState([]);
    const [processingExpenseId, setProcessingExpenseId] = useState(null);

    // Form state for creating template
    const [formData, setFormData] = useState({
        beneficiary: '',
        category: 'Servicios Públicos',
        concept: '',
        amount: '',
        method: 'Transferencia',
        scheduledDay: '15'
    });

    const currentYearMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
    const currentMonthLabel = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' }); // e.g. "agosto de 2026"

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await api.getRecurringExpenses();
            setRecurringExpenses(data);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateTemplate = async (e) => {
        e.preventDefault();
        const amt = parseFloat(formData.amount);
        const day = parseInt(formData.scheduledDay);
        if (!formData.beneficiary.trim() || !formData.concept.trim() || isNaN(amt) || amt <= 0 || isNaN(day) || day < 1 || day > 31) {
            alert('Por favor introduce datos válidos.');
            return;
        }

        setLoading(true);
        try {
            await api.createRecurringExpense({
                beneficiary: formData.beneficiary.trim(),
                category: formData.category,
                concept: formData.concept.trim(),
                amount: amt,
                method: formData.method,
                scheduledDay: day
            });
            setFormData({
                beneficiary: '',
                category: 'Servicios Públicos',
                concept: '',
                amount: '',
                method: 'Transferencia',
                scheduledDay: '15'
            });
            setActiveSubTab('list');
            fetchTemplates();
        } catch (error) {
            console.error("Error saving template:", error);
            alert("No se pudo programar el gasto fijo.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!window.confirm('¿Deseas eliminar esta programación de gasto fijo?')) return;
        try {
            await api.deleteRecurringExpense(id);
            fetchTemplates();
        } catch (error) {
            console.error("Error deleting template:", error);
        }
    };

    const handleProcessPayment = async (template) => {
        setProcessingExpenseId(template.id);
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const capitalizedMonth = currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1);
            
            await api.createDirectExpense({
                beneficiary: template.beneficiary,
                category: template.category,
                concept: `${template.concept} (${capitalizedMonth})`,
                amount: template.amount,
                method: template.method,
                date: todayStr,
                invoiceNumber: `RECURR-${template.scheduledDay}`,
                recurringId: template.id,
                recurringPeriod: currentYearMonth,
                note: `Procesado automáticamente como gasto fijo programado.`
            });

            if (onExpenseAdded) onExpenseAdded(); // refresh parent bills list
            alert(`Gasto "${template.concept}" de ${currentMonthLabel} procesado exitosamente.`);
        } catch (error) {
            console.error("Error processing recurring payment:", error);
            alert("Error al procesar el pago del gasto fijo.");
        } finally {
            setProcessingExpenseId(null);
        }
    };

    // Helper to determine if a template is processed for the current month
    const isProcessedThisMonth = (templateId) => {
        return existingBills.some(b => b.recurringId === templateId && b.recurringPeriod === currentYearMonth);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-navy flex items-center gap-2">
                            <Calendar className="text-primary" size={20} />
                            Gastos Fijos Programados
                        </h3>
                        <p className="text-xs text-secondary opacity-60 mt-0.5">
                            Programa y registra con un solo clic los egresos recurrentes de cada mes (Alquiler, Internet, Nómina, etc.)
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-50/70 rounded-full text-secondary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Sub tabs navigation */}
                <div className="px-6 py-2 border-b border-gray-50 flex gap-4 text-xs font-bold bg-slate-50/50">
                    <button
                        onClick={() => setActiveSubTab('list')}
                        className={`pb-2 border-b-2 transition-all cursor-pointer ${activeSubTab === 'list' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Gastos Programados ({recurringExpenses.length})
                    </button>
                    <button
                        onClick={() => setActiveSubTab('new')}
                        className={`pb-2 border-b-2 transition-all cursor-pointer ${activeSubTab === 'new' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        ➕ Programar Gasto Nuevo
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeSubTab === 'list' ? (
                        <div className="space-y-4">
                            {loading ? (
                                <div className="py-12 text-center text-secondary opacity-50">Cargando programaciones...</div>
                            ) : recurringExpenses.length === 0 ? (
                                <div className="py-16 text-center text-secondary opacity-40 flex flex-col items-center gap-3">
                                    <Clock size={40} />
                                    <p className="font-semibold text-sm">No tienes gastos fijos programados aún.</p>
                                    <button 
                                        onClick={() => setActiveSubTab('new')}
                                        className="btn btn-primary py-2 px-4 rounded-xl text-xs"
                                    >
                                        Crear Primer Programa
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3.5">
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-xs text-secondary flex items-start gap-2.5">
                                        <Sparkles className="text-primary flex-shrink-0 mt-0.5" size={15} />
                                        <div>
                                            <p className="font-bold text-navy">Periodo Activo: {currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1)}</p>
                                            <p className="mt-0.5 font-medium opacity-85">Revisa la lista inferior para registrar tus egresos recurrentes del mes. Al pulsar "Registrar Pago", el sistema creará la factura pagada y la transacción en caja automáticamente.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        {recurringExpenses.map((exp) => {
                                            const processed = isProcessedThisMonth(exp.id);
                                            const isProcessing = processingExpenseId === exp.id;
                                            
                                            return (
                                                <div key={exp.id} className="card p-4 rounded-2xl border border-gray-150 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:border-gray-300 transition-all">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-secondary flex items-center justify-center font-bold flex-shrink-0">
                                                            {exp.scheduledDay}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="font-bold text-navy text-[14px]">{exp.concept}</h4>
                                                                <span className="bg-slate-100 text-[10px] text-secondary font-black uppercase px-2 py-0.5 rounded border border-gray-200">
                                                                    {exp.category}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 font-semibold mt-1">
                                                                Pago a: <span className="text-navy">{exp.beneficiary}</span> | Canal: {exp.method} | Día programado: {exp.scheduledDay} de cada mes
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3.5 md:pt-0 border-gray-50 flex-shrink-0">
                                                        <div className="text-right">
                                                            <span className="text-xs font-bold text-secondary uppercase block opacity-60">Monto Programado</span>
                                                            <span className="text-[15px] font-black text-primary">${exp.amount.toFixed(2)}</span>
                                                        </div>

                                                        <div className="flex items-center gap-2.5">
                                                            {processed ? (
                                                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-green-50 border border-green-200 text-success select-none">
                                                                    <CheckCircle size={14} /> Procesado
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleProcessPayment(exp)}
                                                                    disabled={isProcessing}
                                                                    className="btn btn-primary py-2 px-3 rounded-xl text-xs font-black shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                                >
                                                                    {isProcessing ? (
                                                                        <Loader2 size={12} className="animate-spin" />
                                                                    ) : (
                                                                        <Coins size={12} />
                                                                    )}
                                                                    Registrar Pago
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteTemplate(exp.id)}
                                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-all cursor-pointer"
                                                                title="Eliminar Programación"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleCreateTemplate} className="space-y-4">
                            <div className="bg-teal-50 border border-teal-100 rounded-xl p-3.5 text-xs text-teal-800 flex items-start gap-2.5">
                                <Sparkles className="text-teal-600 flex-shrink-0 mt-0.5" size={15} />
                                <div>
                                    <p className="font-bold">Nueva Plantilla de Gasto Fijo</p>
                                    <p className="mt-0.5 font-medium opacity-85">Define los datos principales para crear un gasto fijo. Esto no crea el egreso inmediatamente, sino que guarda la plantilla para registrarlo rápidamente todos los meses.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Beneficiario / Pagado a *</label>
                                    <input
                                        type="text"
                                        name="beneficiary"
                                        required
                                        value={formData.beneficiary}
                                        onChange={handleChange}
                                        placeholder="Ej: Cantv, Arrendamientos Gómez"
                                        className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Categoría *</label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all cursor-pointer"
                                    >
                                        <option value="Servicios Públicos">Servicios Públicos (Luz, Agua, Internet)</option>
                                        <option value="Nómina / Sueldos">Nómina / Sueldos</option>
                                        <option value="Alquiler / Renta">Alquiler / Renta</option>
                                        <option value="Mantenimiento">Mantenimiento / Reparaciones</option>
                                        <option value="Impuestos">Impuestos / Tasas</option>
                                        <option value="Otros Gastos">Otros Gastos</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Concepto del Gasto Fijo *</label>
                                <input
                                    type="text"
                                    name="concept"
                                    required
                                    value={formData.concept}
                                    onChange={handleChange}
                                    placeholder="Ej: Pago de Internet Fibra Óptica, Renta de local comercial"
                                    className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block min-h-[36px] flex items-end pb-1">Monto Mensual (USD) *</label>
                                    <input
                                        type="number"
                                        name="amount"
                                        required
                                        step="0.01"
                                        min="0.01"
                                        value={formData.amount}
                                        onChange={handleChange}
                                        placeholder="0.00"
                                        className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block min-h-[36px] flex items-end pb-1">Canal de Pago *</label>
                                    <select
                                        name="method"
                                        value={formData.method}
                                        onChange={handleChange}
                                        className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all cursor-pointer"
                                    >
                                        <option value="Transferencia">Transferencia</option>
                                        <option value="Pago Móvil">Pago Móvil</option>
                                        <option value="Divisas">Divisas</option>
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Tarjeta">Tarjeta</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block min-h-[36px] flex items-end pb-1">Día de Cobro (1-31) *</label>
                                    <input
                                        type="number"
                                        name="scheduledDay"
                                        required
                                        min="1"
                                        max="31"
                                        value={formData.scheduledDay}
                                        onChange={handleChange}
                                        className="w-full p-3 bg-background rounded-xl border border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-gray-50">
                                <button
                                    type="button"
                                    onClick={() => setActiveSubTab('list')}
                                    className="px-5 py-2.5 border border-gray-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn btn-primary py-2.5 px-5 rounded-xl text-xs font-black shadow-lg"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={14} /> : 'Guardar Programación'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecurringExpensesModal;
