import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '../../../../lib/supabase/server';
import { resolveUserRole } from '../../../../lib/auth/role';
import { computeHash, HashPayload } from '../../../../lib/dt/hashchain';
import type { Tables } from '../../../../types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const supabase = await createRouteSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
        return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const role = await resolveUserRole(authData.user, 'WORKER');
    if (role !== 'ADMIN' && role !== 'DT_VIEWER') {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // 1. Fetch all marks ordered by person and time
    const { data: marks, error: dbError } = await supabase
        .from('attendance_marks')
        .select('*')
        .order('person_id', { ascending: true })
        .order('event_ts', { ascending: true });

    if (dbError) {
        return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    const results = {
        total_marks: marks.length,
        valid_chains: 0,
        broken_chains: 0,
        details: [] as string[]
    };

    // 2. Group by person
    const personMarks: Record<string, Tables['attendance_marks']['Row'][]> = {};
    for (const mark of marks) {
        if (!personMarks[mark.person_id]) {
            personMarks[mark.person_id] = [];
        }
        personMarks[mark.person_id].push(mark);
    }

    // 3. Verify each person's chain
    for (const [personId, chain] of Object.entries(personMarks)) {
        let previousHash: string | null = null;
        let chainValid = true;

        for (const mark of chain) {
            // Verify link to previous
            if (mark.hash_prev !== previousHash) {
                results.details.push(`BROKEN LINK: Person ${personId}, Mark ${mark.id}. Expected prev ${previousHash}, got ${mark.hash_prev}`);
                chainValid = false;
            }

            // Recompute self hash
            const payload: HashPayload = {
                personId: mark.person_id,
                siteId: mark.site_id,
                eventType: mark.event_type as 'IN' | 'OUT',
                eventTs: mark.event_ts,
                clientTs: mark.client_ts ?? undefined,
                geo: (mark.geo_lat && mark.geo_lng) ? {
                    lat: mark.geo_lat,
                    lng: mark.geo_lng,
                    acc: mark.geo_acc ?? undefined
                } : undefined,
                deviceId: mark.device_id ?? undefined,
                note: mark.note ?? undefined
            };

            const computed = computeHash(payload, mark.hash_prev);
            if (computed !== mark.hash_self) {
                results.details.push(`INTEGRITY FAILURE: Person ${personId}, Mark ${mark.id}. Computed ${computed} != Stored ${mark.hash_self}`);
                chainValid = false;
            }

            previousHash = mark.hash_self;
        }

        if (chainValid) {
            results.valid_chains++;
        } else {
            results.broken_chains++;
        }
    }

    return NextResponse.json({
        status: results.broken_chains === 0 ? 'INTEGRITY_VERIFIED' : 'INTEGRITY_COMPROMISED',
        timestamp: new Date().toISOString(),
        results
    });
}
