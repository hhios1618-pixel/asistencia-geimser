import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../lib/supabase/server';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import AttendanceReceiptEmail from '../../../../lib/email/templates/AttendanceReceiptEmail';

export const runtime = 'nodejs';
// Prevent this from being cached
export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY ?? 're_123456789');

/**
 * CRON JOB: Process Pending/Failed Email Receipts
 * Recommended frequency: Every 10-15 minutes.
 * Can be called via Vercel Cron or external scheduler.
 */
export async function GET(request: NextRequest) {
    // Optional: Add a robust secret check here
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorized', { status: 401 });

    const supabase = getServiceSupabase();

    // Find items that are PENDING or FAILED (with < 5 attempts) 
    // and haven't been touched in the last 2 minutes
    const retryThreshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data: queueItems, error } = await supabase
        .from('receipt_queue')
        .select('*')
        .in('status', ['PENDING', 'FAILED'])
        .lt('attempts', 5)
        .or(`last_attempt_at.is.null,last_attempt_at.lt.${retryThreshold}`)
        .limit(50);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!queueItems || queueItems.length === 0) {
        return NextResponse.json({ message: 'No pending emails to process.' });
    }

    const results = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [] as string[]
    };

    for (const item of queueItems) {
        results.processed++;
        try {
            // Re-construct email
            const emailHtml = await render(
                AttendanceReceiptEmail({
                    personName: item.person_name,
                    markId: item.mark_id,
                    eventType: item.event_type as 'IN' | 'OUT',
                    eventTs: new Date(item.event_ts).toLocaleString('es-CL'),
                    hashSelf: item.hash_self,
                    siteName: item.site_name,
                })
            );

            const { error: sendError } = await resend.emails.send({
                from: 'Asistencia Geimser <noreply@resend.dev>',
                to: [item.person_email],
                subject: `Comprobante de ${item.event_type === 'IN' ? 'Entrada' : 'Salida'} - ${new Date(item.event_ts).toLocaleString('es-CL')}`,
                html: emailHtml,
            });

            if (sendError) {
                await supabase.from('receipt_queue').update({
                    status: 'FAILED',
                    error_log: JSON.stringify(sendError),
                    last_attempt_at: new Date().toISOString(),
                    attempts: item.attempts + 1
                } as never).eq('id', item.id);
                results.failed++;
                results.errors.push(`Item ${item.id}: ${JSON.stringify(sendError)}`);
            } else {
                await supabase.from('receipt_queue').update({
                    status: 'SENT',
                    error_log: null,
                    last_attempt_at: new Date().toISOString(),
                    attempts: item.attempts + 1
                } as never).eq('id', item.id);
                results.succeeded++;
            }

        } catch (err) {
            await supabase.from('receipt_queue').update({
                status: 'FAILED',
                error_log: (err as Error).message,
                last_attempt_at: new Date().toISOString(),
                attempts: item.attempts + 1
            } as never).eq('id', item.id);
            results.failed++;
            results.errors.push(`Item ${item.id}: ${(err as Error).message}`);
        }
    }

    return NextResponse.json({ success: true, results });
}
