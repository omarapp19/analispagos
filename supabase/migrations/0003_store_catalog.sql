-- Fase 1 / 0003: catálogo de la tienda (campos web en inventory, categorías, vehículos y compatibilidad).
--
-- Tipos de id: no se conoce si inventory.id / clients.id / client_invoices.id son uuid, bigint o text.
-- Estos dominios copian el tipo real de cada tabla, y todas las columnas que las referencian los usan.
-- Así las llaves foráneas funcionan sin editar el SQL. Compruébalo con supabase/manual/verify-schema.sql.
do $$
declare
  r record;
  t text;
begin
  for r in select * from (values ('erp_inventory_id', 'inventory'),
                                 ('erp_client_id', 'clients'),
                                 ('erp_invoice_id', 'client_invoices')) v(dom, tbl)
  loop
    select format_type(a.atttypid, a.atttypmod) into t
    from pg_attribute a
    where a.attrelid = format('public.%I', r.tbl)::regclass and a.attname = 'id' and not a.attisdropped;
    if t is null then
      raise exception 'La tabla public.% no tiene columna id', r.tbl;
    end if;
    if to_regtype('public.' || r.dom) is null then
      execute format('create domain public.%I as %s', r.dom, t);
      raise notice 'Dominio % = %', r.dom, t;
    end if;
  end loop;
end $$;

-- Texto -> slug de URL ("Aceite 20W-50 Mineral" -> "aceite-20w-50-mineral"), sin depender de unaccent.
create or replace function public.store_slugify(p text) returns text
language sql immutable set search_path = public as $$
  select trim(both '-' from regexp_replace(lower(translate(coalesce(p, ''),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')), '[^a-z0-9]+', '-', 'g'))
$$;

-- ---------- Categorías ----------
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  "parentId"    uuid references public.categories(id) on delete set null,
  icon          text,              -- aceite | engranaje | refrigerante | filtro | frenos | bujia | bateria | correa | grasa | ...
  "sortOrder"   int not null default 0,
  "isUniversal" boolean not null default false,  -- sirve para cualquier vehículo (aceites, refrigerantes, grasas)
  "createdAt"   timestamptz not null default now()
);

-- ---------- Campos web en inventory ----------
alter table public.inventory
  add column if not exists "webPublished"     boolean not null default false,
  add column if not exists "webFeatured"      boolean not null default false,
  add column if not exists "webPublishedAt"   timestamptz,
  add column if not exists slug               text,
  add column if not exists "categoryId"       uuid,
  add column if not exists "webDescription"   text,
  add column if not exists reference          text,          -- referencia del fabricante / OEM
  add column if not exists specs              jsonb not null default '{}'::jsonb,
  add column if not exists images             text[] not null default '{}',  -- rutas en el bucket product-images
  add column if not exists "wholesaleEnabled" boolean not null default true,
  add column if not exists "minWholesaleQty"  int not null default 1,
  add column if not exists "maxDiscountPct"   numeric(5,2),  -- tope de descuento (null = usar el global privado)
  add column if not exists "minMarginPct"     numeric(5,2);  -- margen mínimo sobre costo (null = usar el global privado)

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_slug_key') then
    alter table public.inventory add constraint inventory_slug_key unique (slug);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inventory_category_fk') then
    alter table public.inventory add constraint inventory_category_fk
      foreign key ("categoryId") references public.categories(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inventory_min_wholesale_qty_chk') then
    alter table public.inventory add constraint inventory_min_wholesale_qty_chk check ("minWholesaleQty" >= 1);
  end if;
end $$;

create index if not exists inventory_web_published_idx on public.inventory ("categoryId") where "webPublished";

-- Al publicar: genera el slug (nombre + código, único) y la fecha de publicación.
create or replace function public.inventory_web_defaults() returns trigger
language plpgsql set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  new.slug := nullif(btrim(coalesce(new.slug, '')), '');
  if new."webPublished" then
    if new."webPublishedAt" is null then
      new."webPublishedAt" := now();
    end if;
    if new.slug is null then
      base := coalesce(nullif(store_slugify(concat_ws('-', new.name, new.code)), ''), 'producto');
      candidate := base;
      while exists (select 1 from inventory where slug = candidate and id is distinct from new.id) loop
        n := n + 1;
        candidate := base || '-' || n;
      end loop;
      new.slug := candidate;
    else
      new.slug := store_slugify(new.slug);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists inventory_web_defaults on public.inventory;
create trigger inventory_web_defaults before insert or update on public.inventory
  for each row execute function public.inventory_web_defaults();

-- ---------- Vehículos ----------
create table if not exists public.vehicle_makes (
  id   uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null
);

create table if not exists public.vehicle_models (
  id       uuid primary key default gen_random_uuid(),
  "makeId" uuid not null references public.vehicle_makes(id) on delete cascade,
  name     text not null,
  slug     text not null,
  unique ("makeId", name),
  unique ("makeId", slug)
);

create or replace function public.vehicle_slug_default() returns trigger
language plpgsql set search_path = public as $$
begin
  new.name := btrim(new.name);
  new.slug := coalesce(nullif(store_slugify(new.slug), ''), store_slugify(new.name));
  return new;
end $$;

drop trigger if exists vehicle_makes_slug on public.vehicle_makes;
create trigger vehicle_makes_slug before insert or update on public.vehicle_makes
  for each row execute function public.vehicle_slug_default();
drop trigger if exists vehicle_models_slug on public.vehicle_models;
create trigger vehicle_models_slug before insert or update on public.vehicle_models
  for each row execute function public.vehicle_slug_default();

create table if not exists public.product_fitments (           -- compatibilidad producto <-> vehículo
  id          uuid primary key default gen_random_uuid(),
  "productId" erp_inventory_id not null references public.inventory(id) on delete cascade,
  "modelId"   uuid not null references public.vehicle_models(id) on delete cascade,
  "yearFrom"  int,
  "yearTo"    int,
  engine      text,                        -- ej. "1.6 16V", opcional
  notes       text,
  constraint product_fitments_years_chk check ("yearFrom" is null or "yearTo" is null or "yearFrom" <= "yearTo")
);
create index if not exists product_fitments_model_idx on public.product_fitments ("modelId");
create index if not exists product_fitments_product_idx on public.product_fitments ("productId");

-- ---------- RLS ----------
alter table public.categories enable row level security;
alter table public.vehicle_makes enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.product_fitments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','vehicle_makes','vehicle_models','product_fitments'] loop
    execute format('drop policy if exists "lectura publica" on public.%I', t);
    execute format('create policy "lectura publica" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "staff escribe" on public.%I', t);
    execute format('create policy "staff escribe" on public.%I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

-- ---------- Datos iniciales ----------
insert into public.categories (name, slug, icon, "sortOrder", "isUniversal") values
  ('Aceites de motor',                   'aceites-de-motor',          'aceite',       1, true),
  ('Aceites de caja y transmisión',      'aceites-de-caja',           'engranaje',    2, true),
  ('Refrigerantes y aditivos',           'refrigerantes-y-aditivos',  'refrigerante', 3, true),
  ('Grasas',                             'grasas',                    'grasa',        4, true),
  ('Filtros',                            'filtros',                   'filtro',       5, false),
  ('Frenos',                             'frenos',                    'frenos',       6, false),
  ('Encendido',                          'encendido',                 'bujia',        7, false),
  ('Baterías',                           'baterias',                  'bateria',      8, false),
  ('Correas y mangueras',                'correas-y-mangueras',       'correa',       9, false),
  ('Suspensión',                         'suspension',                'suspension',  10, false),
  ('Accesorios',                         'accesorios',                'accesorio',   11, false)
on conflict (slug) do nothing;

insert into public.vehicle_makes (name, slug)
select m, store_slugify(m) from unnest(array[
  'Toyota','Chevrolet','Ford','Mitsubishi','Hyundai','Kia','Renault','Fiat','Jeep','Nissan',
  'Mazda','Chery','Volkswagen','Peugeot','Dodge','Honda']) m
on conflict (name) do nothing;
