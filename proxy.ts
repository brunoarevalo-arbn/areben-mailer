import { NextRequest, NextResponse } from 'next/server';

// Barrera de acceso interina (HTTP Basic Auth) para proteger la app online,
// que muestra PII (contactos). En Fase 1 se reemplaza por login con sesión.
// Se excluyen los endpoints que llaman TN y SES sin credenciales.

const PUBLIC_PREFIXES = [
  '/api/tn/', // callback OAuth + webhooks LGPD (los llama Tiendanube)
  '/api/health',
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const user = process.env.APP_USER;
  const pass = process.env.APP_PASSWORD;
  // Si no hay credenciales configuradas, no bloqueamos (dev local).
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const [u, p] = atob(auth.slice(6)).split(':');
    if (u === user && p === pass) return NextResponse.next();
  }

  return new NextResponse('Autenticación requerida', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Areben Mailer"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
