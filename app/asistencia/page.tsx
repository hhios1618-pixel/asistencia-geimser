import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '../../lib/supabase/server';
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

  const { data: person } = await supabase
    .from('people')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Tables['people']['Row']>();

  if (!person) {
    redirect('/');
  }

  const { data: assignments } = await supabase
    .from('people_sites')
    .select('site_id')
    .eq('person_id', user.id)
    .eq('active', true);

  const assignmentRows = (assignments as { site_id: string }[] | null) ?? [];
  const siteIds = assignmentRows.map((item) => item.site_id);
  let sites: Tables['sites']['Row'][] = [];
  if (siteIds.length > 0) {
    const { data: sitesData } = await supabase.from('sites').select('*').in('id', siteIds);
    sites = (sitesData as Tables['sites']['Row'][] | null) ?? [];
  }

  const today = new Date();
  const { data: schedule } = await supabase
    .from('schedules')
    .select('*')
    .eq('person_id', user.id)
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
