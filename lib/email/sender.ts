import { Resend } from 'resend';
import { render } from '@react-email/render';
import AttendanceReceiptEmail from './templates/AttendanceReceiptEmail';
import { getServiceSupabase } from '../supabase/server';

// In production, this should come from env.
const resend = new Resend(process.env.RESEND_API_KEY ?? 're_123456789');

export interface SendReceiptParams {
    to: string;
    personName: string;
    markId: string;
    eventType: 'IN' | 'OUT';
    eventTs: string;
    hashSelf: string;
    siteName: string;
    receiptUrl?: string;
}

/**
 * 1. Tries to send immediately.
 * 2. If fails (or API key missing), ensures it is QUEUED in DB for retry.
 * 3. If successful, updates queue status to SENT (or doesn't insert if we want to save space, but redundant log is good).
 */
export async function queueReceiptEmail(params: SendReceiptParams) {
    const supabase = getServiceSupabase();

    // Insert into queue as PENDING first (Maximum safety)
    const { data: queueItem, error: queueError } = await supabase
        .from('receipt_queue')
        .insert({
            mark_id: params.markId,
            person_email: params.to,
            person_name: params.personName,
            event_type: params.eventType,
            event_ts: new Date(params.eventTs).toISOString(), // Ensure ISO format for DB
            hash_self: params.hashSelf,
            site_name: params.siteName,
            status: 'PENDING'
        } as never)
        .select('id')
        .single();

    if (queueError) {
        console.error('[EMAIL_QUEUE] Critical: Failed to queue receipt', queueError);
        // If DB is down, we really have no fallback other than logging.
        return;
    }

    // Try immediate send
    if (!process.env.RESEND_API_KEY) {
        console.warn('[EMAIL] No API Key, leaving in PENDING state.');
        return;
    }

    try {
        const emailHtml = await render(
            AttendanceReceiptEmail({
                personName: params.personName,
                markId: params.markId,
                eventType: params.eventType,
                eventTs: params.eventTs,
                hashSelf: params.hashSelf,
                siteName: params.siteName,
                receiptUrl: params.receiptUrl,
            })
        );

        const { error: sendError } = await resend.emails.send({
            from: 'Asistencia Geimser <noreply@resend.dev>',
            to: [params.to],
            subject: `Comprobante de ${params.eventType === 'IN' ? 'Entrada' : 'Salida'} - ${params.eventTs}`,
            html: emailHtml,
        });

        if (sendError) {
            console.error('[EMAIL] Immediate send failed, item stays PENDING:', sendError);
            // Update error log in queue
            await supabase.from('receipt_queue').update({
                error_log: JSON.stringify(sendError),
                last_attempt_at: new Date().toISOString(),
                attempts: 1
            } as never).eq('id', queueItem.id);
        } else {
            console.log('[EMAIL] Receipt sent successfully for', queueItem.id);
            // Mark as SENT
            await supabase.from('receipt_queue').update({
                status: 'SENT',
                last_attempt_at: new Date().toISOString(),
                attempts: 1
            } as never).eq('id', queueItem.id);
        }

    } catch (error) {
        console.error('[EMAIL] Unexpected error:', error);
        // Update error log in queue
        await supabase.from('receipt_queue').update({
            error_log: (error as Error).message,
            last_attempt_at: new Date().toISOString(),
            attempts: 1
        } as never).eq('id', queueItem.id);
    }
}
