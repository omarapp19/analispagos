// Datos de la tienda web gestionados desde el ERP (categorías, vehículos, compatibilidad,
// imágenes en Storage y configuración). Todo pasa por RLS: solo el personal puede escribir.
import { supabase } from '../supabase';

const must = ({ data, error }) => {
    if (error) throw error;
    return data;
};

// ---------- Configuración (settings.tienda_publica / settings.tienda_privada) ----------
// Valores por defecto: coinciden con supabase/migrations/0007_store_public.sql.
export const DEFAULT_TIENDA_PUBLICA = {
    storeOpen: false,
    whatsapp: '',
    address: '',
    hours: 'Lun–Vie 8:00–17:00 · Sáb 8:00–13:00',
    payments: {
        pago_movil: { enabled: false, bank: '', phone: '', document: '' },
        transferencia: { enabled: false, bank: '', account: '', holder: '', rif: '' },
        zelle: { enabled: false, email: '', holder: '' },
        binance: { enabled: false, payId: '', email: '' },
        efectivo: { enabled: true },
    },
    delivery: {
        retiro: { enabled: true },
        delivery: { enabled: false, zones: [], freeOverUsd: 0 },
        envio_nacional: { enabled: false, carriers: ['MRW', 'Zoom', 'Tealca'], mode: 'cobro_destino' },
    },
    creditDaysOptions: [0, 15, 30],
    reservationHours: 24,
    cashReservationHours: 48,
    igtfPct: 0,
    igtfMethods: ['zelle', 'binance', 'efectivo'],
};

export const DEFAULT_TIENDA_PRIVADA = {
    pricesIncludeIva: true,
    facturaFiscal: false,
    maxDiscountPct: 20,
    minMarginPct: 8,
};

// Mezcla profunda solo de objetos planos: conserva los valores guardados y completa los que falten.
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export const withDefaults = (defaults, saved) => {
    if (!isObj(saved)) return structuredClone(defaults);
    const out = {};
    for (const k of new Set([...Object.keys(defaults), ...Object.keys(saved)])) {
        out[k] = isObj(defaults[k]) ? withDefaults(defaults[k], saved[k]) : (saved[k] ?? structuredClone(defaults[k]));
    }
    return out;
};

const readSetting = async (id) => {
    const data = must(await supabase.from('settings').select('data').eq('id', id).maybeSingle());
    return data?.data ?? null;
};

// Reemplaza el documento completo (no mezcla): así una clave privada nunca queda olvidada en tienda_publica.
const writeSetting = async (id, value) =>
    must(await supabase.from('settings').upsert({ id, data: value, updatedAt: new Date().toISOString() }));

export async function getStoreSettings() {
    const [pub, priv] = await Promise.all([readSetting('tienda_publica'), readSetting('tienda_privada')]);
    // Instalaciones previas guardaban tope y margen en la pública: se mueven a la privada.
    const legacy = {};
    if (pub?.maxDiscountPct != null) legacy.maxDiscountPct = pub.maxDiscountPct;
    if (pub?.minMarginPct != null) legacy.minMarginPct = pub.minMarginPct;
    const publica = withDefaults(DEFAULT_TIENDA_PUBLICA, pub);
    delete publica.maxDiscountPct;
    delete publica.minMarginPct;
    return {
        publica,
        privada: withDefaults(DEFAULT_TIENDA_PRIVADA, { ...legacy, ...(priv || {}) }),
    };
}

export async function saveStoreSettings({ publica, privada }) {
    const { maxDiscountPct: _a, minMarginPct: _b, ...soloPublica } = publica;
    await writeSetting('tienda_privada', privada);
    await writeSetting('tienda_publica', soloPublica);
}

// ---------- Categorías ----------
export const CATEGORY_ICONS = [
    ['aceite', 'Aceite'], ['engranaje', 'Caja / transmisión'], ['refrigerante', 'Refrigerante'],
    ['grasa', 'Grasa'], ['filtro', 'Filtro'], ['frenos', 'Frenos'], ['bujia', 'Bujía / encendido'],
    ['bateria', 'Batería'], ['correa', 'Correa / manguera'], ['suspension', 'Suspensión'], ['accesorio', 'Accesorio'],
];

export const slugify = (s) => (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const getCategories = async () =>
    must(await supabase.from('catalog_categories').select('*').order('sortOrder').order('name'));

export async function saveCategory(cat) {
    const row = {
        name: cat.name.trim(),
        slug: slugify(cat.slug || cat.name),
        icon: cat.icon || null,
        parentId: cat.parentId || null,
        sortOrder: parseInt(cat.sortOrder) || 0,
        isUniversal: !!cat.isUniversal,
    };
    const q = cat.id
        ? supabase.from('categories').update(row).eq('id', cat.id)
        : supabase.from('categories').insert(row);
    return must(await q.select().single());
}

export const deleteCategory = async (id) => must(await supabase.from('categories').delete().eq('id', id));

// ---------- Vehículos ----------
// PostgREST devuelve como máximo 1000 filas por consulta: se pide por páginas.
async function fetchAll(table, order = 'name') {
    const out = [];
    for (let from = 0; ; from += 1000) {
        const page = must(await supabase.from(table).select('*').order(order).order('id').range(from, from + 999));
        out.push(...page);
        if (page.length < 1000) return out;
    }
}

export const getMakes = () => fetchAll('vehicle_makes');
export const getModels = () => fetchAll('vehicle_models');

export const saveMake = async (make) => {
    const row = { name: make.name.trim(), slug: slugify(make.name) };
    const q = make.id ? supabase.from('vehicle_makes').update(row).eq('id', make.id) : supabase.from('vehicle_makes').insert(row);
    return must(await q.select().single());
};
export const deleteMake = async (id) => must(await supabase.from('vehicle_makes').delete().eq('id', id));

export const saveModel = async (model) => {
    const row = { makeId: model.makeId, name: model.name.trim(), slug: slugify(model.name) };
    const q = model.id ? supabase.from('vehicle_models').update(row).eq('id', model.id) : supabase.from('vehicle_models').insert(row);
    return must(await q.select().single());
};
export const deleteModel = async (id) => must(await supabase.from('vehicle_models').delete().eq('id', id));

const keyOf = (s) => slugify(s);

/**
 * Devuelve el id del modelo "marca / modelo", creando la marca y el modelo si no existen.
 * cache: { makes: [], models: [] } compartido entre filas de una importación.
 */
export async function ensureVehicle(cache, makeName, modelName) {
    const mk = keyOf(makeName);
    const md = keyOf(modelName);
    if (!mk || !md) throw new Error('Falta la marca o el modelo');
    let make = cache.makes.find((m) => m.slug === mk);
    if (!make) {
        make = await saveMake({ name: makeName.trim() });
        cache.makes.push(make);
    }
    let model = cache.models.find((m) => m.makeId === make.id && m.slug === md);
    if (!model) {
        model = await saveModel({ makeId: make.id, name: modelName.trim() });
        cache.models.push(model);
    }
    return model.id;
}

// ---------- Compatibilidad ----------
export const getFitments = async (productId) =>
    must(await supabase.from('product_fitments').select('*').eq('productId', productId));

/** Reemplaza la compatibilidad de un producto por la lista dada ({ modelId, yearFrom, yearTo, engine, notes }). */
export async function replaceFitments(productId, rows) {
    must(await supabase.from('product_fitments').delete().eq('productId', productId));
    const clean = rows
        .filter((r) => r.modelId)
        .map((r) => ({
            productId,
            modelId: r.modelId,
            yearFrom: r.yearFrom === '' || r.yearFrom == null ? null : parseInt(r.yearFrom),
            yearTo: r.yearTo === '' || r.yearTo == null ? null : parseInt(r.yearTo),
            engine: r.engine?.trim() || null,
            notes: r.notes?.trim() || null,
        }));
    if (clean.length) must(await supabase.from('product_fitments').insert(clean));
}

export const addFitments = async (rows) => {
    for (let i = 0; i < rows.length; i += 500) {
        must(await supabase.from('product_fitments').insert(rows.slice(i, i + 500)));
    }
};

/** id y código de cada producto (sin imágenes): para importar compatibilidades por código. */
export async function getProductCodes() {
    const out = [];
    for (let from = 0; ; from += 1000) {
        const page = must(await supabase.from('inventory').select('id, code, name').order('code').range(from, from + 999));
        out.push(...page);
        if (page.length < 1000) return out;
    }
}

export const countFitmentsByModel = async () => {
    const rows = [];
    for (let from = 0; ; from += 1000) {
        const page = must(await supabase.from('product_fitments').select('modelId').range(from, from + 999));
        rows.push(...page);
        if (page.length < 1000) break;
    }
    const counts = {};
    for (const r of rows) counts[r.modelId] = (counts[r.modelId] || 0) + 1;
    return counts;
};

// ---------- Imágenes (bucket público product-images) ----------
export const MAX_IMAGES = 5;

export const imageUrl = (path) => {
    if (!path) return '';
    if (/^(https?:|data:)/i.test(path)) return path;
    return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
};

/** Redimensiona a 1200 px de lado mayor y convierte a WebP (JPEG si el navegador no codifica WebP). */
async function toWebp(file, maxSide = 1200) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const encode = (type) => new Promise((res) => canvas.toBlob(res, type, 0.85));
    let blob = await encode('image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg');
    if (!blob) throw new Error('No se pudo procesar la imagen');
    return blob;
}

export async function uploadProductImage(productId, file) {
    if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
    const blob = await toWebp(file);
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${productId}/${crypto.randomUUID()}.${ext}`;
    must(await supabase.storage.from('product-images').upload(path, blob, { contentType: blob.type, upsert: false }));
    return path;
}

export async function removeProductImage(path) {
    if (!path || /^(https?:|data:)/i.test(path)) return;
    const { error } = await supabase.storage.from('product-images').remove([path]);
    if (error) console.warn('No se pudo borrar la imagen del bucket:', error.message);
}

// ---------- Excel ----------
// Normaliza encabezados ("Año desde" -> "anodesde") para aceptar planillas escritas a mano.
export const normHeader = (h) => slugify(String(h)).replace(/-/g, '');

export async function readSheetRows(file) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' }).map((row) => {
        const out = {};
        for (const [k, v] of Object.entries(row)) out[normHeader(k)] = typeof v === 'string' ? v.trim() : v;
        return out;
    });
}

export const pick = (row, ...keys) => {
    for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k];
    return '';
};
