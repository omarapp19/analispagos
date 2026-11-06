import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const MODELS_BY_MAKE = {
  Chevrolet: [
    'Aveo',
    'Corsa',
    'Spark',
    'Optra',
    'Silverado',
    'Cruze',
    'Luv D-Max',
    'Tahoe',
    'Trailblazer',
    'Cheyenne',
    'Caprice',
    'Chevette',
    'Century',
    'Celebrity',
    'Grand Vitara',
    'Astra',
    'C-10',
    'C-30',
    'Malibu',
    'Esteem',
    'Swift',
    'Epica',
    'Cavalier',
    'Blazer',
    'Camaro',
    'Impala',
    'Orlando',
    'Monza'
  ],
  Toyota: [
    'Corolla',
    'Yaris',
    'Hilux',
    'Fortuner',
    '4Runner',
    'Prado',
    'Land Cruiser Machito',
    'Land Cruiser Autana',
    'Merú',
    'Terios',
    'Camry',
    'RAV4',
    'Starlet',
    'FJ Cruiser',
    'Tacoma',
    'Tundra',
    'Celica',
    'Samurai',
    'Innova',
    'Prius'
  ],
  Ford: [
    'Fiesta',
    'Explorer',
    'F-150',
    'Ranger',
    'EcoSport',
    'Ka',
    'Focus',
    'Laser',
    'Bronco',
    'Fusion',
    'Escape',
    'Super Duty (F-250 / F-350)',
    'Fortaleza',
    'Zephyr',
    'Mustang',
    'Sierra',
    'Festiva',
    'Fairlane',
    'Conquistador',
    'Corcel',
    'Del Rey',
    'Edge',
    'Expedition'
  ],
  Mitsubishi: [
    'Lancer',
    'Montero',
    'Montero Sport / Dakar',
    'Signo',
    'Canter',
    'Outlander',
    'MF / MX',
    'Galant',
    'Eclipse',
    'Mirage',
    'L300',
    'L200',
    'Space Wagon'
  ],
  Hyundai: [
    'Accent',
    'Elantra',
    'Getz',
    'Tucson',
    'Santa Fe',
    'Excel',
    'Matrix',
    'H1 / Starex',
    'Atos',
    'Tiburon',
    'Sonata',
    'Creta',
    'i10'
  ],
  Kia: [
    'Rio',
    'Picanto',
    'Sportage',
    'Cerato',
    'Carens',
    'Sorento',
    'Carnival / Sedona',
    'Soul',
    'Pregio',
    'K2700',
    'Optima'
  ],
  Renault: [
    'Clio',
    'Megane',
    'Symbol',
    'Logan',
    'Sandero',
    'Scenic',
    'Twingo',
    'Duster',
    'Kangoo',
    'Fluence',
    'R19',
    'Stepway',
    'Koleos'
  ],
  Fiat: [
    'Palio',
    'Siena',
    'Uno / Fire',
    'Punto',
    'Premio',
    'Fiorino',
    'Idea',
    'Strada',
    'Spazio / 147',
    'Regata',
    'Tempra',
    'Ritmo',
    'Marea'
  ],
  Jeep: [
    'Grand Cherokee',
    'Cherokee XJ / Classic',
    'Cherokee KJ / Liberty',
    'Cherokee KK',
    'Wrangler',
    'CJ-5 / CJ-7',
    'Renegade',
    'Compass',
    'Commander',
    'Wagoneer'
  ],
  Nissan: [
    'Sentra',
    'Tiida',
    'Almera',
    'Patrol',
    'Frontier / Navara',
    'Pathfinder',
    'X-Trail',
    'D21 / D22',
    'Murano',
    'Maxima',
    'March',
    'Versa',
    'Urvan'
  ],
  Mazda: [
    'Mazda 3',
    'Mazda 6',
    'Mazda 2',
    'Allegro',
    'Demio',
    'BT-50',
    '323',
    '626',
    'CX-7',
    'CX-9',
    'Miata (MX-5)',
    'B2200 / B2600'
  ],
  Chery: [
    'Arauca',
    'Orinoco',
    'Tiggo',
    'Grand Tiger',
    'X1',
    'QQ',
    'Cowin'
  ],
  Volkswagen: [
    'Gol',
    'Golf',
    'Jetta / Bora',
    'Fox',
    'CrossFox',
    'Beetle / Escarabajo',
    'Polo',
    'Saveiro',
    'Vento',
    'Passat',
    'Amarok',
    'Combi / Transporter',
    'SpaceFox'
  ],
  Peugeot: [
    '206',
    '207',
    '307',
    '208',
    '308',
    '406',
    '407',
    '408',
    'Partner',
    '205'
  ],
  Dodge: [
    'Caliber',
    'Ram 1500 / 2500',
    'Dart',
    'Dodge 600',
    'Dodge 700',
    'Caravan / Grand Caravan',
    'Neon',
    'Aspen',
    'Durango',
    'Charger',
    'Dakota',
    'Journey'
  ],
  Honda: [
    'Civic',
    'Accord',
    'CR-V',
    'Fit',
    'Pilot',
    'Odyssey',
    'Integra',
    'Prelude',
    'City',
    'HR-V'
  ]
};

async function main() {
  const { data: makes, error: makesErr } = await sb.from('vehicle_makes').select('id, name');
  if (makesErr) {
    console.error('Error fetching makes:', makesErr);
    process.exit(1);
  }

  const { data: existingModels, error: modelsErr } = await sb.from('vehicle_models').select('id, makeId, name');
  if (modelsErr) {
    console.error('Error fetching models:', modelsErr);
    process.exit(1);
  }

  const existingMap = new Set(existingModels.map(m => `${m.makeId}::${m.name.trim().toLowerCase()}`));

  let added = 0;
  let skipped = 0;

  for (const make of makes) {
    const list = MODELS_BY_MAKE[make.name];
    if (!list || !list.length) {
      console.log(`No models configured for make "${make.name}"`);
      continue;
    }

    const toInsert = [];
    for (const modelName of list) {
      const key = `${make.id}::${modelName.trim().toLowerCase()}`;
      if (existingMap.has(key)) {
        skipped++;
      } else {
        toInsert.push({
          makeId: make.id,
          name: modelName.trim()
        });
        existingMap.add(key);
      }
    }

    if (toInsert.length > 0) {
      const { data, error } = await sb.from('vehicle_models').insert(toInsert).select();
      if (error) {
        console.error(`Error inserting models for ${make.name}:`, error);
      } else {
        added += data.length;
        console.log(`+ ${make.name}: ${data.length} modelos agregados.`);
      }
    }
  }

  console.log(`\nResumen: ${added} modelos nuevos agregados, ${skipped} ya existían.`);
}

main();
