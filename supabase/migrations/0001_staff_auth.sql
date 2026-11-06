-- Fase 0 / 0001: perfiles del personal sobre Supabase Auth
-- Supuesto a confirmar con erp_schema.sql: ninguna columna de esta migración depende de ids de tablas existentes.

create table if not exists public.staff_profiles (
  "userId"    uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  name        text not null,
  role        text not null check (role in ('administrador','supervisor','cajero')),
  active      boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from staff_profiles where "userId" = auth.uid() and active
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_profiles where "userId" = auth.uid() and active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(staff_role() in ('administrador','supervisor'), false)
$$;

revoke all on function public.staff_role(), public.is_staff(), public.is_admin() from public;
grant execute on function public.staff_role(), public.is_staff(), public.is_admin() to anon, authenticated;

alter table public.staff_profiles enable row level security;

drop policy if exists "staff lee su perfil" on public.staff_profiles;
create policy "staff lee su perfil" on public.staff_profiles
  for select to authenticated using ("userId" = auth.uid() or is_admin());

-- Altas, cambios y bajas de personal solo pasan por la Edge Function staff-user (service role).
-- Aun así, el administrador conserva control directo por si hace falta desde el panel de Supabase.
drop policy if exists "admin gestiona personal" on public.staff_profiles;
create policy "admin gestiona personal" on public.staff_profiles
  for all to authenticated
  using (staff_role() = 'administrador') with check (staff_role() = 'administrador');
