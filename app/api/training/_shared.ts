import type { User } from '@supabase/supabase-js';
import { createRouteSupabaseClient } from '../../../lib/supabase/server';
import type { Tables } from '../../../types/database';
import { resolveUserRole } from '../../../lib/auth/role';
import { getUserDisplayName } from '../../../lib/auth/displayName';

type Role = Tables['people']['Row']['role'];

export type TrainingAuthContext = {
  user: User;
  role: Role;
  displayName: string;
};

export const canManageTraining = (role: Role) => role === 'ADMIN' || role === 'SUPERVISOR';

export const getTrainingAuthContext = async (): Promise<TrainingAuthContext | null> => {
  const supabase = await createRouteSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Role) ?? 'WORKER';
  const role = await resolveUserRole(user, defaultRole);

  return {
    user,
    role,
    displayName: getUserDisplayName(user),
  };
};
