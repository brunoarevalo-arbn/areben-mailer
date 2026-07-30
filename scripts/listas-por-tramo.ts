// Parte una lista grande en LISTAS POR TRAMO para poder escalonar el envío.
//
//   # 1) dry-run: cómo se reparte y qué listas crearía. No escribe nada.
//   node --env-file=.env --import tsx scripts/listas-por-tramo.ts \
//     --cuenta=bdi --lista="Nuby — suscriptores"
//
//   # 2) igual pero con otra escalera y excluyendo a los que ya van en la otra lista
//   node --env-file=.env --import tsx scripts/listas-por-tramo.ts \
//     --cuenta=bdi --lista="Nuby — suscriptores" \
//     --escalera=200,500,1000,2000 --excluir="Perfit — abrieron 2026"
//
//   # 3) recién ahora crea las listas y mete a la gente
//   node --env-file=.env --import tsx scripts/listas-por-tramo.ts \
//     --cuenta=bdi --lista="Nuby — suscriptores" --aplicar
//
// ⚠️ Escribe en la base de PRODUCCIÓN (el `.env` local apunta ahí). Por eso el
// default es el dry-run, igual que en `traer-marcas.ts` y en el import de Perfit.
//
// ⛔ `--cuenta` es obligatorio y no tiene default: no hay sesión en un script y
// caer a "bdi" por conveniencia es la fuga entre marcas que el AGENTS.md prohíbe.
//
// **Por qué existe:** el motor manda a una lista o segmento COMPLETO. No hay
// "mandale a 500 de estos 5.280", y los segmentos no filtran por dominio ni por
// cantidad. Para estrenar el envío propio sin quemar el dominio hay que fabricar
// las listas — y es la misma pieza que después necesita la cuarentena del SaaS.
//
// Las tres decisiones que no son obvias:
//
//   * **Un tramo = un solo buzón, y el orden lo fija el buzón, no la antigüedad.**
//     El porqué está en `lib/contactos/tramos.ts`. Si un tramo mezclara Gmail con
//     Microsoft, un rebote no diría nada.
//   * **Nadie se re-asigna.** Si un contacto ya está en un tramo de este prefijo,
//     este script no lo vuelve a poner en otro, aunque cambie la escalera. Es lo
//     que hace que correrlo de nuevo (porque la lista creció, o porque el import
//     trajo más gente) sea seguro: solo agrega tramos nuevos al final, y nunca
//     manda dos veces lo mismo.
//   * **Las listas se crean MANUAL**, no SISTEMA, para que se puedan borrar desde
//     /listas cuando el ramp termine (`deleteMany` filtra por `tipo: "MANUAL"`).
import { prisma } from "../lib/prisma";
import { MANDABLE } from "../lib/campanias";
import {
  BUZONES,
  ESCALERA_DEFAULT,
  ORDEN_DEFAULT,
  esNombreDeTramo,
  nombreTramo,
  planTramos,
  resumenPorBuzon,
  type Buzon,
} from "../lib/contactos/tramos";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const args = (n: string) =>
  process.argv.filter((a) => a.startsWith(`--${n}=`)).map((a) => a.slice(n.length + 3));
const num = (n: number) => n.toLocaleString("es-AR");

function salir(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const slug = arg("cuenta");
  const listaArg = arg("lista");
  if (!slug) salir("falta --cuenta=<slug> (bdi | zattia | stunned)");
  if (!listaArg) salir('falta --lista="<nombre o id de la lista origen>"');

  // La escalera: --tamano=N es el atajo de una escalera de un solo peldaño.
  const tamano = arg("tamano");
  const escalera = arg("escalera")
    ? arg("escalera")!.split(",").map((s) => Number(s.trim()))
    : tamano
      ? [Number(tamano)]
      : ESCALERA_DEFAULT;
  if (escalera.some((n) => !Number.isInteger(n) || n <= 0)) salir("la escalera tiene que ser enteros positivos");

  const orden = (arg("orden")?.split(",").map((s) => s.trim()) ?? ORDEN_DEFAULT) as Buzon[];
  const desconocido = orden.find((b) => !BUZONES.includes(b));
  if (desconocido) salir(`buzón desconocido en --orden: "${desconocido}" (hay: ${BUZONES.join(", ")})`);

  const cuenta = await prisma.cuenta.findFirst({ where: { slug }, select: { id: true, nombre: true } });
  if (!cuenta) salir(`no existe la cuenta "${slug}"`);

  const lista = await prisma.lista.findFirst({
    where: { cuentaId: cuenta.id, OR: [{ id: listaArg }, { nombre: listaArg }] },
    select: { id: true, nombre: true },
  });
  if (!lista) salir(`la cuenta "${slug}" no tiene una lista "${listaArg}"`);

  const prefijo = arg("prefijo") ?? lista.nombre;

  // ── Quiénes son mandables ───────────────────────────────────────────────
  // El mismo criterio que usa la audiencia de una campaña (`MANDABLE`), o el
  // tramo prometería gente que el motor después descarta.
  const enLista = { listas: { some: { listaId: lista.id } } };
  const total = await prisma.contacto.count({ where: { cuentaId: cuenta.id, ...enLista } });
  const mandables = await prisma.contacto.findMany({
    where: { cuentaId: cuenta.id, ...MANDABLE, ...enLista },
    select: { id: true, email: true },
    orderBy: { email: "asc" }, // determinista: dos corridas dan el mismo reparto
  });

  console.log(`\n${cuenta.nombre} · lista "${lista.nombre}"`);
  console.log(`  ${num(total)} contactos · ${num(mandables.length)} mandables (activos y que aceptan marketing)`);
  console.log(`  ${num(total - mandables.length)} quedan afuera: bajas, rebotes, quejas o sin consentimiento\n`);

  // ── Exclusiones pedidas a mano ──────────────────────────────────────────
  // Para no mandarle dos veces a quien está en las dos listas del ramp.
  const excluidos = new Set<string>();
  for (const nombre of args("excluir")) {
    const otra = await prisma.lista.findFirst({
      where: { cuentaId: cuenta.id, OR: [{ id: nombre }, { nombre }] },
      select: { id: true, nombre: true },
    });
    if (!otra) salir(`--excluir="${nombre}": esa lista no existe en ${slug}`);
    const miembros = await prisma.contactoLista.findMany({
      where: { listaId: otra.id },
      select: { contactoId: true },
    });
    miembros.forEach((m) => excluidos.add(m.contactoId));
    console.log(`  excluye "${otra.nombre}" (${num(miembros.length)} miembros)`);
  }

  // ── Tramos que ya existen ───────────────────────────────────────────────
  // Nadie se re-asigna: quien ya está en un tramo de este prefijo no entra en
  // otro, cambie o no la escalera. Correrlo de nuevo solo agrega al final.
  const previas = (
    await prisma.lista.findMany({
      where: { cuentaId: cuenta.id, nombre: { startsWith: `${prefijo} — T` } },
      select: { id: true, nombre: true, _count: { select: { contactos: true } } },
      orderBy: { nombre: "asc" },
    })
  ).filter((l) => esNombreDeTramo(prefijo, l.nombre));

  if (previas.length) {
    console.log(`\n  Ya hay ${previas.length} tramo(s) hecho(s):`);
    for (const p of previas) console.log(`    ${p.nombre} · ${num(p._count.contactos)}`);
    const yaEnTramos = await prisma.contactoLista.findMany({
      where: { listaId: { in: previas.map((p) => p.id) } },
      select: { contactoId: true },
    });
    yaEnTramos.forEach((m) => excluidos.add(m.contactoId));
  }

  const pendientes = mandables.filter((c) => !excluidos.has(c.id));
  const reparto = resumenPorBuzon(pendientes);
  console.log(`\n  ${num(pendientes.length)} sin asignar, por buzón:`);
  for (const b of BUZONES) {
    const n = reparto[b];
    if (!n) continue;
    const pct = ((n / pendientes.length) * 100).toFixed(1);
    console.log(`    ${b.padEnd(10)} ${num(n).padStart(7)}  ${pct}%`);
  }
  if (!pendientes.length) {
    console.log("\n  No queda nadie por asignar. Nada que hacer.");
    await prisma.$disconnect();
    return;
  }

  // ── El plan ─────────────────────────────────────────────────────────────
  // El primer tramo nuevo sigue la numeración y el peldaño de los que ya están:
  // la escalera calienta la IP, no se vuelve a empezar porque cambió la lista.
  const tramos = planTramos(pendientes, {
    escalera,
    orden,
    desdeTramo: previas.length + 1,
    desdePeldano: previas.length,
  });

  console.log(`\n  Plan · escalera ${escalera.map(num).join(" → ")} · orden ${orden.join(" → ")}`);
  for (const t of tramos) {
    console.log(`    ${nombreTramo(prefijo, t.n, t.buzon).padEnd(46)} ${num(t.contactos.length).padStart(6)}`);
  }
  console.log(`    ${"".padEnd(46)} ${num(tramos.reduce((a, t) => a + t.contactos.length, 0)).padStart(6)} en total`);

  if (!aplicar) {
    console.log("\n  DRY-RUN: no se escribió nada. Para crearlas: agregá --aplicar\n");
    await prisma.$disconnect();
    return;
  }

  // ── Escribir ────────────────────────────────────────────────────────────
  console.log("");
  for (const t of tramos) {
    const nombre = nombreTramo(prefijo, t.n, t.buzon);
    const creada = await prisma.lista.create({
      data: {
        cuentaId: cuenta.id,
        nombre,
        tipo: "MANUAL",
        descripcion: `Tramo ${t.n} del ramp de "${lista.nombre}" · ${t.buzon} · generado por scripts/listas-por-tramo.ts`,
      },
      select: { id: true },
    });
    const CHUNK = 1000;
    for (let i = 0; i < t.contactos.length; i += CHUNK) {
      await prisma.contactoLista.createMany({
        data: t.contactos.slice(i, i + CHUNK).map((c) => ({ contactoId: c.id, listaId: creada.id })),
        skipDuplicates: true,
      });
    }
    console.log(`  ✓ ${nombre} · ${num(t.contactos.length)}`);
  }
  console.log(`\n  Listo: ${tramos.length} lista(s) nueva(s). Se mandan en orden de nombre.\n`);
  await prisma.$disconnect();
}

main();
