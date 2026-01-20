import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import type { Tables } from '../../types/database';
import { resolveUserRole } from '../../lib/auth/role';

export const dynamic = 'force-dynamic';

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role = await resolveUserRole(user, defaultRole);

  if (!isManager(role)) {
    redirect('/asistencia');
  }

  return children;
}
