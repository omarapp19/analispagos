import React, { useEffect, useState } from 'react';
import { Printer, X, FileText, CheckCircle, Clock, Landmark, Package, Building2, Calendar, User, ArrowDownCircle } from 'lucide-react';
import { api } from '../services/api';
import { useExchangeRates, formatUSD, formatBs } from '../hooks/useExchangeRates';

export default function PurchaseReceiptModal({ purchase, onClose, onOpenSupport }) {
    const rates = useExchangeRates();
    const bcvRate = Number(rates?.bcv) || 0;

    const [settings, setSettings] = useState({
        storeName: 'Valkar C.A',
        storeTaxId: '',
        storeAddress: 'San Francisco, Zulia',
        storePhone: ''
    });
    const [providerInfo, setProviderInfo] = useState(null);

    useEffect(() => {
        api.getSettings('global_settings').then(s => {
            if (s) setSettings(prev => ({ ...prev, ...s }));
        }).catch(() => {});

        if (purchase?.provider) {
            api.getProviders().then(provs => {
                const found = provs.find(p => 
                    p.name?.trim().toUpperCase() === purchase.provider?.trim().toUpperCase() ||
                    p.id === purchase.providerId
                );
                if (found) setProviderInfo(found);
            }).catch(() => {});
        }
    }, [purchase]);

    if (!purchase) return null;

    const items = Array.isArray(purchase.items) ? purchase.items : [];
    const totalAmount = parseFloat(purchase.amount) || 0;
    const paidAmount = parseFloat(purchase.paidAmount) || 0;
    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    const isPaid = purchase.status === 'PAID' || purchase.status === 'COMPLETED' || (paidAmount >= totalAmount && totalAmount > 0);
    const isPartial = purchase.status === 'PARTIAL' || (paidAmount > 0 && paidAmount < totalAmount);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div 
            onClick={onClose}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-hidden select-none"
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh] border border-gray-150 animate-in zoom-in duration-200"
            >
                {/* Frozen Top Header / Action Bar */}
                <div className="bg-white px-6 py-4 border-b border-gray-150 flex items-center justify-between no-print flex-shrink-0 z-10 shadow-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                            <FileText size={18} />
                        </div>
                        <div>
                            <span className="text-xs font-black text-navy uppercase tracking-wider block">
                                Comprobante de Compra
                            </span>
                            <span className="text-[11px] text-secondary font-medium">
                                {purchase.invoiceNumber ? `Factura Proveedor #${purchase.invoiceNumber}` : `ID: #${purchase.id.slice(0, 8)}`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {purchase.supportFile && (
                            <button
                                onClick={() => {
                                    if (onOpenSupport) {
                                        onOpenSupport(purchase.supportFile, purchase.supportFileName);
                                    } else {
                                        window.open(purchase.supportFile, '_blank');
                                    }
                                }}
                                className="px-3 py-1.5 bg-blue-50 text-primary hover:bg-blue-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Ver factura original escaneada"
                            >
                                <FileText size={14} />
                                <span className="hidden sm:inline">Ver Soporte Original</span>
                            </button>
                        )}
                        <button
                            onClick={handlePrint}
                            className="btn btn-primary h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-bold"
                            title="Imprimir comprobante de compra o guardar como PDF"
                        >
                            <Printer size={15} />
                            <span>Imprimir / PDF</span>
                        </button>
                        <div className="w-px h-6 bg-slate-200 my-auto mx-1"></div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-red-50 hover:text-danger rounded-lg text-secondary transition-all flex items-center justify-center cursor-pointer"
                            title="Cerrar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Printable Content Scroll Area */}
                <div className="bg-slate-50/50 flex-grow overflow-y-auto p-4 sm:p-6 flex justify-center custom-scrollbar">
                    <div 
                        id="purchase-print-area" 
                        className="w-full bg-white p-6 sm:p-8 text-slate-800 font-sans text-xs flex flex-col gap-5 border border-gray-200 rounded-2xl shadow-sm flex-shrink-0"
                    >
                        {/* Decorative Gradient Bar */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 via-primary to-blue-500 rounded-full no-print"></div>

                        {/* Store Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100">
                            <div>
                                <h2 className="text-xl font-black text-navy uppercase tracking-tight">
                                    {settings.storeName || 'Valkar C.A'}
                                </h2>
                                {settings.storeTaxId && (
                                    <p className="text-[11px] font-bold text-secondary uppercase tracking-wider mt-0.5">
                                        RIF: {settings.storeTaxId}
                                    </p>
                                )}
                                <p className="text-[11px] text-secondary opacity-75 mt-0.5">
                                    {[settings.storeAddress, settings.storePhone ? `Tel: ${settings.storePhone}` : ''].filter(Boolean).join(' • ')}
                                </p>
                            </div>

                            <div className="text-left sm:text-right">
                                <span className="inline-block bg-navy text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider mb-1">
                                    Orden de Compra / Entrada
                                </span>
                                <div className="text-sm font-black text-navy">
                                    {purchase.invoiceNumber ? `Factura N°: ${purchase.invoiceNumber}` : `ID: #${purchase.id.slice(0, 8)}`}
                                </div>
                                <div className="text-[11px] text-secondary font-semibold">
                                    Fecha: {new Date((purchase.invoiceDate || purchase.dueDate || new Date().toISOString().slice(0,10)) + 'T12:00:00').toLocaleDateString('es-VE')}
                                </div>
                            </div>
                        </div>

                        {/* Meta Info Grid: Provider, Dates, Status */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1">
                                    <Building2 size={12} className="text-primary" /> Datos del Proveedor
                                </span>
                                <p className="text-sm font-black text-navy">
                                    {purchase.provider || 'Proveedor no especificado'}
                                </p>
                                {providerInfo?.rif && (
                                    <p className="text-xs font-semibold text-secondary">
                                        RIF: <span className="font-bold text-navy">{providerInfo.rif}</span>
                                    </p>
                                )}
                                {providerInfo?.phone && (
                                    <p className="text-xs font-semibold text-secondary">
                                        Teléfono: <span className="font-bold text-navy">{providerInfo.phone}</span>
                                    </p>
                                )}
                                {providerInfo?.address && (
                                    <p className="text-[11px] text-secondary opacity-80">
                                        {providerInfo.address}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5 sm:text-right">
                                <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center sm:justify-end gap-1">
                                    <Calendar size={12} className="text-primary" /> Estado y Fechas
                                </span>
                                <div className="flex sm:justify-end">
                                    {isPaid ? (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-green-100 text-green-800 border border-green-200">
                                            <CheckCircle size={12} /> PAGADA
                                        </span>
                                    ) : isPartial ? (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                                            <Clock size={12} /> ABONO PARCIAL
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                                            <Clock size={12} /> PENDIENTE POR PAGAR
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-secondary font-medium">
                                    Vencimiento: <strong className="text-navy">{new Date(purchase.dueDate + 'T12:00:00').toLocaleDateString('es-VE')}</strong>
                                </p>
                                {purchase.category && (
                                    <p className="text-[11px] text-secondary">
                                        Categoría: <span className="font-bold text-navy uppercase">{purchase.category}</span>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="bg-slate-100/80 px-4 py-2 border-b border-gray-200 font-bold text-xs text-navy flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Package size={14} className="text-primary" />
                                    Detalle de Productos Ingresados ({items.length})
                                </span>
                                {bcvRate > 0 && (
                                    <span className="text-[10px] text-secondary font-medium no-print">
                                        Tasa BCV Ref: Bs {bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                )}
                            </div>

                            {items.length === 0 ? (
                                <div className="p-6 text-center text-secondary">
                                    <p className="font-semibold text-xs text-navy">{purchase.title || 'Compra sin detalle de ítems'}</p>
                                    <p className="text-[11px] opacity-70 mt-1">Registrado como gasto o compra directa</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-secondary border-b border-gray-200">
                                        <tr>
                                            <th className="py-2 px-3">#</th>
                                            <th className="py-2 px-3">Producto / Descripción</th>
                                            <th className="py-2 px-3 text-center">Cant.</th>
                                            <th className="py-2 px-3 text-right">Costo Unit. ($)</th>
                                            <th className="py-2 px-3 text-right">IVA</th>
                                            <th className="py-2 px-3 text-right">Total ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-150">
                                        {items.map((it, idx) => {
                                            const qty = parseInt(it.quantity) || 0;
                                            const cost = parseFloat(it.costPrice) || 0;
                                            const taxPct = parseFloat(it.taxPercentage) || 0;
                                            const lineSubtotal = qty * cost;
                                            const lineTax = lineSubtotal * (taxPct / 100);
                                            const lineTotal = lineSubtotal + lineTax;

                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                    <td className="py-2.5 px-3 text-secondary font-bold text-[11px]">{idx + 1}</td>
                                                    <td className="py-2.5 px-3">
                                                        <span className="font-bold text-navy block text-xs">{it.name}</span>
                                                        {it.unitsPerPackage > 1 && (
                                                            <span className="text-[10px] text-secondary opacity-70">
                                                                ({it.unitsPerPackage} unids/bulto)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center font-bold text-navy">
                                                        {qty}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-medium text-secondary">
                                                        {formatUSD(cost)}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-secondary text-[11px]">
                                                        {taxPct > 0 ? `${taxPct}%` : 'Exento'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-navy">
                                                        {formatUSD(lineTotal)}
                                                        {bcvRate > 0 && (
                                                            <span className="block text-[10px] text-secondary opacity-60 font-medium">
                                                                Bs {(lineTotal * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Totals & Payments Summary */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                            <div className="w-full sm:w-1/2 space-y-2">
                                {isPartial && (
                                    <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-3">
                                        <div className="flex justify-between text-xs font-bold text-primary">
                                            <span>Monto Abonado:</span>
                                            <span>{formatUSD(paidAmount)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-extrabold text-danger mt-1">
                                            <span>Saldo Pendiente:</span>
                                            <span>{formatUSD(remainingAmount)}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="text-[10px] text-secondary opacity-70 space-y-0.5">
                                    <p>• Los productos ingresados ya se encuentran disponibles en el inventario.</p>
                                    <p>• Movimiento de ENTRADA registrado en el Kardex.</p>
                                </div>
                            </div>

                            <div className="w-full sm:w-1/2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex justify-between text-xs text-secondary font-medium">
                                    <span>Total USD:</span>
                                    <span className="font-bold text-navy text-sm">{formatUSD(totalAmount)}</span>
                                </div>
                                {bcvRate > 0 && (
                                    <div className="flex justify-between text-xs text-secondary font-medium pt-1 border-t border-slate-200">
                                        <span>Total en Bolívares (BCV):</span>
                                        <span className="font-extrabold text-navy text-sm">
                                            Bs {(totalAmount * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Signatures / Footnotes */}
                        <div className="pt-6 mt-4 border-t border-dashed border-slate-200 grid grid-cols-2 gap-8 text-center text-[10px] text-secondary">
                            <div>
                                <div className="border-b border-slate-300 pb-8 mb-1"></div>
                                <p className="font-bold uppercase text-navy">Recibido Conforme (Almacén)</p>
                            </div>
                            <div>
                                <div className="border-b border-slate-300 pb-8 mb-1"></div>
                                <p className="font-bold uppercase text-navy">Autorizado / Administración</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print area styles injection inside modal */}
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #purchase-print-area, #purchase-print-area * {
                            visibility: visible;
                        }
                        #purchase-print-area {
                            position: fixed;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: auto;
                            margin: 0;
                            padding: 24px;
                            border: none !important;
                            box-shadow: none !important;
                            background: white !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                `}} />
            </div>
        </div>
    );
}
