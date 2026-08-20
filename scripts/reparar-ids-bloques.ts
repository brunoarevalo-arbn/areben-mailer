// Persiste los `id` de los bloques en los documentos que quedaron sin ellos.
//
//   node --import tsx --env-file=.env scripts/reparar-ids-bloques.ts            # dry-run
//   node --import tsx --env-file=.env scripts/reparar-ids-bloques.ts --aplicar
//
// POR QUÉ. El editor identifica cada bloque por su `id` (`marcarBloques` lo emite
// como `data-b` y el click sobre el preview resuelve con eso cuál formulario
// abrir). Un bloque sin id **se dibuja perfecto y es intocable**. Se descubrió el
// 20-ago-2026 y no era de un solo documento: 8 en total, la mayoría escritos por
// scripts (`crear-automations-marca.ts`, las campañas de ensayo de julio).
//
// ⚠️ Desde el mismo día esto **ya no rompe nada**: `esActual` devuelve false ante
// un bloque sin id, el documento cae al camino lento y `sanearBloque` se lo pone
// al leerlo. Este script no arregla un defecto vivo — evita que el saneo tenga
// que correr en cada render y deja los ids ESTABLES entre cargas.
//
// 🔴 **La guarda que hace esto seguro: sólo escribe si el HTML no se mueve.** El
// saneo hace más cosas que poner ids (acomoda el encabezado, tira `items` de un
// bloque dinámico), y en un documento raro eso podría cambiar el mail. Se
// renderiza antes y después y se compara byte a byte; el que difiere se salta y
// se nombra, para mirarlo a mano.
import { prisma } from "../lib/prisma.ts";
import { leerContenido } from "../lib/email/esquema.ts";
import { renderEmailHtml } from "../lib/email/render.ts";
import { marcaDe } from "../lib/marca.ts";

const APLICAR = process.argv.includes("--aplicar");
const APP = process.env.APP_URL ?? "https://areben-mailer.vercel.app";

const sinId = (c: unknown): number => {
  const bs = (c as { bloques?: { id?: string }[] } | null)?.bloques;
  return Array.isArray(bs) ? bs.filter((b) => typeof b?.id !== "string" || !b.id).length : 0;
};

type Fila = { id: string; nombre: string; contenido: unknown; docVersion: number; cuenta: { slug: string; config: unknown; nombre: string } };

async function reparar(tabla: "automation" | "campania" | "plantilla", filas: Fila[]) {
  let tocados = 0, saltados = 0;
  for (const f of filas) {
    const faltan = sinId(f.contenido);
    if (!faltan) continue;
    const sano = leerContenido(f.contenido);
    const opts = { unsubscribeUrl: `${APP}/baja?token=x`, ...marcaDe(f.cuenta as never, APP) };
    const antes = renderEmailHtml(JSON.parse(JSON.stringify(f.contenido)) as never, opts);
    const despues = renderEmailHtml(sano as never, opts);
    if (antes !== despues) {
      saltados++;
      console.log(`   ⚠️  ${tabla} ${f.cuenta.slug}/"${f.nombre}" — EL HTML CAMBIA (${antes.length} → ${despues.length}): NO se toca, mirar a mano`);
      continue;
    }
    console.log(`   ${APLICAR ? "✔" : "·"} ${tabla} ${f.cuenta.slug}/"${f.nombre}" — ${faltan} bloques sin id${APLICAR ? " → escritos" : ""}`);
    if (APLICAR) {
      // El mismo `updateMany` condicional del editor: si alguien lo guardó
      // mientras corría esto, no se pisa. Ver `lib/documentos.ts`.
      const r = await (prisma[tabla] as { updateMany: (a: unknown) => Promise<{ count: number }> }).updateMany({
        where: { id: f.id, docVersion: f.docVersion },
        data: { contenido: sano as object, docVersion: { increment: 1 } },
      });
      if (r.count === 0) console.log(`     🔴 no se escribió: alguien lo guardó en el medio`);
      else tocados++;
    }
  }
  return { tocados, saltados };
}

async function main() {
  const sel = { id: true, nombre: true, contenido: true, docVersion: true, cuenta: { select: { slug: true, config: true, nombre: true } } };
  const total = { tocados: 0, saltados: 0 };
  for (const t of ["automation", "campania", "plantilla"] as const) {
    const filas = (await (prisma[t] as { findMany: (a: unknown) => Promise<Fila[]> }).findMany({ select: sel })) as Fila[];
    console.log(`\n── ${t} (${filas.length})`);
    const r = await reparar(t, filas);
    total.tocados += r.tocados;
    total.saltados += r.saltados;
  }
  console.log(`\n${APLICAR ? `✅ ${total.tocados} documentos escritos` : "· dry-run: no se escribió nada (--aplicar para hacerlo)"}${total.saltados ? ` · ⚠️ ${total.saltados} saltados por cambio de HTML` : ""}\n`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); }).finally(() => prisma.$disconnect());
