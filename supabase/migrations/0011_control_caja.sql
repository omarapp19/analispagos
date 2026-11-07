-- 0011: control de caja y descuentos por método de pago.
--  * client_invoices guarda el descuento aplicado; el RPC solo lo acepta si coincide con el configurado.
--  * Un cajero no puede facturar mientras no haya una caja abierta.
--  * Solo administrador o supervisor abren la caja (desde cualquier equipo); el cajero puede cerrarla con su arqueo.
--  * cash_sessions se publica en Realtime para que el POS del cajero se desbloquee solo al abrirla.

create or replace function public.erp_create_invoice(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username   text;
  v_number     text;
  v_is_credit  boolean := coalesce((payload->>'isCredit')::boolean, false);
  v_credit_days int    := coalesce((payload->>'creditDays')::int, 0);
  v_total      numeric := coalesce((payload->>'total')::numeric, 0);
  v_subtotal   numeric := coalesce((payload->>'subtotal')::numeric, 0);
  v_date       date    := coalesce(nullif(payload->>'date','')::date, (now() at time zone 'America/Caracas')::date);
  v_method     text    := coalesce(nullif(payload->>'paymentMethod',''), 'Efectivo');
  v_client_id  text    := nullif(payload->>'clientId','');
  v_client_name text   := coalesce(payload->>'clientName','');
  v_concept    text;
  v_items      jsonb   := coalesce(payload->'items','[]'::jsonb);
  v_line       record;
  v_prod       record;
  v_reserved   int;
  v_invoice    client_invoices%rowtype;
  v_review     boolean := false;
  v_disc_pct   numeric := coalesce(nullif(payload->>'discountPct','')::numeric, 0);
  v_disc_amt   numeric := coalesce(nullif(payload->>'discountAmount','')::numeric, 0);
  v_cfg_pct    numeric := 0;
  v_allow      boolean := coalesce((payload->>'allowNegativeStock')::boolean, false);
  v_payments   jsonb   := case when jsonb_typeof(payload->'payments') = 'array' and jsonb_array_length(payload->'payments') > 0 then payload->'payments' else null end;
  v_pay        record;
  v_paysum     numeric := 0;
begin
  if not is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- Un cajero solo factura con la caja abierta (la abre un administrador o supervisor, desde cualquier equipo).
  -- Excepciones: la confirmación de pedidos web (la hace staff_confirm_order por dentro) y las ventas hechas sin
  -- conexión, que se aceptan al sincronizar si en el momento de la venta había una caja abierta (offlineSoldAt).
  if staff_role() = 'cajero'
     and coalesce(current_setting('app.internal_invoice', true), '') <> '1'
     and not exists (select 1 from cash_sessions where status = 'OPEN')
     and not exists (
       select 1 from cash_sessions cs
        where nullif(payload->>'offlineSoldAt','') is not null
          and cs."openedAt" <= (payload->>'offlineSoldAt')::timestamptz
          and (cs."closedAt" is null or cs."closedAt" >= (payload->>'offlineSoldAt')::timestamptz)) then
    raise exception 'La caja está cerrada. Pide a un administrador que la abra.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'La factura no tiene productos';
  end if;
  if v_total < 0 or v_subtotal < 0 then
    raise exception 'Totales inválidos';
  end if;

  select username into v_username from staff_profiles where "userId" = auth.uid();

  if v_payments is not null and not v_is_credit then
    select coalesce(sum((p->>'amount')::numeric), 0) into v_paysum from jsonb_array_elements(v_payments) p;
    if abs(v_paysum - v_total) > 0.01 then
      raise exception 'La suma de los pagos (%) no coincide con el total (%)', v_paysum, v_total;
    end if;
    if jsonb_array_length(v_payments) > 1 then v_method := 'Mixto';
    else v_method := coalesce(nullif(v_payments->0->>'method',''), v_method); end if;
  end if;

  -- Descuento por método de pago: solo el configurado en Configuración (settings.global_settings.paymentMethods).
  if v_disc_pct < 0 or v_disc_amt < 0 then raise exception 'Descuento inválido'; end if;
  if v_disc_pct > 0 or v_disc_amt > 0 then
    if v_is_credit or v_method = 'Mixto' then
      raise exception 'El descuento por método de pago solo aplica a ventas de contado con un solo método';
    end if;
    select coalesce(max((m->>'discountPct')::numeric), 0) into v_cfg_pct
      from settings st, jsonb_array_elements(coalesce(st.data->'paymentMethods', '[]'::jsonb)) m
     where st.id = 'global_settings' and m->>'name' = v_method and coalesce((m->>'enabled')::boolean, true);
    if v_disc_pct > v_cfg_pct + 0.001 then
      raise exception 'El descuento de % % no está autorizado para el método %', v_disc_pct, '%', v_method;
    end if;
    if v_disc_amt > (v_total + v_disc_amt) * v_cfg_pct / 100 + 0.01 then
      raise exception 'El monto de descuento excede el autorizado para el método %', v_method;
    end if;
  end if;

  v_number := nullif(btrim(coalesce(payload->>'invoiceNumber','')), '');
  if v_number is null then
    v_number := 'FAC-' || lpad(nextval('invoice_seq')::text, 6, '0');
  elsif exists (select 1 from client_invoices where "invoiceNumber" = v_number) then
    raise exception 'El número de factura % ya existe', v_number;
  end if;

  v_concept := coalesce(nullif(payload->>'kardexConcept',''), 'Venta - Factura #' || v_number);

  for v_line in
    select (e->>'productId') as product_id, sum(coalesce((e->>'quantity')::int, 0)) as qty
    from jsonb_array_elements(v_items) e
    group by 1
    order by 1
  loop
    if v_line.qty <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    select * into v_prod from inventory where id::text = v_line.product_id for update;
    if not found then
      raise exception 'Producto % no existe', v_line.product_id;
    end if;

    if coalesce(v_prod."productType",'product') = 'product' then
      select coalesce(sum(s.quantity), 0) into v_reserved
        from stock_reservations s
       where s."productId" = v_prod.id and not s.released and s."expiresAt" > now();

      if coalesce(v_prod.quantity,0) - v_reserved < v_line.qty and v_allow then
        v_review := true;  -- venta ya entregada (modo sin conexión): se permite stock negativo y se marca para revisión
      elsif coalesce(v_prod.quantity,0) - v_reserved < v_line.qty then
        raise exception '%', format('Sin stock suficiente para "%s": disponible %s%s, solicitado %s',
          v_prod.name, greatest(coalesce(v_prod.quantity,0) - v_reserved, 0),
          case when v_reserved > 0 then ' (' || v_reserved || ' apartados en pedidos web)' else '' end,
          v_line.qty)
          using errcode = 'P0001';
      end if;

      update inventory
         set quantity = quantity - v_line.qty, "updatedAt" = now()
       where id = v_prod.id;

      insert into kardex ("productId","productName",type,quantity,concept,"user")
      values (v_prod.id, v_prod.name, 'SALIDA', v_line.qty, v_concept, coalesce(v_username,'Sistema'));
    end if;
  end loop;

  insert into client_invoices
    ("invoiceNumber","clientId","clientName", items, subtotal, total,
     "isCredit","creditDays", status, "paymentMethod", date, payments, "createdBy", "needsReview", "discountPct", "discountAmount")
  values
    (v_number, (select c.id from clients c where c.id::text = v_client_id), v_client_name, v_items, v_subtotal, v_total,
     v_is_credit, v_credit_days,
     case when v_is_credit then 'PENDING' else 'PAID' end,
     v_method, v_date, v_payments, coalesce(v_username,'Sistema'), v_review, v_disc_pct, v_disc_amt)
  returning * into v_invoice;

  if not v_is_credit then
    if v_payments is not null then
      for v_pay in select p->>'method' as method, (p->>'amount')::numeric as amount from jsonb_array_elements(v_payments) p loop
        if v_pay.amount > 0 then
          insert into transactions (amount, method, date, note, type, category, status)
          values (v_pay.amount, coalesce(nullif(v_pay.method,''),'Efectivo'), v_date,
                  'Factura ' || v_number || ' - Cliente: ' || v_client_name,
                  'INCOME', 'Venta', 'COMPLETED');
        end if;
      end loop;
    else
      insert into transactions (amount, method, date, note, type, category, status)
      values (v_total, v_method, v_date,
              'Factura ' || v_number || ' - Cliente: ' || v_client_name,
              'INCOME', 'Venta', 'COMPLETED');
    end if;
  end if;

  return to_jsonb(v_invoice);
end;
$$;

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

  -- Pedido web: no es una venta de mostrador, así que no depende de que haya caja abierta.
  perform set_config('app.internal_invoice', '1', true);
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

create or replace function public.cash_open(p_float numeric default 0, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v cash_sessions%rowtype; v_user text;
begin
  if not is_admin() then raise exception 'Solo un administrador o supervisor puede abrir la caja' using errcode = '42501'; end if;
  if coalesce(p_float,0) < 0 then raise exception 'Fondo inválido'; end if;
  if exists (select 1 from cash_sessions where status = 'OPEN') then raise exception 'Ya hay una caja abierta'; end if;
  select username into v_user from staff_profiles where "userId" = auth.uid();
  insert into cash_sessions ("openedBy","openingFloat",notes) values (coalesce(v_user,'Sistema'), coalesce(p_float,0), p_notes) returning * into v;
  perform audit_write('CASH_OPEN', 'cash_sessions', v.id, jsonb_build_object('float', v."openingFloat"));
  return to_jsonb(v);
end $$;

revoke all on function public.erp_create_invoice(jsonb) from public, anon;
grant execute on function public.erp_create_invoice(jsonb) to authenticated;
revoke all on function public.cash_open(numeric, text) from public, anon;
grant execute on function public.cash_open(numeric, text) to authenticated;

alter table public.client_invoices add column if not exists "discountPct" numeric not null default 0, add column if not exists "discountAmount" numeric not null default 0;
alter table public.cash_sessions add column if not exists "countedNative" jsonb, add column if not exists rate numeric;

drop function if exists public.cash_close(jsonb, text);
-- p_counted: lo contado por método convertido a USD, ej. {"Efectivo": 120.5}.
-- p_native: lo recibido en la moneda original, ej. {"Efectivo": {"amount": 30000, "currency": "VES"}}, y p_rate = tasa usada.
create or replace function public.cash_close(p_counted jsonb, p_notes text default null, p_native jsonb default null, p_rate numeric default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v cash_sessions%rowtype; v_user text; v_exp jsonb; v_diff numeric := 0; k text;
begin
  if not is_staff() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_counted is null or jsonb_typeof(p_counted) <> 'object' then raise exception 'Indica lo contado por método de pago'; end if;
  select * into v from cash_sessions where status = 'OPEN' for update;
  if not found then raise exception 'No hay caja abierta'; end if;
  select username into v_user from staff_profiles where "userId" = auth.uid();
  v.status := 'CLOSED'; v."closedAt" := now();
  v_exp := cash_expected(v);
  for k in select jsonb_object_keys(v_exp || p_counted) loop
    v_diff := v_diff + coalesce((p_counted->>k)::numeric, 0) - coalesce((v_exp->>k)::numeric, 0);
  end loop;
  update cash_sessions set status = 'CLOSED', "closedAt" = v."closedAt", "closedBy" = coalesce(v_user,'Sistema'),
         expected = v_exp, counted = p_counted, difference = round(v_diff, 2), notes = coalesce(p_notes, notes),
         "countedNative" = p_native, rate = p_rate
   where id = v.id returning * into v;
  perform audit_write('CASH_CLOSE', 'cash_sessions', v.id, jsonb_build_object('difference', v.difference, 'expected', v_exp, 'counted', p_counted));
  return to_jsonb(v);
end $$;
revoke all on function public.cash_close(jsonb, text, jsonb, numeric) from public, anon;
grant execute on function public.cash_close(jsonb, text, jsonb, numeric) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.cash_sessions;
exception when others then
  null; -- ya publicada, o el entorno no tiene Realtime
end $$;
