/**
 * Tanda 0 del carrito abandonado: MEDIR antes de construir.
 *
 * Responde las preguntas de las que depende todo el proyecto:
 *
 *   1. ¿`GET /checkouts` contesta 200 con el token que tenemos? El scope que
 *      hace falta es `read_orders`. Resorty (app 37985) recibe 403 en este
 *      endpoint —documentado en `areben-popups/lib/tn/ordenes.ts`— y por eso el
 *      motor va en el mailer (app 37222). Si acá sale 403, no se construye nada.
 *   2. ¿Cuántos carritos abandonados hay por día? Es el número que decide si
 *      vale la pena pagarle a Meta por mensaje. Medir, no estimar a ojo.
 *   3. 🔑 ¿Cuántos **aceptan marketing**? El procesador exige `tnAcceptsMkt`
 *      para mandar, así que ese porcentaje es cuánta gente recibe el mail de
 *      verdad — no el volumen de carritos.
 *
 * 🔑 **Mide a través de `lib/tn/checkouts.ts`, la misma lib que usa el poller.**
 * La primera versión tenía su propia lista de `fields` y reportó **0% de
 * consentimiento en las tres tiendas** cuando el valor real es el opuesto: le
 * faltaba pedir el campo, y un campo ausente se lee igual que un `false`. Un
 * script de medición con su propia copia de la consulta no mide lo que después
 * corre en producción.
 *
 * Es de sólo lectura: no escribe una fila ni registra un webhook.
 *
 *   node --env-file=.env --import tsx scripts/medir-checkouts-tn.ts
 *   node --env-file=.env --import tsx scripts/medir-checkouts-tn.ts --marca=bdi
 */
import { prisma } from "../lib/prisma.ts";
import { listarAbandonados, type CheckoutNormalizado } from "../lib/tn/checkouts.ts";
import { diaLocal } from "../lib/fechas.ts";

function pct(n: number, total: number): string {
  return total ? `${((n / total) * 100).toFixed(0)}%` : "—";
}

/** El status HTTP que dejó `tnGet` adentro del mensaje de error. */
function statusDelError(e: unknown): string {
  const m = String(e instanceof Error ? e.message : e).match(/→ (\d{3}):/);
  return m ? m[1] : "sin status";
}

async function main() {
  const soloMarca = process.argv.find((a) => a.startsWith("--marca="))?.split("=")[1];

  const cuentas = await prisma.cuenta.findMany({
    where: { tnStoreId: { not: null }, tnToken: { not: null } },
    select: { slug: true, tnStoreId: true, tnToken: true },
    orderBy: { slug: "asc" },
  });

  const objetivo = soloMarca ? cuentas.filter((c) => c.slug === soloMarca) : cuentas;
  if (objetivo.length === 0) {
    console.log(soloMarca ? `No hay cuenta con slug "${soloMarca}".` : "No hay cuentas con Tiendanube conectada.");
    return;
  }

  for (const c of objetivo) {
    const storeId = c.tnStoreId!;
    const token = c.tnToken!;
    console.log(`\n${"═".repeat(72)}\n${c.slug}  ·  store ${storeId}\n${"═".repeat(72)}`);

    let carritos: CheckoutNormalizado[];
    try {
      const r = await listarAbandonados(storeId, token);
      carritos = r.checkouts;
      console.log(`✅ GET /checkouts → 200 · ${carritos.length} carritos`);
      if (r.truncado) console.log("   ⚠️ Corté por el tope de páginas: hay más.");
    } catch (e) {
      const status = statusDelError(e);
      console.log(`🔴 GET /checkouts → ${status}\n   ${e instanceof Error ? e.message.slice(0, 220) : e}`);
      if (status === "403" || status === "401") {
        console.log("   ⛔ Falta el scope `read_orders`. Hay que re-autorizar la app en esta tienda.");
      }
      if (status === "422") {
        console.log("   ⛔ TN rechazó los `fields`. Ojo con `contact_accepts_marketing`, que exige `customer`.");
      }
      continue;
    }

    if (carritos.length === 0) {
      console.log("   (sin carritos abandonados — nada más que medir)");
      continue;
    }

    const k = carritos[0];
    console.log(
      `   muestra: mail=${!!k.email} tel=${!!k.telefono} aceptaMkt=${k.acceptsMkt} ` +
        `completado=${!!k.completedAt} productos=${k.productos.length}`,
    );

    // ── El cursor ─────────────────────────────────────────────────────────
    // Es lo que va a usar el poller para no releer lo mismo. Si TN lo ignorara,
    // el diseño cambia (habría que cursorear por fecha).
    try {
      const desde = carritos[0].tnCheckoutId;
      const { checkouts } = await listarAbandonados(storeId, token, desde);
      const respeta = checkouts.every((x) => BigInt(x.tnCheckoutId) > BigInt(desde));
      console.log(
        `   since_id=${desde} → ${checkouts.length} resultados · ` +
          `${respeta ? "✅ los respeta todos" : "🔴 devolvió ids <= al cursor"}`,
      );
    } catch (e) {
      console.log(`   🔴 since_id falló: ${statusDelError(e)}`);
    }

    // ── Volumen ───────────────────────────────────────────────────────────
    // 🔑 El listado ya viene filtrado: TN saca del listado a los que compraron.
    // Se cuenta igual, porque el día que deje de ser cierto hay que enterarse.
    const cerrados = carritos.filter((x) => x.completedAt).length;
    const abiertos = carritos.filter((x) => !x.completedAt);
    const total = abiertos.length;

    const conMail = abiertos.filter((x) => x.email).length;
    const conTel = abiertos.filter((x) => x.telefono).length;
    const sinNada = abiertos.filter((x) => !x.email && !x.telefono).length;
    const aceptaMkt = abiertos.filter((x) => x.acceptsMkt).length;
    const mandables = abiertos.filter((x) => x.email && x.acceptsMkt).length;

    const porDia = new Map<string, number>();
    for (const x of abiertos) {
      if (!x.creadoEnTnAt) continue;
      const d = diaLocal(x.creadoEnTnAt);
      porDia.set(d, (porDia.get(d) ?? 0) + 1);
    }
    const dias = [...porDia.keys()].sort();
    const promedio = dias.length ? total / dias.length : 0;

    const montos = abiertos.map((x) => x.total ?? 0).filter((n) => n > 0).sort((a, b) => a - b);
    const mediana = montos.length ? montos[Math.floor(montos.length / 2)] : 0;

    console.log(
      `\n   ── Volumen ──\n` +
        `   ${carritos.length} leídos · ${cerrados} con completed_at · **${total} abandonados**\n` +
        `   ${dias.length} días con actividad (${dias[0] ?? "—"} → ${dias.at(-1) ?? "—"})\n` +
        `   **${promedio.toFixed(1)} carritos abandonados por día**\n` +
        `   con mail: ${conMail} (${pct(conMail, total)}) · con teléfono: ${conTel} (${pct(conTel, total)})` +
        ` · sin ninguno: ${sinNada}\n` +
        `   acepta marketing: ${aceptaMkt} (${pct(aceptaMkt, total)})\n` +
        `   🔑 **MANDABLES (mail + acepta): ${mandables} (${pct(mandables, total)})` +
        ` = ${(mandables / Math.max(dias.length, 1)).toFixed(1)}/día**\n` +
        `   monto mediano: $${mediana.toLocaleString("es-AR")}`,
    );

    const recientes = dias.slice(-14);
    if (recientes.length) {
      console.log("\n   ── Últimos días ──");
      for (const d of recientes) {
        const n = porDia.get(d) ?? 0;
        console.log(`   ${d}  ${"▉".repeat(Math.min(n, 40))} ${n}`);
      }
    }

    if (conTel > 0) {
      const porMes = (conTel / Math.max(dias.length, 1)) * 30;
      console.log(
        `\n   ── Si algún día va WhatsApp ──\n` +
          `   ~${porMes.toFixed(0)} mensajes/mes al ritmo actual, **y sólo a los que hayan dado opt-in**\n` +
          `   (hoy son cero: el teléfono del checkout NO es consentimiento de marketing)`,
      );
    }
  }
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
