-- Fase 4: ciclo completo desde el ERP (pago -> aprobación -> factura -> preparando -> entregado),
-- pagos parciales y rechazados, efectivo, crédito, mayoristas y simulador.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@staff.valkar.local'),
  ('00000000-0000-0000-0000-00000000000b', 'caja@staff.valkar.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'ana@correo.com'),
  ('00000000-0000-0000-0000-0000000000d1', 'taller@correo.com');
insert into staff_profiles ("userId", username, name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'Admin', 'administrador'),
  ('00000000-0000-0000-0000-00000000000b', 'caja', 'Caja', 'cajero');
insert into inventory (code, name, brand, quantity, "costPrice", "sellingPrice", "webPublished", "categoryId") values
  ('A1', 'ACEITE 20W50', 'VALKAR', 20, 5, 10, true, (select id from categories where slug = 'aceites-de-motor'));
insert into settings (id, data) values ('exchange_rates', '{"bcv": 200}') on conflict (id) do update set data = excluded.data;
update settings set data = data || '{"storeOpen": true}'::jsonb
  || jsonb_build_object('payments', '{"pago_movil":{"enabled":true},"zelle":{"enabled":true},"efectivo":{"enabled":true}}'::jsonb)
  || jsonb_build_object('delivery', '{"retiro":{"enabled":true},"delivery":{"enabled":true,"zones":[{"name":"Norte","feeUsd":3}],"freeOverUsd":0},"envio_nacional":{"enabled":true,"carriers":["MRW"]}}'::jsonb)
  where id = 'tienda_publica';
insert into pricing_rules (name, kind, "discountPct", "appliesTo") values ('Mayor base', 'customer', 5, 'mayor');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select register_customer('Ana Pérez', 'V12345678', '04120000000');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select register_customer('Taller X', 'J294267319', '02617000000', true, 'Taller X C.A.', 'J294267319');
reset role;

-- @test cliente no ve la vista del personal; el personal ve el pedido con pago pendiente
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 2)), 'pago_movil', 'retiro')->>'number';
select report_payment('WEB-000001', 'pago_movil', 4000, 'VES', '555', current_date)->>'status';
select count(*) as cliente_ve from staff_web_orders;

-- @test el personal ve el pedido con un pago pendiente
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select number, status, "pendingPayments", "customerName" from staff_web_orders;

-- @fails un cliente no puede aprobar pagos
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select staff_review_payment((select id from web_payment_reports limit 1), true);

-- @test aprobar el pago (4000 Bs = 20 USD) confirma y factura
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select d->>'status' estado, d->>'invoiceNumber' factura, d->'payments'->0->>'status' pago
from (select staff_review_payment((select id from web_payment_reports where reference = '555'), true) d) x;

-- @test la factura descontó stock, registró kardex y caja, y liberó la reserva
select (select quantity from inventory where code = 'A1') stock,
       (select available from catalog_products where code = 'A1') disponible,
       (select concept from kardex order by date desc limit 1) kardex,
       (select type || ' ' || amount || ' ' || method from transactions order by "createdAt" desc limit 1) caja,
       (select "isCredit"::text || ' ' || status from client_invoices limit 1) factura;

-- @fails transición inválida (CONFIRMADO -> ENTREGADO)
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select staff_set_order_status((select id from web_orders where number = 'WEB-000001'), 'ENTREGADO');

-- @test preparando -> listo para retirar -> entregado
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select staff_set_order_status((select id from web_orders where number = 'WEB-000001'), 'PREPARANDO')->>'status';
select staff_set_order_status((select id from web_orders where number = 'WEB-000001'), 'LISTO_RETIRO')->>'status';
select staff_set_order_status((select id from web_orders where number = 'WEB-000001'), 'ENTREGADO')->>'status' as estado;

-- @test el cliente ve todo el historial y su número de factura
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select o->>'status' estado, o->>'invoiceNumber' factura, jsonb_array_length(o->'events') eventos,
       (select string_agg(e->>'status', ' > ') from jsonb_array_elements(o->'events') e) historial
from (select my_order('WEB-000001') o) x;

-- @test pago parcial: vuelve a PENDIENTE_PAGO con lo que falta
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 1)), 'zelle', 'retiro')->>'number';
select report_payment('WEB-000002', 'zelle', 4, 'USD', 'Z1', current_date)->>'status';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select d->>'status' estado, d->'events'->-1->>'note' nota
from (select staff_review_payment((select id from web_payment_reports where reference = 'Z1'), true) d) x;

-- @test el cliente reporta otro pago
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select report_payment('WEB-000002', 'zelle', 6, 'USD', 'Z2', current_date)->>'status' as estado;

-- @fails rechazar sin motivo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select staff_review_payment((select id from web_payment_reports where reference = 'Z2'), false);

-- @test rechazar con motivo: el cliente lo ve y puede reportar de nuevo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select d->>'status' estado, d->'events'->-1->>'note' nota
from (select staff_review_payment((select id from web_payment_reports where reference = 'Z2'), false, 'La referencia no aparece en Zelle') d) x;

-- @test completar el pago confirma (4 + 6 = 10 USD)
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select report_payment('WEB-000002', 'zelle', 6, 'USD', 'Z3', current_date)->>'status';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select staff_review_payment((select id from web_payment_reports where reference = 'Z3'), true)->>'status' as estado;

-- @test efectivo con delivery: confirmar factura como "Divisas" con línea de delivery
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 1)), 'efectivo', 'delivery',
  delivery_zone => 'Norte', address => '{"fullName":"Ana","phone":"0412","city":"Maracaibo","line1":"Calle 1"}')->>'status';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select staff_confirm_order((select id from web_orders where number = 'WEB-000003'))->>'status';
select "paymentMethod" metodo, total, jsonb_array_length(items) lineas, items->-1->>'name' ultima
from client_invoices where id = (select "invoiceId" from web_orders where number = 'WEB-000003');

-- @test delivery: preparando -> en camino
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select staff_set_order_status((select id from web_orders where number = 'WEB-000003'), 'PREPARANDO')->>'status';
select staff_set_order_status((select id from web_orders where number = 'WEB-000003'), 'EN_CAMINO')->>'status' as estado;

-- @test envío nacional confirmado y preparando
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 1)), 'zelle', 'envio_nacional',
  carrier => 'MRW', address => '{"fullName":"Ana","phone":"0412","state":"Lara","city":"Barquisimeto","line1":"Av 20"}')->>'number';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select staff_confirm_order((select id from web_orders where "deliveryMethod" = 'envio_nacional'))->>'status';
select staff_set_order_status((select id from web_orders where "deliveryMethod" = 'envio_nacional'), 'PREPARANDO')->>'status' as estado;

-- @fails ENVIADO sin guía
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select staff_set_order_status((select id from web_orders where "deliveryMethod" = 'envio_nacional'), 'ENVIADO');

-- @test ENVIADO con guía: el cliente ve transportista y guía
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select d->>'status' estado, d->>'trackingNumber' guia, d->'events'->-1->>'note' nota
from (select staff_set_order_status((select id from web_orders where "deliveryMethod" = 'envio_nacional'), 'ENVIADO', tracking => 'MRW-123') d) x;

-- @fails un cliente no revisa mayoristas
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select staff_review_wholesale('00000000-0000-0000-0000-0000000000d1', true, 100, 30, 0);

-- @fails el cajero no revisa mayoristas
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select staff_review_wholesale('00000000-0000-0000-0000-0000000000d1', true, 100, 30, 0);

-- @test el administrador aprueba al mayorista con crédito
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select w->>'wholesaleStatus' estado, w->>'creditLimitUsd' limite, w->>'maxCreditDays' dias, w->>'email' correo
from jsonb_array_elements(staff_review_wholesale('00000000-0000-0000-0000-0000000000d1', true, 100, 30, 2)) w;

-- @test simulador = lo que ve el cliente
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
create temp table q_cliente as select price_quote(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 3)), 'pago_movil') q;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select (select q from q_cliente) = staff_price_quote('00000000-0000-0000-0000-0000000000d1',
  jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 3)), 'pago_movil') as iguales,
  (select q->'lines'->0->>'unitPriceUsd' from q_cliente) unit;

-- @test crédito: la factura queda PENDING, sin ingreso en caja, y cuenta en el crédito usado
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 2)), 'credito', 'retiro', 30)->>'status';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
create temp table caja_antes as select count(*) n from transactions;
select staff_confirm_order((select id from web_orders where number = 'WEB-000005'))->>'status';

-- @test crédito: verificación
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select ci."isCredit", ci.status, ci."creditDays", ci."paymentMethod",
       (select count(*) from transactions) = (select n from caja_antes) as sin_ingreso_en_caja
from client_invoices ci where ci.id = (select "invoiceId" from web_orders where number = 'WEB-000005');

-- @test crédito usado ahora sale de la factura pendiente
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select my_credit()->>'usedUsd' usado, my_credit()->>'availableUsd' disponible;

-- @test el personal cancela un pedido sin pagar y libera la reserva
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select place_order(jsonb_build_array(jsonb_build_object('productId', (select id from catalog_products where code = 'A1'), 'quantity', 4)), 'pago_movil', 'retiro')->>'number';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select staff_set_order_status((select id from web_orders where number = 'WEB-000006'), 'CANCELADO', 'Sin stock físico')->>'status';
select count(*) as reservas_activas from stock_reservations
 where "orderId" = (select id from web_orders where number = 'WEB-000006') and not released;
