// La bienvenida de ZATTIA de CUATRO mails (12-oct-2026), sobre el mismo motor que la de
// BDI (`secuencia-bienvenida-5.ts`): hora fija, corte si compró y grupo de control.
// Lo usa `crear-bienvenida-5.ts --cuenta=zattia`.
//
// Decisiones de Bruno (12-oct):
//  - el código es 10% «en nueva temporada» y ⛔ NO aplica a lo que está en oferta (lo
//    resuelve Resorty al acuñar: `soloPrecioLleno`, los 100 productos más nuevos);
//  - ⛔ sin mail en texto plano: no hay quien conteste las respuestas ⇒ 4 y no 5.
//
// La voz y el aspecto salen de `docs/marca/zattia.md`: blanco y negro, títulos en
// MAYÚSCULAS a peso regular, botones negros con radio 4, de vos y en femenino, 🤍.
//
// Reglas de la serie (las de BDI):
//  - fuera del bloque `cupon` nada nombra el % — el «10% OFF» lo pone el `prizeLabel`
//    que manda Resorty (desde el 12-oct también en el pop-up simple) en `destacado`;
//  - ⛔ no se usa el nombre (el pop-up pide sólo el mail);
//  - ⛔ no se inventa urgencia;
//  - el 4/4 sin código no tiene sentido ⇒ su cupón es `obligatorio`.
//  - 🔴 en ropa la duda SÍ es el talle (al revés que en BDI): se ofrece ayuda por WhatsApp.
//
// Se CLONA de la bienvenida vieja de Zattia el encabezado (el logo de la tienda). Las
// redes van escritas acá: las de la vieja tenían el `wa.me` SIN el 9.
import { nuevoId, type Bloque, type ContenidoCampania, type ItemLista } from '../lib/email/bloques.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';
import type { Tema } from '../lib/email/tema.ts';
import type { Trozo } from '../lib/email/texto-rico.ts';
import type { MailNuevo } from './secuencia-bienvenida-5.ts';

export const PREFIJO_ZATTIA = 'Bienvenida Z';

const NEGRO = '#000000';
const GRIS = '#f2f2f2';

/** Blanco y negro, Arial (Public Sans no está en los teléfonos: la regla es el PESO). */
const TEMA: Tema = { base: 'claro', fondo: '#ffffff', fondoContenido: '#ffffff', acento: NEGRO, fuente: 'sistema' };

const TIENDA = 'https://zattia.com.ar';
const WHATSAPP = 'https://wa.me/5493416135024';
const utm = (ruta: string, dia: number, donde = 'cuerpo') =>
  `${TIENDA}/${ruta}?utm_source=mailer&utm_medium=email&utm_campaign=bienvenida-zattia-d${dia}&utm_content=${donde}`;
const FOTO = (archivo: string, ancho = 640) => `https://acdn-us.mitiendanube.com/stores/004/445/369/products/${archivo}-${ancho}-0.jpg`;

// Fotos de producto de la temporada (TN, 1080×1350 = 4:5, medido): la modelo sobre
// gris, que es la promesa de la marca («la ves puesta en una persona real»).
// ⛔ Ninguna se repite entre mails.
type Foto = [url: string, alt: string];
const STELLA: Foto = [FOTO('top-stella-marron-2-bc27d89265e79f197717901912034345'), 'Top Stella marrón, puesto'];
const CIARA: Foto = [FOTO('vestido-ciara-negro-1-2-252d23bcb4ebd9286b17900120771779'), 'Vestido Ciara negro, puesto'];
const ZOEY: Foto = [FOTO('top-zoey-marron-1-2-e0a4cf494b8a014ab117900133318603'), 'Top Zoey marrón, puesto'];
const AZURI: Foto = [FOTO('top-azuri-negro-2-8f9cfeb64df1fbee2a17900137933400'), 'Top Azuri negro, puesto'];
const VERA: Foto = [FOTO('top-vera-negro-1-2-4df2f1fb41ef901d8117901870330998'), 'Top Vera negro, puesto'];
const DAISY: Foto = [FOTO('blusa-daisy-1-2-ddeefe4cc5e1272e8a17900920230153'), 'Blusa Daisy, puesta'];
const ICONIC: Foto = [FOTO('baby-tee-iconic-negro-2-5a90f979b5f170721817907748946744'), 'Baby tee Iconic negra, puesta'];
const KITTY: Foto = [FOTO('baby-tee-kitty-2-9191a99ddb00ca841117907727128476'), 'Baby tee Kitty, puesta'];

// ── Las piezas ────────────────────────────────────────────────────────────────

/** Rótulo chico en mayúsculas, a 700 y separado: «ZATTIA SQUAD». */
const volanta = (texto: string, color = '$medio'): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto,
  estilo: { titulo: { tamano: 11, peso: 700, espaciado: 2, color }, caja: { padArriba: 18, padAbajo: 0 } },
} as Bloque);

/** El título de sección de la tienda: MAYÚSCULAS a peso REGULAR y espaciado (lo opuesto al bold italic de BDI). */
const titular = (texto: string | Trozo[], tamano = 28): Bloque => ({
  id: nuevoId(), tipo: 'titulo', align: 'left', texto,
  estilo: { titulo: { tamano, peso: 400, espaciado: 2, interlinea: 1.15, mayusculas: true }, caja: { padArriba: 6, padAbajo: 0 } },
} as Bloque);

const parrafo = (texto: string | Trozo[], extra: { align?: 'left' | 'center'; tamano?: number } = {}): Bloque => ({
  id: nuevoId(), tipo: 'texto', align: extra.align ?? 'left', texto,
  estilo: { cuerpo: { tamano: extra.tamano ?? 16, interlinea: 1.5 }, caja: { padArriba: 12, padAbajo: 4 } },
} as Bloque);

/** El botón de la tienda: negro, radio 4, en mayúsculas. */
const boton = (texto: string, url: string): Bloque => ({
  id: nuevoId(), tipo: 'boton', texto, url, align: 'center', full: false,
  estilo: { boton: { tamano: 13, peso: 700, espaciado: 2, radio: 4, padY: 16, padX: 40 }, caja: { padArriba: 20, padAbajo: 8 } },
} as Bloque);

/** El cupón de la barra de arriba (ver el de BDI: `destacado: ''` reserva el lugar del premio). */
const barra = (): Bloque => ({
  id: nuevoId(), tipo: 'cupon', variante: 'barra', texto: 'Tu código de bienvenida', destacado: '',
  codigo: 'TUCUPON', botonTexto: '', botonUrl: '', condiciones: 'hasta el ${cupon.vence}',
  estilo: { caja: { padArriba: 0 } },
} as Bloque);

const dosFotos = (a: Foto, b: Foto, url: string): Bloque => ({
  id: nuevoId(), tipo: 'columnas', variante: 'imagenes', movil: 'fila', pegadas: 8,
  celdas: [
    { imagen: a[0], url, titulo: '', texto: '' },
    { imagen: b[0], url, titulo: '', texto: '' },
  ],
  estilo: { imagen: { radio: 0 }, caja: { padArriba: 20, padAbajo: 4 } },
} as unknown as Bloque);

const banda = (fondo: string, acento: string, bloques: Bloque[]): Bloque => ({
  id: nuevoId(), tipo: 'banda', fondo, acento, bloques,
} as unknown as Bloque);

const lista = (variante: 'pasos' | 'categorias', items: ItemLista[]): Bloque => ({
  id: nuevoId(), tipo: 'lista', ...(variante === 'pasos' ? {} : { variante }), items,
} as Bloque);

const redes = (): Bloque => ({
  id: nuevoId(), tipo: 'redes',
  links: [
    { red: 'Instagram', url: 'https://instagram.com/zattia_co' },
    { red: 'TikTok', url: 'https://www.tiktok.com/@zattia' },
    { red: 'WhatsApp', url: WHATSAPP },
  ],
} as unknown as Bloque);

export function armarBienvenidaZattia(vieja: { contenido: unknown }): MailNuevo[] {
  const base = leerContenido(vieja.contenido);
  const enc = base.bloques.find((x) => x.tipo === 'encabezado');
  if (!enc) throw new Error('falta el encabezado en la bienvenida vieja de Zattia');
  const encabezado = (): Bloque => ({ ...structuredClone(enc), id: nuevoId() });

  /** El pie de marca, igual en los cuatro. ⛔ Sin cuotas: la tienda se contradice (6 sobre $250.000 / 3 sobre $100.000). */
  const pie = (dia: number): Bloque[] => [
    { id: nuevoId(), tipo: 'espaciador', alto: 24 } as Bloque,
    banda(NEGRO, '#ffffff', [{
      id: nuevoId(), tipo: 'titulo', align: 'center', texto: 'Envío gratis desde ${tienda.envioGratis}',
      estilo: { titulo: { tamano: 10, peso: 700, espaciado: 2, mayusculas: true }, caja: { padY: 0 } },
    } as Bloque]),
    {
      id: nuevoId(), tipo: 'menu',
      links: [['NEW IN', 'new-in/'], ['TOPS', 'top-y-bodies/'], ['VESTIDOS', 'vestidos/'], ['DENIM', 'laundry-lab-denim/'], ['BEST SELLERS', 'best-sellers/']]
        .map(([texto, ruta]) => ({ texto, url: utm(ruta, dia, 'pie') })),
    } as Bloque,
    redes(),
  ];

  const doc = (bloques: Bloque[]): ContenidoCampania => leerContenido({ v: V_ACTUAL, bloques, tema: TEMA });

  // ── 1 · al instante: el código, las fotos y por dónde empezar ───────────────
  const mail1: Bloque[] = [
    encabezado(),
    barra(),
    volanta('ZATTIA SQUAD'),
    titular('Bienvenida a Zattia 🤍'),
    parrafo('Lo nuevo de la temporada, siempre antes que nadie. Tu código está arriba de todo: usalo en tu primera compra, en las prendas nuevas.'),
    dosFotos(STELLA, CIARA, utm('new-in/', 0, 'fotos')),
    boton('VER NEW IN', utm('new-in/', 0, 'boton')),
    titular('Elegí por dónde empezar', 20),
    lista('categorias', [
      { titulo: 'New in', texto: 'Lo último que entró', imagen: FOTO('top-stella-blanco-2-d7f62c49a4ec75ed4917901909408721', 480), url: utm('new-in/', 0, 'categorias') },
      { titulo: 'Tops y bodies', texto: 'Para todos los días', imagen: FOTO('top-enya-negro-2-2-4a36e18f66a74905ec17900768658373', 480), url: utm('top-y-bodies/', 0, 'categorias') },
      { titulo: 'Vestidos y monos', texto: 'De día y de noche', imagen: FOTO('vestido-tanger-marron-2-df943c3dc27a67fca917900124989554', 480), url: utm('vestidos/', 0, 'categorias') },
      { titulo: 'Remeras', texto: 'Baby tees y más', imagen: FOTO('baby-tee-iconic-blanco-2-4d7de1472c472359e717907720680943', 480), url: utm('remeras/', 0, 'categorias') },
      { titulo: 'Blusas y camisas', texto: 'Las nuevas', imagen: FOTO('blusa-daisy-espalda-2-1a26e5295375fd925317900920820559', 480), url: utm('blusas/', 0, 'categorias') },
      { titulo: 'Best sellers', texto: 'Las más elegidas', imagen: FOTO('top-azuri-blanco-2-6fbf64a2d64dd2e8dc17900147683758', 480), url: utm('best-sellers/', 0, 'categorias') },
    ]),
    {
      id: nuevoId(), tipo: 'columnas', variante: 'textos', movil: 'fila', pegadas: 12,
      celdas: [
        { imagen: '', url: '', titulo: 'Despacho', texto: 'en ${tienda.plazoDespacho}' },
        { imagen: '', url: '', titulo: 'Cambios', texto: '${tienda.plazoCambio}' },
        { imagen: '', url: '', titulo: 'Local', texto: '${tienda.local}' },
      ],
      estilo: { titulo: { tamano: 11, peso: 700, mayusculas: true, espaciado: 1 }, cuerpo: { tamano: 12, color: '$medio' }, caja: { padArriba: 16 } },
    } as unknown as Bloque,
    ...pie(0),
  ];

  // ── 2 · día 2: lo nuevo ─────────────────────────────────────────────────────
  const mail2: Bloque[] = [
    encabezado(),
    barra(),
    volanta('NEW IN'),
    titular('Recién llegado'),
    parrafo('Entraron tops, vestidos y baby tees. Te dejamos algunos para que veas cómo quedan puestos.'),
    dosFotos(ZOEY, AZURI, utm('new-in/', 2, 'fotos')),
    {
      id: nuevoId(), tipo: 'productos-dinamicos', fuente: 'recientes', n: 6, porFila: 3, movil: 2,
      estilo: { cuerpo: { align: 'center' }, caja: { padArriba: 20 } },
    } as unknown as Bloque,
    boton('VER TODO LO NUEVO', utm('new-in/', 2, 'boton')),
    ...pie(2),
  ];

  // ── 3 · día 4: cómo es comprar en Zattia ────────────────────────────────────
  // 🔴 En ropa la duda es el TALLE: el 3/4 lo ofrece resolver por WhatsApp. El horario
  // del local NO va: no es un dato de la tienda cargado y en el pie de la web no figura.
  const mail3: Bloque[] = [
    encabezado(),
    barra(),
    volanta('POR QUÉ ZATTIA'),
    titular('La ves puesta antes de elegirla'),
    parrafo('Cada prenda la fotografiamos puesta en una persona real, para que sepas cómo queda antes de comprarla.'),
    dosFotos(VERA, DAISY, utm('', 4, 'fotos')),
    titular('Cómo es comprar en Zattia', 20),
    banda('#ffffff', NEGRO, [
      lista('pasos', [
        { titulo: 'Despachamos en ${tienda.plazoDespacho}', texto: 'A todo el país. Envío gratis desde ${tienda.envioGratis}.' },
        { titulo: '¿Dudas con el talle?', texto: 'Escribinos por WhatsApp y te ayudamos a elegir.' },
        { titulo: '¿No te quedó? La cambiás', texto: 'Tenés ${tienda.plazoCambio}, sin uso y con la etiqueta puesta.' },
      ]),
    ]),
    boton('ESCRIBINOS POR WHATSAPP', WHATSAPP),
    banda(GRIS, NEGRO, [
      { id: nuevoId(), tipo: 'titulo', align: 'left', texto: 'Venite al local', estilo: { titulo: { tamano: 18, peso: 400, espaciado: 2, mayusculas: true }, caja: { padArriba: 4, padAbajo: 0 } } } as Bloque,
      { id: nuevoId(), tipo: 'texto', align: 'left', texto: '**${tienda.local}**. Te probás todo antes de llevarlo.', estilo: { cuerpo: { tamano: 14, interlinea: 1.5 }, caja: { padArriba: 6, padAbajo: 4 } } } as Bloque,
    ]),
    ...pie(4),
  ];

  // ── 4 · día 6: tu código vence mañana ───────────────────────────────────────
  const mail4: Bloque[] = [
    encabezado(),
    banda(NEGRO, '#ffffff', [
      volanta('ÚLTIMO DÍA', '$medio'),
      titular('Tu código vence mañana', 30),
      parrafo('Es el mismo que te dimos el primer día. Se carga en el checkout, en las prendas nuevas de la temporada.'),
      {
        id: nuevoId(), tipo: 'cupon', variante: 'grande', obligatorio: true, texto: 'Tu código', destacado: '',
        codigo: 'TUCUPON', botonTexto: 'USAR MI CÓDIGO', botonUrl: utm('new-in/', 6, 'cupon'),
        condiciones: 'Válido hasta ${cupon.venceLargo}',
        estilo: { boton: { tamano: 13, peso: 700, espaciado: 2, radio: 4, padY: 16, padX: 40 } },
      } as Bloque,
    ]),
    dosFotos(ICONIC, KITTY, utm('new-in/', 6, 'fotos')),
    parrafo('¿Dudas con el talle? Escribinos por WhatsApp y te ayudamos 🤍', { align: 'center' }),
    ...pie(6),
  ];

  const m = (n: number, nombre: string, esperaHoras: number, asunto: string, preheader: string, contenido: ContenidoCampania): MailNuevo => ({
    nombre: `${PREFIJO_ZATTIA} ${n}/4 — ${nombre}`, esperaHoras, asunto, preheader, contenido, remitenteNombre: null, responderA: null,
  });

  return [
    m(1, 'el código', 0, 'Bienvenida a Zattia: tu código está adentro', 'Usalo en tu primera compra, en las prendas nuevas. Vale 7 días.', doc(mail1)),
    m(2, 'new in', 48, 'Recién llegado', 'Tops, vestidos y baby tees nuevos, puestos.', doc(mail2)),
    m(3, 'por qué Zattia', 96, 'Cómo es comprar en Zattia', 'La ves puesta antes de elegirla, y si no te quedó, la cambiás.', doc(mail3)),
    m(4, 'tu código vence mañana', 144, 'Tu código vence mañana', 'Es el mismo código de la bienvenida. Después de mañana deja de andar.', doc(mail4)),
  ];
}
