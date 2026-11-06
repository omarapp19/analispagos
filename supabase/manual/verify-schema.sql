-- Verificación del esquema real antes de aplicar las migraciones (pégalo en el SQL editor de Supabase).
-- Sustituye al paso "erp_schema.sql" si no puedes hacer el dump: copia el resultado de cada consulta.
-- Solo lee; no cambia nada.

-- 1. Tipo de id de las tablas que referencian las migraciones de la tienda.
--    Las migraciones 0003+ se adaptan solas al tipo (uuid, bigint o text) mediante dominios erp_*_id.
select c.relname as tabla, a.attname as columna, format_type(a.atttypid, a.atttypmod) as tipo,
       pg_get_expr(d.adbin, d.adrelid) as valor_por_defecto
from pg_class c
join pg_attribute a on a.attrelid = c.oid and a.attname = 'id'
left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('inventory','clients','client_invoices','kardex','transactions','settings')
order by 1;

-- 2. Columnas que usan erp_create_invoice y las RPC de la tienda.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('inventory','clients','client_invoices','kardex','transactions','settings')
order by table_name, ordinal_position;

-- 3. Estado de RLS y políticas actuales.
select relname as tabla, relrowsecurity as rls_activo
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by 1;

select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 4. ¿sellingPrice incluye IVA? No se deduce del esquema: compáralo con el precio de góndola de 2 o 3
--    productos. Lo que decidas se configura en ERP > Configuración > Tienda web > "Los precios incluyen IVA".
select code, name, "costPrice", "marginPercentage", "sellingPrice", "taxPercentage"
from inventory
order by "updatedAt" desc nulls last
limit 5;

-- 4b. Columna que el ERP y las funciones dan por hecha (si no sale ninguna fila, aplica 0002b).
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'inventory' and column_name = 'productType';

-- 5. Números de factura duplicados (impiden crear el índice único de 0002a).
select "invoiceNumber", count(*) from client_invoices group by 1 having count(*) > 1;

-- 6. Extensiones disponibles para la tienda (pg_cron para expirar reservas).
select name, installed_version from pg_available_extensions where name in ('pg_cron','pgcrypto','unaccent','pg_trgm');
