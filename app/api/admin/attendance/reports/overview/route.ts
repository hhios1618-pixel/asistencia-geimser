import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '../../../../../../lib/supabase/server';
import type { Tables } from '../../../../../../types/database';
import { getAdminOverview } from '../../../../../../lib/reports/overview';
import { resolveUserRole } from '../../../../../../lib/auth/role';

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

const authorize = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { role: null } as const;
  }
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role = await resolveUserRole(authData.user, defaultRole);
  if (!isManager(role)) {
    return { role: null } as const;
  }
  return { role } as const;
};

export async function GET() {
  const { role } = await authorize();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const overview = await getAdminOverview();

  return NextResponse.json(overview);
}
