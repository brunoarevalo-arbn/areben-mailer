// Las plantillas que vienen con la app: lo que el comerciante ve el primer día.
//
// **Un preset nunca se guarda con una marca adentro.** Se declara como una
// función de la cuenta y se resuelve al instanciarlo — el nombre de la tienda va
// en el copy, su sitio en los links, y el logo lo pone el bloque `encabezado`
// solo al renderizar. Ese es exactamente el bug que ya pasó: la bienvenida de
// Zattia saludaba en nombre de "BDI Accesorios" porque el texto estaba clavado
// en una constante.
//
// ⚠️ Acá viven los presets de campaña **y** los de automation. Hasta el 29-jul
// eran dos tipos `Preset` distintos en dos archivos: el de automations sí se
// resolvía contra la tienda, el de la galería no —tenía todas las URLs vacías, y
// las plantillas salían con botones que no llevaban a ninguna parte—. Un solo
// tipo y una sola `presetsPara()` es lo que evita que la próxima mejora entre en
// uno de los dos y no en el otro.
//
// ⚠️ Puro: no importa prisma ni next/headers. Lo lee el servidor (crear campaña)
// y el navegador (las miniaturas de /plantillas).

import { leerContenido } from "@/lib/email/esquema";
import type { Bloque, ContenidoCampania } from "@/lib/email/render";
import type { Estilos } from "@/lib/email/estilos";
import type { Tema } from "@/lib/email/tema";
import { urlTiendaDe, type Trigger } from "@/lib/automations";

/** Lo que un preset sabe de la cuenta que lo instancia. */
export interface CtxPreset {
  /** Nombre de la marca. Va al copy, nunca a un campo que se guarde solo. */
  marca: string;
  /**
   * Sitio de la tienda, sin barra final. **Puede venir vacío** (cuenta recién
   * creada, sin TN conectada): en ese caso el botón se omite en vez de mandar a
   * un link roto, que es peor que no tener botón.
   */
  tienda: string;
}

/** Lo que devuelve un preset antes de pasar por `leerContenido`. */
interface Armado {
  bloques: Bloque[];
  tema?: Tema;
  /**
   * Capa de documento: "en este mail, todos los títulos son así". Es lo que
   * hace que dos presets con los mismos bloques se vean distinto sin repetir
   * quince overrides.
   */
  estilos?: Estilos;
  /** Solo los de automation: el asunto sale del preset. */
  asunto?: string;
}

interface DefPreset {
  id: string;
  nombre: string;
  descripcion: string;
  /** Solo los de automation: a qué evento de la tienda responden. */
  trigger?: Trigger;
  /** Solo los de automation: cuánto espera después del disparador. */
  esperaHoras?: number;
  arma: (ctx: CtxPreset) => Armado;
}

/** Un preset ya resuelto contra una cuenta: listo para guardar tal cual. */
export interface Preset {
  id: string;
  nombre: string;
  descripcion: string;
  trigger?: Trigger;
  esperaHoras: number;
  asunto: string;
  contenido: ContenidoCampania;
}

// ─────────────────────────────────────────────────────────────────────────────
// Piezas compartidas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un botón que solo existe si hay a dónde ir.
 *
 * Los bloques ricos dibujan el botón cuando `botonTexto` tiene algo, así que
 * vaciar el texto es la forma de no dibujarlo. Un `href=""` en un mail no es un
 * detalle: es un click que no lleva a ningún lado y no se puede arreglar después
 * de enviado.
 */
const cta = (texto: string, url: string) => ({
  botonTexto: url ? texto : "",
  botonUrl: url,
});

/** El bloque rico que, por diseño, no lleva botón: es una banda de texto. */
const sinBoton = { botonTexto: "", botonUrl: "" } as const;

/** Botón suelto, o nada. Mismo criterio que `cta`. */
const botonSi = (texto: string, url: string, align: "left" | "center" = "left"): Bloque[] =>
  url ? [{ tipo: "boton", texto, url, align, full: false }] : [];

/**
 * Las redes nacen vacías a propósito: Tiendanube no nos las devuelve y no hay de
 * dónde sacarlas. El renderer filtra los links sin URL, así que el bloque no
 * dibuja nada hasta que el comerciante las cargue — no es un link roto, es un
 * lugar reservado en el diseño.
 */
const redes: Bloque = {
  tipo: "redes",
  links: [
    { red: "Instagram", url: "" },
    { red: "Facebook", url: "" },
    { red: "WhatsApp", url: "" },
  ],
};

const aire = (alto: number): Bloque => ({ tipo: "espaciador", alto });

// ─────────────────────────────────────────────────────────────────────────────
// Los presets
// ─────────────────────────────────────────────────────────────────────────────

const DEFS: readonly DefPreset[] = [
  // ── Campaña ───────────────────────────────────────────────────────────────
  {
    id: "ecommerce",
    nombre: "E-commerce clásico",
    descripcion: "Portada, los más vendidos de tu tienda y una banda de beneficios. El caballito de batalla.",
    arma: ({ marca, tienda }) => ({
      // Botón pastilla para todo el mail: la capa de documento existe justo para
      // esto — un rasgo que se elige una vez y no se repite en cada bloque.
      estilos: { boton: { radio: 24 }, imagen: { radio: 12 } },
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Lo que más se está vendiendo",
          subtitulo: `Una selección de ${marca} para que no te lo pierdas.`,
          bg: "#ffffff",
          ...cta("Ver la tienda", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que más está saliendo esta semana 👇", align: "left" },
        // El bloque que justifica que este mailer viva sobre Tiendanube: la
        // plantilla se arma una vez y sale distinta cada vez que se manda.
        { tipo: "productos-dinamicos", fuente: "destacados", n: 4 },
        ...botonSi("Ver todo el catálogo", tienda, "center"),
        aire(8),
        {
          tipo: "seccion",
          bg: "#faf7f0",
          titulo: "Comprá tranquilo",
          texto: "Envíos a todo el país · Cambios sin vueltas · Atención por WhatsApp",
          ...sinBoton,
        },
        redes,
      ],
    }),
  },
  {
    id: "novedades",
    nombre: "Novedades del mes",
    descripcion: "Se llena sola con lo último que cargaste. Se arma una vez y sirve todos los meses.",
    arma: ({ marca, tienda }) => ({
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Llegaron cosas nuevas",
          subtitulo: `Lo último que sumamos a ${marca}.`,
          bg: "#f5f7ff",
          ...cta("Ver las novedades", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que entró desde la última vez que te escribimos.", align: "left" },
        // `recientes`, no `destacados`: es la fuente que hace que esta misma
        // plantilla sirva todos los meses sin que nadie la abra.
        { tipo: "productos-dinamicos", fuente: "recientes", n: 4 },
        ...botonSi("Ver todo lo nuevo", tienda, "center"),
        redes,
      ],
    }),
  },
  {
    id: "grilla",
    nombre: "Grilla de productos",
    descripcion: "Seis productos y poco texto. Para mandar catálogo sin escribir nada.",
    arma: ({ tienda }) => ({
      estilos: { imagen: { radio: 12 }, boton: { radio: 24 } },
      bloques: [
        { tipo: "titulo", texto: "Elegidos para vos", align: "center" },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, mirá lo que tenemos disponible ahora.", align: "center" },
        // Seis: tres filas de a dos. La grilla apila de a pares, así que un
        // número impar deja un hueco en la última fila.
        { tipo: "productos-dinamicos", fuente: "destacados", n: 6 },
        ...botonSi("Ver la tienda completa", tienda, "center"),
        redes,
      ],
    }),
  },
  {
    id: "promo",
    nombre: "Promo / Descuento",
    descripcion: "Hero de oferta, cupón destacado y lo que está rebajado hoy. Para vender.",
    arma: ({ tienda }) => ({
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "🔥 20% OFF en toda la tienda",
          subtitulo: "Solo por esta semana",
          bg: "#fff7ed",
          ...cta("Comprar ahora", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, aprovechá el descuento en toda la tienda antes de que termine.", align: "center" },
        { tipo: "cupon", texto: "Usá este código en el checkout", codigo: "PROMO20", ...cta("Ir a la tienda", tienda) },
        { tipo: "titulo", texto: "Lo que está en oferta", align: "center" },
        // La fuente `oferta` la filtra el mailer, no TN: la API no sabe
        // responder "dame lo rebajado".
        { tipo: "productos-dinamicos", fuente: "oferta", n: 4 },
        {
          tipo: "seccion",
          bg: "#faf7f0",
          titulo: "Envíos a todo el país",
          texto: "Comprá desde donde estés. Seguimiento del pedido incluido.",
          ...sinBoton,
        },
        redes,
      ],
    }),
  },
  {
    id: "newsletter",
    nombre: "Newsletter",
    descripcion: "Portada, nota destacada y CTA. La clásica de contenido, con secciones.",
    arma: ({ tienda }) => ({
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Lo nuevo de este mes",
          subtitulo: "Novedades, tips y lo que se viene",
          bg: "#faf7f0",
          ...sinBoton,
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que preparamos para vos 👇", align: "left" },
        { tipo: "imagen", url: "", alt: "Imagen destacada" },
        { tipo: "titulo", texto: "Título de la nota", align: "left" },
        { tipo: "texto", texto: "Contá algo acá: una nota, un detrás de escena o lo que quieras resaltar.", align: "left" },
        ...botonSi("Leer la nota", tienda),
        { tipo: "divisor" },
        {
          tipo: "seccion",
          bg: "#f0f9ff",
          titulo: "¿Todavía no nos seguís?",
          texto: "Sumate a nuestras redes para no perderte ninguna novedad.",
          ...sinBoton,
        },
        redes,
      ],
    }),
  },
  {
    id: "editorial",
    nombre: "Editorial",
    descripcion: "Con serifa y mucho aire. Para escribir de verdad, no para vender.",
    arma: ({ marca, tienda }) => ({
      // Angosto: una columna de texto largo a 700px se lee mal.
      tema: { ancho: 600 },
      // La capa de documento entera al servicio de un rasgo: serifa y renglones
      // sueltos en todo el mail, sin tocar bloque por bloque.
      estilos: {
        titulo: { fuente: "georgia", tamano: 30, interlinea: 1.25 },
        subtitulo: { fuente: "georgia", tamano: 18 },
        cuerpo: { fuente: "georgia", tamano: 17, interlinea: 1.75 },
      },
      bloques: [
        { tipo: "titulo", texto: "El título de la nota va acá", align: "left" },
        { tipo: "texto", texto: `Por el equipo de ${marca}`, align: "left" },
        { tipo: "imagen", url: "", alt: "Foto de apertura" },
        { tipo: "texto", texto: "Hola ${contacto.nombre}. Arrancá con el párrafo que engancha: qué pasó, por qué lo estás contando y qué se lleva quien termine de leer.", align: "left" },
        { tipo: "texto", texto: "Seguí desarrollando. En un mail editorial el texto es el producto, así que no lo cortes en dos renglones: si tenés algo para decir, decilo entero.", align: "left" },
        { tipo: "divisor" },
        ...botonSi("Seguir leyendo en la tienda", tienda),
        redes,
      ],
    }),
  },
  {
    id: "lanzamiento",
    nombre: "Lanzamiento de producto",
    descripcion: "Hero con imagen, presentación y la colección recién cargada.",
    arma: ({ tienda }) => ({
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Ya llegó lo nuevo 🎉",
          subtitulo: "Presentamos nuestro último lanzamiento",
          bg: "#ffffff",
          ...cta("Ver más", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, esto es lo que estabas esperando. Mirá los detalles:", align: "left" },
        { tipo: "imagen", url: "", alt: "Foto del producto" },
        { tipo: "titulo", texto: "Conocé la colección", align: "center" },
        { tipo: "productos-dinamicos", fuente: "recientes", n: 4 },
        ...botonSi("Ver toda la colección", tienda, "center"),
        redes,
      ],
    }),
  },
  {
    id: "bienvenida",
    nombre: "Bienvenida",
    descripcion: "Hero de bienvenida + cupón de regalo. Para el primer contacto.",
    arma: ({ marca, tienda }) => ({
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "¡Bienvenida/o! 👋",
          subtitulo: `Gracias por sumarte a ${marca}`,
          bg: "#f0fdf4",
          ...cta("Conocé la tienda", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, qué bueno tenerte. Te vamos a avisar de novedades, lanzamientos y promos exclusivas.", align: "left" },
        {
          tipo: "seccion",
          bg: "#faf7f0",
          titulo: "Un regalo para empezar",
          texto: "Usá el código de abajo en tu primera compra.",
          ...sinBoton,
        },
        { tipo: "cupon", texto: "10% en tu primera compra", codigo: "BIENVENIDA10", ...cta("Comprar", tienda) },
        redes,
      ],
    }),
  },
  {
    id: "post-compra",
    nombre: "Gracias por tu compra",
    descripcion: "Agradecimiento, qué sigue ahora y una recomendación. Sube la segunda compra.",
    arma: ({ tienda }) => ({
      bloques: [
        { tipo: "titulo", texto: "¡Gracias por tu compra, ${contacto.nombre}! 🎁", align: "center" },
        { tipo: "texto", texto: "Ya estamos preparando tu pedido. Te avisamos apenas salga y te pasamos el seguimiento.", align: "center" },
        {
          tipo: "seccion",
          bg: "#f0fdf4",
          titulo: "¿Alguna duda?",
          texto: "Escribinos por donde te quede más cómodo y te respondemos.",
          ...sinBoton,
        },
        { tipo: "titulo", texto: "Con esto también combina", align: "center" },
        { tipo: "productos-dinamicos", fuente: "destacados", n: 2 },
        ...botonSi("Seguir mirando", tienda, "center"),
        redes,
      ],
    }),
  },
  {
    id: "reactivacion",
    nombre: "Te extrañamos",
    descripcion: "Para quien no compra hace rato: un cupón y lo que se perdió mientras tanto.",
    arma: ({ marca, tienda }) => ({
      estilos: { cuerpo: { tamano: 17 } },
      bloques: [
        {
          tipo: "hero",
          imagen: "",
          titulo: "Hace rato que no te vemos 👀",
          subtitulo: `Pasaron cosas en ${marca} desde tu última visita.`,
          bg: "#fdf2f8",
          ...cta("Ver qué hay de nuevo", tienda),
        },
        { tipo: "texto", texto: "Hola ${contacto.nombre}, te dejamos un descuento para volver a empezar.", align: "center" },
        { tipo: "cupon", texto: "15% en tu próxima compra", codigo: "VOLVE15", ...cta("Usar el cupón", tienda) },
        { tipo: "titulo", texto: "Esto entró mientras no estabas", align: "center" },
        { tipo: "productos-dinamicos", fuente: "recientes", n: 4 },
        redes,
      ],
    }),
  },
  {
    id: "evento",
    nombre: "Invitación a un evento",
    descripcion: "Fecha, lugar y confirmación. Para un showroom, un vivo o una preventa.",
    arma: ({ marca, tienda }) => ({
      estilos: {
        // Título en versales y botón cuadrado: el rasgo de invitación, elegido
        // una vez para todo el mail.
        titulo: { mayusculas: true, espaciado: 1, color: "$acento" },
        boton: { radio: 0 },
      },
      bloques: [
        aire(12),
        { tipo: "titulo", texto: "Estás invitada/o", align: "center" },
        { tipo: "texto", texto: `Hola \${contacto.nombre}, te esperamos en el próximo encuentro de ${marca}.`, align: "center" },
        {
          tipo: "seccion",
          bg: "#111827",
          titulo: "Sábado 00 · 18 h",
          texto: "Dirección del lugar\nCiudad",
          ...cta("Confirmar que voy", tienda),
        },
        aire(16),
        { tipo: "imagen", url: "", alt: "Foto del lugar" },
        { tipo: "texto", texto: "Contá qué va a pasar: qué se muestra, quién va a estar y por qué vale la pena moverse.", align: "left" },
        redes,
      ],
    }),
  },
  {
    id: "carrito-oscuro",
    nombre: "Carrito abandonado (oscuro)",
    descripcion: "Fondo negro, CTA azul y el carrito real de la persona. Para recuperar compras.",
    // Adaptación de una plantilla de Really Good Emails que trajo Bruno.
    //
    // ⛔ De la original NO queda nada suyo: ni las imágenes (apuntaban a su CDN,
    // `d1oco4z2z1fhwp.cloudfront.net`, que puede desaparecer cuando quieran) ni
    // el pie "Designed with RGE Studio". Lo que se tomó es la estructura.
    //
    // Lo que no se pudo reproducir: la barra de navegación y la tira de 4 íconos
    // del pie, que no tienen bloque equivalente todavía (`menu` e `iconos`
    // quedaron fuera de F5).
    arma: () => ({
      tema: { base: "oscuro", acento: "#2d9ff7", ancho: 700 },
      bloques: [
        aire(20),
        {
          tipo: "hero",
          imagen: "",
          titulo: "¿Todavía lo estás pensando?",
          subtitulo: "Te distrajiste, nos pasa a todos. Terminá la compra que dejaste empezada.",
          bg: "#161616",
          ...sinBoton,
        },
        aire(32),
        { tipo: "titulo", texto: "Tu carrito", align: "center" },
        // Se llena solo con lo que la persona dejó. Va ACÁ y no al final:
        // después del botón, "esto dejaste" quedaría hablando de nada.
        { tipo: "carrito", items: [] },
        aire(28),
        // ${cart.url} lo resuelve el procesador con el link real del checkout.
        // No pasa por `botonSi`: no depende de que la tienda tenga sitio.
        { tipo: "boton", texto: "Volver a mi carrito", url: "${cart.url}", align: "center", full: false },
        aire(32),
        {
          tipo: "seccion",
          bg: "#e6e6e6",
          titulo: "¿Dudas o necesitás ayuda?",
          texto: "Escribinos y te respondemos. Estamos para darte una mano con tu compra.",
          ...sinBoton,
        },
        aire(24),
        redes,
      ],
    }),
  },

  // ── Automation ────────────────────────────────────────────────────────────
  // Salen de la misma lista que los de campaña —mismo tipo, misma resolución
  // contra la tienda— y se distinguen solo por tener `trigger`.
  {
    id: "auto-bienvenida",
    nombre: "Bienvenida",
    descripcion: "Sale sola cuando alguien se registra en la tienda.",
    trigger: "NUEVO_CLIENTE",
    esperaHoras: 0,
    arma: ({ marca, tienda }) => ({
      asunto: `¡Bienvenido/a a ${marca}! 🎉`,
      bloques: [
        { tipo: "titulo", texto: "¡Hola ${contacto.nombre}! 👋" },
        { tipo: "texto", texto: "Gracias por sumarte. Descubrí nuestros productos y encontrá lo que buscás." },
        ...botonSi("Ver la tienda", tienda),
      ],
    }),
  },
  {
    id: "auto-suscriptor",
    nombre: "Bienvenida a la lista",
    descripcion: "Sale sola cuando alguien se anota en un pop-up o formulario, con el cupón que ganó.",
    trigger: "NUEVO_SUSCRIPTOR",
    esperaHoras: 0,
    arma: ({ marca, tienda }) => ({
      asunto: `¡Gracias por sumarte a ${marca}! 🎉`,
      bloques: [
        // 🔴 SIN `${contacto.nombre}`, y no es un olvido. El pop-up SIMPLE pide
        // solo el mail, así que el 100% de los leads de Zattia no tiene nombre y
        // el merge tag se reemplaza por string vacío (`lib/email/render.ts`):
        // les llegaría "¡Hola ! 👋". El saludo de este trigger tiene que
        // funcionar vacío — es la diferencia de público con `NUEVO_CLIENTE`,
        // donde el que se registra en la tienda sí dejó su nombre.
        { tipo: "titulo", texto: "¡Gracias por sumarte! 👋" },
        { tipo: "texto", texto: "Ya estás en la lista: vas a ser de los primeros en enterarte de las novedades y las promos." },
        // El bloque `cupon` acá es SEGURO, y esa es media razón de que el
        // trigger exista. Un run de `NUEVO_SUSCRIPTOR` siempre viene de una
        // captura nuestra ⇒ `aplicarCuponDelTrigger` o pisa el código con el
        // real de Tiendanube, o **elimina el bloque entero**. El texto de abajo
        // no llega nunca a una casilla tal cual está.
        // (En `NUEVO_CLIENTE` no se puede: ese trigger también dispara con el
        // webhook `customer/created`, donde el bloque queda intacto y saldría un
        // código que no existe en TN.)
        { tipo: "cupon", texto: "Tu cupón de bienvenida", codigo: "TUCUPON", ...cta("Usar el cupón", tienda) },
        ...botonSi("Ver la tienda", tienda),
      ],
    }),
  },
  {
    id: "auto-compra",
    nombre: "Gracias por tu compra",
    descripcion: "Sale sola una hora después de que se paga un pedido.",
    trigger: "COMPRA",
    esperaHoras: 1,
    arma: () => ({
      asunto: "¡Gracias por tu compra! 🛍️",
      bloques: [
        { tipo: "titulo", texto: "¡Gracias ${contacto.nombre}!" },
        { tipo: "texto", texto: "Ya estamos preparando tu pedido. Cualquier duda, escribinos." },
      ],
    }),
  },
  {
    id: "auto-carrito",
    nombre: "Carrito abandonado",
    descripcion: "Sale sola a las 3 horas de un carrito que quedó sin pagar.",
    trigger: "CARRITO_ABANDONADO",
    esperaHoras: 3,
    arma: () => ({
      asunto: "¿Te olvidaste de algo? 🛒",
      bloques: [
        { tipo: "titulo", texto: "Todavía estás a tiempo, ${contacto.nombre}" },
        { tipo: "texto", texto: "Dejaste esto en tu carrito. Completá tu compra antes de que se agote." },
        // El carrito real va ACÁ, entre el texto que lo anuncia y el botón. Sin
        // este bloque el procesador lo appendearía al final, después del botón:
        // "dejaste esto" seguido de nada, y los productos abajo del CTA.
        { tipo: "carrito", items: [] },
        // ${cart.url} lo reemplaza el procesador con el link real del checkout.
        { tipo: "boton", texto: "Completar mi compra", url: "${cart.url}" },
      ],
    }),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Resolución contra una cuenta
// ─────────────────────────────────────────────────────────────────────────────

/** Lo mínimo que hace falta saber de una cuenta para armar un preset. */
export interface CuentaPreset {
  nombre: string;
  config: unknown;
}

function resolver(d: DefPreset, ctx: CtxPreset): Preset {
  const { bloques, tema, estilos, asunto } = d.arma(ctx);
  return {
    id: d.id,
    nombre: d.nombre,
    descripcion: d.descripcion,
    trigger: d.trigger,
    esperaHoras: d.esperaHoras ?? 0,
    asunto: asunto ?? "",
    // Entra por la MISMA puerta que el contenido de la base: así lo que se
    // guarda ya nace en la versión actual del esquema, con ids propios y con la
    // cabecera de marca puesta. Un preset que se guardara sin pasar por acá
    // sería el único documento del sistema en un formato viejo.
    contenido: leerContenido({ bloques, tema, estilos }),
  };
}

/**
 * Todos los presets, resueltos contra una cuenta.
 *
 * `remitenteEmail` es el fallback del sitio de la tienda para las cuentas que
 * todavía no tienen `config.url` — ver `urlTiendaDe`.
 */
export function presetsPara(cuenta: CuentaPreset, remitenteEmail?: string | null): Preset[] {
  const ctx: CtxPreset = { marca: cuenta.nombre, tienda: urlTiendaDe(cuenta, remitenteEmail) };
  return DEFS.map((d) => resolver(d, ctx));
}

/** Los de la galería de /plantillas: todos menos los que dispara un evento. */
export function presetsGaleria(cuenta: CuentaPreset, remitenteEmail?: string | null): Preset[] {
  return presetsPara(cuenta, remitenteEmail).filter((p) => !p.trigger);
}

export function presetDe(id: string, cuenta: CuentaPreset, remitenteEmail?: string | null): Preset | undefined {
  const d = DEFS.find((x) => x.id === id);
  return d ? resolver(d, { marca: cuenta.nombre, tienda: urlTiendaDe(cuenta, remitenteEmail) }) : undefined;
}

/** El contenido inicial de una automation, con la marca que la crea adentro. */
export function presetDeTrigger(trigger: Trigger, cuenta: CuentaPreset, remitenteEmail?: string | null): Preset {
  const d = DEFS.find((x) => x.trigger === trigger);
  // No puede faltar: los tres triggers están cubiertos arriba y `Trigger` es una
  // unión cerrada. Si alguien agrega un trigger sin preset, que reviente acá y
  // no con una automation vacía llegándole a un cliente.
  if (!d) throw new Error(`Sin preset para el trigger ${trigger}`);
  return resolver(d, { marca: cuenta.nombre, tienda: urlTiendaDe(cuenta, remitenteEmail) });
}

/** Los ids que existen. Para las pruebas, que recorren todos. */
export const PRESET_IDS: readonly string[] = DEFS.map((d) => d.id);
