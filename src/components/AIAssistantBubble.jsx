import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Upload, CheckCircle, Loader2, FileSpreadsheet, Send, MessageSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';

const AIAssistantBubble = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, type: 'bot', text: '¡Hola! Soy tu Asistente Inteligente. Sube tu archivo de conciliación Excel (.xlsx) y yo me encargaré de extraer y procesar los días de ventas de forma automática.' }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [processedData, setProcessedData] = useState(null);
    const [importing, setImporting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

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
        // User message
        setMessages(prev => [...prev, { id: Date.now(), type: 'user', text: `Archivo subido: ${file.name}`, isFile: true }]);
        setIsTyping(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target.result;
            try {
                const workbook = XLSX.read(bstr, { type: 'binary' });

                // Fetch existing transactions to check for duplicates
                let existingDates = new Set();
                try {
                    const existingTxs = await api.getTransactions();
                    existingTxs.forEach(tx => {
                        if (tx.date) existingDates.add(tx.date.split('T')[0]);
                    });
                } catch (err) {
                    console.error("Could not fetch verification data in bubble assistant:", err);
                }

                // ANALYZE LOGIC
                setTimeout(() => {
                    try {
                        const rawResult = processWorkbook(workbook);

                        // FILTER DUPLICATES
                        const newDays = rawResult.filter(day => !existingDates.has(day.date));
                        const duplicateCount = rawResult.length - newDays.length;

                        if (newDays.length === 0) {
                            setIsTyping(false);
                            setMessages(prev => [...prev, {
                                id: Date.now(),
                                type: 'bot',
                                text: `🎉 ¡Todos tus datos ya están al día!\n\nNo detecté nuevos días en este archivo. Todos los registros ya existen en tu base de datos.`
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

                        // Generate Detailed Breakdown
                        let breakdownText = `He analizado tu archivo. Detecté ${newDays.length} días **NUEVOS** listos para ser importados.\n`;
                        if (duplicateCount > 0) {
                            breakdownText += `ℹ️ Ignoré ${duplicateCount} días que ya existen en tu base de datos.\n\n`;
                        } else {
                            breakdownText += `\n`;
                        }

                        newDays.forEach(day => {
                            breakdownText += `📅 **${day.date}**\n`;
                            day.sales.forEach(sale => {
                                let methodLabel = sale.method;
                                if (sale.method === 'divisas') {
                                    methodLabel = 'Divisas (USD/Zelle)';
                                }
                                breakdownText += `   • ${methodLabel}: $${sale.amount.toFixed(2)}\n`;
                            });
                            breakdownText += '\n';
                        });

                        breakdownText += `📊 **Monto total:** $${totalAmount.toFixed(2)}\n`;
                        breakdownText += `💰 **Total Divisas:** $${totalDivisas.toFixed(2)}\n\n`;
                        breakdownText += `¿Procedemos a guardar las ventas?`;

                        setMessages(prev => [...prev, {
                            id: Date.now(),
                            type: 'bot',
                            text: breakdownText,
                            action: 'confirm_import'
                        }]);
                    } catch (error) {
                        console.error(error);
                        setIsTyping(false);
                        setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: `Error al leer la estructura: ${error.message}. Asegúrate de subir la plantilla válida.` }]);
                    }
                }, 1500);
            } catch (error) {
                console.error(error);
                setIsTyping(false);
                setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: `Error al abrir el archivo. Comprueba que no esté corrupto.` }]);
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
                text: `¡Listo! He importado correctamente ${count} ventas a tu flujo de caja de manera exitosa.`,
                isSuccess: true
            }]);
            setProcessedData(null);
        } catch (error) {
            console.error(error);
            setImporting(false);
            setIsTyping(false);
            setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: 'Ocurrió un error al guardar los datos.' }]);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] no-print">
            {/* FLOATING CHATBOX WINDOW */}
            {isOpen && (
                <div className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] sm:w-[400px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
                    
                    {/* Header */}
                    <div className="bg-gradient-to-br from-[#868CFF] to-[#4318FF] p-4 text-white flex items-center justify-between shadow-md">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner">
                                <Bot size={20} className="text-white" />
                            </div>
                            <div>
                                <h4 className="font-extrabold text-sm leading-tight">Asistente de Conciliación</h4>
                                <span className="text-[10px] opacity-75">Importación Inteligente Excel</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-grow overflow-y-auto p-4 bg-slate-50/50 space-y-4 text-xs custom-scrollbar">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`
                                    max-w-[85%] rounded-2xl p-3 shadow-sm leading-relaxed whitespace-pre-line
                                    ${msg.type === 'user'
                                        ? 'bg-[#4318FF] text-white rounded-tr-none font-bold'
                                        : 'bg-white border border-gray-100 text-navy rounded-tl-none font-semibold'
                                    }
                                `}>
                                    {msg.isFile && <FileSpreadsheet className="mb-1 opacity-80" size={16} />}
                                    {msg.text}

                                    {/* Action Button: Confirm Import */}
                                    {msg.action === 'confirm_import' && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                                            <button
                                                onClick={confirmImport}
                                                disabled={importing}
                                                className="bg-[#4318FF] text-white px-3.5 py-1.5 rounded-lg text-[10px] font-black shadow-md hover:opacity-90 transition-all flex items-center gap-1.5"
                                            >
                                                {importing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                                Sí, Guardar Ventas
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none p-3 shadow-xs flex gap-1 items-center">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
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
                        className={`p-3 border-t border-gray-100 bg-white flex flex-col items-center justify-center transition-colors duration-200 ${isDragging ? 'bg-indigo-50 border-indigo-200' : ''}`}
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
                            className="w-full py-3 border-2 border-dashed border-gray-200 hover:border-[#4318FF] rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all bg-slate-50/50 hover:bg-indigo-50/10 group cursor-pointer"
                        >
                            <Upload size={20} className="text-secondary opacity-60 group-hover:text-[#4318FF] transition-colors" />
                            <span className="text-[10px] font-bold text-secondary group-hover:text-navy">
                                {isDragging ? '¡Suelta el Excel aquí!' : 'Sube o arrastra tu archivo Excel'}
                            </span>
                        </button>
                        <span className="text-[8px] text-gray-400 mt-1 text-center font-medium">Soporta hojas diarias YYYY-MM-DD para conciliación de caja</span>
                    </div>
                </div>
            )}

            {/* MAIN FLOATING CIRCULAR TOGGLE BUTTON */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 bg-gradient-to-br from-[#868CFF] to-[#4318FF] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer ${isOpen ? 'rotate-90' : ''}`}
                title="Asistente de Conciliación IA"
            >
                {isOpen ? (
                    <X size={26} />
                ) : (
                    <Bot size={26} />
                )}
            </button>
        </div>
    );
};

export default AIAssistantBubble;
