// Trae a una cuenta del mailer el histórico que vivía en Perfit: la base "Nuby"
// (suscriptores del pop-up) y el estado real de los compradores de Tiendanube
// (rebotados, bajas, quejas). Se corre UNA VEZ, a mano.
//
//   # 1) mirar los archivos sin tocar la base: headers + 3 filas de cada uno
//   node --import tsx scripts/importar-nuby-perfit.ts --ver \
//     --suscriptores=~/Downloads/nuby-….csv \
//     --estados=~/Downloads/compradores-de-tienda-nube-….csv \
//     --estados=~/Downloads/recaptacion-…-unsubscribe-….csv
//
//   # 2) dry-run: conteos y muestras contra la base, no escribe
//   node --env-file=.env --import tsx scripts/importar-nuby-perfit.ts --cuenta=bdi \
//     --suscriptores=… --estados=… --estados=…
//
//   # 3) recién ahora escribe
//   node --env-file=.env --import tsx scripts/importar-nuby-perfit.ts --cuenta=bdi … --aplicar
//
// ⚠️ Escribe en la base de PRODUCCIÓN (el `.env` local apunta ahí). Por eso el
// default es el dry-run, igual que en `traer-marcas.ts`.
//
// ⛔ `--cuenta` es obligatorio y no tiene default. No hay sesión en un script, y
// caer a "bdi" por conveniencia es la fuga entre marcas que el AGENTS.md prohíbe.
//
// Lo que hace, y por qué:
//
//   * **La supresión se resuelve entera en memoria antes de escribir**, con la
//     regla de una sola vía: un mail que aparece como baja/rebote/queja en
//     cualquier archivo queda suprimido aunque también esté en la lista de altas,
//     y un contacto que ya está suprimido en la base NO vuelve a ACTIVO por
//     aparecer en un CSV. Eso es lo único que frena a los ~613 rebotados que hoy
//     figuran ACTIVO porque los trajo el sync de Tiendanube: sin esto, el primer
//     envío propio arranca con 3,6% de rebote sobre 16.800 y AWS revisa arriba
//     de 5%.
//   * **El consentimiento sale del archivo de `--suscriptores`, no del campo
//     `tn_accepts_marketing`** (que es el espejo del casillero de TN y viene
//     `false`/vacío para gente que sí se anotó en el pop-up). Los que compraron
//     sin tildar pero están en ese archivo pasan a `true`; los que solo dijeron
//     "no" en el checkout quedan en `false` — decidido el 29-jul-2026.
//   * **No toca `lib/email/supresion.ts`**: esa función hace `updateMany` por
//     email sin filtrar `cuentaId`, o sea que marcaría el mail en las tres
//     marcas. Es un bug real y previo; acá todo va con `cuentaId` en el WHERE.
//
// La mecánica pura (parseo, normalización, precedencia) vive en
// `lib/contactos/importar.ts` y la ejercita `scripts/probar-import.ts`.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { Prisma } from "@prisma/client";
import {
  esSuprimido,
  lotes,
  parsearCsv,
  resolverImport,
  type ArchivoImport,
  type ContactoResuelto,
  type EstadoImport,
} from "../lib/contactos/importar";

const CHUNK = 1000; // el mismo que usa lib/tn/import.ts
const MUESTRA = 10;

// El cliente se importa cuando se necesita, no arriba: `lib/prisma.ts` crea la
// conexión al evaluarse y exige DATABASE_URL, y `--ver` tiene que poder correr
// sin `.env` y sin base — es el paso que se usa para revisar los archivos.
let cliente: Prisma_ | null = null;
const conectar = async () => (await import("../lib/prisma")).prisma;
type Prisma_ = Awaited<ReturnType<typeof conectar>>;

function arg(nombre: string): string | undefined {
  const pref = `--${nombre}=`;
  return process.argv.find((a) => a.startsWith(pref))?.slice(pref.length);
}
function args(nombre: string): string[] {
  const pref = `--${nombre}=`;
  return process.argv.filter((a) => a.startsWith(pref)).map((a) => a.slice(pref.length));
}
const flag = (n: string) => process.argv.includes(`--${n}`);

/** `~/x` no lo expande el shell cuando viene pegado a `--opcion=`. */
const expandir = (p: string) => resolve(p.startsWith("~") ? p.replace("~", homedir()) : p);

const num = (n: number) => n.toLocaleString("es-AR");
const muestra = (xs: string[]) =>
  xs.length === 0 ? "" : `      ${xs.slice(0, MUESTRA).join(", ")}${xs.length > MUESTRA ? `, … (+${num(xs.length - MUESTRA)})` : ""}`;

async function main() {
  const ver = flag("ver");
  const aplicar = flag("aplicar");
  const rutaOptin = arg("suscriptores");
  const rutasEstado = args("estados");
  const nombreListaOptin = arg("lista-suscriptores") ?? "Nuby — suscriptores";
  const nombreListaActivos = arg("lista-activos") ?? "Perfit — abrieron 2026";

  if (!rutaOptin && rutasEstado.length === 0) {
    console.error("Faltan archivos. Al menos --suscriptores= o --estados=.\nVer la cabecera del script.");
    process.exit(1);
  }

  // ── Leer los archivos ──────────────────────────────────────
  const archivos: ArchivoImport[] = [];
  const paraVer: { nombre: string; headers: string[]; filas: Record<string, string>[] }[] = [];

  for (const [ruta, optin] of [
    ...(rutaOptin ? ([[rutaOptin, true]] as const) : []),
    ...rutasEstado.map((r) => [r, false] as const),
  ]) {
    const full = expandir(ruta);
    const { headers, filas } = parsearCsv(readFileSync(full));
    archivos.push({ nombre: full.split("/").pop()!, filas, optin });
    paraVer.push({ nombre: full.split("/").pop()!, headers, filas });
  }

  if (ver) {
    for (const a of paraVer) {
      console.log(`\n━━━ ${a.nombre} · ${num(a.filas.length)} filas ━━━`);
      console.log(`columnas (${a.headers.length}): ${a.headers.join(" · ")}`);
      console.log("\nprimeras 3 filas, ya mapeadas por nombre de columna:");
      for (const f of a.filas.slice(0, 3)) {
        const vistos = Object.entries(f).filter(([, v]) => v !== "");
        console.log(`  ${vistos.map(([k, v]) => `${k}=${v.length > 40 ? v.slice(0, 40) + "…" : v}`).join(" | ")}`);
      }
    }
    console.log("\n(--ver no toca la base. Para el dry-run: agregá --cuenta=<slug>)\n");
    return;
  }

  const slug = arg("cuenta");
  if (!slug) {
    console.error("Falta --cuenta=<slug>. No tiene default a propósito: sin cuenta explícita\nun import puede caer en la marca equivocada.");
    process.exit(1);
  }
  const db = (cliente = await conectar());
  const cuenta = await db.cuenta.findUnique({ where: { slug }, select: { id: true, nombre: true } });
  if (!cuenta) {
    console.error(`No existe la cuenta "${slug}".`);
    process.exit(1);
  }

  // ── Resolver todo en memoria ───────────────────────────────
  const r = resolverImport(archivos);
  console.log(`\nCuenta: ${cuenta.nombre} (${slug})${aplicar ? "" : "  ·  DRY-RUN, no escribe nada"}\n`);
  console.log("Archivos leídos:");
  for (const a of r.porArchivo) {
    const optin = archivos.find((x) => x.nombre === a.nombre)?.optin;
    console.log(`  · ${a.nombre}: ${num(a.filas)} filas, ${num(a.validos)} con mail válido${optin ? "  ← define consentimiento y lista" : ""}`);
  }
  console.log(`\n  ${num(r.contactos.size)} mails únicos · ${num(r.filasDuplicadas)} filas repetidas · ${num(r.invalidos.length)} inválidos · ${num(r.filasSinEmail)} sin mail`);
  if (r.invalidos.length) console.log(`  descartados por inválidos:\n${muestra(r.invalidos)}`);

  // ── Comparar contra la base ────────────────────────────────
  // Una sola consulta: 16.800 filas livianas es más simple y más rápido que un
  // IN con 15.830 parámetros.
  const existentes = await db.contacto.findMany({
    where: { cuentaId: cuenta.id },
    select: { id: true, email: true, estado: true, tnAcceptsMkt: true },
  });
  const enBase = new Map(existentes.map((c) => [c.email.toLowerCase(), c]));

  const crear: ContactoResuelto[] = [];
  const suprimirActivos: { email: string; estado: EstadoImport }[] = []; // ← el número 1
  const yaSuprimidos: string[] = [];
  // El número 2 son DOS casos distintos y hay que mostrarlos separados: mezclados
  // en un total, una decisión que Bruno tomó sobre uno se aplica sin querer al otro.
  const subirPorOptin: string[] = []; // se anotó en el pop-up (los ~98)
  const subirPorDesync: string[] = []; // el archivo dice true y la base false
  const negaronEnTn: string[] = [];
  const noRevividos: string[] = [];

  for (const c of r.contactos.values()) {
    const base = enBase.get(c.email);
    if (!base) {
      crear.push(c);
      continue;
    }
    // Ya está en la base.
    if (esSuprimido(c.estado)) {
      if (base.estado === "ACTIVO") suprimirActivos.push({ email: c.email, estado: c.estado });
      else yaSuprimidos.push(c.email);
    } else if (base.estado !== "ACTIVO") {
      // One-way: viene ACTIVO en el archivo pero está suprimido en la base. No se revive.
      noRevividos.push(c.email);
    }
    if (c.aceptaMkt && !base.tnAcceptsMkt) {
      if (c.enOptin) subirPorOptin.push(c.email);
      else subirPorDesync.push(c.email);
    }
    if (c.negoMktEnTn && !c.aceptaMkt) negaronEnTn.push(c.email);
  }

  // Las listas: solo activos. Un suprimido no es audiencia.
  const aListaOptin = [...r.contactos.values()].filter((c) => c.enOptin && !esSuprimido(c.estado));
  const aListaActivos = [...r.contactos.values()].filter((c) => c.ultimaActividad && !esSuprimido(c.estado));
  const suprimidosTotal = [...r.contactos.values()].filter((c) => esSuprimido(c.estado));

  // ── Informe ────────────────────────────────────────────────
  console.log("\n── Los dos números que deciden ──────────────────────────");
  console.log(`\n  1) Suprimidos que HOY están ACTIVO en la base: ${num(suprimirActivos.length)}`);
  console.log("     Son exactamente los mails que este import te evita quemar.");
  console.log(muestra(suprimirActivos.map((s) => `${s.email} → ${s.estado}`)));
  console.log(`\n  2) Existentes que pasan a aceptar marketing: ${num(subirPorOptin.length + subirPorDesync.length)}`);
  console.log(`\n     a) ${num(subirPorOptin.length)} están en el archivo de suscriptores → se anotaron en el pop-up.`);
  console.log(muestra(subirPorOptin));
  console.log(`\n     b) ${num(subirPorDesync.length)} NO están en ese archivo, pero traen tn_accepts_marketing=true`);
  console.log("        mientras la base dice false: el export de Perfit y el sync de TN quedaron");
  console.log("        desfasados. Se sube igual —el dato viene de Tiendanube— pero va aparte");
  console.log("        porque es otro caso, no el que se decidió el 29-jul.");
  console.log(muestra(subirPorDesync));
  console.log(`\n     Y quedan AFUERA ${num(negaronEnTn.length)} que dijeron "no" en el checkout`);
  console.log("     y no se anotaron en el pop-up. Se dejan en false (decidido el 29-jul-2026).");

  console.log("\n── El resto del movimiento ──────────────────────────────");
  const crearSuprimidos = crear.filter((c) => esSuprimido(c.estado));
  const crearActivos = crear.filter((c) => !esSuprimido(c.estado));
  console.log(`\n  Contactos a crear: ${num(crear.length)}`);
  console.log(`\n    · ${num(crearActivos.length)} activos`);
  console.log(muestra(crearActivos.map((c) => c.email)));
  console.log(`\n    · ${num(crearSuprimidos.length)} suprimidos — se crean igual, para que la baja quede`);
  console.log("      registrada y no entren mañana por otra puerta.");
  console.log(muestra(crearSuprimidos.map((c) => `${c.email} (${c.estado})`)));
  console.log(`\n  Suprimidos en total en los archivos: ${num(suprimidosTotal.length)}`);
  console.log(`    · ${num(suprimirActivos.length)} hoy activos en la base → se bajan`);
  console.log(`    · ${num(yaSuprimidos.length)} ya estaban suprimidos → sin cambio`);
  console.log(`    · ${num(crearSuprimidos.length)} no existían → se crean suprimidos`);
  if (noRevividos.length) {
    console.log(`\n  ⚠️ ${num(noRevividos.length)} vienen ACTIVE en los archivos pero están suprimidos en la base.`);
    console.log("     NO se reviven (regla de una sola vía).");
    console.log(muestra(noRevividos));
  }
  console.log(`\n  Listas:`);
  console.log(`    · "${nombreListaOptin}": ${num(aListaOptin.length)} contactos`);
  console.log(`    · "${nombreListaActivos}": ${num(aListaActivos.length)} contactos ← el primer envío`);
  console.log("      (los que tienen actividad registrada en el export: gente que abrió un mail hace poco)");

  if (!aplicar) {
    console.log("\n  Nada de esto se escribió. Para aplicarlo: agregá --aplicar\n");
    return;
  }

  // ── Escribir ───────────────────────────────────────────────
  console.log("\n── Escribiendo ──────────────────────────────────────────");

  // 1) Crear los que no están. Los datos del export van en el create: para los
  //    existentes NO se pisan (la base ya tiene lo que trajo Tiendanube, que es
  //    mejor fuente) y el `custom` de un existente no se toca — la segmentación
  //    del primer envío sale de la LISTA, no de `custom`.
  let creados = 0;
  for (const tanda of lotes(crear, CHUNK)) {
    const res = await db.contacto.createMany({
      data: tanda.map((c) => ({
        cuentaId: cuenta.id,
        email: c.email,
        nombre: c.nombre,
        apellido: c.apellido,
        estado: c.estado,
        source: c.enOptin ? "nuby" : "perfit",
        tnAcceptsMkt: c.aceptaMkt,
        tnTotalGastado: c.tnTotalGastado ? new Prisma.Decimal(c.tnTotalGastado) : null,
        tnUltimaCompra: c.tnUltimaCompra,
        custom: c.custom as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
    creados += res.count;
  }
  console.log(`  ✓ ${num(creados)} contactos creados`);

  // 2) Bajar los suprimidos que estaban activos. Agrupado por estado para que
  //    sean tres updateMany y no 647 updates.
  for (const estado of ["BAJA", "REBOTADO", "SPAM"] as const) {
    const emails = suprimirActivos.filter((s) => s.estado === estado).map((s) => s.email);
    if (!emails.length) continue;
    let n = 0;
    for (const tanda of lotes(emails, CHUNK)) {
      // ⚠️ `cuentaId` en el WHERE, siempre: el mismo mail puede ser contacto de
      // otra marca y su baja en BDI no lo baja de Zattia.
      const res = await db.contacto.updateMany({
        where: { cuentaId: cuenta.id, email: { in: tanda } },
        data: { estado },
      });
      n += res.count;
    }
    console.log(`  ✓ ${num(n)} → ${estado}`);
  }

  // 3) Subir el consentimiento: los del pop-up y los desfasados. Los que dijeron
  //    "no" en el checkout y no se anotaron en ningún lado NO están en esta lista.
  const subirConsentimiento = [...subirPorOptin, ...subirPorDesync];
  if (subirConsentimiento.length) {
    let n = 0;
    for (const tanda of lotes(subirConsentimiento, CHUNK)) {
      const res = await db.contacto.updateMany({
        where: { cuentaId: cuenta.id, email: { in: tanda } },
        data: { tnAcceptsMkt: true },
      });
      n += res.count;
    }
    console.log(`  ✓ ${num(n)} pasaron a aceptar marketing`);
  }

  // 4) Las listas. Se crean si no existen y se llenan con los ids reales, que
  //    recién ahora se conocen (los creados en el paso 1 no tenían id).
  const idsPorEmail = new Map(
    (
      await db.contacto.findMany({
        where: { cuentaId: cuenta.id },
        select: { id: true, email: true },
      })
    ).map((c) => [c.email.toLowerCase(), c.id]),
  );

  for (const [nombre, contactos] of [
    [nombreListaOptin, aListaOptin],
    [nombreListaActivos, aListaActivos],
  ] as const) {
    if (!contactos.length) continue;
    const lista =
      (await db.lista.findFirst({ where: { cuentaId: cuenta.id, nombre }, select: { id: true } })) ??
      (await db.lista.create({ data: { cuentaId: cuenta.id, nombre, tipo: "MANUAL" }, select: { id: true } }));

    const ids = contactos.map((c) => idsPorEmail.get(c.email)).filter((x): x is string => !!x);
    let n = 0;
    for (const tanda of lotes(ids, CHUNK)) {
      const res = await db.contactoLista.createMany({
        data: tanda.map((contactoId) => ({ contactoId, listaId: lista.id })),
        skipDuplicates: true,
      });
      n += res.count;
    }
    console.log(`  ✓ "${nombre}": ${num(n)} contactos asignados`);
  }

  console.log("\n  Listo. Correrlo de nuevo no duplica nada.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => { if (cliente) await cliente.$disconnect(); });
