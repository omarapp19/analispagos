-- Fase 0 / 0002b: columna inventory."productType" ('product' | 'service').
--
-- El ERP (Inventario, POS) y las funciones de la base (erp_create_invoice, price_quote, las vistas del catálogo)
-- dan por hecho que existe, pero la base de producción se creó sin ella: ver el error
--   42703: column i.productType does not exist
-- al aplicar 0007, y "record v_prod has no field productType" al facturar en el POS.
-- Es seguro repetirla. Los productos que ya existen quedan como 'product'; los servicios se marcan desde Inventario.

alter table public.inventory
  add column if not exists "productType" text not null default 'product';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_product_type_chk') then
    alter table public.inventory
      add constraint inventory_product_type_chk check ("productType" in ('product', 'service'));
  end if;
end $$;
