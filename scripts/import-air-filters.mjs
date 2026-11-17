// Script para importar filtros de aire desde el archivo CSV al inventario de Supabase
// Uso:
//   node --env-file=.env scripts/import-air-filters.mjs --dry-run
//   node --env-file=.env scripts/import-air-filters.mjs

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const CSV_PATH = 'c:/Users/admin/Desktop/inventario_filtros_aire-v2.csv';
const isDryRun = process.argv.includes('--dry-run');

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;
if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

// Autenticación como personal (cajero tiene permiso staff full para inventory y kardex)
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'cajero@staff.valkar.local',
  password: 'cajero123'
});

if (authError || !authData.session) {
  console.error('Error al iniciar sesión como personal:', authError?.message);
  process.exit(1);
}
console.log('Autenticado como personal (cajero@staff.valkar.local)');

// Categoría Filtros
const CATEGORY_ID_FILTROS = '2aa4b3bc-cb42-48b0-82f6-fa1e270e4a54';
const FILTER_IMAGE = 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=600&auto=format&fit=crop&q=80';

const BRANDS = [
  'VOLKSWAGEN', 'MAZDA', 'RENAULT', 'CHEVROLET', 'JEEP', 'PEUGEOT', 'DODGE', 'DAIHATSU',
  'HONDA', 'DAEWOO', 'TOYOTA', 'FIAT', 'MITSUBISHI', 'NISSAN', 'FORD', 'HYUNDAI',
  'SUZUKI', 'CHERY', 'KIA', 'CHRYSLER', 'LEXUS', 'ISUZU', 'WIX'
];

function extractBrand(desc) {
  const upper = desc.toUpperCase();
  let firstBrand = null;
  let firstIdx = Infinity;

  for (const b of BRANDS) {
    const regex = new RegExp('\\b' + b + '\\b', 'i');
    const match = regex.exec(upper);
    if (match && match.index < firstIdx) {
      firstIdx = match.index;
      firstBrand = b;
    }
  }
  return firstBrand || 'GENÉRICO';
}

// Leer CSV
if (!fs.existsSync(CSV_PATH)) {
  console.error(`El archivo ${CSV_PATH} no existe.`);
  process.exit(1);
}

const content = fs.readFileSync(CSV_PATH, 'utf8');
const lines = content.trim().split(/\r?\n/).slice(1);

const preparedItems = [];
let totalUnits = 0;
let totalCostVal = 0;
let totalSellVal = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const parts = line.split(',');
  if (parts.length !== 5) {
    console.error(`Línea ${i + 2} inválida (no tiene 5 columnas): ${line}`);
    process.exit(1);
  }

  const [codeRaw, descRaw, qtyRaw, costRaw, priceRaw] = parts;
  const code = codeRaw.trim().toUpperCase();
  const desc = descRaw.trim();
  const name = desc.toUpperCase();
  const qty = parseInt(qtyRaw.trim(), 10);
  const cost = parseFloat(costRaw.trim());
  const price = parseFloat(priceRaw.trim());

  if (isNaN(qty) || isNaN(cost) || isNaN(price)) {
    console.error(`Valores numéricos inválidos en línea ${i + 2}:`, { qtyRaw, costRaw, priceRaw });
    process.exit(1);
  }

  const margin = cost > 0 ? Number((((price - cost) / cost) * 100).toFixed(2)) : 0;
  const brand = extractBrand(desc);

  totalUnits += qty;
  totalCostVal += qty * cost;
  totalSellVal += qty * price;

  preparedItems.push({
    code: code,
    name: name,
    brand: brand,
    description: desc,
    quantity: qty,
    costPrice: cost,
    marginPercentage: margin,
    sellingPrice: price,
    taxPercentage: 16,
    unitsPerPackage: 1,
    image: FILTER_IMAGE,
    images: [FILTER_IMAGE],
    categoryId: CATEGORY_ID_FILTROS,
    webPublished: true,
    wholesaleEnabled: true,
    minWholesaleQty: 1,
    productType: 'product',
    minStock: 0
  });
}

console.log(`\n--- Resumen de productos a importar ---`);
console.log(`Total de productos: ${preparedItems.length}`);
console.log(`Total de unidades de stock: ${totalUnits}`);
console.log(`Valor total de costo: $${totalCostVal.toFixed(2)}`);
console.log(`Valor total de venta: $${totalSellVal.toFixed(2)}`);
console.log(`Ganancia bruta proyectada: $${(totalSellVal - totalCostVal).toFixed(2)}`);

if (isDryRun) {
  console.log('\n[DRY RUN] Mostrando los primeros 3 productos:');
  console.log(JSON.stringify(preparedItems.slice(0, 3), null, 2));
  console.log('\n[DRY RUN] Finalizado sin insertar en la base de datos.');
} else {
  // Inserción en lotes de 25
  const BATCH_SIZE = 25;
  let totalInserted = 0;
  let totalKardex = 0;

  for (let i = 0; i < preparedItems.length; i += BATCH_SIZE) {
    const batch = preparedItems.slice(i, i + BATCH_SIZE);
    const { data: inserted, error: insertError } = await supabase
      .from('inventory')
      .insert(batch)
      .select('id, name, quantity');

    if (insertError) {
      console.error(`Error al insertar lote ${Math.floor(i / BATCH_SIZE) + 1}:`, insertError.message);
      break;
    }

    totalInserted += inserted.length;

    // Registrar entradas en kardex
    const kardexEntries = inserted
      .filter(item => item.quantity > 0)
      .map(item => ({
        productId: item.id,
        productName: item.name,
        type: 'ENTRADA',
        quantity: item.quantity,
        concept: 'Inventario Inicial',
        user: 'Sistema'
      }));

    if (kardexEntries.length > 0) {
      const { error: kardexError } = await supabase.from('kardex').insert(kardexEntries);
      if (kardexError) {
        console.warn(`Aviso al insertar kardex para lote ${Math.floor(i / BATCH_SIZE) + 1}:`, kardexError.message);
      } else {
        totalKardex += kardexEntries.length;
      }
    }

    console.log(`Lote ${Math.floor(i / BATCH_SIZE) + 1} insertado (${totalInserted}/${preparedItems.length})`);
  }

  console.log(`\n¡Importación completada exitosamente!`);
  console.log(`- Productos insertados en 'inventory': ${totalInserted}`);
  console.log(`- Movimientos registrados en 'kardex': ${totalKardex}`);
}
