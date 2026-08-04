import { autorizarApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leerContenido } from "@/lib/email/esquema";
import { renderEmailHtml, aplicarMergeTags } from "@/lib/email/render";
import { resolverProductosDinamicos } from "@/lib/email/productos-dinamicos";
import { combinarTema, resolverPaleta } from "@/lib/email/tema";
import { marcaDe } from "@/lib/marca";

/**
 * El HTML de un mail ya guardado, para mirarlo sin abrir el editor.
 *
 * `?tipo=campania|automation|plantilla&id=…` → `{ html, ancho }`.
 *
 * Existe porque una lista de 40 campañas **no puede** dibujar los 40 mails en el
 * payload del server component: la galería mide 7-21 KB por mail y por eso
 * renderiza una sola familia por vez. Acá se pide de a uno, cuando alguien abre
 * la vista previa. La galería NO usa esto: ahí el HTML ya viajó con la página.
 *
 * Se arma con el mismo `renderEmailHtml` del envío y con la misma marca, así que
 * lo que se ve es lo que va a salir. Lo único de mentira son los merge tags
 * (contacto de ejemplo) y el carrito de muestra, igual que en la galería.
 */

/**
 * El mismo mail, pero como PÁGINA de verdad, para probar que los links lleven a
 * donde tienen que llevar.
 *
 * Adentro del panel el mail vive en un iframe donde **todo click se frena**: es
 * lo que evita que tocar un botón deje el preview en blanco. Eso está bien para
 * editar y es inútil para lo otro que uno quiere hacer con un mail terminado,
 * que es apretar un producto y ver si existe.
 *
 * Va por POST y con el HTML adentro del body —en vez de un `?id=` que lo lea de
 * la base— porque lo que hay que probar es **lo que está en pantalla**, no lo
 * último guardado: si el botón obligara a guardar antes, probar un link sería
 * escribir en la base.
 *
 * 🔴 **`script-src 'none'` no es opcional.** Esto sirve HTML escrito por un
 * usuario, en el ORIGEN del panel y como documento de primer nivel: sin CSP, el
 * bloque de `html` crudo —que un ADMIN puede prender— correría con la cookie de
 * sesión al lado. La CSP mata todo script y **no toca los links**, que es
 * exactamente lo que hace falta. Es el equivalente del `sandbox` sin
 * `allow-scripts` del iframe, del lado del servidor.
 */
export async function POST(req: Request) {
  const auth = await autorizarApi("ver");
  if (auth instanceof Response) return auth;

  const form = await req.formData();
  const html = form.get("html");
  if (typeof html !== "string" || !html) {
    return Response.json({ error: "falta el html" }, { status: 400 });
  }

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // ⛔ `frame-ancestors 'none'` de yapa: esta página no se enmarca desde
      // ningún lado, así que no puede usarse para disfrazar nada.
      "content-security-policy": "script-src 'none'; object-src 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      // No queda en el historial de nadie ni en un caché intermedio: es una
      // pantalla de trabajo, no una URL para compartir.
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

const TIPOS = ["campania", "automation", "plantilla"] as const;
type Tipo = (typeof TIPOS)[number];

const esTipo = (x: string | null): x is Tipo => !!x && TIPOS.includes(x as Tipo);

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const tipo = sp.get("tipo");
  const id = sp.get("id");

  const auth = await autorizarApi("ver");
  if (auth instanceof Response) return auth;
  const { cuenta } = auth;

  if (!esTipo(tipo) || !id) {
    return Response.json({ error: "falta tipo o id" }, { status: 400 });
  }

  // ⚠️ El `cuentaId` va en el WHERE, nunca en un chequeo después del findUnique:
  // es el agujero multi-tenant de siempre. Un id de otra marca es un 404, no un
  // mail ajeno.
  const donde = { id, cuentaId: cuenta.id };
  // Se normalizan a la misma forma acá y no en el render: una plantilla no tiene
  // preheader (no es un mail, es un diseño), y las otras dos sí.
  const fila =
    tipo === "campania"
      ? await prisma.campania
          .findFirst({ where: donde, select: { nombre: true, contenido: true, preheader: true } })
          .then((c) => c && { nombre: c.nombre, contenido: c.contenido, preheader: c.preheader })
      : tipo === "automation"
        ? await prisma.automation
            .findFirst({ where: donde, select: { nombre: true, contenido: true, preheader: true } })
            .then((a) => a && { nombre: a.nombre, contenido: a.contenido, preheader: a.preheader })
        : await prisma.plantilla
            .findFirst({ where: donde, select: { nombre: true, contenido: true } })
            .then((p) => p && { nombre: p.nombre, contenido: p.contenido, preheader: null });

  if (!fila) return Response.json({ error: "no encontrado" }, { status: 404 });

  const contenido = leerContenido(fila.contenido);
  const marca = marcaDe(cuenta, process.env.APP_URL ?? "");
  const productosDinamicos = await resolverProductosDinamicos(contenido.bloques, cuenta);

  const html = aplicarMergeTags(
    renderEmailHtml(contenido, {
      preheader: fila.preheader ?? undefined,
      unsubscribeUrl: "#",
      // Solo de preview: `probar-carrito.ts` fija que la muestra no sale en un
      // envío real.
      muestraCarrito: true,
      productosDinamicos,
      ...marca,
    }),
    { nombre: "Ana", email: "ana@ejemplo.com" },
  );

  // El ancho del mail decide el marco de "escritorio": el corte responsive del
  // correo es su propio ancho, así que un marco más angosto mostraría la versión
  // de celular con el toggle en escritorio.
  const ancho = resolverPaleta(combinarTema(marca.temaMarca, contenido.tema)).ancho;

  return Response.json({ html, ancho, nombre: fila.nombre });
}
