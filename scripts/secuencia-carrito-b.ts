// «Carrito v2 · B — saca la duda» (11-oct-2026): los 4 mails de carrito con el
// MENSAJE primero, armado con los datos de SU carrito. Lo usan
// `actualizar-secuencia-carrito-b.ts` (que los escribe sobre los 4 «Carrito v2»
// en PAUSADO) y `ensayo-secuencia.ts --b` (que los dibuja con un carrito real
// sin escribir nada).
//
// De dónde sale: la vitrina de diseño (`.mirar/disenio/carrito-v2-2026-10-11/`,
// propuestas `propuesta-b-*.html`). La hipótesis comercial, medida el 29-sep:
// casi nadie compra por un click y el cupón casi no se canjea (403 emitidos, 2
// usados) ⇒ el descuento no es lo que frena; el mail tiene que sacar el MOTIVO
// por el que la persona no terminó —el envío, el precio, si le va a su teléfono—.
//
//  1 · a la hora  — «Tu pedido ya tiene envío gratis» / «te faltan $X», el total
//                   y la cuota, el carrito por modelo y WhatsApp al lado del botón.
//  2 · 24 h       — texto plano de Bruno: ¿son para tu teléfono? (responder el mail).
//  3 · 48 h       — «Si no te queda, lo cambiás» + las opiniones sobre negro.
//  4 · 72 h       — «Tu pedido, en limpio»: el resumen entero en una franja negra.
//
// 🔴 Lo que NO se escribe a mano: el WhatsApp (se CLONA del mail de hoy: sin el 9
// abre un chat con un número que no existe), las opiniones de Google y la foto
// del local (las mismas de hoy, sin tocar una palabra), los datos de la tienda
// (`${tienda.…}`) y los del carrito (`${cart.…}`, calculados al enviar).
// ⛔ Fuera del bloque `cupon` nada nombra el descuento: el bloque se borra solo.
import { nuevoId, type Bloque, type ContenidoCampania } from '../lib/email/bloques.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Tema } from '../lib/email/tema.ts';
import { armarSecuencia4, PREFIJO, type MailNuevo } from './secuencia-carrito-4.ts';

export { PREFIJO };

interface Vieja {
  nombre: string;
  esperaHoras: number;
  contenido: unknown;
}

const MAGENTA = '#e40044';
const CLARITO = '#f5f4f4';
const NEGRO = '#1b1717';

/** El de toda la secuencia: Montserrat, el casi negro de la tienda y blanco. */
const TEMA: Tema = { base: 'claro', fondo: '#ffffff', fondoContenido: '#ffffff', acento: NEGRO, fuente: 'montserrat' };

const clon = <T extends Bloque>(b: T): T => ({ ...structuredClone(b), id: nuevoId() });

function tomar(bloques: Bloque[], que: string, pred: (b: Bloque) => boolean): Bloque {
  const b = bloques.find(pred);
  if (!b) throw new Error(`falta en el mail de hoy: ${que}`);
  return clon(b);
}

const plano = (t: unknown): string =>
  typeof t === 'string' ? t : Array.isArray(t) ? t.map((x) => (x as { t?: string }).t ?? '').join('') : '';

/** El link de WhatsApp que ya sale hoy, con su `?text=`. */
function waDe(bloques: Bloque[]): string {
  const m = /https:\/\/wa\.me\/[^"\s\\]+/.exec(JSON.stringify(bloques));
  if (!m) throw new Error('el mail de hoy no tiene el link de WhatsApp');
  return m[0];
}

// ── Las piezas ────────────────────────────────────────────────────────────────

/** Rótulo chico en mayúsculas, separado: «TU PEDIDO ESTÁ LISTO PARA SALIR». */
const volanta = (texto: string, color = '$medio'): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto,
  estilo: { titulo: { tamano: 11, peso: 700, espaciado: 2, color }, caja: { padArriba: 10, padAbajo: 0 } },
});

/** El título de colección de la tienda: bold italic, apretado, a la izquierda. */
const titular = (texto: string): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto,
  estilo: { titulo: { tamano: 30, peso: 800, italica: true, espaciado: -1, interlinea: 1.1 }, caja: { padArriba: 6, padAbajo: 0 } },
});

const parrafo = (texto: string, tamano = 16): Bloque => ({
  id: nuevoId(), tipo: 'texto', align: 'left', texto,
  estilo: { cuerpo: { tamano, interlinea: 1.45 }, caja: { padArriba: 12, padAbajo: 4 } },
});

/** El par de botones: completar (lleno) y WhatsApp (con borde). */
const botones = (wa: string): Bloque => ({
  id: nuevoId(), tipo: 'boton', texto: 'COMPLETAR MI PEDIDO', url: '${cart.url}', align: 'left',
  segundo: { texto: 'CONSULTAR POR WHATSAPP', url: wa },
  estilo: { boton: { tamano: 13, peso: 700, espaciado: 1, radio: 30, padY: 16, padX: 12 }, caja: { padArriba: 18, padAbajo: 8 } },
});

const cupon = (texto: string, fuente: 'recordar' | 'recordar-o-emitir'): Bloque => ({
  id: nuevoId(), tipo: 'cupon', variante: 'marco', texto,
  // `CARRITO10` es el placeholder de siempre y NUNCA sale: sin cupón vivo el
  // procesador borra el bloque entero (`aplicarCuponDeCarrito`).
  codigo: 'CARRITO10', botonTexto: '', botonUrl: '', fuente,
  estilo: { precio: { color: MAGENTA } },
});

/** La caja gris de la duda del modelo, con WhatsApp adentro. */
const duda = (wa: string): Bloque => ({
  id: nuevoId(), tipo: 'seccion', bg: CLARITO, titulo: '', botonTexto: '', botonUrl: '',
  texto: [
    { t: '¿Es para tu teléfono? ', peso: 700 },
    { t: 'Si no sabés bien qué modelo tenés, o alguna es para regalar, ' },
    { t: 'escribinos por WhatsApp', peso: 700, url: wa },
    { t: ' y te lo confirmamos.' },
  ],
  estilo: { caja: { align: 'left', padY: 16, padX: 32 }, subtitulo: { tamano: 14, color: '$cuerpo' } },
});

const carrito = (vista: 'por-modelo' | 'tira' | 'resumen' | 'lista'): Bloque => ({
  id: nuevoId(), tipo: 'carrito', items: [], ...(vista === 'lista' ? {} : { vista }),
});

/** Las garantías de hoy, sin íconos: una fila de texto que no compite con las fundas. */
function garantias(base: Bloque): Bloque {
  if (base.tipo !== 'columnas') return base;
  return {
    ...base,
    celdas: base.celdas.map((c) => ({ ...c, icono: undefined })),
    estilo: { titulo: { tamano: 12, peso: 700, mayusculas: true, align: 'left' }, cuerpo: { tamano: 12, color: '$medio', align: 'left' } },
  };
}

/** Una opinión de Google sobre negro: la comilla magenta y la cita en bold italic. */
function opinion(cita: string, firma: string): Bloque[] {
  const limpia = cita.replace(/^[“"\s]+|[”"\s]+$/g, '');
  const quien = firma.replace(/^[—–-]\s*/, '').replace(/,\s*/, ' · ').toUpperCase();
  return [
    {
      id: nuevoId(), tipo: 'texto', align: 'left',
      texto: [{ t: '“', tamano: 40, peso: 800, color: MAGENTA }, { t: `\n${limpia}`, tamano: 19, peso: 700, italica: true }],
      estilo: { cuerpo: { interlinea: 1.4, color: '$texto' }, caja: { padArriba: 14, padAbajo: 0 } },
    },
    {
      id: nuevoId(), tipo: 'texto', align: 'left', texto: quien,
      estilo: { cuerpo: { tamano: 10, espaciado: 2, color: '$tenue' }, caja: { padArriba: 6, padAbajo: 10 } },
    },
  ];
}

// ── Los cuatro ───────────────────────────────────────────────────────────────

export function armarSecuenciaB(viejas: Vieja[]): MailNuevo[] {
  // Los 4 de «Carrito v2» armados en memoria: de ahí salen las piezas que se
  // clonan, que ya son las curadas (logo recortado, WhatsApp con el 9, etc.).
  const [v1, , v3, v4] = armarSecuencia4(viejas);
  const b1 = v1.contenido.bloques;
  const b3 = v3.contenido.bloques;
  const b4 = v4.contenido.bloques;

  const wa = waDe(b1);
  const encabezado = () => tomar(b1, 'el encabezado', (b) => b.tipo === 'encabezado');
  const esGarantias = (b: Bloque) => b.tipo === 'columnas' && JSON.stringify(b).includes('${tienda.envioGratis}');
  const pie = () => tomar(b1, 'el pie de confianza', (b) => b.tipo === 'texto' && plano(b.texto).includes('${tienda.plazoDespacho}'));
  const garantia = () => garantias(tomar(b1, 'la barra de garantías', esGarantias));

  const doc = (bloques: Bloque[], extra: Partial<ContenidoCampania> = {}): ContenidoCampania =>
    leerContenido({ v: V_ACTUAL, bloques, tema: TEMA, ...extra });

  // ── 1 · a la hora ──────────────────────────────────────────────────────────
  const mail1: Bloque[] = [
    encabezado(),
    volanta('TU PEDIDO ESTÁ LISTO PARA SALIR'),
    titular('${cart.envio}.'),
    parrafo('Son **${cart.total}**, y lo podés pagar en **${cart.cuotas} sin interés**.', 17),
    botones(wa),
    volanta('LO QUE ELEGISTE, POR MODELO', '$texto'),
    carrito('por-modelo'),
    duda(wa),
    cupon('Acordate: tenés tu descuento activo', 'recordar'),
    garantia(),
    pie(),
  ];

  // ── 2 · 24 h: texto plano, firmado por Bruno ───────────────────────────────
  const texto = (t: string | { t: string; url?: string }[]): Bloque => ({ id: nuevoId(), tipo: 'texto', texto: t });
  const mail2: Bloque[] = [
    texto('${contacto.saludo}'),
    texto('Soy Bruno, de BDI. Vi que dejaste armado un carrito con fundas para ${cart.modelos}:'),
    texto('${cart.lineas}'),
    texto('Te pregunto porque es la duda más común con las fundas: si alguna es para otro teléfono, o para regalar, respondeme este mail con el modelo y te confirmo que le va antes de que compres.'),
    { id: nuevoId(), tipo: 'cupon', texto: 'Y acordate que tenés tu código', codigo: 'CARRITO10', botonTexto: '', botonUrl: '', fuente: 'recordar' },
    texto([{ t: 'Tu carrito está acá: ' }, { t: 'volver a mi carrito', url: '${cart.url}' }]),
    texto('Bruno\nBDI Accesorios'),
  ];

  // ── 3 · 48 h: si no te queda, lo cambiás ───────────────────────────────────
  const opiniones = tomar(b3, 'las opiniones de Google', (b) => b.tipo === 'columnas' && !esGarantias(b));
  if (opiniones.tipo !== 'columnas') throw new Error('las opiniones no son columnas');
  const mail3: Bloque[] = [
    encabezado(),
    volanta('TU CARRITO SIGUE GUARDADO'),
    titular('Si no te queda, lo cambiás.'),
    parrafo('Tenés **${tienda.plazoCambio}**. Miralo, probalo en tu teléfono, y si no era lo que esperabas lo resolvemos.'),
    carrito('tira'),
    botones(wa),
    {
      id: nuevoId(), tipo: 'banda', fondo: NEGRO, base: 'oscuro', acento: '#ffffff',
      bloques: [
        volanta('LO QUE DICEN QUIENES YA COMPRARON', '$texto'),
        ...opiniones.celdas.flatMap((c) => opinion(plano(c.titulo), plano(c.texto))),
      ],
    },
    tomar(b3, 'la foto del local', (b) => b.tipo === 'imagen' && (b.alt ?? '').includes('Rosario')),
    cupon('Tu descuento sigue activo', 'recordar'),
    garantia(),
    pie(),
  ];

  // ── 4 · 72 h: el pedido, en limpio ─────────────────────────────────────────
  const fuente4 = (b4.find((b) => b.tipo === 'cupon') as { fuente?: string } | undefined)?.fuente;
  const mail4: Bloque[] = [
    encabezado(),
    {
      id: nuevoId(), tipo: 'banda', fondo: NEGRO, base: 'oscuro', acento: '#ffffff',
      bloques: [
        volanta('LAST CALL · ÚLTIMO AVISO', MAGENTA),
        titular('Tu pedido, en limpio.'),
        parrafo('Es la última vez que te escribimos por esto. Esto es lo que dejaste armado:', 15),
        carrito('resumen'),
        cupon('Tu código', fuente4 === 'recordar' ? 'recordar' : 'recordar-o-emitir'),
        botones(wa),
      ],
    },
    { ...volanta('TU CARRITO · ${cart.cantidad}', '$texto'), estilo: { titulo: { tamano: 11, peso: 700, espaciado: 2, mayusculas: true }, caja: { padArriba: 10, padAbajo: 0 } } },
    carrito('lista'),
    duda(wa),
    garantia(),
    pie(),
  ];

  return [
    { ...v1, asunto: 'Tu pedido está listo para salir 📦', preheader: '${cart.envio} · ${cart.cuotas} sin interés', contenido: doc(mail1) },
    { ...armarSecuencia4(viejas)[1], asunto: '¿son para tu teléfono?', preheader: null, contenido: doc(mail2, { formato: 'personal', tema: undefined }) },
    { ...v3, asunto: 'Si no te queda, lo cambiás', preheader: 'Lo podés cambiar, y esto dicen quienes ya compraron', contenido: doc(mail3) },
    { ...v4, asunto: 'LAST CALL ☎️', preheader: 'Tu pedido en limpio: total, envío y cuotas', contenido: doc(mail4) },
  ];
}
