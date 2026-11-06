import React, { useRef, useState } from 'react';
import { Plus, Trash2, Upload, Loader2, AlertTriangle, Star, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import {
    MAX_IMAGES, imageUrl, uploadProductImage, ensureVehicle, readSheetRows, pick,
} from '../../services/storeApi';
import { SPEC_KEYS } from './productWebForm';

// Pestaña "Tienda web" del formulario de producto. Controlada: el estado vive en Inventory.jsx
// y se guarda junto con el producto (las imágenes se suben al elegirlas; las borradas se eliminan al guardar).

const Label = ({ children, htmlFor }) => (
    <label htmlFor={htmlFor} className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">{children}</label>
);

const inputCls = 'w-full px-3.5 py-2.5 bg-background rounded-xl border border-gray-200 outline-none text-sm text-navy font-semibold focus:border-primary transition-all';

const ProductWebTab = ({ value: w, onChange, productId, categories, vehicles, setVehicles }) => {
    const set = (patch) => onChange({ ...w, ...patch });
    const fileRef = useRef(null);
    const xlsRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState(null);
    const [importMsg, setImportMsg] = useState(null);

    const missing = [];
    if (w.webPublished && !w.categoryId) missing.push('categoría');
    if (w.webPublished && w.images.length === 0) missing.push('imagen');

    const handleImages = async (e) => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        if (!files.length) return;
        const room = MAX_IMAGES - w.images.length;
        if (room <= 0) { setError(`Máximo ${MAX_IMAGES} imágenes por producto.`); return; }
        setUploading(true);
        setError(null);
        const added = [];
        try {
            for (const f of files.slice(0, room)) {
                if (f.size > 15 * 1024 * 1024) throw new Error(`"${f.name}" pesa más de 15 MB.`);
                added.push(await uploadProductImage(productId, f));
            }
            if (files.length > room) setError(`Solo se agregaron ${room}: el máximo es ${MAX_IMAGES}.`);
        } catch (err) {
            setError(err.message || 'No se pudo subir la imagen.');
        } finally {
            onChange({ ...w, images: [...w.images, ...added] });
            setUploading(false);
        }
    };

    const removeImage = (path) => set({ images: w.images.filter((p) => p !== path), removedImages: [...w.removedImages, path] });
    const makeMain = (path) => set({ images: [path, ...w.images.filter((p) => p !== path)] });

    const modelsOf = (makeId) => vehicles.models.filter((m) => m.makeId === makeId);
    const setFit = (i, patch) => set({ fitmentsDirty: true, fitments: w.fitments.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

    const importFitments = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setImporting(true);
        setImportMsg(null);
        try {
            const rows = await readSheetRows(file);
            const cache = { makes: [...vehicles.makes], models: [...vehicles.models] };
            const added = [];
            const skipped = [];
            for (const [idx, r] of rows.entries()) {
                const make = String(pick(r, 'marca', 'make'));
                const model = String(pick(r, 'modelo', 'model'));
                if (!make || !model) { skipped.push(idx + 2); continue; }
                const modelId = await ensureVehicle(cache, make, model);
                const m = cache.models.find((x) => x.id === modelId);
                added.push({
                    makeId: m.makeId, modelId,
                    yearFrom: String(pick(r, 'anodesde', 'desde', 'yearfrom', 'ano') || ''),
                    yearTo: String(pick(r, 'anohasta', 'hasta', 'yearto', 'ano') || ''),
                    engine: String(pick(r, 'motor', 'engine') || ''),
                });
            }
            setVehicles(cache);
            onChange({ ...w, fitmentsDirty: true, fitments: [...w.fitments, ...added] });
            setImportMsg(`${added.length} filas agregadas${skipped.length ? `; sin marca o modelo: filas ${skipped.join(', ')}` : ''}. Guarda el producto para confirmarlas.`);
        } catch (err) {
            setImportMsg(err.message || 'No se pudo leer el archivo.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Publicación */}
            <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span>
                        <span className="block text-sm font-bold text-navy">Publicar en la tienda web</span>
                        <span className="block text-xs text-secondary mt-0.5">El nombre, el precio de venta y la disponibilidad se toman del inventario.</span>
                    </span>
                    <input type="checkbox" className="w-5 h-5 shrink-0" checked={w.webPublished} onChange={(e) => set({ webPublished: e.target.checked })} />
                </label>
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span className="block text-sm font-bold text-navy">Destacar en la portada</span>
                    <input type="checkbox" className="w-5 h-5 shrink-0" checked={w.webFeatured} onChange={(e) => set({ webFeatured: e.target.checked })} />
                </label>
                {missing.length > 0 && (
                    <p className="flex items-start gap-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        Publicado sin {missing.join(' ni ')}: se verá incompleto en la tienda.
                    </p>
                )}
            </div>

            {/* Datos de catálogo */}
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="web-cat">Categoría</Label>
                    <select id="web-cat" className={inputCls} value={w.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                        <option value="">Sin categoría</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="web-ref">Referencia / OEM</Label>
                    <input id="web-ref" className={inputCls} value={w.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Ej: 90915-YZZE1" />
                </div>
                <div className="col-span-2">
                    <Label htmlFor="web-desc">Descripción para la tienda</Label>
                    <textarea id="web-desc" className={`${inputCls} h-24 resize-y font-medium`} value={w.webDescription} onChange={(e) => set({ webDescription: e.target.value })}
                        placeholder="Para qué sirve, ventajas, recomendaciones de uso…" />
                </div>
            </div>

            {/* Especificaciones */}
            <div>
                <Label>Especificaciones</Label>
                <datalist id="spec-keys">{SPEC_KEYS.map((k) => <option key={k} value={k} />)}</datalist>
                <div className="space-y-2">
                    {w.specs.map((s, i) => (
                        <div key={i} className="flex gap-2">
                            <input list="spec-keys" aria-label="Dato" className={`${inputCls} w-2/5`} value={s.key} placeholder="viscosidad"
                                onChange={(e) => set({ specs: w.specs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) })} />
                            <input aria-label="Valor" className={inputCls} value={s.value} placeholder="10W-40"
                                onChange={(e) => set({ specs: w.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                            <button type="button" onClick={() => set({ specs: w.specs.filter((_, j) => j !== i) })}
                                className="p-2.5 rounded-xl text-secondary hover:text-danger hover:bg-red-50" aria-label="Quitar dato">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={() => set({ specs: [...w.specs, { key: '', value: '' }] })}
                    className="mt-2 text-xs font-bold text-primary hover:underline inline-flex items-center gap-1">
                    <Plus size={14} /> Agregar dato
                </button>
                <p className="text-[11px] text-secondary mt-1">La viscosidad, el grupo o la medida se muestran en grande en la tarjeta del producto.</p>
            </div>

            {/* Imágenes */}
            <div>
                <Label>Imágenes ({w.images.length}/{MAX_IMAGES})</Label>
                {!productId ? (
                    <p className="text-xs text-secondary bg-background rounded-xl px-3 py-2.5 border border-gray-100">Guarda el producto primero para subir imágenes.</p>
                ) : (
                    <>
                        <div className="grid grid-cols-5 gap-2">
                            {w.images.map((path, i) => (
                                <figure key={path} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-white group">
                                    <img src={imageUrl(path)} alt={`Imagen ${i + 1}`} className="w-full h-full object-contain" loading="lazy" />
                                    {i === 0 && <span className="absolute top-1 left-1 text-[9px] font-extrabold uppercase bg-navy text-white px-1.5 py-0.5 rounded">Principal</span>}
                                    <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 bg-white/90 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                                        {i > 0 ? (
                                            <button type="button" onClick={() => makeMain(path)} className="p-1 rounded text-secondary hover:text-primary" aria-label="Usar como principal" title="Usar como principal">
                                                <Star size={14} />
                                            </button>
                                        ) : <span />}
                                        <button type="button" onClick={() => removeImage(path)} className="p-1 rounded text-secondary hover:text-danger" aria-label="Quitar imagen" title="Quitar">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </figure>
                            ))}
                            {w.images.length < MAX_IMAGES && (
                                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                                    className="aspect-square rounded-xl border border-dashed border-gray-300 bg-background flex flex-col items-center justify-center gap-1 text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-60">
                                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                    <span className="text-[10px] font-bold">{uploading ? 'Subiendo…' : 'Subir'}</span>
                                </button>
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImages} />
                        <p className="text-[11px] text-secondary mt-1.5">Se convierten a WebP de 1200 px. Fondo blanco recomendado.</p>
                    </>
                )}
                {error && <p className="text-xs font-bold text-danger mt-1.5">{error}</p>}
            </div>

            {/* Mayor */}
            <div className="rounded-2xl border border-gray-200 p-4 space-y-4">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span>
                        <span className="block text-sm font-bold text-navy">Venta al mayor</span>
                        <span className="block text-xs text-secondary mt-0.5">Si se apaga, este producto no recibe descuentos mayoristas.</span>
                    </span>
                    <input type="checkbox" className="w-5 h-5 shrink-0" checked={w.wholesaleEnabled} onChange={(e) => set({ wholesaleEnabled: e.target.checked })} />
                </label>
                {w.wholesaleEnabled && (
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label htmlFor="web-minq">Mínimo mayor</Label>
                            <input id="web-minq" type="number" min="1" className={inputCls} value={w.minWholesaleQty} onChange={(e) => set({ minWholesaleQty: e.target.value })} />
                        </div>
                        <div>
                            <Label htmlFor="web-maxd">Tope desc. %</Label>
                            <input id="web-maxd" type="number" min="0" max="100" step="0.5" className={inputCls} value={w.maxDiscountPct} placeholder="Global" onChange={(e) => set({ maxDiscountPct: e.target.value })} />
                        </div>
                        <div>
                            <Label htmlFor="web-minm">Margen mín. %</Label>
                            <input id="web-minm" type="number" min="0" step="0.5" className={inputCls} value={w.minMarginPct} placeholder="Global" onChange={(e) => set({ minMarginPct: e.target.value })} />
                        </div>
                    </div>
                )}
            </div>

            {/* Compatibilidad */}
            <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                    <Label>Compatibilidad con vehículos</Label>
                    {productId && (
                        <button type="button" onClick={() => xlsRef.current?.click()} disabled={importing}
                            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50">
                            {importing ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Importar Excel
                        </button>
                    )}
                    <input ref={xlsRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importFitments} />
                </div>
                {!productId ? (
                    <p className="text-xs text-secondary bg-background rounded-xl px-3 py-2.5 border border-gray-100">Guarda el producto primero para cargar compatibilidad.</p>
                ) : (
                    <>
                        {w.fitments.length === 0 && (
                            <p className="text-xs text-secondary mb-2">Sin vehículos. Si es universal (aceite, refrigerante), déjalo vacío y usa una categoría universal.</p>
                        )}
                        <div className="space-y-2">
                            {w.fitments.map((f, i) => (
                                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                                    <select aria-label="Marca" className={`${inputCls} col-span-3 px-2`} value={f.makeId}
                                        onChange={(e) => setFit(i, { makeId: e.target.value, modelId: '' })}>
                                        <option value="">Marca</option>
                                        {vehicles.makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                    <select aria-label="Modelo" className={`${inputCls} col-span-3 px-2`} value={f.modelId} disabled={!f.makeId}
                                        onChange={(e) => setFit(i, { modelId: e.target.value })}>
                                        <option value="">Modelo</option>
                                        {modelsOf(f.makeId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                    <input aria-label="Año desde" type="number" min="1950" max="2100" placeholder="Desde" className={`${inputCls} col-span-2 px-2`} value={f.yearFrom}
                                        onChange={(e) => setFit(i, { yearFrom: e.target.value })} />
                                    <input aria-label="Año hasta" type="number" min="1950" max="2100" placeholder="Hasta" className={`${inputCls} col-span-2 px-2`} value={f.yearTo}
                                        onChange={(e) => setFit(i, { yearTo: e.target.value })} />
                                    <input aria-label="Motor" placeholder="Motor" className={`${inputCls} col-span-1 px-2`} value={f.engine}
                                        onChange={(e) => setFit(i, { engine: e.target.value })} />
                                    <button type="button" onClick={() => set({ fitmentsDirty: true, fitments: w.fitments.filter((_, j) => j !== i) })}
                                        className="col-span-1 p-2 rounded-xl text-secondary hover:text-danger hover:bg-red-50 justify-self-center" aria-label="Quitar vehículo">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={() => set({ fitmentsDirty: true, fitments: [...w.fitments, { makeId: '', modelId: '', yearFrom: '', yearTo: '', engine: '' }] })}
                            className="mt-2 text-xs font-bold text-primary hover:underline inline-flex items-center gap-1">
                            <Plus size={14} /> Agregar vehículo
                        </button>
                        <p className="text-[11px] text-secondary mt-1">
                            Excel: columnas <strong>Marca</strong>, <strong>Modelo</strong>, <strong>Año desde</strong>, <strong>Año hasta</strong>, <strong>Motor</strong>. Las marcas y modelos nuevos se crean solos.
                        </p>
                        {importMsg && <p className="text-xs font-bold text-navy mt-1.5 flex items-center gap-1"><ArrowLeft size={12} className="rotate-90" />{importMsg}</p>}
                    </>
                )}
            </div>
        </div>
    );
};

export default ProductWebTab;
