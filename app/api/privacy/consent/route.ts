import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient } from '../../../../lib/supabase/server';
import type { Tables } from '../../../../types/database';

export const runtime = 'nodejs';

const bodySchema = z.object({
  consentType: z.enum(['GEO', 'PRIVACY']),
  version: z.string().trim().min(1).max(50),
});

type PgErrorLike = { code?: string; message?: string };

const respond = (status: number, payload: unknown) =>
  new NextResponse(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function POST(request: NextRequest) {
  const supabase = await createRouteSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return respond(401, { error: 'UNAUTHENTICATED' });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return respond(400, { error: 'INVALID_BODY', details: (error as Error).message });
  }

  const personId = authData.user.id as string;

  const payload: Tables['consent_logs']['Insert'] = {
    person_id: personId,
    consent_type: body.consentType,
    version: body.version,
    ip: request.headers.get('x-forwarded-for') ?? null,
    user_agent: request.headers.get('user-agent') ?? null,
  };

  const { data, error } = await supabase.from('consent_logs').insert(payload as never).select('*').single();

  if (!error && data) {
    return respond(201, { item: data });
  }

  const pgError = error as unknown as PgErrorLike | null;
  const duplicate = pgError?.code === '23505' || (pgError?.message ?? '').toLowerCase().includes('duplicate');
  if (!duplicate) {
    return respond(500, { error: 'CONSENT_INSERT_FAILED', details: pgError?.message ?? 'unknown_error' });
  }

  const { data: existing, error: existingError } = await supabase
    .from('consent_logs')
    .select('*')
    .eq('person_id', personId)
    .eq('consent_type', body.consentType)
    .eq('version', body.version)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError || !existing) {
    return respond(500, { error: 'CONSENT_FETCH_FAILED', details: existingError?.message ?? 'unknown_error' });
  }

  return respond(200, { item: existing });
}

