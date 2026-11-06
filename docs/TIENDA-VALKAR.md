# Tienda en línea Valkar — Especificación e instrucciones de implementación

**Proyecto:** tienda web de Valkar C.A. (lubricantes y repuestos, Maracaibo), construida dentro del repo del ERP `analispagos` y sobre la misma base Supabase.
**Fecha:** 5 de noviembre de 2026 · **Estado:** listo para implementar por fases.
**Cómo usar este documento:** cópialo al repo del ERP en `docs/TIENDA-VALKAR.md` junto con `Valkar-BrandBook.pdf` y los archivos del logo. Ejecuta las fases en orden (sección 12). Cada fase trae criterios de aceptación y un prompt sugerido para Claude Code.

---

## 0. Resumen de decisiones

| Tema | Decisión |
|---|---|
| Dónde vive | En el mismo repo del ERP, pero como una **segunda app** (`store/`) y un **segundo proyecto en Vercel** con su propio dominio. Comparte la base Supabase y el código común. |
| Fuente de verdad | El ERP: productos, stock, precios, clientes, facturación y estados. La tienda no tiene un panel de administración propio; todo se gestiona desde el ERP. |
| Clientes | Hay que registrarse e iniciar sesión para comprar. Ver el catálogo es público. |
| Detal / mayor | Detal: precio `sellingPrice`. Mayor: el cliente se registra con RIF, el ERP lo aprueba y a partir de ahí se le aplican **reglas de descuento** (por cantidad, forma de pago, días de crédito, categoría y cliente). |
| Moneda | Precios en USD con su equivalente en Bs a tasa BCV (`settings.exchange_rates.bcv`). La tasa queda congelada en cada pedido. |
| Pagos | Pago Móvil, transferencia en Bs, Zelle, Binance (el cliente sube el comprobante y el ERP lo verifica), efectivo en tienda o contra entrega, y crédito (solo mayoristas aprobados). |
| Entrega | Retiro en tienda, delivery en Maracaibo (por zonas) y envío nacional por encomienda. |
| Stock | Al pedir se **reserva** por 24 h. Al confirmar en el ERP se **factura y se descuenta** con kardex. Si el pedido expira o se cancela, se libera la reserva. |
| Búsqueda | Por vehículo (marca, modelo, año) y también por categoría, marca, viscosidad o referencia, más búsqueda de texto. |
| Seguridad | **Requisito previo:** antes de publicar la tienda hay que migrar el ERP a Supabase Auth y activar RLS (fase 0). |

---

## 1. Diagnóstico del ERP actual (lo que hay que tener en cuenta)

Revisión del repo `omarapp19/analispagos`:

- **Stack:** React 19, Vite, Tailwind v4, react-router 7 y PWA. Todo el acceso a datos es **desde el navegador** con `@supabase/supabase-js` y la llave **anon** (`src/supabase.js`, `src/services/api.js`).
- **Tablas que usa:** `inventory`, `clients`, `client_invoices`, `kardex`, `transactions`, `bills`, `providers`, `investments`, `recurring_expenses`, `users` y `settings` (`global_settings`, `exchange_rates`).
- **Columnas en camelCase** con comillas (`"costPrice"`, `"createdAt"`, `"clientId"`). Las tablas y columnas nuevas deben seguir la misma convención.
- `inventory` tiene `code`, `name`, `brand`, `description`, `quantity`, `costPrice`, `marginPercentage`, `sellingPrice`, `taxPercentage`, `unitsPerPackage`, `productType` (`product` | `service`) e `image` (URL **o base64 dentro de la fila**).
- **La venta** (`createClientInvoice`) descuenta el stock, registra el kardex `SALIDA`, inserta en `client_invoices` (`items` en JSON, `isCredit`, `creditDays`, `status`, `paymentMethod`) y, si es de contado, inserta un `INCOME` en `transactions`. Son **varias llamadas sueltas desde el navegador, sin transacción**. El número de factura es aleatorio (`FAC-####`) y puede repetirse.
- **La tasa BCV** se lee de DolarAPI y se guarda en `settings` con id `exchange_rates` (`{ bcv, ... }`).

### Problemas de seguridad (críticos)

1. **El login es propio y las contraseñas están en texto plano.** `Login.jsx` lee la tabla `users` y compara `user.password === password` en el navegador.
2. **La sesión y el rol viven en `localStorage`** (`isAuthenticated`, `userRole`). Cualquiera puede escribir `localStorage.userRole = 'administrador'` y entrar a todo.
3. **La base está abierta a la llave anon.** Para que lo anterior funcione, RLS está desactivado o con políticas permisivas. Cualquiera que saque la llave del JS del ERP puede leer contraseñas, costos, clientes y finanzas, o modificar y borrar datos.
4. Quedan restos de Firebase (`src/firebase.js` con la config en el código y `firestore.rules` con `allow read, write: if true`).

**Consecuencia:** no se puede publicar una tienda sobre esta base sin cerrarla primero. La fase 0 lo resuelve.

### Cosas a verificar con el esquema real antes de escribir SQL

Ejecuta `npx supabase db dump --db-url "<cadena de conexión>" --schema public -f erp_schema.sql` y confirma:

- El **tipo de `id`** de `inventory`, `clients` y `client_invoices` (uuid, bigint o text). El SQL de este documento asume `uuid`; cámbialo si es otro.
- Si `sellingPrice` **incluye IVA** o no. El documento asume que `sellingPrice` es el precio final al público.
- El estado actual de RLS: `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';`

---

## 2. Arquitectura

```
analispagos/                    (mismo repo)
├─ src/                         ERP actual (staff)            → Vercel proyecto "valkar-erp"
├─ store/                       Tienda pública (clientes)     → Vercel proyecto "valkar-tienda"
│  ├─ index.html
│  ├─ vite.config.js            (root: store/, alias @shared)
│  └─ src/ ...
├─ shared/                      Código común
│  ├─ supabase.js               cliente único (anon key + sesión Auth)
│  ├─ money.js                  formatUSD, formatBs, usdToBs
│  └─ useExchangeRates.js
├─ supabase/
│  ├─ migrations/               SQL versionado (fases 0–3)
│  └─ seed.sql                  datos de prueba para staging
└─ scripts/
   └─ migrate-staff-users.mjs   migración de usuarios a Supabase Auth (una sola vez)
```

**Por qué una segunda app y no rutas dentro del ERP:**
- El JS del ERP (pantallas de costos, finanzas, etc.) **no se envía** a los clientes.
- La tienda tiene su propio dominio, por ejemplo `valkar.com.ve` / `tienda.valkar…`, y el ERP sigue en el suyo.
- La tienda puede tener su propio diseño, siguiendo el manual de marca, sin heredar los estilos del ERP.
- En Vercel: proyecto 2 con *Root Directory* = repo raíz, *Build Command* `vite build --config store/vite.config.js` y *Output* `store/dist`.

**Modelo de seguridad (sin servidor propio):** las dos apps usan la llave **anon** más la **sesión de Supabase Auth**. Toda la protección está en la base:
- **RLS** en todas las tablas.
- **Vistas públicas** sin columnas sensibles (nunca `costPrice` ni `marginPercentage`).
- **Funciones RPC `security definer`** para todo lo que calcula precios o mueve stock. El navegador **nunca** envía precios: el servidor los calcula.
- La `service_role key` **jamás** va al front. Solo se usa en scripts locales o en funciones de servidor.

**SEO:** la tienda es una SPA. Para que Google indexe los productos, en la fase 5 se puede añadir prerender de las páginas de producto o generar `sitemap.xml` desde la base. Si más adelante el SEO se vuelve prioritario, la tienda se puede migrar a Next.js sin tocar la base.

---

## 3. Fase 0 — Seguridad del ERP (requisito previo)

> Hazla primero en un proyecto Supabase **de staging** con una copia del esquema y datos de prueba. Al pasar a producción, aplícala en un horario sin ventas: el ERP deja de funcionar hasta desplegar el nuevo login.

### 3.1 Perfiles del personal

```sql
-- supabase/migrations/0001_staff_auth.sql
create table public.staff_profiles (
  "userId"    uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  name        text not null,
  role        text not null check (role in ('administrador','supervisor','cajero')),
  active      boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from staff_profiles where "userId" = auth.uid() and active
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_profiles where "userId" = auth.uid() and active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(staff_role() in ('administrador','supervisor'), false)
$$;

alter table public.staff_profiles enable row level security;
create policy "staff lee su perfil" on staff_profiles for select using ("userId" = auth.uid() or is_admin());
create policy "admin gestiona personal" on staff_profiles for all using (staff_role() = 'administrador') with check (staff_role() = 'administrador');
```

### 3.2 Migrar los usuarios actuales (script de una sola vez)

`scripts/migrate-staff-users.mjs` (se ejecuta en tu PC con `SUPABASE_SERVICE_ROLE_KEY` en el entorno; nunca se sube al repo):
1. Leer todas las filas de `users`.
2. Por cada una, `supabase.auth.admin.createUser({ email: \`${username}@staff.valkar.local\`, password, email_confirm: true })`. Supabase guarda la contraseña **cifrada**.
3. Insertar en `staff_profiles` (`userId`, `username`, `name`, `role`).
4. Verificar que todos inician sesión y luego: `alter table users drop column password;` (o `drop table users;` si ya no se usa).
5. Pedir a cada usuario que cambie su contraseña; las actuales estuvieron expuestas.

### 3.3 Login del ERP

- `Login.jsx`: el usuario escribe su **username** y la app llama a `supabase.auth.signInWithPassword({ email: \`${username}@staff.valkar.local\`, password })`. Después lee el rol con `select role from staff_profiles where "userId" = auth.uid()`.
- Quitar `isAuthenticated` y `userRole` de `localStorage`. La sesión la maneja Supabase (`onAuthStateChange`) y el rol sale de `staff_profiles` y se guarda en un contexto de React.
- `RoleProtectedRoute` lee el rol de ese contexto. Además, la base valida con RLS: aunque alguien altere el front, no obtiene datos.
- La pantalla de usuarios (`Configuration.jsx`) crea usuarios nuevos llamando a una **Edge Function** `staff-create-user`, que usa la service role y verifica que quien la llama sea administrador.
- Eliminar `src/firebase.js`, `firestore.rules` y la dependencia `firebase`.

### 3.4 Activar RLS en todas las tablas del ERP

```sql
-- supabase/migrations/0002_erp_rls.sql
do $$
declare t text;
begin
  foreach t in array array['inventory','clients','client_invoices','kardex','transactions','bills',
                           'providers','investments','recurring_expenses','settings','users']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "staff full" on public.%I', t);
    execute format('create policy "staff full" on public.%I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

-- Lectura pública mínima de settings (tasa y datos de la tienda)
create policy "publico lee tasa y tienda" on settings for select to anon, authenticated
  using (id in ('exchange_rates','tienda_publica'));
```

Más adelante se pueden afinar permisos por rol (por ejemplo, que el cajero no lea `bills` ni `investments`) usando `staff_role()`.

**Realtime:** las suscripciones del ERP (`subscribeToTable`) siguen funcionando porque Realtime respeta RLS y el personal estará autenticado.

### 3.5 Venta atómica (recomendado)

Mover la lógica de `createClientInvoice` a una función SQL `erp_create_invoice(payload jsonb)` que en **una transacción** haga: bloqueo de filas de `inventory` (`for update`), verificación de stock, descuento, kardex, factura y `transactions`. Usar una **secuencia** para el número de factura:

```sql
create sequence if not exists invoice_seq start 1000;
-- invoiceNumber := 'FAC-' || lpad(nextval('invoice_seq')::text, 6, '0');
```

El POS del ERP y la confirmación de pedidos web (sección 6) llamarán a esta misma función, así no hay dos lógicas de venta distintas.

**Criterios de aceptación fase 0**
- [ ] Con la llave anon y sin sesión, `select * from inventory` / `clients` / `users` devuelve 0 filas o un error.
- [ ] El ERP funciona igual para los tres roles después de iniciar sesión.
- [ ] Ya no hay contraseñas en ninguna tabla de `public`.
- [ ] Cambiar `localStorage` no da acceso a nada.

---

## 4. Modelo de datos de la tienda

### 4.1 Campos nuevos en `inventory`

```sql
-- supabase/migrations/0003_store_catalog.sql
alter table inventory
  add column if not exists "webPublished"     boolean not null default false,
  add column if not exists slug               text unique,
  add column if not exists "categoryId"       uuid,
  add column if not exists "webDescription"   text,
  add column if not exists reference          text,          -- referencia del fabricante / OEM
  add column if not exists specs              jsonb not null default '{}'::jsonb,
      -- ej. {"viscosidad":"10W-40","norma":"API SN","capacidad":"1 L","tipo":"Mineral"}
  add column if not exists images             text[] not null default '{}',  -- rutas en Storage
  add column if not exists "wholesaleEnabled" boolean not null default true,
  add column if not exists "minWholesaleQty"  int not null default 1,
  add column if not exists "maxDiscountPct"   numeric(5,2),  -- tope de descuento mayor (null = usar global)
  add column if not exists "minMarginPct"     numeric(5,2);  -- margen mínimo sobre costo (null = usar global)
```

### 4.2 Categorías y vehículos

```sql
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  "parentId"  uuid references categories(id),
  icon        text,             -- aceite | filtro | bujia | bateria | frenos | ...
  "sortOrder" int not null default 0
);
alter table inventory add constraint inventory_category_fk foreign key ("categoryId") references categories(id);

create table vehicle_makes  (id uuid primary key default gen_random_uuid(), name text unique not null);
create table vehicle_models (
  id       uuid primary key default gen_random_uuid(),
  "makeId" uuid not null references vehicle_makes(id) on delete cascade,
  name     text not null,
  unique ("makeId", name)
);
create table product_fitments (           -- compatibilidad producto ↔ vehículo
  id          uuid primary key default gen_random_uuid(),
  "productId" uuid not null references inventory(id) on delete cascade,
  "modelId"   uuid not null references vehicle_models(id) on delete cascade,
  "yearFrom"  int,
  "yearTo"    int,
  engine      text,                        -- ej. "1.6 16V", opcional
  notes       text
);
create index on product_fitments ("modelId");
create index on product_fitments ("productId");
```

Categorías iniciales sugeridas: Aceites de motor, Aceites de caja y transmisión, Refrigerantes y aditivos, Grasas, Filtros (aceite, aire, combustible, A/C), Frenos, Encendido (bujías, bobinas), Baterías, Correas y mangueras, Suspensión, Accesorios.

### 4.3 Clientes de la tienda

```sql
-- supabase/migrations/0004_store_customers.sql
create table web_customers (
  "userId"            uuid primary key references auth.users(id) on delete cascade,
  "clientId"          uuid not null references clients(id),   -- enlace al cliente del ERP
  "customerType"      text not null default 'detal' check ("customerType" in ('detal','mayor')),
  "wholesaleStatus"   text not null default 'none'
                      check ("wholesaleStatus" in ('none','pending','approved','rejected')),
  "businessName"      text,     -- razón social (mayor)
  rif                 text,
  "rifDocument"       text,     -- ruta en Storage del RIF escaneado (opcional)
  "creditLimitUsd"    numeric(12,2) not null default 0,
  "maxCreditDays"     int not null default 0,
  "specialDiscountPct" numeric(5,2) not null default 0,
  "approvedBy"        uuid references auth.users(id),
  "approvedAt"        timestamptz,
  "createdAt"         timestamptz not null default now()
);

create table web_addresses (
  id          uuid primary key default gen_random_uuid(),
  "userId"    uuid not null references auth.users(id) on delete cascade,
  label       text,                 -- "Casa", "Taller"
  "fullName"  text not null,
  phone       text not null,
  state       text not null,        -- estado
  city        text not null,
  line1       text not null,
  reference   text,
  "isDefault" boolean not null default false
);
```

**Registro:** `supabase.auth.signUp` (correo y contraseña) seguido de la RPC `register_customer(...)`, que:
- busca en `clients` por `documentId` (cédula o RIF normalizado, ej. `V12345678` / `J294267319`). Si existe lo enlaza; si no, lo crea;
- crea `web_customers`. Si la persona eligió "Soy mayorista": `customerType = 'mayor'` y `wholesaleStatus = 'pending'`.

Mientras su solicitud esté en `pending`, el mayorista compra a precio de detal y ve un aviso de "solicitud en revisión".

### 4.4 Reglas de precio mayorista

```sql
-- supabase/migrations/0005_pricing.sql
create table pricing_rules (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                 -- "Contado", "Zelle", "Caja de 12", ...
  kind           text not null check (kind in ('quantity','payment_method','credit_days','category','customer')),
  "discountPct"  numeric(5,2) not null check ("discountPct" between -100 and 100),
       -- negativo = recargo (ej. crédito a 45 días +2 %)
  "productId"    uuid references inventory(id) on delete cascade,  -- null = todos
  "categoryId"   uuid references categories(id),                  -- null = todas
  "clientId"     uuid references clients(id),                     -- solo para kind = 'customer'
  "minQty"       int,                                             -- kind = 'quantity'
  "paymentMethod" text,                                           -- kind = 'payment_method'
  "creditDays"   int,                                             -- kind = 'credit_days'
  "appliesTo"    text not null default 'mayor' check ("appliesTo" in ('mayor','todos')),
  active         boolean not null default true,
  "startsAt"     timestamptz,
  "endsAt"       timestamptz,
  "createdAt"    timestamptz not null default now()
);
```

**Algoritmo** (función `price_quote`, sección 5). Para cada línea del carrito:

1. `base = inventory.sellingPrice`.
2. Si el cliente no es mayorista aprobado, solo aplican las reglas con `appliesTo = 'todos'` (promociones de detal).
3. Se filtran las reglas activas y vigentes cuyo alcance coincide: producto, o categoría, o global (`productId` y `categoryId` nulos).
4. **Dentro de cada `kind` se toma una sola regla, la más específica** (primero la de producto, luego la de categoría, luego la global). Si hay empate, la de mayor descuento.
   - `quantity`: la de mayor `minQty` que sea ≤ cantidad de la línea.
   - `payment_method`: la que coincide con el método elegido.
   - `credit_days`: la que coincide con el plazo elegido (0 = contado).
   - `customer`: la del cliente (o `web_customers.specialDiscountPct`).
5. **Se suman** los descuentos de los distintos `kind`: `pct = Σ`.
6. **Tope:** `pct = min(pct, coalesce(producto.maxDiscountPct, global.maxDiscountPct))`.
7. **Piso de margen:** `precio = max(base × (1 − pct/100), costPrice × (1 + coalesce(producto.minMarginPct, global.minMarginPct)/100))`.
8. Redondear a 2 decimales. Se devuelve el desglose (qué reglas aplicaron) para mostrarlo en el carrito.

Ejemplo de configuración inicial (la ajustas en el ERP):

| Regla | kind | Alcance | Condición | Desc. |
|---|---|---|---|---|
| Mayor base | customer | todos los mayoristas | — | 5 % |
| Caja 12 | quantity | Aceites | minQty 12 | 4 % |
| Caja 48 | quantity | Aceites | minQty 48 | 8 % |
| Contado | credit_days | global | 0 días | 3 % |
| Crédito 15 | credit_days | global | 15 días | 0 % |
| Crédito 30 | credit_days | global | 30 días | −2 % |
| Divisas | payment_method | global | zelle / binance / efectivo | 3 % |

Valores globales en `settings.tienda_publica`: `maxDiscountPct` (ej. 20) y `minMarginPct` (ej. 8).

**Crédito:** solo para mayoristas aprobados con `maxCreditDays > 0`. Al pedir a crédito se valida `saldo pendiente en client_invoices (isCredit, status PENDING) + total ≤ creditLimitUsd`.

> **IGTF:** confirma con tu contador si debes cobrar el IGTF (3 %) en pagos en divisas. Si aplica, agrégalo como línea aparte en el total para `zelle`, `binance` y `efectivo` USD, configurable en `settings.tienda_publica.igtfPct`.

### 4.5 Pedidos web

```sql
-- supabase/migrations/0006_orders.sql
create sequence web_order_seq start 1;

create table web_orders (
  id               uuid primary key default gen_random_uuid(),
  number           text unique not null default ('WEB-' || lpad(nextval('web_order_seq')::text, 6, '0')),
  "userId"         uuid not null references auth.users(id),
  "clientId"       uuid not null references clients(id),
  "customerType"   text not null,                       -- detal | mayor (en el momento del pedido)
  status           text not null default 'PENDIENTE_PAGO',
  "paymentMethod"  text not null check ("paymentMethod" in
                   ('pago_movil','transferencia','zelle','binance','efectivo','credito')),
  "creditDays"     int not null default 0,
  "deliveryMethod" text not null check ("deliveryMethod" in ('retiro','delivery','envio_nacional')),
  "deliveryZone"   text,
  "deliveryAddress" jsonb,                              -- copia de la dirección
  carrier          text,                                -- MRW | Zoom | Tealca (envío nacional)
  "trackingNumber" text,
  "subtotalUsd"    numeric(12,2) not null,
  "discountUsd"    numeric(12,2) not null default 0,
  "deliveryFeeUsd" numeric(12,2) not null default 0,
  "taxUsd"         numeric(12,2) not null default 0,
  "totalUsd"       numeric(12,2) not null,
  "bcvRate"        numeric(14,4) not null,              -- tasa congelada
  "totalBs"        numeric(16,2) not null,
  notes            text,
  "invoiceId"      uuid references client_invoices(id), -- se llena al facturar
  "reservedUntil"  timestamptz,
  "staffNotes"     text,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);

create table web_order_items (
  id              uuid primary key default gen_random_uuid(),
  "orderId"       uuid not null references web_orders(id) on delete cascade,
  "productId"     uuid not null references inventory(id),
  "productName"   text not null,
  code            text,
  quantity        int not null check (quantity > 0),
  "unitBaseUsd"   numeric(12,2) not null,
  "discountPct"   numeric(5,2) not null default 0,
  "unitPriceUsd"  numeric(12,2) not null,
  "lineTotalUsd"  numeric(12,2) not null,
  "appliedRules"  jsonb not null default '[]'::jsonb
);

create table web_payment_reports (           -- comprobantes
  id            uuid primary key default gen_random_uuid(),
  "orderId"     uuid not null references web_orders(id) on delete cascade,
  method        text not null,
  "amount"      numeric(16,2) not null,
  currency      text not null check (currency in ('USD','VES')),
  reference     text not null,                 -- nro. de referencia / id de transacción
  "paidAt"      date not null,
  "bankFrom"    text,
  "proofPath"   text,                          -- ruta en bucket privado payment-proofs
  status        text not null default 'pendiente' check (status in ('pendiente','aprobado','rechazado')),
  "reviewedBy"  uuid references auth.users(id),
  "reviewNote"  text,
  "createdAt"   timestamptz not null default now()
);

create table web_order_events (              -- historial visible para el cliente
  id          bigint generated always as identity primary key,
  "orderId"   uuid not null references web_orders(id) on delete cascade,
  status      text not null,
  note        text,
  "byStaff"   boolean not null default false,
  "createdAt" timestamptz not null default now()
);

create table stock_reservations (
  id          uuid primary key default gen_random_uuid(),
  "orderId"   uuid not null references web_orders(id) on delete cascade,
  "productId" uuid not null references inventory(id),
  quantity    int not null,
  "expiresAt" timestamptz not null,
  released    boolean not null default false
);
create index on stock_reservations ("productId") where not released;
```

### 4.6 Estados del pedido

```
                ┌──────────── (cliente reporta pago) ───────────┐
PENDIENTE_PAGO ─┤                                               ▼
   │            └─ efectivo / crédito ─► POR_CONFIRMAR      PAGO_REPORTADO
   │                                       │                 │      │
   │ (24 h sin pago)                       │   (ERP aprueba) │      │ (ERP rechaza)
   ▼                                       ▼                 ▼      ▼
EXPIRADO                                CONFIRMADO ◄─────────┘   PENDIENTE_PAGO (con nota)
                                           │  ← aquí se factura y se descuenta el stock
                                           ▼
                                       PREPARANDO
                                     ┌─────┴──────┬────────────────┐
                                     ▼            ▼                ▼
                              LISTO_RETIRO   EN_CAMINO (delivery)  ENVIADO (+ guía)
                                     └─────┬──────┴────────────────┘
                                           ▼
                                       ENTREGADO
Desde cualquier estado previo a CONFIRMADO → CANCELADO (por el cliente o el ERP).
```

- **Efectivo:** el pedido queda `POR_CONFIRMAR`. El ERP lo confirma cuando el cliente paga al retirar o al recibir. Para que no se pierda stock, la reserva de efectivo dura 48 h.
- **Crédito:** el pedido queda `POR_CONFIRMAR`. El ERP revisa el límite y confirma; la factura se crea con `isCredit = true` y `creditDays`.
- **Pago parcial:** si el monto reportado es menor al total, el ERP puede rechazar con la nota "falta X". El cliente reporta otro pago; la suma de los pagos aprobados debe cubrir el total.

---

## 5. Funciones RPC (la lógica de negocio vive en la base)

Todas son `security definer`, con `set search_path = public`. Las del cliente validan `auth.uid()` y las del personal validan `is_staff()`.

| Función | Quién | Qué hace |
|---|---|---|
| `register_customer(full_name, document_id, phone, wants_wholesale, business_name, rif)` | cliente | Crea o enlaza `clients` y crea `web_customers`. |
| `price_quote(items jsonb, payment_method, credit_days, delivery_method, delivery_zone)` | cliente o anon | Devuelve las líneas con precio calculado, el desglose de reglas, subtotal, descuento, envío, IGTF, total en USD y Bs, la disponibilidad por producto y los errores (sin stock, mínimo de mayor, crédito no permitido). Sin sesión aplica precio de detal. **No escribe nada.** |
| `place_order(items, payment_method, credit_days, delivery_method, delivery_zone, address_id, notes)` | cliente | Vuelve a ejecutar `price_quote` (nunca confía en precios del navegador), bloquea con `for update` las filas de `inventory`, verifica `disponible = quantity − reservas activas`, crea `web_orders`, `web_order_items`, `stock_reservations` y el evento inicial, y devuelve el número de pedido y los datos de pago. |
| `report_payment(order_id, method, amount, currency, reference, paid_at, bank_from, proof_path)` | cliente | Solo si el pedido es suyo y está en `PENDIENTE_PAGO`. Inserta el reporte y pasa el pedido a `PAGO_REPORTADO`. |
| `cancel_my_order(order_id)` | cliente | Solo antes de `CONFIRMADO`. Libera las reservas. |
| `staff_review_payment(report_id, approve bool, note)` | personal | Aprueba o rechaza el pago. Si los pagos aprobados cubren el total, llama a `staff_confirm_order`. |
| `staff_confirm_order(order_id)` | personal | **En una transacción:** llama a `erp_create_invoice` con los ítems y precios del pedido (descuenta stock, kardex `SALIDA` con concepto `Venta web WEB-000123`, crea `client_invoices`, `transactions` si es de contado), marca las reservas como `released`, guarda `invoiceId` y pasa a `CONFIRMADO`. |
| `staff_set_order_status(order_id, status, note, tracking)` | personal | Valida las transiciones permitidas (4.6) e inserta un `web_order_events`. |
| `staff_review_wholesale(user_id, approve, credit_limit, max_credit_days, special_discount_pct, note)` | personal (admin) | Aprueba o rechaza mayoristas. |
| `expire_reservations()` | cron | Cada 15 min: pedidos `PENDIENTE_PAGO` / `POR_CONFIRMAR` vencidos → `EXPIRADO` y libera las reservas. Se programa con `pg_cron`: `select cron.schedule('expire-web-orders','*/15 * * * *','select expire_reservations()');` |

**Disponibilidad pública:** `quantity − Σ reservas activas`. En la tienda no se muestra el número exacto, solo "Disponible", "Últimas unidades" (≤ 5) o "Agotado".

### 5.1 Vista pública del catálogo

```sql
create or replace view public.catalog_products with (security_invoker = false) as
select i.id, i.code, i.slug, i.name, i.brand, i.reference, i."webDescription" as description,
       i.specs, i.images, i."categoryId", c.slug as "categorySlug", c.name as "categoryName",
       i."sellingPrice" as "priceUsd", i."unitsPerPackage", i."minWholesaleQty",
       greatest(i.quantity - coalesce(r.reserved, 0), 0) as available
from inventory i
left join categories c on c.id = i."categoryId"
left join lateral (
  select sum(quantity) as reserved from stock_reservations
  where "productId" = i.id and not released and "expiresAt" > now()
) r on true
where i."webPublished" and i."productType" = 'product';

grant select on public.catalog_products to anon, authenticated;
```

La vista **no** expone `costPrice`, `marginPercentage` ni la columna `image` en base64. Las imágenes se migran a Storage (sección 7) y se guardan en `images`.

### 5.2 Políticas RLS de las tablas nuevas

```sql
alter table categories enable row level security;
alter table vehicle_makes enable row level security;
alter table vehicle_models enable row level security;
alter table product_fitments enable row level security;
create policy "lectura publica" on categories      for select to anon, authenticated using (true);
create policy "lectura publica" on vehicle_makes   for select to anon, authenticated using (true);
create policy "lectura publica" on vehicle_models  for select to anon, authenticated using (true);
create policy "lectura publica" on product_fitments for select to anon, authenticated using (true);
create policy "staff escribe" on categories      for all to authenticated using (is_staff()) with check (is_staff());
create policy "staff escribe" on vehicle_makes   for all to authenticated using (is_staff()) with check (is_staff());
create policy "staff escribe" on vehicle_models  for all to authenticated using (is_staff()) with check (is_staff());
create policy "staff escribe" on product_fitments for all to authenticated using (is_staff()) with check (is_staff());

alter table web_customers enable row level security;
create policy "cliente lee lo suyo" on web_customers for select using ("userId" = auth.uid() or is_staff());
create policy "staff gestiona"      on web_customers for update using (is_staff()) with check (is_staff());
-- inserción solo vía register_customer (security definer)

alter table web_addresses enable row level security;
create policy "cliente gestiona sus direcciones" on web_addresses for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy "staff lee direcciones" on web_addresses for select using (is_staff());

alter table web_orders enable row level security;
create policy "cliente lee sus pedidos" on web_orders for select using ("userId" = auth.uid() or is_staff());
-- escrituras solo vía RPC

alter table web_order_items enable row level security;
create policy "cliente lee items" on web_order_items for select using (
  is_staff() or exists (select 1 from web_orders o where o.id = "orderId" and o."userId" = auth.uid()));

alter table web_payment_reports enable row level security;
create policy "cliente lee sus pagos" on web_payment_reports for select using (
  is_staff() or exists (select 1 from web_orders o where o.id = "orderId" and o."userId" = auth.uid()));

alter table web_order_events enable row level security;
create policy "cliente lee eventos" on web_order_events for select using (
  is_staff() or exists (select 1 from web_orders o where o.id = "orderId" and o."userId" = auth.uid()));

alter table pricing_rules enable row level security;
create policy "solo staff" on pricing_rules for all using (is_staff()) with check (is_staff());

alter table stock_reservations enable row level security;
create policy "solo staff" on stock_reservations for select using (is_staff());
```

---

## 6. Cambios en el ERP (pantallas nuevas y modificadas)

Sigue el estilo actual del ERP (su `DESIGN.md` y sus componentes). Agrega al `Sidebar.jsx` un grupo **"Tienda web"**, visible para administrador y supervisor.

### 6.1 Inventario (modificar `Inventory.jsx`)
Añade una pestaña o sección **"Tienda web"** en el formulario del producto:
- Interruptor **Publicar en la web**. Al activarlo se genera el `slug` a partir del nombre y el código.
- Categoría (select de `categories`), referencia/OEM y descripción web.
- **Especificaciones:** pares clave/valor (viscosidad, norma API, capacidad, tipo, medida…).
- **Imágenes:** subir a Storage `product-images` (máx. 5, se convierten a WebP de 1200 px). Deja de usarse base64.
- **Mayor:** mínimo para mayor, tope de descuento y margen mínimo.
- **Compatibilidad:** tabla de marca → modelo → año desde/hasta → motor, con importación desde Excel (aprovechando el `xlsx` que ya tiene el proyecto).
- En la lista de inventario: columna o filtro "Publicado" y un aviso para los productos publicados **sin imagen o sin categoría**.

### 6.2 Pedidos web (nueva: `pages/WebOrders.jsx`)
- Lista en tiempo real (`subscribeToTable('web_orders')`) con pestañas por estado: *Por verificar pago* · *Por confirmar* · *Preparando* · *Listos/En camino* · *Entregados* · *Cancelados/Expirados*. Muestra un contador en el sidebar con los pendientes.
- Detalle: cliente (detal/mayor), ítems con el desglose de descuentos, totales en USD y Bs a la tasa congelada, dirección y método de entrega.
- **Comprobantes:** ver la imagen (URL firmada del bucket privado), monto, referencia y fecha, con los botones **Aprobar** y **Rechazar con motivo**.
- Botones según el estado (llaman a las RPC `staff_*`): Confirmar y facturar, Marcar preparando, Listo para retiro, En camino, Enviado (pide transportista y nro. de guía), Entregado, Cancelar.
- Al confirmar, se abre el ticket o factura del ERP que ya existe (`Billing.jsx` genera el comprobante).
- Botón **WhatsApp**: abre `https://wa.me/58XXXXXXXXXX?text=...` con un mensaje prellenado según el estado ("Tu pedido WEB-000123 está listo para retirar…").

### 6.3 Clientes mayoristas (nueva: `pages/WholesaleCustomers.jsx`)
- Solicitudes pendientes: datos, RIF y documento adjunto, con **Aprobar** (límite de crédito, días máximos, descuento especial) o **Rechazar**.
- Mayoristas activos: editar condiciones y ver su saldo a crédito (desde `client_invoices`).

### 6.4 Reglas de precio (nueva: `pages/PricingRules.jsx`)
- CRUD de `pricing_rules` agrupado por tipo, con fechas de vigencia y activar/desactivar.
- **Simulador:** eliges cliente, productos, cantidad, forma de pago y plazo, y ves el precio final con el desglose. Usa la misma RPC `price_quote` para que el resultado coincida exactamente con lo que verá el cliente.

### 6.5 Configuración de la tienda (en `Configuration.jsx`, guardada en `settings.tienda_publica`)
```json
{
  "storeOpen": true,
  "whatsapp": "+58 4XX XXX XXXX",
  "address": "…, Maracaibo, Zulia",
  "hours": "Lun–Vie 8:00–17:00 · Sáb 8:00–13:00",
  "payments": {
    "pago_movil":    { "enabled": true, "bank": "…", "phone": "…", "document": "J-29426731-9" },
    "transferencia": { "enabled": true, "bank": "…", "account": "…", "holder": "Valkar C.A.", "rif": "J-29426731-9" },
    "zelle":         { "enabled": true, "email": "…", "holder": "…" },
    "binance":       { "enabled": true, "payId": "…", "email": "…" },
    "efectivo":      { "enabled": true }
  },
  "delivery": {
    "retiro": { "enabled": true },
    "delivery": { "enabled": true, "zones": [ { "name": "Norte", "feeUsd": 3 }, { "name": "Centro", "feeUsd": 2 } ], "freeOverUsd": 80 },
    "envio_nacional": { "enabled": true, "carriers": ["MRW", "Zoom", "Tealca"], "mode": "cobro_destino" }
  },
  "creditDaysOptions": [0, 15, 30],
  "reservationHours": 24,
  "cashReservationHours": 48,
  "maxDiscountPct": 20,
  "minMarginPct": 8,
  "igtfPct": 0
}
```
⚠️ Como `tienda_publica` es legible por el público, **no** pongas ahí nada privado.

### 6.6 Vehículos (nueva: `pages/Vehicles.jsx`)
CRUD de marcas y modelos con importación desde Excel. Se puede precargar un listado de las marcas comunes en Venezuela: Toyota, Chevrolet, Ford, Mitsubishi, Hyundai, Kia, Renault, Fiat, Jeep, Nissan, Mazda, Chery, Volkswagen, Peugeot, Dodge, Honda…

---

## 7. Storage

| Bucket | Público | Reglas |
|---|---|---|
| `product-images` | Sí (solo lectura) | Solo `is_staff()` puede subir y borrar. |
| `payment-proofs` | No | El cliente sube a `"{auth.uid()}/{orderId}/…"` y solo lee su carpeta. El personal lee todo. Máx. 5 MB; tipos jpg, png, webp y pdf. |
| `customer-docs` | No | RIF de mayoristas, con las mismas reglas que `payment-proofs`. |

```sql
create policy "cliente sube comprobante" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cliente lee su comprobante" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or is_staff()));
create policy "staff gestiona imagenes" on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and is_staff()) with check (bucket_id = 'product-images' and is_staff());
```

**Migración de imágenes base64:** un script de una sola vez lee `inventory.image`. Si empieza con `data:`, lo sube a `product-images/{id}.webp`, guarda la ruta en `images` y deja `image` vacío. Así las consultas del inventario serán mucho más livianas.

---

## 8. La tienda (app `store/`)

### 8.1 Mapa del sitio

| Ruta | Contenido |
|---|---|
| `/` | Inicio: hero con el buscador por vehículo, categorías con sus iconos, productos destacados o nuevos ingresos, bloque "Precios al mayor" (CTA de registro mayorista), formas de pago y entrega, ubicación con horario y WhatsApp. |
| `/catalogo` | Grilla con filtros: categoría, marca, viscosidad (de `specs`), disponibilidad, vehículo (si hay uno elegido) y orden (relevancia, precio, nombre). Búsqueda por nombre, marca, código o referencia. Paginación de 24. |
| `/catalogo/:categoria` | Igual, con la categoría preseleccionada. |
| `/vehiculo/:marca/:modelo/:año` | Productos compatibles agrupados por categoría ("Para tu Corolla 2015"). |
| `/producto/:slug` | Galería, nombre, marca, referencia, especificaciones (la viscosidad grande en Barlow Condensed, como en la etiqueta del manual), precio USD + Bs, disponibilidad, compatibilidad, selector de cantidad (múltiplos de `unitsPerPackage` si aplica) y "Agregar". Para un mayorista aprobado: tabla de escalas de cantidad y el precio estimado según el pago o plazo elegido. |
| `/carrito` | Líneas y cantidades. El precio se recalcula con `price_quote` en cada cambio. El mayorista elige aquí la forma de pago y el plazo y ve el desglose en vivo. |
| `/checkout` | 1) Entrega (retiro / delivery con zona / envío nacional con estado, ciudad, transportista y agencia). 2) Pago (métodos habilitados; crédito solo para mayoristas aprobados). 3) Revisión y "Confirmar pedido" (`place_order`). |
| `/pedido/:numero` | Confirmación: número de pedido, total en USD y Bs, **datos de pago** del método elegido con botones de copiar, cuenta regresiva de la reserva, formulario **Reportar pago** con subida del comprobante y botón de WhatsApp. |
| `/cuenta` | Resumen, mis pedidos (con línea de tiempo de `web_order_events` en tiempo real), direcciones y datos. Estado de mayorista: solicitar, pendiente, aprobado (con límite y crédito disponible). |
| `/ingresar`, `/registro`, `/recuperar` | Supabase Auth con correo y contraseña. El registro pide nombre, cédula/RIF, teléfono y "Soy mayorista" (que despliega razón social, RIF y documento). |
| `/mayoristas` | Página informativa: beneficios, requisitos y CTA de registro. |
| `/nosotros`, `/contacto`, `/terminos`, `/privacidad` | Contenido institucional: misión, visión y origen de marca (VAL + KAR) del manual. |

### 8.2 Carrito y sesión
- El carrito se guarda en `localStorage` (solo ids y cantidades, **nunca precios**). Al iniciar sesión se mantiene.
- Los precios siempre vienen de `price_quote`. Si un producto se agota, el carrito lo marca y no deja continuar.
- Si `settings.tienda_publica.storeOpen = false`, se muestra un aviso y no se permite el checkout.

### 8.3 Buscador por vehículo
Tres selects encadenados (Marca → Modelo → Año). El vehículo elegido se guarda en `localStorage` y aparece como un chip "Mi vehículo: Toyota Corolla 2015 ✕" en el header y en el catálogo. Cuando hay un vehículo activo, cada tarjeta muestra **"Compatible ✓"** o se filtra.

Consulta (RPC `products_for_vehicle(model_id, year)`):
```sql
select p.* from catalog_products p
where exists (select 1 from product_fitments f
              where f."productId" = p.id and f."modelId" = $1
                and ($2 is null or ($2 between coalesce(f."yearFrom", 0) and coalesce(f."yearTo", 9999))));
```
Los productos universales (aceites, aditivos) sin compatibilidad cargada se muestran en una sección aparte, "También para tu vehículo", según su categoría.

### 8.4 Búsqueda de texto
Para el lanzamiento basta con `ilike` sobre nombre, marca, código y referencia. Después: columna `tsvector` con `unaccent` y búsqueda en español, o `pg_trgm` para tolerar errores de escritura ("bujia" → "bujía", "10w40" → "10W-40", normalizando guiones y espacios).

---

## 9. Diseño (según el manual de marca)

> Al construir la tienda con Claude Code, usa las skills de diseño instaladas: **`/impeccable`** para crear el `store/DESIGN.md` a partir del manual y para auditar y pulir, **`design-taste-frontend`** para la dirección de arte de la portada y las páginas públicas (evita el aspecto genérico de plantilla) y **`make-interfaces-feel-better`** para los estados, microinteracciones y detalles. El documento de diseño de la tienda es **independiente** del `DESIGN.md` del ERP.

### 9.1 Tokens

```css
:root {
  /* Marca */
  --naranja: #F26B1D;   /* acción principal, acentos, emblema */
  --grafito: #15171A;   /* texto principal, fondos oscuros */
  --hueso:   #F4F1EA;   /* fondo claro principal (no blanco puro) */
  --acero:   #8A9099;   /* texto secundario, etiquetas de dato, bordes */
  --sol:     #FFB81C;   /* destacados secundarios, "mayor", líneas alternas */
  --alerta:  #C2301F;   /* errores, agotado, pagos rechazados */

  /* Derivados */
  --grafito-2: #1F2226;  /* superficies sobre grafito (patrón V, tarjetas oscuras) */
  --grafito-3: #2A2E33;
  --hueso-2:   #EAE4D6;  /* marca de agua del emblema sobre hueso (como en el manual) */
  --blanco:    #FFFFFF;  /* tarjetas de producto sobre hueso */

  --font-display: "Barlow Condensed", system-ui, sans-serif; /* 700/800, SIEMPRE MAYÚSCULAS */
  --font-body:    "Barlow", system-ui, sans-serif;           /* 400/500/600 */

  --radius: 2px;         /* esquinas casi rectas, como los trazos del logo */
}
```
Google Fonts: `Barlow+Condensed:wght@700;800` y `Barlow:wght@400;500;600`, con `font-display: swap`.

**Contraste:** el naranja `#F26B1D` sobre hueso **no** llega a 4.5:1 en texto pequeño. Úsalo en fondos de botón con texto **grafito** (como en la banda de capacidad del manual), en texto grande o en elementos gráficos. Para enlaces en texto corrido, usa grafito subrayado con naranja.

### 9.2 Tipografía
- **Títulos y cifras:** Barlow Condensed 800 en mayúsculas, con tracking ligeramente negativo en tamaños grandes.
- **Subtítulos:** Condensed 700 en mayúsculas.
- **Texto:** Barlow 400 a 16–18 px, interlineado 1.5.
- **Datos y etiquetas** ("CAPACIDAD 1 L", "API SN", "ACEITE DE MOTOR"): Barlow 600 en mayúsculas, tracking +0.12em y color acero, como en la etiqueta de producto del manual.
- **Precios:** Condensed 800 con `font-variant-numeric: tabular-nums`. El USD en grande y los Bs debajo en Barlow 500 color acero.

### 9.3 Elementos de marca
- **Barra naranja corta** (≈ 72 × 8 px) sobre cada título de sección: es el recurso más repetido del manual.
- **Patrón V** (chevrones) en grafito-2 sobre grafito para el hero, el footer y los banners. **Nunca detrás del logotipo.**
- **Franja de advertencia** (diagonales naranja y grafito) como remate del footer, la tarjeta de confirmación de pedido y los banners. Máximo 10 % de la pieza.
- **Emblema en marca de agua** gigante y recortado (grafito-2 sobre grafito, o hueso-2 sobre hueso) en el hero y en las páginas institucionales, como en las portadas de sección del manual.
- **Iconos** de línea de 1.75 px con esquinas rectas: aceite (gota), filtro, bujía, batería, frenos (disco) y ubicación. Se dibujan en SVG propio con ese estilo; no se mezclan con iconos redondeados. Si se usa lucide para iconos de interfaz (carrito, usuario, menú), poner `strokeWidth={1.75}` y `strokeLinecap="square"`.
- **Logo:** horizontal en el header (≥ 160 px de ancho; en móvil, solo el emblema ≥ 24 px). Sobre grafito, el nombre en hueso y el emblema en naranja. Respetar el área de respeto (h). No usar sobre fondos complejos, no girarlo ni deformarlo. Favicon y avatar: insignia circular.

### 9.4 Dirección visual
- **Ritmo claro y oscuro** como el manual: secciones hueso para catálogo y lectura, secciones grafito para hero, mayoristas y footer.
- **Hero:** fondo grafito con patrón V, titular enorme en Condensed 800 ("ACEITE CORRECTO. MOTOR PROTEGIDO.") y el buscador por vehículo como protagonista, en una barra blanca con tres selects y un botón naranja "BUSCAR".
- **Tarjeta de producto** inspirada en la etiqueta del manual: tipo de producto en etiqueta de dato color acero, el **dato principal grande** (viscosidad o medida) en Condensed, el nombre debajo, el precio en una banda inferior y el botón "Agregar" en naranja con texto grafito. Imagen sobre fondo blanco con `outline` sutil.
- **Categorías:** grilla de bloques con el icono de línea, el nombre en Condensed y el conteo de productos.
- **Bloque mayoristas:** fondo naranja con texto grafito (la versión de una tinta del manual) y el CTA "SOLICITAR CUENTA MAYORISTA".
- **Movimiento** sobrio: transiciones de 150–200 ms, sin animaciones decorativas largas. Respetar `prefers-reduced-motion`.
- **Mobile first:** la mayoría de los clientes llegará por WhatsApp o Instagram desde el teléfono. Header compacto con buscador, carrito fijo y botón flotante de WhatsApp.
- **Evitar:** degradados morados o azules, glassmorphism, tarjetas con sombras grandes y redondeos de 16 px o más, emojis como iconos y el naranja en grandes superficies de texto pequeño.

### 9.5 Microcopy (tono: claro, directo y confiable, como el "mostrador de confianza")
- Botones: "AGREGAR", "VER COMPATIBLES", "CONFIRMAR PEDIDO", "REPORTAR PAGO", "ESCRÍBENOS".
- Disponibilidad: "Disponible" · "Últimas unidades" · "Agotado: avísame por WhatsApp".
- Pedido creado: "Apartamos tus productos por 24 horas. Paga y reporta tu pago para confirmar."
- Mayor pendiente: "Estamos revisando tu solicitud de mayorista. Mientras tanto puedes comprar a precio de detal."

---

## 10. Notificaciones

- **Fase inicial:** enlaces de WhatsApp (*click to chat*) desde la tienda y desde el ERP con mensajes prellenados. Los correos de cuenta (confirmación y recuperación) los envía Supabase Auth; personaliza sus plantillas en español con la marca.
- **Posterior:** correo transaccional (pedido recibido, pago aprobado, listo o enviado) con un proveedor como Resend desde una Edge Function disparada por `web_order_events`. Más adelante, la WhatsApp Business API.

---

## 11. Rendimiento, SEO y calidad

- Imágenes en WebP, `loading="lazy"`, tamaños `srcset` (400/800/1200) con Supabase Image Transformations o generadas al subir.
- Consultas paginadas. La vista `catalog_products` **no** devuelve base64.
- Por página: título y descripción por producto, `og:image` y datos estructurados `Product`/`Offer` (JSON-LD). `sitemap.xml` generado desde `catalog_products` (script en el build o Edge Function).
- Accesibilidad: contraste AA, foco visible (anillo naranja de 2 px con offset), formularios con `label`, objetivos táctiles ≥ 44 px y navegación por teclado.
- **Pruebas mínimas:** `price_quote` con casos de reglas combinadas, tope y piso de margen. Concurrencia de `place_order` (dos pedidos por la última unidad: uno debe fallar). Expiración de reservas. Con la llave anon, comprobar que **no** se puede leer `costPrice`, `clients`, pedidos ajenos ni comprobantes ajenos.

---

## 12. Plan por fases

Cada fase va en su propia rama y PR, se prueba en staging y luego pasa a producción.

### Fase 0 — Seguridad del ERP (sección 3)
**Entregable:** el ERP con Supabase Auth y RLS, usuarios migrados, Firebase eliminado y la venta atómica.
**Prompt sugerido:**
> Lee docs/TIENDA-VALKAR.md sección 3. Implementa la fase 0 en una rama `seguridad/auth-rls`: migraciones SQL 0001 y 0002, el script scripts/migrate-staff-users.mjs, el nuevo login con Supabase Auth y el contexto de rol, la Edge Function staff-create-user, la eliminación de Firebase y la función erp_create_invoice usada desde el POS. Primero verifica los tipos reales en erp_schema.sql.

### Fase 1 — Datos de la tienda en el ERP (secciones 4, 5.1, 5.2, 6.1, 6.5, 6.6, 7)
**Entregable:** migraciones 0003–0006, buckets, la pestaña "Tienda web" en inventario, categorías, vehículos, la configuración de la tienda y la migración de imágenes.
**Criterio:** puedes publicar productos con categoría, imágenes, especificaciones y compatibilidad, y la vista `catalog_products` los devuelve con la llave anon.

### Fase 2 — Tienda: catálogo y cuentas (secciones 2, 8.1–8.4, 9)
**Entregable:** la app `store/` con diseño de marca, inicio, catálogo, buscador por vehículo, producto, registro e inicio de sesión (`register_customer`) y la cuenta del cliente. Desplegada en un segundo proyecto de Vercel.
**Prompt sugerido:**
> Lee docs/TIENDA-VALKAR.md secciones 2, 8 y 9 y Valkar-BrandBook.pdf. Usa /impeccable para crear store/DESIGN.md desde el manual y design-taste-frontend para la dirección visual. Crea la app store/ (Vite + React + Tailwind v4), con shared/ para el cliente de Supabase y el formato de moneda. Implementa inicio, catálogo, vehículo, producto, registro, ingreso y cuenta.

### Fase 3 — Precios, carrito y pedidos (secciones 4.4–4.6, 5, 8.2)
**Entregable:** `pricing_rules`, `price_quote`, `place_order`, reservas, `report_payment` con comprobante, la página de confirmación con los datos de pago y `expire_reservations` con pg_cron.
**Criterio:** un cliente de detal y un mayorista aprobado completan un pedido; el mayorista ve cambiar su precio según la forma de pago y el plazo; dos pedidos simultáneos por la última unidad no generan sobreventa.

### Fase 4 — Gestión en el ERP (secciones 6.2–6.4)
**Entregable:** las pantallas Pedidos web, Mayoristas y Reglas de precio con su simulador. Confirmar un pedido genera la factura, descuenta el stock y registra el kardex.
**Criterio:** el ciclo completo funciona de punta a punta (pedido → comprobante → aprobación → factura → preparando → entregado) y el cliente ve cada cambio en tiempo real en su cuenta.

### Fase 5 — Pulido y lanzamiento (secciones 10, 11)
SEO (sitemap, JSON-LD, prerender de producto), plantillas de correo de Auth, auditoría con `/impeccable` (accesibilidad y responsive), pruebas de la sección 11, dominio propio, carga del catálogo real y prueba piloto con 3–5 clientes antes del anuncio.

---

## 13. Pendientes de tu lado

- [ ] Hacer el dump del esquema real (`erp_schema.sql`) y confirmar los tipos de `id` y si `sellingPrice` incluye IVA.
- [ ] Crear el proyecto Supabase de **staging**.
- [ ] Conseguir los archivos del logo en SVG (horizontal, vertical, emblema e insignia circular) en versiones para fondo claro y oscuro.
- [ ] Reunir los datos de pago reales (Pago Móvil, cuentas, Zelle, Binance), las zonas y tarifas de delivery, y el horario.
- [ ] Definir las reglas de precio mayorista iniciales (tabla 4.4).
- [ ] Consultar con tu contador el IGTF y si la factura web debe ser fiscal (máquina o imprenta digital autorizada por el SENIAT).
- [ ] Definir el dominio de la tienda.
- [ ] Redactar las políticas: términos, privacidad, cambios y devoluciones, garantía de repuestos.
