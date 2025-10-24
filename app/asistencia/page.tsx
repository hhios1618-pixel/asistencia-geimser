import { redirect } from 'next/navigation';
import { createServerSupabaseClient, getServiceSupabase } from '../../lib/supabase/server';
import AttendanceClient from './components/AttendanceClient';
import LocationPermissionGuard from './components/LocationPermissionGuard';
import type { Tables } from '../../types/database';

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
  let { data: person } = await serviceSupabase
    .from('people')
    .select('*')
    .eq('id', user.id as string)
    .maybeSingle<Tables['people']['Row']>();

  if (!person) {
    const fallbackName =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split('@')[0]?.replace(/\./g, ' ') ??
      'Colaborador';
    const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';

    const { data: provisioned } = await serviceSupabase
      .from('people')
      .upsert(
        {
          id: user.id as string,
          name: fallbackName.trim(),
          email: user.email,
          role: defaultRole,
          is_active: true,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .maybeSingle<Tables['people']['Row']>();

    person = provisioned ?? {
      id: user.id as string,
      name: fallbackName.trim(),
      email: user.email,
      role: defaultRole,
      is_active: true,
      rut: null,
      created_at: new Date().toISOString(),
    };
  }

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
    <main className="mx-auto max-w-3xl p-4">
      <LocationPermissionGuard>
        <AttendanceClient
          person={person}
          sites={sites}
          schedule={schedule ?? null}
        />
      </LocationPermissionGuard>
    </main>
  );
}
