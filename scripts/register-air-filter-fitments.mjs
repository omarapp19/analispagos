// Script para registrar compatibilidades (product_fitments) de los filtros de aire y repuestos automotrices
import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;
if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

await supabase.auth.signInWithPassword({
  email: 'cajero@staff.valkar.local',
  password: 'cajero123'
});

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

// Catálogo de aplicaciones automotrices investigadas
export const APPLICATIONS = {
  '1169': [
    { make: 'Volkswagen', model: 'Delivery', engine: '6-160 / 9-170 / 11-180 Cummins' }
  ],
  '1340': [
    { make: 'Mazda', model: 'Mazda 6', engine: '2.0L / 2.3L', yearFrom: 2003, yearTo: 2008 }
  ],
  '1447': [
    { make: 'Renault', model: 'Logan', engine: '1.6L 8V / 16V', yearFrom: 2005, yearTo: 2015 },
    { make: 'Renault', model: 'Symbol', engine: '1.4L / 1.6L', yearFrom: 2001, yearTo: 2013 },
    { make: 'Ford', model: 'Ka', engine: '1.6L', yearFrom: 2001, yearTo: 2008 }
  ],
  '1466': [
    { make: 'Chevrolet', model: 'Colorado', engine: 'Línea Comercial 2.8L / 3.5L / 3.7L' }
  ],
  '1877': [
    { make: 'Jeep', model: 'Grand Cherokee', engine: '3.7L / 4.7L / 5.7L HEMI', yearFrom: 2005, yearTo: 2010 }
  ],
  '2663': [
    { make: 'Universal', model: 'Carburado Pesado', notes: 'Elemento cilíndrico universal' }
  ],
  '3173': [
    { make: 'Peugeot', model: '207', engine: '1.4L / 1.6L', yearFrom: 2006, yearTo: 2014 },
    { make: 'Peugeot', model: '306', engine: '1.6L / 1.8L / 2.0L' },
    { make: 'Peugeot', model: '307', engine: '1.6L / 2.0L', yearFrom: 2001, yearTo: 2009 },
    { make: 'Peugeot', model: 'Partner', engine: '1.6L / 1.9D', yearFrom: 1999, yearTo: 2015 }
  ],
  '3901': [
    { make: 'Dodge', model: 'Dart', notes: 'Línea Clásica Carburada' },
    { make: 'Jeep', model: 'CJ-5 / CJ-7', notes: 'Línea Clásica Carburada' },
    { make: 'Daihatsu', model: 'Feroza / Rocky', notes: 'Línea Clásica Carburada' }
  ],
  '4309': [
    { make: 'Nissan', model: 'Sentra', engine: '1.6L / 1.8L (B13 / B14 / B15)', yearFrom: 1991, yearTo: 2006 },
    { make: 'Nissan', model: 'Almera', engine: '1.6L / 1.8L', yearFrom: 2000, yearTo: 2006 },
    { make: 'Nissan', model: 'Pathfinder', engine: '3.3L / 3.5L V6', yearFrom: 1996, yearTo: 2004 },
    { make: 'Nissan', model: 'Frontier / Navara', engine: '2.4L / 3.3L', yearFrom: 1998, yearTo: 2004 },
    { make: 'Nissan', model: 'X-Trail', engine: '2.5L', yearFrom: 2001, yearTo: 2007 }
  ],
  '4320': [
    { make: 'Honda', model: 'Civic', engine: 'Carburado 1.3L / 1.5L', yearFrom: 1986, yearTo: 1995 },
    { make: 'Mazda', model: '323', engine: 'Carburado 1.3L / 1.5L', yearFrom: 1986, yearTo: 1995 }
  ],
  '4383': [
    { make: 'Mazda', model: '323', engine: '1.3L Inyección' },
    { make: 'Mazda', model: 'BT-50', engine: '2.6L Gasolina' }
  ],
  '4494': [
    { make: 'Chevrolet', model: 'Spark', engine: '0.8L / 1.0L', yearFrom: 2005, yearTo: 2015 },
    { make: 'Daewoo', model: 'Matiz', engine: '0.8L', yearFrom: 1998, yearTo: 2005 }
  ],
  '5109': [
    { make: 'Daewoo', model: 'Cielo', engine: '1.5L', yearFrom: 1995, yearTo: 2002 },
    { make: 'Daewoo', model: 'Espero', engine: '1.8L / 2.0L', yearFrom: 1992, yearTo: 1999 },
    { make: 'Daewoo', model: 'Racer', engine: '1.5L', yearFrom: 1992, yearTo: 1997 },
    { make: 'Daewoo', model: 'Prince', engine: '2.0L' }
  ],
  '5125': [
    { make: 'Toyota', model: 'Celica', engine: '1.6L / 1.8L', yearFrom: 1990, yearTo: 1999 }
  ],
  '5140': [
    { make: 'Fiat', model: 'Tempra', engine: '1.6L / 1.8L / 2.0L', yearFrom: 1990, yearTo: 1998 }
  ],
  '5466': [
    { make: 'Toyota', model: 'Corolla', engine: '1.6L / 1.8L (Baby Camry / Sapito)', yearFrom: 1993, yearTo: 2002 },
    { make: 'Chery', model: 'Orinoco', engine: '1.8L Acteco', yearFrom: 2011, yearTo: 2018 }
  ],
  '5496': [
    { make: 'Chevrolet', model: 'Corsa', engine: '1.3L / 1.4L / 1.6L', yearFrom: 1996, yearTo: 2006 }
  ],
  '5501': [
    { make: 'Peugeot', model: '206', engine: '1.6L CC / 2.0L RC', yearFrom: 2001, yearTo: 2008 }
  ],
  '5970': [
    { make: 'Chevrolet', model: 'Astra', engine: '1.8L', yearFrom: 2001, yearTo: 2004 }
  ],
  '6389': [
    { make: 'Mitsubishi', model: 'L300', engine: '2.0L / 2.4L Panel / Van / Starwagon', yearFrom: 1990, yearTo: 2013 }
  ],
  '6395': [
    { make: 'Toyota', model: 'RAV4', engine: '2.0L 3S-FE', yearFrom: 1997, yearTo: 2000 },
    { make: 'Toyota', model: 'Celica', engine: '2.0L / 2.2L', yearFrom: 1994, yearTo: 1999 }
  ],
  '6479': [
    { make: 'Chevrolet', model: 'Caprice', engine: 'V8 5.7L / 5.0L', yearFrom: 1980, yearTo: 1996 },
    { make: 'Chevrolet', model: 'Impala', engine: 'V8 5.7L', yearFrom: 1980, yearTo: 1996 }
  ],
  '6850': [
    { make: 'Nissan', model: 'Frontier / Navara', engine: '2.4L / 3.3L', yearFrom: 1998, yearTo: 2008 },
    { make: 'Nissan', model: 'X-Trail', engine: '2.5L QR25DE', yearFrom: 2001, yearTo: 2007 }
  ],
  '6900': [
    { make: 'Nissan', model: 'Sentra', engine: '1.6L GA16DE (B13 / B14)', yearFrom: 1992, yearTo: 2004 },
    { make: 'Nissan', model: 'X-Trail', engine: '2.5L', yearFrom: 2002, yearTo: 2007 }
  ],
  '7020': [
    { make: 'Ford', model: 'EcoSport', engine: '2.0L Duratec', yearFrom: 2004, yearTo: 2008 }
  ],
  '7351': [
    { make: 'Toyota', model: 'Camry', engine: '2.2L / 3.0L V6', yearFrom: 1992, yearTo: 2001 },
    { make: 'Toyota', model: 'Celica', engine: '2.2L', yearFrom: 1994, yearTo: 1999 },
    { make: 'Lexus', model: 'ES300', engine: '3.0L V6', yearFrom: 1992, yearTo: 2001 }
  ],
  '7431': [
    { make: 'Volkswagen', model: 'Golf', engine: '1.8L / 2.0L MK3', yearFrom: 1993, yearTo: 1999 },
    { make: 'Volkswagen', model: 'Jetta / Bora', engine: '2.0L MK3', yearFrom: 1993, yearTo: 1999 },
    { make: 'Volkswagen', model: 'Vento', engine: '1.8L / 2.0L', yearFrom: 1993, yearTo: 1999 },
    { make: 'Volkswagen', model: 'Polo', engine: '1.6L', yearFrom: 1996, yearTo: 2002 }
  ],
  '7446': [
    { make: 'Universal', model: 'Pesado / Maquinaria', notes: 'Filtro de aire para maquinaria pesada' }
  ],
  '7617': [
    { make: 'Chevrolet', model: 'Grand Vitara', engine: '1.6L / 2.0L 4 Puertas', yearFrom: 1998, yearTo: 2006 },
    { make: 'Suzuki', model: 'Vitara', engine: '1.6L / 2.0L 4 Puertas', yearFrom: 1992, yearTo: 2005 }
  ],
  '7626': [
    { make: 'Toyota', model: '4Runner', engine: '3.4L V6 5VZ-FE', yearFrom: 1996, yearTo: 2002 },
    { make: 'Toyota', model: 'Supra', engine: '3.0L 2JZ-GE', yearFrom: 1993, yearTo: 1998 }
  ],
  '7641': [
    { make: 'Mitsubishi', model: 'eK Wagon / Toppo', engine: '0.7L (MR968396)' }
  ],
  '7764': [
    { make: 'Honda', model: 'Civic', engine: '1.6L D16Y7 / D16Y8', yearFrom: 1999, yearTo: 2000 }
  ],
  '8052': [
    { make: 'Chevrolet', model: 'Esteem', engine: '1.6L', yearFrom: 1997, yearTo: 2003 },
    { make: 'Chevrolet', model: 'Jimny', engine: '1.3L', yearFrom: 2000, yearTo: 2004 },
    { make: 'Suzuki', model: 'Baleno', engine: '1.3L / 1.6L', yearFrom: 1995, yearTo: 2002 }
  ],
  '8067': [
    { make: 'Chevrolet', model: 'Luv D-Max', engine: '3.5L V6 / 2.5D', yearFrom: 2005, yearTo: 2012 },
    { make: 'Isuzu', model: 'Rodeo', engine: '3.2L / 3.5L V6', yearFrom: 1998, yearTo: 2004 },
    { make: 'Isuzu', model: 'Trooper', engine: '3.2L / 3.5L V6', yearFrom: 1992, yearTo: 2002 }
  ],
  '8069': [
    { make: 'Chevrolet', model: 'Grand Vitara', engine: '2.5L V6 / 2.7L XL-7', yearFrom: 2001, yearTo: 2007 },
    { make: 'Suzuki', model: 'Grand Vitara', engine: '2.5L V6 / 2.7L XL-7', yearFrom: 2001, yearTo: 2006 }
  ],
  '8729': [
    { make: 'Daewoo', model: 'Lanos', engine: '1.5L / 1.6L', yearFrom: 1996, yearTo: 2004 }
  ],
  '8730': [
    { make: 'Daewoo', model: 'Nubira', engine: '1.6L / 2.0L', yearFrom: 1997, yearTo: 2003 },
    { make: 'Daewoo', model: 'Leganza', engine: '2.0L / 2.2L', yearFrom: 1997, yearTo: 2002 }
  ],
  '8731': [
    { make: 'Daewoo', model: 'Nubira', engine: '1.6L / 2.0L' },
    { make: 'Chevrolet', model: 'Optra', engine: '1.8L Desing / Limited' }
  ],
  '8774': [
    { make: 'Renault', model: 'Twingo', engine: '1.2L 8V / 16V', yearFrom: 2001, yearTo: 2005 }
  ],
  '8805': [
    { make: 'Dodge', model: 'Neon', engine: '2.0L SOHC', yearFrom: 2000, yearTo: 2006 },
    { make: 'Dodge', model: 'Caliber', engine: '2.0L', yearFrom: 2007, yearTo: 2012 },
    { make: 'Jeep', model: 'Compass', engine: '2.0L / 2.4L', yearFrom: 2007, yearTo: 2012 }
  ],
  '8922': [
    { make: 'Mazda', model: 'Mazda 6', engine: '2.0L / 2.3L', yearFrom: 2003, yearTo: 2008 }
  ],
  '8956': [
    { make: 'Chevrolet', model: 'Corsa', engine: '1.3L / 1.4L / 1.6L / C2', yearFrom: 1996, yearTo: 2008 }
  ],
  '8964': [
    { make: 'Renault', model: 'Clio', engine: '1.4L / 1.6L K4M', yearFrom: 2000, yearTo: 2009 },
    { make: 'Renault', model: 'Symbol', engine: '1.6L 16V', yearFrom: 2001, yearTo: 2010 },
    { make: 'Renault', model: 'Megane', engine: '1.6L / 2.0L Classic', yearFrom: 1999, yearTo: 2004 }
  ],
  '9001': [
    { make: 'Nissan', model: 'Frontier / Navara', engine: '2.4L / 3.3L V6', yearFrom: 1998, yearTo: 2006 }
  ],
  '9071': [
    { make: 'Peugeot', model: '206', engine: '1.4L / 1.6L / 2.0L (Filtro Antipolen Cabina)', yearFrom: 1999, yearTo: 2008 }
  ],
  '9111': [
    { make: 'Chery', model: 'Arauca', engine: '1.3L Acteco', yearFrom: 2011, yearTo: 2016 }
  ],
  '9115': [
    { make: 'Toyota', model: 'Yaris', engine: '1.3L 2NZ-FE', yearFrom: 2000, yearTo: 2005 }
  ],
  '9367': [
    { make: 'Mitsubishi', model: 'Montero', engine: '3.5L / 3.8L V6 Limited', yearFrom: 2001, yearTo: 2008 }
  ],
  '9401': [
    { make: 'Dodge', model: 'Ram 1500 / 2500', engine: '3.7L / 4.7L / 5.7L HEMI', yearFrom: 2005, yearTo: 2009 }
  ],
  '9482': [
    { make: 'Toyota', model: 'Corolla', engine: '1.6L / 1.8L New Sensation', yearFrom: 2003, yearTo: 2008 },
    { make: 'Toyota', model: 'Celica', engine: '1.8L', yearFrom: 2003, yearTo: 2006 }
  ],
  '9628': [
    { make: 'Toyota', model: '4Runner', engine: '4.0L 1GR-FE', yearFrom: 2003, yearTo: 2009 },
    { make: 'Toyota', model: 'Fortuner', engine: '4.0L 1GR-FE', yearFrom: 2006, yearTo: 2015 },
    { make: 'Toyota', model: 'Hilux', engine: '4.0L 1GR-FE', yearFrom: 2005, yearTo: 2015 },
    { make: 'Toyota', model: 'FJ Cruiser', engine: '4.0L 1GR-FE', yearFrom: 2007, yearTo: 2014 }
  ],
  '9684': [
    { make: 'Chevrolet', model: 'Astra', engine: '1.8L / 2.2L', yearFrom: 1998, yearTo: 2006 }
  ],
  '9687': [
    { make: 'Ford', model: 'F-150', engine: '4.6L / 5.4L FX4', yearFrom: 2004, yearTo: 2010 },
    { make: 'Ford', model: 'Super Duty (F-250 / F-350)', engine: '5.4L / 6.2L', yearFrom: 2004, yearTo: 2010 },
    { make: 'Ford', model: 'Expedition', engine: '5.4L Triton', yearFrom: 2005, yearTo: 2010 }
  ],
  '9895': [
    { make: 'Ford', model: 'Mustang', engine: '4.0L V6 / 4.6L V8', yearFrom: 2005, yearTo: 2009 },
    { make: 'Ford', model: 'Ka', engine: '1.6L Zetec Rocam', yearFrom: 2001, yearTo: 2008 }
  ],
  '10118': [
    { make: 'Dodge', model: 'Caliber', engine: '2.0L Dual VVT', yearFrom: 2007, yearTo: 2012 },
    { make: 'Jeep', model: 'Compass', engine: '2.0L / 2.4L', yearFrom: 2007, yearTo: 2013 },
    { make: 'Chrysler', model: 'PT Cruiser', engine: '2.4L', yearFrom: 2001, yearTo: 2010 }
  ],
  '10880': [
    { make: 'Chevrolet', model: 'Orlando', engine: '2.4L Ecotec', yearFrom: 2012, yearTo: 2016 }
  ],
  '15643': [
    { make: 'Hyundai', model: 'Santa Fe', engine: '2.7L V6 Mu', yearFrom: 2006, yearTo: 2009 }
  ],
  '20040': [
    { make: 'Toyota', model: 'Camry', engine: '2.4L 4L 2AZ-FE', yearFrom: 2002, yearTo: 2006 }
  ],
  '26123': [
    { make: 'Hyundai', model: 'Accent', engine: '1.6L CVVT', yearFrom: 2006, yearTo: 2011 },
    { make: 'Kia', model: 'Rio', engine: '1.6L CVVT', yearFrom: 2006, yearTo: 2011 }
  ],
  '32573': [
    { make: 'Renault', model: 'Megane', engine: '2.0L 16V Mégane II', yearFrom: 2005, yearTo: 2008 }
  ],
  '42825': [
    { make: 'Mazda', model: 'Mazda 6', engine: '2.0L / 2.3L / 2.5L', yearFrom: 2006, yearTo: 2012 }
  ],
  '45020': [
    { make: 'Hyundai', model: 'H1 / Starex', engine: '2.5L TD / 2.4L (H-100)', yearFrom: 1998, yearTo: 2002 }
  ],
  '46162': [
    { make: 'Toyota', model: 'Tacoma', engine: '2.4L / 2.7L / 3.4L', yearFrom: 1995, yearTo: 2004 },
    { make: 'Toyota', model: 'Previa Van', engine: '2.4L 2TZ-FE', yearFrom: 1991, yearTo: 1997 },
    { make: 'Mazda', model: '929', engine: '3.0L V6' }
  ],
  '46174': [
    { make: 'Ford', model: 'Bronco', engine: '4.9L / 5.0L / 5.8L V8', yearFrom: 1987, yearTo: 1996 },
    { make: 'Ford', model: 'F-150', engine: '4.9L / 5.0L / 5.8L', yearFrom: 1987, yearTo: 1997 },
    { make: 'Ford', model: 'Super Duty (F-250 / F-350)', engine: '5.8L / 7.5L V8', yearFrom: 1987, yearTo: 1997 }
  ],
  '46207': [
    { make: 'Suzuki', model: 'Vitara', engine: '1.6L / 2.0L 4 Puertas', yearFrom: 1995, yearTo: 2003 },
    { make: 'Chevrolet', model: 'Grand Vitara', engine: '2.0L 4 Puertas', yearFrom: 1998, yearTo: 2005 }
  ],
  '46443': [
    { make: 'Honda', model: 'Accord', engine: '2.3L F23A', yearFrom: 1998, yearTo: 2002 }
  ],
  '55267': [
    { make: 'Chevrolet', model: 'Captiva', engine: '3.2L V6 HFV6', yearFrom: 2007, yearTo: 2011 }
  ],
  '59453': [
    { make: 'Chevrolet', model: 'Epica', engine: '2.5L 6L XK', yearFrom: 2006, yearTo: 2010 },
    { make: 'Suzuki', model: 'Verona', engine: '2.5L', yearFrom: 2004, yearTo: 2006 },
    { make: 'Chery', model: 'Tiggo', engine: '2.4L Mitsubishi 4G64', yearFrom: 2007, yearTo: 2013 }
  ],
  '60122': [
    { make: 'Chevrolet', model: 'Impala', engine: '5.3L V8 LS4 SS', yearFrom: 2007, yearTo: 2008 }
  ],
  '65288': [
    { make: 'Chery', model: 'Tiggo', engine: '2.0L / 2.4L Acteco', yearFrom: 2006, yearTo: 2015 }
  ],
  '75F00': [
    { make: 'Suzuki', model: 'Alto', engine: '1.0L / 1.1L', yearFrom: 1998, yearTo: 2008 },
    { make: 'Suzuki', model: 'Wagon R', engine: '1.0L / 1.2L', yearFrom: 1998, yearTo: 2006 },
    { make: 'Chevrolet', model: 'Wagon R+', engine: '1.2L', yearFrom: 1999, yearTo: 2005 }
  ],
  '79201': [
    { make: 'Chevrolet', model: 'Super Carry', engine: '1.0L F10A', yearFrom: 1995, yearTo: 2004 },
    { make: 'Daewoo', model: 'Damas', engine: '0.8L', yearFrom: 1996, yearTo: 2003 },
    { make: 'Daewoo', model: 'Labo', engine: '0.8L', yearFrom: 1996, yearTo: 2003 }
  ],
  '91937': [
    { make: 'Universal', model: 'Línea OEM', notes: 'Filtro de aire aplicación OEM' }
  ],
  '96431': [
    { make: 'Mazda', model: 'Mazda 3', engine: '1.6L / 2.0L MZR', yearFrom: 2005, yearTo: 2010 },
    { make: 'Mazda', model: 'Mazda 5', engine: '2.0L', yearFrom: 2006, yearTo: 2010 }
  ],
  '210505': [
    { make: 'Fiat', model: 'Palio / Siena', notes: 'Línea Europea Diésel / Gasolina' }
  ],
  '22301': [
    { make: 'Hyundai', model: 'Accent', engine: '1.3L 12V', yearFrom: 1995, yearTo: 2002 },
    { make: 'Dodge', model: 'Brisa', engine: '1.3L', yearFrom: 2002, yearTo: 2006 }
  ],
  '620721': [
    { make: 'Mitsubishi', model: 'Space Wagon', engine: '1.8L 4G93', yearFrom: 1992, yearTo: 1998 }
  ],
  '802150': [
    { make: 'Mazda', model: 'Mazda 3', engine: '2.0L / 2.5L', yearFrom: 2010, yearTo: 2015 },
    { make: 'Mazda', model: 'Mazda 6', engine: '2.3L / 2.5L', yearFrom: 2009, yearTo: 2014 }
  ],
  'FS05 13 Z40': [
    { make: 'Mazda', model: '626', engine: '2.0L / 2.5L (Matsuri / Nuevo Milenio)', yearFrom: 1993, yearTo: 2003 }
  ],

  // Otros repuestos clave en el inventario con vehículo evidente
  'D228': [
    { make: 'Ford', model: 'Focus', engine: '2.0L Duratec', yearFrom: 2000, yearTo: 2008 }
  ],
  '7216': [
    { make: 'Chevrolet', model: 'Century', engine: '2.8L / 3.1L V6', yearFrom: 1985, yearTo: 1996 }
  ],
  'A57A-E': [
    { make: 'Fiat', model: 'Palio', engine: '1.3L / 1.4L / 1.8L', yearFrom: 1998, yearTo: 2012 },
    { make: 'Fiat', model: 'Siena', engine: '1.3L / 1.4L / 1.8L', yearFrom: 1998, yearTo: 2012 }
  ],
  'HA01853': [
    { make: 'Chevrolet', model: 'Silverado', engine: 'Barra Estabilizadora 34mm', yearFrom: 2000, yearTo: 2014 }
  ],
  'HA034': [
    { make: 'Chevrolet', model: 'Silverado', engine: 'Tripoide L/Caj Boca Ancha' }
  ],
  'HA029': [
    { make: 'Toyota', model: 'Fortuner', engine: 'Tripoide Lado Rueda 4.0L' },
    { make: 'Toyota', model: '4Runner', engine: 'Tripoide Lado Rueda 4.0L' },
    { make: 'Toyota', model: 'FJ Cruiser', engine: 'Tripoide Lado Rueda 4.0L' },
    { make: 'Toyota', model: 'Merú', engine: 'Tripoide Lado Rueda 2.7L' }
  ],
  'HA2700': [
    { make: 'Toyota', model: 'Hilux', engine: 'Espiral Quita Ruido Hilux / Kavak' }
  ],
  '13253690': [
    { make: 'Chevrolet', model: 'Cruze', engine: '1.8L Ecotec', yearFrom: 2010, yearTo: 2016 },
    { make: 'Chevrolet', model: 'Trailblazer', engine: 'V6 4.2L / V8 5.3L', yearFrom: 2002, yearTo: 2009 }
  ],
  'FBE-1047': [
    { make: 'Ford', model: 'Bronco', engine: 'Filtro Purificador 4.9L / 5.0L / 5.8L' }
  ]
};

console.log(`Catálogo cargado con ${Object.keys(APPLICATIONS).length} referencias de repuestos.`);

// Buscar productos en Supabase inventory por código
const codes = Object.keys(APPLICATIONS);
const { data: dbProducts } = await supabase.from('inventory').select('id, code, name').in('code', codes);

console.log(`Productos encontrados en DB: ${dbProducts?.length || 0} de ${codes.length}`);

// Previsualización de compatibilidades a crear
const fitmentRows = [];
for (const p of dbProducts || []) {
  let apps = APPLICATIONS[p.code];
  if (!apps) continue;

  // Manejo de códigos duplicados entre diferentes repuestos (ej: filtros vs pastillas de freno)
  if (p.code === '7431') {
    if (p.name.includes('PASTILLA')) {
      apps = [{ make: 'Chevrolet', model: 'Luv D-Max', engine: '4x2', notes: 'Pastillas de freno delanteras' }];
    } else {
      apps = APPLICATIONS['7431'];
    }
  } else if (p.code === '7626') {
    if (p.name.includes('FRENO') || p.name.includes('SUPER DUTTY')) {
      apps = [{ make: 'Ford', model: 'Super Duty (F-250 / F-350)', engine: 'Pastillas de freno Super Duty 250' }];
    } else {
      apps = APPLICATIONS['7626'];
    }
  }

  for (const app of apps) {
    const modelId = await ensureVehicle(app.make, app.model);
    fitmentRows.push({
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
}

console.log(`\nTotal de compatibilidades preparadas: ${fitmentRows.length}`);
console.log('Muestra de las primeras 5 compatibilidades:');
console.log(fitmentRows.slice(0, 5));

if (isDryRun) {
  console.log('\n[DRY RUN] Finalizado sin insertar en la base de datos.');
} else {
  console.log('\nInsertando en Supabase product_fitments...');
  // Limpiar compatibilidades previas de estos productos para evitar duplicados
  const productIds = dbProducts.map(p => p.id);
  const { error: delError } = await supabase.from('product_fitments').delete().in('productId', productIds);
  if (delError) {
    console.error('Error limpiando compatibilidades previas:', delError.message);
  }

  // Insertar limpias
  const toInsert = fitmentRows.map(f => ({
    productId: f.productId,
    modelId: f.modelId,
    yearFrom: f.yearFrom,
    yearTo: f.yearTo,
    engine: f.engine,
    notes: f.notes
  }));

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error: insErr } = await supabase.from('product_fitments').insert(batch);
    if (insErr) {
      console.error(`Error insertando lote ${i / BATCH + 1}:`, insErr.message);
      break;
    }
    inserted += batch.length;
  }

  console.log(`\n¡Éxito! ${inserted} compatibilidades registradas correctamente en product_fitments.`);
}
