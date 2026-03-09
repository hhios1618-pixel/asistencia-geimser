import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '../../../../lib/supabase/server';
import { resolveUserRole } from '../../../../lib/auth/role';
import type { Tables } from '../../../../types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role = await resolveUserRole(authData.user, defaultRole);
  return NextResponse.json({ role }, { headers: { 'Cache-Control': 'no-store' } });
}
