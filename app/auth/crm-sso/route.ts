import { NextResponse } from 'next/server';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../lib/supabase/server';
import { verifyCrossAppSsoToken } from '../../../lib/auth/crossAppSso';
import { mapCrmRoleToAsistenciaRole } from '../../../lib/integrations/registroIntel';

export const dynamic = 'force-dynamic';

const sanitizeNextPath = (nextRaw: string | null, fallback = '/asistencia/capacitacion') => {
  if (!nextRaw) return fallback;
  const trimmed = nextRaw.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;
  return trimmed;
};

type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';

const isEmailOtpType = (value: string): value is EmailOtpType =>
  value === 'signup' ||
  value === 'invite' ||
  value === 'magiclink' ||
  value === 'recovery' ||
  value === 'email_change' ||
  value === 'email';

const randomPassword = () => {
  const raw = crypto.randomUUID().replace(/-/g, '');
  return `${raw.slice(0, 12)}Aa1`;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get('token');
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get('next'));

  if (!token) {
    return NextResponse.redirect(`${requestUrl.origin}/login?error=crm_sso_missing_token`);
  }

  const payload = verifyCrossAppSsoToken(token);
  if (!payload) {
    return NextResponse.redirect(`${requestUrl.origin}/login?error=crm_sso_invalid_token`);
  }

  const supabase = await createRouteSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && (user.id === payload.sub || (user.email ?? '').toLowerCase() === payload.email.toLowerCase())) {
    return NextResponse.redirect(`${requestUrl.origin}${nextPath}`);
  }

  // If there is another signed-in user in this browser, clear it before SSO.
  if (user && (user.email ?? '').toLowerCase() !== payload.email.toLowerCase()) {
    await supabase.auth.signOut();
  }

  const service = getServiceSupabase();

  let generated = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: payload.email,
    options: {
      redirectTo: `${requestUrl.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (generated.error) {
    const mappedRole = mapCrmRoleToAsistenciaRole(payload.role ?? null) ?? 'WORKER';
    const create = await service.auth.admin.createUser({
      email: payload.email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: {
        full_name: payload.name ?? payload.email,
      },
      app_metadata: {
        role: mappedRole,
      },
    });

    if (create.error) {
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=crm_sso_user_error&error_description=${encodeURIComponent(create.error.message)}`
      );
    }

    generated = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: payload.email,
      options: {
        redirectTo: `${requestUrl.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
  }

  const actionLink = generated.data?.properties?.action_link;
  const emailOtp = generated.data?.properties?.email_otp;
  const hashedToken = generated.data?.properties?.hashed_token;

  let verifyErrorMessage = generated.error?.message ?? null;
  let verified = null as Awaited<ReturnType<typeof supabase.auth.verifyOtp>> | null;

  // Preferred robust path: verify OTP server-side and write session cookie directly.
  if (emailOtp) {
    verified = await supabase.auth.verifyOtp({
      email: payload.email,
      token: emailOtp,
      type: 'magiclink',
    });
    if (verified.error) {
      verifyErrorMessage = verified.error.message;
    }
  }

  // Fallback 1: verify by token hash if provider returns it.
  if ((!verified || verified.error) && hashedToken) {
    verified = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    });
    if (verified.error) {
      verifyErrorMessage = verified.error.message;
    }
  }

  // Fallback 2: parse token hash from action link and verify server-side.
  if ((!verified || verified.error) && actionLink) {
    try {
      const actionLinkUrl = new URL(actionLink);
      const linkTokenHash = actionLinkUrl.searchParams.get('token_hash');
      const linkType = actionLinkUrl.searchParams.get('type');
      if (linkTokenHash && linkType && isEmailOtpType(linkType)) {
        verified = await supabase.auth.verifyOtp({
          token_hash: linkTokenHash,
          type: linkType,
        });
        if (verified.error) {
          verifyErrorMessage = verified.error.message;
        }
      }
    } catch {
      // ignore malformed link, handled by final error redirect below
    }
  }

  if (verified && !verified.error) {
    const session = verified.data?.session;
    if (session?.access_token && session?.refresh_token) {
      const setSessionResult = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (!setSessionResult.error) {
        return NextResponse.redirect(`${requestUrl.origin}${nextPath}`);
      }
      verifyErrorMessage = setSessionResult.error.message;
    } else {
      return NextResponse.redirect(`${requestUrl.origin}${nextPath}`);
    }
  }

  if (generated.error) {
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=crm_sso_link_error&error_description=${encodeURIComponent(
        generated.error?.message ?? 'No se pudo generar el acceso automático'
      )}`
    );
  }

  return NextResponse.redirect(
    `${requestUrl.origin}/login?error=crm_sso_verify_error&error_description=${encodeURIComponent(
      verifyErrorMessage ?? 'No se pudo confirmar la sesión SSO'
    )}`
  );
}
