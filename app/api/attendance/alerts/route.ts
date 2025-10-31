import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../lib/supabase/server';
import type { PostgrestError } from '@supabase/supabase-js';
import type { Tables } from '../../../../types/database';

const querySchema = z.object({
  personId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
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
    const db = service;
    const { data: personRow, error: personError } = await db
      .from('people')
      .select('id, role')
      .eq('id', authData.user.id as string)
      .maybeSingle<Tables['people']['Row']>();

    if (personError) {
      const code = (personError as PostgrestError | null)?.code;
      if (code === 'PGRST106' || code === 'PGRST205') {
        console.warn('[alerts] people table not accessible', personError.message);
        return NextResponse.json({ items: [] });
      }
      console.error('[alerts] person lookup failed', personError);
      return NextResponse.json({ items: [] });
    }

    if (!personRow) {
      return NextResponse.json({ items: [] });
    }

    const person = personRow;

    let query: z.infer<typeof querySchema>;
    try {
      query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    } catch (parseError) {
      console.warn('[alerts] invalid params', parseError);
      return NextResponse.json({ items: [] });
    }

    const targetPersonId = isManager(person.role) && query.personId ? query.personId : person.id;

    const { data, error } = await db
      .from('alerts')
      .select('*')
      .eq('person_id', targetPersonId)
      .eq('resolved', false)
      .order('ts', { ascending: false })
      .limit(query.limit);

    if (error) {
      console.error('[alerts] fetch failed', error);
      return NextResponse.json({ items: [] });
    }

    return NextResponse.json({ items: (data as Tables['alerts']['Row'][] | null) ?? [] });
  } catch (unexpected) {
    console.error('[alerts] unexpected error', unexpected);
    return NextResponse.json({ items: [] });
  }
}
