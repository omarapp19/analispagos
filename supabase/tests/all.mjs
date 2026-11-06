// Ejecuta todas las pruebas *.test.sql contra las migraciones, con id uuid, bigint y text.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const tests = readdirSync(HERE).filter((f) => f.endsWith('.test.sql')).sort().map((f) => join(HERE, f));
let failed = false;

for (const idType of ['uuid', 'bigint', 'text']) {
    for (const t of tests) {
        const r = spawnSync(process.execPath, [join(HERE, 'run.mjs'), idType, '9999', t], { encoding: 'utf8' });
        const out = (r.stdout || '') + (r.stderr || '');
        const fails = out.split('\n').filter((l) => l.startsWith('FAIL'));
        const oks = out.split('\n').filter((l) => l.startsWith('ok')).length;
        console.log(`${fails.length || r.status ? '✗' : '✓'} ${idType.padEnd(6)} ${t.split(/[\\/]/).pop().padEnd(28)} ${oks} ok${fails.length ? `, ${fails.length} fallas` : ''}`);
        if (fails.length || r.status) {
            failed = true;
            console.log(fails.length ? fails.join('\n') : out);
        }
    }
}
process.exit(failed ? 1 : 0);
