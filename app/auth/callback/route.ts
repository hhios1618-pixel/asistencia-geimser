import { createRouteSupabaseClient } from '../../../lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const sanitizeNextPath = (nextRaw: string | null, fallback = '/asistencia') => {
    if (!nextRaw) return fallback;
    const trimmed = nextRaw.trim();
    if (!trimmed.startsWith('/')) return fallback;
    if (trimmed.startsWith('//')) return fallback;
    return trimmed;
};

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = sanitizeNextPath(requestUrl.searchParams.get('next'));

    if (code) {
        const supabase = await createRouteSupabaseClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            return NextResponse.redirect(`${requestUrl.origin}${next}`);
        } else {
            console.error("Auth callback error: ", error);
            // On error, redirect to login with error parameter or a specific error page
            return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_error&error_description=${encodeURIComponent(error.message)}`);
        }
    }

    // For implicit token flows Supabase may return tokens in URL hash (#access_token),
    // which the server cannot read. Redirect to login so client can consume hash.
    return NextResponse.redirect(`${requestUrl.origin}/login?next=${encodeURIComponent(next)}`);
}
