import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../lib/supabase/server';
import type { Tables } from '../../../../types/database';

const querySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  personId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(1000).default(200),
});

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = await createRouteSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const { data: person, error: personError } = await supabase
    .from('people')
    .select('*')
    .eq('id', authData.user.id as string)
    .maybeSingle<Tables['people']['Row']>();

  if (personError || !person) {
    return NextResponse.json({ error: 'PERSON_NOT_FOUND' }, { status: 403 });
  }

  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  } catch (parseError) {
    return NextResponse.json({ error: 'INVALID_PARAMS', details: (parseError as Error).message }, { status: 400 });
  }

  const targetPersonId = isManager(person.role) && params.personId ? params.personId : person.id;

  const query = supabase
    .from('attendance_marks')
    .select('*')
    .eq('person_id', targetPersonId)
    .order('event_ts', { ascending: false })
    .limit(params.limit);

  if (params.from) {
    query.gte('event_ts', params.from);
  }
  if (params.to) {
    query.lte('event_ts', params.to);
  }
  if (params.siteId) {
    query.eq('site_id', params.siteId);
  }

  const { data: marks, error: marksError } = await query;
  const attendanceMarks = (marks as Tables['attendance_marks']['Row'][] | null) ?? [];
  if (marksError) {
    return NextResponse.json({ error: 'HISTORY_FETCH_FAILED', details: marksError.message }, { status: 500 });
  }

  const serviceSupabase = getServiceSupabase();
  const signedMarks = await Promise.all(
    attendanceMarks.map(async (mark) => {
      if (!mark.receipt_url) {
        return { ...mark, receipt_signed_url: null };
      }
      try {
        const { data: signed, error: signedError } = await serviceSupabase.storage
          .from('receipts')
          .createSignedUrl(mark.receipt_url, 60 * 60 * 24 * 7);
        if (signedError) {
          return { ...mark, receipt_signed_url: null };
        }
        return { ...mark, receipt_signed_url: signed?.signedUrl ?? null };
      } catch {
        return { ...mark, receipt_signed_url: null };
      }
    })
  );

  return NextResponse.json({ items: signedMarks });
}
