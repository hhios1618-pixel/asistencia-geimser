import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const start = performance.now();
    const supabase = await createRouteSupabaseClient();

    // Check Database connection (simple query)
    const { data, error } = await supabase.from('settings').select('key').limit(1);

    const duration = performance.now() - start;

    if (error) {
        return NextResponse.json({
            status: 'Unhealthy',
            timestamp: new Date().toISOString(),
            checks: {
                database: { status: 'down', error: error.message }
            }
        }, { status: 503 });
    }

    return NextResponse.json({
        status: 'Healthy',
        timestamp: new Date().toISOString(),
        latency_ms: Math.round(duration),
        checks: {
            database: { status: 'up' },
            uptime_target: '99.9%'
        }
    }, { status: 200 });
}
