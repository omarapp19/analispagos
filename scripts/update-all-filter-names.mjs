// Script para estandarizar los nombres de todos los filtros en el inventario
// integrando el código en el nombre de forma limpia y profesional.
import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;
if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  console.error('Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

function transformFilterName(currentName, code) {
  if (!code || currentName.includes(code)) return currentName;

  let newName = currentName.trim();

  if (/^FILTRO DE AIRE PARA /i.test(newName)) {
    return newName.replace(/^FILTRO DE AIRE PARA /i, `FILTRO DE AIRE ${code} `);
  }
  if (/^FILTRO DE AIRE /i.test(newName)) {
    return newName.replace(/^FILTRO DE AIRE /i, `FILTRO DE AIRE ${code} `);
  }
  if (/^FILTRO D\/AIRE /i.test(newName)) {
    return newName.replace(/^FILTRO D\/AIRE /i, `FILTRO D/AIRE ${code} `);
  }
  if (/^FILTRO AIRE /i.test(newName)) {
    return newName.replace(/^FILTRO AIRE /i, `FILTRO AIRE ${code} `);
  }
  if (/^FILTRO GAS\. /i.test(newName)) {
    return newName.replace(/^FILTRO GAS\. /i, `FILTRO GAS ${code} `);
  }
  if (/^FILTRO GAS /i.test(newName)) {
    return newName.replace(/^FILTRO GAS /i, `FILTRO GAS ${code} `);
  }
  if (/^FILTRO ACEITE /i.test(newName)) {
    return newName.replace(/^FILTRO ACEITE /i, `FILTRO ACEITE ${code} `);
  }
  if (/^FILTRO PURIFICADOR /i.test(newName)) {
    return newName.replace(/^FILTRO PURIFICADOR /i, `FILTRO PURIFICADOR ${code} `);
  }
  if (/^FILTRO /i.test(newName)) {
    return newName.replace(/^FILTRO /i, `FILTRO ${code} `);
  }

  return `${newName} [${code}]`;
}

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'cajero@staff.valkar.local',
    password: 'cajero123'
  });
  if (authErr) {
    console.error('Error autenticando:', authErr.message);
    process.exit(1);
  }

  const { data: prods, error: fetchErr } = await supabase
    .from('inventory')
    .select('id, code, name')
    .ilike('name', '%FILTRO%');

  if (fetchErr) {
    console.error('Error obteniendo productos:', fetchErr.message);
    process.exit(1);
  }

  const targets = prods.filter(p => p.code && !p.name.includes(p.code));
  console.log(`Filtros a procesar: ${targets.length}`);

  let updatedCount = 0;
  for (const p of targets) {
    const newName = transformFilterName(p.name, p.code);
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + p.code.toLowerCase();

    const { error: updErr } = await supabase
      .from('inventory')
      .update({
        name: newName,
        slug: slug,
        updatedAt: new Date().toISOString()
      })
      .eq('id', p.id);

    if (updErr) {
      console.error(`Error actualizando ${p.code}:`, updErr.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`¡Éxito! ${updatedCount} filtros actualizados con el código en su nombre.`);
}

run();
