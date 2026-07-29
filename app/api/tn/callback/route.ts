import { exchangeCode, leerStore, type DatosTienda } from '@/lib/tn/client';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { createSession, decrypt } from '@/lib/session';
import { configConTienda } from '@/lib/marca';
import type { Prisma } from '@prisma/client';

// TN redirige acá tras la instalación con ?code=... Canjeamos el token y lo guardamos.
//
// ⚠️ La cuenta destino se resuelve por el `user_id` que devuelve Tiendanube (= id de
// la tienda), NUNCA por la cuenta activa del panel. Antes se usaba `getCuentaActiva()`
// y el 25-jul-2026 eso le pisó el tnStoreId y el token a BDI al instalar la app en la
// tienda demo (la cuenta activa cae por defecto en el slug "bdi" cuando no hay sesión).
// Una instalación jamás debe tocar la cuenta de otra tienda.

/**
 * Deja al comerciante adentro: asegura su usuario y abre la sesión.
 *
 * Sin esto, instalar la app dejaba la cuenta creada pero a nadie con quien entrar
 * (no hay registro ni invitación). Si ya hay una sesión válida —Bruno conectando
 * una marca con `?state=`— no se toca.
 */
async function entrarComoComerciante(cuentaId: string, storeId: string, tienda: DatosTienda | null) {
  const sesionActual = await decrypt((await cookies()).get('session')?.value);
  if (sesionActual?.userId) return;

  const email = tienda?.email || `tienda-${storeId}@tiendanube.local`;
  const usuario =
    (await prisma.usuario.findFirst({ where: { cuentaId, email } })) ??
    (await prisma.usuario.create({ data: { cuentaId, email, rol: 'ADMIN', interno: false } }));

  await createSession(usuario.id, cuentaId, usuario.rol);
}

/** Slug libre a partir del nombre; si choca, cae al id de tienda. */
async function slugLibre(nombre: string, storeId: string): Promise<string> {
  const base =
    nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || `tienda-${storeId}`;
  if (!(await prisma.cuenta.findUnique({ where: { slug: base } }))) return base;
  const conId = `${base}-${storeId}`.slice(0, 40);
  if (!(await prisma.cuenta.findUnique({ where: { slug: conId } }))) return conId;
  return `tienda-${storeId}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response('falta code', { status: 400 });

  try {
    const token = await exchangeCode(code);
    const storeId = String(token.user_id);
    const destino = new URL(process.env.APP_URL ?? req.url);

    // Una sola llamada a `/store` para todo el callback: el nombre de la cuenta,
    // el mail del dueño y la marca (logo, sitio, idioma, domicilio). Antes se
    // pedía dos veces y se usaban dos campos.
    const tienda = await leerStore(storeId, token.access_token);
    const ahora = new Date().toISOString();
    /** El config de la cuenta con la marca de TN adentro, sin pisar el resto. */
    const config = (previo: unknown): Prisma.JsonObject | undefined =>
      tienda ? (configConTienda(previo, tienda, ahora) as Prisma.JsonObject) : undefined;

    // 1) La tienda ya está vinculada a una cuenta → refrescamos token y marca.
    const yaVinculada = await prisma.cuenta.findUnique({ where: { tnStoreId: storeId } });
    if (yaVinculada) {
      await prisma.cuenta.update({
        where: { id: yaVinculada.id },
        data: { tnToken: token.access_token, config: config(yaVinculada.config) },
      });
      await entrarComoComerciante(yaVinculada.id, storeId, tienda);
      destino.search = '?tn=conectado';
      return Response.redirect(destino);
    }

    // 2) Vinculación pedida desde el panel (?state=<cuentaId>): solo si esa cuenta
    //    todavía no tiene tienda, para no robarle la suya a nadie.
    const state = url.searchParams.get('state');
    if (state) {
      const cuenta = await prisma.cuenta.findUnique({ where: { id: state } });
      if (cuenta && !cuenta.tnStoreId) {
        await prisma.cuenta.update({
          where: { id: cuenta.id },
          data: { tnStoreId: storeId, tnToken: token.access_token, config: config(cuenta.config) },
        });
        await entrarComoComerciante(cuenta.id, storeId, tienda);
        destino.search = '?tn=conectado';
        return Response.redirect(destino);
      }
    }

    // 3) Instalación de una tienda que no conocíamos → cuenta nueva para ella.
    const nombre = tienda?.nombre || `Tienda ${storeId}`;
    const cuenta = await prisma.cuenta.create({
      data: {
        nombre,
        slug: await slugLibre(nombre, storeId),
        tnStoreId: storeId,
        tnToken: token.access_token,
        config: config({}) ?? {},
      },
    });
    await entrarComoComerciante(cuenta.id, storeId, tienda);
    destino.search = `?tn=conectado&cuenta=${cuenta.slug}`;
    return Response.redirect(destino);
  } catch (e) {
    return new Response(`Error conectando Tiendanube: ${(e as Error).message}`, { status: 500 });
  }
}
