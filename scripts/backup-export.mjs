// Respaldo semanal: exporta las tablas del ERP a backups/AAAA-MM-DD/<tabla>.json (excluye imágenes base64 pesadas).
//
// Uso (en tu PC, NUNCA subas estas llaves al repo):
//   $env:SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."
//   npm run backup
// Copia la carpeta backups/ a un disco externo o a la nube. Complementa (no reemplaza) los backups de Supabase.
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const TABLES = ['inventory', 'clients', 'client_invoices', 'kardex', 'transactions', 'bills', 'providers',
    'investments', 'recurring_expenses', 'settings', 'cash_sessions', 'audit_log', 'staff_profiles'];
const PAGE = 1000;

const dir = join('backups', new Date().toISOString().slice(0, 10));
mkdirSync(dir, { recursive: true });

let failed = false;
for (const table of TABLES) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin.from(table).select('*').range(from, from + PAGE - 1);
        if (error) {
            console.log(`SKIP ${table}: ${error.message}`);
            if (!/does not exist|schema cache/i.test(error.message)) failed = true;
            break;
        }
        rows.push(...data);
        if (data.length < PAGE) break;
    }
    if (rows.length || !failed) {
        // Las imágenes en base64 hacen enormes los respaldos; las reales viven en Storage.
        const clean = rows.map((r) => (typeof r.image === 'string' && r.image.startsWith('data:') ? { ...r, image: '[base64 omitido]' } : r));
        writeFileSync(join(dir, `${table}.json`), JSON.stringify(clean, null, 2));
        console.log(`ok   ${table}: ${rows.length} filas`);
    }
}
process.exit(failed ? 1 : 0);
