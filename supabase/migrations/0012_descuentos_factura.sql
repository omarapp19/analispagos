-- 0012: descuentos a facturas (solo administrador).
--  * Al facturar: descuento especial independiente del método de pago (monto y motivo obligatorio).
--  * Sobre facturas a crédito pendientes: erp_discount_invoice (p. ej. descuento por pronto pago).
--  Todo queda en la auditoría. Los cajeros y supervisores no pueden aplicarlos.

alter table public.client_invoices
  add column if not exists "manualDiscountAmount" numeric not null default 0,
  add column if not exists "manualDiscountReason" text;

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
  v_manual     numeric := coalesce(nullif(payload->>'manualDiscountAmount','')::numeric, 0);
  v_manual_reason text := nullif(btrim(coalesce(payload->>'manualDiscountReason','')), '');
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

  -- Descuento especial sobre la factura: solo el administrador, con motivo.
  if v_manual < 0 then raise exception 'Descuento inválido'; end if;
  if v_manual > 0 then
    if staff_role() <> 'administrador' then
      raise exception 'Solo un administrador puede aplicar descuentos a una factura' using errcode = '42501';
    end if;
    if v_manual_reason is null then raise exception 'Indica el motivo del descuento'; end if;
    if v_manual > v_total + v_disc_amt + v_manual then raise exception 'El descuento no puede superar el total de la factura'; end if;
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
    if v_disc_amt > (v_total + v_disc_amt + v_manual) * v_cfg_pct / 100 + 0.01 then
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
     "isCredit","creditDays", status, "paymentMethod", date, payments, "createdBy", "needsReview", "discountPct", "discountAmount", "manualDiscountAmount", "manualDiscountReason")
  values
    (v_number, (select c.id from clients c where c.id::text = v_client_id), v_client_name, v_items, v_subtotal, v_total,
     v_is_credit, v_credit_days,
     case when v_is_credit then 'PENDING' else 'PAID' end,
     v_method, v_date, v_payments, coalesce(v_username,'Sistema'), v_review, v_disc_pct, v_disc_amt, v_manual, v_manual_reason)
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

  if v_manual > 0 then
    perform audit_write('INVOICE_DISCOUNT', 'client_invoices', v_invoice.id::text,
      jsonb_build_object('invoiceNumber', v_number, 'amount', v_manual, 'reason', v_manual_reason, 'total', v_total));
  end if;

  return to_jsonb(v_invoice);
end;
$$;

revoke all on function public.erp_create_invoice(jsonb) from public, anon;
grant execute on function public.erp_create_invoice(jsonb) to authenticated;

-- Descuento sobre una factura a crédito aún no cobrada.
create or replace function public.erp_discount_invoice(p_invoice_id text, p_amount numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inv client_invoices%rowtype;
begin
  if staff_role() <> 'administrador' then
    raise exception 'Solo un administrador puede aplicar descuentos a una factura' using errcode = '42501';
  end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'El descuento debe ser mayor que cero'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Indica el motivo del descuento'; end if;
  select * into v_inv from client_invoices where id::text = p_invoice_id for update;
  if not found then raise exception 'Factura no encontrada'; end if;
  if v_inv.status <> 'PENDING' then
    raise exception 'Solo se puede dar descuento a facturas pendientes de cobro (esta está %). Para una factura cobrada usa una devolución.', v_inv.status;
  end if;
  if p_amount >= v_inv.total then raise exception 'El descuento (%) debe ser menor que el total pendiente (%)', p_amount, v_inv.total; end if;

  update client_invoices
     set total = round(total - p_amount, 2),
         "manualDiscountAmount" = "manualDiscountAmount" + p_amount,
         "manualDiscountReason" = case when "manualDiscountReason" is null then p_reason else "manualDiscountReason" || ' | ' || p_reason end,
         "updatedAt" = now()
   where id = v_inv.id returning * into v_inv;
  perform audit_write('INVOICE_DISCOUNT', 'client_invoices', v_inv.id::text,
    jsonb_build_object('invoiceNumber', v_inv."invoiceNumber", 'amount', p_amount, 'reason', p_reason, 'newTotal', v_inv.total));
  return to_jsonb(v_inv);
end $$;

revoke all on function public.erp_discount_invoice(text, numeric, text) from public, anon;
grant execute on function public.erp_discount_invoice(text, numeric, text) to authenticated;
