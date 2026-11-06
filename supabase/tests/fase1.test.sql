insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@staff.valkar.local'),
  ('00000000-0000-0000-0000-00000000000c', 'cliente@correo.com');
insert into staff_profiles ("userId", username, name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'Admin', 'administrador');
insert into inventory (code, name, brand, quantity, "costPrice", "sellingPrice") values
  ('0001', 'Aceite 20W-50 Mineral', 'VALKAR', 5, 4, 6), ('0002', 'FILTRO ACEITE', 'WIX', 1, 2, 3),
  ('0003', 'Aceite 20W-50 Mineral', 'VALKAR', 2, 4, 6);
insert into settings (id, data) values ('exchange_rates', '{"bcv": 245.8}')
  on conflict (id) do nothing;

-- @test dominios con el tipo real
select typname, format_type(typbasetype, typtypmod) base from pg_type where typname like 'erp_%_id' order by 1;

-- @test publicar genera slug unico y fecha
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update inventory set "webPublished" = true, "categoryId" = (select id from categories where slug='aceites-de-motor'),
  specs = '{"viscosidad":"20W-50"}' where code in ('0001','0003');
update inventory set "webPublished" = true, "webFeatured" = true, "categoryId" = (select id from categories where slug='filtros') where code = '0002';
select code, slug, "webPublishedAt" is not null as fecha from inventory order by code;

-- @test anon lee catalogo sin columnas privadas
set role anon;
select count(*) n, bool_and(available >= 0) ok,
  (select string_agg(column_name, ',') from information_schema.columns where table_name='catalog_products'
     and column_name in ('costPrice','marginPercentage','quantity','image')) as privadas
from catalog_products;

-- @test anon lee categorias con conteo y marcas
set role anon;
select (select count(*) from catalog_categories where count > 0) cats_con_productos, (select count(*) from vehicle_makes) marcas;

-- @fails anon no escribe categorias
set role anon;
insert into categories (name, slug) values ('X', 'x');

-- @fails cliente no escribe categorias
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into categories (name, slug) values ('X', 'x');

-- @test staff carga compatibilidad y busqueda por vehiculo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into vehicle_models ("makeId", name) values ((select id from vehicle_makes where name='Toyota'), 'Corolla');
insert into product_fitments ("productId", "modelId", "yearFrom", "yearTo")
  values ((select id from inventory where code='0002'), (select id from vehicle_models where name='Corolla'), 2009, 2019);
set role anon;
select jsonb_array_length(r->'compatible') compat_2015, jsonb_array_length(r->'universal') universal,
       (select jsonb_array_length(products_for_vehicle((select id from vehicle_models where name='Corolla'), 2005)->'compatible')) compat_2005
from (select products_for_vehicle((select id from vehicle_models where name='Corolla'), 2015) r) x;

-- @test settings: anon ve publica, no privada
set role anon;
select array_agg(id order by id) from settings;

-- @test cliente autenticado tampoco ve tienda_privada
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select array_agg(id order by id) from settings;

-- @test slug de modelo y marca
select slug from vehicle_models where name='Corolla';
