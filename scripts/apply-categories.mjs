import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
await supabase.auth.signInWithPassword({
  email: 'cajero@staff.valkar.local',
  password: 'cajero123'
});

const isDryRun = process.argv.includes('--dry-run');

const { data: prods } = await supabase.from('inventory').select('id, code, name, description, categoryId');
const { data: cats } = await supabase.from('categories').select('id, name, slug');

const CAT_IDS = Object.fromEntries(cats.map(c => [c.slug, c.id]));

const uncategorized = prods.filter(p => !p.categoryId);
console.log(`Uncategorized products found: ${uncategorized.length}`);

function classify(p) {
  const n = (p.name + ' ' + (p.description || '')).toUpperCase();

  // Frenos
  if (n.includes('FRENO') || n.includes('PASTILLA') || n.includes('PAST.') || n.includes('BANDA') || n.includes('CALIPER') || n.includes('DISCO')) {
    return 'frenos';
  }
  // Filtros
  if (n.includes('FILTRO') || n.includes('PURIFICADOR') || n.startsWith('CAL-') || n.startsWith('GF-') || n.startsWith('CA-')) {
    return 'filtros';
  }
  // Encendido
  if (n.includes('BUJIA') || n.includes('BUJÍA') || n.includes('BOBINA') || n.includes('DISTRIBU') || n.includes('ROTOR') || n.includes('PLATINO') || n.includes('CONDENSADOR') || n.includes('MODULO') || n.includes('ARRANQUE') || n.includes('ALTERNADOR') || n.includes('CARBONERA') || n.includes('BENDIX') || n.includes('SWITCHE') || n.includes('SWITCH') || n.includes('TORRE')) {
    return 'encendido';
  }
  // Suspensión y dirección
  if (n.includes('GOMA') || n.includes('TRIPOIDE') || n.includes('ESTABILIZADORA') || n.includes('BARRA ESTAB') || n.includes('ASPIRAL') || n.includes('ESPIRAL') || n.includes('PUENTE CARDAN') || n.includes('CRUCETA') || n.includes('CAJETIN') || n.includes('BALLESTA') || n.includes('ACOPLE') || n.includes('BUJE') || n.includes('AMORTI') || n.includes('SUPLE')) {
    return 'suspension';
  }
  // Aceites y fluidos
  if (n.includes('ACEITE') && (n.includes('MOTOR') || n.includes('15W') || n.includes('20W') || n.includes('5W') || n.includes('10W'))) {
    return 'aceites-de-motor';
  }
  if (n.includes('VALVULINA') || n.includes('CAJA') || n.includes('TRANSMISION') || n.includes('ATF') || n.includes('80W') || n.includes('85W')) {
    return 'aceites-de-caja';
  }
  if (n.includes('REFRIGERANTE') || n.includes('COOLANT') || n.includes('LIGA') || n.includes('ADITIVO') || n.includes('LIMPIA INY')) {
    return 'refrigerantes-y-aditivos';
  }
  if (n.includes('GRASA')) {
    return 'grasas';
  }
  // Correas
  if (n.includes('CORREA') || n.includes('MANGUERA') || n.includes('BANDA')) {
    return 'correas-y-mangueras';
  }
  // Baterías
  if (n.includes('BATERIA') || n.includes('BATERÍA') || n.includes('ACUMULADOR')) {
    return 'baterias';
  }

  // Accesorios (limpiaparabrisas, bombillos, faros, socates, conectores, relays, etc.)
  return 'accesorios';
}

const updatesByCat = {};
for (const p of uncategorized) {
  const slug = classify(p);
  const catId = CAT_IDS[slug];
  if (!catId) {
    console.warn(`No category ID for slug ${slug}`);
    continue;
  }
  if (!updatesByCat[catId]) updatesByCat[catId] = [];
  updatesByCat[catId].push(p.id);
}

for (const [catId, pIds] of Object.entries(updatesByCat)) {
  const cat = cats.find(c => c.id === catId);
  console.log(`- ${cat.name}: ${pIds.length} productos a actualizar`);
}

if (isDryRun) {
  console.log('\n[DRY RUN] Finalizado sin modificar la base de datos.');
} else {
  console.log('\nActualizando base de datos...');
  let totalUpdated = 0;
  for (const [catId, pIds] of Object.entries(updatesByCat)) {
    const { error } = await supabase
      .from('inventory')
      .update({ categoryId: catId })
      .in('id', pIds);

    if (error) {
      console.error(`Error actualizando categoría ${catId}:`, error.message);
    } else {
      totalUpdated += pIds.length;
    }
  }
  console.log(`\n¡Éxito! ${totalUpdated} productos categorizados correctamente en Supabase.`);
}
