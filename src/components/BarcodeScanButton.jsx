import React, { useEffect, useRef, useState } from 'react';
import { ScanLine, X } from 'lucide-react';

// Escaneo con la cámara usando BarcodeDetector (Chrome/Edge/Android). Si el navegador no lo
// soporta, el botón no se muestra: un lector USB sigue funcionando porque "teclea" el código y pulsa Enter.
export default function BarcodeScanButton({ onDetect, className = '' }) {
    const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    const videoRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        let stream; let raf; let stopped = false;
        (async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
                const video = videoRef.current;
                video.srcObject = stream;
                await video.play();
                const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] });
                const tick = async () => {
                    if (stopped) return;
                    try {
                        const found = await detector.detect(video);
                        if (found.length > 0 && found[0].rawValue) {
                            onDetect(found[0].rawValue);
                            setOpen(false);
                            return;
                        }
                    } catch { /* frame no listo */ }
                    raf = requestAnimationFrame(tick);
                };
                tick();
            } catch {
                setError('No se pudo abrir la cámara. Revisa el permiso del navegador.');
            }
        })();
        return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
    }, [open, onDetect]);

    if (!supported) return null;
    return (
        <>
            <button type="button" onClick={() => { setError(''); setOpen(true); }} className={`btn btn-ghost h-12 px-3 ${className}`} aria-label="Escanear código con la cámara">
                <ScanLine size={20} />
            </button>
            {open && (
                <div className="fixed inset-0 z-[10000] bg-black/80 flex flex-col items-center justify-center gap-3 p-4 no-print" role="dialog" aria-modal="true" aria-label="Escáner">
                    <video ref={videoRef} muted playsInline className="w-full max-w-md rounded-2xl bg-black" />
                    <p className="text-white text-sm">{error || 'Apunta al código de barras'}</p>
                    <button type="button" onClick={() => setOpen(false)} className="btn btn-primary h-10 px-4 inline-flex items-center gap-2"><X size={16} /> Cerrar</button>
                </div>
            )}
        </>
    );
}
