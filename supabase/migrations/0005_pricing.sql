-- Fase 1 / 0005: reglas de precio mayorista (la lógica está en price_quote, migración 0008).

create table if not exists public.pricing_rules (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                 -- "Contado", "Zelle", "Caja de 12", ...
  kind            text not null check (kind in ('quantity','payment_method','credit_days','category','customer')),
  "discountPct"   numeric(5,2) not null check ("discountPct" between -100 and 100),
       -- negativo = recargo (ej. crédito a 45 días +2 %)
  "productId"     erp_inventory_id references public.inventory(id) on delete cascade,  -- null = todos
  "categoryId"    uuid references public.categories(id) on delete cascade,              -- null = todas
  "clientId"      erp_client_id references public.clients(id) on delete cascade,        -- solo kind = 'customer'
  "minQty"        int check ("minQty" is null or "minQty" >= 1),                        -- kind = 'quantity'
  "paymentMethod" text check ("paymentMethod" is null or "paymentMethod" in
                    ('pago_movil','transferencia','zelle','binance','efectivo','credito')),  -- kind = 'payment_method'
  "creditDays"    int check ("creditDays" is null or "creditDays" >= 0),                -- kind = 'credit_days'
  "appliesTo"     text not null default 'mayor' check ("appliesTo" in ('mayor','todos')),
  active          boolean not null default true,
  "startsAt"      timestamptz,
  "endsAt"        timestamptz,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now(),
  constraint pricing_rules_condition_chk check (
    (kind <> 'quantity'       or "minQty" is not null) and
    (kind <> 'payment_method' or "paymentMethod" is not null) and
    (kind <> 'credit_days'    or "creditDays" is not null) and
    (kind <> 'category'       or "categoryId" is not null)
  ),
  constraint pricing_rules_dates_chk check ("startsAt" is null or "endsAt" is null or "startsAt" <= "endsAt")
);
create index if not exists pricing_rules_active_idx on public.pricing_rules (kind) where active;

alter table public.pricing_rules enable row level security;
drop policy if exists "solo staff" on public.pricing_rules;
create policy "solo staff" on public.pricing_rules for all to authenticated
  using (is_staff()) with check (is_staff());
