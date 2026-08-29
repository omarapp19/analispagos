import React, { useState, useRef, useEffect } from 'react';
import { 
    Bot, Sparkles, X, UploadCloud, CheckCircle2, Loader2, 
    FileSpreadsheet, ChevronDown, ChevronUp, AlertCircle, Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';

const AIAssistantBubble = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { 
            id: 1, 
            type: 'bot', 
            text: '¡Hola! Soy tu Asistente Inteligente de Conciliación.',
            subtitle: 'Sube tu archivo de caja en Excel (.xlsx) y extraeré automáticamente todas las ventas diarias para cargarlas en el sistema.'
        }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [processedData, setProcessedData] = useState(null);
    const [importing, setImporting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showDetails, setShowDetails] = useState(true);

    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen, isTyping]);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
    };

    const processFile = (file) => {
        setMessages(prev => [
            ...prev, 
            { id: Date.now(), type: 'user', text: file.name, isFile: true }
        ]);
        setIsTyping(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target.result;
            try {
                const workbook = XLSX.read(bstr, { type: 'binary' });

                let existingDates = new Set();
                try {
                    const existingTxs = await api.getTransactions();
                    existingTxs.forEach(tx => {
                        if (tx.date) existingDates.add(tx.date.split('T')[0]);
                    });
                } catch (err) {
                    console.error("Error fetching verification data in bubble assistant:", err);
                }

                setTimeout(() => {
                    try {
                        const rawResult = processWorkbook(workbook);

                        const newDays = rawResult.filter(day => !existingDates.has(day.date));
                        const duplicateCount = rawResult.length - newDays.length;

                        if (newDays.length === 0) {
                            setIsTyping(false);
                            setMessages(prev => [...prev, {
                                id: Date.now(),
                                type: 'bot',
                                text: 'Tus datos están al día',
                                subtitle: 'No se detectaron nuevos días de ventas en este archivo. Todos los registros ya existen en la base de datos.',
                                isInfo: true
                            }]);
                            return;
                        }

                        setProcessedData(newDays);
                        setIsTyping(false);

                        const totalAmount = newDays.reduce((acc, day) => acc + day.sales.reduce((s, tx) => s + tx.amount, 0), 0);
                        const totalDivisas = newDays.reduce((acc, day) => {
                            const divisaSale = day.sales.find(s => s.method === 'divisas');
                            return acc + (divisaSale ? divisaSale.amount : 0);
                        }, 0);

                        setMessages(prev => [...prev, {
                            id: Date.now(),
                            type: 'bot',
                            isAnalysisCard: true,
                            newDays,
                            duplicateCount,
                            totalAmount,
                            totalDivisas
                        }]);
                    } catch (error) {
                        console.error(error);
                        setIsTyping(false);
                        setMessages(prev => [...prev, { 
                            id: Date.now(), 
                            type: 'bot', 
                            text: 'Error de Lectura',
                            subtitle: `No pude procesar el archivo: ${error.message}. Asegúrate de usar la plantilla correcta.`,
                            isError: true 
                        }]);
                    }
                }, 1200);
            } catch (error) {
                console.error(error);
                setIsTyping(false);
                setMessages(prev => [...prev, { 
                    id: Date.now(), 
                    type: 'bot', 
                    text: 'Error en Archivo',
                    subtitle: 'No fue posible abrir el archivo. Comprueba que no esté dañado o protegido.',
                    isError: true 
                }]);
            }
        };
        reader.readAsBinaryString(file);
    };

    const processWorkbook = (workbook) => {
        const extractedData = [];
        const sheetNames = workbook.SheetNames;

        sheetNames.forEach(sheetName => {
            if (!/^\d{2}$/.test(sheetName) && !/^\d{1}$/.test(sheetName)) return;

            const day = sheetName.padStart(2, '0');
            const dateStr = `2026-01-${day}`;
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            const sales = [];
            const mappings = {
                "TOTAL EFECTIVO BS": "Efectivo",
                "TOTAL TARJETA": "Tarjeta",
                "TOTAL PM": "Pago Móvil",
                "TOTAL TRANSFERENCIA": "Transferencia"
            };

            let divisasSum = 0;
            let zelleSum = 0;
            let cashUSDSum = 0;

            jsonData.forEach(row => {
                if (!row || row.length < 2) return;
                const rowStr = row.join(' ').toUpperCase();

                const getValueAtOffset = (r, label, offset = 2) => {
                    const index = r.findIndex(cell =>
                        typeof cell === 'string' && cell.toUpperCase().includes(label)
                    );
                    if (index !== -1 && index + offset < r.length) {
                        return parseValue(r[index + offset]);
                    }
                    return 0;
                };

                for (const [label, method] of Object.entries(mappings)) {
                    if (rowStr.includes(label)) {
                        const amount = getValueAtOffset(row, label, 2);
                        if (amount > 0) {
                            sales.push({ method, amount });
                        }
                    }
                }

                if (rowStr.includes("TOTAL EFECTIVO USD")) {
                    const amount = getValueAtOffset(row, "TOTAL EFECTIVO USD", 2);
                    if (amount > 0) {
                        divisasSum += amount;
                        cashUSDSum += amount;
                    }
                }
                if (rowStr.includes("ZELLE")) {
                    const amount = getValueAtOffset(row, "ZELLE", 2);
                    if (amount > 0) {
                        divisasSum += amount;
                        zelleSum += amount;
                    }
                }
            });

            if (divisasSum > 0) {
                sales.push({
                    method: "divisas",
                    amount: parseFloat(divisasSum.toFixed(2)),
                    details: { zelle: zelleSum, cash: cashUSDSum }
                });
            }

            if (sales.length > 0) {
                extractedData.push({ date: dateStr, sales });
            }
        });

        extractedData.sort((a, b) => a.date.localeCompare(b.date));
        return extractedData;
    };

    const parseValue = (cell) => {
        if (!cell) return 0;
        if (typeof cell === 'number') return cell;

        if (typeof cell === 'string') {
            let clean = cell.replace(/[$\sBsBD]/g, '');
            if (clean.includes('.') && clean.includes(',')) {
                if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
                    clean = clean.replace(/\./g, '').replace(',', '.');
                } else {
                    clean = clean.replace(/,/g, '');
                }
            } else if (clean.includes(',')) {
                clean = clean.replace(',', '.');
            }
            const val = parseFloat(clean);
            return isNaN(val) ? 0 : val;
        }
        return 0;
    };

    const confirmImport = async () => {
        if (!processedData) return;

        setIsTyping(true);
        setImporting(true);

        try {
            let count = 0;
            for (const day of processedData) {
                for (const sale of day.sales) {
                    await api.createTransaction({
                        amount: sale.amount,
                        method: sale.method === 'divisas' ? 'Divisas' : sale.method,
                        date: day.date,
                        note: 'Importado por Asistente IA',
                        type: 'INCOME',
                        category: 'Venta',
                        status: 'COMPLETED'
                    });
                    count++;
                }
            }

            setImporting(false);
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'bot',
                text: 'Importación Completada',
                subtitle: `Se guardaron exitosamente ${count} registros de ventas en tu flujo de caja.`,
                isSuccess: true
            }]);
            setProcessedData(null);
        } catch (error) {
            console.error(error);
            setImporting(false);
            setIsTyping(false);
            setMessages(prev => [...prev, { 
                id: Date.now(), 
                type: 'bot', 
                text: 'Error en la Importación',
                subtitle: 'Ocurrió un inconveniente al guardar las transacciones. Por favor intenta de nuevo.',
                isError: true 
            }]);
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] no-print select-none">
            {/* FLOATING CHATBOX WINDOW */}
            {isOpen && (
                <div className="absolute bottom-16 right-0 w-[calc(100vw-2.5rem)] sm:w-[400px] h-[540px] bg-white rounded-2xl shadow-xl border border-slate-200/90 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
                    
                    {/* Soft Vibrant Header (No harsh black) */}
                    <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 px-4 py-3 text-white flex items-center justify-between shadow-sm relative overflow-hidden">
                        <div className="flex items-center gap-2.5 relative z-10">
                            <div className="relative">
                                <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                                    <Sparkles size={16} />
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-700"></span>
                            </div>
                            <div>
                                <h4 className="font-semibold text-xs tracking-tight text-white flex items-center gap-1.5 leading-snug">
                                    Asistente de Conciliación
                                    <span className="text-[9px] font-medium uppercase tracking-wider bg-white/20 text-white px-1.5 py-0.5 rounded border border-white/30">IA</span>
                                </h4>
                                <p className="text-[10px] text-indigo-100 font-normal opacity-90">
                                    Importación Inteligente Excel
                                </p>
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 hover:bg-white/15 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer relative z-10"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-grow overflow-y-auto p-4 bg-slate-50/70 space-y-3.5 text-xs custom-scrollbar">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.type === 'bot' && (
                                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 shadow-xs">
                                        <Bot size={14} />
                                    </div>
                                )}

                                {msg.type === 'user' ? (
                                    <div className="bg-indigo-600 text-white rounded-xl rounded-tr-xs px-3 py-2 shadow-xs max-w-[85%] font-medium flex items-center gap-2">
                                        {msg.isFile && <FileSpreadsheet size={15} className="text-indigo-200 flex-shrink-0" />}
                                        <span className="truncate">{msg.text}</span>
                                    </div>
                                ) : msg.isAnalysisCard ? (
                                    /* Structured Analysis Result Card */
                                    <div className="bg-white border border-slate-200 rounded-xl rounded-tl-xs p-3.5 shadow-sm max-w-[92%] space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
                                                <FileSpreadsheet size={14} className="text-indigo-600" />
                                                <span>Resumen de Conciliación</span>
                                            </div>
                                            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                {msg.newDays.length} días nuevos
                                            </span>
                                        </div>

                                        {msg.duplicateCount > 0 && (
                                            <div className="bg-amber-50/80 text-amber-800 text-[11px] p-2 rounded-lg border border-amber-200/60 flex items-start gap-1.5 font-normal">
                                                <AlertCircle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                                <span>Se omitieron <strong>{msg.duplicateCount} días</strong> ya registrados.</span>
                                            </div>
                                        )}

                                        {/* Totals Summary Chips */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                                                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider block">Monto Total</span>
                                                <span className="text-xs font-bold text-slate-800">{formatMoney(msg.totalAmount)}</span>
                                            </div>
                                            <div className="bg-indigo-50/60 p-2 rounded-lg border border-indigo-100">
                                                <span className="text-[9px] font-medium text-indigo-600 uppercase tracking-wider block">Total Divisas</span>
                                                <span className="text-xs font-bold text-indigo-900">{formatMoney(msg.totalDivisas)}</span>
                                            </div>
                                        </div>

                                        {/* Collapsible Breakdown */}
                                        <div className="border border-slate-150 rounded-lg overflow-hidden bg-slate-50/40">
                                            <button 
                                                onClick={() => setShowDetails(!showDetails)}
                                                className="w-full px-2.5 py-1.5 text-[11px] font-medium text-slate-700 flex items-center justify-between hover:bg-slate-100/60 transition-colors"
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar size={12} className="text-indigo-600" />
                                                    Desglose por día ({msg.newDays.length})
                                                </span>
                                                {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            </button>

                                            {showDetails && (
                                                <div className="p-2 border-t border-slate-150 space-y-2 max-h-44 overflow-y-auto custom-scrollbar bg-white">
                                                    {msg.newDays.map((day) => (
                                                        <div key={day.date} className="text-[11px] border border-slate-100 rounded-md p-1.5 bg-slate-50/30">
                                                            <div className="font-medium text-slate-800 mb-1 flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                                Fecha: {day.date}
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {day.sales.map((s, idx) => (
                                                                    <span key={idx} className="bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-normal text-[10px]">
                                                                        {s.method === 'divisas' ? 'Divisas' : s.method}: ${s.amount.toFixed(2)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* CTA Action Button */}
                                        <button
                                            onClick={confirmImport}
                                            disabled={importing}
                                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            {importing ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span>Guardando en caja...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 size={14} />
                                                    <span>Guardar {msg.newDays.length} Días de Ventas</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    /* Standard Bot Message Bubble */
                                    <div className={`
                                        max-w-[85%] rounded-xl rounded-tl-xs p-3 shadow-xs text-xs leading-relaxed
                                        ${msg.isSuccess 
                                            ? 'bg-emerald-50 border border-emerald-200/70 text-emerald-900' 
                                            : msg.isError
                                            ? 'bg-rose-50 border border-rose-200/70 text-rose-900'
                                            : 'bg-white border border-slate-200/80 text-slate-700'
                                        }
                                    `}>
                                        <div className="font-semibold text-slate-800 text-xs mb-0.5 flex items-center gap-1.5">
                                            {msg.isSuccess && <CheckCircle2 size={14} className="text-emerald-600" />}
                                            {msg.isError && <AlertCircle size={14} className="text-rose-600" />}
                                            <span>{msg.text}</span>
                                        </div>
                                        {msg.subtitle && (
                                            <p className="text-[11px] text-slate-500 font-normal leading-normal">
                                                {msg.subtitle}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex justify-start items-center gap-1.5">
                                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                                    <Bot size={14} />
                                </div>
                                <div className="bg-white border border-slate-200 rounded-xl rounded-tl-xs px-3 py-2 shadow-xs flex gap-1 items-center">
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                    <span className="text-[10px] font-normal text-slate-400 ml-1">Analizando Excel...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Drag and Drop File Input Area */}
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`p-2.5 border-t border-slate-200 bg-white flex flex-col items-center justify-center transition-colors duration-200 ${isDragging ? 'bg-indigo-50/60 border-indigo-300' : ''}`}
                    >
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                        />
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2.5 border border-dashed border-slate-200 hover:border-indigo-500 rounded-xl flex items-center justify-center gap-2 text-center transition-all bg-slate-50/50 hover:bg-indigo-50/20 group cursor-pointer"
                        >
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
                                <UploadCloud size={16} />
                            </div>
                            <div className="text-left">
                                <span className="text-xs font-medium text-slate-700 group-hover:text-indigo-600 block leading-tight">
                                    {isDragging ? '¡Suelta el archivo aquí!' : 'Subir reporte de Excel (.xlsx)'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">Haz clic o arrastra tu plantilla de caja</span>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* MAIN FLOATING CIRCULAR TOGGLE BUTTON */}
            <div className="relative group">
                {/* Soft Ambient Glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full blur-md opacity-70 group-hover:opacity-100 transition duration-300 animate-pulse"></div>
                
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`relative w-14 h-14 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 border border-indigo-400/30 cursor-pointer ${isOpen ? 'rotate-90' : ''}`}
                    title="Asistente de Conciliación IA"
                >
                    {isOpen ? (
                        <X size={24} />
                    ) : (
                        <Sparkles size={24} />
                    )}
                </button>
            </div>
        </div>
    );
};

export default AIAssistantBubble;
