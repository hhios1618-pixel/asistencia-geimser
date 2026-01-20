import { createRouteSupabaseClient } from '../../../../lib/supabase/server';
import type { Tables } from '../../../../types/database';

export const runtime = 'nodejs';

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

export const authorizeManager = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { role: null } as const;
  }
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role =
    (authData.user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (authData.user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;
  if (!isManager(role)) {
    return { role: null } as const;
  }
  return { role } as const;
};

