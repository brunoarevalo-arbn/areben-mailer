// La secuencia de carrito de CUATRO mails (29-sep-2026), armada a partir de los
// tres que ya salen. Lo usan `crear-secuencia-carrito-4.ts` (que la escribe en
// la base, PAUSADA) y `ensayo-secuencia.ts --nueva` (que la dibuja con un
// carrito real sin escribir nada).
//
// De dónde sale cada decisión:
//
//  - **El producto arriba y el botón abajo, sin banner.** Hoy el 1º abre con una
//    foto de ambiente que ocupa la primera pantalla del celular, y el 2º con el
//    «¿Por qué elegirnos?» — el carrito aparecía recién al bajar.
//  - **«Tu pedido está listo para salir»** en vez de «¿te olvidaste algo?», que
//    suena a tarea pendiente. Lo eligió Bruno. ⛔ Sin «empaquetado»: eso no pasó.
//  - **El 2º es TEXTO PLANO firmado por Bruno** (`formato: "personal"`), con las
//    respuestas a su casilla: cae en Principal y es el que la gente contesta.
//  - **El cupón que la persona YA TIENE se recuerda desde el 1º** (`fuente:
//    "recordar"`), y el 4º recién emite uno si no trae ninguno (`recordar-o-
//    emitir`). Medido: el 60% de los carritos de BDI traía un cupón del pop-up,
//    y el escalado le sumaba +5 encima — 403 emitidos, 2 canjeados.
//
// 🔑 Se CLONAN los bloques de los mails viejos en vez de escribirlos de cero:
// ahí están el encabezado con el logo recortado, el link de WhatsApp probado (con
// el 9), la barra de garantías con `${tienda.…}`, las opiniones de Google y los
// estilos que Cande ajustó. Cada bloque clonado lleva un id NUEVO: un bloque sin
// id es intocable en el editor, y dos documentos no comparten ids.
import { nuevoId, type Bloque, type ContenidoCampania } from '../lib/email/bloques.ts';
import { leerContenido, V_ACTUAL } from '../lib/email/esquema.ts';

export const PREFIJO = 'Carrito v2';

export interface MailNuevo {
  nombre: string;
  esperaHoras: number;
  asunto: string;
  preheader: string | null;
  contenido: ContenidoCampania;
  remitenteNombre: string | null;
  responderA: string | null;
}

interface Vieja {
  nombre: string;
  esperaHoras: number;
  contenido: unknown;
}

const clon = <T extends Bloque>(b: T): T => ({ ...structuredClone(b), id: nuevoId() });

/** El bloque que cumple `pred`, clonado. Si no está, el script se frena: no se inventa. */
function tomar(bloques: Bloque[], que: string, pred: (b: Bloque) => boolean): Bloque {
  const b = bloques.find(pred);
  if (!b) throw new Error(`falta en el mail viejo: ${que}`);
  return clon(b);
}

const textoDe = (b: Bloque): string => {
  const t = (b as { texto?: unknown }).texto;
  if (typeof t === 'string') return t;
  return Array.isArray(t) ? t.map((x) => (x as { t?: string }).t ?? '').join('') : '';
};

const conTexto = (b: Bloque, texto: string, tamano?: number): Bloque => ({
  ...b,
  texto: [{ t: texto, ...(tamano ? { tamano } : {}) }],
} as Bloque);

/** El botón del mail viejo con otro texto: se queda con su estilo y con `${cart.url}`. */
const botonCon = (b: Bloque, texto: string): Bloque => ({ ...b, texto } as Bloque);

/**
 * El recordatorio del cupón que la persona ya tiene. Compacto: acompaña, no es
 * el protagonista. Sin botón propio: el botón del mail ya lleva al carrito.
 *
 * `CARRITO10` es el placeholder de siempre y NUNCA sale: sin cupón vivo, el
 * procesador borra el bloque entero (`aplicarCuponDeCarrito`).
 */
const cuponRecordar = (texto: string): Bloque => ({
  id: nuevoId(),
  tipo: 'cupon',
  variante: 'compacta',
  texto,
  codigo: 'CARRITO10',
  botonTexto: '',
  botonUrl: '',
  fuente: 'recordar',
});

const parrafo = (t: string): Bloque => ({ id: nuevoId(), tipo: 'texto', texto: t });

export function armarSecuencia4(viejas: Vieja[]): MailNuevo[] {
  const [v1, v2, v3] = [...viejas].sort((a, b) => a.esperaHoras - b.esperaHoras);
  if (!v1 || !v2 || !v3) throw new Error('hacen falta los TRES mails de carrito de hoy para clonarlos');
  const c1 = leerContenido(v1.contenido);
  const c2 = leerContenido(v2.contenido);
  const c3 = leerContenido(v3.contenido);
  const b1 = c1.bloques;
  const b2 = c2.bloques;
  const b3 = c3.bloques;

  const esWa = (b: Bloque) => b.tipo === 'texto' && JSON.stringify(b).includes('https://wa.me/');
  const esGarantias = (b: Bloque) => b.tipo === 'columnas' && JSON.stringify(b).includes('${tienda.envioGratis}');
  const esPie = (b: Bloque) => b.tipo === 'texto' && textoDe(b).includes('${tienda.plazoDespacho}');

  // ── 1 · a la hora ──────────────────────────────────────────────────────────
  const titulo1 = tomar(b1, 'el título', (b) => b.tipo === 'titulo');
  const mail1: Bloque[] = [
    tomar(b1, 'el encabezado', (b) => b.tipo === 'encabezado'),
    {
      id: nuevoId(), tipo: 'texto', align: 'center',
      texto: [{ t: 'ENVÍO GRATIS EN COMPRAS MAYORES A ${tienda.envioGratis}', tamano: 11 }],
      estilo: { cuerpo: { color: '$tenue' } },
    },
    conTexto(titulo1, 'Tu pedido está listo para salir', 20),
    {
      id: nuevoId(), tipo: 'texto', align: 'center',
      texto: [{ t: '${contacto.primerNombre}, lo dejamos apartado tal cual lo armaste. Terminalo cuando quieras.', tamano: 14 }],
    },
    tomar(b1, 'el carrito', (b) => b.tipo === 'carrito'),
    botonCon(tomar(b1, 'el botón', (b) => b.tipo === 'boton'), 'COMPLETAR MI PEDIDO'),
    cuponRecordar('Acordate: tenés tu descuento activo'),
    { id: nuevoId(), tipo: 'divisor' },
    tomar(b1, 'la línea de WhatsApp', esWa),
    { id: nuevoId(), tipo: 'divisor' },
    tomar(b1, 'la barra de garantías', esGarantias),
    tomar(b1, 'el pie de confianza', esPie),
  ];

  // ── 2 · al día: texto plano, firmado por Bruno ─────────────────────────────
  // 🔴 Sin «no te aseguro stock por mucho tiempo» de la guía: no lo sabemos, y
  // una urgencia inventada es la que después nadie cree.
  const mail2: Bloque[] = [
    parrafo('Hola ${contacto.primerNombre},'),
    parrafo('Vi que dejaste ${cart.producto} en el carrito. Te lo guardamos tal cual lo armaste.'),
    parrafo('Si te frenó alguna duda —el modelo, cómo queda, el envío— respondeme este mail y te la resuelvo yo.'),
    cuponRecordar('Y acordate que tenés tu descuento activo:'),
    {
      id: nuevoId(), tipo: 'texto',
      texto: [{ t: 'Para terminar tu compra: ' }, { t: 'volver a mi carrito', url: '${cart.url}' }],
    },
    parrafo('Bruno\nBDI Accesorios'),
  ];

  // ── 3 · a los dos días: las opiniones ──────────────────────────────────────
  const mail3: Bloque[] = [
    tomar(b2, 'el encabezado', (b) => b.tipo === 'encabezado'),
    conTexto(tomar(b2, 'el título', (b) => b.tipo === 'titulo'), '${contacto.primerNombre}, ¿seguís pensándolo?', 18),
    tomar(b2, 'el carrito', (b) => b.tipo === 'carrito'),
    botonCon(tomar(b2, 'el botón', (b) => b.tipo === 'boton'), 'COMPLETAR MI PEDIDO'),
    cuponRecordar('Tu descuento sigue activo'),
    { id: nuevoId(), tipo: 'divisor' },
    tomar(b2, 'el rótulo de opiniones', (b) => b.tipo === 'titulo' && textoDe(b).includes('DICEN')),
    tomar(b2, 'las opiniones de Google', (b) => b.tipo === 'columnas' && !esGarantias(b)),
    { id: nuevoId(), tipo: 'divisor' },
    tomar(b2, 'la línea de WhatsApp', esWa),
    tomar(b2, 'la foto del local', (b) => b.tipo === 'imagen' && (b.alt ?? '').includes('Rosario')),
    tomar(b2, 'la barra de garantías', esGarantias),
    tomar(b2, 'el pie de confianza', esPie),
  ];

  // ── 4 · a los tres días: el último, con el cupón ───────────────────────────
  // El LAST CALL de hoy entero, con dos cambios: el cupón primero recuerda el
  // que la persona ya tiene y sólo emite si no trae ninguno, y el botón dice lo
  // mismo que en los otros tres.
  const mail4: Bloque[] = b3.map((b) => {
    if (b.tipo === 'cupon') return { ...clon(b), texto: 'Tu descuento', fuente: 'recordar-o-emitir' } as Bloque;
    if (b.tipo === 'boton') return botonCon(clon(b), 'COMPLETAR MI PEDIDO');
    return clon(b);
  });
  if (!mail4.some((b) => b.tipo === 'cupon')) throw new Error('el 3er mail de hoy no tiene bloque cupon');

  const doc = (base: ContenidoCampania, bloques: Bloque[], extra: Partial<ContenidoCampania> = {}): ContenidoCampania =>
    leerContenido({ v: V_ACTUAL, bloques, ...(base.tema ? { tema: base.tema } : {}), ...(base.estilos ? { estilos: base.estilos } : {}), ...extra });

  return [
    {
      nombre: `${PREFIJO} 1/4 — pedido listo`,
      esperaHoras: 1,
      asunto: 'Tu pedido está listo para salir 📦',
      preheader: 'Lo dejamos apartado tal cual lo armaste',
      contenido: doc(c1, mail1),
      remitenteNombre: null,
      responderA: null,
    },
    {
      nombre: `${PREFIJO} 2/4 — texto plano de Bruno`,
      esperaHoras: 24,
      asunto: 'te lo guardamos',
      // Sin preheader: en un mail personal, lo que se lee en la bandeja son sus
      // primeras líneas, como en cualquier mail escrito a mano.
      preheader: null,
      contenido: leerContenido({ v: V_ACTUAL, bloques: mail2, formato: 'personal' }),
      remitenteNombre: 'Bruno de BDI',
      responderA: 'brunoarevalo@arebensrl.com',
    },
    {
      nombre: `${PREFIJO} 3/4 — opiniones`,
      esperaHoras: 48,
      asunto: '¿Seguís pensándolo? 💭',
      preheader: 'Esto es lo que dicen quienes ya compraron',
      contenido: doc(c2, mail3),
      remitenteNombre: null,
      responderA: null,
    },
    {
      nombre: `${PREFIJO} 4/4 — last call`,
      esperaHoras: 72,
      asunto: 'LAST CALL ☎️',
      preheader: 'Es el último mail que te mandamos por esto',
      contenido: doc(c3, mail4),
      remitenteNombre: null,
      responderA: null,
    },
  ];
}
