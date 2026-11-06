// Migración de una sola vez: tabla `users` (contraseñas en texto plano) -> Supabase Auth + staff_profiles.
//
// Uso (en tu PC, NUNCA subas estas llaves al repo):
//   $env:SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_ANON_KEY="..."
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."
//   node scripts/migrate-staff-users.mjs --dry-run     (solo muestra qué haría)
//   node scripts/migrate-staff-users.mjs               (ejecuta)
//
// Al terminar, si todos inician sesión bien, ejecuta supabase/manual/after-migrate-drop-password.sql.

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const dryRun = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const emailOf = (username) => `${username.trim().toLowerCase()}@staff.valkar.local`;
const VALID_ROLES = ['administrador', 'supervisor', 'cajero'];

const { data: users, error } = await admin.from('users').select('*');
if (error) { console.error('No se pudo leer users:', error.message); process.exit(1); }
if (!users?.length) { console.log('La tabla users está vacía. Nada que migrar.'); process.exit(0); }

const report = [];
for (const u of users) {
    const username = String(u.username || '').trim().toLowerCase();
    const entry = { username, status: '', tempPassword: null };
    try {
        if (!username) throw new Error('usuario vacío');
        if (!VALID_ROLES.includes(u.role)) throw new Error(`rol inválido: ${u.role}`);

        let password = String(u.password ?? '');
        if (password.length < 8) {
            // Supabase exige longitud mínima: se genera una temporal que se muestra una sola vez.
            password = randomBytes(9).toString('base64url');
            entry.tempPassword = password;
        }

        if (dryRun) { entry.status = 'DRY-RUN: se crearía'; report.push(entry); continue; }

        let userId;
        const created = await admin.auth.admin.createUser({ email: emailOf(username), password, email_confirm: true });
        if (created.error) {
            if (/already|registered|exists/i.test(created.error.message)) {
                // Ya existe en Auth (re-ejecución): se reutiliza y se actualiza la contraseña.
                const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
                const found = list?.users?.find((x) => x.email === emailOf(username));
                if (!found) throw created.error;
                userId = found.id;
                const upd = await admin.auth.admin.updateUserById(userId, { password });
                if (upd.error) throw upd.error;
            } else {
                throw created.error;
            }
        } else {
            userId = created.data.user.id;
        }

        const { error: pErr } = await admin.from('staff_profiles').upsert({
            userId, username, name: u.name || username, role: u.role, active: true,
        }, { onConflict: 'userId' });
        if (pErr) throw pErr;

        // Verificación: iniciar sesión con la llave anon.
        const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error: sErr } = await anon.auth.signInWithPassword({ email: emailOf(username), password });
        if (sErr) throw new Error(`creado, pero el inicio de sesión de prueba falló: ${sErr.message}`);

        entry.status = 'OK';
    } catch (e) {
        entry.status = `ERROR: ${e.message}`;
    }
    report.push(entry);
}

console.log('\nResultado:');
for (const r of report) {
    console.log(`- ${r.username.padEnd(20)} ${r.status}${r.tempPassword ? `   contraseña temporal: ${r.tempPassword}` : ''}`);
}
const failed = report.filter((r) => r.status.startsWith('ERROR')).length;
console.log(failed ? `\n${failed} usuario(s) con error. NO elimines la columna password todavía.` :
    dryRun ? '\nSimulación terminada.' :
    '\nTodos migrados y verificados. Siguiente: pruebas en el ERP y luego supabase/manual/after-migrate-drop-password.sql.\nPide a cada usuario que cambie su contraseña: las anteriores estuvieron expuestas.');
process.exit(failed ? 1 : 0);
