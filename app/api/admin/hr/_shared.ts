import { z } from 'zod';
import { createRouteSupabaseClient } from '../../../../lib/supabase/server';
import type { Tables } from '../../../../types/database';
import { resolveUserRole } from '../../../../lib/auth/role';

export const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

export const authorizeManager = async () => {
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

export const uuidParamSchema = z.string().uuid();
