import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../../../lib/supabase/server';
import { issueDtLink, validateDtToken } from '../../../../../../lib/dt/access';
import type { Tables } from '../../../../../../types/database';
import { runQuery } from '../../../../../../lib/db/postgres';

const postSchema = z.object({
  scope: z.object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    personIds: z.array(z.string().uuid()).optional(),
    siteIds: z.array(z.string().uuid()).optional(),
  }),
  expiresInMinutes: z.number().int().min(5).max(60 * 24 * 30),
});

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

export const runtime = 'nodejs';

const fetchPersonAccess = async (userId: string) => {
  let record: Pick<Tables['people']['Row'], 'role' | 'is_active'> | null = null;
  try {
    const { rows } = await runQuery<Pick<Tables['people']['Row'], 'role' | 'is_active'>>(
      'select role, is_active from public.people where id = $1',
      [userId]
    );
    record = rows[0] ?? null;
  } catch (error) {
    console.warn('[dt_access] role lookup via pool failed, attempting service fallback', error);
  }

  if (!record) {
    try {
      const service = getServiceSupabase();
      const { data, error } = await service
        .from('people')
        .select('role, is_active')
        .eq('id', userId)
        .maybeSingle<Pick<Tables['people']['Row'], 'role' | 'is_active'>>();
      if (error) {
        console.warn('[dt_access] service fallback role lookup failed', error);
      } else if (data) {
        record = data;
      }
    } catch (serviceError) {
      console.error('[dt_access] service fallback role lookup threw', serviceError);
    }
  }

  return record;
};

const authorizeAdmin = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { userId: null as string | null, role: null as Tables['people']['Row']['role'] | null } as const;
  }
  const userId = authData.user.id as string;
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const fallbackRole =
    (authData.user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (authData.user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;

  let role = fallbackRole;
  let isActive = true;

  const personRecord = await fetchPersonAccess(userId);
  if (personRecord?.role) {
    role = personRecord.role;
    isActive = personRecord.is_active;
  }

  if (!isActive) {
    return { userId, role: null } as const;
  }

  if (!isManager(role)) {
    return { userId, role: null } as const;
  }
  return { userId, role } as const;
};

export async function POST(request: NextRequest) {
  const { userId, role } = await authorizeAdmin();
  if (!userId || !role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let payload: z.infer<typeof postSchema>;
  try {
    payload = postSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + payload.expiresInMinutes * 60 * 1000);
  const service = getServiceSupabase();
  try {
    const link = await issueDtLink(service, {
      scope: payload.scope,
      expiresAt,
    });
    return NextResponse.json({ url: link.url, expiresAt: link.expiresAt.toISOString() }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'ISSUE_FAILED', details: (error as Error).message }, { status: 500 });
  }
}

const datasetFromScope = async (scope: z.infer<typeof postSchema>['scope']) => {
  const conditions = ['event_ts >= $1', 'event_ts <= $2'];
  const params: unknown[] = [scope.from, scope.to];
  let index = 3;

  if (scope.personIds && scope.personIds.length > 0) {
    conditions.push(`person_id = any($${index}::uuid[])`);
    params.push(scope.personIds);
    index += 1;
  }

  if (scope.siteIds && scope.siteIds.length > 0) {
    conditions.push(`site_id = any($${index}::uuid[])`);
    params.push(scope.siteIds);
    index += 1;
  }

  const { rows } = await runQuery<Tables['attendance_marks']['Row']>(
    `select * from public.attendance_marks
     where ${conditions.join(' and ')}
     order by event_ts`,
    params
  );
  return rows;
};

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const expires = request.nextUrl.searchParams.get('expires');
  if (!token || !expires) {
    return NextResponse.json({ error: 'TOKEN_REQUIRED' }, { status: 400 });
  }

  const expiresEpoch = Number(expires);
  if (Number.isNaN(expiresEpoch)) {
    return NextResponse.json({ error: 'INVALID_EXPIRES' }, { status: 400 });
  }

  try {
    const validation = await validateDtToken(getServiceSupabase(), token, expiresEpoch);
    const scope = validation.scope as z.infer<typeof postSchema>['scope'];
    const data = await datasetFromScope(scope);
    return NextResponse.json({ tokenId: validation.tokenId, expiresAt: validation.expiresAt.toISOString(), scope, data });
  } catch (error) {
    return NextResponse.json({ error: 'TOKEN_INVALID', details: (error as Error).message }, { status: 403 });
  }
}
