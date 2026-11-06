-- Fase 3 / 0008: precios, carrito y pedidos. Toda la lógica vive en la base.
-- El navegador nunca envía precios: price_quote y place_order los calculan aquí.
--
-- RPC para la tienda (nombres de parámetros = los que se pasan a supabase.rpc):
--   price_quote(items, payment_method, credit_days, delivery_method, delivery_zone)        anon y clientes
--   register_customer(full_name, document_id, phone, wants_wholesale, business_name, rif)  cliente
--   my_customer() · update_my_profile(full_name, phone) · request_wholesale(business_name, rif)
--   place_order(items, payment_method, delivery_method, credit_days, delivery_zone, address, address_id, carrier, notes)
--   report_payment(order_number, method, amount, currency, reference, paid_at, bank_from, proof_path)
--   cancel_my_order(order_number) · my_order(order_number) · my_orders() · my_credit()
--   expire_reservations()  (pg_cron cada 15 min)
-- items = [{ "productId": <id>, "quantity": <entero> }]

-- Datos que el cliente escribió al registrarse. No se muestran los de clients (ERP): si alguien se registra
-- con la cédula de un cliente existente, no debe poder ver su nombre ni su teléfono.
alter table public.web_customers
  add column if not exists "fullName" text,
  add column if not exists phone text;

-- ---------- Utilidades internas ----------
create or replace function public.store_setting(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select data from settings where id = p_id), '{}'::jsonb)
$$;

-- "V-12.345.678" -> "V12345678"; "12345678" -> "V12345678"; "J-29426731-9" -> "J294267319". Igual que la tienda.
create or replace function public.store_normalize_document(p text) returns text
language sql immutable set search_path = public as $$
  select case
           when s ~ '^[VEJGP][0-9]{6,10}$' then s
           when s ~ '^[0-9]{6,10}$' then 'V' || s
         end
  from (select regexp_replace(upper(coalesce(p, '')), '[^VEJGP0-9]', '', 'g') as s) x
$$;

-- Deuda a crédito de un cliente: facturas a crédito pendientes + pedidos web a crédito aún sin facturar.
create or replace function public.store_credit_used(p_client erp_client_id) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(ci.total) from client_invoices ci
                   where ci."clientId"::text = p_client::text and ci."isCredit" and ci.status = 'PENDING'), 0)
       + coalesce((select sum(o."totalUsd") from web_orders o
                   where o."clientId" = p_client and o."paymentMethod" = 'credito'
                     and o.status = 'POR_CONFIRMAR' and o."invoiceId" is null), 0)
$$;

-- ---------- Cotización (algoritmo de la spec 4.4) ----------
-- Para cada línea: una regla por tipo (la más específica: producto > categoría > global; en cantidad, la de mayor
-- minQty alcanzada; en empate, la de mayor descuento), se suman, se aplica el tope y luego el piso de margen.
create or replace function public.store_quote_for(
  p_user uuid, p_items jsonb, p_payment_method text default null, p_credit_days int default 0,
  p_delivery_method text default null, p_delivery_zone text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_pub jsonb := store_setting('tienda_publica');
  v_priv jsonb := store_setting('tienda_privada');
  v_rate numeric := nullif(store_setting('exchange_rates')->>'bcv', '')::numeric;
  v_global_cap numeric := coalesce((v_priv->>'maxDiscountPct')::numeric, 100);
  v_global_margin numeric := coalesce((v_priv->>'minMarginPct')::numeric, 0);
  v_iva_included boolean := coalesce((v_priv->>'pricesIncludeIva')::boolean, true);
  v_cust web_customers%rowtype;
  v_mayor boolean := false;
  v_item record;
  v_prod record;
  v_line_mayor boolean;
  v_rules jsonb;
  v_pct numeric;
  v_cap numeric;
  v_floor numeric;
  v_unit numeric;
  v_capped boolean;
  v_floored boolean;
  v_available int;
  v_line_total numeric;
  v_lines jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_sub_base numeric := 0;
  v_sub numeric := 0;
  v_tax numeric := 0;
  v_fee numeric := 0;
  v_igtf numeric := 0;
  v_igtf_pct numeric;
  v_total numeric;
  v_zone jsonb;
  v_free_over numeric;
  v_owed numeric;
begin
  if p_user is not null then
    select * into v_cust from web_customers where "userId" = p_user;
    v_mayor := found and v_cust."customerType" = 'mayor' and v_cust."wholesaleStatus" = 'approved';
  end if;

  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array' then
    raise exception 'items debe ser una lista de { productId, quantity }' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'El carrito tiene demasiados productos (máximo 100).' using errcode = '22023';
  end if;

  for v_item in
    select x.pid, sum(x.q)::int as qty, bool_or(x.q is null or x.q <= 0) as bad
    from (
      select e->>'productId' as pid,
             case when (e->>'quantity') ~ '^[0-9]{1,6}$' then (e->>'quantity')::int end as q,
             t.ord
      from jsonb_array_elements(p_items) with ordinality t(e, ord)
    ) x
    group by x.pid
    order by min(x.ord)
  loop
    if v_item.pid is null or v_item.bad then
      v_errors := v_errors || jsonb_build_object('code', 'cantidad_invalida', 'productId', v_item.pid,
        'message', 'Revisa las cantidades del carrito.');
      continue;
    end if;

    select i.id, i.name, i.code, round(coalesce(i."sellingPrice", 0), 2) as base, coalesce(i."costPrice", 0) as cost,
           coalesce(i."taxPercentage", 0) as tax_pct, i."categoryId", i."wholesaleEnabled", i."minWholesaleQty",
           i."maxDiscountPct", i."minMarginPct",
           greatest(coalesce(i.quantity, 0) - coalesce((
             select sum(s.quantity) from stock_reservations s
             where s."productId" = i.id and not s.released and s."expiresAt" > now()), 0), 0)::int as available
      into v_prod
      from inventory i
     where i.id::text = v_item.pid and i."webPublished" and coalesce(i."productType", 'product') = 'product';
    if not found then
      v_errors := v_errors || jsonb_build_object('code', 'no_disponible', 'productId', v_item.pid,
        'message', 'Un producto de tu carrito ya no está disponible.');
      continue;
    end if;

    -- Las reglas mayoristas aplican si el cliente es mayorista aprobado, el producto vende al mayor
    -- y la línea alcanza el mínimo de mayor. Si no, solo las reglas "todos" (promociones de detal).
    v_line_mayor := v_mayor and v_prod."wholesaleEnabled" and v_item.qty >= v_prod."minWholesaleQty";

    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'kind', r.kind, 'discountPct', r."discountPct")
                    order by r.kind), '[]'::jsonb)
      into v_rules
      from (
        select distinct on (r.kind) r.*
        from pricing_rules r
        where r.active
          and (r."startsAt" is null or r."startsAt" <= now())
          and (r."endsAt" is null or r."endsAt" >= now())
          and (v_line_mayor or r."appliesTo" = 'todos')
          and (r."productId" is null or r."productId" = v_prod.id)
          and (r."categoryId" is null or r."categoryId" = v_prod."categoryId")
          and case r.kind
                when 'quantity'       then r."minQty" <= v_item.qty
                when 'payment_method' then r."paymentMethod" = p_payment_method
                when 'credit_days'    then v_line_mayor and p_credit_days is not null and r."creditDays" = p_credit_days
                when 'category'       then true
                -- Las reglas de un cliente específico exigen mayorista aprobado (el personal verificó su identidad).
                when 'customer'       then r."clientId" is null or (v_line_mayor and r."clientId" = v_cust."clientId")
                else false
              end
        order by r.kind,
                 (case when r."productId" is not null then 3 when r."categoryId" is not null then 2 else 1 end) desc,
                 (case when r.kind = 'quantity' then r."minQty" end) desc nulls last,
                 r."discountPct" desc,
                 r.id
      ) r;

    -- Descuento especial del mayorista: reemplaza la regla de cliente si es mayor.
    if v_line_mayor and coalesce(v_cust."specialDiscountPct", 0) > 0
       and not exists (select 1 from jsonb_array_elements(v_rules) x
                       where x->>'kind' = 'customer' and (x->>'discountPct')::numeric >= v_cust."specialDiscountPct") then
      select coalesce(jsonb_agg(x), '[]'::jsonb) into v_rules
        from jsonb_array_elements(v_rules) x where x->>'kind' <> 'customer';
      v_rules := v_rules || jsonb_build_array(jsonb_build_object('id', 'especial', 'name', 'Descuento especial',
        'kind', 'customer', 'discountPct', v_cust."specialDiscountPct"));
    end if;

    select coalesce(sum((x->>'discountPct')::numeric), 0) into v_pct from jsonb_array_elements(v_rules) x;
    v_cap := coalesce(v_prod."maxDiscountPct", v_global_cap);
    v_capped := v_pct > v_cap;
    v_pct := least(v_pct, v_cap);
    v_unit := v_prod.base * (1 - v_pct / 100);
    v_floor := v_prod.cost * (1 + coalesce(v_prod."minMarginPct", v_global_margin) / 100);
    v_floored := v_pct > 0 and v_unit < v_floor;
    if v_floored then
      v_unit := least(v_prod.base, v_floor);
    end if;
    v_unit := round(v_unit, 2);
    v_line_total := round(v_unit * v_item.qty, 2);
    v_available := v_prod.available;

    if v_item.qty > v_available then
      v_errors := v_errors || jsonb_build_object('code', 'sin_stock', 'productId', to_jsonb(v_prod.id),
        'message', case when v_available = 0 then v_prod.name || ' está agotado.'
                        else 'De ' || v_prod.name || ' solo quedan ' || v_available || '.' end);
    end if;

    v_sub_base := v_sub_base + v_prod.base * v_item.qty;
    v_sub := v_sub + v_line_total;
    if not v_iva_included then
      v_tax := v_tax + round(v_line_total * v_prod.tax_pct / 100, 2);
    end if;

    v_lines := v_lines || jsonb_build_object(
      'productId', to_jsonb(v_prod.id),
      'productName', v_prod.name,
      'code', v_prod.code,
      'quantity', v_item.qty,
      'unitBaseUsd', v_prod.base,
      'discountPct', case when v_prod.base > 0 then round((1 - v_unit / v_prod.base) * 100, 2) else 0 end,
      'unitPriceUsd', v_unit,
      'lineTotalUsd', v_line_total,
      'appliedRules', v_rules,
      'capped', v_capped,
      'floored', v_floored,
      'available', v_available,
      'stock', case when v_available <= 0 then 'agotado' when v_available <= 5 then 'ultimas' else 'disponible' end,
      'minWholesaleQty', v_prod."minWholesaleQty",
      'belowWholesaleMin', v_mayor and v_prod."wholesaleEnabled" and v_item.qty < v_prod."minWholesaleQty");
  end loop;

  -- Delivery por zona (gratis desde freeOverUsd si es > 0).
  if p_delivery_method = 'delivery' and nullif(p_delivery_zone, '') is not null then
    select z into v_zone
      from jsonb_array_elements(coalesce(v_pub #> '{delivery,delivery,zones}', '[]'::jsonb)) z
     where z->>'name' = p_delivery_zone
     limit 1;
    if v_zone is null then
      v_errors := v_errors || jsonb_build_object('code', 'zona_invalida', 'message', 'Elige una zona de delivery válida.');
    else
      v_free_over := coalesce((v_pub #>> '{delivery,delivery,freeOverUsd}')::numeric, 0);
      if not (v_free_over > 0 and v_sub >= v_free_over) then
        v_fee := round(coalesce((v_zone->>'feeUsd')::numeric, 0), 2);
      end if;
    end if;
  end if;

  -- Método de pago habilitado (el crédito se valida aparte).
  if p_payment_method is not null and p_payment_method <> 'credito'
     and not coalesce((v_pub #>> array['payments', p_payment_method, 'enabled'])::boolean, false) then
    v_errors := v_errors || jsonb_build_object('code', 'metodo_no_disponible', 'message', 'Ese método de pago no está disponible.');
  end if;

  -- IGTF sobre lo que se paga en divisas.
  v_igtf_pct := coalesce((v_pub->>'igtfPct')::numeric, 0);
  if v_igtf_pct > 0 and p_payment_method is not null
     and coalesce(v_pub->'igtfMethods', '["zelle","binance","efectivo"]'::jsonb) ? p_payment_method then
    v_igtf := round((v_sub + v_fee + v_tax) * v_igtf_pct / 100, 2);
  end if;
  v_total := round(v_sub + v_fee + v_tax + v_igtf, 2);

  -- Crédito: solo mayoristas aprobados, dentro de su plazo y su límite.
  if p_payment_method = 'credito' then
    if not v_mayor or coalesce(v_cust."maxCreditDays", 0) <= 0 then
      v_errors := v_errors || jsonb_build_object('code', 'credito_no_permitido',
        'message', 'El crédito está disponible solo para mayoristas aprobados.');
    elsif coalesce(p_credit_days, 0) <= 0 then
      v_errors := v_errors || jsonb_build_object('code', 'credito_plazo', 'message', 'Elige el plazo del crédito.');
    elsif p_credit_days > v_cust."maxCreditDays" then
      v_errors := v_errors || jsonb_build_object('code', 'credito_plazo',
        'message', 'Tu plazo máximo es de ' || v_cust."maxCreditDays" || ' días.');
    elsif jsonb_typeof(v_pub->'creditDaysOptions') = 'array' and not (v_pub->'creditDaysOptions') @> to_jsonb(p_credit_days) then
      v_errors := v_errors || jsonb_build_object('code', 'credito_plazo', 'message', 'Ese plazo de crédito no está disponible.');
    else
      v_owed := store_credit_used(v_cust."clientId");
      if v_owed + v_total > v_cust."creditLimitUsd" then
        v_errors := v_errors || jsonb_build_object('code', 'credito_limite',
          'message', 'Este pedido supera tu crédito disponible (' ||
                     to_char(greatest(v_cust."creditLimitUsd" - v_owed, 0), 'FM999999990.00') || ' USD).');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotalBaseUsd', round(v_sub_base, 2),
    'subtotalUsd', round(v_sub, 2),
    'discountUsd', round(v_sub_base - v_sub, 2),
    'deliveryFeeUsd', v_fee,
    'taxUsd', v_tax,
    'igtfUsd', v_igtf,
    'totalUsd', v_total,
    'bcvRate', v_rate,
    'totalBs', case when v_rate is null then null else round(v_total * v_rate, 2) end,
    'customerType', case when v_mayor then 'mayor' else 'detal' end,
    'wholesaleStatus', v_cust."wholesaleStatus",
    'errors', v_errors);
end $$;

create or replace function public.price_quote(
  items jsonb, payment_method text default null, credit_days int default 0,
  delivery_method text default null, delivery_zone text default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  select store_quote_for(auth.uid(), items, payment_method, credit_days, delivery_method, delivery_zone)
$$;

-- ---------- Clientes ----------
create or replace function public.my_customer() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'userId', w."userId",
    'email', u.email,
    'fullName', w."fullName",
    'phone', w.phone,
    'documentId', c."documentId",
    'customerType', w."customerType",
    'wholesaleStatus', w."wholesaleStatus",
    'wholesaleNote', w."wholesaleNote",
    'businessName', w."businessName",
    'rif', w.rif,
    'creditLimitUsd', w."creditLimitUsd",
    'maxCreditDays', w."maxCreditDays",
    'specialDiscountPct', w."specialDiscountPct",
    'addresses', coalesce((select jsonb_agg(to_jsonb(a) - 'userId' order by a."isDefault" desc, a."createdAt")
                           from web_addresses a where a."userId" = w."userId"), '[]'::jsonb))
  from web_customers w
  join auth.users u on u.id = w."userId"
  join clients c on c.id = w."clientId"
  where w."userId" = auth.uid()
$$;

create or replace function public.register_customer(
  full_name text, document_id text, phone text,
  wants_wholesale boolean default false, business_name text default null, rif text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_name text := left(btrim(coalesce(full_name, '')), 150);
  v_phone text := left(btrim(coalesce(phone, '')), 40);
  v_doc text := store_normalize_document(document_id);
  v_wholesale boolean := coalesce(wants_wholesale, false);
  v_business text := left(nullif(btrim(coalesce(business_name, '')), ''), 150);
  v_rif text := store_normalize_document(rif);
  v_email text;
  v_client_id erp_client_id;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para registrarte.' using errcode = '42501';
  end if;
  if exists (select 1 from web_customers where "userId" = v_uid) then
    return my_customer();
  end if;
  if exists (select 1 from staff_profiles where "userId" = v_uid) then
    raise exception 'Las cuentas del personal no compran en la tienda. Usa otro correo.';
  end if;
  if v_name = '' then
    raise exception 'Escribe tu nombre completo.';
  end if;
  if v_doc is null then
    raise exception 'Revisa la cédula o el RIF. Ejemplo: V12345678 o J294267319.';
  end if;
  if regexp_replace(v_phone, '[^0-9]', '', 'g') !~ '^[0-9]{10,13}$' then
    raise exception 'Revisa el teléfono. Ejemplo: 0412 000 0000.';
  end if;
  if v_wholesale and (v_business is null or v_rif is null) then
    raise exception 'Para comprar al mayor indica la razón social y el RIF.';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- Mismo cliente del ERP si ya existe con esa cédula/RIF (se compara normalizado).
  select id into v_client_id
    from clients
   where store_normalize_document("documentId") = v_doc
   order by "createdAt" nulls last
   limit 1;

  if v_client_id is null then
    insert into clients (name, "documentId", phone, email, address)
    values (v_name, v_doc, v_phone, coalesce(v_email, ''), '')
    returning id into v_client_id;
  end if;

  insert into web_customers ("userId", "clientId", "fullName", phone, "customerType", "wholesaleStatus", "businessName", rif)
  values (v_uid, v_client_id, v_name, v_phone,
          case when v_wholesale then 'mayor' else 'detal' end,
          case when v_wholesale then 'pending' else 'none' end,
          case when v_wholesale then v_business end,
          case when v_wholesale then v_rif end);

  return my_customer();
end $$;

create or replace function public.update_my_profile(full_name text default null, phone text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_name text := left(nullif(btrim(coalesce(full_name, '')), ''), 150);
  v_phone text := left(nullif(btrim(coalesce(phone, '')), ''), 40);
begin
  update web_customers
     set "fullName" = coalesce(v_name, "fullName"),
         phone = coalesce(v_phone, phone),
         "updatedAt" = now()
   where "userId" = auth.uid();
  if not found then
    raise exception 'Completa tu registro primero.' using errcode = '42501';
  end if;
  return my_customer();
end $$;

create or replace function public.request_wholesale(business_name text, rif text)
returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_business text := left(nullif(btrim(coalesce(business_name, '')), ''), 150);
  v_rif text := store_normalize_document(rif);
  v_status text;
begin
  select "wholesaleStatus" into v_status from web_customers where "userId" = auth.uid() for update;
  if not found then
    raise exception 'Completa tu registro primero.' using errcode = '42501';
  end if;
  if v_status in ('pending', 'approved') then
    return my_customer();
  end if;
  if v_business is null or v_rif is null then
    raise exception 'Indica la razón social y el RIF. Ejemplo: J294267319.';
  end if;
  update web_customers
     set "customerType" = 'mayor', "wholesaleStatus" = 'pending', "businessName" = v_business, rif = v_rif,
         "wholesaleNote" = null, "updatedAt" = now()
   where "userId" = auth.uid();
  return my_customer();
end $$;

create or replace function public.my_credit() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when w."wholesaleStatus" = 'approved' and w."maxCreditDays" > 0 then
    jsonb_build_object(
      'limitUsd', w."creditLimitUsd",
      'usedUsd', round(store_credit_used(w."clientId"), 2),
      'availableUsd', round(greatest(w."creditLimitUsd" - store_credit_used(w."clientId"), 0), 2),
      'maxCreditDays', w."maxCreditDays")
  end
  from web_customers w where w."userId" = auth.uid()
$$;

-- ---------- Pedidos ----------
-- Pedido armado como lo muestra la tienda (/pedido/:numero y /cuenta). Interno: lo usan my_order y el ERP.
create or replace function public.store_order_json(p_order_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select (to_jsonb(o) - 'userId' - 'clientId' - 'staffNotes' - 'invoiceId') || jsonb_build_object(
    'invoiceNumber', (select ci."invoiceNumber" from client_invoices ci where ci.id = o."invoiceId"),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'productId', it."productId", 'productName', it."productName", 'brand', i.brand, 'code', it.code,
               'slug', i.slug, 'categoryIcon', c.icon,
               'mainSpec', coalesce(i.specs->>'viscosidad', i.specs->>'grupo', i.specs->>'grado',
                                    i.specs->>'mezcla', i.specs->>'medida', i.reference),
               'quantity', it.quantity, 'unitBaseUsd', it."unitBaseUsd", 'discountPct', it."discountPct",
               'unitPriceUsd', it."unitPriceUsd", 'lineTotalUsd', it."lineTotalUsd", 'appliedRules', it."appliedRules")
             order by it."productName")
      from web_order_items it
      left join inventory i on i.id = it."productId"
      left join categories c on c.id = i."categoryId"
      where it."orderId" = o.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'method', p.method, 'amount', p.amount, 'currency', p.currency, 'reference', p.reference,
               'paidAt', p."paidAt", 'bankFrom', p."bankFrom", 'proofPath', p."proofPath", 'status', p.status,
               'reviewNote', p."reviewNote", 'createdAt', p."createdAt")
             order by p."createdAt")
      from web_payment_reports p where p."orderId" = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'byStaff', e."byStaff", 'createdAt', e."createdAt")
             order by e."createdAt", e.id)
      from web_order_events e where e."orderId" = o.id), '[]'::jsonb))
  from web_orders o
  where o.id = p_order_id
$$;

create or replace function public.my_order(order_number text) returns jsonb
language sql stable security definer set search_path = public as $$
  select store_order_json(o.id) from web_orders o where o.number = order_number and o."userId" = auth.uid()
$$;

create or replace function public.my_orders() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(store_order_json(o.id) order by o."createdAt" desc), '[]'::jsonb)
  from web_orders o where o."userId" = auth.uid()
$$;

create or replace function public.place_order(
  items jsonb, payment_method text, delivery_method text,
  credit_days int default 0, delivery_zone text default null, address jsonb default null,
  address_id uuid default null, carrier text default null, notes text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_items jsonb := items;
  v_payment text := payment_method;
  v_delivery text := delivery_method;
  v_credit int := case when payment_method = 'credito' then coalesce(credit_days, 0) else 0 end;
  v_zone text := nullif(btrim(coalesce(delivery_zone, '')), '');
  v_addr_in jsonb := address;
  v_addr_id uuid := address_id;
  v_carrier text := nullif(btrim(coalesce(carrier, '')), '');
  v_notes text := left(nullif(btrim(coalesce(notes, '')), ''), 1000);
  v_pub jsonb := store_setting('tienda_publica');
  v_cust web_customers%rowtype;
  v_addr jsonb;
  v_quote jsonb;
  v_status text;
  v_until timestamptz;
  v_order web_orders%rowtype;
  v_pids text[];
  v_lock record;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para confirmar tu pedido.' using errcode = '42501';
  end if;
  select * into v_cust from web_customers where "userId" = v_uid;
  if not found then
    raise exception 'Completa tu registro para comprar.' using errcode = '42501';
  end if;
  if not coalesce((v_pub->>'storeOpen')::boolean, false) then
    raise exception 'La tienda no está recibiendo pedidos en este momento.';
  end if;
  if v_delivery is null or v_delivery not in ('retiro', 'delivery', 'envio_nacional')
     or not coalesce((v_pub #>> array['delivery', v_delivery, 'enabled'])::boolean, false) then
    raise exception 'Esa forma de entrega no está disponible.';
  end if;
  if v_payment is null or v_payment not in ('pago_movil', 'transferencia', 'zelle', 'binance', 'efectivo', 'credito') then
    raise exception 'Elige un método de pago.';
  end if;
  if v_payment = 'efectivo' and v_delivery = 'envio_nacional' then
    raise exception 'El efectivo es solo para retiro en tienda o delivery en Maracaibo.';
  end if;
  if v_delivery = 'delivery' and v_zone is null then
    raise exception 'Elige tu zona de delivery.';
  end if;
  if v_delivery = 'envio_nacional' and v_carrier is not null
     and not coalesce(v_pub #> '{delivery,envio_nacional,carriers}', '[]'::jsonb) ? v_carrier then
    raise exception 'Ese transportista no está disponible.';
  end if;

  -- Dirección: copia congelada en el pedido (de una guardada o la que viene escrita).
  if v_delivery <> 'retiro' then
    if v_addr_id is not null then
      select jsonb_build_object('label', a.label, 'fullName', a."fullName", 'phone', a.phone, 'state', a.state,
                                'city', a.city, 'line1', a.line1, 'reference', a.reference)
        into v_addr
        from web_addresses a where a.id = v_addr_id and a."userId" = v_uid;
      if v_addr is null then
        raise exception 'No encontramos esa dirección.';
      end if;
    elsif jsonb_typeof(v_addr_in) = 'object' then
      select jsonb_object_agg(k, left(btrim(v_addr_in->>k), 200))
        into v_addr
        from unnest(array['label', 'fullName', 'phone', 'state', 'city', 'line1', 'reference']) k
       where coalesce(btrim(v_addr_in->>k), '') <> '';
    end if;
    if v_addr is null or not (v_addr ?& array['fullName', 'phone', 'city', 'line1'])
       or (v_delivery = 'envio_nacional' and not v_addr ? 'state') then
      raise exception 'Completa la dirección de entrega (nombre, teléfono, ciudad y dirección%).',
        case when v_delivery = 'envio_nacional' then ', estado' else '' end;
    end if;
  end if;

  -- Evita que una sola cuenta aparte todo el inventario.
  if (select count(*) from web_orders
      where "userId" = v_uid and status in ('PENDIENTE_PAGO', 'POR_CONFIRMAR', 'PAGO_REPORTADO')) >= 5 then
    raise exception 'Tienes 5 pedidos pendientes. Paga o cancela alguno antes de hacer otro.';
  end if;

  if jsonb_typeof(coalesce(v_items, 'null'::jsonb)) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Tu carrito está vacío.';
  end if;

  -- Bloqueo de las filas de inventario en orden fijo: dos pedidos por la última unidad se serializan aquí
  -- y el segundo ve la reserva del primero (sin sobreventa). El POS bloquea las mismas filas.
  select array_agg(distinct e->>'productId') into v_pids from jsonb_array_elements(v_items) e;
  for v_lock in
    select i.id from inventory i where i.id::text = any(v_pids) order by i.id for update
  loop
    null;
  end loop;

  -- Se recalcula todo: nunca se confía en precios del navegador.
  v_quote := store_quote_for(v_uid, v_items, v_payment, v_credit, v_delivery, v_zone);
  if jsonb_array_length(v_quote->'errors') > 0 then
    raise exception '%', v_quote #>> '{errors,0,message}' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_quote->'lines') = 0 then
    raise exception 'Tu carrito está vacío.';
  end if;
  if v_quote->>'bcvRate' is null then
    raise exception 'No hay tasa BCV disponible. Intenta de nuevo en unos minutos.';
  end if;

  v_status := case when v_payment in ('efectivo', 'credito') then 'POR_CONFIRMAR' else 'PENDIENTE_PAGO' end;
  v_until := case
               when v_payment = 'credito' then null  -- el crédito espera la revisión del personal
               when v_payment = 'efectivo' then now() + make_interval(hours => coalesce((v_pub->>'cashReservationHours')::int, 48))
               else now() + make_interval(hours => coalesce((v_pub->>'reservationHours')::int, 24))
             end;

  insert into web_orders ("userId", "clientId", "customerType", status, "paymentMethod", "creditDays",
                          "deliveryMethod", "deliveryZone", "deliveryAddress", carrier,
                          "subtotalUsd", "discountUsd", "deliveryFeeUsd", "taxUsd", "igtfUsd", "totalUsd",
                          "bcvRate", "totalBs", notes, "reservedUntil")
  values (v_uid, v_cust."clientId", v_quote->>'customerType', v_status, v_payment, v_credit,
          v_delivery, case when v_delivery = 'delivery' then v_zone end, v_addr,
          case when v_delivery = 'envio_nacional' then v_carrier end,
          (v_quote->>'subtotalBaseUsd')::numeric, (v_quote->>'discountUsd')::numeric,
          (v_quote->>'deliveryFeeUsd')::numeric, (v_quote->>'taxUsd')::numeric, (v_quote->>'igtfUsd')::numeric,
          (v_quote->>'totalUsd')::numeric, (v_quote->>'bcvRate')::numeric, (v_quote->>'totalBs')::numeric,
          v_notes, v_until)
  returning * into v_order;

  insert into web_order_items ("orderId", "productId", "productName", code, quantity,
                               "unitBaseUsd", "discountPct", "unitPriceUsd", "lineTotalUsd", "appliedRules")
  select v_order.id, i.id, i.name, i.code, (l->>'quantity')::int,
         (l->>'unitBaseUsd')::numeric, (l->>'discountPct')::numeric, (l->>'unitPriceUsd')::numeric,
         (l->>'lineTotalUsd')::numeric, l->'appliedRules'
  from jsonb_array_elements(v_quote->'lines') l
  join inventory i on i.id::text = l->>'productId';

  insert into stock_reservations ("orderId", "productId", quantity, "expiresAt")
  select v_order.id, i.id, (l->>'quantity')::int, coalesce(v_until, 'infinity'::timestamptz)
  from jsonb_array_elements(v_quote->'lines') l
  join inventory i on i.id::text = l->>'productId';

  insert into web_order_events ("orderId", status, note) values (v_order.id, v_status, 'Pedido recibido.');

  return jsonb_build_object('number', v_order.number, 'status', v_status, 'totalUsd', v_order."totalUsd",
                            'totalBs', v_order."totalBs", 'reservedUntil', v_until);
end $$;

create or replace function public.report_payment(
  order_number text, method text, amount numeric, currency text, reference text, paid_at date,
  bank_from text default null, proof_path text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_number text := order_number;
  v_method text := nullif(btrim(coalesce(method, '')), '');
  v_amount numeric := round(amount, 2);
  v_currency text := upper(coalesce(currency, ''));
  v_ref text := left(btrim(coalesce(reference, '')), 100);
  v_paid date := paid_at;
  v_bank text := left(nullif(btrim(coalesce(bank_from, '')), ''), 100);
  v_proof text := nullif(btrim(coalesce(proof_path, '')), '');
  v_order web_orders%rowtype;
begin
  if v_uid is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  select * into v_order from web_orders where number = v_number and "userId" = v_uid for update;
  if not found then
    raise exception 'No encontramos el pedido.';
  end if;
  if v_order.status <> 'PENDIENTE_PAGO' then
    raise exception 'Este pedido ya no está esperando pago.';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Indica el monto que pagaste.';
  end if;
  if v_currency not in ('USD', 'VES') then
    raise exception 'La moneda debe ser USD o VES.';
  end if;
  if v_ref = '' then
    raise exception 'Indica el número de referencia del pago.';
  end if;
  if v_paid is null or v_paid > (now() at time zone 'America/Caracas')::date + 1
     or v_paid < (v_order."createdAt" at time zone 'America/Caracas')::date - 7 then
    raise exception 'Revisa la fecha del pago.';
  end if;
  if v_proof is not null and v_proof not like v_uid::text || '/%' then
    raise exception 'El comprobante no es válido. Súbelo de nuevo.';
  end if;

  insert into web_payment_reports ("orderId", method, amount, currency, reference, "paidAt", "bankFrom", "proofPath")
  values (v_order.id, coalesce(v_method, v_order."paymentMethod"), v_amount, v_currency, v_ref, v_paid, v_bank, v_proof);

  update web_orders set status = 'PAGO_REPORTADO', "updatedAt" = now() where id = v_order.id;
  -- Mientras el personal revisa el pago, la reserva no vence.
  update stock_reservations set "expiresAt" = 'infinity' where "orderId" = v_order.id and not released;
  insert into web_order_events ("orderId", status, note)
  values (v_order.id, 'PAGO_REPORTADO', 'Reportaste un pago (ref. ' || v_ref || ').');

  return store_order_json(v_order.id);
end $$;

create or replace function public.cancel_my_order(order_number text)
returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_number text := order_number;
  v_order web_orders%rowtype;
begin
  select * into v_order from web_orders where number = v_number and "userId" = auth.uid() for update;
  if not found then
    raise exception 'No encontramos el pedido.';
  end if;
  if v_order.status not in ('PENDIENTE_PAGO', 'POR_CONFIRMAR', 'PAGO_REPORTADO') then
    raise exception 'Este pedido ya no se puede cancelar. Escríbenos por WhatsApp.';
  end if;
  update web_orders set status = 'CANCELADO', "reservedUntil" = null, "updatedAt" = now() where id = v_order.id;
  update stock_reservations set released = true where "orderId" = v_order.id and not released;
  insert into web_order_events ("orderId", status, note) values (v_order.id, 'CANCELADO', 'Cancelaste el pedido.');
  return store_order_json(v_order.id);
end $$;

-- Cada 15 min (pg_cron): pedidos sin pago con la reserva vencida -> EXPIRADO y se libera el stock.
-- Los pedidos con pago reportado no vencen: esperan la revisión del personal.
create or replace function public.expire_reservations() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  with expired as (
    update web_orders
       set status = 'EXPIRADO', "updatedAt" = now()
     where status in ('PENDIENTE_PAGO', 'POR_CONFIRMAR')
       and "reservedUntil" is not null and "reservedUntil" < now()
    returning id
  ), released as (
    update stock_reservations s set released = true
      from expired e where s."orderId" = e.id and not s.released
    returning 1
  ), events as (
    insert into web_order_events ("orderId", status, note)
    select id, 'EXPIRADO', 'Pasó el tiempo de reserva sin pago.' from expired
    returning 1
  )
  select count(*) into v_n from expired;
  return v_n;
end $$;

-- ---------- Venta del POS: respeta lo apartado en pedidos web ----------
-- Igual que 0002a, pero el stock disponible descuenta las reservas activas de pedidos web.
-- staff_confirm_order (0009) libera la reserva del pedido antes de facturarlo.
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

      if coalesce(v_prod.quantity,0) - v_reserved < v_line.qty then
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

-- ---------- Permisos ----------
-- Internas: nadie las llama desde el navegador (store_setting leería tienda_privada).
revoke all on function public.store_setting(text) from public, anon, authenticated;
revoke all on function public.store_credit_used(erp_client_id) from public, anon, authenticated;
revoke all on function public.store_quote_for(uuid, jsonb, text, int, text, text) from public, anon, authenticated;
revoke all on function public.store_order_json(uuid) from public, anon, authenticated;
revoke all on function public.expire_reservations() from public, anon, authenticated;

-- Públicas (sin sesión).
revoke all on function public.price_quote(jsonb, text, int, text, text) from public;
grant execute on function public.price_quote(jsonb, text, int, text, text) to anon, authenticated;
grant execute on function public.store_normalize_document(text) to anon, authenticated;

-- Clientes con sesión.
do $$
declare f text;
begin
  foreach f in array array[
    'public.my_customer()',
    'public.register_customer(text, text, text, boolean, text, text)',
    'public.update_my_profile(text, text)',
    'public.request_wholesale(text, text)',
    'public.my_credit()',
    'public.my_order(text)',
    'public.my_orders()',
    'public.place_order(jsonb, text, text, int, text, jsonb, uuid, text, text)',
    'public.report_payment(text, text, numeric, text, text, date, text, text)',
    'public.cancel_my_order(text)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke all on function public.erp_create_invoice(jsonb) from public, anon;
grant execute on function public.erp_create_invoice(jsonb) to authenticated;

-- ---------- Programación de la expiración ----------
-- Requiere la extensión pg_cron (Supabase: Database > Extensions > pg_cron). Si no está activa, actívala y
-- ejecuta: select cron.schedule('expire-web-orders', '*/15 * * * *', 'select public.expire_reservations()');
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$select cron.schedule('expire-web-orders', '*/15 * * * *', 'select public.expire_reservations()')$q$;
  else
    raise notice 'pg_cron no está activo: programa expire_reservations() a mano (ver comentario).';
  end if;
end $$;
