import 'server-only';

import type { User } from '@supabase/supabase-js';
import type { Tables } from '../../types/database';
import { runQuery } from '../db/postgres';

type Role = Tables['people']['Row']['role'];

const isRole = (value: unknown): value is Role =>
  value === 'ADMIN' || value === 'SUPERVISOR' || value === 'DT_VIEWER' || value === 'WORKER';

export async function getPersonRoleFromDb(userId: string): Promise<Role | null> {
  try {
    const { rows } = await runQuery<{ role: Role }>('select role from public.people where id = $1 limit 1', [userId]);
    const role = rows[0]?.role ?? null;
    return isRole(role) ? role : null;
  } catch {
    return null;
  }
}

export async function resolveUserRole(user: User, defaultRole: Role): Promise<Role> {
  const metaRole =
    (user.app_metadata?.role as Role | undefined) ??
    (user.user_metadata?.role as Role | undefined) ??
    undefined;

  if (isRole(metaRole)) {
    return metaRole;
  }

  const dbRole = await getPersonRoleFromDb(user.id);
  if (dbRole) {
    return dbRole;
  }

  return defaultRole;
}

