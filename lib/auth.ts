import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Cuenta } from '@prisma/client';
import { decrypt } from './jwt';
import { prisma } from './prisma';
import { puede, MOTIVO, type Permiso, type Rol } from './permisos';

// Autorización. Todo lo que ESCRIBE pasa por acá.
//
// Por qué existe este archivo y no alcanzaba con getCuentaActiva(): esa función
// devuelve la marca pero no sabe QUIÉN está pidiendo. Como era el único guard
// obligatorio de las actions, la app terminó sin permisos reales — cualquiera
// con sesión podía mandarle una campaña a los 16.825 contactos de BDI.
//
// ⚠️ El rol se lee SIEMPRE de la base, nunca del JWT. El token dura 7 días: si
// se leyera de ahí, bajarle el rol a alguien no tendría efecto por una semana.

export interface Ctx {
  userId: string;
  email: string;
  nombre: string | null;
  rol: Rol;
  interno: boolean;
  /** La marca activa, ya validada contra la sesión. */
  cuenta: Cuenta;
}

export class PermisoError extends Error {
  constructor(public readonly permiso: Permiso) {
    super(MOTIVO[permiso]);
    this.name = 'PermisoError';
  }
}

/**
 * Sesión + usuario fresco de la base + cuenta activa.
 *
 * Memoizada con cache() de React: se resuelve una sola vez por request por más
 * que la llamen el layout, la página y tres actions. El costo es un findUnique
 * por PK (~1-3 ms) que en las páginas ni siquiera se paga, porque el layout ya
 * hacía esa misma consulta.
 */
export const getAuth = cache(async (): Promise<Ctx> => {
  const token = (await cookies()).get('session')?.value;
  const session = await decrypt(token);
  if (!session?.userId) redirect('/login');

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.userId as string },
    select: { id: true, email: true, nombre: true, rol: true, interno: true, activo: true },
  });

  // El usuario se borró (o lo desactivaron) pero su cookie sigue viva. Que el
  // corte pase por acá es lo que hace que desactivar a alguien tenga efecto
  // inmediato en vez de esperar a que venza el token, siete días después.
  //
  // El `?sesion=expirada` es lo que le permite al proxy borrar la cookie: si
  // redirigiéramos a /login pelado, el proxy nos rebotaría a / (la cookie
  // todavía tiene userId) y el usuario quedaría rebotando entre las dos rutas.
  if (!usuario || !usuario.activo) redirect('/login?sesion=expirada');

  const cuenta = session.cuentaId
    ? await prisma.cuenta.findUnique({ where: { id: session.cuentaId as string } })
    : null;
  if (!cuenta) redirect('/login?sesion=expirada');

  return {
    userId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol as Rol,
    interno: usuario.interno,
    cuenta,
  };
});

/**
 * Autoriza o lanza. Para actions que terminan en redirect() y no tienen forma
 * de devolver un error (crearCampania, crearAutomation…). app/(app)/error.tsx
 * las cubre.
 */
export async function autorizar(permiso: Permiso): Promise<Ctx> {
  const ctx = await getAuth();
  if (!puede(ctx.rol, permiso)) throw new PermisoError(permiso);
  return ctx;
}

/**
 * Autoriza devolviendo el error en vez de lanzarlo. Para las actions que ya
 * responden `{ok, error}` y muestran ese mensaje en pantalla.
 *
 * No es una vía de escape: también autoriza. Existe porque en producción Next
 * redacta los mensajes de las excepciones, así que lanzar haría que el editor
 * de campañas mostrara "Algo salió mal" en vez de "Solo un administrador puede
 * enviar a la lista".
 */
export async function chequear(
  permiso: Permiso,
): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const ctx = await getAuth();
  if (!puede(ctx.rol, permiso)) return { ok: false, error: MOTIVO[permiso] };
  return { ok: true, ctx };
}

/**
 * Versión para route handlers: devuelve una Response de error en vez de
 * redirigir.
 *
 * ⚠️ Un redirect() acá sería un 307 que fetch sigue solo hasta el HTML de
 * /login; el polling del editor de campañas terminaría haciendo res.json()
 * sobre una página y explotaría dentro del loop.
 */
export async function autorizarApi(permiso: Permiso): Promise<Ctx | Response> {
  const token = (await cookies()).get('session')?.value;
  const session = await decrypt(token);
  if (!session?.userId) {
    return Response.json({ error: 'no autenticado' }, { status: 401 });
  }

  const ctx = await getAuth();
  if (!puede(ctx.rol, permiso)) {
    return Response.json({ error: MOTIVO[permiso] }, { status: 403 });
  }
  return ctx;
}
