/**
 * Le crea el run del 3er mail a los carritos que quedaron ENTRE MEDIO: recibieron
 * el 1º y el 2º mientras el 3º estaba pausado, así que nunca les nació el suyo.
 *
 *   node --env-file=.env --import tsx scripts/alcanzar-tercer-mail.ts [--escribir]
 *
 * 🔑 **Por qué hace falta un script y no alcanza con prender la automation.** El
 * poller crea los runs de los TRES mails de una sola vez, cuando ve el carrito por
 * primera vez (`createMany` + `skipDuplicates`: si la fila de `CarritoVisto` ya
 * existía, no crea ninguno). Es lo que hace que prender el 3º no dispare backlog
 * — y también lo que deja afuera para siempre a los que ya pasaron por ahí.
 *
 * 🔴 **Sólo los que siguen SIN COMPRAR.** El filtro es `CarritoVisto.estado =
 * 'ENCOLADO'`, que mantiene al día el barrido de recuperados, y no el `completed_at`
 * de TN: el checkout de alguien que compró **desaparece** de la API, así que
 * preguntarle daría 404 y el `catch` del procesador —que ante la duda MANDA— lo
 * dejaría pasar. Mandarle un 20% de descuento a alguien que ya pagó es el peor
 * resultado posible de esto.
 *
 * 🔴 **Y dedupe por CONTACTO, no por carrito.** Dos carritos abandonados de la
 * misma persona son una sola persona: sin esto recibiría dos «LAST CALL» con dos
 * cupones distintos. Es la misma regla que el `capDias` del poller.
 *
 * 🔑 **La hora es la que les hubiera tocado**: `creadoEnTnAt + 72 h`, no `now()`.
 * Con `now()` salían los 60 juntos; con la hora natural, los viejos salen en la
 * próxima corrida y el resto se escalona solo, exactamente como si el 3º hubiera
 * estado prendido desde el principio.
 */
import { prisma } from "../lib/prisma.ts";
import type { Prisma } from "@prisma/client";

const escribir = process.argv.includes("--escribir");
const BDI = "cmrw7cxd70000fowas0vhhssy";
const ESPERA_H = 72;

async function main() {
  const a3 = await prisma.automation.findFirst({
    where: { cuentaId: BDI, trigger: "CARRITO_ABANDONADO", esperaHoras: ESPERA_H },
  });
  if (!a3) throw new Error("no está el 3er mail");
  if (a3.estado !== "ACTIVO") throw new Error("⛔ el 3er mail está PAUSADO: prenderlo primero");
  if (!a3.asunto) throw new Error("⛔ sin asunto: el procesador lo saltearía");
  console.log(`3er mail: "${a3.asunto}" · ${a3.estado} · cap ${a3.capDias} días\n`);

  // Los candidatos, con el `triggerData` del run del 1º —que es el que trae el
  // checkoutId y los productos que la persona dejó—.
  const cands = await prisma.$queryRaw<
    { checkoutId: string; contactoId: string; email: string; creadoEnTnAt: Date; td: Prisma.JsonValue }[]
  >`
    SELECT DISTINCT ON (v."tnCheckoutId")
           v."tnCheckoutId"::text AS "checkoutId",
           v."contactoId", c.email, v."creadoEnTnAt", r."triggerData" AS td
    FROM "CarritoVisto" v
    JOIN "Contacto" c ON c.id = v."contactoId"
    JOIN "AutomationRun" r ON r."triggerData"->>'checkoutId' = v."tnCheckoutId"::text
    JOIN "Automation" a ON a.id = r."automationId"
    JOIN "Envio" e ON e."automationRunId" = r.id
    WHERE v."cuentaId" = ${BDI}
      AND v.estado = 'ENCOLADO'          -- 🔴 sigue sin comprar
      AND v."contactoId" IS NOT NULL
      AND c.estado = 'ACTIVO' AND c."tnAcceptsMkt" = true
      AND a."cuentaId" = ${BDI} AND a.trigger = 'CARRITO_ABANDONADO' AND a."esperaHoras" = 3
      AND e."enviadoAt" IS NOT NULL       -- el 1º le llegó de verdad
      AND NOT EXISTS (
        SELECT 1 FROM "AutomationRun" x
        WHERE x."automationId" = ${a3.id}
          AND x."triggerData"->>'checkoutId' = v."tnCheckoutId"::text)
    ORDER BY v."tnCheckoutId", r."createdAt"`;

  console.log(`candidatos (carritos): ${cands.length}`);

  // Dedupe por contacto: el más reciente gana, que es el carrito que la persona
  // tiene más fresco en la cabeza.
  const porContacto = new Map<string, (typeof cands)[number]>();
  for (const c of [...cands].sort((a, b) => +b.creadoEnTnAt - +a.creadoEnTnAt)) {
    if (!porContacto.has(c.contactoId)) porContacto.set(c.contactoId, c);
  }
  const dedup = [...porContacto.values()];
  console.log(`después de dedupe por contacto: ${dedup.length}  (−${cands.length - dedup.length})\n`);

  const ahora = Date.now();
  const conHora = dedup.map((c) => ({
    ...c,
    proximoAt: new Date(+c.creadoEnTnAt + ESPERA_H * 3600_000),
  }));
  const yaVencidos = conHora.filter((c) => +c.proximoAt <= ahora);
  console.log(`saldrían en la PRÓXIMA corrida: ${yaVencidos.length}`);
  const porDia = new Map<string, number>();
  for (const c of conHora.filter((x) => +x.proximoAt > ahora)) {
    const d = c.proximoAt.toISOString().slice(0, 10);
    porDia.set(d, (porDia.get(d) ?? 0) + 1);
  }
  for (const [d, n] of [...porDia].sort()) console.log(`  después, el ${d}: ${n}`);

  if (!escribir) {
    console.log("\n🔎 DRY-RUN. Corrélo con --escribir.");
    return;
  }

  let creados = 0;
  for (const c of conHora) {
    // Se re-chequea el cap ACÁ y no sólo arriba: entre el SELECT y esta línea el
    // cron pudo haber creado el run de un carrito nuevo de la misma persona.
    const reciente = await prisma.automationRun.findFirst({
      where: {
        automationId: a3.id,
        contactoId: c.contactoId,
        createdAt: { gte: new Date(ahora - a3.capDias * 86400_000) },
      },
      select: { id: true },
    });
    if (reciente) continue;
    await prisma.automationRun.create({
      data: {
        automationId: a3.id,
        contactoId: c.contactoId,
        proximoAt: c.proximoAt,
        triggerData: c.td as Prisma.InputJsonObject,
      },
    });
    creados++;
  }
  console.log(`\n✅ ${creados} runs creados`);
}

main().finally(() => prisma.$disconnect());
