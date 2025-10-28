import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient, getServiceSupabase } from '../../lib/supabase/server';
import type { PostgrestError } from '@supabase/supabase-js';
import AttendanceClient from './components/AttendanceClient';
import LocationPermissionGuard from './components/LocationPermissionGuard';
import type { Tables } from '../../types/database';
import { runQuery } from '../../lib/db/postgres';

export const dynamic = 'force-dynamic';

export default async function AsistenciaPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const serviceSupabase = getServiceSupabase();
  const { data: personFromDb, error: personError } = await serviceSupabase
    .from('people')
    .select('*')
    .eq('id', user.id as string)
    .maybeSingle<Tables['people']['Row']>();

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';

  if (personError) {
    const code = (personError as PostgrestError | null)?.code;
    if (code === 'PGRST106' || code === 'PGRST205') {
      console.warn('[asistencia] people table not accessible', personError.message);
    } else {
      console.error('[asistencia] person lookup failed', personError);
    }
  }

  let person = personFromDb;

  if (!person) {
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
      [user.id as string, fallbackName.trim(), user.email ?? null, defaultRole, true]
    );

    const { rows: provisioned } = await runQuery<Tables['people']['Row']>(
      'select * from asistencia.people where id = $1',
      [user.id as string]
    );

    person =
      provisioned[0] ??
      ({
        id: user.id as string,
        name: fallbackName.trim(),
        email: user.email ?? null,
        role: defaultRole,
        is_active: true,
        rut: null,
        created_at: new Date().toISOString(),
      } satisfies Tables['people']['Row']);
  }

  const ensuredPerson = person!;

  const { data: assignments } = await serviceSupabase
    .from('people_sites')
    .select('site_id')
    .eq('person_id', user.id as string)
    .eq('active', true);

  const assignmentRows = (assignments as { site_id: string }[] | null) ?? [];
  const siteIds = assignmentRows.map((item) => item.site_id);
  let sites: Tables['sites']['Row'][] = [];
  if (siteIds.length > 0) {
    const { data: sitesData } = await serviceSupabase.from('sites').select('*').in('id', siteIds);
    sites = (sitesData as Tables['sites']['Row'][] | null) ?? [];
  }

  const today = new Date();
  const { data: schedule } = await serviceSupabase
    .from('schedules')
    .select('*')
    .eq('person_id', user.id as string)
    .eq('day_of_week', today.getDay())
    .maybeSingle<Tables['schedules']['Row']>();

  return (
    <main className="glass-panel mx-auto max-w-4xl p-8">
      <LocationPermissionGuard>
        {(ensuredPerson.role === 'ADMIN' || ensuredPerson.role === 'SUPERVISOR') && (
          <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">¿Necesitas configurar usuarios, sitios o reportes?</p>
            <Link
              href="/admin/asistencia"
              className="mt-2 inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-1 text-white transition hover:bg-blue-700"
            >
              Ir al panel administrativo
            </Link>
          </div>
        )}
        <AttendanceClient person={ensuredPerson} sites={sites} schedule={schedule ?? null} />
      </LocationPermissionGuard>
    </main>
  );
}
