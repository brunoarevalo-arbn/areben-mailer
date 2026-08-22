// Paso 3 del plan `datos-de-tienda-en-un-solo-lugar-mailer.md`: los mails que
// hoy tienen el número escrito a mano pasan a tener el tag.
//
// Correr:  node --import tsx --env-file=.env scripts/tienda-a-tags.ts --cuenta=bdi --dry
//          node --import tsx --env-file=.env scripts/tienda-a-tags.ts --cuenta=bdi
//
// 🔑 **La tabla de reemplazos no se escribe a mano: ES la tabla de datos.** Se
// busca el VALOR de la cuenta (`$44.000`) y se pone su tag (`${tienda.envioGratis}`).
// Por construcción, resolver el tag devuelve exactamente el texto que había, así
// que el mail no puede cambiar de contenido — y eso se verifica, no se supone
// (ver el oráculo abajo). Una tabla escrita a mano era una lista de frases que
// había que mantener sincronizada con los datos: el mismo bug, un piso arriba.
//
// 🔴 **El oráculo es el HTML RENDERIZADO, antes y después.** Un documento sólo se
// guarda si `renderEmailHtml(nuevo, datos) === renderEmailHtml(viejo, {})`. Si un
// reemplazo se comió algo, o si el dato cargado no es idéntico al literal que
// estaba escrito, el mail cambia y el documento **no se toca**. Es lo único que
// distingue "puse un tag" de "le cambié el texto a un mail de otra persona".
//
// 🔴 **Un barrido a ciegas por patrón habría roto cosas.** El 22-ago-2026, en la
// base: `$50.000` en las campañas de Zattia son PRECIOS DE PRODUCTO, y el
// "7 días" de la Bienvenida de BDI es el vencimiento del CUPÓN, no el plazo de
// cambio. Por eso se busca el valor exacto de ESA cuenta y nada más.
//
// ⛔ **No toca automations ACTIVAS** (se saltean, nombradas) ni campañas ENVIADAS
//    (`--enviadas` las incluye): una campaña que ya salió es el registro de lo
//    que se mandó, y reescribirla es reescribir el registro. Las de BDI están
//    todas enviadas, así que por defecto este script toca sólo las automations.
// 🔴 **Guarda una copia del JSON antes de escribir.** No hay historial.
// 🔑 Idempotente: un documento que ya tiene el tag no tiene el literal, así que
//    la segunda corrida no encuentra nada que cambiar.
// 🔑 Escribe con `updateMany` condicional por `docVersion`, igual que el editor.
import { writeFileSync } from 'node:fs';
import { prisma } from '../lib/prisma.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import { leerConfigCuenta, marcaDe } from '../lib/marca.ts';
import { CAMPOS_TIENDA, leerTienda, type ClaveTienda, type Tienda } from '../lib/email/tienda.ts';
import { renderEmailHtml, type ContenidoCampania } from '../lib/email/render.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const dry = process.argv.includes('--dry');
const conEnviadas = process.argv.includes('--enviadas');
const COPIA = process.env.COPIA_DIR ?? '/tmp';
const APP = process.env.APP_URL ?? 'https://areben-mailer.vercel.app';

/**
 * Los datos que hoy están escritos a mano adentro de los mails, por cuenta.
 *
 * ⚠️ **Cada valor tiene que ser el literal EXACTO que está en el documento**, no
 * una versión mejorada: "Santa Fe 1671, Rosario" en vez de "Santa Fe 1671" haría
 * que el mail diga otra cosa, y el oráculo lo frena — que es lo que tiene que
 * pasar. Mejorar el texto es una edición, y se hace en el editor.
 *
 * Sólo se usan para RELLENAR lo que la cuenta todavía no tiene cargado: si
 * alguien ya lo escribió en Remitentes, gana lo de la base.
 */
const SEMILLA: Record<string, Tienda> = {
  // BDI, confirmados por Bruno el 22-ago-2026.
  bdi: {
    envioGratis: '$44.000',
    cuotas: '3 cuotas sin interés',
    plazoCambio: '30 días desde que lo recibís',
    plazoDespacho: '24 h hábiles',
    local: 'Santa Fe 1671',
  },
};

/** Las claves de campo que llevan una URL: ahí no se reemplaza nada. */
const CLAVES_URL = new Set(['url', 'botonUrl', 'imagen', 'fondoImagen', 'href', 'src', 'logo']);

const tagDe = (c: ClaveTienda) => '${tienda.' + c + '}';

interface Cambio { clave: ClaveTienda; contexto: string }

/**
 * Cambia cada literal por su tag, recorriendo el Json entero.
 *
 * Genérico a propósito, igual que el resolvedor: el título de un `hero`, el texto
 * de una celda y un trozo de texto rico son todos strings del mismo árbol.
 */
function aTags(v: unknown, datos: Tienda, cambios: Cambio[], clavePadre = ''): unknown {
  if (typeof v === 'string') {
    if (CLAVES_URL.has(clavePadre)) return v;
    let s = v;
    for (const campo of CAMPOS_TIENDA) {
      const valor = datos[campo.clave];
      if (!valor || !s.includes(valor)) continue;
      cambios.push({ clave: campo.clave, contexto: s.length > 90 ? s.slice(0, 90) + '…' : s });
      s = s.split(valor).join(tagDe(campo.clave));
    }
    return s;
  }
  if (Array.isArray(v)) return v.map((x) => aTags(x, datos, cambios, clavePadre));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = aTags(val, datos, cambios, k);
    return out;
  }
  return v;
}

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta) { console.error(`❌ no existe la cuenta "${slug}"`); process.exit(1); }

  // ── Fase A: los datos tienen que estar en la cuenta ANTES de sacarlos de los
  // mails. Al revés, el mail se queda sin el renglón hasta que alguien los
  // cargue — y "alguien" es la misma persona que se olvidó once veces.
  const yaCargados = leerConfigCuenta(cuenta.config).tienda ?? {};
  const semilla = SEMILLA[slug] ?? {};
  const paraCargar: Tienda = { ...semilla, ...yaCargados };
  const faltanSemilla = Object.keys(semilla).filter((k) => yaCargados[k as ClaveTienda] && yaCargados[k as ClaveTienda] !== semilla[k as ClaveTienda]);

  console.log(`\n═══ ${slug} · datos de la tienda`);
  for (const campo of CAMPOS_TIENDA) {
    const v = paraCargar[campo.clave];
    const origen = yaCargados[campo.clave] ? 'ya cargado' : semilla[campo.clave] ? 'semilla' : '—';
    console.log(`   ${campo.clave.padEnd(14)} ${(v ?? '(vacío)').padEnd(32)} ${origen}`);
  }
  for (const k of faltanSemilla) console.log(`   ⚠️  "${k}" en la base dice algo distinto a la semilla: gana la base.`);

  const limpio = leerTienda(paraCargar);
  if (!limpio) { console.error('⛔ ABORTA: esta cuenta no tiene ni un dato para cargar. Cargalos en /remitentes primero.'); process.exit(1); }

  if (JSON.stringify(limpio) !== JSON.stringify(yaCargados)) {
    if (dry) console.log(`\n~ se cargaría config.tienda`);
    else {
      const config = { ...((cuenta.config as Record<string, unknown>) ?? {}), tienda: limpio };
      await prisma.cuenta.update({ where: { id: cuenta.id }, data: { config: config as object } });
      console.log(`\n+ config.tienda cargado`);
    }
  } else console.log(`\n= config.tienda ya estaba igual`);

  // ── Fase B: sacar el literal de los documentos ─────────────────────────────
  const autos = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nombre: true, estado: true, docVersion: true, contenido: true },
  });
  const camps = await prisma.campania.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nombre: true, estado: true, docVersion: true, contenido: true },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ruta = `${COPIA}/copia-tienda-a-tags-${slug}-${stamp}.json`;
  writeFileSync(ruta, JSON.stringify({ config: cuenta.config, autos, camps }, null, 2));
  console.log(`🗄  copia de respaldo: ${ruta}  (${autos.length} automations, ${camps.length} campañas)\n`);

  const activas = autos.filter((a) => a.estado !== 'PAUSADO');
  const enviadas = camps.filter((c) => c.estado === 'ENVIADA');
  const objetivos: { tipo: 'auto' | 'camp'; id: string; nombre: string; docVersion: number; contenido: unknown }[] = [
    ...autos.filter((a) => a.estado === 'PAUSADO').map((a) => ({ tipo: 'auto' as const, ...a })),
    ...camps.filter((c) => conEnviadas || c.estado !== 'ENVIADA').map((c) => ({ tipo: 'camp' as const, ...c })),
  ];

  // 🔑 No hay tope silencioso: lo que queda afuera se nombra.
  for (const a of activas) console.log(`⛔ SALTEADA (${a.estado}): automation "${a.nombre}" — un mail que está saliendo no se edita por script. Pausala y volvé a correr.`);
  if (!conEnviadas && enviadas.length) console.log(`⛔ SALTEADAS: ${enviadas.length} campañas ENVIADAS (son el registro de lo que se mandó). Con --enviadas se incluyen.\n`);

  const marca = marcaDe({ nombre: cuenta.nombre, config: { ...((cuenta.config as object) ?? {}), tienda: limpio } }, APP);
  const opts = { unsubscribeUrl: 'https://ejemplo/baja?token=x', ...marca };

  let tocados = 0;
  for (const o of objetivos) {
    const doc = leerContenido(o.contenido);
    const cambios: Cambio[] = [];
    const nuevo = aTags(doc, limpio, cambios) as ContenidoCampania;
    if (!cambios.length) continue;

    // 🔴 EL ORÁCULO. El mail tiene que salir IDÉNTICO: el tag resuelto devuelve
    // el mismo texto que estaba escrito. Se compara contra el render VIEJO sin
    // datos de tienda, que es exactamente lo que la casilla recibía ayer.
    const antes = renderEmailHtml(doc, { ...opts, tienda: undefined });
    const despues = renderEmailHtml(nuevo, opts);
    if (antes !== despues) {
      console.error(`   ✗ ${o.nombre}: el HTML CAMBIARÍA. No se toca.`);
      const i = [...antes].findIndex((c, j) => c !== despues[j]);
      console.error(`      antes:  …${antes.slice(Math.max(0, i - 50), i + 60)}…`);
      console.error(`      después:…${despues.slice(Math.max(0, i - 50), i + 60)}…`);
      continue;
    }

    tocados++;
    console.log(`${dry ? '~' : '+'} [${o.tipo}] ${o.nombre}`);
    for (const c of cambios) console.log(`     · ${c.clave} ← "${c.contexto}"`);
    if (dry) continue;

    const contenido = { v: V_ACTUAL, tema: doc.tema, estilos: doc.estilos, bloques: nuevo.bloques } as ContenidoCampania;
    const donde = o.tipo === 'auto' ? prisma.automation : prisma.campania;
    const r = await (donde as { updateMany: (a: unknown) => Promise<{ count: number }> }).updateMany({
      where: { id: o.id, docVersion: o.docVersion },
      data: { contenido: contenido as object, docVersion: { increment: 1 } },
    });
    if (r.count === 0) { console.error(`   ⛔ CONFLICTO: alguien lo guardó mientras corría. NO se escribió.`); continue; }
    console.log(`   ✔ guardado (docVersion ${o.docVersion} → ${o.docVersion + 1})`);
  }

  console.log(`\n${tocados} documento(s) con literales. ${dry ? 'Simulación: no se escribió nada.' : 'Listo.'}`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
