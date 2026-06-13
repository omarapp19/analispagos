import React, { useState } from 'react';
import { X, Check, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

const ExpenseFormModal = ({ onClose, onExpenseAdded }) => {
    const [loading, setLoading] = useState(false);
    const [supportFile, setSupportFile] = useState(null);
    const [supportFileName, setSupportFileName] = useState('');

    const [formData, setFormData] = useState({
        beneficiary: '',
        category: 'Nómina / Sueldos',
        concept: '',
        amount: '',
        method: 'Transferencia',
        date: new Date().toLocaleDateString('en-CA'),
        invoiceNumber: '',
        note: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Size limit of 1MB (1,048,576 bytes)
        if (file.size > 1024 * 1024) {
            alert('El archivo es demasiado grande. El límite es de 1MB para almacenamiento en la base de datos.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setSupportFile(reader.result);
            setSupportFileName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveFile = () => {
        setSupportFile(null);
        setSupportFileName('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(formData.amount);
        if (!formData.beneficiary.trim() || !formData.concept.trim() || isNaN(amt) || amt <= 0) {
            alert('Por favor completa todos los datos obligatorios con valores válidos.');
            return;
        }

        setLoading(true);

        try {
            const payload = {
                beneficiary: formData.beneficiary.trim(),
                category: formData.category,
                concept: formData.concept.trim(),
                amount: amt,
                method: formData.method,
                date: formData.date,
                invoiceNumber: formData.invoiceNumber.trim() || null,
                supportFile: supportFile,
                supportFileName: supportFileName,
                note: formData.note.trim()
            };

            await api.createDirectExpense(payload);
            if (onExpenseAdded) onExpenseAdded();
            onClose();
        } catch (error) {
            console.error('Error creating direct expense:', error);
            alert('Error al guardar el gasto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                
                {/* Modal Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-navy flex items-center gap-2">
                            <Sparkles className="text-primary" size={20} />
                            Registrar Gasto Directo
                        </h3>
                        <p className="text-xs text-secondary opacity-60 mt-0.5">
                            Registra un egreso de caja inmediato sin afectar existencias de inventario
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full text-secondary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                    
                    {/* Beneficiario and Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                                Beneficiario / Págado a *
                            </label>
                            <input
                                type="text"
                                name="beneficiary"
                                value={formData.beneficiary}
                                onChange={handleChange}
                                required
                                placeholder="Ej: Juan Pérez, Electricidad, Alquileres"
                                className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                                Categoría de Gasto *
                            </label>
                            <select
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all cursor-pointer"
                            >
                                <option value="Nómina / Sueldos">Nómina / Sueldos</option>
                                <option value="Servicios Públicos">Servicios Públicos (Luz, Agua, etc.)</option>
                                <option value="Alquiler / Renta">Alquiler / Renta</option>
                                <option value="Mantenimiento">Mantenimiento / Reparaciones</option>
                                <option value="Publicidad">Publicidad / Marketing</option>
                                <option value="Impuestos">Impuestos / Tasas</option>
                                <option value="Otros Gastos">Otros Gastos</option>
                            </select>
                        </div>
                    </div>

                    {/* Concept */}
                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                            Concepto del Gasto *
                        </label>
                        <input
                            type="text"
                            name="concept"
                            value={formData.concept}
                            onChange={handleChange}
                            required
                            placeholder="Ej: Pago de sueldo quincenal, Factura de luz de mayo"
                            className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                        />
                    </div>

                    {/* Amount, Method and Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                                Monto (USD) *
                            </label>
                            <input
                                type="number"
                                name="amount"
                                step="0.01"
                                min="0.01"
                                value={formData.amount}
                                onChange={handleChange}
                                required
                                placeholder="0.00"
                                className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                                Método de Pago *
                            </label>
                            <select
                                name="method"
                                value={formData.method}
                                onChange={handleChange}
                                className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all cursor-pointer"
                            >
                                <option value="Transferencia">Transferencia</option>
                                <option value="Pago Móvil">Pago Móvil</option>
                                <option value="Divisas">Divisas</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Tarjeta">Tarjeta</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                                Fecha de Pago *
                            </label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                required
                                className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-secondary text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Invoice number (optional) */}
                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                            Número de Recibo / Factura (Opcional)
                        </label>
                        <input
                            type="text"
                            name="invoiceNumber"
                            value={formData.invoiceNumber}
                            onChange={handleChange}
                            placeholder="Ej: TKT-99120"
                            className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-bold text-navy text-sm transition-all"
                        />
                    </div>

                    {/* Support Document Upload */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-gray-200/60">
                        <label className="text-xs font-bold text-navy uppercase tracking-wider mb-1 block flex items-center gap-1.5">
                            📎 Documento de Soporte / Recibo (Opcional)
                        </label>
                        <p className="text-[11px] text-secondary opacity-65 mb-2.5">
                            Sube una foto o PDF del comprobante como respaldo (Máx. 1MB).
                        </p>
                        
                        {!supportFile ? (
                            <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 bg-white flex flex-col items-center justify-center hover:border-primary transition-all cursor-pointer group">
                                <input 
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-1 text-center">
                                    <span className="text-xs font-bold text-primary hover:underline">
                                        Seleccionar foto o PDF de soporte
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-xl shadow-sm">
                                <span className="text-xs font-bold text-navy truncate max-w-[200px]" title={supportFileName}>
                                    {supportFileName}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="text-xs font-extrabold text-secondary hover:text-danger hover:bg-red-50 px-2 py-1 rounded transition-all cursor-pointer"
                                >
                                    Eliminar
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Description Notes */}
                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                            Notas / Comentarios (Opcional)
                        </label>
                        <textarea
                            name="note"
                            rows="2"
                            value={formData.note}
                            onChange={handleChange}
                            placeholder="Comentarios o notas de auditoría..."
                            className="w-full p-3 bg-background rounded-xl border-2 border-transparent focus:border-primary outline-none font-medium text-navy text-xs transition-all resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn w-full py-4 text-base mt-2 rounded-xl shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-primary shadow-teal-500/30 hover:shadow-teal-500/50"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                        {loading ? 'Guardando Gasto...' : 'Confirmar y Descontar de Caja'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ExpenseFormModal;
