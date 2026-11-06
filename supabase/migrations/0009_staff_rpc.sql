-- Fase 4 / 0009: gestión de la tienda desde el ERP (pedidos web, pagos, mayoristas, simulador de precios).
-- Todas exigen personal autenticado (is_staff); la revisión de mayoristas exige administrador o supervisor.

-- ---------- Lecturas del personal ----------
-- Lista de pedidos con el cliente. security_invoker: aplica la RLS de quien consulta, y además solo personal.
create or replace view public.staff_web_orders with (security_invoker = true) as
select o.id, o.number, o.status, o."customerType", o."paymentMethod", o."creditDays", o."deliveryMethod",
       o."deliveryZone", o.carrier, o."trackingNumber", o."totalUsd", o."totalBs", o."bcvRate",
       o."reservedUntil", o."createdAt", o."updatedAt", o."invoiceId",
       w."fullName" as "customerName", w.phone as "customerPhone",
       c.name as "clientName", c."documentId",
       (select count(*)::int from public.web_payment_reports p where p."orderId" = o.id and p.status = 'pendiente') as "pendingPayments",
       (select ci."invoiceNumber" from public.client_invoices ci where ci.id = o."invoiceId") as "invoiceNumber"
from public.web_orders o
left join public.web_customers w on w."userId" = o."userId"
left join public.clients c on c.id = o."clientId"
where public.is_staff();

revoke all on public.staff_web_orders from anon;
grant select on public.staff_web_orders to authenticated;

create or replace function public.staff_order_detail(order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_id uuid := order_id;
  v_out jsonb;
begin
  if not is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select store_order_json(o.id) || jsonb_build_object(
           'staffNotes', o."staffNotes",
           'invoiceId', o."invoiceId",
           'facturaFiscal', coalesce((store_setting('tienda_privada')->>'facturaFiscal')::boolean, false),
           'customer', jsonb_build_object(
             'userId', o."userId", 'fullName', w."fullName", 'phone', w.phone, 'email', u.email,
             'documentId', c."documentId", 'clientName', c.name, 'clientPhone', c.phone,
             'customerType', w."customerType", 'wholesaleStatus', w."wholesaleStatus",
             'businessName', w."businessName", 'rif', w.rif))
    into v_out
    from web_orders o
    left join web_customers w on w."userId" = o."userId"
    left join auth.users u on u.id = o."userId"
    left join clients c on c.id = o."clientId"
   where o.id = v_id;
  return v_out;
end $$;

create or replace function public.staff_wholesale_customers() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'userId', w."userId", 'fullName', w."fullName", 'phone', w.phone, 'email', u.email,
             'documentId', c."documentId", 'clientName', c.name,
             'customerType', w."customerType", 'wholesaleStatus', w."wholesaleStatus",
             'businessName', w."businessName", 'rif', w.rif, 'rifDocument', w."rifDocument",
             'creditLimitUsd', w."creditLimitUsd", 'maxCreditDays', w."maxCreditDays",
             'specialDiscountPct', w."specialDiscountPct", 'wholesaleNote', w."wholesaleNote",
             'creditUsedUsd', round(store_credit_used(w."clientId"), 2),
             'approvedAt', w."approvedAt", 'createdAt', w."createdAt")
           order by (w."wholesaleStatus" = 'pending') desc, w."createdAt" desc)
    from web_customers w
    left join auth.users u on u.id = w."userId"
    left join clients c on c.id = w."clientId"
    where w."customerType" = 'mayor' or w."wholesaleStatus" <> 'none'), '[]'::jsonb);
end $$;

-- Simulador de Reglas de precio: la misma cotización que verá ese cliente (null = visitante sin cuenta).
create or replace function public.staff_price_quote(
  customer_user_id uuid, items jsonb, payment_method text default null, credit_days int default 0,
  delivery_method text default null, delivery_zone text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return store_quote_for(customer_user_id, items, payment_method, credit_days, delivery_method, delivery_zone);
end $$;

-- ---------- Confirmar y facturar ----------
-- En una transacción: libera la reserva, factura con erp_create_invoice (descuenta stock, kardex SALIDA,
-- client_invoices y caja si es de contado), guarda invoiceId y pasa a CONFIRMADO.
create or replace function public.staff_confirm_order(order_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_id uuid := order_id;
  v_order web_orders%rowtype;
  v_cust web_customers%rowtype;
  v_client_name text;
  v_items jsonb;
  v_extra jsonb := '[]'::jsonb;
  v_method text;
  v_invoice jsonb;
begin
  if not is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_order from web_orders where id = v_id for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;
  if v_order.status not in ('PENDIENTE_PAGO', 'POR_CONFIRMAR', 'PAGO_REPORTADO') then
    raise exception 'El pedido % está %: no se puede confirmar.', v_order.number, v_order.status;
  end if;

  if v_order."paymentMethod" = 'credito' then
    select * into v_cust from web_customers where "userId" = v_order."userId";
    if not found or v_cust."wholesaleStatus" <> 'approved' then
      raise exception 'El cliente ya no es mayorista aprobado: no se puede vender a crédito.';
    end if;
    -- store_credit_used ya incluye este pedido (por confirmar, sin factura).
    if store_credit_used(v_cust."clientId") > v_cust."creditLimitUsd" + 0.01 then
      raise exception 'El pedido supera el límite de crédito del cliente (% USD).', v_cust."creditLimitUsd";
    end if;
  end if;

  -- La reserva del pedido deja de contar antes de facturar: el stock se descuenta en erp_create_invoice.
  update stock_reservations set released = true where "orderId" = v_order.id and not released;

  select coalesce(jsonb_agg(jsonb_build_object(
           'productId', it."productId", 'name', it."productName", 'code', it.code,
           'quantity', it.quantity, 'price', it."unitPriceUsd", 'total', it."lineTotalUsd",
           'unitBaseUsd', it."unitBaseUsd", 'discountPct', it."discountPct",
           'taxPercentage', coalesce(i."taxPercentage", 16)) order by it."productName"), '[]'::jsonb)
    into v_items
    from web_order_items it left join inventory i on i.id = it."productId"
   where it."orderId" = v_order.id;

  if v_order."deliveryFeeUsd" > 0 then
    v_extra := v_extra || jsonb_build_object('name', 'Delivery ' || coalesce('zona ' || v_order."deliveryZone", ''),
      'quantity', 1, 'price', v_order."deliveryFeeUsd", 'total', v_order."deliveryFeeUsd", 'taxPercentage', 0);
  end if;
  if v_order."igtfUsd" > 0 then
    v_extra := v_extra || jsonb_build_object('name', 'IGTF', 'quantity', 1, 'price', v_order."igtfUsd",
      'total', v_order."igtfUsd", 'taxPercentage', 0);
  end if;

  -- Nombres de método como los del POS (Finanzas los agrupa por este texto). El crédito va con "-" como en el POS.
  v_method := case v_order."paymentMethod"
                when 'pago_movil' then 'Pago Móvil'
                when 'transferencia' then 'Transferencia'
                when 'zelle' then 'Zelle'
                when 'binance' then 'Binance'
                when 'efectivo' then 'Divisas'
                else '-'
              end;
  select name into v_client_name from clients where id = v_order."clientId";

  v_invoice := erp_create_invoice(jsonb_build_object(
    'clientId', v_order."clientId",
    'clientName', coalesce(v_client_name, 'Cliente web'),
    'items', v_items,
    'subtotal', v_order."totalUsd" - v_order."taxUsd",
    'total', v_order."totalUsd",
    'isCredit', v_order."paymentMethod" = 'credito',
    'creditDays', v_order."creditDays",
    'paymentMethod', v_method,
    'kardexConcept', 'Venta web ' || v_order.number));

  -- Líneas sin producto (delivery, IGTF) solo para el comprobante: no mueven stock.
  if jsonb_array_length(v_extra) > 0 then
    update client_invoices set items = items || v_extra where id::text = v_invoice->>'id';
  end if;

  update web_payment_reports
     set status = 'aprobado', "reviewedBy" = auth.uid(), "reviewedAt" = now()
   where "orderId" = v_order.id and status = 'pendiente';

  update web_orders
     set status = 'CONFIRMADO', "invoiceId" = (v_invoice->>'id')::erp_invoice_id, "reservedUntil" = null, "updatedAt" = now()
   where id = v_order.id;

  insert into web_order_events ("orderId", status, note, "byStaff")
  values (v_order.id, 'CONFIRMADO', 'Pago verificado. Factura ' || (v_invoice->>'invoiceNumber') || '.', true);

  return staff_order_detail(v_order.id);
end $$;

-- ---------- Revisar comprobantes ----------
create or replace function public.staff_review_payment(report_id uuid, approve boolean, note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_report_id uuid := report_id;
  v_approve boolean := coalesce(approve, false);
  v_note text := left(nullif(btrim(coalesce(note, '')), ''), 500);
  v_report web_payment_reports%rowtype;
  v_order web_orders%rowtype;
  v_paid_usd numeric;
  v_missing numeric;
  v_until timestamptz;
begin
  if not is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_report from web_payment_reports where id = v_report_id for update;
  if not found then
    raise exception 'Comprobante no encontrado';
  end if;
  select * into v_order from web_orders where id = v_report."orderId" for update;
  if v_report.status <> 'pendiente' then
    raise exception 'Este comprobante ya fue revisado.';
  end if;
  if v_order.status <> 'PAGO_REPORTADO' then
    raise exception 'El pedido % está %.', v_order.number, v_order.status;
  end if;
  if not v_approve and v_note is null then
    raise exception 'Indica el motivo del rechazo: el cliente lo verá.';
  end if;

  update web_payment_reports
     set status = case when v_approve then 'aprobado' else 'rechazado' end,
         "reviewedBy" = auth.uid(), "reviewedAt" = now(), "reviewNote" = v_note
   where id = v_report.id;

  -- Total pagado (aprobado) en USD: los pagos en Bs se convierten a la tasa congelada del pedido.
  select coalesce(sum(case when currency = 'USD' then amount else amount / nullif(v_order."bcvRate", 0) end), 0)
    into v_paid_usd
    from web_payment_reports where "orderId" = v_order.id and status = 'aprobado';
  v_missing := round(v_order."totalUsd" - v_paid_usd, 2);

  if v_approve and v_missing <= 0.05 then
    return staff_confirm_order(v_order.id);
  end if;

  -- Rechazado o pago parcial: vuelve a esperar pago (salvo que haya otro comprobante sin revisar).
  if exists (select 1 from web_payment_reports where "orderId" = v_order.id and status = 'pendiente') then
    insert into web_order_events ("orderId", status, note, "byStaff")
    values (v_order.id, 'PAGO_REPORTADO',
            case when v_approve then 'Pago aprobado. Falta ' || to_char(v_missing, 'FM999999990.00') || ' USD.'
                 else 'Un pago fue rechazado: ' || v_note end, true);
  else
    v_until := now() + make_interval(hours => coalesce((store_setting('tienda_publica')->>'reservationHours')::int, 24));
    update web_orders set status = 'PENDIENTE_PAGO', "reservedUntil" = v_until, "updatedAt" = now() where id = v_order.id;
    update stock_reservations set "expiresAt" = v_until where "orderId" = v_order.id and not released;
    insert into web_order_events ("orderId", status, note, "byStaff")
    values (v_order.id, 'PENDIENTE_PAGO',
            case when v_approve then 'Recibimos un pago parcial. Falta ' || to_char(v_missing, 'FM999999990.00') || ' USD (' ||
                                     to_char(round(v_missing * v_order."bcvRate", 2), 'FM999999990.00') || ' Bs).'
                 else 'Tu pago no se pudo verificar: ' || v_note end, true);
  end if;

  return staff_order_detail(v_order.id);
end $$;

-- ---------- Avanzar estados (spec 4.6) ----------
create or replace function public.staff_set_order_status(
  order_id uuid, status text, note text default null, tracking text default null, carrier text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_id uuid := order_id;
  v_to text := status;
  v_note text := left(nullif(btrim(coalesce(note, '')), ''), 500);
  v_tracking text := left(nullif(btrim(coalesce(tracking, '')), ''), 100);
  v_carrier text := left(nullif(btrim(coalesce(carrier, '')), ''), 60);
  v_order web_orders%rowtype;
  v_allowed text[];
begin
  if not is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_order from web_orders where id = v_id for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  v_allowed := case v_order.status
    when 'PENDIENTE_PAGO' then array['CANCELADO']
    when 'POR_CONFIRMAR'  then array['CANCELADO']
    when 'PAGO_REPORTADO' then array['CANCELADO']
    when 'CONFIRMADO'     then array['PREPARANDO']
    when 'PREPARANDO'     then array[case v_order."deliveryMethod" when 'retiro' then 'LISTO_RETIRO'
                                                                  when 'delivery' then 'EN_CAMINO'
                                                                  else 'ENVIADO' end]
    when 'LISTO_RETIRO'   then array['ENTREGADO']
    when 'EN_CAMINO'      then array['ENTREGADO']
    when 'ENVIADO'        then array['ENTREGADO']
    else array[]::text[]
  end;
  if v_to is null or not v_to = any(v_allowed) then
    raise exception 'No se puede pasar de % a %.', v_order.status, coalesce(v_to, '(vacío)');
  end if;
  if v_to = 'ENVIADO' and (v_tracking is null or coalesce(v_carrier, v_order.carrier) is null) then
    raise exception 'Para marcar como enviado indica el transportista y el número de guía.';
  end if;

  update web_orders
     set status = v_to,
         "trackingNumber" = case when v_to = 'ENVIADO' then v_tracking else "trackingNumber" end,
         carrier = case when v_to = 'ENVIADO' then coalesce(v_carrier, carrier) else carrier end,
         "reservedUntil" = case when v_to = 'CANCELADO' then null else "reservedUntil" end,
         "updatedAt" = now()
   where id = v_order.id;

  if v_to = 'CANCELADO' then
    update stock_reservations set released = true where "orderId" = v_order.id and not released;
  end if;

  insert into web_order_events ("orderId", status, note, "byStaff")
  values (v_order.id, v_to, coalesce(v_note, case v_to
    when 'PREPARANDO'   then 'Estamos preparando tu pedido.'
    when 'LISTO_RETIRO' then 'Tu pedido te espera en la tienda.'
    when 'EN_CAMINO'    then 'El delivery va hacia tu dirección.'
    when 'ENVIADO'      then 'Tu pedido salió por ' || coalesce(v_carrier, v_order.carrier) || '. Guía: ' || v_tracking || '.'
    when 'ENTREGADO'    then 'Pedido entregado. ¡Gracias por tu compra!'
    when 'CANCELADO'    then 'El pedido fue cancelado.'
  end), true);

  return staff_order_detail(v_order.id);
end $$;

create or replace function public.staff_set_order_notes(order_id uuid, notes text) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_id uuid := order_id;
  v_notes text := left(nullif(btrim(coalesce(notes, '')), ''), 2000);
begin
  if not is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update web_orders set "staffNotes" = v_notes, "updatedAt" = now() where id = v_id;
end $$;

-- ---------- Mayoristas ----------
create or replace function public.staff_review_wholesale(
  user_id uuid, approve boolean, credit_limit numeric default 0, max_credit_days int default 0,
  special_discount_pct numeric default 0, note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_user uuid := user_id;
  v_approve boolean := coalesce(approve, false);
  v_limit numeric := round(coalesce(credit_limit, 0), 2);
  v_days int := coalesce(max_credit_days, 0);
  v_special numeric := round(coalesce(special_discount_pct, 0), 2);
  v_note text := left(nullif(btrim(coalesce(note, '')), ''), 500);
begin
  if not is_admin() then
    raise exception 'Solo administrador o supervisor revisan mayoristas.' using errcode = '42501';
  end if;
  if v_limit < 0 or v_days < 0 or v_special < 0 or v_special > 100 then
    raise exception 'Revisa el límite, los días y el descuento especial.';
  end if;
  if not v_approve and v_note is null then
    raise exception 'Indica el motivo del rechazo: el cliente lo verá.';
  end if;

  update web_customers
     set "customerType" = case when v_approve then 'mayor' else 'detal' end,
         "wholesaleStatus" = case when v_approve then 'approved' else 'rejected' end,
         "creditLimitUsd" = case when v_approve then v_limit else 0 end,
         "maxCreditDays" = case when v_approve then v_days else 0 end,
         "specialDiscountPct" = case when v_approve then v_special else 0 end,
         "wholesaleNote" = v_note,
         "approvedBy" = case when v_approve then auth.uid() end,
         "approvedAt" = case when v_approve then coalesce("approvedAt", now()) end,
         "updatedAt" = now()
   where "userId" = v_user;
  if not found then
    raise exception 'Cliente no encontrado';
  end if;
  return staff_wholesale_customers();
end $$;

-- ---------- Permisos ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.staff_order_detail(uuid)',
    'public.staff_wholesale_customers()',
    'public.staff_price_quote(uuid, jsonb, text, int, text, text)',
    'public.staff_confirm_order(uuid)',
    'public.staff_review_payment(uuid, boolean, text)',
    'public.staff_set_order_status(uuid, text, text, text, text)',
    'public.staff_set_order_notes(uuid, text)',
    'public.staff_review_wholesale(uuid, boolean, numeric, int, numeric, text)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
