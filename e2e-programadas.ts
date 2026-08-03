// E2E descartable de las campañas programadas, contra prod.
// Crea una campaña de QA a la lista "Ensayo interno" de BDI (las dos casillas de
// Bruno) y la deja programada. El envío lo dispara el cron.
//
//   node --env-file=.env --import tsx e2e-programadas.ts <preparar|gracia|estado|limpiar>

import { prisma } from "./lib/prisma";
import { instanteLocal, horaLocal, diaLocal } from "./lib/fechas";

const LISTA = "cms2aubx9000020ysljafegwg"; // BDI · Ensayo interno (2 contactos)
const NOMBRE = "QA — programación";

async function cuentaBdi() {
  const c = await prisma.cuenta.findFirstOrThrow({ where: { slug: "bdi" }, select: { id: true } });
  return c.id;
}

async function buscar() {
  return prisma.campania.findFirst({ where: { nombre: NOMBRE }, orderBy: { createdAt: "desc" } });
}

/** Deja una campaña PROGRAMADA para dentro de `min` minutos. */
async function preparar(min: number) {
  const cuentaId = await cuentaBdi();
  const ahora = new Date();
  const cuando = new Date(ahora.getTime() + min * 60_000);
  // Se programa con el MISMO helper que usa la action: si `instanteLocal`
  // estuviera mal, este E2E también saldría a la hora equivocada y se vería.
  const hh = String(cuando.getHours()).padStart(2, "0");
  const mm = String(cuando.getMinutes()).padStart(2, "0");
  const instante = instanteLocal(diaLocal(cuando), `${hh}:${mm}`);

  let c = await buscar();
  if (!c) {
    c = await prisma.campania.create({
      data: {
        cuentaId,
        nombre: NOMBRE,
        asunto: "QA: esto salió solo, a la hora que le dijimos",
        preheader: "prueba interna de campañas programadas",
        contenido: {
          bloques: [
            { tipo: "titulo", texto: "Salió sola ✅" },
            { tipo: "texto", texto: "Si estás leyendo esto, el cron levantó una campaña **programada**." },
          ],
        },
        listaId: LISTA,
      },
    });
    console.log(`campaña creada: ${c.id}`);
  }

  await prisma.campania.update({
    where: { id: c.id },
    data: { estado: "PROGRAMADA", programadaAt: instante, procesandoHasta: null },
  });
  console.log(`PROGRAMADA para ${horaLocal(instante)} (${instante.toISOString()})`);
  console.log(`faltan ${Math.round((instante.getTime() - Date.now()) / 1000)} s`);
}

/** La vuelve a poner vencida hace 3 horas, para probar la ventana de gracia. */
async function gracia() {
  const c = await buscar();
  if (!c) throw new Error("no hay campaña de QA: corré `preparar` primero");
  const hace3h = new Date(Date.now() - 3 * 60 * 60 * 1000);
  await prisma.campania.update({
    where: { id: c.id },
    data: { estado: "PROGRAMADA", programadaAt: hace3h, procesandoHasta: null },
  });
  console.log(`PROGRAMADA en el pasado: ${horaLocal(hace3h)} (hace 3 h) — el cron la tiene que CANCELAR`);
}

async function estado() {
  const c = await buscar();
  if (!c) return console.log("no hay campaña de QA");
  const envios = await prisma.envio.groupBy({
    by: ["estado"],
    where: { campaniaId: c.id },
    _count: { _all: true },
  });
  console.log(`${c.nombre} · ${c.estado}`);
  console.log(`  programadaAt   ${c.programadaAt ? horaLocal(c.programadaAt) : "—"}`);
  console.log(`  procesandoHasta ${c.procesandoHasta?.toISOString() ?? "—"}`);
  console.log(`  envíos         ${envios.map((e) => `${e.estado}=${e._count._all}`).join(" · ") || "ninguno"}`);
}

/** Borra la campaña de QA y sus envíos. Solo la de QA, por nombre exacto. */
async function limpiar() {
  const c = await buscar();
  if (!c) return console.log("nada que limpiar");
  const e = await prisma.envio.deleteMany({ where: { campaniaId: c.id } });
  await prisma.campania.delete({ where: { id: c.id } });
  console.log(`borrada la campaña de QA (${e.count} envíos)`);
}

const cmd = process.argv[2];
const acciones: Record<string, () => Promise<void>> = {
  preparar: () => preparar(Number(process.argv[3] ?? 2)),
  gracia,
  estado,
  limpiar,
};
if (!acciones[cmd]) throw new Error(`usá: preparar [min] | gracia | estado | limpiar`);
acciones[cmd]()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
