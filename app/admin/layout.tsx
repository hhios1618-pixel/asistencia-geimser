import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import type { Tables } from '../../types/database';

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
  const role =
    (user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;

  if (!isManager(role)) {
    redirect('/asistencia');
  }

  return children;
}

