// La bienvenida de BDI de CINCO mails (diseño aprobado el 11-oct-2026), armada con
// las piezas del motor que nacieron para ella el 12-oct. Lo usa
// `crear-bienvenida-5.ts`, que la dibuja con un lead real y la escribe en la base.
//
// De dónde sale cada mail: `docs/disenio/bienvenida-bdi/` (`mail-N.html`, las
// capturas y el LEEME). Las piezas:
//  - el cupón en BARRA arriba de todo (1, 3, 4) y GRANDE sobre negro (5);
//  - las fotos de a dos AL RAS de los márgenes del texto (`columnas.pegadas`);
//  - la tabla de categorías 2×3, los ESCALONES y los PASOS (bloque `lista`);
//  - el pie de marca compartido (franja negra + menú + redes), igual en los cinco;
//  - el vencimiento con `${cupon.vence}` / `${cupon.venceLargo}`.
//
// Reglas de la serie que el armado respeta:
//  - fuera del bloque `cupon` nada nombra el % (el premio varía: 10 o 15) — el
//    premio lo pone `aplicarCuponDelTrigger` en `destacado`, que los cupones de
//    acá DECLARAN (vacío) para que el premio no pise el rótulo;
//  - ⛔ no se usa el nombre (0% de los leads lo tiene);
//  - ⛔ nunca «si no te queda»: la funda siempre entra, el riesgo es que no guste;
//  - el 3/5 cuenta la escalera de Resorty «hasta el 31/10» ⇒ `saleHasta`;
//  - el 5/5 sin código no tiene sentido ⇒ su cupón es `obligatorio`.
//
// 🔑 Se CLONAN de la bienvenida de hoy (`cms6kpmqg…`) el encabezado (el logo ya
// recortado) y las redes, con id NUEVO. Los datos de la tienda van como
// `${tienda.…}`: ⛔ ningún número a mano.
import { nuevoId, type Bloque, type ContenidoCampania, type ItemLista } from '../lib/email/bloques.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Tema } from '../lib/email/tema.ts';
import type { Trozo } from '../lib/email/texto-rico.ts';

export const PREFIJO = 'Bienvenida 5';

export interface MailNuevo {
  nombre: string;
  esperaHoras: number;
  asunto: string;
  preheader: string | null;
  contenido: ContenidoCampania;
  remitenteNombre: string | null;
  responderA: string | null;
}

const NEGRO = '#1b1717';
const MAGENTA = '#e40044';
const CLARITO = '#f5f3f3';

/** El de toda la serie: Montserrat, el casi negro de la tienda y blanco (mismo que «Carrito v2 · B»). */
const TEMA: Tema = { base: 'claro', fondo: '#ffffff', fondoContenido: '#ffffff', acento: NEGRO, fuente: 'montserrat' };

const clon = <T extends Bloque>(b: T): T => ({ ...structuredClone(b), id: nuevoId() });

function tomar(bloques: Bloque[], que: string, pred: (b: Bloque) => boolean): Bloque {
  const b = bloques.find(pred);
  if (!b) throw new Error(`falta en la bienvenida de hoy: ${que}`);
  return clon(b);
}

const TIENDA = 'https://bdiaccesorios.com.ar';
const utm = (ruta: string, dia: number, donde = 'cuerpo') =>
  `${TIENDA}/${ruta}?utm_source=mailer&utm_medium=email&utm_campaign=bienvenida-bdi-d${dia}&utm_content=${donde}`;
const FOTO = (slug: string, ancho = 640) => `https://acdn-us.mitiendanube.com/stores/001/096/065/products/${slug}-${ancho}-0.jpg`;

// Fotos de ambiente de la Moods Collection (las de las fichas de TN, casi todas de
// IA). Bruno (11-oct): SÍ usarlas, y mezcladas: ninguna se repite entre mails.
// Todas 640×800 (4:5, medido): de a dos quedan del mismo alto.
type Foto = [url: string, alt: string];
const PERIWINKLE: Foto = [FOTO('periwinkle-gem-087d0f45f04c4bda8517895835134723'), 'Selfie en el espejo con la Periwinkle Case, cuadrillé celeste'];
const ROSIE: Foto = [FOTO('rosie-matcha-aa034d40673b585f7417895827133620'), 'Rosie Case rosa en la mano, con un matcha'];
const STRIPE3: Foto = [FOTO('stripe-case-2-42397b9d7c442491a617893963446537'), 'Tres Stripe Case paradas en fila'];
const DUSK3: Foto = [FOTO('3-cases-ffff134e2ca25b69a717895830679521'), 'Bambi, Night y Dusk Case'];
const STARDUST: Foto = [FOTO('stardust-gem-ef1b30e6697c0a197a17895835890117'), 'Stardust Case con cartera fucsia y auriculares'];
const AQUA: Foto = [FOTO('aqua-gem-d7b139db888b12329e17895837341091'), 'Aqua Case celeste en la mano'];
const NIGHT: Foto = [FOTO('gemini_generated_image_rc5bo2rc5bo2rc5b-592a4145ce2db0a49f17895828328401'), 'Night y Mocca Heart Case bajo una campana de plata'];
const STRIPECUP: Foto = [FOTO('stripe-gem-3018b5123ec1f2255817895842372115'), 'Stripe Case apoyada en una taza naranja'];

/** La categoría de la Moods Collection en TN (de ahí salen los productos del 3/5). */
const CAT_MOODS = '40994831';

// ── Las piezas ────────────────────────────────────────────────────────────────

/** Rótulo chico en mayúsculas, separado: «BDI MEMBER». */
const volanta = (texto: string, color = '$medio'): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto,
  estilo: { titulo: { tamano: 11, peso: 700, espaciado: 2, color }, caja: { padArriba: 18, padAbajo: 0 } },
} as Bloque);

/** El título de colección de la tienda: bold italic, apretado, a la izquierda. */
const titular = (texto: string | Trozo[], tamano = 30): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto,
  estilo: { titulo: { tamano, peso: 800, italica: true, espaciado: -1, interlinea: 1.1 }, caja: { padArriba: 6, padAbajo: 0 } },
} as Bloque);

const parrafo = (texto: string | Trozo[], extra: { align?: 'left' | 'center'; tamano?: number } = {}): Bloque => ({
  id: nuevoId(), tipo: 'texto', align: extra.align ?? 'left', texto,
  estilo: { cuerpo: { tamano: extra.tamano ?? 16, interlinea: 1.45 }, caja: { padArriba: 12, padAbajo: 4 } },
} as Bloque);

/** La pastilla negra de la tienda. */
const boton = (texto: string, url: string): Bloque => ({
  id: nuevoId(), tipo: 'boton', texto, url, align: 'center', full: false,
  estilo: { boton: { tamano: 13, peso: 700, espaciado: 1, radio: 30, padY: 17, padX: 44 }, caja: { padArriba: 20, padAbajo: 8 } },
} as Bloque);

/**
 * El cupón de la barra de arriba. `destacado: ''` es a propósito: declara el lugar
 * del premio, y `aplicarCuponDelTrigger` pone ahí el «10% OFF» que ganó la persona
 * en vez de pisar el rótulo. `TUCUPON` nunca sale: sin código el bloque se borra.
 */
const barra = (): Bloque => ({
  id: nuevoId(), tipo: 'cupon', variante: 'barra', texto: 'Tu código de bienvenida', destacado: '',
  codigo: 'TUCUPON', botonTexto: '', botonUrl: '', condiciones: 'hasta el ${cupon.vence}',
  estilo: { caja: { padArriba: 0 } },
} as Bloque);

/** Dos fotos 4:5 lado a lado, al ras de los márgenes del texto, sin redondeo. */
const dosFotos = (a: Foto, b: Foto, url: string): Bloque => ({
  id: nuevoId(), tipo: 'columnas', variante: 'imagenes', movil: 'fila', pegadas: 8,
  celdas: [
    { imagen: a[0], url, titulo: '', texto: '' },
    { imagen: b[0], url, titulo: '', texto: '' },
  ],
  estilo: { imagen: { radio: 0 }, caja: { padArriba: 20, padAbajo: 4 } },
} as unknown as Bloque);

/** Una franja con bloques adentro (fondo y acento propios). */
const banda = (fondo: string, acento: string, bloques: Bloque[]): Bloque => ({
  id: nuevoId(), tipo: 'banda', fondo, acento, bloques,
} as unknown as Bloque);

const lista = (variante: 'pasos' | 'escalones' | 'categorias', items: ItemLista[], rotulo?: string): Bloque => ({
  id: nuevoId(), tipo: 'lista', ...(variante === 'pasos' ? {} : { variante }), ...(rotulo ? { rotulo } : {}), items,
} as Bloque);

/** Una opinión de Google sobre negro: la comilla magenta y la cita en bold italic. */
const opinion = (cita: string, quien: string): Bloque[] => [
  {
    id: nuevoId(), tipo: 'texto', align: 'left',
    texto: [{ t: '“', tamano: 40, peso: 800, color: MAGENTA }, { t: `\n${cita}`, tamano: 19, peso: 700, italica: true }],
    estilo: { cuerpo: { interlinea: 1.4, color: '$texto' }, caja: { padArriba: 14, padAbajo: 0 } },
  } as Bloque,
  {
    id: nuevoId(), tipo: 'texto', align: 'left', texto: `${quien} · OPINIÓN EN GOOGLE`,
    estilo: { cuerpo: { tamano: 10, espaciado: 2, color: '$tenue' }, caja: { padArriba: 6, padAbajo: 10 } },
  } as Bloque,
];

export function armarBienvenida5(vieja: { contenido: unknown }): MailNuevo[] {
  const base = leerContenido(vieja.contenido);
  const b = base.bloques;
  const encabezado = () => tomar(b, 'el encabezado', (x) => x.tipo === 'encabezado');

  /**
   * 🔑 El PIE DE MARCA, igual en los cinco (Burga): la franja negra con los datos
   * de la tienda, las categorías en texto y las redes. Después lo cierra el pie
   * legal del motor (baja + domicilio), que no es un bloque.
   */
  const pie = (dia: number): Bloque[] => [
    { id: nuevoId(), tipo: 'espaciador', alto: 24 } as Bloque,
    banda(NEGRO, '#ffffff', [{
      id: nuevoId(), tipo: 'titulo', align: 'center', texto: 'Envío gratis desde ${tienda.envioGratis} · ${tienda.cuotas}',
      estilo: { titulo: { tamano: 10, peso: 600, espaciado: 2, mayusculas: true }, caja: { padY: 0 } },
    } as Bloque]),
    {
      id: nuevoId(), tipo: 'menu',
      links: [['NEW IN', 'new-in/'], ['FUNDAS', 'fundas/'], ['CARGADORES', 'cargadores/'], ['SMARTWATCH', 'smartwatch/'], ['OFERTAS', 'ofertas/']]
        .map(([texto, ruta]) => ({ texto, url: utm(ruta, dia, 'pie') })),
    } as Bloque,
    tomar(b, 'las redes', (x) => x.tipo === 'redes'),
  ];

  const doc = (bloques: Bloque[], extra: Partial<ContenidoCampania> = {}): ContenidoCampania =>
    leerContenido({ v: V_ACTUAL, bloques, tema: TEMA, ...extra });

  // ── 1 · al instante: el código, las fotos y por dónde empezar ───────────────
  const mail1: Bloque[] = [
    encabezado(),
    barra(),
    volanta('BDI MEMBER'),
    // Título con dos tipografías: «YA SOS» recto y chico, «parte del club.» en el
    // bold italic de la tienda.
    // ⚠️ La itálica va en el TROZO y no en el bloque: un `italica:false` de trozo no
    // apaga la del bloque (no se emite `font-style:normal`).
    { ...titular([{ t: 'YA SOS ', tamano: 22, peso: 700 }, { t: 'parte del club.', italica: true }]), estilo: { titulo: { tamano: 30, peso: 800, espaciado: -1, interlinea: 1.1 }, caja: { padArriba: 6, padAbajo: 0 } } } as Bloque,
    parrafo('Fundas, cargadores y accesorios que no vas a ver en otro lado. Tu código está arriba de todo: usalo en tu primera compra, en lo que quieras de la tienda.'),
    dosFotos(PERIWINKLE, ROSIE, utm('', 0, 'fotos')),
    boton('VER TODA LA TIENDA', utm('', 0, 'boton')),
    titular('Elegí por dónde empezar', 22),
    lista('categorias', [
      { titulo: 'New in', texto: 'Lo último que entró', imagen: FOTO('chelsea-case-a7d0f5c64bb50dfd7117857959569971', 480), url: utm('new-in/', 0, 'categorias') },
      { titulo: 'Moods Collection', texto: 'La colección nueva', imagen: FOTO('bambi-case-9e71c12528e030641117891343561760', 480), url: utm('fundas/moods-collection/', 0, 'categorias') },
      { titulo: 'Fundas', texto: 'Para cada iPhone', imagen: FOTO('mocca-heart-case-205331bcee388f589917891337418334', 480), url: utm('fundas/', 0, 'categorias') },
      { titulo: 'Cargadores', texto: 'Carga rápida', imagen: FOTO('enchufe-bdi-6b7b20395f2716d9f617695271831599', 480), url: utm('cargadores/', 0, 'categorias') },
      { titulo: 'Smartwatch', texto: 'Relojes y mallas', imagen: FOTO('active-gris-253beb480c65f57c8417696074226101', 480), url: utm('smartwatch/', 0, 'categorias') },
      { titulo: 'Ofertas', texto: 'Precios bajados', imagen: FOTO('blur-570705150f9101e6e317435323376266', 480).replace(/\.jpg$/, '.png'), url: utm('ofertas/', 0, 'categorias') },
    ]),
    // Los tres datos de la tienda, en texto: sin íconos, no compiten con las fotos.
    {
      id: nuevoId(), tipo: 'columnas', variante: 'textos', movil: 'fila', pegadas: 12,
      celdas: [
        { imagen: '', url: '', titulo: 'Despacho', texto: 'en ${tienda.plazoDespacho}' },
        { imagen: '', url: '', titulo: 'Cambios', texto: '${tienda.plazoCambio}' },
        { imagen: '', url: '', titulo: 'Local', texto: '${tienda.local}, Rosario' },
      ],
      estilo: { titulo: { tamano: 11, peso: 700, mayusculas: true, espaciado: 1 }, cuerpo: { tamano: 12, color: '$medio' }, caja: { padArriba: 16 } },
    } as unknown as Bloque,
    ...pie(0),
  ];

  // ── 2 · día 1: la historia, en texto plano, firmada por Bruno ───────────────
  // Texto de `docs/disenio/bienvenida-bdi/mail-2.txt` (dictado por Bruno y ajustado
  // con Darío el 11-oct). El código SOLO en su renglón (`renglon`, pedido de Darío).
  const p = (texto: string): Bloque => ({ id: nuevoId(), tipo: 'texto', texto } as Bloque);
  const mail2: Bloque[] = [
    p('Hola,'),
    p('Soy Bruno. Arrancamos BDI Accesorios en 2016, y hoy la llevamos adelante con mi hermano mellizo.'),
    p('Al principio queríamos algo simple: proteger el celular. Pero con el tiempo nos dimos cuenta de que la funda es lo que más tenemos en la mano durante el día, y que podíamos ser mucho más que solo eso.'),
    p('Desde entonces hacemos **moda en fundas**. Cada colección la pensamos y la diseñamos mirando las tendencias de cada temporada, para que tu funda sea una parte más del outfit. La funda dejó de ser algo que comprás una vez: ahora la cambiás como cambiás de look.'),
    p('Más de **100.000** personas ya nos eligieron, y hoy somos más que una marca: somos una comunidad.'),
    {
      id: nuevoId(), tipo: 'cupon', variante: 'renglon', destacado: '',
      // Una sola oración: sin `vence` (TN no lo trajo) se cae la frase con la
      // fecha y el código queda solo, que igual se entiende por el párrafo de arriba.
      texto: 'Gracias por sumarte. Tu código de bienvenida sigue vigente hasta el ${cupon.vence}:',
      codigo: 'TUCUPON', botonTexto: '', botonUrl: '',
    } as Bloque,
    { id: nuevoId(), tipo: 'texto', texto: [{ t: 'Las colecciones están acá: ' }, { t: 'bdiaccesorios.com.ar', url: utm('', 1, 'firma') }] } as Bloque,
    p('Bruno\nCofundador de BDI'),
    p('P.D.: si no sabés cuál elegir para tu modelo de celular, respondeme este mail y te ayudo.'),
  ];

  // ── 3 · día 2: la escalera de Resorty ───────────────────────────────────────
  // 🔴 La escalera corre hasta el 31-oct: después el mail NO SALE (`saleHasta`).
  // Si Bruno la extiende en Resorty, hay que correr la fecha de acá y el texto.
  const mail3: Bloque[] = [
    encabezado(),
    barra(),
    volanta('CUANTAS MÁS LLEVÁS'),
    titular('Una funda para cada outfit.'),
    parrafo('Hasta el 31/10 las fundas tienen descuento por cantidad: la segunda y la tercera salen más baratas. Para cambiarla como cambiás de look, o para regalarle una a una amiga.'),
    dosFotos(STRIPE3, DUSK3, utm('fundas/', 2, 'fotos')),
    banda(CLARITO, MAGENTA, [
      lista('escalones', [
        { numero: '2', titulo: 'Fundas', texto: 'la segunda, −20%' },
        { numero: '3', titulo: 'Fundas', texto: 'la segunda −20% y la tercera −30%', sello: 'Más elegido' },
      ], 'Llevando'),
      {
        id: nuevoId(), tipo: 'texto', align: 'left',
        texto: 'Combinás **diseños y modelos de iPhone distintos**. Se aplica solo en el carrito, y se suma a tu código.',
        estilo: { cuerpo: { tamano: 13, interlinea: 1.45 } },
      } as Bloque,
    ]),
    boton('ARMAR MI COMBO', utm('fundas/', 2, 'boton')),
    titular('Lo nuevo: Moods Collection', 22),
    {
      id: nuevoId(), tipo: 'productos-dinamicos', fuente: 'categoria', categoriaId: CAT_MOODS, n: 3, porFila: 3, movil: 2, precioOculto: true,
      estilo: { cuerpo: { peso: 600, align: 'center' } },
    } as unknown as Bloque,
    ...pie(2),
  ];

  // ── 4 · día 4: por qué BDI ──────────────────────────────────────────────────
  // Opiniones TEXTUALES de Google (Tiara B. y Thiago A.); ⛔ sin el puntaje (3,7).
  // Las fotos van ARRIBA de las opiniones pero separadas por la franja: son de la
  // colección (de IA), no de esas clientas.
  const mail4: Bloque[] = [
    encabezado(),
    barra(),
    volanta('POR QUÉ BDI'),
    titular('Lo cuentan quienes ya compraron.'),
    dosFotos(STARDUST, AQUA, utm('', 4, 'fotos')),
    banda(NEGRO, MAGENTA, [
      ...opinion('Me pedí una funda por la página, yo soy de Capital. Excelente cómo llegó y lo más importante: la funda hermosa, el color lo que es.', 'TIARA B.'),
      ...opinion('Envíos súper rápidos, buena comunicación y hermosa experiencia comprando en BDI.', 'THIAGO A.'),
    ]),
    titular('Cómo es comprar en BDI', 22),
    // La franja blanca sólo para darle el MAGENTA de acento a los números: el
    // tema de la serie tiene el negro de acento (los botones).
    banda('#ffffff', MAGENTA, [
      lista('pasos', [
        { titulo: 'Despachamos en ${tienda.plazoDespacho}', texto: 'A todo el país. Envío gratis desde ${tienda.envioGratis}.' },
        { titulo: 'Pagás como te quede cómodo', texto: '${tienda.cuotas} en toda la tienda.' },
        { titulo: '¿Y si no te gusta? La cambiás', texto: 'Tenés ${tienda.plazoCambio}. Escribinos y lo resolvemos.' },
      ]),
    ]),
    boton('VER LOS MÁS VENDIDOS', utm('', 4, 'boton')),
    parrafo([{ t: 'Y si estás en Rosario, venite. ', peso: 700 }, { t: 'Estamos en ${tienda.local}: ves todas las fundas en la mano antes de elegir.' }], { tamano: 14 }),
    ...pie(4),
  ];

  // ── 5 · día 6: tu código vence mañana ───────────────────────────────────────
  // El MISMO código, ⛔ sin descuento extra (escalar enseña a esperar). Sin código
  // este mail no tiene sentido ⇒ `obligatorio`: el procesador lo SALTA.
  const mail5: Bloque[] = [
    encabezado(),
    banda(NEGRO, '#ffffff', [
      volanta('ÚLTIMO DÍA', '$medio'),
      titular('Tu código vence mañana.', 32),
      parrafo('Es el mismo que te dimos el primer día. Se carga en el checkout, en cualquier producto de la tienda.'),
      {
        id: nuevoId(), tipo: 'cupon', variante: 'grande', obligatorio: true, texto: 'Tu código', destacado: '',
        codigo: 'TUCUPON', botonTexto: 'USAR MI CÓDIGO', botonUrl: utm('', 6, 'cupon'),
        condiciones: 'Válido hasta ${cupon.venceLargo} · un solo uso',
        estilo: { boton: { tamano: 13, peso: 700, espaciado: 1, radio: 30, padY: 17, padX: 44 } },
      } as Bloque,
    ]),
    dosFotos(NIGHT, STRIPECUP, utm('', 6, 'fotos')),
    parrafo('¿Te falta decidir el modelo? Respondé este mail y te ayudamos a elegir.', { align: 'center' }),
    ...pie(6),
  ];

  const m = (n: number, nombre: string, esperaHoras: number, asunto: string, preheader: string | null, contenido: ContenidoCampania, firma = false): MailNuevo => ({
    nombre: `${PREFIJO} ${n}/5 — ${nombre}`,
    esperaHoras,
    asunto,
    preheader,
    contenido,
    remitenteNombre: firma ? 'Bruno de BDI' : null,
    responderA: firma ? 'brunoarevalo@arebensrl.com' : null,
  });

  return [
    m(1, 'el código', 0, 'Ya sos parte del club: tu código está adentro', 'Tu código ya está adentro: usalo en tu primera compra. Vale 7 días.', doc(mail1)),
    // Asunto en minúscula y distinto del carrito («¿son para tu teléfono?»): las
    // respuestas se cuentan por asunto («Re: cómo empezó BDI»).
    m(2, 'la historia (texto plano de Bruno)', 24, 'cómo empezó BDI', null,
      leerContenido({ v: V_ACTUAL, bloques: mail2, formato: 'personal' }), true),
    m(3, 'una funda para cada outfit', 48, 'Una funda para cada outfit', 'Combinás diseños y modelos. Se aplica solo en el carrito, hasta el 31/10.', doc(mail3, { saleHasta: '2026-10-31' })),
    m(4, 'por qué BDI', 96, 'Lo que cuentan quienes ya compraron', 'Lo que cuentan quienes ya compraron, y cómo es comprar en BDI.', doc(mail4)),
    m(5, 'tu código vence mañana', 144, 'Tu código vence mañana', 'Es el mismo código de la bienvenida. Después de mañana deja de andar.', doc(mail5)),
  ];
}
