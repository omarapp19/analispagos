import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, Bot, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';

const ImportAssistant = () => {
    const [messages, setMessages] = useState([
        { id: 1, type: 'bot', text: 'Hola, soy tu Asistente de Importación. Sube tu archivo Excel de conciliación y yo me encargaré de extraer los datos.' }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [processedData, setProcessedData] = useState(null);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const [isDragging, setIsDragging] = useState(false);

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
            const workbook = XLSX.read(bstr, { type: 'binary' });

            // Fetch existing transactions to check for duplicates
            // We assume 'limit 500' covers the relevant recent history for daily updates.
            let existingDates = new Set();
            try {
                const existingTxs = await api.getTransactions();
                existingTxs.forEach(tx => {
                    if (tx.date) existingDates.add(tx.date.split('T')[0]);
                });
            } catch (err) {
                console.error("Could not fetch verification data", err);
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
                            text: `🎉 **¡Todo tus datos están actualizados!**\n\nNo encontré días nuevos en este archivo. Todos los registros ya existen en tu base de datos.`
                        }]);
                        return;
                    }

                    setProcessedData(newDays);
                    setIsTyping(false);

                    const totalSales = newDays.reduce((acc, day) => acc + day.sales.length, 0);
                    const totalAmount = newDays.reduce((acc, day) => acc + day.sales.reduce((s, tx) => s + tx.amount, 0), 0);
                    const totalDivisas = newDays.reduce((acc, day) => {
                        const divisaSale = day.sales.find(s => s.method === 'divisas');
                        return acc + (divisaSale ? divisaSale.amount : 0);
                    }, 0);

                    // Generate Detailed Breakdown
                    let breakdownText = `He analizado el archivo. Detecté ${newDays.length} días **NUEVOS** para importar.\n`;
                    if (duplicateCount > 0) {
                        breakdownText += `ℹ️ Ignoré ${duplicateCount} días que ya existen en la base de datos.\n\n`;
                    } else {
                        breakdownText += `\n`;
                    }

                    newDays.forEach(day => {
                        breakdownText += `📅 **${day.date}**\n`;
                        day.sales.forEach(sale => {
                            let methodLabel = sale.method;
                            if (sale.method === 'divisas') {
                                methodLabel = 'Divisas (USD + Zelle)';
                            }
                            breakdownText += `   • ${methodLabel}: $${sale.amount.toFixed(2)}\n`;
                        });
                        breakdownText += '\n';
                    });

                    breakdownText += `📊 **Total a Importar:** $${totalAmount.toFixed(2)}\n`;
                    breakdownText += `💰 **Total Divisas:** $${totalDivisas.toFixed(2)}\n\n`;
                    breakdownText += `¿Deseas proceder con la importación?`;

                    setMessages(prev => [...prev, {
                        id: Date.now(),
                        type: 'bot',
                        text: breakdownText,
                        action: 'confirm_import'
                    }]);
                } catch (error) {
                    console.error(error);
                    setIsTyping(false);
                    setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: `Hubo un error al leer el archivo: ${error.message}. Asegúrate de que siga el formato esperado.` }]);
                }
            }, 1500);
        };
        reader.readAsBinaryString(file);
    };

    const processWorkbook = (workbook) => {
        const extractedData = [];
        const sheetNames = workbook.SheetNames;

        sheetNames.forEach(sheetName => {
            // Logic: Sheet name is the day (01, 02..). We assume current year/month from context or hardcoded as per prompt (2026-01)
            // Prompt says: "Genera la fecha en formato YYYY-MM-DD usando el año 2026 y el mes de enero."

            // Skip non-day sheets if any, heuristics: must be 2 digits or number
            if (!/^\d{2}$/.test(sheetName) && !/^\d{1}$/.test(sheetName)) return;

            const day = sheetName.padStart(2, '0');
            const dateStr = `2026-01-${day}`;
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Array of arrays

            const sales = [];

            // Heuristic Search for Rows
            // We look for specific labels in what is usually the description column
            // We map labels to methods as per prompt.

            const mappings = {
                "TOTAL EFECTIVO BS": "Efectivo",
                "TOTAL TARJETA": "Tarjeta",
                "TOTAL PM": "Pago Móvil",
                "TOTAL TRANSFERENCIA": "Transferencia"
            };

            // Values to handle special "Divisas" logic (Sum of "TOTAL EFECTIVO USD" and "ZELLE")
            let divisasSum = 0;
            let zelleSum = 0;
            let cashUSDSum = 0;

            jsonData.forEach(row => {
                if (!row || row.length < 2) return;

                const rowStr = row.join(' ').toUpperCase();

                // Helper to find value at specific offset
                const getValueAtOffset = (r, label, offset = 2) => {
                    // Find the cell index that contains the label
                    const index = r.findIndex(cell =>
                        typeof cell === 'string' && cell.toUpperCase().includes(label)
                    );

                    if (index !== -1 && index + offset < r.length) {
                        const rawValue = r[index + offset];
                        return parseValue(rawValue);
                    }
                    return 0;
                };

                // Normal Mappings
                for (const [label, method] of Object.entries(mappings)) {
                    if (rowStr.includes(label)) {
                        // Logic: Value is 2 columns to the right of the label
                        const amount = getValueAtOffset(row, label, 2);
                        if (amount > 0) {
                            sales.push({ method, amount });
                        }
                    }
                }

                // Divisas Logic Breakdown
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
            } else {
                extractedData.push({ date: dateStr, sales: [] });
            }
        });

        extractedData.sort((a, b) => a.date.localeCompare(b.date));

        return extractedData;
    };

    const parseValue = (cell) => {
        if (!cell) return 0;
        if (typeof cell === 'number') return cell;

        if (typeof cell === 'string') {
            // Remove currency symbols, spaces, keep dots and commas
            let clean = cell.replace(/[$\sBsBD]/g, '');

            // Format: 1.000,00 -> 1000.00
            if (clean.includes('.') && clean.includes(',')) {
                if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
                    // 1.000,00 (European/VE)
                    clean = clean.replace(/\./g, '').replace(',', '.');
                } else {
                    // 1,000.00 (US)
                    clean = clean.replace(/,/g, '');
                }
            } else if (clean.includes(',')) {
                // 100,00 -> 100.00
                clean = clean.replace(',', '.');
            }

            const val = parseFloat(clean);
            return isNaN(val) ? 0 : val;
        }
        return 0;
    };

    const findAmountInRow = (row) => {
        // Filter valid cells that look like numbers
        const potentialNumbers = row.filter(cell => {
            if (typeof cell === 'number') return true;
            if (typeof cell === 'string') {
                // Remove currency symbols, spaces
                const clean = cell.replace(/[$\sBs.]/g, '').replace(',', '.');
                return !isNaN(parseFloat(clean)) && parseFloat(clean) > 0;
            }
            return false;
        });

        if (potentialNumbers.length === 0) return 0;

        // Parsing logic
        const values = potentialNumbers.map(cell => {
            if (typeof cell === 'number') return cell;
            // String Parsing: "1.234,56" -> 1234.56
            // Heuristic: If comma exists and dot exists, assume dot is thousand separator?
            // Safer for Venezuela/ES: usually comma is decimal.
            let clean = cell.toString().replace(/[^\d.,-]/g, '');

            // Check format 1.000,00 vs 1,000.00
            if (clean.includes('.') && clean.includes(',')) {
                if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
                    // 1.000,00 -> Remove dots, replace comma with dot
                    clean = clean.replace(/\./g, '').replace(',', '.');
                } else {
                    // 1,000.00 -> Remove commas
                    clean = clean.replace(/,/g, '');
                }
            } else if (clean.includes(',')) {
                // 100,00 -> 100.00
                clean = clean.replace(',', '.');
            }

            return parseFloat(clean);
        });

        // Heuristic: Return the LAST valid number found in the row, as per prompt assumption (usually col to the right)
        return parseFloat(values[values.length - 1].toFixed(2));
    };

    const confirmImport = async () => {
        if (!processedData) return;

        setIsTyping(true);
        setImporting(true);

        try {
            let count = 0;
            // Use existing Bulk Import Logic via API
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
                text: `¡Listo! He importado correctamente ${count} ventas a tu base de datos.`,
                isSuccess: true
            }]);
            setProcessedData(null); // Clear

        } catch (error) {
            console.error(error);
            setImporting(false);
            setIsTyping(false);
            setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: 'Ocurrió un error al guardar los datos.' }]);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-primary p-6 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <Bot size={28} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Asistente de Importación</h1>
                        <p className="text-sm opacity-80">Sube tus conciliaciones en Excel</p>
                    </div>
                </div>
                <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md">
                    Hecho por Omar Pérez
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                            max-w-[80%] rounded-2xl p-4 shadow-sm relative
                            ${msg.type === 'user'
                                ? 'bg-primary text-white rounded-tr-none'
                                : 'bg-white border border-gray-100 text-navy rounded-tl-none'
                            }
                        `}>
                            {msg.isFile && <FileSpreadsheet className="mb-2 opacity-80" size={20} />}
                            <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                            {/* Action Buttons */}
                            {msg.action === 'confirm_import' && !msg.actionTaken && (
                                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
                                    <button
                                        onClick={confirmImport}
                                        disabled={importing}
                                        className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
                                    >
                                        {importing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                        Sí, Importar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none p-4 shadow-sm flex gap-1">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div
                className={`p-4 bg-white border-t border-gray-100 transition-colors duration-300 ${isDragging ? 'bg-blue-50 border-blue-300' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="relative">
                    <input
                        type="text"
                        placeholder={isDragging ? "¡Suelta el archivo aquí!" : "Sube o arrastra un archivo Excel..."}
                        disabled
                        className={`w-full pl-6 pr-14 py-4 rounded-xl border  text-gray-400 cursor-not-allowed
                            ${isDragging ? 'border-primary bg-white' : 'bg-gray-50 border-gray-200'}
                        `}
                    />

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".xlsx, .xls"
                        className="hidden"
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all shadow-md group relative"
                            title="Subir Excel"
                        >
                            <Upload size={20} />
                            <span className="absolute bottom-full right-0 mb-2 w-max px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                Subir Excel
                            </span>
                        </button>
                    </div>
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">
                    Formatos soportados: .xlsx, .xls • Detecta automáticamente días nuevos.
                </p>
            </div>
        </div>
    );
};

export default ImportAssistant;
