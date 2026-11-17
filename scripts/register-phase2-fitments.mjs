import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

await supabase.auth.signInWithPassword({
  email: 'cajero@staff.valkar.local',
  password: 'cajero123'
});

const isDryRun = process.argv.includes('--dry-run');

const slugify = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

const { data: makesData } = await supabase.from('vehicle_makes').select('id, name, slug');
const { data: modelsData } = await supabase.from('vehicle_models').select('id, makeId, name, slug');

const cache = {
  makes: [...(makesData || [])],
  models: [...(modelsData || [])]
};

async function ensureVehicle(makeName, modelName) {
  const mkSlug = slugify(makeName);
  const mdSlug = slugify(modelName);

  let make = cache.makes.find(m => m.slug === mkSlug || m.name.toLowerCase() === makeName.trim().toLowerCase());
  if (!make) {
    if (isDryRun) {
      make = { id: `mock-make-${mkSlug}`, name: makeName.trim(), slug: mkSlug };
      cache.makes.push(make);
    } else {
      const { data, error } = await supabase.from('vehicle_makes').insert({ name: makeName.trim(), slug: mkSlug }).select().single();
      if (error) throw error;
      make = data;
      cache.makes.push(make);
    }
  }

  let model = cache.models.find(m => m.makeId === make.id && (m.slug === mdSlug || m.name.toLowerCase() === modelName.trim().toLowerCase()));
  if (!model) {
    if (isDryRun) {
      model = { id: `mock-model-${mdSlug}`, makeId: make.id, name: modelName.trim(), slug: mdSlug };
      cache.models.push(model);
    } else {
      const { data, error } = await supabase.from('vehicle_models').insert({ makeId: make.id, name: modelName.trim(), slug: mdSlug }).select().single();
      if (error) throw error;
      model = data;
      cache.models.push(model);
    }
  }

  return model.id;
}

// Mapeo detallado de repuestos automotrices específicos fase 2
const PHASE_2_MAP = [
  { match: (p) => p.name.includes('KODIAK'), apps: [{ make: 'Chevrolet', model: 'Kodiak' }] },
  { match: (p) => p.name.includes('MER/PRA/EXP/SPOR/RAN'), apps: [
    { make: 'Toyota', model: 'Merú' },
    { make: 'Toyota', model: 'Prado' },
    { make: 'Ford', model: 'Explorer' },
    { make: 'Ford', model: 'Ranger' }
  ]},
  { match: (p) => p.code === 'F14YC-E' || p.name.includes('BUJIA 200/250/300/302'), apps: [
    { make: 'Ford', model: 'F-150', engine: '300 6Cil / 302 V8' },
    { make: 'Ford', model: 'Bronco', engine: '300 6Cil / 302 V8' },
    { make: 'Ford', model: 'Mustang', engine: '302 V8 5.0L' }
  ]},
  { match: (p) => p.name.includes('TURPIAL'), apps: [{ make: 'Ford', model: 'Festiva' }] },
  { match: (p) => p.name.includes('SIL/TAH/AVLA/YUKON 5.3'), apps: [
    { make: 'Chevrolet', model: 'Silverado', engine: 'V8 5.3L Vortec' },
    { make: 'Chevrolet', model: 'Tahoe', engine: 'V8 5.3L Vortec' },
    { make: 'Chevrolet', model: 'Avalanche', engine: 'V8 5.3L Vortec' }
  ]},
  { match: (p) => p.code === 'HA156' || p.name.includes('AVEO/SPA'), apps: [
    { make: 'Chevrolet', model: 'Aveo' },
    { make: 'Chevrolet', model: 'Spark' }
  ]},
  { match: (p) => p.name.includes('MANILLA ZEPHI'), apps: [{ make: 'Ford', model: 'Zephyr' }] },
  { match: (p) => p.name.includes('FORD F100'), apps: [{ make: 'Ford', model: 'F-100' }] },
  { match: (p) => p.name.includes('FAIRLAN 500') || p.name.includes('FAIRLANE'), apps: [{ make: 'Ford', model: 'Fairlane' }] },
  { match: (p) => p.name.includes('MANILLA VIDRIO SPARK') || p.code === 'ETA-104', apps: [{ make: 'Chevrolet', model: 'Spark' }] },
  { match: (p) => p.name.includes('MANILLA P/VIDRIO CORSA') || p.code === 'PWH001B', apps: [{ make: 'Chevrolet', model: 'Corsa' }] },
  { match: (p) => p.name.includes('MANILLA P/VIDRIO HYUNDAI') || p.code === 'ET-91', apps: [
    { make: 'Hyundai', model: 'Accent' },
    { make: 'Hyundai', model: 'Excel' }
  ]},
  { match: (p) => p.name.includes('MANILLA P/VIDRIO DODGE DART') || p.code === 'ETR-09', apps: [{ make: 'Dodge', model: 'Dart' }] },
  { match: (p) => p.name.includes('FORD 100 - 350') || p.code === 'SL-13', apps: [
    { make: 'Ford', model: 'F-100' },
    { make: 'Ford', model: 'F-150' },
    { make: 'Ford', model: 'Super Duty (F-250 / F-350)' }
  ]},
  { match: (p) => p.name.includes('CHEYENNE') || p.code === '30862', apps: [{ make: 'Chevrolet', model: 'Cheyenne' }] },
  { match: (p) => p.name.includes('SWITCHE IGNICION CHEVROLET') || p.code === 'CS-110', apps: [{ make: 'Chevrolet', model: 'C-10 / Silverado / Caprice' }] },
  { match: (p) => p.name.includes('SWITCHERA 9 VIA FORD') || p.code === 'CS-169', apps: [{ make: 'Ford', model: 'F-150 / Bronco' }] },
  { match: (p) => p.name.includes('SWITCHERA 5 VÍA FORD') || p.code === 'SQ-293', apps: [{ make: 'Ford', model: 'F-150 / Bronco' }] },
  { match: (p) => p.name.includes('CUPILLA P/CACHO DODGE') || p.code === '105N', apps: [{ make: 'Dodge', model: 'Dart / D-100 / D-300' }] },
  { match: (p) => p.name.includes('BUJE DE ARRANQUE P/SWIFT') || p.name.includes('SWIFT'), apps: [{ make: 'Chevrolet', model: 'Swift' }] },
  { match: (p) => p.name.includes('BUJE DE ARRANQUE TOYOTA COROLLA'), apps: [{ make: 'Toyota', model: 'Corolla' }] },
  { match: (p) => p.name.includes('BUJE DE ARRANQUE FORD BRONCO'), apps: [{ make: 'Ford', model: 'Bronco' }] },
  { match: (p) => p.name.includes('ROLIN ARRANQUE FORD') || p.name.includes('CAMPO PARA MOTOR DE ARRANQUE FORD'), apps: [{ make: 'Ford', model: 'F-150 / Bronco' }] },
  { match: (p) => p.name.includes('CONDENSADOR FORD'), apps: [{ make: 'Ford', model: 'F-150 / Bronco / Fairlane' }] },
  { match: (p) => p.name.includes('TAPA DISTRIBUCIÓN FORD 6CIL') || p.name.includes('BOBINA CAPTADORA FORD 6CIL'), apps: [{ make: 'Ford', model: 'F-150 / Bronco' }] },
  { match: (p) => p.name.includes('TAPA DISTRIBUCIÓN FORD 8CIL') || p.name.includes('TAPA DISTRIBUCION FORD 8CIL'), apps: [{ make: 'Ford', model: 'F-150 / Bronco / Mustang 302 V8' }] },
  { match: (p) => p.name.includes('TAPA DISTRIBUCIÓN DODGE 8CIL') || p.name.includes('TAPA DISTRIBUCION DODGE 8CIL'), apps: [{ make: 'Dodge', model: 'Dart / Aspen / Ram 318 V8' }] },
  { match: (p) => p.name.includes('TAPA DISTRIBUCIÓN FIAT') || p.name.includes('TAPA DISTRIBUCION FIAT'), apps: [{ make: 'Fiat', model: 'Uno / Fire' }, { make: 'Fiat', model: 'Spazio / 147' }, { make: 'Fiat', model: 'Regata' }] },
  { match: (p) => p.name.includes('TAPA DISTRIBUIDOR 8CIL CHEVROLET'), apps: [{ make: 'Chevrolet', model: 'Caprice / C-10 / C-30 V8 350' }] },
  { match: (p) => p.name.includes('BOBINA CAPTADORA 6CIL CHEVROLET'), apps: [{ make: 'Chevrolet', model: 'Malibu / C-10 250 6Cil' }] },
  { match: (p) => p.name.includes('TAPA ARRANQUE FORD BRONCO'), apps: [{ make: 'Ford', model: 'Bronco' }, { make: 'Ford', model: 'F-150' }] },
  { match: (p) => p.name.includes('MANILLA INTERNA DER CAPRICE'), apps: [{ make: 'Chevrolet', model: 'Caprice' }] },
  { match: (p) => p.name.includes('TAPA DE ARRANQUE DEL FORD'), apps: [{ make: 'Ford', model: 'F-150 / Bronco' }] },
  { match: (p) => p.name.includes('BOMBA DE GASOLINA MOTOR 360'), apps: [{ make: 'Dodge', model: 'Ram / D-100 Motor 360 V8' }] },
  { match: (p) => p.name.includes('A57A-E') || p.name.includes('BUJIA FIAT PALIO/SIENA'), apps: [
    { make: 'Fiat', model: 'Palio', engine: '1.3L / 1.4L Fire' },
    { make: 'Fiat', model: 'Siena', engine: '1.3L / 1.4L Fire' }
  ]}
];

// Obtener productos sin fitments
const { data: prods } = await supabase.from('inventory').select('id, code, name, description');
const { data: existingFits } = await supabase.from('product_fitments').select('productId');
const hasFit = new Set((existingFits || []).map(f => f.productId));

const without = prods.filter(p => !hasFit.has(p.id));

console.log(`Buscando coincidencias para ${without.length} productos sin compatibilidad...`);

const toAdd = [];
for (const p of without) {
  for (const item of PHASE_2_MAP) {
    if (item.match(p)) {
      for (const app of item.apps) {
        const modelId = await ensureVehicle(app.make, app.model);
        toAdd.push({
          productId: p.id,
          productCode: p.code,
          productName: p.name,
          modelId,
          make: app.make,
          model: app.model,
          yearFrom: app.yearFrom || null,
          yearTo: app.yearTo || null,
          engine: app.engine || null,
          notes: app.notes || null
        });
      }
      break; // una regla principal
    }
  }
}

console.log(`\nFase 2 preparó ${toAdd.length} compatibilidades adicionales.`);
console.log('Muestra de 5 compatibilidades Fase 2:');
console.log(toAdd.slice(0, 5));

if (isDryRun) {
  console.log('\n[DRY RUN] Finalizado sin insertar en la base de datos.');
} else {
  const insertRows = toAdd.map(f => ({
    productId: f.productId,
    modelId: f.modelId,
    yearFrom: f.yearFrom,
    yearTo: f.yearTo,
    engine: f.engine,
    notes: f.notes
  }));

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < insertRows.length; i += BATCH) {
    const batch = insertRows.slice(i, i + BATCH);
    const { error: insErr } = await supabase.from('product_fitments').insert(batch);
    if (insErr) {
      console.error(`Error insertando lote ${i / BATCH + 1}:`, insErr.message);
      break;
    }
    inserted += batch.length;
  }
  console.log(`\n¡Éxito Fase 2! ${inserted} compatibilidades registradas correctamente.`);
}
