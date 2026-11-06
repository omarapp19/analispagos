// Estado del formulario "Tienda web" de un producto y su conversión a columnas de inventory.

export const SPEC_KEYS = ['viscosidad', 'norma', 'capacidad', 'tipo', 'medida', 'grupo', 'grado', 'mezcla', 'amperaje'];

export const emptyWebForm = () => ({
    webPublished: false,
    webFeatured: false,
    categoryId: '',
    reference: '',
    webDescription: '',
    specs: [],
    images: [],
    removedImages: [],
    wholesaleEnabled: true,
    minWholesaleQty: '1',
    maxDiscountPct: '',
    minMarginPct: '',
    fitments: [],
    fitmentsDirty: false,
});

export const webFormFromProduct = (p) => ({
    ...emptyWebForm(),
    webPublished: !!p.webPublished,
    webFeatured: !!p.webFeatured,
    categoryId: p.categoryId || '',
    reference: p.reference || '',
    webDescription: p.webDescription || '',
    specs: Object.entries(p.specs || {}).map(([key, value]) => ({ key, value: String(value) })),
    images: Array.isArray(p.images) ? p.images : [],
    wholesaleEnabled: p.wholesaleEnabled !== false,
    minWholesaleQty: String(p.minWholesaleQty || 1),
    maxDiscountPct: p.maxDiscountPct ?? '',
    minMarginPct: p.minMarginPct ?? '',
});

/** Columnas de inventory que se guardan desde la pestaña Tienda web. */
export const webColumns = (w) => {
    const specs = {};
    for (const { key, value } of w.specs) {
        const k = key.trim().toLowerCase();
        if (k && String(value).trim()) specs[k] = String(value).trim();
    }
    const numOrNull = (v) => (v === '' || v == null || Number.isNaN(parseFloat(v)) ? null : parseFloat(v));
    return {
        webPublished: !!w.webPublished,
        webFeatured: !!w.webFeatured,
        categoryId: w.categoryId || null,
        reference: w.reference.trim() || null,
        webDescription: w.webDescription.trim() || null,
        specs,
        images: w.images,
        wholesaleEnabled: !!w.wholesaleEnabled,
        minWholesaleQty: Math.max(1, parseInt(w.minWholesaleQty) || 1),
        maxDiscountPct: numOrNull(w.maxDiscountPct),
        minMarginPct: numOrNull(w.minMarginPct),
    };
};
