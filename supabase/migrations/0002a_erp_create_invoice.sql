-- Fase 0 / 0002a: venta atómica. El POS del ERP y staff_confirm_order usan esta función.
-- Supuestos a confirmar con erp_schema.sql: inventory.id, clients.id, client_invoices.id son uuid
-- (aquí no se declaran tipos de id, así que funciona igual con bigint o text).

create sequence if not exists public.invoice_seq start 1000;

-- Evitar números repetidos de ahora en adelante.
-- Si ya hay duplicados (el número anterior era aleatorio) el índice no se crea y se avisa;
-- corrige los duplicados y vuelve a ejecutar solo este bloque.
do $$
begin
  create unique index if not exists client_invoices_invoice_number_uidx
    on public.client_invoices ("invoiceNumber");
exception when unique_violation then
  raise notice 'Hay números de factura duplicados: índice único NO creado. Corrígelos y vuelve a intentar.';
end $$;

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
  v_invoice    client_invoices%rowtype;
begin
  if not is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'La factura no tiene productos';
  end if;
  if v_total < 0 or v_subtotal < 0 then
    raise exception 'Totales inválidos';
  end if;

  select username into v_username from staff_profiles where "userId" = auth.uid();

  v_number := nullif(btrim(coalesce(payload->>'invoiceNumber','')), '');
  if v_number is null then
    v_number := 'FAC-' || lpad(nextval('invoice_seq')::text, 6, '0');
  elsif exists (select 1 from client_invoices where "invoiceNumber" = v_number) then
    raise exception 'El número de factura % ya existe', v_number;
  end if;

  v_concept := coalesce(nullif(payload->>'kardexConcept',''), 'Venta - Factura #' || v_number);

  -- Bloqueo y validación de stock, en orden por producto para evitar interbloqueos.
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
      if coalesce(v_prod.quantity,0) < v_line.qty then
        raise exception 'Sin stock suficiente para "%": disponible %, solicitado %',
          v_prod.name, coalesce(v_prod.quantity,0), v_line.qty
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
     "isCredit","creditDays", status, "paymentMethod", date)
  values
    (v_number, (select c.id from clients c where c.id::text = v_client_id), v_client_name, v_items, v_subtotal, v_total,
     v_is_credit, v_credit_days,
     case when v_is_credit then 'PENDING' else 'PAID' end,
     v_method, v_date)
  returning * into v_invoice;

  if not v_is_credit then
    insert into transactions (amount, method, date, note, type, category, status)
    values (v_total, v_method, v_date,
            'Factura ' || v_number || ' - Cliente: ' || v_client_name,
            'INCOME', 'Venta', 'COMPLETED');
  end if;

  return to_jsonb(v_invoice);
end;
$$;

revoke all on function public.erp_create_invoice(jsonb) from public, anon;
grant execute on function public.erp_create_invoice(jsonb) to authenticated;
