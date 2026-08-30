/**
 * Los tres retoques del 3er mail de carrito que pidió Bruno el 29-ago-2026, después
 * de mandarse la prueba y mirarla en Gmail.
 *
 *   node --env-file=.env --import tsx scripts/afinar-carrito-3.ts [--escribir]
 *
 * 1. **El asunto pasa a «LAST CALL ☎️»**, el mismo que el encabezado del mail. El
 *    anterior («Última llamada para tu carrito 🛒») tenía 33 caracteres —se corta
 *    en el celular— y era el TERCER 🛒 seguido de la secuencia, justo en el mail
 *    que es distinto a los otros dos.
 *
 * 2. **La línea del WhatsApp baja al pie.** Estaba arriba, entre el título y el
 *    cupón, a 14 px y en gris: texto de apoyo ocupando el mejor lugar del mail.
 *    🔑 En el 1º y en el 2º esa misma línea vive DEBAJO del carrito — acá se
 *    había quedado arriba, que es donde estaba el botón antes de que el cupón le
 *    tomara el lugar.
 *
 * 3. **Y el 3º pasa a saludar por el nombre**, que era el único de los tres que no
 *    lo hacía («Franca, tus elegidos…» / «Franca, tu carrito sigue ahí…» / «LAST
 *    CALL»).
 *
 * 🔴 **No se escribe un `wa.me` a mano en ningún lado.** El link vive adentro de un
 * nodo del texto rico que ya existe y se mueve ENTERO: escribirlo de nuevo es
 * volver al bug del 9 (ver [[project_areben_whatsapp_telefono_9]]).
 *
 * 🔴 **Respeta `docVersion`.** El UPDATE es condicional: si alguien tocó el mail en
 * el editor mientras esto corría, no escribe y lo dice. Un guardado que pisa el
 * documento entero es exactamente lo que se arregló el 20-ago.
 */
import { prisma } from "../lib/prisma.ts";
import { leerContenido } from "../lib/email/esquema.ts";
import type { Bloque } from "../lib/email/bloques.ts";

const escribir = process.argv.includes("--escribir");
const ASUNTO = "LAST CALL ☎️";
const ID_LINEA_WA = "97eef036";
const ID_BOTON = "01587e59";

/** El saludo que le faltaba, con el mismo tag que usan el 1º y el 2º. */
const SALUDO: Bloque = {
  id: "car3-saludo",
  tipo: "texto",
  align: "center",
  texto: [
    {
      t: "${contacto.primerNombre}, es la última vez que te escribimos por esto. Tu carrito sigue guardado acá abajo.",
    },
  ],
} as unknown as Bloque;

async function main() {
  const a = await prisma.automation.findFirst({
    where: { trigger: "CARRITO_ABANDONADO", esperaHoras: 72 },
    include: { cuenta: { select: { slug: true } } },
  });
  if (!a || a.cuenta.slug !== "bdi") throw new Error("no encontré el 3er mail de BDI");
  console.log(`3er mail: "${a.nombre}" · ${a.estado} · docVersion ${a.docVersion}`);

  const c = leerContenido(a.contenido);
  const bloques = [...(c.bloques as Bloque[])];

  const iWa = bloques.findIndex((b) => (b as { id?: string }).id === ID_LINEA_WA);
  const iSaludo = bloques.findIndex((b) => (b as { id?: string }).id === "car3-saludo");
  if (iWa === -1) {
    console.log("⚠️ la línea del WhatsApp ya no está donde estaba: no toco nada.");
    return;
  }
  if (iSaludo !== -1) {
    console.log("⚠️ el saludo ya está puesto: esto ya se corrió.");
    return;
  }

  // 1) Sacar la línea del WhatsApp, con su nodo de link INTACTO, y sólo cambiarle
  //    el arranque: «¿Todavía lo querés? Está acá abajo. Si no, » era el gancho del
  //    mail (que ahora lo dice el saludo) pegado al soporte. Abajo del carrito sólo
  //    tiene sentido la mitad de soporte.
  const [linea] = bloques.splice(iWa, 1);
  const nodos = (linea as unknown as { texto: { t: string }[] }).texto;
  const antes = nodos[0].t;
  nodos[0].t = "¿Algo te da duda? ";
  console.log(`\n  línea del WhatsApp:`);
  console.log(`    ANTES:   "${antes}" + [link] + "${nodos[2]?.t ?? ""}"`);
  console.log(`    DESPUÉS: "${nodos[0].t}" + [link] + "${nodos[2]?.t ?? ""}"`);
  console.log(`    el link no se toca: ${(nodos[1] as unknown as { url?: string }).url}`);

  // 2) El saludo entra donde estaba la línea (justo debajo del título).
  bloques.splice(iWa, 0, SALUDO);

  // 3) Y la línea baja: después del botón FINALIZAR COMPRA, no antes — meter texto
  //    de soporte entre el carrito y su botón le saca fuerza al único CTA.
  const iBoton = bloques.findIndex((b) => (b as { id?: string }).id === ID_BOTON);
  if (iBoton === -1) throw new Error("no encontré el botón FINALIZAR COMPRA");
  bloques.splice(iBoton + 1, 0, linea);

  console.log(`\n  ORDEN NUEVO:`);
  bloques.forEach((b, i) => {
    const marca = (b as { id?: string }).id === "car3-saludo" ? "  ← NUEVO"
      : (b as { id?: string }).id === ID_LINEA_WA ? "  ← BAJÓ ACÁ" : "";
    console.log(`    [${String(i).padStart(2)}] ${b.tipo}${marca}`);
  });
  console.log(`\n  asunto: "${a.asunto}"  →  "${ASUNTO}"`);

  if (!escribir) {
    console.log("\n🔎 DRY-RUN. Corrélo con --escribir.");
    return;
  }

  // 🔴 Condicional por `docVersion`: si alguien guardó desde el editor mientras
  // esto miraba, no se escribe nada. Ver `lib/documentos.ts`.
  const r = await prisma.automation.updateMany({
    where: { id: a.id, docVersion: a.docVersion },
    data: {
      asunto: ASUNTO,
      contenido: { ...c, bloques } as never,
      docVersion: a.docVersion + 1,
    },
  });
  if (r.count !== 1) throw new Error("⛔ NO se escribió: alguien tocó el mail mientras tanto");
  console.log(`\n✅ escrito · docVersion ${a.docVersion} → ${a.docVersion + 1}`);
}

main().finally(() => prisma.$disconnect());
