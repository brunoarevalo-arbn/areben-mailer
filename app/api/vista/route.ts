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
