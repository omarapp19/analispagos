import React, { useState, useRef, useEffect } from 'react';
import { 
    Bot, Sparkles, X, Send, Key, Settings, AlertCircle, 
    TrendingUp, Package, CreditCard, Coins, Check, Loader2, RefreshCw
} from 'lucide-react';
import { 
    getBusinessSnapshot, 
    processLocalQuery, 
    askGemini, 
    getStoredApiKey, 
    setStoredApiKey 
} from '../services/aiService';
import { getRole } from '../auth/session';

const QUICK_ACTIONS = [
    { label: '📊 Ventas de hoy', query: '¿Cuánto vendimos hoy?' },
    { label: '⚠️ Stock bajo', query: '¿Cuáles repuestos tienen stock bajo o están agotados?' },
    { label: '💳 Deudas a proveedores', query: '¿Qué facturas o deudas tenemos pendientes?' },
    { label: '📦 Valor de inventario', query: '¿Cuál es el valor total del inventario?' },
    { label: '💵 Tasa BCV', query: '¿Cuál es la tasa oficial BCV de hoy?' }
];

function FormattedMessage({ text }) {
    if (!text) return null;
    return (
        <div className="space-y-1 text-xs">
            {text.split('\n').map((line, idx) => {
                if (line.trim() === '') return <div key={idx} className="h-1.5" />;
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                    <p key={idx} className="leading-relaxed">
                        {parts.map((part, pIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return (
                                    <strong key={pIdx} className="font-extrabold text-navy">
                                        {part.slice(2, -2)}
                                    </strong>
                                );
                            }
                            return part;
                        })}
                    </p>
                );
            })}
        </div>
    );
}

const AIAssistantBubble = () => {
    const userRole = getRole();
    if (userRole !== 'administrador') return null;

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { 
            id: 'welcome', 
            type: 'bot', 
            title: '¡Hola! Soy Valkar AI ⚡',
            text: 'Tu copiloto de operaciones, ventas y finanzas en tiempo real. Puedo darte cifras al instante de caja, deudas, repuestos o asesorarte estratégicamente con inteligencia artificial.',
            showQuickActions: true
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showKeyConfig, setShowKeyConfig] = useState(false);
    const [apiKey, setApiKey] = useState(getStoredApiKey());
    const [apiKeyInput, setApiKeyInput] = useState(getStoredApiKey());
    const [keySavedMessage, setKeySavedMessage] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [messages, isOpen, isTyping]);

    const handleSaveKey = (e) => {
        e.preventDefault();
        setStoredApiKey(apiKeyInput);
        setApiKey(apiKeyInput.trim());
        setKeySavedMessage(true);
        setTimeout(() => {
            setKeySavedMessage(false);
            setShowKeyConfig(false);
        }, 1200);
    };

    const handleSend = async (customText) => {
        const queryText = (customText || input).trim();
        if (!queryText || isTyping) return;

        setInput('');

        // Agregar mensaje del usuario
        const userMsg = {
            id: Date.now(),
            type: 'user',
            text: queryText
        };
        setMessages(prev => [...prev, userMsg]);
        setIsTyping(true);

        try {
            // 1. Obtener datos frescos del negocio en tiempo real
            const snapshot = await getBusinessSnapshot();

            // 2. Intentar responder primero con el Motor Local (0ms, 100% gratis)
            const localResponse = processLocalQuery(queryText, snapshot);

            if (localResponse) {
                // Respuesta instantánea con datos del ERP
                setMessages(prev => [
                    ...prev,
                    {
                        id: Date.now() + 1,
                        type: 'bot',
                        title: localResponse.title,
                        text: localResponse.text,
                        badge: 'Datos en Vivo'
                    }
                ]);
                setIsTyping(false);
                return;
            }

            // 3. Si no es consulta estructurada local, consultar a Gemini AI
            if (!apiKey) {
                // Si el usuario no tiene clave de Gemini configurada, avisar amigablemente
                setMessages(prev => [
                    ...prev,
                    {
                        id: Date.now() + 1,
                        type: 'bot',
                        title: 'Conexión con Gemini AI',
                        text: 'Esta consulta requiere análisis avanzado de IA generativa. Puedes activar **Google Gemini** ingresando tu clave gratuita en el botón de ajustes (arriba a la derecha). \n\n_Tip: También puedes consultar directamente sobre ventas, deudas, stock o buscar repuestos de forma 100% gratuita y sin clave._',
                        needsKey: true
                    }
                ]);
                setIsTyping(false);
                return;
            }

            // Consultar a la API de Google Gemini con el snapshot del negocio
            const geminiReply = await askGemini(queryText, snapshot, apiKey);

            setMessages(prev => [
                ...prev,
                {
                    id: Date.now() + 1,
                    type: 'bot',
                    title: 'Valkar AI (Gemini)',
                    text: geminiReply,
                    badge: 'IA Generativa'
                }
            ]);
        } catch (error) {
            console.error('Error procesando consulta AI:', error);
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now() + 1,
                    type: 'bot',
                    title: 'Ocurrió un inconveniente',
                    text: `No pude procesar la consulta: ${error.message || error}. Verifica tu conexión o clave de API.`,
                    isError: true
                }
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end print:hidden">
            {/* VENTANA DEL ASISTENTE */}
            {isOpen && (
                <div className="w-[92vw] sm:w-[410px] h-[560px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-gray-200/80 flex flex-col overflow-hidden mb-3.5 animate-in fade-in slide-in-from-bottom-5 duration-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-navy via-slate-900 to-navy text-white px-4 py-3.5 flex items-center justify-between border-b border-white/10 shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="relative">
                                <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-300 flex items-center justify-center shadow-xs">
                                    <Bot size={18} />
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-navy rounded-full animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black tracking-wide flex items-center gap-1.5">
                                    Valkar AI
                                    <span className="text-[9px] font-extrabold bg-teal-400/20 text-teal-300 px-1.5 py-0.2 rounded-full border border-teal-400/30 uppercase">
                                        Asistente
                                    </span>
                                </h3>
                                <p className="text-[10px] text-white/60 font-medium">Finanzas & Repuestos en tiempo real</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setShowKeyConfig(!showKeyConfig)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${showKeyConfig ? 'bg-white/20 text-teal-300' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                                title="Configurar clave de Gemini AI"
                            >
                                <Key size={15} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                                title="Cerrar ventana"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Panel de Configuración de Clave Gemini */}
                    {showKeyConfig && (
                        <div className="bg-slate-50 border-b border-gray-200 p-3.5 shrink-0 text-xs animate-in slide-in-from-top-2 duration-150">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="font-extrabold text-navy flex items-center gap-1.5 text-xs">
                                    <Sparkles size={13} className="text-teal-600" />
                                    Clave de Google Gemini (Opcional)
                                </span>
                                <a 
                                    href="https://aistudio.google.com/app/apikey" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-[10px] font-bold text-primary hover:underline"
                                >
                                    Obtener clave gratis ↗
                                </a>
                            </div>
                            <p className="text-[10.5px] text-secondary mb-2.5">
                                Con Gemini activo podrás solicitar análisis estratégicos avanzados, recomendaciones de negocio y consultas libres.
                            </p>
                            <form onSubmit={handleSaveKey} className="flex gap-2">
                                <input
                                    type="password"
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    placeholder="Pega aquí tu API key (AIzaSy...)"
                                    className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-primary font-mono text-navy"
                                />
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 bg-primary hover:bg-teal-600 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                    {keySavedMessage ? <Check size={13} /> : 'Guardar'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Área de Mensajes */}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/50">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'}`}
                            >
                                {msg.type === 'user' ? (
                                    <div className="max-w-[85%] bg-primary text-white rounded-2xl rounded-br-xs px-3.5 py-2.5 text-xs shadow-xs font-medium">
                                        {msg.text}
                                    </div>
                                ) : (
                                    <div className={`max-w-[90%] rounded-2xl rounded-tl-xs p-3.5 shadow-xs border transition-all ${
                                        msg.isError
                                            ? 'bg-red-50 border-red-200 text-red-900'
                                            : 'bg-white border-gray-100 text-slate-700'
                                    }`}>
                                        {msg.title && (
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <span className="font-black text-navy text-xs flex items-center gap-1.5">
                                                    <Sparkles size={13} className="text-teal-600" />
                                                    {msg.title}
                                                </span>
                                                {msg.badge && (
                                                    <span className="text-[9px] font-extrabold bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.2 rounded-full uppercase">
                                                        {msg.badge}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <FormattedMessage text={msg.text} />

                                        {/* Botón para configurar clave si la necesita */}
                                        {msg.needsKey && !showKeyConfig && (
                                            <button
                                                type="button"
                                                onClick={() => setShowKeyConfig(true)}
                                                className="mt-2.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <Key size={12} />
                                                Ingresar clave gratuita de Gemini
                                            </button>
                                        )}

                                        {/* Botones de Acción Rápida sugeridos */}
                                        {msg.showQuickActions && (
                                            <div className="mt-3 pt-2.5 border-t border-gray-100">
                                                <p className="text-[10px] font-extrabold text-secondary uppercase tracking-wider mb-2">
                                                    Preguntas rápidas:
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {QUICK_ACTIONS.map((action, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => handleSend(action.query)}
                                                            className="text-[11px] font-bold bg-slate-100 hover:bg-primary/10 hover:text-primary text-secondary px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-left border border-gray-200/60"
                                                        >
                                                            {action.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex items-center gap-2 text-xs text-secondary bg-white border border-gray-200 px-3 py-2 rounded-2xl rounded-tl-xs w-fit shadow-xs">
                                <Loader2 size={13} className="animate-spin text-primary" />
                                <span className="font-semibold text-[11px]">Consultando datos en tiempo real...</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input y Botón de Envío */}
                    <div className="p-2.5 bg-white border-t border-gray-100 shrink-0">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                            className="flex items-center gap-1.5"
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Escribe una pregunta sobre tu negocio..."
                                disabled={isTyping}
                                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-primary focus:bg-white text-navy font-medium transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isTyping}
                                className="w-9 h-9 rounded-xl bg-primary hover:bg-teal-600 disabled:opacity-40 disabled:hover:bg-primary text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer shrink-0"
                                title="Enviar mensaje"
                            >
                                <Send size={15} />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* BOTÓN FLOTANTE CIRCULAR */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-12 h-12 md:w-14 md:h-14 bg-gradient-to-tr from-navy to-slate-800 text-teal-300 rounded-full flex items-center justify-center shadow-xl shadow-navy/30 ring-2 ring-white/20 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer ${
                    isOpen ? 'rotate-90 text-white' : ''
                }`}
                title="Valkar AI · Asistente de Negocio"
            >
                {isOpen ? <X size={22} /> : <Sparkles size={24} className="animate-pulse" />}
            </button>
        </div>
    );
};

export default AIAssistantBubble;
