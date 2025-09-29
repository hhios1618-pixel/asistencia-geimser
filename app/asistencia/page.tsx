import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '../../lib/supabase';
import AttendanceClient from './components/AttendanceClient';
import LocationPermissionGuard from './components/LocationPermissionGuard';
import type { Tables } from '../../types/database';

export const dynamic = 'force-dynamic';

export default async function AsistenciaPage() {
  const supabase = createServerSupabaseClient();
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
    .single();

  if (!person) {
    redirect('/');
  }

  const { data: assignments } = await supabase
    .from('people_sites')
    .select('site_id')
    .eq('person_id', user.id)
    .eq('active', true);

  const siteIds = assignments?.map((item) => item.site_id) ?? [];
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
    .maybeSingle();

  return (
    <main className="mx-auto max-w-3xl p-4">
      <LocationPermissionGuard>
        <AttendanceClient
          person={person as Tables['people']['Row']}
          sites={sites}
          schedule={(schedule as Tables['schedules']['Row'] | null) ?? null}
        />
      </LocationPermissionGuard>
    </main>
  );
}
