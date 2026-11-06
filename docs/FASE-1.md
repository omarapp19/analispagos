# Fase 1: datos de la tienda en el ERP

Rama: `tienda/fase-1-catalogo` (sale de `seguridad/auth-rls`).

## Qué incluye

**Base de datos** (`supabase/migrations/`)
- `0003_store_catalog.sql`: dominios `erp_inventory_id`, `erp_client_id`, `erp_invoice_id` que copian el tipo real de `id`
  (uuid, bigint o text) para que las llaves foráneas funcionen sin editar el SQL. Campos web en `inventory`
  (`webPublished`, `webFeatured`, `slug`, `categoryId`, `reference`, `webDescription`, `specs`, `images`, mayor),
  `categories` (con `isUniversal`), `vehicle_makes` y `vehicle_models` (con `slug`), `product_fitments`, RLS y datos iniciales
  (11 categorías, 16 marcas). Al publicar, un trigger genera el slug (nombre + código) y la fecha de publicación.
- `0004_store_customers.sql`: `web_customers`, `web_addresses` y RLS.
- `0005_pricing.sql`: `pricing_rules` (solo personal).
- `0006_orders.sql`: `web_orders` (con `igtfUsd` aparte de `taxUsd`), `web_order_items`, `web_payment_reports`,
  `web_order_events`, `stock_reservations`, RLS y Realtime.
- `0007_store_public.sql`: vistas `catalog_products` y `catalog_categories`, RPC `products_for_vehicle`,
  buckets `product-images` (público), `payment-proofs` y `customer-docs` (privados) con sus políticas,
  y valores iniciales de `tienda_publica` (tienda cerrada) y `tienda_privada`.

**ERP**
- Configuración > **Tienda web** (solo administrador): estado, WhatsApp, horario, dirección; precios e impuestos
  (IVA incluido, factura fiscal, tope de descuento, margen mínimo: privados); IGTF y en qué métodos; datos de cada
  método de pago; retiro, zonas y tarifas de delivery, delivery gratis desde, envío nacional y transportistas;
  plazos de crédito y horas de reserva. Valida antes de guardar.
- Inventario > producto > pestaña **Tienda web**: publicar, destacar, categoría, referencia, descripción, specs
  clave/valor, hasta 5 imágenes (WebP 1200 px en Storage), condiciones de mayor y compatibilidad (con importación Excel).
  En la lista: filtro "Publicados", insignia "Web" y aviso de publicados sin imagen o sin categoría.
- Menú **Tienda web** (administrador y supervisor): **Categorías** y **Vehículos** (marcas, modelos, importación de
  marcas/modelos y de compatibilidades por código de producto).
- El POS y el inventario muestran la imagen de Storage cuando existe.
- `scripts/migrate-images-to-storage.mjs` (`npm run migrate:images -- --dry-run`): base64 de `inventory.image` → bucket.

**Pruebas**: `npm run test:sql` corre las migraciones y `supabase/tests/*.test.sql` en un Postgres en memoria
(PGlite) con `id` uuid, bigint y text.

## Decisiones y desviaciones de la spec
- `maxDiscountPct` y `minMarginPct` globales van en `settings.tienda_privada`, no en `tienda_publica`
  (la spec 6.5 los ponía en la pública). También `pricesIncludeIva` y `facturaFiscal`.
- `tienda_publica` agrega `igtfMethods` (en qué métodos se cobra IGTF; por defecto zelle, binance y efectivo).
- `catalog_products` agrega `featured`, `createdAt` (fecha de publicación), `categoryIcon` y `wholesaleEnabled`
  (contrato de la tienda en `valkarweb/INSTRUCCIONES-AGENTE-ERP.md`). Si un producto no tiene imágenes en Storage pero
  su `image` es una URL http, la vista la usa.
- `products_for_vehicle` devuelve `{ compatible, universal }` como espera la tienda; "universal" son los productos de
  categorías marcadas `isUniversal` sin compatibilidad cargada.
- Configuración de la tienda arranca **cerrada** (`storeOpen: false`) hasta cargar datos de pago reales.
- El ERP oculta la pestaña Tienda web si las migraciones no están aplicadas, así el ERP sigue funcionando.

## Orden de aplicación (staging primero)
1. Fase 0 aplicada.
2. `supabase/manual/verify-schema.sql` en el SQL editor (o el dump) y revisa los tipos de `id`.
3. `npx supabase db push` (o pega 0003 → 0007 en orden).
4. Despliega el ERP. Configuración > Tienda web: carga datos y guarda.
5. `npm run migrate:images -- --dry-run`, luego sin `--dry-run`.

## Prueba a mano
- Publicar un producto con categoría, specs, 2 imágenes y 2 vehículos; reabrirlo y ver todo igual.
- Con la llave anon: `select * from catalog_products` lo devuelve sin `costPrice` ni `quantity`;
  `select * from inventory` devuelve 0 filas; `select * from settings` solo `exchange_rates` y `tienda_publica`.
- `select products_for_vehicle('<id del modelo>', 2015)` lo lista en `compatible`.
- Importar un Excel de compatibilidades con un código inexistente: lo informa y sigue con las demás filas.
- Supervisor ve el menú Tienda web pero no Configuración; cajero no ve ninguno.

## Pendiente
- Probar las migraciones contra el esquema real de staging (aquí se probaron con un stub).
- Las imágenes subidas en un formulario que luego se cancela quedan en el bucket sin usar.
