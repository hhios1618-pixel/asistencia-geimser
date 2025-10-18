import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import AdminAttendanceClient from './components/AdminAttendanceClient';
import type { Tables } from '../../../types/database';

export const dynamic = 'force-dynamic';

export default async function AdminAsistenciaPage() {
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

  if (!person || (person.role !== 'ADMIN' && person.role !== 'SUPERVISOR')) {
    redirect('/');
  }

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Administración de Asistencia</h1>
      <AdminAttendanceClient />
    </main>
  );
}
