# Fase 0: seguridad del ERP

Rama sugerida: `git switch -c seguridad/auth-rls` (antes de commitear estos cambios).

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
1. `npx supabase db dump --db-url "<conexión>" --schema public -f erp_schema.sql` y confirma: tipo de `id` en `inventory`, `clients`, `client_invoices`; si `sellingPrice` incluye IVA; RLS actual. Ajusta los SQL si hace falta.
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

## Desviaciones de la spec
- La Edge Function se llama `staff-user` y cubre crear, editar y eliminar (la spec solo nombra `staff-create-user`), porque Configuración también edita y elimina.
- `erp_create_invoice` rechaza ventas sin stock suficiente (antes el ERP dejaba el stock en 0 sin avisar) y no descuenta stock de servicios.
- El POS confía en precios y totales del payload (solo personal autenticado puede llamarla); la tienda no la usará directo: `staff_confirm_order` la llamará con precios del pedido.
- `staff_profiles` queda con política de administrador completa además de la Edge Function.
