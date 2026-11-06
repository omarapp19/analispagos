-- Fase 0 / 0002: RLS en todas las tablas del ERP.
-- Solo personal autenticado (is_staff()) tiene acceso. anon queda sin acceso.
-- Se omiten tablas que no existan en el entorno.

do $$
declare t text;
begin
  foreach t in array array['inventory','clients','client_invoices','kardex','transactions','bills',
                           'providers','investments','recurring_expenses','settings','users']
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "staff full" on public.%I', t);
      execute format('create policy "staff full" on public.%I for all to authenticated using (is_staff()) with check (is_staff())', t);
    end if;
  end loop;
end $$;

-- Eliminar TODA política previa en estas tablas, sea cual sea su rol.
-- Las políticas se suman con OR: una política vieja "to authenticated using (true)" dejaría a los
-- clientes de la tienda (que también inician sesión, rol authenticated) leer costos, clientes y finanzas.
-- Solo quedan "staff full" y la lectura pública de settings que se crea abajo.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('inventory','clients','client_invoices','kardex','transactions','bills',
                        'providers','investments','recurring_expenses','settings','users')
      and policyname not in ('staff full', 'publico lee tasa y tienda')
  loop
    raise notice 'Eliminando política previa % en %', r.policyname, r.tablename;
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Lectura pública mínima de settings: tasa BCV y datos públicos de la tienda.
-- Cualquier otro id de settings (global_settings, tienda_privada, ...) es solo para el personal.
drop policy if exists "publico lee tasa y tienda" on public.settings;
create policy "publico lee tasa y tienda" on public.settings
  for select to anon, authenticated
  using (id in ('exchange_rates','tienda_publica'));
