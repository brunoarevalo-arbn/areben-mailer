/**
 * Suma a «Carrito v2 · B» los carritos que quedaron A MITAD de la secuencia vieja
 * cuando se cambió (11-oct-2026): sus mails pendientes salen SALTADOS al pausar
 * los viejos, y el poller no les crea runs nuevos porque ya vio esos carritos.
 *
 *   node --env-file=.env --import tsx scripts/alcanzar-secuencia-b.ts [--escribir]
 *
 * 🔑 **Sólo los mails de la B que todavía les tocan**, a la hora que les hubiera
 * tocado: `creadoEnTnAt + esperaHoras`. Quien abandonó hace 30 h recibe el 3º y el
 * 4º a su hora, no el 1º y el 2º tarde. Un paso cuya hora ya pasó no se manda,
 * salvo que haya pasado hace menos de `GRACIA_H`: así el carrito de hace 2 h, que
 * no recibió NADA todavía, igual recibe el 1º (ahora mismo).
 *
 * 🔴 **Sólo los que siguen SIN COMPRAR** (`CarritoVisto.estado = 'ENCOLADO'`), y
 * igual el procesador vuelve a preguntarle a TN antes de cada mail.
 * 🔴 **Dedupe por CONTACTO** y respeta el `capDias` de cada automation: dos
 * carritos de la misma persona son una sola persona.
 * ⛔ No toca los runs viejos (ya los saltea el procesador) ni el grupo de control:
 * estos carritos nacieron antes de que existiera.
 */
import { prisma } from "../lib/prisma.ts";
import type { Prisma } from "@prisma/client";

const escribir = process.argv.includes("--escribir");
const slug = process.argv.find((a) => a.startsWith("--cuenta="))?.split("=")[1] ?? "bdi";
const PREFIJO = "Carrito v2";
/** Cuánto atraso se tolera en un paso para mandarlo igual (el 1º de un carrito recién nacido). */
const GRACIA_H = 3;

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta) throw new Error(`no existe la cuenta "${slug}"`);
  const todas = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: "CARRITO_ABANDONADO" },
    orderBy: { esperaHoras: "asc" },
  });
  const nuevas = todas.filter((a) => a.nombre.startsWith(PREFIJO));
  const viejas = todas.filter((a) => !a.nombre.startsWith(PREFIJO));
  if (nuevas.length !== 4 || nuevas.some((a) => a.estado !== "ACTIVO")) throw new Error(`⛔ las 4 «${PREFIJO}» tienen que estar ACTIVAS`);

  // Los carritos con algún mail viejo todavía sin salir (PENDIENTE, o ya SALTADO
  // por la pausa) de los últimos 4 días.
  const desde = new Date(Date.now() - 4 * 86400_000);
  const pendientes = await prisma.automationRun.findMany({
    where: { automationId: { in: viejas.map((a) => a.id) }, estado: { in: ["PENDIENTE", "SALTADO"] }, proximoAt: { gte: desde } },
    select: { contactoId: true, triggerData: true },
  });
  const porCheckout = new Map<string, { contactoId: string; td: Prisma.JsonValue }>();
  for (const r of pendientes) {
    const id = (r.triggerData as { checkoutId?: string })?.checkoutId;
    if (id && !porCheckout.has(id)) porCheckout.set(id, { contactoId: r.contactoId, td: r.triggerData });
  }

  // Cuándo se vio cada carrito, si sigue sin comprar, y si el contacto se puede escribir.
  const vistos = await prisma.carritoVisto.findMany({
    where: { cuentaId: cuenta.id, tnCheckoutId: { in: [...porCheckout.keys()].map((x) => BigInt(x)) } },
    select: { tnCheckoutId: true, estado: true, creadoEnTnAt: true, contacto: { select: { id: true, estado: true, tnAcceptsMkt: true } } },
  });
  const ok = vistos.filter((v) => v.estado === "ENCOLADO" && v.creadoEnTnAt && v.contacto?.estado === "ACTIVO" && v.contacto.tnAcceptsMkt);
  console.log(`carritos a mitad: ${porCheckout.size} · siguen sin comprar y se pueden escribir: ${ok.length}`);

  // Dedupe por contacto: el carrito más reciente gana.
  const porContacto = new Map<string, (typeof ok)[number]>();
  for (const v of [...ok].sort((a, b) => +b.creadoEnTnAt! - +a.creadoEnTnAt!)) if (!porContacto.has(v.contacto!.id)) porContacto.set(v.contacto!.id, v);

  const ahora = Date.now();
  const plan: { automationId: string; nombre: string; contactoId: string; proximoAt: Date; td: Prisma.JsonValue }[] = [];
  for (const v of porContacto.values()) {
    const td = porCheckout.get(String(v.tnCheckoutId))!.td;
    for (const a of nuevas) {
      const hora = +v.creadoEnTnAt! + a.esperaHoras * 3600_000;
      if (hora < ahora - GRACIA_H * 3600_000) continue; // ese paso ya pasó: no se manda tarde
      plan.push({ automationId: a.id, nombre: a.nombre, contactoId: v.contacto!.id, proximoAt: new Date(Math.max(hora, ahora)), td });
    }
  }
  const cuenta1 = new Map<string, number>();
  for (const p of plan) cuenta1.set(p.nombre, (cuenta1.get(p.nombre) ?? 0) + 1);
  for (const a of nuevas) console.log(`  ${a.nombre}: ${cuenta1.get(a.nombre) ?? 0}`);
  console.log(`  personas: ${porContacto.size} · mails en total: ${plan.length}`);

  if (!escribir) { console.log("\n🔎 No se escribió nada: agregá --escribir."); return; }

  let creados = 0;
  for (const p of plan) {
    const a = nuevas.find((x) => x.id === p.automationId)!;
    // El cap se re-chequea acá: el poller pudo crearle un run por un carrito nuevo.
    const reciente = await prisma.automationRun.findFirst({
      where: { automationId: a.id, contactoId: p.contactoId, createdAt: { gte: new Date(ahora - a.capDias * 86400_000) } },
      select: { id: true },
    });
    if (reciente) continue;
    await prisma.automationRun.create({
      data: { automationId: a.id, contactoId: p.contactoId, proximoAt: p.proximoAt, triggerData: p.td as Prisma.InputJsonObject },
    });
    creados++;
  }
  console.log(`\n✅ ${creados} mails programados`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); }).finally(() => prisma.$disconnect());
