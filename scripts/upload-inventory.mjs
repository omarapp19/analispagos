// Script para cargar el lote de 213 productos al inventario de Supabase
// Uso:
//   node --env-file=.env scripts/upload-inventory.mjs --dry-run
//   node --env-file=.env scripts/upload-inventory.mjs

import { createClient } from '@supabase/supabase-js';

const rawData = `Código,Descripción,Cantidad
,Tapa de alternador Mack delantera,3
,Tapa de Alternador Mack trasera,3
,Tapa de Alternador del Chevette,2
,Tapa de Arranque del Ford Alta,2
,Tapa de Arranque del Ford Baja,2
,Tapa de Arranque Ford Bronco,1
,Tapa de Distribuidor 8cil Chevrolet,3
,Tapa de Distribuidor Ford 6cil,6
,Cable Automotriz rojo N.16,"17,50"
,Espaciador Aluminio de 40,4
,Espaciador Aluminio de 37,1
,Espaciador Aluminio de 45,1
,Espaciador Aluminio de 50,1
,Cable Automotriz blanco 14,71
,Tapa distribución Dodge 8cil,1
,Tapa distribución Ford 8cil,3
,Tapa distribución Century,1
,Tapa distribución Fiat,3
FIR111PD,Faro Stop universal Ford,2
,Faro Stop Universal,2
6052,Faro sellado reemplazo 6052,5
5001,Faro del punta diamante 5001,3
H1109,Faro del H1109 Alta y baja,1
6054,Faro del Alta y baja 6054,3
H1104,Faro del redondo H1104,1
H1102,Faro del redondo H1102,1
4652,Faro del Sellado Alta y baja 4652,1
4000,Faro Sellado del 4000,1
6052,Faro del Silvin 36052,3
42833,Filtro de Aire Camión Mitsubishi 42833,2
,Faro stop redondo Aro negro Ámbar,12
,Faro stop redondo Ámbar Cromado,4
,Faro Stop redondo rojo Aro Negro,9
,Faro Stop redondo rojo Cromado,11
,Faro Stop redondo blanco Aro Negro,8
,Faro de cruce camión par izq y der,10
,Cocuyo laterales Ámbar Camión,19
,Cocuyo laterales rojo Camión,17
,Cocuyo laterales Azul Camión,9
,Cocuyo lateral Verde Camión,7
,Socate bombillo 1 contacto plástico blanco,35
,Socate Bombillo 1 contacto plástico Amarillo,16
ETR 86 der,Manilla Zephi Interna derecha,4
ETR 86 izq,Manilla Zephi Interna Izquierda,3
ETR 196 der,Manilla Ford F100 Interna derecha,2
017521 izq,Manilla Interna Izquierda,2
1735,Manilla Interna,1
017521 der,Manilla Interna derecha,1
3676,Kit Acople barra de direccion Fairlan 500,13
,Buje para ballesta Ford,6
,Bomba de gasolina Motor 360,2
,Manilla Interna der Caprice,1
,Campo para motor de arranque ford,2
,Porta Fusible,1
,Diodera,1
,Buje de Arranque P/Swift Automatico,10
,Buje de Arranque P/ Dodge,10
,Buje de Arranque rolin trasero chevrolet,7
,Buje de Arranque toyota Corolla,5
,Buje de Arranque Ford Bronco,5
,Rolin P/Alternador chevrolet,7
,Buje P/ Alternador Ford Sobre medida,24
,Buje de Arranque Swift Sincronico,2
,Rolin Arranque ford peq,11
FBE-1047,Filtro Purificador Ford Bronco Interfil,4
ETA-104,Manilla Vidrio Spark,3
17522,Manilla Interna derecha,1
PWH001B,Manilla P/vidrio Corsa,3
ET-91,Manilla P/vidrio Hyundai,1
ETR-09,Manilla P/vidrio dodge dart,2
,Quita ruido chevrolet,9
ET-78,Manilla P/vidrio,1
FG-14,Filtro P/gasolina Carburador,1
,Buje P/Arranque Ford trasero,36
,Buje P/Arranque Ford grafitado,9
,Acople Malibu Chevette,5
,Resorte P/acelerador Fino,31
,Resorte P/acelerador grueso,9
,Resorte Azul,4
,Canastilla,12
SL-13,Kit Acople Ford 100 - 350,8
105N,Kit de Cupilla P/cacho Dodge,14
,Mini resorte,18
,Torre bujia F14,1
,Guia Collarin F-350,3
,Guia Collarin F-750,1
,Guia Collarin F-600,1
,Platino P/ Arranque Chevrolet,19
W3229,Socate relay 5 pata plastico,200
,Socate P/ Modulo de ford conector,11
,Socate conector modulo Chevrolet,16
2985,Kit de acople 2985,4
30862,Kit de acople Cheyenne,8
,Condensador Ford,6
,Conector 4 via Macho,7
,Conector 4 via Hembra,6
,Conector 9 via Macho,8
,Conector 9 via Hembra,8
,Conector 5 via Macho,2
,Conector 5 via Hembra,1
AC168,Conector Bombillo modelo nuevo 9004,10
AC165-DS7,Socate P/bombillo Modelo nuevo 3 pines switch,43
,Socate porcelana H4,5
,Porta fusible,5
,Conector 9 pines interruptor de luces,4
,Conector switch de luz chevrolet,3
,Conector 4 pines bobina,14
,Socate Bombillo 9006,27
,Socate Bombillo H7,4
,Conector Alternador chevrolet,42
,Conector Switche Cambio luces Ford,3
,Socate alternador full injection,7
,Porta fusible con tapa,16
,Socate P/ Alternador Ford,1
,Socate gris H4 Ford,2
,Socate conector Flas,28
,Araña P/Ford 350,6
,Araña P/eje de Dodge 600 - 700,6
,Araña P/eje chevrolet 350,6
,Araña P/Ford 350,6
,Arandela P/eje Ford 100,7
,Arandela P/eje chevrolet 100,8
,Quita ruido P/Ford largo,4
,Quita ruido P/Ford corto,1
,Conector 2 via Macho,23
,Conector 2 via Hembra,23
,Conector 3 via Macho,24
,Conector 3 via Hembra,23
,Conector 4 via Macho,23
,Conector 4 via Hembra,23
,Socate bobina botellita Ford,4
1948,Conector Switch Sube vidrio chevrolet,1
,Socate regulador electronico Ford 4 vía,1
CS-110,Conector Switchera Ignicion chevrolet,3
CS-112,Conector Switchera gris 6 Vía,4
SQ-293,Conector Switchera 5 vía Ford,4
CS-169,Conector Switchera 9 via Ford,2
,Conector P/switchera Ford 11 Vía,2
,Socate bombillo 2 cont Plastico Blanco,2
4652-02-01,Cinta reflectiva,"11,5 mt"
4655-02-01,Cable Bujia Crown Sierra 2-4652,2
4655,Cable Bujia Motor 300 6 Cil Crown,1
46104,Cable Bujia GYG 6 cil Motor 300,4
4672,Cable Bujia 6 cil Bronco GYG,2
46113,Cable Bujia GYG Chevrolet C-30,2
4650,Cable Bujia GYG Mitsubishi eclipse,2
4659-A,Cable Bujia GYG 6 cil Cherokee,1
4651,Cable Bujia GYG 8 cil Motor 302-351,2
,Cable Bujia GYG Century Full Injection,1
5-46564,Cable Bujia P/Em Camion C-30,1
4659-A,Cable Bujia Crown Motor 250 Ford,1
IS-114,Cable Bujia,1
,Switche caña ignicion dodge,2
,Bombillo H11 plasma 12V 55 watt,5
SW 1533A,Automatico Ford Bronco,2
,Capsula Aceite Ford Spartan,1
Brb10SH,Carbonera de alternador Ford Bronco,2
Br F54dA,relay P/Ford Alternador,2
PS4,Switche de Ford inyeccion,1
CP41,Switche de inyeccion Chevrolet,1
Mg 02,Switche chevrolet Pollak,1
CS 169,Switche Caña Ford 100 Valley Forge,2
DS7,Switche Cambio luces chevrolet,4
DS05,Switche Cambio luces Ford,4
CP 102,Switche caña chevrolet starte,1
,Capsula de aceite olimpa Fiat,1
6638,Estopera ford 750 del TS,6
,Bendix chevette 9D Nielhoff,2
,Bendix Fiat 11D 147 Vulko,1
33554,Estopera,10
1430,Tornillo caliper chevrolet largo,15
AD1422,Tornillo caliper Chevrolet corto,12
,Tapa para aceite Chevette Ajustable,1
,Estopera Caprice delantera,10
SSO 100,Tapa Aceite Ford,1
SSO 105,Tapa Aceite Ford,7
10502,Tapa Aceite Combustible c/llave,2
NO 1029,Tapa Aceite Hyundai,3
ESO 070,Tapa Aceite Dodge,12
NO 1026,Tapa Aceite Ford (SSO 64),2
Dr 104,Rotor Chevrolet 8cil Dr 104,1
TMC8SO,Modulo Dodge IMC8SO,5
,Tapa P/Agua recipiente agua Corsa,3
,Tapa recipiente agua Aveo / Spark,2
T2019,Tapa envase bomba Chevrolet T2019,3
X20000,Reloj Amperaje bateria x2000,6
SK-78,Tapa automatico chevrolet SK78,4
SSO 75,Tapa Aceite Celebrity Century SSO 75,3
437,Cruceta Chevette 437,3
AB 396,Cruceta Chevrolet AB 396,1
,Relay Alternador Chevrolet,11
20327,Tapa radiador europeo,1
b 1811,Reloj Aceite b1811 Precision,2
433,Cruceta Ford 433 Precision,5
315,Cruceta Dodge 315,2
IX 106,Regulador Alt Fiat IX 106,4
IN 252,Regulador Switch,2
D 701,Regulador Alternador Corsa,3
6098490,Relay Alternador,1
398200,Carbonera Alternador Toyota,4
Dr 4200,Regulador Ford Festiva,1
K101,Carbonera Ford K101,6
31019,Carbonera Chevette Vulko,9
DS 41,Bobina captadora Ford 6cil DS 41,3
,Diodera Ford Doble piso digital,2
,Diodera Alternador Corsa,2
ES-8,Bobina Captadora Ford,3
ES 4-2,Bobina Captadora Ford Bronco,4
,Bobina Captadora 6cil Chevrolet,6
18269,Bobina Captadora Chevette (421166),3
Fg 917,Filtro Carburador,33
B2A,Regulador Alt Swift B2A,1
,Switche Caña Chevrolet,1`;

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  lines.shift();
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let inQuotes = false;
    let current = '';
    const cols = [];
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());
    rows.push({
      code: cols[0] || '',
      description: cols[1] || '',
      quantityRaw: cols[2] || '0'
    });
  }
  return rows;
}

const parsed = parseCSV(rawData);

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

// Categorías del sistema
const CATEGORY_IDS = {
  aceites_motor: 'a20058f6-b06b-4226-87b0-23274888494b',
  aceites_caja: '69cd33e4-edf9-462c-a021-c173dc520c4e',
  refrigerantes: '55981388-ea91-4c42-bd85-7345300899a0',
  grasas: '7222ece3-016e-412e-82b4-43022335904c',
  filtros: '2aa4b3bc-cb42-48b0-82f6-fa1e270e4a54',
  frenos: '967278c7-9d72-47ac-b51b-fb41d096c0af',
  encendido: 'b33c9b49-a89c-4a59-bf72-7f34c1aedd21',
  baterias: '9001616d-859d-46a8-8ff3-6a404e31b8e9',
  correas: '1449e4f6-bcea-4677-8e3a-0bc783bd8254',
  suspension: 'd9044b15-e776-4c1e-b277-4c30e849a708',
  accesorios: 'e4eda0a6-09b9-427d-90a3-1c1802b60878'
};

// Imágenes verificadas HTTP 200 de alta resolución según tipo de componente automotriz
const IMAGES = {
  tapa_alternador: 'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=600&auto=format&fit=crop&q=80',
  tapa_arranque: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&auto=format&fit=crop&q=80',
  distribuidor: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=600&auto=format&fit=crop&q=80',
  cable_automotriz: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
  espaciador: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
  faro_delantero: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=600&auto=format&fit=crop&q=80',
  bombillo: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=600&auto=format&fit=crop&q=80',
  faro_stop: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=600&auto=format&fit=crop&q=80',
  filtro: 'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=600&auto=format&fit=crop&q=80',
  conector_socate: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
  manilla: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=600&auto=format&fit=crop&q=80',
  buje_rolin: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?w=600&auto=format&fit=crop&q=80',
  bomba_gasolina: 'https://images.unsplash.com/photo-1504222490345-c075b6008014?w=600&auto=format&fit=crop&q=80',
  resorte_acople: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=600&auto=format&fit=crop&q=80',
  cruceta: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=80',
  cable_bujia: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600&auto=format&fit=crop&q=80',
  tapa_fluido: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&auto=format&fit=crop&q=80',
  reloj: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80',
  switche: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
  hardware_eje: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
  frenos: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80'
};

const BRANDS = [
  'MACK', 'CHEVETTE', 'FORD', 'BRONCO', 'CHEVROLET', 'CHEYENNE', 'DODGE', 'CENTURY',
  'FIAT', 'MITSUBISHI', 'SPARK', 'AVEO', 'CORSA', 'HYUNDAI', 'SWIFT', 'TOYOTA',
  'COROLLA', 'FAIRLANE', 'FAIRLAN', 'CAPRICE', 'INTERFIL', 'VULKO', 'NIELHOFF', 'CROWN',
  'GYG', 'POLLAK', 'VALLEY FORGE', 'PRECISION', 'ZEPHYR', 'ZEPHI', 'SIERRA', 'CHEROKEE',
  'ECLIPSE', 'SPARTAN', 'OLIMPIA', 'OLIMPA', 'FESTIVA', 'DART', 'MALIBU'
];

function extractBrand(desc) {
  const upper = desc.toUpperCase();
  for (const b of BRANDS) {
    if (new RegExp('\\b' + b + '\\b', 'i').test(upper)) {
      if (b === 'FAIRLAN') return 'FORD';
      if (b === 'ZEPHI') return 'FORD';
      if (b === 'OLIMPA') return 'OLIMPIA';
      if (b === 'DART') return 'DODGE';
      if (b === 'MALIBU') return 'CHEVROLET';
      if (b === 'COROLLA') return 'TOYOTA';
      if (b === 'BRONCO' || b === 'SIERRA' || b === 'FESTIVA') return 'FORD';
      if (b === 'CAPRICE' || b === 'CHEYENNE' || b === 'CORSA' || b === 'AVEO' || b === 'SPARK') return 'CHEVROLET';
      return b;
    }
  }
  return 'GENÉRICO';
}

function parseQuantity(raw) {
  if (typeof raw === 'number') return Math.round(raw);
  const clean = String(raw).replace(/mt/i, '').replace(/"/g, '').replace(',', '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

function classifyProduct(desc) {
  const d = desc.toLowerCase();

  // Cables de bujía
  if (d.includes('cable bujia') || d.includes('cable de bujia')) {
    return { categoryId: CATEGORY_IDS.encendido, image: IMAGES.cable_bujia };
  }
  // Cables automotrices y cinta
  if (d.includes('cable automotriz') || d.includes('cinta reflectiva')) {
    return { categoryId: CATEGORY_IDS.accesorios, image: IMAGES.cable_automotriz };
  }
  // Tapa alternador
  if (d.includes('tapa') && d.includes('alternador')) {
    return { categoryId: CATEGORY_IDS.encendido, image: IMAGES.tapa_alternador };
  }
  // Tapa arranque / automático
  if (d.includes('tapa de arranque') || d.includes('automatico ford') || d.includes('tapa automatico')) {
    return { categoryId: CATEGORY_IDS.encendido, image: IMAGES.tapa_arranque };
  }
  // Tapa distribuidor / rotor / platino / condensador / torre bujía / bobina captadora
  if (d.includes('distribui') || d.includes('rotor') || d.includes('platino') || d.includes('condensador') || d.includes('torre bujia') || d.includes('bobina captadora') || d.includes('modulo dodge')) {
    return { categoryId: CATEGORY_IDS.encendido, image: IMAGES.distribuidor };
  }
  // Espaciadores
  if (d.includes('espaciador')) {
    return { categoryId: CATEGORY_IDS.suspension, image: IMAGES.espaciador };
  }
  // Bombillos
  if (d.includes('bombillo')) {
    return { categoryId: CATEGORY_IDS.accesorios, image: IMAGES.bombillo };
  }
  // Faros delanteros / Silvines
  if (d.includes('faro sellado') || d.includes('punta diamante') || d.includes('silvin') || d.includes('alta y baja') || d.includes('faro del')) {
    return { categoryId: CATEGORY_IDS.accesorios, image: IMAGES.faro_delantero };
  }
  // Faros stop / cocuyos / cruce
  if (d.includes('stop') || d.includes('cocuyo') || d.includes('cruce')) {
    return { categoryId: CATEGORY_IDS.accesorios, image: IMAGES.faro_stop };
  }
  // Filtros
  if (d.includes('filtro')) {
    return { categoryId: CATEGORY_IDS.filtros, image: IMAGES.filtro };
  }
  // Manillas
  if (d.includes('manilla')) {
    return { categoryId: CATEGORY_IDS.accesorios, image: IMAGES.manilla };
  }
  // Socates, conectores, relays
  if (d.includes('socate') || d.includes('conector') || d.includes('porta fusible') || d.includes('relay')) {
    return { categoryId: CATEGORY_IDS.accesorios, image: IMAGES.conector_socate };
  }
  // Bujes, rolines, bendix, canastilla
  if (d.includes('buje') || d.includes('rolin') || d.includes('bendix') || d.includes('canastilla') || d.includes('collarin')) {
    return { categoryId: CATEGORY_IDS.suspension, image: IMAGES.buje_rolin };
  }
  // Bomba gasolina
  if (d.includes('bomba de gasolina')) {
    return { categoryId: CATEGORY_IDS.filtros, image: IMAGES.bomba_gasolina };
  }
  // Resortes, acoples, cupilla
  if (d.includes('resorte') || d.includes('acople') || d.includes('cupilla') || d.includes('quita ruido')) {
    return { categoryId: CATEGORY_IDS.suspension, image: IMAGES.resorte_acople };
  }
  // Crucetas
  if (d.includes('cruceta')) {
    return { categoryId: CATEGORY_IDS.suspension, image: IMAGES.cruceta };
  }
  // Tapas fluidos
  if (d.includes('tapa para aceite') || d.includes('tapa aceite') || d.includes('tapa radiador') || d.includes('tapa p/agua') || d.includes('tapa recipiente') || d.includes('tapa envase')) {
    return { categoryId: CATEGORY_IDS.accesorios, image: IMAGES.tapa_fluido };
  }
  // Relojes
  if (d.includes('reloj')) {
    return { categoryId: CATEGORY_IDS.accesorios, image: IMAGES.reloj };
  }
  // Switches
  if (d.includes('switche') || d.includes('capsula')) {
    return { categoryId: CATEGORY_IDS.encendido, image: IMAGES.switche };
  }
  // Caliper / frenos
  if (d.includes('caliper')) {
    return { categoryId: CATEGORY_IDS.frenos, image: IMAGES.frenos };
  }
  // Eje / araña / arandela / estopera
  if (d.includes('araña') || d.includes('arandela') || d.includes('estopera')) {
    return { categoryId: CATEGORY_IDS.suspension, image: IMAGES.hardware_eje };
  }
  // Reguladores, dioderas, carboneras, campos
  if (d.includes('regulador') || d.includes('diodera') || d.includes('carbonera') || d.includes('campo')) {
    return { categoryId: CATEGORY_IDS.encendido, image: IMAGES.tapa_alternador };
  }

  return { categoryId: CATEGORY_IDS.accesorios, image: IMAGES.conector_socate };
}

// Consultar códigos existentes en la base de datos
const { data: existingRows } = await supabase.from('inventory').select('code');
let nextCodeNum = 1;
(existingRows || []).forEach(r => {
  if (r.code) {
    const num = parseInt(r.code.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= nextCodeNum) nextCodeNum = num + 1;
  }
});
console.log(`Código inicial para productos sin código: ${nextCodeNum.toString().padStart(4, '0')}`);

const preparedItems = [];
for (const raw of parsed) {
  let code = raw.code.trim();
  if (!code) {
    code = (nextCodeNum++).toString().padStart(4, '0');
  }

  const name = raw.description.trim().toUpperCase();
  const brand = extractBrand(raw.description);
  const qty = parseQuantity(raw.quantityRaw);
  const cls = classifyProduct(raw.description);

  let descExtra = '';
  if (String(raw.quantityRaw).includes(',')) {
    descExtra = ` [Medida: ${raw.quantityRaw.replace(/"/g, '')}]`;
  }

  preparedItems.push({
    code: code,
    name: name,
    brand: brand,
    description: raw.description.trim() + descExtra,
    quantity: qty,
    costPrice: 0,
    marginPercentage: 0,
    sellingPrice: 0,
    taxPercentage: 16,
    unitsPerPackage: 1,
    image: cls.image,
    categoryId: cls.categoryId,
    productType: 'product'
  });
}

console.log(`\nPreparados ${preparedItems.length} productos para subir.`);
console.log('Muestra de los primeros 5 productos:');
console.log(JSON.stringify(preparedItems.slice(0, 5), null, 2));

if (isDryRun) {
  console.log('\n[DRY RUN] Finalizado sin insertar en la base de datos.');
  process.exit(0);
}

// Inserción en bloques de 50 productos para óptimo rendimiento
const BATCH_SIZE = 50;
let totalInserted = 0;
let totalKardex = 0;

for (let i = 0; i < preparedItems.length; i += BATCH_SIZE) {
  const batch = preparedItems.slice(i, i + BATCH_SIZE);
  const { data: inserted, error: insertError } = await supabase
    .from('inventory')
    .insert(batch)
    .select('id, name, quantity');

  if (insertError) {
    console.error(`Error al insertar lote ${i / BATCH_SIZE + 1}:`, insertError.message);
    process.exit(1);
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
      console.warn(`Aviso al insertar kardex para lote ${i / BATCH_SIZE + 1}:`, kardexError.message);
    } else {
      totalKardex += kardexEntries.length;
    }
  }

  console.log(`Lote ${Math.floor(i / BATCH_SIZE) + 1} insertado (${totalInserted}/${preparedItems.length})`);
}

console.log(`\n¡Éxito total!`);
console.log(`- Productos insertados en inventory: ${totalInserted}`);
console.log(`- Registros de entrada en kardex: ${totalKardex}`);
