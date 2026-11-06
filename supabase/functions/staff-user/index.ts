// Edge Function: gestión de usuarios del personal (solo administradores).
// Acciones: create | update | delete. Usa la service role en el servidor; nunca llega al navegador.
// Despliegue: npx supabase functions deploy staff-user
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = ['administrador', 'supervisor', 'cajero'];
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const emailOf = (u: string) => `${u}@staff.valkar.local`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'No autenticado' }, 401);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: who, error: whoErr } = await caller.auth.getUser();
  if (whoErr || !who?.user) return json({ error: 'Sesión inválida' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: me } = await admin.from('staff_profiles').select('role, active').eq('userId', who.user.id).maybeSingle();
  if (!me?.active || me.role !== 'administrador') return json({ error: 'Solo un administrador puede gestionar usuarios' }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  try {
    if (body.action === 'create') {
      const username = String(body.username ?? '').trim().toLowerCase();
      const name = String(body.name ?? '').trim();
      const password = String(body.password ?? '');
      const role = String(body.role ?? 'cajero');
      if (!USERNAME_RE.test(username)) return json({ error: 'Usuario inválido: 3 a 32 caracteres (letras minúsculas, números, punto, guion).' }, 400);
      if (!name) return json({ error: 'El nombre es obligatorio.' }, 400);
      if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
      if (!ROLES.includes(role)) return json({ error: 'Rol inválido.' }, 400);

      const { data: dup } = await admin.from('staff_profiles').select('userId').eq('username', username).maybeSingle();
      if (dup) return json({ error: 'El nombre de usuario ya existe en el sistema.' }, 409);

      const created = await admin.auth.admin.createUser({ email: emailOf(username), password, email_confirm: true });
      if (created.error) return json({ error: created.error.message }, 400);
      const userId = created.data.user.id;

      const { data: profile, error: pErr } = await admin.from('staff_profiles')
        .insert({ userId, username, name, role, active: true }).select().single();
      if (pErr) {
        await admin.auth.admin.deleteUser(userId); // revertir
        return json({ error: pErr.message }, 400);
      }
      return json({ profile });
    }

    if (body.action === 'update') {
      const userId = String(body.userId ?? '');
      if (!userId) return json({ error: 'Falta userId' }, 400);
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = String(body.name).trim();
      if (body.role !== undefined) {
        if (!ROLES.includes(body.role)) return json({ error: 'Rol inválido.' }, 400);
        patch.role = body.role;
      }
      if (body.active !== undefined) patch.active = !!body.active;

      // No permitir quedarse sin administradores activos.
      if ((patch.role && patch.role !== 'administrador') || patch.active === false) {
        const { data: target } = await admin.from('staff_profiles').select('role').eq('userId', userId).maybeSingle();
        if (target?.role === 'administrador') {
          const { count } = await admin.from('staff_profiles').select('userId', { count: 'exact', head: true })
            .eq('role', 'administrador').eq('active', true);
          if ((count ?? 0) <= 1) return json({ error: 'Debe quedar al menos un administrador activo.' }, 400);
        }
      }
      if (body.password) {
        if (String(body.password).length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
        const upd = await admin.auth.admin.updateUserById(userId, { password: String(body.password) });
        if (upd.error) return json({ error: upd.error.message }, 400);
      }
      if (Object.keys(patch).length) {
        const { error: uErr } = await admin.from('staff_profiles').update(patch).eq('userId', userId);
        if (uErr) return json({ error: uErr.message }, 400);
      }
      const { data: profile } = await admin.from('staff_profiles').select('*').eq('userId', userId).single();
      return json({ profile });
    }

    if (body.action === 'delete') {
      const userId = String(body.userId ?? '');
      if (!userId) return json({ error: 'Falta userId' }, 400);
      if (userId === who.user.id) return json({ error: 'No puedes eliminar tu propio usuario.' }, 400);
      const { data: target } = await admin.from('staff_profiles').select('role').eq('userId', userId).maybeSingle();
      if (target?.role === 'administrador') {
        const { count } = await admin.from('staff_profiles').select('userId', { count: 'exact', head: true })
          .eq('role', 'administrador').eq('active', true);
        if ((count ?? 0) <= 1) return json({ error: 'Debe quedar al menos un administrador activo.' }, 400);
      }
      const del = await admin.auth.admin.deleteUser(userId); // staff_profiles cae en cascada
      if (del.error) return json({ error: del.error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Acción desconocida' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Error interno' }, 500);
  }
});
