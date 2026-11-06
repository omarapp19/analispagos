// Migración de una sola vez: imágenes en base64 dentro de inventory.image -> bucket product-images.
// Requiere la migración 0007 (bucket) aplicada.
//
// Uso (en tu PC, NUNCA subas estas llaves al repo):
//   $env:SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."
//   node scripts/migrate-images-to-storage.mjs --dry-run     (solo muestra qué haría)
//   node scripts/migrate-images-to-storage.mjs               (ejecuta)
//
// Por cada producto con image = "data:image/...;base64,...":
//   1. sube el archivo a product-images/{id}/legacy.{ext} (sin convertir: el bucket acepta jpg, png y webp),
//   2. si el producto no tiene imágenes web, guarda esa ruta en images,
//   3. vacía la columna image (el POS y el inventario usan images[0] desde ahora).
// Las URL http(s) en image se dejan como están: la vista catalog_products ya las usa como respaldo.

import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const dryRun = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Se procesa de a poco para no traer todo el base64 de una vez.
const { data: ids, error } = await admin.from('inventory').select('id').like('image', 'data:%');
if (error) { console.error('No se pudo leer inventory:', error.message); process.exit(1); }
console.log(`${ids.length} producto(s) con imagen en base64.${dryRun ? ' (simulación)' : ''}`);

let ok = 0;
const failed = [];
for (const { id } of ids) {
    try {
        const { data: p, error: e1 } = await admin.from('inventory').select('id, code, name, image, images').eq('id', id).single();
        if (e1) throw e1;
        const m = /^data:([^;]+);base64,(.*)$/s.exec(p.image || '');
        if (!m) throw new Error('formato base64 no reconocido');
        const mime = m[1].toLowerCase();
        const ext = EXT[mime];
        if (!ext) throw new Error(`tipo ${mime} no admitido por el bucket`);
        const bytes = Buffer.from(m[2], 'base64');
        const path = `${p.id}/legacy.${ext}`;
        console.log(`- ${p.code || ''} ${p.name}: ${(bytes.length / 1024).toFixed(0)} KB -> ${path}`);
        if (dryRun) { ok++; continue; }

        const { error: e2 } = await admin.storage.from('product-images').upload(path, bytes, { contentType: mime === 'image/jpg' ? 'image/jpeg' : mime, upsert: true });
        if (e2) throw e2;
        const images = p.images?.length ? p.images : [path];
        const { error: e3 } = await admin.from('inventory').update({ images, image: '' }).eq('id', p.id);
        if (e3) throw e3;
        ok++;
    } catch (e) {
        failed.push({ id, error: e.message });
        console.error(`  ERROR ${id}: ${e.message}`);
    }
}

console.log(`\nListo: ${ok} migrada(s), ${failed.length} con error.`);
if (failed.length) process.exitCode = 1;
