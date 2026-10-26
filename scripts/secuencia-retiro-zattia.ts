// Los avisos de RETIRO EN EL LOCAL de Zattia (26-oct-2026): «listo para retirar»,
// dos recordatorios y «gracias por pasar». Lo usa `crear-retiro-zattia.ts`.
//
// POR QUÉ. Tiendanube tiene su «Listo para retirar» prendido en Zattia y no lo
// manda: 5 de 5 retiros empaquetados sin el mail en el historial del pedido, y
// pedidos «Por retirar» de un mes. Ver `lib/email/pedido.ts`.
//
// El diseño es el del diseñador, aprobado por Bruno el 26-oct («me gustaron»):
// `.mirar/estado-pedido-zattia/` (vitrina https://claude.ai/artifact/5VJvSMhtXpeMUL6JEzmSc1).
// Está armado con las piezas de la familia Zattia (`secuencia-bienvenida-zattia.ts`)
// y bloques que ya existen; lo único nuevo del motor es la vista `pedido` del
// carrito y los `${pedido.…}`.
//
// Decisiones de Bruno (26-oct):
//  - para retirar se pide el NÚMERO DE PEDIDO y el NOMBRE DEL TITULAR, nada más;
//  - ⛔ sin plazo de guardado («todavía no tengo fecha») ⇒ el 3º no promete fecha;
//  - ⛔ cadetería: la manejan por WhatsApp, persona por persona;
//  - al retirar sólo se cobra (⛔ venta en la Caja) ⇒ no hay ticket que se cruce.
//
// Reglas de la serie:
//  - ⛔ sin cupón, sin forma de pago, sin precios: confirman, no venden;
//  - 🔴 un bloque con un `${pedido.…}` sin dato SE CAE ENTERO (la fila «A PAGAR»
//    de quien ya pagó): por eso «qué traer» NO lleva el nombre adentro — si TN no
//    lo trajera se iría la fila entera. El nombre va en su propio renglón.
//  - el link a Maps es FIJO: la serie es de un solo local.
import { nuevoId, type Bloque, type ContenidoCampania } from '../lib/email/bloques.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Trozo } from '../lib/email/texto-rico.ts';
import type { MailNuevo } from './secuencia-bienvenida-5.ts';
import { NEGRO, BLANCO, GRIS, TEMA, WHATSAPP, volanta, titular, parrafo, boton, filete, banda, pieZattia } from './secuencia-bienvenida-zattia.ts';

export const PREFIJO_RETIRO = 'Retiro Z';

const MAPA = 'https://www.google.com/maps/search/?api=1&query=Santa%20Fe%201435%2C%20Rosario';
const RESENA_GOOGLE = 'https://g.page/r/CQU29bUL7sguEAI/review';
const GRIS_TEXTO = '#6b6b6b';
const GRIS_CLARO = '#bdbdbd';

/** Un renglón centrado: lo de adentro de la tarjeta negra. */
const centrado = (texto: string | Trozo[], estilo: Record<string, unknown>, caja: Record<string, unknown> = {}): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'center', texto,
  estilo: { titulo: estilo, caja: { padArriba: 0, padAbajo: 0, ...caja } },
} as Bloque);

/** La tarjeta NEGRA del 1º: «Ya podés pasar a buscarlo», el número grande y a nombre de quién. */
const tarjetaListo = (): Bloque =>
  banda(NEGRO, BLANCO, 32, [
    { id: nuevoId(), tipo: 'espaciador', alto: 22 } as Bloque,
    centrado('TU PEDIDO ESTÁ LISTO', { tamano: 10, peso: 700, espaciado: 2, color: GRIS_CLARO }),
    centrado('Ya podés pasar a buscarlo 🤍', { tamano: 20, peso: 400, espaciado: 2, interlinea: 1.25, mayusculas: true, color: BLANCO }, { padArriba: 8 }),
    centrado('#${pedido.numero}', { tamano: 28, peso: 700, espaciado: 4, color: BLANCO }, { padArriba: 12 }),
    // Se cae solo si TN no trae el nombre (ver arriba).
    centrado('A NOMBRE DE ${pedido.titular}', { tamano: 11, peso: 400, espaciado: 1, mayusculas: true, color: GRIS_CLARO }, { padArriba: 4 }),
    { id: nuevoId(), tipo: 'espaciador', alto: 22 } as Bloque,
  ]);

/** El camino del pedido: COMPRASTE · LISTO PARA RETIRAR · RETIRADO, con el paso actual en negro. */
const pasos = (actual: 1 | 2): Bloque[] => {
  const paso = (texto: string, i: number): Trozo[] => {
    const hecho = i < actual;
    const ahora = i === actual;
    return [{ t: `${hecho ? '✓' : ahora ? '●' : '○'} ${texto}`, peso: ahora ? 700 : 400, color: ahora ? NEGRO : hecho ? GRIS_TEXTO : GRIS_CLARO }];
  };
  return [
    filete(32),
    {
      id: nuevoId(), tipo: 'columnas', variante: 'textos', movil: 'fila',
      celdas: ['COMPRASTE', 'LISTO PARA RETIRAR', 'RETIRADO'].map((t, i) => ({ imagen: '', url: '', titulo: paso(t, i), texto: '' })),
      estilo: { titulo: { tamano: 9, espaciado: 1.5, align: 'left' }, caja: { padArriba: 6, padAbajo: 0 } },
    } as unknown as Bloque,
  ];
};

/** Un renglón de la ficha del retiro: el rótulo chico arriba y el dato abajo. */
const dato = (rotulo: string, texto: string | Trozo[]): Bloque => ({
  id: nuevoId(), tipo: 'texto', align: 'left',
  texto: [{ t: `${rotulo}\n`, tamano: 10, peso: 700, color: NEGRO }, ...(typeof texto === 'string' ? [{ t: texto }] : texto)],
  estilo: { cuerpo: { tamano: 14, interlinea: 1.5 }, caja: { padArriba: 10, padAbajo: 10 } },
} as Bloque);

/** DÓNDE · HORARIO · QUÉ TRAER (+ A PAGAR, que se cae sola si ya pagó), entre filetes. */
const fichaRetiro = (conPago: boolean): Bloque[] => [
  filete(32),
  dato('DÓNDE', [{ t: '${pedido.local}', peso: 700 }, { t: ' · ${pedido.direccion}' }]),
  filete(32),
  dato('HORARIO', '${pedido.horario}'),
  filete(32),
  dato('QUÉ TRAER', [{ t: 'Tu número de pedido, ' }, { t: '#${pedido.numero}', peso: 700 }, { t: ', y el nombre de quien hizo la compra.' }]),
  ...(conPago ? [
    // 🔴 Bloque PROPIO: sin efectivo pendiente se cae entero (`resolverPedidoEnBloques`).
    { ...dato('A PAGAR', [{ t: 'Abonás ' }, { t: '${pedido.efectivo}', peso: 700 }, { t: ' en efectivo al retirar.' }]) } as Bloque,
  ] : []),
  filete(32),
];

/** «TU PEDIDO #N» y las prendas, chicas y sin precio (vista `pedido` del carrito). */
const elPedido = (rotulo = 'TU PEDIDO #${pedido.numero}'): Bloque[] => [
  volanta(rotulo, NEGRO),
  {
    id: nuevoId(), tipo: 'carrito', items: [], vista: 'pedido',
    estilo: { titulo: { tamano: 12, peso: 400 }, imagen: { radio: 3 }, caja: { padArriba: 4, padAbajo: 4 } },
  } as unknown as Bloque,
];

const whatsapp = (antes: string): Bloque =>
  parrafo([{ t: antes }, { t: 'Escribinos por WhatsApp', url: WHATSAPP, subrayado: true }, { t: '.' }], { tamano: 14, color: GRIS_TEXTO });

/** El pie: 🤍, las redes en texto y por qué le llega (es un aviso, no una promo). */
const pie = (): Bloque[] => [
  ...pieZattia(),
  parrafo('Te llega porque compraste online en Zattia y elegiste retirar en el local.', { align: 'center', tamano: 11, color: GRIS_TEXTO }),
];

export interface MailRetiro extends MailNuevo {
  trigger: 'RETIRO_LISTO' | 'RETIRADO';
}

export function armarRetiroZattia(enc: Bloque): MailRetiro[] {
  // El logo chico de la tienda, sin la barra ni el menú de la bienvenida: es un aviso.
  const logo = (): Bloque => ({ ...structuredClone(enc), id: nuevoId(), linea: false, logoAncho: 40, barra: '', estilo: { caja: { padArriba: 0, padAbajo: 14 } } } as Bloque);
  const doc = (bloques: Bloque[]): ContenidoCampania => leerContenido({ v: V_ACTUAL, bloques, tema: TEMA });

  // ── 1 · al empaquetar: ya podés pasar ───────────────────────────────────────
  const mail1: Bloque[] = [
    logo(),
    tarjetaListo(),
    ...pasos(1),
    { id: nuevoId(), tipo: 'espaciador', alto: 10 } as Bloque,
    ...fichaRetiro(true),
    boton('CÓMO LLEGAR', MAPA),
    ...elPedido(),
    whatsapp('¿Dudas con tu pedido? '),
    ...pie(),
  ];

  // ── 2 · día 3: te estamos esperando ─────────────────────────────────────────
  const mail2: Bloque[] = [
    logo(),
    volanta('PEDIDO #${pedido.numero} · LISTO EN EL LOCAL', GRIS_TEXTO),
    { ...titular('Te estamos esperando') } as Bloque,
    parrafo('Tu pedido ya está separado con tu nombre. Pasá cuando te quede cómodo:'),
    { id: nuevoId(), tipo: 'espaciador', alto: 6 } as Bloque,
    ...fichaRetiro(true),
    boton('CÓMO LLEGAR', MAPA),
    ...pasos(1),
    ...elPedido(),
    ...pie(),
  ];

  // ── 3 · día 7: seguimos guardando tu pedido (⛔ sin plazo, ⛔ sin urgencia) ──
  const mail3: Bloque[] = [
    logo(),
    banda(GRIS, NEGRO, 32, [
      volanta('PEDIDO #${pedido.numero}', GRIS_TEXTO, 24),
      { ...titular('Seguimos guardando tu pedido'), estilo: { titulo: { tamano: 20, peso: 400, espaciado: 2, interlinea: 1.2, mayusculas: true }, caja: { padArriba: 6, padAbajo: 0, padX: 24 } } } as Bloque,
      parrafo('Está separado en el local, a tu nombre. Si se te complicó pasar, no pasa nada: escribinos y vemos juntas cómo hacemos.', { padX: 24 }),
      { id: nuevoId(), tipo: 'espaciador', alto: 18 } as Bloque,
    ]),
    boton('ESCRIBINOS', WHATSAPP),
    parrafo([{ t: 'Cómo llegar →', url: MAPA, subrayado: true }], { align: 'center', tamano: 13 }),
    { id: nuevoId(), tipo: 'espaciador', alto: 6 } as Bloque,
    ...fichaRetiro(false),
    ...elPedido(),
    ...pie(),
  ];

  // ── 4 · al retirar: gracias por pasar ───────────────────────────────────────
  const mail4: Bloque[] = [
    logo(),
    volanta('PEDIDO #${pedido.numero} · RETIRADO', GRIS_TEXTO),
    titular('¡Gracias por pasar! 🤍'),
    parrafo('Ojalá lo estrenes pronto. Te dejamos todo lo que necesitás para los cambios, por si hace falta.'),
    ...pasos(2), // el camino completo: RETIRADO es el paso actual
    filete(32),
    volanta('¿LO QUERÉS CAMBIAR?', NEGRO),
    {
      id: nuevoId(), tipo: 'columnas', variante: 'textos', movil: 'fila',
      celdas: [
        { imagen: '', url: '', titulo: 'Plazo', texto: '${tienda.plazoCambio}' },
        { imagen: '', url: '', titulo: 'Cómo', texto: 'Sin uso y con sus etiquetas.' },
        { imagen: '', url: '', titulo: 'Dónde', texto: [{ t: 'Se inician por ' }, { t: 'WhatsApp', url: WHATSAPP, subrayado: true }, { t: '.' }] },
      ],
      estilo: { titulo: { tamano: 10, peso: 700, mayusculas: true, espaciado: 1.5, align: 'left' }, cuerpo: { tamano: 13, align: 'left' }, caja: { padArriba: 6, padAbajo: 0 } },
    } as unknown as Bloque,
    parrafo('Accesorios y outlet no tienen cambio.', { tamano: 12, color: GRIS_TEXTO }),
    filete(32),
    ...elPedido('LO QUE TE LLEVASTE'),
    { id: nuevoId(), tipo: 'espaciador', alto: 14 } as Bloque,
    banda(GRIS, NEGRO, 32, [
      { id: nuevoId(), tipo: 'espaciador', alto: 20 } as Bloque,
      centrado('¿TE GUSTÓ LA EXPERIENCIA?', { tamano: 14, peso: 400, espaciado: 2, color: NEGRO }),
      parrafo('Nos ayuda muchísimo que nos recomiendes. Si tenés un minuto, contá cómo te fue en Google.', { align: 'center', tamano: 14, padX: 24 }),
      boton('DEJANOS TU RESEÑA EN GOOGLE', RESENA_GOOGLE),
      { id: nuevoId(), tipo: 'espaciador', alto: 18 } as Bloque,
    ]),
    ...pie(),
  ];

  const m = (n: number, nombre: string, trigger: MailRetiro['trigger'], esperaHoras: number, asunto: string, preheader: string, contenido: ContenidoCampania): MailRetiro => ({
    nombre: `${PREFIJO_RETIRO} ${n}/4 — ${nombre}`, trigger, esperaHoras, asunto, preheader, contenido, remitenteNombre: null, responderA: null,
  });

  return [
    m(1, 'listo para retirar', 'RETIRO_LISTO', 0, 'Tu pedido #${pedido.numero} está listo para retirar 🤍', 'Pasá por ${pedido.direccion}. ${pedido.horario}.', doc(mail1)),
    m(2, 'te estamos esperando', 'RETIRO_LISTO', 72, 'Te estamos esperando: tu pedido #${pedido.numero}', 'Tu pedido #${pedido.numero} ya está en el local. ${pedido.horario}.', doc(mail2)),
    m(3, 'seguimos guardando', 'RETIRO_LISTO', 168, 'Seguimos guardando tu pedido #${pedido.numero}', 'Está separado en el local, a tu nombre. Si no podés pasar, escribinos.', doc(mail3)),
    m(4, 'gracias por pasar', 'RETIRADO', 0, '¡Gracias por pasar! 🤍', 'Tus cambios, por si hacen falta. Y si te gustó, contanos en Google.', doc(mail4)),
  ];
}

