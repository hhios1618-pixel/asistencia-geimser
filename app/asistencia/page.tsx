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
      `insert into asistencia.people (id, name, email, role, is_active, service, rut)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update
       set name = excluded.name,
           email = excluded.email,
           role = excluded.role,
           is_active = excluded.is_active,
           service = excluded.service,
           rut = excluded.rut`,
      [
        user.id as string,
        fallbackName.trim(),
        user.email ?? null,
        defaultRole,
        true,
        (user.user_metadata?.service as string | undefined) ?? null,
        (user.user_metadata?.rut as string | undefined) ?? null,
      ]
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
        rut: (user.user_metadata?.rut as string | undefined) ?? null,
        service: (user.user_metadata?.service as string | undefined) ?? null,
        created_at: new Date().toISOString(),
      } satisfies Tables['people']['Row']);
  }

  const ensuredPerson = person!;

  const { rows: assignmentRows } = await runQuery<{ site_id: string }>(
    `select site_id from asistencia.people_sites
     where person_id = $1 and active = true`,
    [user.id as string]
  );

  const siteIds = assignmentRows.map((item) => item.site_id);
  let sites: Tables['sites']['Row'][] = [];
  if (siteIds.length > 0) {
    const { rows: siteRows } = await runQuery<Tables['sites']['Row']>(
      `select * from asistencia.sites
       where id = any($1::uuid[])
       order by name`,
      [siteIds]
    );
    sites = siteRows;
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
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_35px_-18px_rgba(59,130,246,0.65)] transition hover:from-blue-600 hover:via-indigo-600 hover:to-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-xs font-medium text-white">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                  <path d="M5 10h10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m11 6 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-white drop-shadow-[0_10px_18px_rgba(15,23,42,0.35)]">Ir al panel administrativo</span>
            </Link>
          </div>
        )}
        <AttendanceClient person={ensuredPerson} sites={sites} schedule={schedule ?? null} />
      </LocationPermissionGuard>
    </main>
  );
}
