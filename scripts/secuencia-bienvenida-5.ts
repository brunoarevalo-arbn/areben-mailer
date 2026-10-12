// La bienvenida de BDI de CINCO mails (diseño aprobado el 11-oct-2026), armada con los
// bloques de hoy a partir de la bienvenida de un mail que sale (`cms6kpmqg…`). Lo usa
// `crear-bienvenida-5.ts`, que la escribe en la base PAUSADA.
//
// ⚠️ Es la PRIMERA versión con los bloques que el motor ya tiene. El diseño de
// `docs/disenio/bienvenida-bdi/` pide piezas que todavía no existen (cupón en barra,
// fotos de a dos alineadas, escalones, pasos numerados, `${cupon.vence}`, el código
// en su propio renglón en el mail personal): ver «Lo que falta construir» en su
// LEEME. Se afinan en `/automations` o con un script, sin tocar el motor de envío.
//
// Reglas de la serie que el armado respeta:
//  - fuera del bloque `cupon` nada nombra el % (el premio varía: 10 o 15) — el
//    bloque lo pisa `aplicarCuponDelTrigger` con lo que la persona ganó;
//  - ⛔ no se usa el nombre (0% de los leads lo tiene);
//  - ⛔ nunca «si no te queda»: la funda siempre entra, el riesgo es que no guste.
//
// 🔑 Se CLONAN los bloques de la bienvenida vieja (encabezado con el logo recortado,
// cupón con su estilo, barra de garantías con `${tienda.…}`, redes), con id NUEVO.
import { nuevoId, type Bloque, type ContenidoCampania } from '../lib/email/bloques.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';

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

const clon = <T extends Bloque>(b: T): T => ({ ...structuredClone(b), id: nuevoId() });

function tomar(bloques: Bloque[], que: string, pred: (b: Bloque) => boolean): Bloque {
  const b = bloques.find(pred);
  if (!b) throw new Error(`falta en la bienvenida de hoy: ${que}`);
  return clon(b);
}

const TIENDA = 'https://bdiaccesorios.com.ar';
const utm = (url: string, dia: number) =>
  `${url}${url.includes('?') ? '&' : '?'}utm_source=mailer&utm_medium=email&utm_campaign=bienvenida-bdi-d${dia}`;
const MOODS = 'https://acdn-us.mitiendanube.com/stores/001/096/065/products';

const parrafo = (t: string, extra: Partial<Bloque> = {}): Bloque => ({ id: nuevoId(), tipo: 'texto', texto: t, ...extra } as Bloque);
const titulo = (t: string): Bloque => ({ id: nuevoId(), tipo: 'titulo', align: 'center', texto: t } as Bloque);
const boton = (texto: string, url: string): Bloque => ({ id: nuevoId(), tipo: 'boton', align: 'center', full: false, texto, url } as Bloque);
const divisor = (): Bloque => ({ id: nuevoId(), tipo: 'divisor' } as Bloque);
/** Dos fotos lado a lado (columnas de imágenes, en fila también en el celular). */
const dosFotos = (a: [string, string], b: [string, string], dia: number): Bloque => ({
  id: nuevoId(), tipo: 'columnas', variante: 'imagenes', movil: 'fila',
  celdas: [
    { imagen: `${MOODS}/${a[0]}`, url: utm(`${TIENDA}`, dia), titulo: '', texto: '' },
    { imagen: `${MOODS}/${b[0]}`, url: utm(`${TIENDA}`, dia), titulo: '', texto: '' },
  ],
} as unknown as Bloque);

export function armarBienvenida5(vieja: { contenido: unknown }): MailNuevo[] {
  const base = leerContenido(vieja.contenido);
  const b = base.bloques;
  const esGarantias = (x: Bloque) => x.tipo === 'columnas' && JSON.stringify(x).includes('${tienda.envioGratis}');
  const encabezado = () => tomar(b, 'el encabezado', (x) => x.tipo === 'encabezado');
  const cupon = () => tomar(b, 'el bloque cupon', (x) => x.tipo === 'cupon');
  const cierre = (): Bloque[] => [
    divisor(),
    tomar(b, 'la barra de garantías', esGarantias),
    tomar(b, 'las redes', (x) => x.tipo === 'redes'),
  ];
  const doc = (bloques: Bloque[]): ContenidoCampania =>
    leerContenido({ v: V_ACTUAL, bloques, ...(base.tema ? { tema: base.tema } : {}), ...(base.estilos ? { estilos: base.estilos } : {}) });

  // ── 1 · al instante: la bienvenida de hoy, ENTERA ───────────────────────────
  // Es la que ya sale (33% apertura) y la que tiene el código: cambia el asunto.
  const mail1 = b.map((x) => clon(x));

  // ── 2 · día 1: la historia, en texto plano, firmada por Bruno ───────────────
  // Texto de `docs/disenio/bienvenida-bdi/mail-2.txt` (dictado por Bruno y ajustado
  // con Darío el 11-oct). ⚠️ El código sale EN LÍNEA hasta que el renderer
  // `personal` lo ponga en su propio renglón (punto 7 del LEEME).
  const mail2: Bloque[] = [
    parrafo('Hola,'),
    parrafo('Soy Bruno. Arrancamos BDI Accesorios en 2016, y hoy la llevamos adelante con mi hermano mellizo.'),
    parrafo('Al principio queríamos algo simple: proteger el celular. Pero con el tiempo nos dimos cuenta de que la funda es lo que más tenemos en la mano durante el día, y que podíamos ser mucho más que solo eso.'),
    parrafo('Desde entonces hacemos **moda en fundas**. Cada colección la pensamos y la diseñamos mirando las tendencias de cada temporada, para que tu funda sea una parte más del outfit. La funda dejó de ser algo que comprás una vez: ahora la cambiás como cambiás de look.'),
    parrafo('Más de **100.000** personas ya nos eligieron, y hoy somos más que una marca: somos una comunidad.'),
    // La frase va en su párrafo: el renderer `personal` arranca la línea del cupón con
    // el `prizeLabel` («15% OFF»), que `aplicarCuponDelTrigger` pone sobre el texto.
    parrafo('Gracias por sumarte. Tu código de bienvenida sigue vigente:'),
    cupon(),
    { id: nuevoId(), tipo: 'texto', texto: [{ t: 'Las colecciones están acá: ' }, { t: 'bdiaccesorios.com.ar', url: utm(TIENDA, 1) }] } as Bloque,
    parrafo('Bruno\nCofundador de BDI'),
    parrafo('P.D.: si no sabés cuál elegir para tu modelo de celular, respondeme este mail y te ayudo.'),
  ];

  // ── 3 · día 2: la escalera de Resorty ───────────────────────────────────────
  // 🔴 La escalera corre hasta el 31-oct: después de esa fecha este mail tiene que
  // dejar de salir (punto 5 del LEEME). Hasta que eso exista, se PAUSA a mano.
  const mail3: Bloque[] = [
    encabezado(),
    cupon(),
    titulo('Una funda para cada outfit'),
    parrafo('Hasta el 31/10 las fundas tienen descuento por cantidad: la segunda y la tercera salen más baratas. Para cambiarla como cambiás de look, o para regalarle una a tu hermana.', { align: 'center' } as Partial<Bloque>),
    dosFotos(['stripe-case-2-42397b9d7c442491a617893963446537-640-0.jpg', 'Stripe case'], ['3-cases-ffff134e2ca25b69a717895830679521-640-0.jpg', 'Tres fundas Moods'], 2),
    {
      id: nuevoId(), tipo: 'columnas', variante: 'textos', movil: 'fila',
      celdas: [
        { imagen: '', url: '', titulo: '2 FUNDAS', texto: 'la segunda, −20%' },
        { imagen: '', url: '', titulo: '3 FUNDAS', texto: 'la segunda −20% y la tercera −30%' },
      ],
    } as unknown as Bloque,
    parrafo('Combinás diseños y modelos de iPhone distintos. Se aplica solo en el carrito, y se suma a tu código.', { align: 'center' } as Partial<Bloque>),
    boton('ARMAR MI COMBO', utm(TIENDA, 2)),
    ...cierre(),
  ];

  // ── 4 · día 4: por qué BDI ──────────────────────────────────────────────────
  // Opiniones TEXTUALES de Google (Tiara B. y Thiago A.); ⛔ sin el puntaje.
  const mail4: Bloque[] = [
    encabezado(),
    cupon(),
    titulo('Por qué BDI'),
    parrafo('Lo cuentan quienes ya compraron.', { align: 'center' } as Partial<Bloque>),
    {
      id: nuevoId(), tipo: 'columnas', variante: 'textos', movil: 'apilar',
      celdas: [
        { imagen: '', url: '', titulo: 'Tiara B. · Google', texto: '“Me pedí una funda por la página, yo soy de Capital. Excelente cómo llegó y lo más importante: la funda hermosa, el color lo que es.”' },
        { imagen: '', url: '', titulo: 'Thiago A. · Google', texto: '“Envíos súper rápidos, buena comunicación y hermosa experiencia comprando en BDI.”' },
      ],
    } as unknown as Bloque,
    // Las fotos DESPUÉS de las opiniones: pegadas arriba de «Tiara B.» se leían como
    // fotos de esas clientas, y son de la colección (de IA).
    dosFotos(['stardust-gem-ef1b30e6697c0a197a17895835890117-640-0.jpg', 'Stardust case'], ['aqua-gem-d7b139db888b12329e17895837341091-640-0.jpg', 'Aqua case'], 4),
    titulo('Cómo es comprar en BDI'),
    parrafo('**Despachamos en ${tienda.plazoDespacho}.** A todo el país. Envío gratis desde ${tienda.envioGratis}.'),
    parrafo('**Pagás como te quede cómodo.** ${tienda.cuotas} en toda la tienda.'),
    parrafo('**¿Y si no te gusta? La cambiás.** Tenés ${tienda.plazoCambio}. Escribinos y lo resolvemos.'),
    boton('VER LOS MÁS VENDIDOS', utm(TIENDA, 4)),
    parrafo('**Venite al local.** ${tienda.local}, Rosario. Ves todas las fundas en la mano antes de elegir.', { align: 'center' } as Partial<Bloque>),
    ...cierre(),
  ];

  // ── 5 · día 6: tu código vence mañana ───────────────────────────────────────
  // El MISMO código, ⛔ sin descuento extra (Burga repite el mismo; escalar enseña a
  // esperar). ⚠️ Sin código, el bloque se cae y este mail no tiene sentido: tiene
  // que salir SALTADO (punto 5 del LEEME) — hoy saldría sin código.
  const mail5: Bloque[] = [
    encabezado(),
    titulo('Tu código vence mañana'),
    parrafo('Es el mismo que te dimos el primer día. Se carga en el checkout, en cualquier producto de la tienda.', { align: 'center' } as Partial<Bloque>),
    cupon(),
    boton('USAR MI CÓDIGO', utm(TIENDA, 6)),
    parrafo('¿Te falta decidir el modelo? Respondé este mail y te ayudamos a elegir.', { align: 'center' } as Partial<Bloque>),
    ...cierre(),
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
    // Asunto en minúscula y distinto del carrito («te lo guardamos»): las respuestas
    // se cuentan por asunto («Re: cómo empezó BDI»).
    m(2, 'la historia (texto plano de Bruno)', 24, 'cómo empezó BDI', null,
      leerContenido({ v: V_ACTUAL, bloques: mail2, formato: 'personal' }), true),
    m(3, 'una funda para cada outfit', 48, 'Una funda para cada outfit', 'Combinás diseños y modelos. Se aplica solo en el carrito, hasta el 31/10.', doc(mail3)),
    m(4, 'por qué BDI', 96, 'Lo que cuentan quienes ya compraron', 'Lo que cuentan quienes ya compraron, y cómo es comprar en BDI.', doc(mail4)),
    m(5, 'tu código vence mañana', 144, 'Tu código vence mañana', 'Es el mismo código de la bienvenida. Después de mañana deja de andar.', doc(mail5)),
  ];
}
