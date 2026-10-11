/**
 * Los CUATRO mails que hoy dependen de un disparador —los tres de carrito
 * abandonado y el pedido de reseña— renderizados **con datos reales de la
 * tienda** y escritos a HTML para abrirlos en un navegador. No manda nada.
 *
 * Por qué existe: los `probar-*` fijan invariantes con datos inventados, y eso
 * no dice si el mail que va a recibir una persona **se lee bien**. Un texto que
 * sale a un cliente se prueba RENDERIZADO, nunca leyendo el código: los
 * productos reales tienen nombres largos, variantes, fotos de proporciones raras
 * y precios con promo, y las cuatro piezas hay que leerlas de corrido, una atrás
 * de otra, porque quien las recibe las lee así.
 *
 *   node --env-file=.env --import tsx scripts/ensayo-secuencia.ts
 *   node --env-file=.env --import tsx scripts/ensayo-secuencia.ts --marca=zattia
 *
 * Reemplaza a `ensayo-carrito.ts`, que renderizaba **uno solo** (`findFirst` por
 * trigger) cuando la secuencia ya son tres, no sabía nada del mail de reseña, y
 * escribía a un directorio temporal de una sesión que ya no existe.
 *
 * ⚠️ Réplica del camino de `app/api/automations/procesar/route.ts`. Si el
 * procesador cambia cómo arma el mail, esto queda mintiendo.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma.ts";
import { leerContenido } from "../lib/email/esquema.ts";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags } from "../lib/email/render.ts";
import { marcaDe, hostDeEnvio } from "../lib/marca.ts";
import { listarAbandonados } from "../lib/tn/checkouts.ts";
import { tnGet } from "../lib/tn/client.ts";
import { productosDeOrden, type ProductoDeTn } from "../lib/tn/ordenes.ts";
import { pideCupon, aplicarCuponDeCarrito, type CuponEmitido } from "../lib/email/cupon-carrito.ts";
import { firmarResena, VIDA_MS } from "../lib/resena-token.ts";
import { RESORTY_URL } from "../lib/carrito-cupon.ts";
import { cadaBloque, mapearBloques, type Bloque, type ProductoEmail } from "../lib/email/bloques.ts";
import { resolverTagsCarrito, nombreDelCarrito } from "../lib/email/tags-carrito.ts";
import { armarSecuencia4, PREFIJO } from "./secuencia-carrito-4.ts";
import { armarSecuenciaB } from "./secuencia-carrito-b.ts";
import { prepararCarrito, resolverCarritoEnTexto, valoresCarrito } from "../lib/email/tags-carrito.ts";
import { montoEnvioGratis } from "../lib/email/tienda.ts";

const soloMarca = process.argv.find((a) => a.startsWith("--marca="))?.split("=")[1] ?? "bdi";
// `--nueva` dibuja la secuencia de 4 mails del 29-sep-2026 (`secuencia-carrito-4.ts`)
// armada en memoria a partir de los tres de hoy: se mira ANTES de escribirla.
// `--b` dibuja «Carrito v2 · B» (`secuencia-carrito-b.ts`, 11-oct-2026) con el
// carrito real más grande Y con el más chico: el más chico es el que cae del
// lado de «te faltan $X para el envío gratis», que es la otra mitad de la frase.
const versionB = process.argv.includes("--b");
const nueva = process.argv.includes("--nueva") || versionB;
const SALIDA = join(process.cwd(), ".mirar", versionB ? "secuencia-b" : nueva ? "secuencia-4" : "secuencia");

/**
 * El cupón de mentira del 3er mail.
 *
 * 🔑 El 3º se renderiza **dos veces**, y no es capricho: `aplicarCuponDeCarrito`
 * **borra el bloque entero** cuando la perilla de Resorty está apagada (hoy lo
 * está), cuando el escalado no mejora lo que la persona ya tiene, o cuando TN
 * falla al acuñarlo. O sea que el mail que más chance tiene de salir es el que
 * NO lleva premio, y ese es el que hay que leer con más cuidado: si algo fuera
 * del bloque nombra el descuento, queda prometiendo algo que no llegó.
 */
const CUPON_DE_ENSAYO: CuponEmitido = {
  codigo: "ENSAYO20",
  valor: 20,
  vence: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  minCompra: 0,
};

/** Los productos de una orden, ya con sus cinco estrellas firmadas. */
async function productosDeResena(
  cuentaId: string,
  storeId: string,
  token: string,
  orden: { id: number; products?: ProductoDeTn[] } | undefined,
) {
  if (!orden) return [];
  const productos = (await productosDeOrden(orden.products ?? [], storeId, token)) as {
    productoId?: string; nombre: string;
  }[];
  return productos.map((p) => {
    if (!p.productoId) return p;
    const t = [1, 2, 3, 4, 5].map((r) =>
      firmarResena({
        cuentaId, orderId: String(orden.id), productoId: p.productoId!, producto: p.nombre,
        email: "ensayo@ejemplo.com", nombre: "Ensayo", rating: r, exp: Date.now() + VIDA_MS,
      }),
    );
    // Todas o ninguna, igual que el procesador: media escala es peor que ninguna.
    return t.every(Boolean) ? { ...p, estrellas: t.map((x) => `${RESORTY_URL}/opinar/${x}`) } : p;
  });
}

async function main() {
  const appUrl = process.env.APP_URL ?? "https://areben-mailer.vercel.app";
  mkdirSync(SALIDA, { recursive: true });

  const cuenta = await prisma.cuenta.findFirst({ where: { slug: soloMarca } });
  if (!cuenta?.tnStoreId || !cuenta.tnToken) throw new Error(`${soloMarca}: sin tienda conectada`);

  // Los tres de carrito por espera creciente (1º → 2º → 3º) y la reseña al final,
  // que es el orden en el que los recibe una persona.
  // `select` explícito: el ensayo es de SOLO LECTURA y así corre también contra
  // una base que todavía no tiene las columnas de un DDL nuevo (y lo que no lee
  // no lo puede romper).
  const enBase = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: { in: ["CARRITO_ABANDONADO", "RESENA"] } },
    orderBy: [{ trigger: "asc" }, { esperaHoras: "asc" }],
    select: { nombre: true, trigger: true, estado: true, esperaHoras: true, asunto: true, preheader: true, contenido: true },
  });
  const viejas = enBase.filter((a) => a.trigger === "CARRITO_ABANDONADO" && !a.nombre.startsWith(PREFIJO));
  const autos = nueva
    ? (versionB ? armarSecuenciaB(viejas) : armarSecuencia4(viejas))
        .map((m) => ({ ...m, trigger: "CARRITO_ABANDONADO" as const, estado: "SIN CREAR" }))
    : enBase;
  if (!autos.length) throw new Error(`${soloMarca}: no hay automations de carrito ni de reseña`);

  // El carrito MÁS GRANDE de la tienda: es donde se rompe el diseño si se va a
  // romper. El mismo para los cuatro, así lo único que cambia entre piezas es la
  // pieza.
  const { checkouts } = await listarAbandonados(cuenta.tnStoreId, cuenta.tnToken);
  const porTamano = [...checkouts].sort((a, b) => b.productos.length - a.productos.length);
  const c0 = porTamano[0];
  if (!c0) throw new Error(`${soloMarca}: sin carritos abandonados para ensayar`);
  // Con `--b`, también el más chico que NO llega al envío gratis.
  const umbral = montoEnvioGratis(marcaDe(cuenta, appUrl).tienda);
  const chico = versionB ? [...checkouts].filter((k) => k.productos.length && (k.subtotal ?? 0) > 0 && umbral !== null && (k.subtotal ?? 0) < umbral).sort((a, b) => (a.subtotal ?? 0) - (b.subtotal ?? 0))[0] : undefined;
  // …y uno que eligió RETIRAR EN EL LOCAL: ahí la frase no habla del envío.
  const retira = versionB ? checkouts.find((k) => k.retiroEnLocal && k.productos.length && k !== c0 && k !== chico) : undefined;
  const carritos = [c0, chico, retira].filter((k): k is NonNullable<typeof k> => !!k);
  const errores: string[] = [];
  for (const c of carritos) {

  // Una orden PAGADA de verdad, para el mail de reseña. La más nueva: es la que
  // un run de `RESENA` habría tomado.
  const { data: ordenes } = await tnGet<{ id: number; products?: ProductoDeTn[] }[]>(
    // ⚠️ `sort_by` va con el nombre LARGO de TN (`created-at-descending`), y
    // `payment_status` es la clave del filtro: con `status:"paid"` y un
    // `sort_by:"-created_at"` la API contesta **404 "Last page is 0"**, no una
    // lista vacía. Es el mismo criterio que usa `lib/tn/import.ts`.
    cuenta.tnStoreId, cuenta.tnToken, "orders",
    { per_page: 5, payment_status: "paid", sort_by: "created-at-descending" },
  );
  const orden = ordenes?.find((o) => o.products?.length);
  if (!orden) console.log("⚠️  sin pedidos pagados: la reseña va a salir sin estrellas");

  const host = hostDeEnvio(cuenta, appUrl);
  const marca = marcaDe(cuenta, appUrl);

  console.log(`\n${soloMarca} · carrito de ${c.nombre ?? "(sin nombre)"} · ${c.productos.length} productos` +
    `${c.restantes ? ` (+${c.restantes} más)` : ""} · subtotal $${c.subtotal?.toLocaleString("es-AR")} (TN total, con envío y cupón: $${c.total?.toLocaleString("es-AR")})`);
  console.log(`productos: ${c.productos.map((p) => p.nombre).join(" · ")}\n`);

  for (const a of autos) {
    const esResena = a.trigger === "RESENA";

    // 🔴 **La reseña sale de un PEDIDO PAGADO, no del carrito abandonado.** La
    // primera versión de este ensayo reusó el checkout para las dos cosas y el
    // mail de reseña salió con **cero estrellas**: un checkout no trae
    // `product_id` y sin id no hay token que firmar. O sea que el único mail
    // cuya razón de existir son las estrellas se renderizaba mudo y en verde.
    // Por eso acá se pide una orden de verdad y se pasa por `productosDeOrden`,
    // la misma función que usa el webhook.
    const productos: ProductoEmail[] = esResena
      ? (await productosDeResena(cuenta.id, cuenta.tnStoreId!, cuenta.tnToken!, orden)) as ProductoEmail[]
      : c.productos;

    const contenido = leerContenido(a.contenido);
    const base: Bloque[] = [...(contenido?.bloques ?? [])];
    // `cadaBloque`/`mapearBloques`: el carrito puede ir adentro de una `banda`.
    const conProductos = cadaBloque(base).some((b) => b.tipo === "carrito")
      ? mapearBloques(base, (b) => (b.tipo === "carrito" ? { ...b, items: productos, restantes: c.restantes } : b))
      : [...base, { tipo: "carrito", items: productos, restantes: c.restantes } as Bloque];

    // El 3º sale dos veces: con premio y sin premio. Los otros, una.
    const variantes: [string, Bloque[]][] = pideCupon(conProductos) && !esResena
      ? [
          ["sin-cupon", aplicarCuponDeCarrito(conProductos, null)],
          ["con-cupon", aplicarCuponDeCarrito(conProductos, CUPON_DE_ENSAYO)],
        ]
      : [["", conProductos]];

    const datos = { productos, restantes: c.restantes, subtotal: c.subtotal, cantidad: c.cantidad, retiroEnLocal: c.retiroEnLocal, tienda: marca.tienda };
    for (const [sufijoBase, bloquesCrudos] of variantes) {
      const sufijo = [c === c0 ? "" : c === chico ? "chico" : "retira", sufijoBase].filter(Boolean).join("--");
      // La misma función que el procesador: la vista `resumen` y los `${cart.…}` calculados.
      const bloques = esResena ? bloquesCrudos : prepararCarrito(bloquesCrudos, datos);
      const opts = { preheader: (esResena ? a.preheader : resolverCarritoEnTexto(a.preheader, datos)) ?? undefined, unsubscribeUrl: `${host}/baja?c=ENSAYO`, ...marca };
      const urlVuelta = esResena ? (marca.urlCuenta || "#") : (c.abandonedUrl || marca.urlCuenta || "#");

      const tags = { nombre: c.nombre ?? "", email: c.email ?? "" };
      let html = aplicarMergeTags(renderEmailHtml({ ...contenido, bloques } as never, opts), tags);
      const carrito = { url: urlVuelta, productos, restantes: c.restantes };
      html = resolverTagsCarrito(html, carrito, "html");
      let texto = aplicarMergeTags(renderEmailTexto({ ...contenido, bloques } as never, opts), tags);
      texto = resolverTagsCarrito(texto, carrito, "texto");

      const nombre = `${a.nombre.replace(/[^\w]+/g, "-").toLowerCase()}${sufijo ? `--${sufijo}` : ""}`;
      const archivo = join(SALIDA, `${nombre}.html`);
      writeFileSync(archivo, html);

      console.log(`${"─".repeat(70)}`);
      console.log(`${a.nombre}${sufijo ? ` · ${sufijo.toUpperCase()}` : ""} · ${a.estado} · espera ${a.esperaHoras}h`);
      console.log(`  asunto: ${a.asunto ? resolverTagsCarrito(a.asunto, carrito, "texto") : "(sin asunto)"}`);
      if ("remitenteNombre" in a && a.remitenteNombre) console.log(`  de:     ${a.remitenteNombre} · responde a ${a.responderA ?? "(la marca)"}`);
      console.log(`  pre:    ${opts.preheader ?? "(sin preheader)"}`);
      if (versionB && !esResena) {
        const v = valoresCarrito(datos);
        console.log(`  datos:  ${v.cantidad} · ${v.total} · ${v.envio} · ${v.cuotas} · ${v.modelos}`);
      }

      // Lo que, si falla, se ve recién en la casilla de otra persona.
      const chequeos: [boolean, string][] = [
        [!html.includes("${cart.") && !texto.includes("${cart."), "no quedó ningún `${cart.…}` sin reemplazar"],
        [!html.includes("${contacto."), "no quedó ningún merge tag de contacto sin reemplazar"],
        [!html.includes("${tienda."), "no quedó ningún dato de tienda sin resolver"],
        [!/href="(#|)"/.test(html.replace(/href="#"/g, "")), "no quedó ningún `href` vacío"],
        // ⚠️ Contra los productos que entraron a ESTE mail, no contra los del
        // carrito: la reseña sale de un pedido distinto y compararla con el
        // carrito daba rojo por una diferencia que no existe.
        // Un mail PERSONAL no dibuja el carrito: nombra lo que se dejó adentro
        // del texto, con `${cart.producto}`.
        [leerContenido(a.contenido).formato === "personal"
          ? (versionB
              // La B nombra cada producto en su línea, en Tipo Título.
              ? productos.every((p) => html.toLowerCase().includes(p.nombre.toLowerCase().slice(0, 15)))
              : html.includes(nombreDelCarrito(productos, c.restantes).slice(0, 15)))
          : cadaBloque(bloques).some((b) => b.tipo === "carrito" && b.vista === "tira") && !cadaBloque(bloques).some((b) => b.tipo === "carrito" && b.vista !== "tira" && b.vista !== "resumen")
            // La tira muestra tres a propósito: el resto va en «y n productos más».
            ? productos.slice(0, 3).every((p) => html.includes(p.nombre.slice(0, 15)))
            : productos.every((p) => html.toLowerCase().includes(p.nombre.toLowerCase().slice(0, 15))),
         `los ${productos.length} productos salen`],
        [html.length < 100_000, `pesa ${(html.length / 1024).toFixed(0)} KB (Gmail recorta a ~102)`],
        [!texto.includes("${"), "la parte text/plain tampoco tiene tags sueltos"],
        [!html.includes("CARRITO10"), "el placeholder `CARRITO10` no sale nunca"],
      ];
      // 🔴 La regla del cupón, que es del MAIL y no una preferencia: el bloque
      // se puede borrar solo, el asunto no. Si algo de afuera nombra el premio,
      // la variante sin cupón promete algo que no llegó.
      if (!esResena) {
        const nombraPremio = /descuento|% ?off|cup[oó]n|promo/i;
        const cuerpoSinCupon = sufijo === "sin-cupon" || variantes.length === 1;
        chequeos.push([
          !cuerpoSinCupon || !nombraPremio.test(`${a.asunto} ${a.preheader ?? ""}`),
          "ni el asunto ni el preheader nombran un descuento",
        ]);
      }
      if (esResena) {
        const estrellas = (html.match(/\/opinar\//g) ?? []).length;
        chequeos.push([estrellas > 0, `las estrellas salen firmadas (${estrellas} links a /opinar)`]);
        chequeos.push([estrellas % 5 === 0, "y van de a CINCO por producto, nunca media escala"]);
      }
      for (const [ok, msg] of chequeos) {
        console.log(`  ${ok ? "✅" : "🔴"} ${msg}`);
        if (!ok) errores.push(`${a.nombre}${sufijo ? `/${sufijo}` : ""}: ${msg}`);
      }
      console.log(`  → ${archivo}`);
    }
  }

  }
  console.log(`\n${errores.length ? `🔴 ${errores.length} para mirar` : "✅ los cuatro pasan lo que un script puede ver"}`);
  console.log(`\nAbrilos:  open ${SALIDA}/*.html\n`);
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
