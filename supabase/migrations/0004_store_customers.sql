-- Fase 1 / 0004: clientes de la tienda (cuentas de Supabase Auth enlazadas a clients del ERP).

create table if not exists public.web_customers (
  "userId"             uuid primary key references auth.users(id) on delete cascade,
  "clientId"           erp_client_id not null references public.clients(id),   -- enlace al cliente del ERP
  "customerType"       text not null default 'detal' check ("customerType" in ('detal','mayor')),
  "wholesaleStatus"    text not null default 'none'
                       check ("wholesaleStatus" in ('none','pending','approved','rejected')),
  "businessName"       text,     -- razón social (mayor)
  rif                  text,
  "rifDocument"        text,     -- ruta en el bucket customer-docs (opcional)
  "creditLimitUsd"     numeric(12,2) not null default 0 check ("creditLimitUsd" >= 0),
  "maxCreditDays"      int not null default 0 check ("maxCreditDays" >= 0),
  "specialDiscountPct" numeric(5,2) not null default 0 check ("specialDiscountPct" between 0 and 100),
  "wholesaleNote"      text,     -- nota del personal al aprobar o rechazar
  "approvedBy"         uuid references auth.users(id),
  "approvedAt"         timestamptz,
  "createdAt"          timestamptz not null default now(),
  "updatedAt"          timestamptz not null default now()
);
create index if not exists web_customers_client_idx on public.web_customers ("clientId");
create index if not exists web_customers_pending_idx on public.web_customers ("wholesaleStatus") where "wholesaleStatus" = 'pending';

create table if not exists public.web_addresses (
  id          uuid primary key default gen_random_uuid(),
  "userId"    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label       text,                 -- "Casa", "Taller"
  "fullName"  text not null,
  phone       text not null,
  state       text not null,        -- estado
  city        text not null,
  line1       text not null,
  reference   text,
  "isDefault" boolean not null default false,
  "createdAt" timestamptz not null default now()
);
create index if not exists web_addresses_user_idx on public.web_addresses ("userId");

alter table public.web_customers enable row level security;
drop policy if exists "cliente lee lo suyo" on public.web_customers;
create policy "cliente lee lo suyo" on public.web_customers for select to authenticated
  using ("userId" = auth.uid() or is_staff());
drop policy if exists "staff gestiona" on public.web_customers;
create policy "staff gestiona" on public.web_customers for update to authenticated
  using (is_staff()) with check (is_staff());
-- Altas solo vía register_customer (security definer). Cambios de condiciones mayoristas vía staff_review_wholesale.

alter table public.web_addresses enable row level security;
drop policy if exists "cliente gestiona sus direcciones" on public.web_addresses;
create policy "cliente gestiona sus direcciones" on public.web_addresses for all to authenticated
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());
drop policy if exists "staff lee direcciones" on public.web_addresses;
create policy "staff lee direcciones" on public.web_addresses for select to authenticated using (is_staff());
