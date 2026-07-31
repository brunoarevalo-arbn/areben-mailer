"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { autorizar, chequear } from "@/lib/auth";
import { getIdentityStatus } from "@/lib/email/proveedores/ses";
import { leerStore } from "@/lib/tn/client";
import { configConTienda, leerConfigCuenta, marcaDe, normalizarDominioEnvio } from "@/lib/marca";
import type { Tema } from "@/lib/email/tema";

export async function crearRemitente(input: {
  nombre: string;
  email: string;
  responderA: string;
}) {
  const auth = await chequear("remitentes");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  const email = input.email.trim().toLowerCase();
  const nombre = input.nombre.trim();
  if (!email.includes("@")) return { ok: false, error: "Email inválido" };
  if (!nombre) return { ok: false, error: "Falta el nombre" };

  const dominio = email.split("@")[1];
  const yaHay = await prisma.remitente.count({ where: { cuentaId: cuenta.id } });

  try {
    await prisma.remitente.create({
      data: {
        cuentaId: cuenta.id,
        nombre,
        email,
        responderA: input.responderA.trim() || null,
        dominio,
        esPrincipal: yaHay === 0, // el primero queda principal
      },
    });
  } catch {
    return { ok: false, error: "Ese email ya existe como remitente" };
  }
  revalidatePath("/remitentes");
  return { ok: true };
}

export async function eliminarRemitente(id: string): Promise<void> {
  const { cuenta } = await autorizar("remitentes");
  await prisma.remitente.deleteMany({ where: { id, cuentaId: cuenta.id } });
  revalidatePath("/remitentes");
}

export async function hacerPrincipal(id: string) {
  const auth = await chequear("remitentes");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  const rem = await prisma.remitente.findFirst({
    where: { id, cuentaId: cuenta.id },
    select: { id: true },
  });
  if (!rem) return { ok: false };
  await prisma.$transaction([
    prisma.remitente.updateMany({
      where: { cuentaId: cuenta.id },
      data: { esPrincipal: false },
    }),
    prisma.remitente.update({ where: { id }, data: { esPrincipal: true } }),
  ]);
  revalidatePath("/remitentes");
  return { ok: true };
}

/** Consulta SES el estado de verificación del dominio del remitente. */
export async function verificarRemitente(id: string) {
  const auth = await chequear("remitentes");
  if (!auth.ok) return { ok: false, error: auth.error };
  const cuenta = auth.ctx.cuenta;

  const rem = await prisma.remitente.findFirst({
    where: { id, cuentaId: cuenta.id },
    select: { id: true, dominio: true },
  });
  if (!rem) return { ok: false, error: "No encontrado" };

  const estado = await getIdentityStatus(rem.dominio);
  await prisma.remitente.update({ where: { id }, data: { estado } });
  revalidatePath("/remitentes");
  return { ok: true, estado };
}

/**
 * Trae de Tiendanube el logo, el sitio, el idioma y el domicilio de la tienda.
 *
 * Las cuentas conectadas antes de esto tienen el `config` vacío: el callback del
 * OAuth ya guarda la marca, pero solo corre cuando alguien instala o reinstala
 * la app. Este botón es el camino para las que ya están adentro — y para volver
 * a traerla cuando el comerciante cambia el logo en su tienda.
 *
 * Va con `integrar` (no con `remitentes`): lo que hace es leer Tiendanube.
 */
export async function traerMarcaDeTienda() {
  const chk = await chequear("integrar");
  if (!chk.ok) return chk;
  const { cuenta } = chk.ctx;

  if (!cuenta.tnStoreId || !cuenta.tnToken) {
    return { ok: false as const, error: "Esta marca todavía no está conectada a Tiendanube." };
  }

  const tienda = await leerStore(cuenta.tnStoreId, cuenta.tnToken);
  if (!tienda) return { ok: false as const, error: "Tiendanube no contestó. Probá de nuevo en un rato." };

  const config = configConTienda(cuenta.config, tienda, new Date().toISOString());
  await prisma.cuenta.update({
    where: { id: cuenta.id },
    data: { config: config as Prisma.JsonObject },
  });
  revalidatePath("/remitentes");
  // Se devuelve lo que quedó para poder mostrarlo sin recargar: un "listo"
  // pelado no deja ver si la tienda tenía logo cargado o no.
  return { ok: true as const, marca: marcaDe({ nombre: cuenta.nombre, config }) };
}

/**
 * Aspecto por defecto de los mails de la marca.
 *
 * Se guarda dentro de `Cuenta.config`, que ya es Json y ya se lee así para
 * `config.url`. Sin columna nueva a propósito: la base se comparte con popups y
 * `prisma db push` está prohibido.
 *
 * ⚠️ Se hace merge sobre el config existente. Un `update` con `{ tema }` pelado
 * borraría `config.url`, y con eso los presets de las automations se quedarían
 * sin el link a la tienda.
 */
export async function guardarTemaMarca(tema: Tema | null) {
  const chk = await chequear("remitentes");
  if (!chk.ok) return chk;
  const { cuenta } = chk.ctx;

  const config = (cuenta.config as Prisma.JsonObject) ?? {};
  const nuevo: Prisma.JsonObject = { ...config };
  if (tema && Object.values(tema).some((v) => v !== undefined && v !== "")) {
    nuevo.tema = tema as Prisma.JsonObject;
  } else {
    delete nuevo.tema;
  }

  await prisma.cuenta.update({ where: { id: cuenta.id }, data: { config: nuevo } });
  revalidatePath("/remitentes");
  return { ok: true as const };
}

/**
 * Prende o apaga el bloque `html` (HTML crudo) para esta cuenta.
 *
 * Es el freno del lado del envío, no de la UI: `renderBloque` no dibuja un
 * bloque `html` si la cuenta no tiene esto prendido, sin importar quién lo
 * haya guardado en el Json. `remitentes` ya es ADMIN-only en la matriz de
 * permisos, así que no hace falta un chequeo aparte acá.
 */
export async function guardarHtmlCrudoHabilitado(habilitado: boolean) {
  const chk = await chequear("remitentes");
  if (!chk.ok) return chk;
  const { cuenta } = chk.ctx;

  const config = (cuenta.config as Prisma.JsonObject) ?? {};
  const nuevo: Prisma.JsonObject = { ...config };
  if (habilitado) nuevo.htmlCrudoHabilitado = true;
  else delete nuevo.htmlCrudoHabilitado;

  await prisma.cuenta.update({ where: { id: cuenta.id }, data: { config: nuevo } });
  revalidatePath("/remitentes");
  return { ok: true as const };
}

/**
 * Muestra o esconde el domicilio postal en el pie de los mails de esta cuenta.
 *
 * ⚠️ El domicilio del remitente es requisito de CAN-SPAM para lo que entra a
 * Estados Unidos y una de las señales que miran los filtros: apagarlo es una
 * decisión del comerciante, no un default nuestro. Por eso la clave que se
 * guarda es `direccionOculta` (ausente = se muestra) y el dato de TN queda en
 * el config intacto para poder volver atrás.
 */
/**
 * Guarda un domicilio propio para el pie, distinto del que trae Tiendanube.
 *
 * Lo que TN devuelve es el domicilio **fiscal** de la empresa, y una tienda
 * puede querer mostrar otra cosa. Se guarda en `direccionPropia` y no pisando
 * `direccion`: así "Traer de mi tienda" —que se corre para actualizar el logo—
 * no se lleva puesto el texto elegido, y **vaciar este campo vuelve solo al de
 * Tiendanube** sin tener que ir a buscarlo.
 */
export async function guardarDireccionPropia(texto: string) {
  const chk = await chequear("remitentes");
  if (!chk.ok) return chk;
  const { cuenta } = chk.ctx;

  const limpio = texto.trim().slice(0, 200);
  const config = (cuenta.config as Prisma.JsonObject) ?? {};
  const nuevo: Prisma.JsonObject = { ...config };
  if (limpio) nuevo.direccionPropia = limpio;
  else delete nuevo.direccionPropia;

  await prisma.cuenta.update({ where: { id: cuenta.id }, data: { config: nuevo } });
  revalidatePath("/remitentes");
  return { ok: true as const, direccion: limpio || leerConfigCuenta(cuenta.config).direccion || "" };
}

/**
 * Guarda el dominio propio del que cuelgan los links de los mails de esta marca.
 *
 * Vaciarlo vuelve a `APP_URL`, que es como se portó siempre — por eso no hay
 * "apagar": el campo vacío ES el estado anterior.
 *
 * 🔴 **Se verifica contra el dominio antes de guardarlo, y no es opcional.** El
 * alta son dos pasos en dos lugares distintos (CNAME en Cloudflare + dominio en
 * Vercel) y el DNS resuelve desde el primero, así que hay una ventana donde
 * `dig` dice que está y el navegador ve un 404. Un dominio guardado en esa
 * ventana no rompe una imagen: manda TODOS los links del mail muertos —el de
 * baja incluido— a casillas ajenas donde ya no hay corrección posible. El
 * chequeo hace imposible el orden equivocado.
 */
export async function guardarDominioEnvio(valor: string) {
  const chk = await chequear("remitentes");
  if (!chk.ok) return chk;
  const { cuenta } = chk.ctx;

  const config = (cuenta.config as Prisma.JsonObject) ?? {};
  const nuevo: Prisma.JsonObject = { ...config };

  if (!valor.trim()) {
    delete nuevo.dominioEnvio;
    await prisma.cuenta.update({ where: { id: cuenta.id }, data: { config: nuevo } });
    revalidatePath("/remitentes");
    return { ok: true as const, dominio: "", mensaje: "Listo: los links vuelven al dominio de la app." };
  }

  const dominio = normalizarDominioEnvio(valor);
  if (!dominio) {
    return {
      ok: false as const,
      error: "Tiene que ser un dominio solo, con https y sin barras (ej: links.zattia.com.ar).",
    };
  }

  // El que prueba es el prefijo del que van a colgar el pixel y los clicks, no
  // la home: es lo único que responde la pregunta que importa.
  try {
    const res = await fetch(`${dominio}/api/track/ping`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const cuerpo = res.ok ? (await res.text()).trim() : "";
    if (cuerpo !== "areben-mailer") {
      return {
        ok: false as const,
        error:
          res.status === 404
            ? `${dominio} resuelve pero todavía no está dado de alta en Vercel para este proyecto.`
            : `${dominio} contestó ${res.status} y no parece ser esta app. Revisá el alta en Vercel.`,
      };
    }
  } catch {
    return {
      ok: false as const,
      error: `No se pudo llegar a ${dominio}. Revisá el CNAME en Cloudflare (nube gris) y el alta en Vercel.`,
    };
  }

  nuevo.dominioEnvio = dominio;
  await prisma.cuenta.update({ where: { id: cuenta.id }, data: { config: nuevo } });
  revalidatePath("/remitentes");
  return { ok: true as const, dominio, mensaje: "Verificado y guardado. Los mails nuevos usan este dominio." };
}

export async function guardarDireccionOculta(oculta: boolean) {
  const chk = await chequear("remitentes");
  if (!chk.ok) return chk;
  const { cuenta } = chk.ctx;

  const config = (cuenta.config as Prisma.JsonObject) ?? {};
  const nuevo: Prisma.JsonObject = { ...config };
  if (oculta) nuevo.direccionOculta = true;
  else delete nuevo.direccionOculta;

  await prisma.cuenta.update({ where: { id: cuenta.id }, data: { config: nuevo } });
  revalidatePath("/remitentes");
  return { ok: true as const };
}
