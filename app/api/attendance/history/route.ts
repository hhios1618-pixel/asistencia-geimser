import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../lib/supabase/server';
import type { PostgrestError } from '@supabase/supabase-js';
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
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const service = getServiceSupabase();
    const db = service.schema('asistencia');
    const { data: personRow, error: personError } = await db
      .from('people')
      .select('*')
      .eq('id', authData.user.id as string)
      .maybeSingle<Tables['people']['Row']>();

    if (personError) {
      const code = (personError as PostgrestError | null)?.code;
      if (code === 'PGRST106' || code === 'PGRST205') {
        console.warn('[attendance_history] people table not accessible', personError.message);
        return NextResponse.json({ items: [] });
      }
      console.error('[attendance_history] person lookup failed', personError);
      return NextResponse.json({ items: [] });
    }

    let personProfile = personRow ? { ...personRow, role: personRow.role ?? 'WORKER' } : null;

    if (!personProfile) {
      const fallbackName =
        (authData.user.user_metadata?.full_name as string | undefined) ??
        authData.user.email?.split('@')[0]?.replace(/\./g, ' ') ??
        'Colaborador';
      const defaultRole =
        (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'WORKER';

      const { data: provisioned, error: provisionError } = await db
        .from('people')
        .upsert(
          {
            id: authData.user.id as string,
            name: fallbackName.trim(),
            email: authData.user.email,
            role: defaultRole,
            is_active: true,
          },
          { onConflict: 'id' }
        )
        .select('*')
        .maybeSingle<Tables['people']['Row']>();

      if (provisionError) {
        console.error('[attendance_history] provision failed', provisionError);
        return NextResponse.json({ items: [] });
      }

      if (!provisioned) {
        return NextResponse.json({ items: [] });
      }

      personProfile = provisioned;
    }

    let params: z.infer<typeof querySchema>;
    try {
      params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    } catch (parseError) {
      console.warn('[attendance_history] invalid params', parseError);
      return NextResponse.json({ items: [] });
    }

    const targetPersonId = isManager(personProfile.role) && params.personId ? params.personId : personProfile.id;

    const query = db
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

    if (marksError) {
      console.error('[attendance_history] fetch failed', marksError);
      return NextResponse.json({ items: [] });
    }

    const attendanceMarks = (marks as Tables['attendance_marks']['Row'][] | null) ?? [];

    const signedMarks = await Promise.all(
      attendanceMarks.map(async (mark) => {
        if (!mark.receipt_url) {
          return { ...mark, receipt_signed_url: null };
        }
        try {
          const { data: signed, error: signedError } = await service.storage
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
  } catch (unexpected) {
    console.error('[attendance_history] unexpected error', unexpected);
    return NextResponse.json({ items: [] });
  }
}
