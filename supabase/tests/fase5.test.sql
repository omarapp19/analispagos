insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'admin@staff.valkar.local');
insert into staff_profiles ("userId", username, name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'Admin', 'administrador');
insert into inventory (code, name, quantity, "costPrice", "sellingPrice", "minStock") values
  ('P1', 'Pastillas', 10, 5, 10, 4), ('P2', 'Filtro', 3, 2, 3, 0);

-- @test venta con pagos mixtos descuenta stock y registra una transaccion por metodo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_create_invoice(jsonb_build_object('invoiceNumber','T-1','subtotal',20,'total',20,'clientName','X',
  'items', jsonb_build_array(jsonb_build_object('productId',(select id::text from inventory where code='P1'),'quantity',2,'price',10,'name','Pastillas')),
  'payments', jsonb_build_array(jsonb_build_object('method','Efectivo','amount',5), jsonb_build_object('method','Transferencia','amount',15)))) ->> 'paymentMethod' as metodo;
select (select quantity from inventory where code='P1') as stock,
       (select count(*) from transactions where note like 'Factura T-1%') as txs,
       (select "createdBy" from client_invoices where "invoiceNumber"='T-1') as vendedor;

-- @fails pagos que no suman el total
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_create_invoice(jsonb_build_object('invoiceNumber','T-2','subtotal',10,'total',10,
  'items', jsonb_build_array(jsonb_build_object('productId',(select id::text from inventory where code='P1'),'quantity',1,'price',10)),
  'payments', jsonb_build_array(jsonb_build_object('method','Efectivo','amount',4))));

-- @fails sin stock sin permiso de stock negativo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_create_invoice(jsonb_build_object('invoiceNumber','T-3','subtotal',30,'total',30,
  'items', jsonb_build_array(jsonb_build_object('productId',(select id::text from inventory where code='P2'),'quantity',5,'price',3))));

-- @test con allowNegativeStock pasa y queda marcada para revision
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_create_invoice(jsonb_build_object('invoiceNumber','OFF-000001','subtotal',15,'total',15,'allowNegativeStock',true,
  'items', jsonb_build_array(jsonb_build_object('productId',(select id::text from inventory where code='P2'),'quantity',5,'price',3)))) ->> 'needsReview' as revisar;
select quantity from inventory where code='P2';

-- @test credito y cobro atomico
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_create_invoice(jsonb_build_object('invoiceNumber','C-1','subtotal',10,'total',10,'isCredit',true,'creditDays',15,
  'items', jsonb_build_array(jsonb_build_object('productId',(select id::text from inventory where code='P1'),'quantity',1,'price',10)))) ->> 'status' as antes;
select erp_pay_invoice((select id::text from client_invoices where "invoiceNumber"='C-1'), 'Efectivo') ->> 'status' as despues;
select count(*) as txs_cobro from transactions where note like 'Cobro Factura C-1%';

-- @fails no se cobra dos veces
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_pay_invoice((select id::text from client_invoices where "invoiceNumber"='C-1'), 'Efectivo');

-- @test devolucion parcial repone stock y reembolsa
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select (select quantity from inventory where code='P1') as antes;
select erp_return_invoice((select id::text from client_invoices where "invoiceNumber"='T-1'),
  jsonb_build_array(jsonb_build_object('productId',(select id::text from inventory where code='P1'),'quantity',1)), 'Cliente se arrepintió') ->> 'status' as estado;
select (select quantity from inventory where code='P1') as despues,
       (select amount from transactions where type='EXPENSE' and category='Devolución' limit 1) as reembolso;

-- @fails no se devuelve mas de lo vendido
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_return_invoice((select id::text from client_invoices where "invoiceNumber"='T-1'),
  jsonb_build_array(jsonb_build_object('productId',(select id::text from inventory where code='P1'),'quantity',5)), 'x');

-- @test devolver el resto anula la factura
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_return_invoice((select id::text from client_invoices where "invoiceNumber"='T-1'),
  jsonb_build_array(jsonb_build_object('productId',(select id::text from inventory where code='P1'),'quantity',1)), 'resto') ->> 'status' as estado;

-- @fails anulacion exige motivo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_return_invoice((select id::text from client_invoices where "invoiceNumber"='C-1'), null, '');

-- @test anular factura completa
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_return_invoice((select id::text from client_invoices where "invoiceNumber"='OFF-000001'), null, 'error de cajero') ->> 'status' as estado;
select quantity from inventory where code='P2';

-- @test cierre de caja con diferencia
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select cash_open(10, 'turno') ->> 'status' as abierta;
select erp_create_invoice(jsonb_build_object('invoiceNumber','K-1','subtotal',6,'total',6,'paymentMethod','Efectivo',
  'items', jsonb_build_array(jsonb_build_object('productId',(select id::text from inventory where code='P1'),'quantity',1,'price',6)))) ->> 'invoiceNumber' as vendida;
select cash_current() -> 'expected' as esperado;
select cash_close(jsonb_build_object('Efectivo', 15), 'cuadre') ->> 'difference' as diferencia;

-- @fails no se abren dos cajas
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select cash_open(0); select cash_open(0);

-- @test reportes responden
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select jsonb_array_length(report_restock(30)) as restock, jsonb_array_length(report_slow_movers(90)) as lentos,
       jsonb_array_length(report_margin_alerts(10)) as margenes, jsonb_array_length(report_receivables_aging()) as cxc,
       report_sales(current_date - 30, current_date) -> 'summary' as ventas;

-- @test auditoria registra cambios de precio y anulaciones
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update inventory set "sellingPrice" = 12 where code = 'P1';
select action, count(*) from audit_log group by 1 order by 1;

-- @fails anon no ejecuta reportes
set role anon;
select report_sales(current_date, current_date);

-- @test cajero
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000b', 'cajero@staff.valkar.local');
insert into staff_profiles ("userId", username, name, role) values ('00000000-0000-0000-0000-00000000000b', 'cajero', 'Cajero', 'cajero');

-- @fails cajero no anula facturas
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select erp_return_invoice((select id::text from client_invoices where "invoiceNumber"='K-1'), null, 'x');

-- @fails cajero no ve reportes
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select report_restock(30);

-- @test cajero si abre caja
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select cash_open(5) ->> 'status' as abierta;

-- @test ajuste atomico y conteo fisico
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_adjust_stock((select id::text from inventory where code='P1'), -2, 'Ajuste manual: merma') as ajuste;
select erp_apply_stock_count(jsonb_build_array(
  jsonb_build_object('productId',(select id::text from inventory where code='P1'),'counted',20),
  jsonb_build_object('productId',(select id::text from inventory where code='P2'),'counted',(select quantity from inventory where code='P2'))), 'inventario mensual') as conteo;
select quantity from inventory where code='P1';
select concept from kardex where concept like 'Conteo físico%' limit 1;

-- @fails cajero no ajusta stock
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select erp_adjust_stock((select id::text from inventory where code='P1'), 1, 'x');

-- @fails ajuste exige motivo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select erp_adjust_stock((select id::text from inventory where code='P1'), 1, '');
