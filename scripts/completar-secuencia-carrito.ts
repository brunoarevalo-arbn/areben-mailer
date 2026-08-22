// Los bloques de CONTENIDO del 2º y 3er mail de carrito, y la corrección del
// mail de reseña. Completa lo que `crear-secuencia-carrito.ts` dejó armado.
//
// Correr:  node --import tsx --env-file=.env scripts/completar-secuencia-carrito.ts --cuenta=bdi --dry
//          node --import tsx --env-file=.env scripts/completar-secuencia-carrito.ts --cuenta=bdi
//
// 🔴 **Sólo toca automations PAUSADAS.** Si alguna está activa aborta entera:
//    un mail que está saliendo no se edita por script.
// 🔴 **Guarda una copia del JSON antes de escribir.** No hay historial: la copia
//    es la única vuelta atrás.
// 🔑 Idempotente por id de bloque: los bloques que agrega llevan id fijo, así que
//    correrlo dos veces no duplica nada, y un bloque que alguien borró a mano NO
//    vuelve (se saltea el mail entero si ya tiene alguno de los suyos).
// 🔑 Escribe con `updateMany` condicional por `docVersion`, igual que el editor:
//    si alguien guardó desde la UI mientras esto corría, no se pisa.
import { writeFileSync } from 'node:fs';
import { prisma } from '../lib/prisma.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Bloque, ContenidoCampania } from '../lib/email/bloques.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';
const dry = process.argv.includes('--dry');
const COPIA = process.env.COPIA_DIR ?? '/tmp';
const GRIS = '#6b7280';

/** El umbral de envío gratis, confirmado por Bruno el 22-ago-2026. Los mails ya
 *  enviados dicen $50.000: ése es el viejo. */
const ENVIO_GRATIS = '$44.000';

const columnasGarantias = (id: string, conCambios: boolean): Bloque =>
  ({
    id,
    tipo: 'columnas',
    variante: 'textos',
    movil: 'fila',
    estilo: { cuerpo: { align: 'center' }, titulo: { align: 'center' } },
    celdas: [
      { url: '', imagen: '', icono: 'envio', titulo: 'Envíos gratis', texto: `En compras mayores a ${ENVIO_GRATIS}` },
      { url: '', imagen: '', icono: 'tarjeta', titulo: '3 cuotas sin interés', texto: 'En toda la tienda' },
      // 🔑 En el 3er mail la barra va de DOS celdas: los cambios ya son su propio
      // bloque unas líneas más arriba, y una celda de WhatsApp dejaba el mail con
      // tres menciones seguidas (celda, pregunta de salida y pie).
      ...(conCambios
        ? [{ url: '', imagen: '', icono: 'cambios', titulo: 'Cambios y devoluciones', texto: '30 días desde que lo recibís' }]
        : []),
    ],
  }) as Bloque;

const divisor = (id: string): Bloque => ({ id, tipo: 'divisor' }) as Bloque;
const rotulo = (id: string, t: string): Bloque =>
  ({ id, tipo: 'titulo', align: 'center', texto: [{ t, tamano: 12 }] }) as Bloque;

/** Las dos opiniones son REALES y están publicadas en Google. No se editan. */
const columnasResenas = (id: string): Bloque =>
  ({
    id,
    tipo: 'columnas',
    variante: 'textos',
    movil: 'apilar',
    estilo: { cuerpo: { align: 'center', color: '$tenue' }, titulo: { align: 'center' } },
    celdas: [
      {
        url: '', imagen: '', 
        titulo: [{ t: '“Me pedí una funda por la página, yo soy de Capital. Excelente cómo llegó y lo más importante: la funda hermosa, el color lo que es.”', tamano: 13 }],
        texto: [{ t: '— Tiara B., opinión en Google', tamano: 11 }],
      },
      {
        url: '', imagen: '',
        titulo: [{ t: '“Envíos súper rápidos, buena comunicación y hermosa experiencia comprando en BDI.”', tamano: 13 }],
        texto: [{ t: '— Thiago A., opinión en Google', tamano: 11 }],
      },
    ],
  }) as Bloque;

/** El local. Nace SIN foto: cuando Bruno suba la de la vidriera se le agrega
 *  `fondoImagen` acá mismo y el texto ya está adentro. */
const bloqueLocal = (id: string): Bloque =>
  ({
    id,
    tipo: 'seccion',
    bg: '#f2f2f2',
    titulo: [{ t: 'Y si estás en Rosario, venite', tamano: 15 }],
    texto: [{ t: 'Estamos en Santa Fe 1671, adentro del Palace Garden. Podés retirar tu compra sin pagar envío.', tamano: 12 }],
    botonTexto: '',
    botonUrl: '',
    estilo: { caja: { padY: 16, align: 'center' } },
  }) as Bloque;

const texto = (id: string, trozos: { t: string; tamano?: number }[], color?: string): Bloque =>
  ({ id, tipo: 'texto', align: 'center', texto: trozos, estilo: { cuerpo: { tamano: 14, interlinea: 1.4, ...(color ? { color } : {}) } } }) as Bloque;

/** La pregunta de salida REUSA el `wa.me` del mail (número ya verificado) y sólo
 *  le cambia el mensaje prellenado. ⛔ Nunca escribir el número a mano. */
function preguntaSalida(id: string, waUrl: string | null): Bloque {
  const url = waUrl ? waUrl.split('?')[0] + '?text=' + encodeURIComponent('Hola! No terminé mi compra porque…') : null;
  const trozos = url
    ? [{ t: '¿Hubo algo que te frenó? ', tamano: 12 }, { t: 'Contanos por WhatsApp', url, tamano: 12, subrayado: true }, { t: ' — nos sirve para mejorar.', tamano: 12 }]
    : [{ t: '¿Hubo algo que te frenó? Contanos, nos sirve para mejorar.', tamano: 12 }];
  return { id, tipo: 'texto', align: 'center', texto: trozos, estilo: { cuerpo: { tamano: 13, color: '$tenue', interlinea: 1.4 } } } as Bloque;
}

/** La salida del mail de reseña: 30 días y un WhatsApp, antes de la estrella. */
function preguntaCambio(id: string, waUrl: string | null): Bloque {
  const url = waUrl ? waUrl.split('?')[0] + '?text=' + encodeURIComponent('Hola! Tuve un problema con mi compra') : null;
  const trozos = url
    ? [{ t: '¿Algo no salió como esperabas? Tenés 30 días desde que lo recibís para cambiarlo: ', tamano: 12 }, { t: 'escribinos por WhatsApp', url, tamano: 12, subrayado: true }, { t: ' y lo resolvemos.', tamano: 12 }]
    : [{ t: '¿Algo no salió como esperabas? Tenés 30 días desde que lo recibís para cambiarlo. Escribinos y lo resolvemos.', tamano: 12 }];
  return { id, tipo: 'texto', align: 'center', texto: trozos, estilo: { cuerpo: { tamano: 13, color: '$tenue', interlinea: 1.4 } } } as Bloque;
}

function waDe(bloques: Bloque[]): string | null {
  for (const b of bloques) {
    const t = (b as { texto?: unknown }).texto;
    if (!Array.isArray(t)) continue;
    for (const trozo of t) {
      const u = (trozo as { url?: string }).url;
      if (typeof u === 'string' && u.startsWith('https://wa.me/')) return u;
    }
  }
  return null;
}

/** El pie gris: "Envío a todo el país" ya lo dice la barra de garantías, así que
 *  ese lugar pasa a decir el dato que hoy no está en NINGÚN mail de BDI. */
function arreglarPie(bloques: Bloque[]): boolean {
  let tocado = false;
  for (const b of bloques) {
    const t = (b as { texto?: unknown }).texto;
    if (!Array.isArray(t)) continue;
    for (const trozo of t as { t?: string }[]) {
      if (typeof trozo.t === 'string' && trozo.t.includes('Envío a todo el país')) {
        trozo.t = trozo.t.replace('Envío a todo el país', 'Despachamos en 24 h hábiles');
        tocado = true;
      }
    }
  }
  return tocado;
}

const idx = (bs: Bloque[], p: (b: Bloque) => boolean) => bs.findIndex(p);

async function main() {
  const cuenta = await prisma.cuenta.findFirst({ where: { slug } });
  if (!cuenta) { console.error(`❌ no existe la cuenta "${slug}"`); process.exit(1); }

  const autos = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id, trigger: { in: ['CARRITO_ABANDONADO', 'RESENA'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nombre: true, trigger: true, estado: true, docVersion: true, contenido: true, asunto: true, preheader: true },
  });

  const activas = autos.filter((a) => a.estado !== 'PAUSADO');
  if (activas.length) {
    console.error(`⛔ ABORTA: hay automations que NO están pausadas: ${activas.map((a) => `${a.nombre} (${a.estado})`).join(', ')}`);
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ruta = `${COPIA}/copia-automations-${slug}-${stamp}.json`;
  writeFileSync(ruta, JSON.stringify(autos, null, 2));
  console.log(`🗄  copia de respaldo: ${ruta}  (${autos.length} documentos)\n`);

  // 🔑 El `wa.me` sale de CUALQUIER mail que ya lo tenga: el de reseña no lo
  // lleva adentro, y escribirlo a mano es volver al bug del `9`.
  const waCuenta = autos.map((x) => waDe(leerContenido(x.contenido).bloques as Bloque[])).find(Boolean) ?? null;

  for (const a of autos) {
    const doc = leerContenido(a.contenido);
    const bs = [...doc.bloques] as Bloque[];
    const wa = waDe(bs) ?? waCuenta;
    let asunto = a.asunto;
    let preheader = a.preheader;
    let cambios: string[] = [];

    const yaTiene = (id: string) => bs.some((b) => b.id === id);

    if (a.trigger === 'CARRITO_ABANDONADO' && /2º/.test(a.nombre)) {
      if (yaTiene('car2-garantias')) { console.log(`= ${a.nombre}: ya tiene sus bloques, no se toca`); continue; }
      const iWa = idx(bs, (b) => b.tipo === 'texto' && Array.isArray((b as any).texto) && (b as any).texto.some((t: any) => t.url?.startsWith('https://wa.me/')));
      bs.splice(iWa + 1, 0, columnasGarantias('car2-garantias', true));
      cambios.push('barra de 3 garantías después del párrafo');
      const iBoton = idx(bs, (b) => b.tipo === 'boton');
      bs.splice(iBoton + 1, 0,
        divisor('car2-d1'), rotulo('car2-rot', 'LO QUE DICEN QUIENES YA COMPRARON'), divisor('car2-d2'),
        columnasResenas('car2-resenas'), bloqueLocal('car2-local'));
      cambios.push('2 opiniones de Google + el local, después del botón');
      if (arreglarPie(bs)) cambios.push('el pie ahora dice "Despachamos en 24 h hábiles"');
    } else if (a.trigger === 'CARRITO_ABANDONADO' && /3º/.test(a.nombre)) {
      if (yaTiene('car3-30dias')) { console.log(`= ${a.nombre}: ya tiene sus bloques, no se toca`); continue; }
      const iBoton = idx(bs, (b) => b.tipo === 'boton');
      bs.splice(iBoton + 1, 0,
        divisor('car3-d1'),
        rotulo('car3-30dias', 'SI NO TE CONVENCE, LO CAMBIÁS'),
        texto('car3-30texto', [{ t: 'Tenés 30 días desde que lo recibís para cambiarlo. Miralo, probalo, y si no era lo que esperabas lo resolvemos.', tamano: 12 }]),
        columnasGarantias('car3-garantias', false),
        preguntaSalida('car3-salida', wa));
      cambios.push('los 30 días + barra de garantías + la pregunta de salida, después del botón');
      if (arreglarPie(bs)) cambios.push('el pie ahora dice "Despachamos en 24 h hábiles"');
    } else if (a.trigger === 'RESENA') {
      const b = bs.find((x) => x.tipo === 'texto' && JSON.stringify((x as any).texto).includes('entrá al producto'));
      if (!b) { console.log(`= ${a.nombre}: el párrafo ya está corregido`); }
      else {
        (b as any).texto = 'Tu opinión ayuda a quien está por comprar lo mismo. Es un minuto: tocá las estrellas de acá abajo y contanos cómo te fue.';
        cambios.push('el párrafo ya no manda a "entrá al producto": se puntúa desde el mail');
      }
      if (!preheader) { preheader = 'Un minuto y ayudás a quien está por comprar lo mismo'; cambios.push('preheader nuevo'); }
      // 🔑 **Ofrecer el cambio ANTES de pedir la opinión no es esconder nada: es
      // darle salida a la queja.** Las reseñas negativas de la ficha de BDI son
      // casi todas producto que se desgastó, y en varias el propio local ofrece
      // el cambio en la respuesta pública — o sea, después de la estrella. Acá
      // llega antes, y por el canal donde se resuelve.
      if (!bs.some((b) => b.id === 'res-cambios')) {
        bs.push(divisor('res-d1'), preguntaCambio('res-cambios', wa));
        cambios.push('la salida por cambio + WhatsApp al final');
      }
    } else if (a.trigger === 'CARRITO_ABANDONADO') {
      // El 1º: lo editó el comerciante y tiene otra forma (la portada arriba, el
      // WhatsApp DESPUÉS del botón). La barra va al final, antes del pie: sin
      // esto la secuencia sale coja —el 1º sin garantías y el 2º con todas—.
      if (yaTiene('car1-garantias')) { console.log(`= ${a.nombre}: ya tiene su barra, no se toca`); continue; }
      const iPie = idx(bs, (b) => b.tipo === 'texto' && JSON.stringify((b as any).texto).includes('Pago seguro'));
      bs.splice(iPie < 0 ? bs.length : iPie, 0, columnasGarantias('car1-garantias', true));
      cambios.push('barra de 3 garantías antes del pie');
      if (arreglarPie(bs)) cambios.push('el pie ahora dice "Despachamos en 24 h hábiles"');
    } else {
      console.log(`· ${a.nombre}: no le toca nada`);
      continue;
    }

    if (!cambios.length) { console.log(`= ${a.nombre}: nada para hacer`); continue; }
    const contenido: ContenidoCampania = { v: V_ACTUAL, tema: doc.tema, bloques: bs as any };
    console.log(`${dry ? '~' : '+'} ${a.nombre}  (${bs.length} bloques)`);
    for (const c of cambios) console.log(`     · ${c}`);
    if (dry) continue;

    const r = await prisma.automation.updateMany({
      where: { id: a.id, docVersion: a.docVersion },
      data: { contenido: contenido as object, asunto, preheader, docVersion: { increment: 1 } },
    });
    if (r.count === 0) { console.error(`   ⛔ CONFLICTO: alguien lo guardó mientras corría. NO se escribió.`); continue; }
    console.log(`   ✔ guardado (docVersion ${a.docVersion} → ${a.docVersion + 1})`);
  }
  console.log(`\n${dry ? 'Simulación: no se escribió nada.' : 'Listo. Siguen PAUSADOS.'}`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
