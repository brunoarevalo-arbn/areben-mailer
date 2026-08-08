/**
 * Renderiza el mail de carrito abandonado **con un carrito real** de la tienda,
 * y lo escribe a un HTML para abrirlo en un navegador. No manda nada.
 *
 * Por qué existe: `probar-carrito.ts` fija invariantes del bloque con datos
 * inventados, y eso no dice si el mail que va a recibir una persona se ve bien.
 * Los productos reales tienen nombres largos, variantes, fotos de proporciones
 * raras y precios con promo. Y "un cambio en el mail se verifica abriendo un
 * navegador" es la regla que ya se aprendió a los golpes con el preview.
 *
 *   node --env-file=.env --import tsx scripts/ensayo-carrito.ts
 *   node --env-file=.env --import tsx scripts/ensayo-carrito.ts --marca=zattia
 *
 * ⚠️ Réplica del camino de `app/api/automations/procesar/route.ts` (líneas
 * ~95-170). Si el procesador cambia cómo arma el mail, esto queda mintiendo:
 * cualquier cambio ahí se refleja acá.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma.ts";
import { leerContenido } from "../lib/email/esquema.ts";
import { renderEmailHtml, renderEmailTexto, aplicarMergeTags } from "../lib/email/render.ts";
import { marcaDe, hostDeEnvio } from "../lib/marca.ts";
import { listarAbandonados } from "../lib/tn/checkouts.ts";
import type { Bloque } from "../lib/email/bloques.ts";

const soloMarca = process.argv.find((a) => a.startsWith("--marca="))?.split("=")[1];
const SALIDA = "/tmp/claude-501/-Users-brunoarevalo/e8ba61b2-436c-46ee-b7f9-fc43833f8d90/scratchpad";

async function main() {
  const appUrl = process.env.APP_URL ?? "https://areben-mailer.vercel.app";

  const cuentas = await prisma.cuenta.findMany({
    where: {
      tnStoreId: { not: null },
      tnToken: { not: null },
      ...(soloMarca ? { slug: soloMarca } : {}),
      automations: { some: { trigger: "CARRITO_ABANDONADO" } },
    },
  });

  for (const cuenta of cuentas) {
    const automation = await prisma.automation.findFirst({
      where: { cuentaId: cuenta.id, trigger: "CARRITO_ABANDONADO" },
    });
    if (!automation?.asunto) {
      console.log(`${cuenta.slug}: sin automation con asunto, salteo`);
      continue;
    }

    const { checkouts } = await listarAbandonados(cuenta.tnStoreId!, cuenta.tnToken!);
    // El más grande: es donde se rompe el diseño si se va a romper.
    const c = [...checkouts].sort((a, b) => b.productos.length - a.productos.length)[0];
    if (!c) { console.log(`${cuenta.slug}: sin carritos para ensayar`); continue; }

    const contenido = leerContenido(automation.contenido);
    let bloques: Bloque[] = [...(contenido?.bloques ?? [])];

    // Igual que el procesador: si hay bloque `carrito`, se rellena ahí.
    if (bloques.some((b) => b.tipo === "carrito")) {
      bloques = bloques.map((b) =>
        b.tipo === "carrito" ? { ...b, items: c.productos, restantes: c.restantes } : b,
      );
    } else {
      bloques.push({ tipo: "carrito", items: c.productos, restantes: c.restantes } as Bloque);
    }

    const host = hostDeEnvio(cuenta, appUrl);
    const opts = {
      preheader: automation.preheader ?? undefined,
      unsubscribeUrl: `${host}/baja?c=ENSAYO`,
      ...marcaDe(cuenta, appUrl),
    };

    let html = renderEmailHtml({ ...contenido, bloques }, opts);
    html = aplicarMergeTags(html, { nombre: c.nombre, email: c.email ?? "" });
    html = html.replaceAll("${cart.url}", c.abandonedUrl || "#");

    let texto = aplicarMergeTags(
      renderEmailTexto({ ...contenido, bloques }, opts),
      { nombre: c.nombre, email: c.email ?? "" },
    );
    texto = texto.replaceAll("${cart.url}", c.abandonedUrl || "#");

    const archivo = `${SALIDA}/carrito-${cuenta.slug}.html`;
    writeFileSync(archivo, html);

    console.log(`\n${"═".repeat(60)}\n${cuenta.slug} — "${automation.asunto}"\n${"═".repeat(60)}`);
    console.log(`  carrito de ${c.nombre ?? "(sin nombre)"} · ${c.productos.length} productos` +
      `${c.restantes ? ` (+${c.restantes} más)` : ""} · $${c.total?.toLocaleString("es-AR")}`);
    console.log(`  productos: ${c.productos.map((p) => p.nombre).join(" · ")}`);

    // Las tres cosas que, si fallan, se ven recién en la casilla de otra persona.
    const chequeos: [boolean, string][] = [
      [!html.includes("${cart.url}"), "no quedó ningún `${cart.url}` sin reemplazar"],
      [!html.includes("${contacto."), "no quedó ningún merge tag sin reemplazar"],
      [html.includes(c.abandonedUrl.slice(0, 40)), "el link del carrito real está en el HTML"],
      [c.productos.every((p) => html.includes(p.nombre.slice(0, 15))), "todos los productos salen"],
      [html.length < 100_000, `pesa ${(html.length / 1024).toFixed(0)} KB (Gmail recorta a ~102)`],
      [!texto.includes("${"), "la parte text/plain tampoco tiene tags sueltos"],
    ];
    for (const [ok, msg] of chequeos) console.log(`  ${ok ? "✅" : "🔴"} ${msg}`);

    console.log(`  → ${archivo}`);
  }
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
