-- EJECUTAR A MANO, solo cuando scripts/migrate-staff-users.mjs haya terminado
-- y TODOS los usuarios hayan iniciado sesión con éxito en el ERP nuevo.
-- Elimina las contraseñas en texto plano de la base.

alter table public.users drop column if exists password;
-- Si ya no usas la tabla:
-- drop table public.users;
