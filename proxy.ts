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
  '/api/regresiva', // el PNG de la cuenta regresiva: lo pide el cliente de mail del destinatario
  '/api/ses/', // notificaciones SNS de rebotes/quejas (las llama AWS)
  '/api/webhooks/', // rebotes/quejas de Resend y SendGrid (los llaman ellos)
  '/api/automations/procesar', // lo llama el cron (protegido por CRON_SECRET)
  '/api/campanias/procesar-cola', // worker de la cola de envío (protegido por CRON_SECRET)
  '/api/carritos/detectar', // poller de carritos abandonados (protegido por CRON_SECRET)
  '/api/carritos/recuperados', // barrido: cuáles de esos carritos terminaron en compra (ídem)
  '/baja', // desuscripción: la abren destinatarios sin login
  '/f/', // formularios de captura públicos (single opt-in)
  // 🔴 **Todo directorio de `public/` que se sirva DENTRO de un mail va acá.**
  // El matcher de abajo solo excluye `_next/static`, así que lo que vive en
  // `public/` pasa por este chequeo igual, y sin su línea rebota al login con un
  // 307: en un cliente de mail eso es una imagen rota para TODOS los
  // destinatarios, y no se puede corregir después de enviado. Son PNG
  // estáticos, no dicen nada de nadie.
  //
  // ⚠️ Ya pasó: el 2-ago-2026 el pack de `/iconos/` se agregó, se deployó y
  // devolvía 307 a `/login` con este comentario ya escrito arriba. Por eso hoy
  // lo fija `scripts/probar-redes.ts`, que compara esta lista contra los
  // directorios que el renderer sabe pedir.
  '/redes/',
  '/iconos/',
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  const token = req.cookies.get('session')?.value;
  const session = await decrypt(token);

  // Sesión huérfana: la cookie es válida pero el usuario ya no existe o quedó
  // sin cuenta, y getAuth() nos mandó acá. Hay que BORRAR la cookie, cosa que
  // un server component no puede hacer. Sin esto el rebote de abajo devolvería
  // a la app, la app volvería a redirigir, y el usuario quedaría en un bucle.
  if (pathname === '/login' && req.nextUrl.searchParams.has('sesion')) {
    const res = NextResponse.next();
    res.cookies.delete('session');
    return res;
  }

  // Ya logueado y yendo a /login → a la app.
  if (session?.userId && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (isPublic) return NextResponse.next();

  // Ruta protegida sin sesión → login.
  if (!session?.userId) {
    // Las de /api/ no se redirigen: un 307 lo sigue fetch solo y termina
    // devolviendo el HTML de /login con status 200, así que el que hace polling
    // cree que le contestaron bien y explota al parsear. Un 401 se entiende.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
