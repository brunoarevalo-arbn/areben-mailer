// La bienvenida de ZATTIA de CUATRO mails, sobre el mismo motor que la de BDI
// (`secuencia-bienvenida-5.ts`): hora fija, corte si compró y grupo de control.
// Lo usa `crear-bienvenida-5.ts --cuenta=zattia`.
//
// v3 (12-oct-2026): la propuesta del diseñador (`.mirar/bienvenida-zattia-v3/`), que
// Bruno aprobó («los veo bastante bien») después de rechazar la v2 hecha a mano:
// «quedó todo gigante, incluso las fotos», «fotos de personas no me convence», «lo de
// productos sí». ⇒ títulos a 20 px, logo chico, ⛔ ninguna portada de persona, y las
// PRENDAS de protagonistas en los cuatro.
//
// Decisiones de Bruno (12-oct):
//  - el código es 10% y vale SÓLO en la categoría NEW IN (Resorty: `targeting`
//    categorías) — lo que entra en oferta tiene que salir de NEW IN;
//  - ⛔ sin mail en texto plano: no hay quien conteste las respuestas ⇒ 4 y no 5.
//
// La voz y el aspecto salen de `docs/marca/zattia.md`: blanco y negro, títulos en
// MAYÚSCULAS a peso regular, botones negros con radio 4, de vos y en femenino, 🤍.
//
// Reglas de la serie (las de BDI):
//  - fuera del bloque `cupon` nada nombra el % — el «10% OFF» lo pone el `prizeLabel`
//    que manda Resorty en `destacado`;
//  - ⛔ no se usa el nombre (el pop-up pide sólo el mail);
//  - ⛔ no se inventa urgencia;
//  - el 4/4 sin código no tiene sentido ⇒ su cupón es `obligatorio`;
//  - 🔴 en ropa la duda SÍ es el talle (al revés que en BDI): se ofrece ayuda por WhatsApp.
//
// 🔑 Las prendas NO son fijas: son consultas a TN que se resuelven al enviar, y todas
// cruzan con NEW IN (`tambienEn`), que es donde vale el código. Para no repetir entre
// mails: el 1 y el 4 toman las más vendidas de NEW IN 0-3 y 4-7 (`saltear`); el 2 son
// estantes por tipo; el 3, un top (saltea los 4 del estante del 2) y denim.
//
// Se CLONA de la bienvenida vieja de Zattia el encabezado (el logo de la tienda).
import { nuevoId, type Bloque, type ContenidoCampania, type ItemLista } from '../lib/email/bloques.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Estilos } from '../lib/email/estilos.ts';
import type { Tema } from '../lib/email/tema.ts';
import type { Trozo } from '../lib/email/texto-rico.ts';
import type { MailNuevo } from './secuencia-bienvenida-5.ts';

export const PREFIJO_ZATTIA = 'Bienvenida Z';

// Exportadas: el carrito de Zattia (`secuencia-carrito-zattia.ts`) es de la MISMA familia.
export const NEGRO = '#000000';
export const BLANCO = '#ffffff';
export const GRIS = '#f3f3f3';
export const FILETE = '#e5e5e5';

/** Blanco y negro, Arial (Public Sans no está en los teléfonos: la regla es el PESO). */
export const TEMA: Tema = { base: 'claro', fondo: BLANCO, fondoContenido: BLANCO, acento: NEGRO, fuente: 'sistema' };

export const TIENDA = 'https://zattia.com.ar';
export const WHATSAPP = 'https://wa.me/5493416135024';
const utm = (ruta: string, dia: number, donde = 'cuerpo') =>
  `${TIENDA}/${ruta}?utm_source=mailer&utm_medium=email&utm_campaign=bienvenida-zattia-d${dia}&utm_content=${donde}`;

/** Las categorías de TN (IDs y rutas medidos el 12-oct-2026, después del reordenamiento del 23-sep). */
export const CAT = {
  newIn: { id: '26928851', ruta: 'new-in/' },
  tops: { id: '29904416', ruta: 'top-y-bodies/' },
  blusas: { id: '39694912', ruta: 'blusas/' },
  minis: { id: '29904417', ruta: 'faldas-y-shorts/' },
  denim: { id: '32058681', ruta: 'laundry-lab-denim/' },
  vestidos: { id: '29904420', ruta: 'vestidos/' },
} as const;

// ── Las piezas ────────────────────────────────────────────────────────────────

/** Rótulo chico en mayúsculas, a 700 y separado: «ZATTIA SQUAD». */
export const volanta = (texto: string, color = '$medio', padX?: number): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto,
  estilo: { titulo: { tamano: 10, peso: 700, espaciado: 2, color }, caja: { padArriba: 20, padAbajo: 0, ...(padX === undefined ? {} : { padX }) } },
} as Bloque);

/** El título: MAYÚSCULAS a peso REGULAR, a 20 px (con el tamaño elegido, el celular no lo agranda). */
export const titular = (texto: string | Trozo[]): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto,
  estilo: { titulo: { tamano: 20, peso: 400, espaciado: 2, interlinea: 1.2, mayusculas: true }, caja: { padArriba: 6, padAbajo: 0 } },
} as Bloque);

export const parrafo = (texto: string | Trozo[], extra: { align?: 'left' | 'center'; tamano?: number; color?: string; padX?: number } = {}): Bloque => ({
  id: nuevoId(), tipo: 'texto', align: extra.align ?? 'left', texto,
  estilo: {
    cuerpo: { tamano: extra.tamano ?? 15, interlinea: 1.5, ...(extra.color ? { color: extra.color } : {}) },
    caja: { padArriba: 10, padAbajo: 4, ...(extra.padX === undefined ? {} : { padX: extra.padX }) },
  },
} as Bloque);

/** El botón de la tienda: negro, radio 4, en mayúsculas. */
export const boton = (texto: string, url: string): Bloque => ({
  id: nuevoId(), tipo: 'boton', texto, url, align: 'center', full: false,
  estilo: { boton: { tamano: 13, peso: 700, espaciado: 2, radio: 4, padY: 15, padX: 30 }, caja: { padArriba: 18, padAbajo: 6 } },
} as Bloque);

/** El rótulo de sección con su link a la derecha: «PARA EMPEZAR ······ TODO NEW IN →». */
export const rotulo = (texto: string, link: string, url: string): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto, link: { texto: link, url },
  estilo: { titulo: { tamano: 13, peso: 400, espaciado: 2, mayusculas: true }, caja: { padArriba: 26, padAbajo: 4 } },
} as Bloque);

/** Un filete gris de 1 px (el del menú, a 16 px del borde, y el de la fila de servicio). */
export const filete = (padX = 16): Bloque => ({
  id: nuevoId(), tipo: 'divisor',
  estilo: { caja: { bordeColor: FILETE, padArriba: 0, padAbajo: 0, padX } },
} as Bloque);

/** La tarjeta de producto de la tienda: nombre en MAYÚSCULAS a 400, precio en negrita, foto sin esquinas. */
export const ESTILO_GRILLA: Estilos = {
  cuerpo: { tamano: 11, espaciado: 1, mayusculas: true, peso: 400 },
  precio: { tamano: 12, peso: 700 },
  imagen: { radio: 0 },
  caja: { padArriba: 4, padAbajo: 4 },
};

/** Cuatro prendas: en fila en la compu, 2×2 en el celular. Siempre cruzadas con NEW IN. */
export const grilla = (fuente: 'destacados' | 'categoria', extra: { categoriaId?: string; saltear?: number } = {}): Bloque => ({
  id: nuevoId(), tipo: 'productos-dinamicos', fuente, n: 4, porFila: 4, dosPorDos: true,
  ...(fuente === 'categoria' ? { categoriaId: CAT.newIn.id, tambienEn: extra.categoriaId } : { tambienEn: CAT.newIn.id }),
  ...(extra.saltear ? { saltear: extra.saltear } : {}),
  estilo: ESTILO_GRILLA,
} as unknown as Bloque);

/** El cupón del filete fino: rótulo · premio, el código grande y la letra chica. */
const cuponFilete = (color: string, extra: { obligatorio?: boolean; botonTexto?: string; botonUrl?: string } = {}): Bloque => ({
  id: nuevoId(), tipo: 'cupon', variante: 'grande', texto: 'Tu código de bienvenida', destacado: '',
  codigo: 'TUCUPON', botonTexto: '', botonUrl: '', condiciones: 'Válido hasta ${cupon.venceLargo}',
  ...extra,
  estilo: { caja: { bordeColor: color }, boton: { tamano: 13, peso: 700, espaciado: 2, radio: 4, padY: 15, padX: 30 } },
} as Bloque);

/** El cupón en un renglón gris (los mails del medio: acompaña, no grita). */
const cuponGris = (): Bloque => ({
  id: nuevoId(), tipo: 'cupon', variante: 'barra', texto: 'Tu código', destacado: '',
  codigo: 'TUCUPON', botonTexto: '', botonUrl: '', condiciones: 'hasta el ${cupon.vence}',
  estilo: { caja: { fondo: GRIS, padArriba: 4 } },
} as Bloque);

export const banda = (fondo: string, acento: string, margen: number, bloques: Bloque[]): Bloque => ({
  id: nuevoId(), tipo: 'banda', fondo, acento, margen, bloques,
} as unknown as Bloque);

/**
 * La cabecera «de tienda»: la franja de datos, el logo chico y el menú entre dos
 * filetes. `enc` es el encabezado clonado de un mail de Zattia (el logo de la
 * tienda); `link` arma la URL de cada categoría del menú con SU utm.
 */
export const cabeceraZattia = (enc: Bloque, link: (ruta: string) => string): Bloque[] => [
  {
    ...structuredClone(enc), id: nuevoId(), linea: false, logoAncho: 44,
    barra: 'Envío gratis desde ${tienda.envioGratis} · Despacho en ${tienda.plazoDespacho}',
    estilo: { caja: { padArriba: 0, padAbajo: 14 } },
  } as Bloque,
  filete(),
  {
    id: nuevoId(), tipo: 'menu',
    links: [['NEW IN', CAT.newIn.ruta], ['TOPS', CAT.tops.ruta], ['BLUSAS', CAT.blusas.ruta], ['VESTIDOS', CAT.vestidos.ruta], ['DENIM', CAT.denim.ruta]]
      .map(([texto, ruta]) => ({ texto, url: link(ruta) })),
    estilo: { cuerpo: { tamano: 11, peso: 700, espaciado: 2 }, caja: { padArriba: 8, padAbajo: 8 } },
  } as Bloque,
  filete(),
];

/** El pie de marca: 🤍 y las redes en TEXTO (los iconos eran lo único con color de la marca). */
export const pieZattia = (): Bloque[] => [
  { id: nuevoId(), tipo: 'espaciador', alto: 16 } as Bloque,
  parrafo('🤍', { align: 'center', tamano: 18 }),
  {
    id: nuevoId(), tipo: 'redes', iconos: 'texto',
    links: [
      { red: 'Instagram', url: 'https://instagram.com/zattia_co' },
      { red: 'TikTok', url: 'https://www.tiktok.com/@zattia' },
      { red: 'WhatsApp', url: WHATSAPP },
    ],
    estilo: { cuerpo: { tamano: 10, peso: 700, espaciado: 2, mayusculas: true, color: NEGRO }, caja: { padArriba: 0, padAbajo: 4 } },
  } as unknown as Bloque,
];

export function armarBienvenidaZattia(vieja: { contenido: unknown }): MailNuevo[] {
  const base = leerContenido(vieja.contenido);
  const enc = base.bloques.find((x) => x.tipo === 'encabezado');
  if (!enc) throw new Error('falta el encabezado en la bienvenida vieja de Zattia');

  const cabecera = (dia: number): Bloque[] => cabeceraZattia(enc, (ruta) => utm(ruta, dia, 'menu'));
  const pie = pieZattia;

  const doc = (bloques: Bloque[]): ContenidoCampania => leerContenido({ v: V_ACTUAL, bloques, tema: TEMA });

  // ── 1 · al instante: el código y las cuatro más elegidas de NEW IN ─────────
  const mail1: Bloque[] = [
    ...cabecera(0),
    volanta('ZATTIA SQUAD'),
    titular('Bienvenida a Zattia 🤍'),
    parrafo('Somos la amiga con buen gusto. Lo nuevo de la temporada entra primero acá, y para estrenarlo te dejamos esto:'),
    cuponFilete(NEGRO),
    boton('VER NEW IN', utm(CAT.newIn.ruta, 0, 'boton')),
    rotulo('Para empezar', 'Todo new in →', utm(CAT.newIn.ruta, 0, 'rotulo')),
    grilla('destacados'),
    { id: nuevoId(), tipo: 'espaciador', alto: 8 } as Bloque,
    filete(32),
    {
      id: nuevoId(), tipo: 'columnas', variante: 'textos', movil: 'fila',
      celdas: [
        { imagen: '', url: '', titulo: 'Despacho', texto: 'en ${tienda.plazoDespacho}' },
        { imagen: '', url: '', titulo: 'Envío gratis', texto: 'desde ${tienda.envioGratis}' },
        { imagen: '', url: '', titulo: 'Cambios', texto: '${tienda.plazoCambio}' },
      ],
      estilo: { titulo: { tamano: 10, peso: 700, mayusculas: true, espaciado: 2, align: 'center' }, cuerpo: { tamano: 12, color: '$medio', align: 'center' }, caja: { padArriba: 4, padAbajo: 0 } },
    } as unknown as Bloque,
    filete(32),
    ...pie(),
  ];

  // ── 2 · día 2: tres estantes de NEW IN por tipo de prenda ──────────────────
  const estante = (nombre: string, cat: { id: string; ruta: string }): Bloque[] => [
    rotulo(nombre, 'Ver más →', utm(cat.ruta, 2, 'estante')),
    grilla('categoria', { categoriaId: cat.id }),
  ];
  const mail2: Bloque[] = [
    ...cabecera(2),
    { id: nuevoId(), tipo: 'espaciador', alto: 14 } as Bloque,
    cuponGris(),
    volanta('NEW IN'),
    titular('Recién llegado'),
    parrafo('Tops, blusas y minis de la temporada. Cada una, puesta en una persona real para que veas cómo queda.'),
    ...estante('Tops', CAT.tops),
    ...estante('Blusas', CAT.blusas),
    ...estante('Minis', CAT.minis),
    boton('VER TODO NEW IN', utm(CAT.newIn.ruta, 2, 'boton')),
    ...pie(),
  ];

  // ── 3 · día 4: cómo es comprar, contado sobre UNA prenda ───────────────────
  // 🔴 En ropa la duda es el TALLE: el 01 lo resuelve por WhatsApp. El top saltea los
  // cuatro del estante del 2/4 para no repetir.
  const ficha: ItemLista[] = [
    { titulo: 'Talle', texto: '¿Dudas? Escribinos por WhatsApp y te ayudamos a elegir.', url: WHATSAPP },
    { titulo: 'Despacho', texto: 'En ${tienda.plazoDespacho}, a todo el país.' },
    { titulo: 'Envío', texto: 'Gratis desde ${tienda.envioGratis}.' },
    { titulo: 'Cambio', texto: 'Tenés ${tienda.plazoCambio}: sin uso y con la etiqueta puesta.' },
  ];
  const mail3: Bloque[] = [
    ...cabecera(4),
    { id: nuevoId(), tipo: 'espaciador', alto: 14 } as Bloque,
    cuponGris(),
    volanta('CÓMO ES COMPRAR'),
    titular('Del carrito a tu casa'),
    parrafo('Te lo contamos con una prenda de NEW IN:'),
    {
      id: nuevoId(), tipo: 'productos-dinamicos', fuente: 'categoria', categoriaId: CAT.newIn.id, tambienEn: CAT.tops.id, saltear: 4, n: 1, ficha,
      estilo: { ...ESTILO_GRILLA, caja: { padArriba: 14, padAbajo: 4 } },
    } as unknown as Bloque,
    boton('CONSULTAR MI TALLE', WHATSAPP),
    banda(GRIS, NEGRO, 32, [
      volanta('EL LOCAL', NEGRO, 20),
      parrafo('**${tienda.local}**. Pasá a probarte lo que te guste antes de llevarlo.', { tamano: 14, padX: 20 }),
    ]),
    rotulo('Para combinarlo', 'Todo denim →', utm(CAT.denim.ruta, 4, 'rotulo')),
    grilla('categoria', { categoriaId: CAT.denim.id }),
    ...pie(),
  ];

  // ── 4 · día 6: tu código vence mañana ───────────────────────────────────────
  const mail4: Bloque[] = [
    ...cabecera(6),
    banda(NEGRO, BLANCO, 16, [
      volanta('ÚLTIMO AVISO', '#bdbdbd'),
      titular('Tu código vence mañana'),
      parrafo('Es el mismo de la bienvenida. Se carga en el checkout, en las prendas de NEW IN.', { color: BLANCO }),
      cuponFilete(BLANCO, { obligatorio: true, botonTexto: 'USAR MI CÓDIGO', botonUrl: utm(CAT.newIn.ruta, 6, 'cupon') }),
    ]),
    rotulo('Todavía en NEW IN', 'Ver todo →', utm(CAT.newIn.ruta, 6, 'rotulo')),
    grilla('destacados', { saltear: 4 }),
    parrafo([
      { t: '¿Dudas con el talle? ' },
      { t: 'Escribinos por WhatsApp', url: WHATSAPP, subrayado: true },
      { t: ' y te ayudamos.' },
    ], { tamano: 14 }),
    ...pie(),
  ];

  const m = (n: number, nombre: string, esperaHoras: number, asunto: string, preheader: string, contenido: ContenidoCampania): MailNuevo => ({
    nombre: `${PREFIJO_ZATTIA} ${n}/4 — ${nombre}`, esperaHoras, asunto, preheader, contenido, remitenteNombre: null, responderA: null,
  });

  return [
    m(1, 'el código', 0, 'Bienvenida a Zattia 🤍 tu código está adentro', 'Para estrenar lo nuevo de la temporada. Vale hasta el ${cupon.vence}.', doc(mail1)),
    m(2, 'new in', 48, 'Recién llegado: tops, blusas y minis', 'Tops, blusas y minis de la temporada, puestos en una persona real.', doc(mail2)),
    m(3, 'cómo es comprar', 96, 'Cómo es comprar en Zattia', 'Despacho rápido, ayuda con el talle y cambios sin vueltas.', doc(mail3)),
    m(4, 'tu código vence mañana', 144, 'Tu código vence mañana', 'Es el mismo de la bienvenida. Después de mañana deja de andar.', doc(mail4)),
  ];
}
