// Prueba de concurrencia de place_order contra STAGING (spec sección 11):
// dos clientes piden a la vez todas las unidades disponibles de un producto; uno debe fallar.
//
// Requiere: migraciones 0001–0008 aplicadas, la tienda abierta con retiro en tienda y Pago Móvil activos,
// y dos cuentas de cliente de prueba ya registradas (register_customer) en staging.
//
//   $env:SUPABASE_URL="https://staging.supabase.co"
//   $env:SUPABASE_ANON_KEY="..."
//   $env:TEST_PRODUCT_CODE="0001"                      (producto publicado con stock >= 1)
//   $env:TEST_USER1="a@prueba.com"; $env:TEST_PASS1="..."
//   $env:TEST_USER2="b@prueba.com"; $env:TEST_PASS2="..."
//   node scripts/test-place-order-concurrency.mjs
//
// Al terminar cancela el pedido que haya entrado, para devolver el stock.

import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, TEST_PRODUCT_CODE, TEST_USER1, TEST_PASS1, TEST_USER2, TEST_PASS2 } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_PRODUCT_CODE || !TEST_USER1 || !TEST_PASS1 || !TEST_USER2 || !TEST_PASS2) {
    console.error('Faltan variables de entorno (ver el encabezado del script).');
    process.exit(1);
}
if (/prod/i.test(SUPABASE_URL)) {
    console.error('Esto parece producción. Usa staging.');
    process.exit(1);
}

const client = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const login = async (email, password) => {
    const c = client();
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`No se pudo iniciar sesión con ${email}: ${error.message}`);
    return c;
};

const [c1, c2] = await Promise.all([login(TEST_USER1, TEST_PASS1), login(TEST_USER2, TEST_PASS2)]);
const { data: prod, error } = await c1.from('catalog_products').select('id, name, available').eq('code', TEST_PRODUCT_CODE).single();
if (error || !prod) { console.error('Producto no encontrado en catalog_products:', error?.message); process.exit(1); }
if (prod.available < 1) { console.error(`${prod.name} no tiene unidades disponibles.`); process.exit(1); }

console.log(`Producto: ${prod.name}. Disponible: ${prod.available}. Dos pedidos de ${prod.available} unidad(es) a la vez…`);
const args = { items: [{ productId: prod.id, quantity: prod.available }], payment_method: 'pago_movil', delivery_method: 'retiro' };
const results = await Promise.allSettled([c1.rpc('place_order', args), c2.rpc('place_order', args)]);

const ok = [];
results.forEach((r, i) => {
    const res = r.status === 'fulfilled' ? r.value : { error: r.reason };
    if (res.error) console.log(`  cliente ${i + 1}: rechazado → ${res.error.message}`);
    else { console.log(`  cliente ${i + 1}: aceptado → ${res.data.number}`); ok.push({ c: i === 0 ? c1 : c2, number: res.data.number }); }
});

for (const o of ok) await o.c.rpc('cancel_my_order', { order_number: o.number });

if (ok.length === 1) {
    console.log('\nOK: un pedido entró y el otro fue rechazado. No hay sobreventa.');
} else {
    console.error(`\nFALLA: entraron ${ok.length} pedidos.`);
    process.exitCode = 1;
}
