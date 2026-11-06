insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@staff.valkar.local'),
  ('00000000-0000-0000-0000-00000000000c', 'cliente@correo.com');
insert into staff_profiles ("userId", username, name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'Admin', 'administrador');
insert into inventory (code, name, quantity, "costPrice", "sellingPrice") values
  ('0001', 'ACEITE 20W50', 5, 4, 6), ('0002', 'FILTRO', 1, 2, 3);
insert into clients (name, "documentId") values ('Juan', 'V12345678');
insert into settings (id, data) values ('exchange_rates', '{"bcv": 245.8}'), ('global_settings', '{"storeName":"Valkar"}');

-- @test politicas viejas eliminadas
select tablename, policyname from pg_policies where schemaname='public' and tablename in ('inventory','clients') order by 1,2;

-- @test anon no ve inventario ni clientes
set role anon;
select (select count(*) from inventory) inv, (select count(*) from clients) cli,
       (select count(*) from settings) settings_visibles;

-- @test cliente de la tienda (authenticated, no staff) no ve inventario
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select (select count(*) from inventory) inv, (select count(*) from clients) cli, (select count(*) from settings) settings_visibles;

-- @fails cliente no puede llamar erp_create_invoice
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select erp_create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('productId', (select id from inventory limit 1), 'quantity', 1)), 'total', 6));

-- @test staff ve todo y factura
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_create_invoice(jsonb_build_object(
  'items', jsonb_build_array(jsonb_build_object('productId', (select id from inventory where code='0001'), 'quantity', 2, 'price', 6)),
  'subtotal', 12, 'total', 12, 'clientId', (select id from clients limit 1), 'clientName', 'Juan'))->>'invoiceNumber' as factura,
  (select quantity from inventory where code='0001') as stock_despues;

-- @fails staff sin stock suficiente
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_create_invoice(jsonb_build_object(
  'items', jsonb_build_array(jsonb_build_object('productId', (select id from inventory where code='0002'), 'quantity', 5)),
  'subtotal', 15, 'total', 15));

-- @test 0002b: productType existe y los productos previos quedan como 'product'
select "productType", count(*) as productos from inventory group by 1;

-- @fails 0002b: productType solo admite product o service
update inventory set "productType" = 'otro' where code = '0001';
