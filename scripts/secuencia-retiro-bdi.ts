// Los avisos de RETIRO EN EL LOCAL de BDI (26-oct-2026): «listo para retirar», dos
// recordatorios y «gracias por pasar». Lo usa `crear-retiro-bdi.ts`.
//
// POR QUÉ, si en BDI Tiendanube SÍ manda su «Listo para retirar» (5 de 5 pedidos
// con el mail en el historial, al revés que Zattia): por la ESTÉTICA. Bruno (26-oct)
// prefirió gestionar los 4 desde acá, con la ropa de BDI; el de TN se apaga el día
// que se prendan estos (si no, salen dos «listo para retirar»).
//
// El diseño es el del diseñador, aprobado por Bruno el 26-oct:
// `.mirar/retiro-bdi/` (vitrina https://claude.ai/artifact/XrFGq3NeNzmbzN6cmJmSWi).
// Familia del TICKET DEL LOCAL de BDI (`secuencia-ticket-bdi.ts`): logo, Montserrat,
// el casi negro, títulos «REGULAR + bold italic», pastillas y el magenta en UN solo
// lugar (el paso actual del camino del pedido).
//
// Decisiones de Bruno (26-oct): para retirar, NÚMERO DE PEDIDO + NOMBRE de quien
// compró · ⛔ sin plazo de guardado ⇒ el 3º no promete fecha · el 3º manda al
// WhatsApp («vemos cómo hacemos») · ⛔ en BDI no hay cambios: ningún mail los nombra.
//
// Reglas de la serie (las mismas que Zattia):
//  - ⛔ sin cupón, sin forma de pago, sin precios: confirman, no venden;
//  - 🔴 un bloque con un `${pedido.…}` sin dato SE CAE ENTERO: «A NOMBRE DE» y
//    «A PAGAR» van en renglones PROPIOS, y «qué traer» no lleva el nombre adentro;
//  - el link a Maps es FIJO: la serie es de un solo local.
import { nuevoId, type Bloque, type ContenidoCampania } from '../lib/email/bloques.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Trozo } from '../lib/email/texto-rico.ts';
import type { MailNuevo } from './secuencia-bienvenida-5.ts';
import { NEGRO, MAGENTA, BLANCO, TEMA, RESENA_GOOGLE, clon, volanta, titular, parrafo, pastilla } from './secuencia-ticket-bdi.ts';

export const PREFIJO_RETIRO_BDI = 'Retiro BDI';

const MAPA = 'https://www.google.com/maps/search/?api=1&query=Santa%20Fe%201671%2C%20Rosario';
const GRIS = '#f5f3f3';
const LINEA = '#e8e6e6';
const APAGADO = '#b3adad';
const SOBRE_NEGRO = '#d9d4d4';

/** El título de la familia: «TU PEDIDO ESTÁ» en regular + «listo para retirar.» en bold italic. */
const titulo = (regular: string, italica: string, extra: { tamano?: number; color?: string; arriba?: number } = {}): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left',
  // ⚠️ La itálica va en el TROZO: un `italica:false` de trozo no apaga la del bloque.
  texto: [{ t: `${regular} `, peso: 400 }, { t: italica, peso: 800, italica: true }],
  estilo: {
    titulo: { tamano: extra.tamano ?? 30, peso: 400, espaciado: -0.5, interlinea: 1.1, ...(extra.color ? { color: extra.color } : {}) },
    caja: { padArriba: extra.arriba ?? 8, padAbajo: 0 },
  },
} as Bloque);

const filete = (color = LINEA): Bloque => ({
  id: nuevoId(), tipo: 'divisor', estilo: { caja: { bordeColor: color, padArriba: 0, padAbajo: 0 } },
} as Bloque);

/** COMPRASTE · LISTO PARA RETIRAR · RETIRADO, con el magenta en el paso ACTUAL y nada más. */
const camino = (actual: 1 | 2): Bloque[] => {
  const paso = (texto: string, i: number): Trozo[] => {
    if (i === actual) return [{ t: '● ', color: MAGENTA }, { t: texto, peso: 800, color: NEGRO }];
    return [{ t: `${i < actual ? '✓' : '○'} ${texto}`, peso: 400, color: i < actual ? '$medio' : APAGADO }];
  };
  return [
    { ...filete(NEGRO), estilo: { caja: { bordeColor: NEGRO, padArriba: 22, padAbajo: 0 } } } as Bloque,
    {
      id: nuevoId(), tipo: 'columnas', variante: 'textos', movil: 'fila',
      celdas: ['COMPRASTE', 'LISTO PARA RETIRAR', 'RETIRADO'].map((t, i) => ({ imagen: '', url: '', titulo: paso(t, i), texto: '' })),
      estilo: { titulo: { tamano: 9, espaciado: 1, align: 'left' }, caja: { padArriba: 6, padAbajo: 0 } },
    } as unknown as Bloque,
  ];
};

/** Un renglón de la ficha: el rótulo chico arriba y el dato abajo. */
const dato = (rotulo: string, texto: string | Trozo[]): Bloque => ({
  id: nuevoId(), tipo: 'texto', align: 'left',
  texto: [{ t: `${rotulo}\n`, tamano: 10, peso: 700, color: NEGRO }, ...(typeof texto === 'string' ? [{ t: texto }] : texto)],
  estilo: { cuerpo: { tamano: 14, interlinea: 1.5 }, caja: { padArriba: 10, padAbajo: 10 } },
} as Bloque);

/** DÓNDE · HORARIO · QUÉ TRAER · A NOMBRE DE (+ A PAGAR), entre filetes. */
const ficha = (conPago: boolean): Bloque[] => [
  dato('DÓNDE', [{ t: '${pedido.local}', peso: 700 }, { t: ' · ${pedido.direccion}' }]),
  filete(),
  dato('HORARIO', '${pedido.horario}'),
  filete(),
  dato('QUÉ TRAER', [{ t: 'Tu número de pedido, ' }, { t: '#${pedido.numero}', peso: 700 }, { t: ', y el nombre de quien hizo la compra.' }]),
  filete(),
  // Renglón PROPIO: si TN no trae el titular se cae solo, sin llevarse «qué traer».
  dato('A NOMBRE DE', '${pedido.titular}'),
  ...(conPago ? [
    // 🔴 Bloque PROPIO: sin efectivo pendiente se cae entero (`resolverPedidoEnBloques`).
    dato('A PAGAR', [{ t: 'Abonás ' }, { t: '${pedido.efectivo}', peso: 700 }, { t: ' en efectivo al retirar.' }]),
  ] : []),
];

/** Las fundas, chicas y sin precio (vista `pedido` del carrito). */
const fundas = (): Bloque => ({
  id: nuevoId(), tipo: 'carrito', items: [], vista: 'pedido',
  estilo: { titulo: { tamano: 13, peso: 400 }, imagen: { radio: 0 }, caja: { padArriba: 4, padAbajo: 4 } },
} as unknown as Bloque);

/**
 * El PASE DE RETIRO del mail 1: la tarjeta del ticket del local — filete negro,
 * franja negra «TU PEDIDO #N» y adentro todo lo que hace falta en el mostrador.
 */
const pase = (): Bloque => ({
  id: nuevoId(), tipo: 'banda', fondo: BLANCO, borde: NEGRO, base: 'claro',
  cabecera: { izquierda: 'TU PEDIDO', derecha: '#${pedido.numero}' },
  bloques: [
    ...ficha(true),
    filete(),
    fundas(),
  ],
  estilo: { caja: { padArriba: 6, padAbajo: 6 } },
} as unknown as Bloque);

/** La ficha suelta (mails 2 y 3): sin tarjeta, entre filetes NEGROS. */
const fichaSuelta = (): Bloque[] => [
  { ...filete(NEGRO), estilo: { caja: { bordeColor: NEGRO, padArriba: 28, padAbajo: 0 } } } as Bloque,
  ...ficha(false),
  filete(NEGRO),
];

const elPedido = (rotulo = 'TU PEDIDO #${pedido.numero}'): Bloque[] => [volanta(rotulo, NEGRO, 28), fundas()];

/** Una banda negra con su pastilla blanca (el «NEW IN» del ticket). */
const bandaNegra = (bloques: Bloque[]): Bloque => ({
  id: nuevoId(), tipo: 'banda', fondo: NEGRO, base: 'oscuro', acento: BLANCO, bloques,
} as unknown as Bloque);

export interface MailRetiroBdi extends MailNuevo {
  trigger: 'RETIRO_LISTO' | 'RETIRADO';
}

/**
 * `fuente`: la bienvenida de BDI (de ahí se clonan el logo y las redes, como el
 * ticket). `whatsapp`: el link del carrito de BDI — 🔴 nunca un `wa.me` a mano.
 */
export function armarRetiroBdi(fuente: { contenido: unknown }, whatsapp: string): MailRetiroBdi[] {
  const base = leerContenido(fuente.contenido).bloques;
  const enc = base.find((x) => x.tipo === 'encabezado');
  const redes = base.find((x) => x.tipo === 'redes');
  if (!enc || !redes) throw new Error('falta el encabezado o las redes en la bienvenida de BDI (de ahí se clonan)');
  if (!/^https:\/\/wa\.me\/549\d+$/.test(whatsapp)) throw new Error(`WhatsApp de BDI raro: ${whatsapp}`);

  const pie = (motivo: string): Bloque[] => {
    const r = clon(redes);
    r.estilo = { caja: { padArriba: 36, padAbajo: 0 } };
    return [r, {
      id: nuevoId(), tipo: 'texto', align: 'center', texto: motivo,
      estilo: { cuerpo: { tamano: 11, color: '$tenue' }, caja: { padArriba: 12, padAbajo: 8 } },
    } as Bloque];
  };
  const MOTIVO = 'Te llega porque compraste online en BDI y elegiste retirar en el local.';
  const doc = (bloques: Bloque[]): ContenidoCampania => leerContenido({ v: V_ACTUAL, bloques, tema: TEMA });

  // ── 1 · al empaquetar: listo para retirar ───────────────────────────────────
  const mail1: Bloque[] = [
    clon(enc),
    volanta('RETIRO EN EL LOCAL', '$medio', 4),
    titulo('TU PEDIDO ESTÁ', 'listo para retirar.'),
    parrafo('Ya podés pasar a buscarlo por ${pedido.local}. ¡Te esperamos! <3', { arriba: 14 }),
    ...camino(1),
    { id: nuevoId(), tipo: 'espaciador', alto: 16 } as Bloque,
    pase(),
    pastilla('CÓMO LLEGAR', MAPA, { arriba: 14 }),
    { ...parrafo('', { tamano: 14, color: '$medio', arriba: 18 }), texto: [{ t: '¿Dudas con tu pedido? ' }, { t: 'Escribinos por WhatsApp', url: whatsapp, subrayado: true }, { t: '.' }] } as Bloque,
    ...pie(MOTIVO),
  ];

  // ── 2 · día 3: te estamos esperando ─────────────────────────────────────────
  const mail2: Bloque[] = [
    clon(enc),
    bandaNegra([
      volanta('PEDIDO #${pedido.numero} · LISTO EN EL LOCAL', '#cfcaca', 4),
      titulo('TE ESTAMOS', 'esperando.', { tamano: 34, color: BLANCO }),
      parrafo('Tu pedido ya está separado en ${pedido.local}. Pasá cuando te quede cómodo <3', { color: SOBRE_NEGRO }),
      pastilla('CÓMO LLEGAR', MAPA, { arriba: 22, abajo: 2 }),
    ]),
    ...fichaSuelta(),
    ...elPedido(),
    ...pie(MOTIVO),
  ];

  // ── 3 · día 7: seguimos guardando tu pedido (⛔ sin plazo, ⛔ sin urgencia) ──
  const mail3: Bloque[] = [
    clon(enc),
    volanta('PEDIDO #${pedido.numero}', '$medio', 4),
    titulo('SEGUIMOS GUARDANDO', 'tu pedido.'),
    {
      id: nuevoId(), tipo: 'banda', fondo: GRIS, base: 'claro', bloques: [
        parrafo('Está separado en el local, a tu nombre. Si se te complicó pasar, no pasa nada: escribinos y vemos cómo hacemos <3', { arriba: 0 }),
        pastilla('ESCRIBINOS POR WHATSAPP', whatsapp, { arriba: 20 }),
        { ...parrafo('', { tamano: 13, arriba: 16 }), texto: [{ t: 'Cómo llegar al local →', url: MAPA, subrayado: true, peso: 700 }] } as Bloque,
      ],
      estilo: { caja: { padArriba: 24, padAbajo: 24 } },
    } as unknown as Bloque,
    ...fichaSuelta(),
    ...elPedido(),
    ...pie(MOTIVO),
  ];

  // ── 4 · al retirar: gracias por pasar (⛔ nada de cambios) ───────────────────
  const mail4: Bloque[] = [
    clon(enc),
    volanta('PEDIDO #${pedido.numero} · RETIRADO', '$medio', 4),
    titulo('GRACIAS POR', 'pasar a buscarlo.'),
    parrafo('Que disfrutes mucho lo que te llevaste. ¡Gracias por elegirnos! <3', { arriba: 14 }),
    ...camino(2),
    ...elPedido('LO QUE TE LLEVASTE'),
    { id: nuevoId(), tipo: 'espaciador', alto: 12 } as Bloque,
    bandaNegra([
      titular('¿Cómo te atendimos?', 26, { color: BLANCO, arriba: 4 }),
      parrafo('Si te gustó, contalo en Google. Nos ayuda muchísimo a que más gente se anime a venir al local.', { tamano: 14, color: SOBRE_NEGRO, arriba: 10 }),
      pastilla('DEJAR MI RESEÑA EN GOOGLE', RESENA_GOOGLE, { arriba: 22, abajo: 2 }),
    ]),
    ...pie('Te llega porque compraste online en BDI y retiraste en el local.'),
  ];

  const m = (n: number, nombre: string, trigger: MailRetiroBdi['trigger'], esperaHoras: number, asunto: string, preheader: string, bloques: Bloque[]): MailRetiroBdi => ({
    nombre: `${PREFIJO_RETIRO_BDI} ${n}/4 — ${nombre}`, trigger, esperaHoras, asunto, preheader, contenido: doc(bloques), remitenteNombre: null, responderA: null,
  });

  return [
    // ⛔ El efectivo en el preheader: sin dato el tag se vacía y quedaría «Abonás  en efectivo».
    m(1, 'listo para retirar', 'RETIRO_LISTO', 0, 'Tu pedido #${pedido.numero} está listo para retirar <3', 'Pasá por ${pedido.local}, Santa Fe 1671. ${pedido.horario}.', mail1),
    m(2, 'te estamos esperando', 'RETIRO_LISTO', 72, 'Te estamos esperando: tu pedido #${pedido.numero}', 'Tu pedido #${pedido.numero} ya está separado en ${pedido.local}, Santa Fe 1671.', mail2),
    m(3, 'seguimos guardando', 'RETIRO_LISTO', 168, 'Seguimos guardando tu pedido #${pedido.numero}', 'Está separado en el local, a tu nombre. Si se te complicó pasar, escribinos.', mail3),
    m(4, 'gracias por pasar', 'RETIRADO', 0, '¡Gracias por pasar!', 'Que lo disfrutes mucho. Y si te gustó cómo te atendimos, contalo en Google.', mail4),
  ];
}
