# Fase 0: seguridad del ERP

El código de la fase 0 ya está en `main` (commit c75c2d4). La rama `seguridad/auth-rls` trae la revisión:
- `0002_erp_rls.sql` ahora borra **toda** política previa de las tablas del ERP, no solo las de `anon`/`public`.
  Una política vieja `to authenticated using (true)` habría dejado a los clientes de la tienda (que también
  inician sesión) leer costos, clientes y finanzas.
- `supabase/manual/verify-schema.sql`: consultas de solo lectura que reemplazan al dump si no puedes hacerlo
  (tipos de `id`, columnas, RLS y políticas actuales, facturas duplicadas, extensiones).
- Las migraciones 0001, 0002 y 0002a se probaron en un Postgres en memoria con `id` uuid, bigint y text:
  anon y un cliente autenticado no ven `inventory` ni `clients`; el personal factura; sin stock falla.
  Falta probarlas contra el esquema real de staging.

## Qué incluye
- `supabase/migrations/0001_staff_auth.sql`: `staff_profiles`, `staff_role()`, `is_staff()`, `is_admin()`.
- `supabase/migrations/0002_erp_rls.sql`: RLS "staff full" en todas las tablas; borra políticas permisivas de anon; lectura pública solo de `settings` (`exchange_rates`, `tienda_publica`).
- `supabase/migrations/0002a_erp_create_invoice.sql`: `erp_create_invoice(payload jsonb)`, `invoice_seq`, índice único del número de factura.
- `scripts/migrate-staff-users.mjs`: usuarios -> Supabase Auth + `staff_profiles` (una sola vez).
- `supabase/manual/after-migrate-drop-password.sql`: elimina `users.password` (a mano, al final).
- `supabase/functions/staff-user`: crear, editar y eliminar personal (solo administrador).
- `src/auth/*`, `Login.jsx`, `App.jsx`: login con `signInWithPassword`; el rol sale de `staff_profiles`; sin `localStorage`.
- POS (`createClientInvoice`) usa la RPC atómica.
- Firebase fuera (dependencia y archivos vaciados).

## Orden de aplicación (staging primero)
1. `npx supabase db dump --db-url "<conexión>" --schema public -f erp_schema.sql` (o ejecuta `supabase/manual/verify-schema.sql` en el SQL editor) y confirma: tipo de `id` en `inventory`, `clients`, `client_invoices`; si `sellingPrice` incluye IVA; RLS actual. Las migraciones 0001–0002a no dependen del tipo de `id`.
2. `npx supabase db push` (o pega 0001, 0002, 0002a en el SQL editor, en ese orden).
   Desde este momento el ERP viejo deja de leer datos hasta tener usuarios en Auth: hazlo sin ventas en curso.
3. `npx supabase functions deploy staff-user`.
4. `node scripts/migrate-staff-users.mjs --dry-run`, luego sin `--dry-run`. Guarda las contraseñas temporales que imprima.
5. `npm install` (actualiza el lockfile sin firebase), `npm run dev`, prueba los tres roles.
6. Cuando todos entren bien: ejecuta `supabase/manual/after-migrate-drop-password.sql`.
7. `git rm src/firebase.js firestore.rules`. Rota las llaves de Firebase que estuvieron en el repo.
8. Pide a cada usuario cambiar su contraseña.

## Prueba a mano
- Sin sesión, con la llave anon: `select` sobre `inventory`, `clients`, `users` devuelve 0 filas o error.
- Editar `localStorage` (`userRole`, `isAuthenticated`) no da acceso.
- Administrador: Configuración > Usuarios (crear, cambiar rol, cambiar clave, eliminar). No deja eliminar al último administrador ni a uno mismo.
- Supervisor: ve Resumen, Inventario, Compras, Ventas, Finanzas; no ve Configuración ni Ajustes.
- Cajero: solo POS.
- POS: venta de contado (descuenta stock, kardex SALIDA, `transactions`), venta a crédito (sin `transactions`), venta sin stock suficiente (error claro, nada se descuenta), dos ventas simultáneas de la última unidad (una falla).
- Tiempo real (Realtime) sigue actualizando listas.

## Corrección posterior: 0002b
La base de producción no tenía `inventory."productType"`, que usan el ERP (Inventario, POS), `erp_create_invoice`, `price_quote`
y las vistas del catálogo. Sin ella fallaba `0007` (`42703: column i.productType does not exist`) y el POS no podía facturar
(`record "v_prod" has no field "productType"`). `0002b_inventory_product_type.sql` la agrega con valor `product` para lo existente.
Aplícala antes de la 0007. El entorno de pruebas ahora crea `inventory` sin esa columna, igual que producción.

## Desviaciones de la spec
- La Edge Function se llama `staff-user` y cubre crear, editar y eliminar (la spec solo nombra `staff-create-user`), porque Configuración también edita y elimina.
- `erp_create_invoice` rechaza ventas sin stock suficiente (antes el ERP dejaba el stock en 0 sin avisar) y no descuenta stock de servicios.
- El POS confía en precios y totales del payload (solo personal autenticado puede llamarla); la tienda no la usará directo: `staff_confirm_order` la llamará con precios del pedido.
- `staff_profiles` queda con política de administrador completa además de la Edge Function.
