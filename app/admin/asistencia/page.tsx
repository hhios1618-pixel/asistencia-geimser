import { redirect } from 'next/navigation';
import { createServerSupabaseClient, getServiceSupabase } from '../../../lib/supabase/server';
import AdminAttendanceClient from './components/AdminAttendanceClient';
import type { Tables } from '../../../types/database';
import LogoutButton from '../../asistencia/components/LogoutButton';
import { runQuery } from '../../../lib/db/postgres';

export const dynamic = 'force-dynamic';

export default async function AdminAsistenciaPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const userRole =
    (user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;

  if (userRole !== 'ADMIN' && userRole !== 'SUPERVISOR') {
    redirect('/asistencia');
  }

  const serviceSupabase = getServiceSupabase();
  const { data: personRow } = await serviceSupabase
    .from('people')
    .select('*')
    .eq('id', user.id as string)
    .maybeSingle<Tables['people']['Row']>();

  if (!personRow) {
    const fallbackName =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split('@')[0]?.replace(/\./g, ' ') ??
      'Colaborador';

    await runQuery(
      `insert into asistencia.people (id, name, email, role, is_active)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update
       set name = excluded.name,
           email = excluded.email,
           role = excluded.role,
           is_active = excluded.is_active`,
      [user.id as string, fallbackName.trim(), user.email ?? null, userRole, true]
    );
  }

  return (
    <main className="glass-panel mx-auto max-w-6xl p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Administración de Asistencia</h1>
          <a
            href="/asistencia"
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-100"
          >
            Volver a asistencia
          </a>
        </div>
        <LogoutButton />
      </div>
      <AdminAttendanceClient />
    </main>
  );
}
