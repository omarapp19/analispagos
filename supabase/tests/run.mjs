// Pruebas de las migraciones en un Postgres en memoria (PGlite), con un stub de Supabase (auth, storage, roles).
// Uso: npm run test:sql            (todas las pruebas, con id uuid, bigint y text)
//      node supabase/tests/run.mjs <uuid|bigint|text> [hasta_migracion] [archivo.test.sql ...]
// No reemplaza la prueba en staging: el stub imita solo lo que usan las migraciones.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stubSql } from './stub.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', 'migrations');
const [idType = 'uuid', upTo = '9999', ...tests] = process.argv.slice(2);

const db = new PGlite();
const notices = [];
db.onNotice?.((n) => notices.push(n.message));

async function exec(label, sql) {
  try {
    await db.exec(sql);
    console.log(`ok   ${label}`);
  } catch (e) {
    console.log(`FAIL ${label}: ${e.message}${e.position ? ' @' + e.position : ''}`);
    if (e.position) {
      const p = Number(e.position);
      console.log('     …' + sql.slice(Math.max(0, p - 160), p + 80).replace(/\n/g, '\n     ') + '…');
    }
    process.exitCode = 1;
    throw e;
  }
}

await exec(`stub (${idType})`, stubSql(idType));
const files = readdirSync(REPO).filter((f) => f.endsWith('.sql')).sort()
  .filter((f) => f.slice(0, 4) <= upTo.padStart(4, '0'));
for (const f of files) await exec(f, readFileSync(join(REPO, f), 'utf8'));

for (const t of tests) {
  const sql = readFileSync(t, 'utf8');
  // Cada bloque separado por "-- @test nombre" corre aparte y debe no fallar,
  // salvo los marcados "-- @fails nombre", que deben fallar.
  const parts = sql.split(/^-- @(test|fails) (.*)$/m);
  if (parts[0].trim()) await exec(`${t} (setup)`, parts[0]);
  for (let i = 1; i < parts.length; i += 3) {
    const kind = parts[i], name = parts[i + 1], body = parts[i + 2];
    try {
      const res = await db.exec(body);
      if (kind === 'fails') { console.log(`FAIL [debía fallar] ${name}`); process.exitCode = 1; }
      else {
        const last = res.filter((r) => r.rows?.length).pop();
        console.log(`ok   ${name}${last ? '  → ' + JSON.stringify(last.rows).slice(0, 600) : ''}`);
      }
    } catch (e) {
      if (kind === 'fails') console.log(`ok   ${name}  (falló como debía: ${e.message})`);
      else { console.log(`FAIL ${name}: ${e.message}`); process.exitCode = 1; }
    } finally {
      try { await db.exec('reset role; reset request.jwt.claim.sub;'); } catch {}
    }
  }
}
if (notices.length) console.log('notices:', notices.slice(0, 20));
