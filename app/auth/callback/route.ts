import { createRouteSupabaseClient } from '../../../lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') ?? '/asistencia';

    if (code) {
        const supabase = await createRouteSupabaseClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            return NextResponse.redirect(`${requestUrl.origin}${next}`);
        } else {
            console.error("Auth callback error: ", error);
            // On error, redirect to login with error parameter or a specific error page
            return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_error`);
        }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(`${requestUrl.origin}/login?error=no_code`);
}
