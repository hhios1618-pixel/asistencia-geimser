import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from './types/database';

// Rutas que NO requieren autenticación
const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/update-password',
  '/api/health',
  '/api/auth',
];

// Rutas exclusivas por rol
const ROLE_ROUTES: Record<string, string[]> = {
  CLIENT: ['/cliente', '/api/campaigns', '/api/me', '/api/client'],
  WORKER: ['/agente', '/api/me'],
  SUPERVISOR: ['/supervisor', '/campanas', '/api/campaigns', '/api/me'],
  ADMIN: ['/admin', '/campanas', '/api', '/agente', '/supervisor'],
  DT_VIEWER: ['/dt'],
};

// Redirect por rol después del login
const ROLE_HOME: Record<string, string> = {
  CLIENT: '/cliente',
  WORKER: '/agente',
  SUPERVISOR: '/supervisor',
  ADMIN: '/admin',
  DT_VIEWER: '/dt',
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req: request, res: response });

  const { data: { session } } = await supabase.auth.getSession();
  const { pathname } = request.nextUrl;

  // Permitir rutas públicas
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    // Si ya está autenticado y va al login, redirigir a su home
    if (session && pathname === '/login') {
      try {
        const { data: personData } = await supabase
          .from('people')
          .select('role')
          .eq('id', session.user.id)
          .single();

        const personRole = (personData as { role?: string } | null)?.role;
        if (personRole) {
          const home = ROLE_HOME[personRole] || '/admin';
          return NextResponse.redirect(new URL(home, request.url));
        }
      } catch {}
    }
    return response;
  }

  // Si no hay sesión, redirigir al login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Obtener rol del usuario
  try {
    const { data: personData } = await supabase
      .from('people')
      .select('role, is_active')
      .eq('id', session.user.id)
      .single();
    const person = personData as { role: string; is_active: boolean } | null;

    if (!person || !person.is_active) {
      const loginUrl = new URL('/login', request.url);
      await supabase.auth.signOut();
      return NextResponse.redirect(loginUrl);
    }

    const role = person.role as string;

    // Cliente: solo puede acceder a /cliente y sus APIs
    if (role === 'CLIENT') {
      const allowed = ['/cliente', '/api/campaigns', '/api/me', '/api/client', '/api/auth'];
      const isAllowed = allowed.some(r => pathname.startsWith(r));
      if (!isAllowed) {
        return NextResponse.redirect(new URL('/cliente', request.url));
      }
    }

    // Worker/Agente: solo puede acceder a /agente y sus APIs
    if (role === 'WORKER') {
      const allowed = ['/agente', '/api/me', '/api/auth', '/ayuda'];
      const isAllowed = allowed.some(r => pathname.startsWith(r));
      if (!isAllowed) {
        return NextResponse.redirect(new URL('/agente', request.url));
      }
    }
  } catch {
    // Si falla la consulta de rol, dejar pasar (no bloquear)
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|images).*)',
  ],
};
