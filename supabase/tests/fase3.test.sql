-- Fase 3: price_quote, registro, place_order, reservas, pagos, cancelación y expiración.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@staff.valkar.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'ana@correo.com'),
  ('00000000-0000-0000-0000-0000000000d1', 'taller@correo.com'),
  ('00000000-0000-0000-0000-0000000000e1', 'otro@correo.com');
insert into staff_profiles ("userId", username, name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'Admin', 'administrador');
insert into clients (name, "documentId", phone) values ('CLIENTE ERP REAL', 'V-12.345.678', '0414-1111111');
insert into inventory (code, name, brand, quantity, "costPrice", "sellingPrice", "taxPercentage", "webPublished", "categoryId") values
  ('A1', 'ACEITE 20W50', 'VALKAR', 20, 5, 10, 16, true, (select id from categories where slug = 'aceites-de-motor')),
  ('F1', 'FILTRO DE ACEITE', 'WIX', 1, 6, 8, 16, true, (select id from categories where slug = 'filtros')),
  ('B1', 'BATERIA 24', 'DURALAST', 3, 90, 100, 16, true, (select id from categories where slug = 'baterias')),
  ('N1', 'NO PUBLICADO', 'X', 9, 1, 2, 16, false, null);
insert into settings (id, data) values ('exchange_rates', '{"bcv": 200}') on conflict (id) do update set data = excluded.data;
update settings set data = data || '{"storeOpen": true, "igtfPct": 3, "creditDaysOptions": [0, 15, 30]}'::jsonb
  || jsonb_build_object('payments', '{"pago_movil":{"enabled":true,"bank":"BDV","phone":"0412","document":"J1"},"zelle":{"enabled":true,"email":"z@v.com","holder":"V"},"efectivo":{"enabled":true},"transferencia":{"enabled":false},"binance":{"enabled":false}}'::jsonb)
  || jsonb_build_object('delivery', '{"retiro":{"enabled":true},"delivery":{"enabled":true,"zones":[{"name":"Norte","feeUsd":3}],"freeOverUsd":50},"envio_nacional":{"enabled":true,"carriers":["MRW"],"mode":"cobro_destino"}}'::jsonb)
  where id = 'tienda_publica';
insert into pricing_rules (name, kind, "discountPct", "categoryId", "minQty", "paymentMethod", "creditDays", "appliesTo") values
  ('Mayor base', 'customer', 5, null, null, null, null, 'mayor'),
  ('Caja 12', 'quantity', 4, (select id from categories where slug = 'aceites-de-motor'), 12, null, null, 'mayor'),
  ('Caja 48', 'quantity', 8, (select id from categories where slug = 'aceites-de-motor'), 48, null, null, 'mayor'),
  ('Contado', 'credit_days', 3, null, null, null, 0, 'mayor'),
  ('Crédito 30', 'credit_days', -2, null, null, null, 30, 'mayor'),
  ('Zelle', 'payment_method', 3, null, null, 'zelle', null, 'mayor'),
  ('Promo filtros', 'category', 10, (select id from categories where slug = 'filtros'), null, null, null, 'todos');

-- @test anon: precio de detal, sin reglas mayoristas
set role anon;
select q->'lines'->0->>'unitPriceUsd' unit, q->>'totalUsd' total, q->>'customerType' tipo, jsonb_array_length(q->'errors') errores
from (select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 2))) q) x;

-- @test anon: promo "todos" de categoría aplica (8 - 10 % = 7.20)
set role anon;
select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'F1'), 'quantity', 1)))->'lines'->0->>'unitPriceUsd' as unit;

-- @test anon: producto no publicado da error no_disponible
set role anon;
select price_quote(jsonb_build_array(jsonb_build_object('productId', 'no-existe', 'quantity', 1)))->'errors'->0->>'code' as code;

-- @fails anon no puede leer settings privadas por RPC interna
set role anon;
select store_setting('tienda_privada');

-- @fails anon no puede registrar clientes
set role anon;
select register_customer('X', 'V1234567', '04120000000');

-- @test registro detal: enlaza el cliente del ERP por cédula y no expone sus datos
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select c->>'fullName' nombre, c->>'phone' tel, c->>'documentId' doc, c->>'customerType' tipo,
       (select count(*) from clients) as clientes
from (select register_customer('Ana Pérez', '12345678', '0412-000-0000') c) x;

-- @test registro mayorista queda pendiente y crea cliente nuevo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select c->>'wholesaleStatus' estado, c->>'rif' rif, c->>'documentId' doc
from (select register_customer('Taller X', 'J-29426731-9', '0261 7000000', true, 'Taller X C.A.', 'J-29426731-9') c) x;

-- @test mayorista pendiente compra a precio de detal
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select q->>'customerType' tipo, q->'lines'->0->>'unitPriceUsd' unit
from (select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 12)), 'zelle', 0) q) x;

-- @test el personal aprueba al mayorista (crédito 100 USD, 30 días)
update web_customers set "wholesaleStatus" = 'approved', "creditLimitUsd" = 100, "maxCreditDays" = 30
 where "userId" = '00000000-0000-0000-0000-0000000000d1';
select "wholesaleStatus" from web_customers where "userId" = '00000000-0000-0000-0000-0000000000d1';

-- @test mayorista: 5 cliente + 4 caja 12 + 3 contado + 3 zelle = 15 % -> 8.50; IGTF 3 % sobre 102
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select q->'lines'->0->>'unitPriceUsd' unit, q->'lines'->0->>'discountPct' pct, q->>'subtotalUsd' sub, q->>'igtfUsd' igtf,
       q->>'totalUsd' total, q->>'totalBs' bs, jsonb_array_length(q->'lines'->0->'appliedRules') reglas
from (select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 12)), 'zelle', 0) q) x;

-- @test mayorista bajo el mínimo de mayor compra a detal en esa línea
update inventory set "minWholesaleQty" = 6 where code = 'A1';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select q->'lines'->0->>'unitPriceUsd' unit, q->'lines'->0->>'belowWholesaleMin' bajo_minimo
from (select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 2)), 'pago_movil', 0) q) x;

-- @test tope por producto (4 %) y luego piso de margen (90 * 1.08 = 97.20)
update inventory set "maxDiscountPct" = 4 where code = 'B1';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select l->>'unitPriceUsd' unit, l->>'capped' tope, l->>'floored' piso
from (select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'B1'), 'quantity', 1)), 'zelle', 0)->'lines'->0 l) x;

-- @test descuento especial 7 % reemplaza la regla de cliente de 5 %
update web_customers set "specialDiscountPct" = 7 where "userId" = '00000000-0000-0000-0000-0000000000d1';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select r->>'name' regla, r->>'discountPct' pct
from jsonb_array_elements(price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 12)), 'pago_movil', 0)->'lines'->0->'appliedRules') r
where r->>'kind' = 'customer';

-- @test crédito: detal no puede
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select (select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 1)), 'credito', 15)->'errors'->0->>'code') detal;

-- @test crédito: mayorista fuera de plazo, sobre el límite y válido
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select (select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 6)), 'credito', 45)->'errors'->0->>'code') plazo,
       (select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 15)), 'credito', 30)->'errors'->0->>'message') limite,
       (select jsonb_array_length(price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 6)), 'credito', 30)->'errors')) ok;

-- @test IVA no incluido: suma el % de cada producto
update settings set data = data || '{"pricesIncludeIva": false}' where id = 'tienda_privada';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select q->>'taxUsd' iva, q->>'totalUsd' total
from (select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'B1'), 'quantity', 1)), 'pago_movil') q) x;

-- @test delivery: tarifa por zona y gratis desde 50
update settings set data = data || '{"pricesIncludeIva": true}' where id = 'tienda_privada';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select (price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 2)), 'pago_movil', 0, 'delivery', 'Norte')->>'deliveryFeeUsd') fee_20,
       (price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 6)), 'pago_movil', 0, 'delivery', 'Norte')->>'deliveryFeeUsd') fee_60,
       (price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 1)), 'pago_movil', 0, 'delivery', 'Marte')->'errors'->0->>'code') zona_mala;

-- @fails delivery sin zona
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 1)), 'pago_movil', 'delivery');

-- @fails delivery sin dirección completa
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 1)), 'pago_movil', 'delivery', delivery_zone => 'Norte', address => '{"fullName":"Ana"}');

-- @fails método de pago apagado
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 1)), 'binance', 'retiro');

-- @test pedido de la última unidad: queda PENDIENTE_PAGO y reserva el stock
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select o->>'number' numero, o->>'status' estado, o->>'totalUsd' total,
       (select available from catalog_products where code = 'F1') disponible_despues
from (select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'F1'), 'quantity', 1)), 'pago_movil', 'retiro') o) x;

-- @fails otro cliente no puede pedir la unidad reservada
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select register_customer('Otro', 'V87654321', '04140000000');
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'F1'), 'quantity', 1)), 'pago_movil', 'retiro');

-- @fails el POS tampoco vende la unidad apartada
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('productId', (select id from inventory where code = 'F1'), 'quantity', 1)), 'total', 8));

-- @test otro cliente no ve el pedido ajeno
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select my_order('WEB-000001') is null as no_lo_ve, (select count(*) from web_orders) filas, (select count(*) from web_order_items) items;

-- @test el dueño ve su pedido completo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select o->>'number' n, jsonb_array_length(o->'items') items, o->'items'->0->>'productName' producto,
       jsonb_array_length(o->'events') eventos, o ? 'userId' as expone_user
from (select my_order('WEB-000001') o) x;

-- @fails comprobante en carpeta ajena
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select report_payment('WEB-000001', 'pago_movil', 1600, 'VES', '123456', current_date, null, '00000000-0000-0000-0000-0000000000e1/x.jpg');

-- @test reportar pago: PAGO_REPORTADO y la reserva no vence
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select o->>'status' estado, jsonb_array_length(o->'payments') pagos,
       (select count(*) from web_orders) mis_pedidos
from (select report_payment('WEB-000001', 'pago_movil', 1600, 'VES', '123456', current_date, 'BDV', '00000000-0000-0000-0000-0000000000c1/WEB-000001/c.jpg') o) x;

-- @test reserva infinita tras reportar
select "expiresAt" = 'infinity' as infinita from stock_reservations
 where "orderId" = (select id from web_orders where number = 'WEB-000001');

-- @test cancelar libera la reserva
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 3)), 'efectivo', 'retiro')->>'status' as estado;
select available as con_reserva from catalog_products where code = 'A1';

-- @test cancelar: estado CANCELADO
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select cancel_my_order('WEB-000002')->>'status' estado;

-- @test cancelar: el stock vuelve (20 total, 0 apartado)
select available as despues from catalog_products where code = 'A1';

-- @test expirar pedidos vencidos
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 2)), 'pago_movil', 'retiro')->>'number';
reset role;
update web_orders set "reservedUntil" = now() - interval '1 minute' where number = 'WEB-000003';
select expire_reservations() expirados;

-- @test expirado: estado y reservas liberadas
select (select status from web_orders where number = 'WEB-000003') estado,
       (select count(*) from stock_reservations where "orderId" = (select id from web_orders where number = 'WEB-000003') and not released) reservas_activas,
       (select note from web_order_events where "orderId" = (select id from web_orders where number = 'WEB-000003') order by id desc limit 1) evento;

-- @fails anon no ejecuta expire_reservations
set role anon;
select expire_reservations();

-- @test crédito del mayorista y pedido a crédito sin vencimiento
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 6)), 'credito', 'retiro', 30)->>'status' estado;

-- @test crédito: usado y disponible después del pedido; sin vencimiento
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select my_credit()->>'usedUsd' usado, my_credit()->>'availableUsd' disponible,
       (select "reservedUntil" is null from web_orders where number = 'WEB-000004') sin_vencimiento;

-- @test crédito: la reserva no vence hasta que el personal confirme (vista del personal)
select "expiresAt" = 'infinity' as reserva_infinita from stock_reservations
 where "orderId" = (select id from web_orders where number = 'WEB-000004');

-- @fails tienda cerrada no recibe pedidos
update settings set data = data || '{"storeOpen": false}' where id = 'tienda_publica';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 1)), 'pago_movil', 'retiro');
