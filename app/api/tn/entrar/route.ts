import { cookies } from 'next/headers';
import { decrypt } from '@/lib/session';
import { authorizeUrl } from '@/lib/tn/client';

// Entrada de la app desde el admin de Tiendanube ("abrir aplicación").
//
// Es la URL que se declara en el panel de Partners. Si el comerciante ya tiene
// sesión, va derecho al panel; si no, lo mandamos a autorizar y el callback lo
// deja adentro (crea su usuario y abre la sesión). Así entra sin contraseña,
// que es lo que permite publicar la app sin depender de SES para el alta.
export async function GET(req: Request) {
  const sesion = await decrypt((await cookies()).get('session')?.value);
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  return Response.redirect(sesion?.userId ? base : authorizeUrl());
}
