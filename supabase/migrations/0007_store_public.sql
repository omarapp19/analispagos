-- Fase 1 / 0007: lo que la tienda lee sin sesión (vistas del catálogo, búsqueda por vehículo),
-- buckets de Storage y configuración inicial de la tienda.

-- ---------- Vista pública del catálogo ----------
-- security_invoker = false a propósito: la vista lee inventory con los permisos de su dueño y expone solo
-- columnas públicas. Nunca costPrice, marginPercentage, quantity ni la columna image en base64.
-- images: rutas dentro del bucket product-images (o una URL completa si empieza con http).
create or replace view public.catalog_products with (security_invoker = false) as
select i.id, i.code, i.slug, i.name, i.brand, i.reference,
       i."webDescription" as description,
       i.specs,
       case when cardinality(i.images) > 0 then i.images
            when i.image ilike 'http%' then array[i.image]
            else '{}'::text[] end as images,
       i."categoryId", c.slug as "categorySlug", c.name as "categoryName", c.icon as "categoryIcon",
       i."sellingPrice" as "priceUsd", i."unitsPerPackage", i."minWholesaleQty", i."wholesaleEnabled",
       i."webFeatured" as featured,
       coalesce(i."webPublishedAt", i."createdAt") as "createdAt",
       greatest(coalesce(i.quantity, 0) - coalesce(r.reserved, 0), 0)::int as available
from public.inventory i
left join public.categories c on c.id = i."categoryId"
left join lateral (
  select sum(s.quantity) as reserved
  from public.stock_reservations s
  where s."productId" = i.id and not s.released and s."expiresAt" > now()
) r on true
where i."webPublished" and coalesce(i."productType", 'product') = 'product';

-- Categorías con el conteo de productos publicados (para la portada y los filtros).
create or replace view public.catalog_categories with (security_invoker = false) as
select c.id, c.name, c.slug, c."parentId", c.icon, c."sortOrder", c."isUniversal",
       (select count(*)::int from public.inventory i
         where i."categoryId" = c.id and i."webPublished" and coalesce(i."productType", 'product') = 'product') as count
from public.categories c;

revoke all on public.catalog_products, public.catalog_categories from anon, authenticated;
grant select on public.catalog_products, public.catalog_categories to anon, authenticated;

-- ---------- Búsqueda por vehículo ----------
-- Devuelve { compatible: [...], universal: [...] } con filas de catalog_products.
-- universal = productos de categorías "isUniversal" sin compatibilidad cargada (aceites, refrigerantes...).
create or replace function public.products_for_vehicle(p_model_id uuid, p_year int default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'compatible', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.name)
      from catalog_products p
      where exists (
        select 1 from product_fitments f
        where f."productId" = p.id and f."modelId" = p_model_id
          and (p_year is null or p_year between coalesce(f."yearFrom", 0) and coalesce(f."yearTo", 9999)))
    ), '[]'::jsonb),
    'universal', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.name)
      from catalog_products p
      join categories c on c.id = p."categoryId"
      where c."isUniversal"
        and not exists (select 1 from product_fitments f where f."productId" = p.id)
    ), '[]'::jsonb)
  )
$$;
revoke all on function public.products_for_vehicle(uuid, int) from public;
grant execute on function public.products_for_vehicle(uuid, int) to anon, authenticated;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true,  5242880, array['image/webp','image/jpeg','image/png']),
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('customer-docs',  'customer-docs',  false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "lectura publica imagenes" on storage.objects;
create policy "lectura publica imagenes" on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
drop policy if exists "staff gestiona imagenes" on storage.objects;
create policy "staff gestiona imagenes" on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.is_staff()) with check (bucket_id = 'product-images' and public.is_staff());

-- Comprobantes y documentos: el cliente sube y lee solo dentro de "{auth.uid()}/..."; el personal lee todo.
drop policy if exists "cliente sube comprobante" on storage.objects;
create policy "cliente sube comprobante" on storage.objects for insert to authenticated
  with check (bucket_id in ('payment-proofs','customer-docs') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "cliente lee su comprobante" on storage.objects;
create policy "cliente lee su comprobante" on storage.objects for select to authenticated
  using (bucket_id in ('payment-proofs','customer-docs')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ---------- Configuración de la tienda ----------
-- tienda_publica: la lee cualquiera (política de 0002). Nada privado aquí.
-- tienda_privada: solo personal y RPC (IVA, factura fiscal, tope de descuento, margen mínimo).
-- Se editan en ERP > Configuración > Tienda web. Estos son solo valores iniciales.
insert into public.settings (id, data, "updatedAt") values
('tienda_publica', '{
  "storeOpen": false,
  "whatsapp": "",
  "address": "",
  "hours": "Lun–Vie 8:00–17:00 · Sáb 8:00–13:00",
  "payments": {
    "pago_movil":    { "enabled": false, "bank": "", "phone": "", "document": "" },
    "transferencia": { "enabled": false, "bank": "", "account": "", "holder": "", "rif": "" },
    "zelle":         { "enabled": false, "email": "", "holder": "" },
    "binance":       { "enabled": false, "payId": "", "email": "" },
    "efectivo":      { "enabled": true }
  },
  "delivery": {
    "retiro":         { "enabled": true },
    "delivery":       { "enabled": false, "zones": [], "freeOverUsd": 0 },
    "envio_nacional": { "enabled": false, "carriers": ["MRW", "Zoom", "Tealca"], "mode": "cobro_destino" }
  },
  "creditDaysOptions": [0, 15, 30],
  "reservationHours": 24,
  "cashReservationHours": 48,
  "igtfPct": 0,
  "igtfMethods": ["zelle", "binance", "efectivo"]
}'::jsonb, now()),
('tienda_privada', '{
  "pricesIncludeIva": true,
  "facturaFiscal": false,
  "maxDiscountPct": 20,
  "minMarginPct": 8
}'::jsonb, now())
on conflict (id) do nothing;
