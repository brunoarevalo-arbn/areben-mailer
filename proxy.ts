import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/jwt';

// Autenticación por sesión (cookie firmada). Chequeo optimista: solo lee/verifica
// el JWT de la cookie, sin tocar la DB (el proxy corre en cada request/prefetch).
// La seguridad real vive en el DAL (verifySession) de cada page/action.

const PUBLIC_PREFIXES = [
  '/login', // pantalla de ingreso
  '/api/tn/', // callback OAuth + webhooks LGPD (los llama Tiendanube)
  '/api/health',
  '/api/track/', // pixel de apertura + redirect de clicks (los abren los destinatarios)
  '/api/ses/', // notificaciones SNS de rebotes/quejas (las llama AWS)
  '/api/automations/procesar', // lo llama el cron (protegido por CRON_SECRET)
  '/baja', // desuscripción: la abren destinatarios sin login
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  const token = req.cookies.get('session')?.value;
  const session = await decrypt(token);

  // Ya logueado y yendo a /login → a la app.
  if (session?.userId && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (isPublic) return NextResponse.next();

  // Ruta protegida sin sesión → login.
  if (!session?.userId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
