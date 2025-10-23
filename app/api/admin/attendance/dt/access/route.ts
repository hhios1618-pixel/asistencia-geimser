import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../../../lib/supabase/server';
import { issueDtLink, validateDtToken } from '../../../../../../lib/dt/access';
import type { Tables } from '../../../../../../types/database';

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

const authorizeAdmin = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { supabase, person: null } as const;
  }
  const { data: person } = await supabase
    .from('people')
    .select('*')
    .eq('id', authData.user.id as string)
    .maybeSingle<Tables['people']['Row']>();
  if (!person || !isManager(person.role)) {
    return { supabase, person: null } as const;
  }
  return { supabase, person } as const;
};

export async function POST(request: NextRequest) {
  const { person } = await authorizeAdmin();
  if (!person) {
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
  const service = getServiceSupabase();
  const query = service
    .from('attendance_marks')
    .select('*')
    .gte('event_ts', scope.from)
    .lte('event_ts', scope.to)
    .order('event_ts', { ascending: true });

  if (scope.personIds && scope.personIds.length > 0) {
    query.in('person_id', scope.personIds);
  }
  if (scope.siteIds && scope.siteIds.length > 0) {
    query.in('site_id', scope.siteIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
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
