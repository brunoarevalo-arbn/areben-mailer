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
import type { Bloque, ProductoEmail } from "../lib/email/bloques.ts";

const soloMarca = process.argv.find((a) => a.startsWith("--marca="))?.split("=")[1] ?? "bdi";
const SALIDA = join(process.cwd(), ".mirar", "secuencia");

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
  const autos = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: { in: ["CARRITO_ABANDONADO", "RESENA"] } },
    orderBy: [{ trigger: "asc" }, { esperaHoras: "asc" }],
  });
  if (!autos.length) throw new Error(`${soloMarca}: no hay automations de carrito ni de reseña`);

  // El carrito MÁS GRANDE de la tienda: es donde se rompe el diseño si se va a
  // romper. El mismo para los cuatro, así lo único que cambia entre piezas es la
  // pieza.
  const { checkouts } = await listarAbandonados(cuenta.tnStoreId, cuenta.tnToken);
  const c = [...checkouts].sort((a, b) => b.productos.length - a.productos.length)[0];
  if (!c) throw new Error(`${soloMarca}: sin carritos abandonados para ensayar`);

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
  const errores: string[] = [];

  console.log(`\n${soloMarca} · carrito de ${c.nombre ?? "(sin nombre)"} · ${c.productos.length} productos` +
    `${c.restantes ? ` (+${c.restantes} más)` : ""} · $${c.total?.toLocaleString("es-AR")}`);
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
    const conProductos = base.some((b) => b.tipo === "carrito")
      ? base.map((b) => (b.tipo === "carrito" ? { ...b, items: productos, restantes: c.restantes } : b))
      : [...base, { tipo: "carrito", items: productos, restantes: c.restantes } as Bloque];

    // El 3º sale dos veces: con premio y sin premio. Los otros, una.
    const variantes: [string, Bloque[]][] = pideCupon(conProductos) && !esResena
      ? [
          ["sin-cupon", aplicarCuponDeCarrito(conProductos, null)],
          ["con-cupon", aplicarCuponDeCarrito(conProductos, CUPON_DE_ENSAYO)],
        ]
      : [["", conProductos]];

    for (const [sufijo, bloques] of variantes) {
      const opts = { preheader: a.preheader ?? undefined, unsubscribeUrl: `${host}/baja?c=ENSAYO`, ...marca };
      const urlVuelta = esResena ? (marca.urlCuenta || "#") : (c.abandonedUrl || marca.urlCuenta || "#");

      const tags = { nombre: c.nombre ?? "", email: c.email ?? "" };
      let html = aplicarMergeTags(renderEmailHtml({ ...contenido, bloques } as never, opts), tags);
      html = html.replaceAll("${cart.url}", urlVuelta);
      let texto = aplicarMergeTags(renderEmailTexto({ ...contenido, bloques } as never, opts), tags);
      texto = texto.replaceAll("${cart.url}", urlVuelta);

      const nombre = `${a.nombre.replace(/[^\w]+/g, "-").toLowerCase()}${sufijo ? `--${sufijo}` : ""}`;
      const archivo = join(SALIDA, `${nombre}.html`);
      writeFileSync(archivo, html);

      console.log(`${"─".repeat(70)}`);
      console.log(`${a.nombre}${sufijo ? ` · ${sufijo.toUpperCase()}` : ""} · ${a.estado} · espera ${a.esperaHoras}h`);
      console.log(`  asunto: ${a.asunto}`);
      console.log(`  pre:    ${a.preheader ?? "(sin preheader)"}`);

      // Lo que, si falla, se ve recién en la casilla de otra persona.
      const chequeos: [boolean, string][] = [
        [!html.includes("${cart.url}"), "no quedó ningún `${cart.url}` sin reemplazar"],
        [!html.includes("${contacto."), "no quedó ningún merge tag de contacto sin reemplazar"],
        [!html.includes("${tienda."), "no quedó ningún dato de tienda sin resolver"],
        [!/href="(#|)"/.test(html.replace(/href="#"/g, "")), "no quedó ningún `href` vacío"],
        // ⚠️ Contra los productos que entraron a ESTE mail, no contra los del
        // carrito: la reseña sale de un pedido distinto y compararla con el
        // carrito daba rojo por una diferencia que no existe.
        [productos.every((p) => html.includes(p.nombre.slice(0, 15))),
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

  console.log(`\n${errores.length ? `🔴 ${errores.length} para mirar` : "✅ los cuatro pasan lo que un script puede ver"}`);
  console.log(`\nAbrilos:  open ${SALIDA}/*.html\n`);
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
