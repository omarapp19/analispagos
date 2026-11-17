// Script para actualizar los 8 filtros con nombre provisional "POR CONFIRMAR PREFIJO"
// Incluye el código de parte directamente en el nombre del producto según la regla de negocio.
import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;
if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  console.error('Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

const UPDATES = [
  {
    code: '46443',
    name: 'FILTRO DE AIRE 46443 HONDA ACCORD 2.3L (1998-2002)',
    brand: 'HONDA',
    description: 'FILTRO DE AIRE 46443 HONDA ACCORD 2.3L (1998-2002) - REF. WIX 46443 / FRAM CA8069'
  },
  {
    code: '46174',
    name: 'FILTRO DE AIRE 46174 FORD F-150 / EXPEDITION 4.6L 5.4L (1997-2004)',
    brand: 'FORD',
    description: 'FILTRO DE AIRE 46174 FORD F-150 / EXPEDITION / NAVIGATOR 4.6L 5.4L V8 - REF. WIX 46174'
  },
  {
    code: '8731',
    name: 'FILTRO DE AIRE 8731 DAEWOO NUBIRA / LEGANZA 1.6L 2.0L',
    brand: 'DAEWOO',
    description: 'FILTRO DE AIRE 8731 DAEWOO NUBIRA / LEGANZA / TACUMA 1.6L 2.0L - REF. 8731 / 96182220'
  },
  {
    code: '9628',
    name: 'FILTRO DE AIRE 9628 TOYOTA 4RUNNER 4.0L V6 (2003-2009)',
    brand: 'TOYOTA',
    description: 'FILTRO DE AIRE 9628 TOYOTA 4RUNNER 4.0L 1GR-FE (2003-2009) / PRADO 120 - REF. 9628'
  },
  {
    code: '210505',
    name: 'FILTRO DE AIRE 210505 FIAT PALIO / SIENA / STRADA FIRE',
    brand: 'FIAT',
    description: 'FILTRO DE AIRE 210505 FIAT PALIO / SIENA / STRADA / IDEA FIRE 1.3L 1.4L 1.8L - REF. 210505'
  },
  {
    code: '7641',
    name: 'FILTRO DE AIRE 7641 MITSUBISHI EK WAGON / MINICA 0.7L',
    brand: 'MITSUBISHI',
    description: 'FILTRO DE AIRE 7641 MITSUBISHI EK WAGON / TOPPO / MINICA 0.7L - REF. 7641 / MR968396'
  },
  {
    code: '7446',
    name: 'FILTRO DE AIRE 7446 LÍNEA PESADA / MAQUINARIA',
    brand: 'UNIVERSAL',
    description: 'FILTRO DE AIRE 7446 LÍNEA PESADA / MAQUINARIA INDUSTRIAL Y AGRÍCOLA - REF. 7446'
  },
  {
    code: '91937',
    name: 'FILTRO DE AIRE 91937 LÍNEA OEM UNIVERSAL',
    brand: 'GENÉRICO',
    description: 'FILTRO DE AIRE 91937 APLICACIÓN OEM UNIVERSAL - REF. 91937'
  }
];

async function run() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'cajero@staff.valkar.local',
    password: 'cajero123'
  });
  if (authError) {
    console.error('Error autenticando:', authError.message);
    process.exit(1);
  }

  for (const item of UPDATES) {
    const { data, error } = await supabase
      .from('inventory')
      .update({
        name: item.name,
        brand: item.brand,
        description: item.description,
        slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + item.code.toLowerCase(),
        updatedAt: new Date().toISOString()
      })
      .eq('code', item.code)
      .select('id, code, name, brand');

    if (error) {
      console.error(`Error actualizando ${item.code}:`, error.message);
    } else {
      console.log(`✓ Actualizado ${item.code}: ${item.name} [Marca: ${item.brand}]`);
    }
  }
}

run();
