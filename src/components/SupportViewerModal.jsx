import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, RefreshCw, Download, FileText } from 'lucide-react';

export default function SupportViewerModal({ file, fileName, onClose }) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    // Handle ESC key to close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!file) return null;

    const isPdf = file.startsWith('data:application/pdf') || file.toLowerCase().endsWith('.pdf');

    const handleZoomIn = () => {
        setScale(prev => Math.min(4, Number((prev + 0.25).toFixed(2))));
    };

    const handleZoomOut = () => {
        setScale(prev => Math.max(0.4, Number((prev - 0.25).toFixed(2))));
    };

    const handleReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setRotation(0);
    };

    const handleRotate = () => {
        setRotation(prev => (prev + 90) % 360);
    };

    // Wheel zoom
    const handleWheel = (e) => {
        if (isPdf) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        setScale(prev => Math.min(4, Math.max(0.4, Number((prev + delta).toFixed(2)))));
    };

    // Double click to toggle 100% / 200%
    const handleDoubleClick = (e) => {
        if (isPdf) return;
        e.preventDefault();
        if (scale > 1) {
            handleReset();
        } else {
            setScale(2);
        }
    };

    // Drag to pan
    const handleMouseDown = (e) => {
        if (isPdf || e.button !== 0) return;
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - positionRef.current.x,
            y: e.clientY - positionRef.current.y
        };
    };

    const handleMouseMove = (e) => {
        if (!isDragging || isPdf) return;
        setPosition({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div 
            onClick={onClose}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 select-none animate-fade-in"
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 rounded-2xl w-full max-w-5xl h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-slate-700/60 relative"
            >
                {/* Header */}
                <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between flex-shrink-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-primary border border-blue-500/20 flex items-center justify-center">
                            <FileText size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                Soporte Digital de Factura
                            </h3>
                            <p className="text-xs text-slate-400 font-medium truncate max-w-md">
                                {fileName || 'soporte_factura.jpg'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href={file}
                            download={fileName || 'soporte_factura'}
                            className="px-3.5 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                            title="Descargar archivo original"
                        >
                            <Download size={14} />
                            <span className="hidden sm:inline">Descargar</span>
                        </a>
                        <div className="w-px h-6 bg-slate-800 mx-1"></div>
                        <button 
                            onClick={onClose}
                            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
                            title="Cerrar (Esc)"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Viewer Area */}
                <div 
                    className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center cursor-grab active:cursor-grabbing"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {isPdf ? (
                        <iframe 
                            src={file} 
                            className="w-full h-full rounded-b-2xl border-none bg-white" 
                            title="Soporte PDF"
                        />
                    ) : (
                        <div 
                            className="transition-transform duration-75 ease-out select-none"
                            style={{
                                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                                transformOrigin: 'center center'
                            }}
                        >
                            <img 
                                src={file} 
                                alt="Soporte Digital" 
                                onDoubleClick={handleDoubleClick}
                                className="max-w-[85vw] max-h-[75vh] object-contain rounded-lg shadow-2xl pointer-events-auto border border-slate-800"
                                draggable={false}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                }}
                            />
                        </div>
                    )}

                    {/* Floating Zoom & Pan Controls Pill (only for images) */}
                    {!isPdf && (
                        <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 z-30"
                        >
                            <button
                                onClick={handleZoomOut}
                                disabled={scale <= 0.4}
                                className="w-8 h-8 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center transition-colors"
                                title="Reducir Zoom (-)"
                            >
                                <ZoomOut size={16} />
                            </button>

                            <button
                                onClick={handleReset}
                                className="px-2.5 py-1 text-xs font-mono font-bold text-slate-200 hover:text-primary transition-colors min-w-[58px] text-center"
                                title="Restablecer Zoom (100%)"
                            >
                                {Math.round(scale * 100)}%
                            </button>

                            <button
                                onClick={handleZoomIn}
                                disabled={scale >= 4}
                                className="w-8 h-8 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center transition-colors"
                                title="Aumentar Zoom (+)"
                            >
                                <ZoomIn size={16} />
                            </button>

                            <div className="w-px h-4 bg-slate-700 mx-1"></div>

                            <button
                                onClick={handleRotate}
                                className="w-8 h-8 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
                                title="Rotar 90°"
                            >
                                <RotateCw size={15} />
                            </button>

                            <button
                                onClick={handleReset}
                                className="w-8 h-8 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
                                title="Restablecer posición y rotación"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    )}

                    {/* Hint overlay at bottom right */}
                    {!isPdf && (
                        <div className="absolute bottom-3 right-4 text-[11px] text-slate-500 font-medium hidden md:block pointer-events-none">
                            Rueda del ratón: Zoom • Arrastrar: Mover • Doble clic: 200%
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
