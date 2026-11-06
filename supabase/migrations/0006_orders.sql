-- Fase 1 / 0006: pedidos web, comprobantes de pago, historial y reservas de stock.
-- Las escrituras de los clientes pasan solo por RPC (migración 0008); el personal, por las RPC staff_* (0009).

create sequence if not exists public.web_order_seq start 1;

create table if not exists public.web_orders (
  id                uuid primary key default gen_random_uuid(),
  number            text unique not null default ('WEB-' || lpad(nextval('public.web_order_seq')::text, 6, '0')),
  "userId"          uuid not null references auth.users(id),
  "clientId"        erp_client_id not null references public.clients(id),
  "customerType"    text not null check ("customerType" in ('detal','mayor')),  -- en el momento del pedido
  status            text not null default 'PENDIENTE_PAGO' check (status in (
                      'PENDIENTE_PAGO','POR_CONFIRMAR','PAGO_REPORTADO','CONFIRMADO','PREPARANDO',
                      'LISTO_RETIRO','EN_CAMINO','ENVIADO','ENTREGADO','CANCELADO','EXPIRADO')),
  "paymentMethod"   text not null check ("paymentMethod" in
                      ('pago_movil','transferencia','zelle','binance','efectivo','credito')),
  "creditDays"      int not null default 0,
  "deliveryMethod"  text not null check ("deliveryMethod" in ('retiro','delivery','envio_nacional')),
  "deliveryZone"    text,
  "deliveryAddress" jsonb,                              -- copia de la dirección al momento del pedido
  carrier           text,                               -- MRW | Zoom | Tealca (envío nacional)
  "trackingNumber"  text,
  "subtotalUsd"     numeric(12,2) not null,             -- suma a precio base (antes de descuentos)
  "discountUsd"     numeric(12,2) not null default 0,
  "deliveryFeeUsd"  numeric(12,2) not null default 0,
  "taxUsd"          numeric(12,2) not null default 0,   -- IVA cuando los precios no lo incluyen
  "igtfUsd"         numeric(12,2) not null default 0,   -- IGTF por pago en divisas
  "totalUsd"        numeric(12,2) not null,
  "bcvRate"         numeric(14,4) not null,             -- tasa congelada
  "totalBs"         numeric(16,2) not null,
  notes             text,
  "invoiceId"       erp_invoice_id references public.client_invoices(id) on delete set null, -- se llena al facturar
  "reservedUntil"   timestamptz,
  "staffNotes"      text,
  "createdAt"       timestamptz not null default now(),
  "updatedAt"       timestamptz not null default now()
);
create index if not exists web_orders_user_idx on public.web_orders ("userId", "createdAt" desc);
create index if not exists web_orders_status_idx on public.web_orders (status);

create table if not exists public.web_order_items (
  id              uuid primary key default gen_random_uuid(),
  "orderId"       uuid not null references public.web_orders(id) on delete cascade,
  "productId"     erp_inventory_id not null references public.inventory(id),
  "productName"   text not null,
  code            text,
  quantity        int not null check (quantity > 0),
  "unitBaseUsd"   numeric(12,2) not null,
  "discountPct"   numeric(5,2) not null default 0,
  "unitPriceUsd"  numeric(12,2) not null,
  "lineTotalUsd"  numeric(12,2) not null,
  "appliedRules"  jsonb not null default '[]'::jsonb
);
create index if not exists web_order_items_order_idx on public.web_order_items ("orderId");

create table if not exists public.web_payment_reports (           -- comprobantes
  id            uuid primary key default gen_random_uuid(),
  "orderId"     uuid not null references public.web_orders(id) on delete cascade,
  method        text not null,
  amount        numeric(16,2) not null check (amount > 0),
  currency      text not null check (currency in ('USD','VES')),
  reference     text not null,                 -- nro. de referencia / id de transacción
  "paidAt"      date not null,
  "bankFrom"    text,
  "proofPath"   text,                          -- ruta en el bucket privado payment-proofs
  status        text not null default 'pendiente' check (status in ('pendiente','aprobado','rechazado')),
  "reviewedBy"  uuid references auth.users(id),
  "reviewedAt"  timestamptz,
  "reviewNote"  text,
  "createdAt"   timestamptz not null default now()
);
create index if not exists web_payment_reports_order_idx on public.web_payment_reports ("orderId");

create table if not exists public.web_order_events (              -- historial visible para el cliente
  id          bigint generated always as identity primary key,
  "orderId"   uuid not null references public.web_orders(id) on delete cascade,
  status      text not null,
  note        text,
  "byStaff"   boolean not null default false,
  "createdAt" timestamptz not null default now()
);
create index if not exists web_order_events_order_idx on public.web_order_events ("orderId", "createdAt");

create table if not exists public.stock_reservations (
  id          uuid primary key default gen_random_uuid(),
  "orderId"   uuid not null references public.web_orders(id) on delete cascade,
  "productId" erp_inventory_id not null references public.inventory(id),
  quantity    int not null check (quantity > 0),
  "expiresAt" timestamptz not null,           -- 'infinity' para crédito: se libera al confirmar o cancelar
  released    boolean not null default false
);
create index if not exists stock_reservations_active_idx on public.stock_reservations ("productId") where not released;
create index if not exists stock_reservations_order_idx on public.stock_reservations ("orderId");

-- ---------- RLS ----------
alter table public.web_orders enable row level security;
drop policy if exists "cliente lee sus pedidos" on public.web_orders;
create policy "cliente lee sus pedidos" on public.web_orders for select to authenticated
  using ("userId" = auth.uid() or is_staff());

alter table public.web_order_items enable row level security;
drop policy if exists "cliente lee items" on public.web_order_items;
create policy "cliente lee items" on public.web_order_items for select to authenticated using (
  is_staff() or exists (select 1 from web_orders o where o.id = "orderId" and o."userId" = auth.uid()));

alter table public.web_payment_reports enable row level security;
drop policy if exists "cliente lee sus pagos" on public.web_payment_reports;
create policy "cliente lee sus pagos" on public.web_payment_reports for select to authenticated using (
  is_staff() or exists (select 1 from web_orders o where o.id = "orderId" and o."userId" = auth.uid()));

alter table public.web_order_events enable row level security;
drop policy if exists "cliente lee eventos" on public.web_order_events;
create policy "cliente lee eventos" on public.web_order_events for select to authenticated using (
  is_staff() or exists (select 1 from web_orders o where o.id = "orderId" and o."userId" = auth.uid()));

alter table public.stock_reservations enable row level security;
drop policy if exists "solo staff" on public.stock_reservations;
create policy "solo staff" on public.stock_reservations for select to authenticated using (is_staff());

-- El número de pedido no debe poder consumirse desde el navegador.
revoke all on sequence public.web_order_seq from anon, authenticated;

-- ---------- Tiempo real (el cliente ve los cambios de su pedido; el ERP, los pedidos nuevos) ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['web_orders','web_order_events','web_payment_reports','web_customers'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
