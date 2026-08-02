// Lo que comparten todas las familias de plantillas: los tipos y las piezas que
// se repiten en cada preset.
//
// Vive aparte de `presets.ts` para romper el ciclo: `presets.ts` importa las
// familias y las familias necesitan `DefPreset` y los helpers. Si esos tipos
// vivieran en `presets.ts`, cada familia importaría a quien la importa.
//
// ⚠️ Puro: no importa prisma ni next/headers. Lo lee el servidor (crear campaña)
// y el navegador (las miniaturas de /plantillas).

import type { Bloque } from "@/lib/email/render";
import type { Estilos } from "@/lib/email/estilos";
import type { Tema } from "@/lib/email/tema";
import type { Trigger } from "@/lib/automations";
import { foto, type ClaveFoto } from "./fotos";

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
export interface Armado {
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

/**
 * En qué pestaña de la galería aparece.
 *
 * Existe porque `/plantillas` **renderiza solo la familia activa**: con 30+
 * plantillas, dibujar todas en cada visita manda más de un megabyte al navegador
 * de un comerciante que abre el panel desde el celular.
 *
 * Los presets de automation NO llevan familia: no salen en la galería.
 */
export type Familia = "venta" | "catalogo" | "producto" | "fechas" | "ciclo" | "editorial";

/** El orden de las pestañas y cómo se llaman en la UI. */
export const FAMILIAS: readonly { id: Familia; nombre: string; descripcion: string }[] = [
  { id: "catalogo", nombre: "Catálogo", descripcion: "Mostrar lo que vendés. Se llenan solas con tu tienda." },
  { id: "venta", nombre: "Venta", descripcion: "Ofertas, cupones y urgencia. Para vender hoy." },
  { id: "producto", nombre: "Producto", descripcion: "Un lanzamiento, un restock, un producto que merece su mail." },
  { id: "fechas", nombre: "Fechas", descripcion: "Las del calendario: Día de la Madre, Hot Sale, Navidad." },
  { id: "ciclo", nombre: "Ciclo de vida", descripcion: "Bienvenida, post-compra, reactivación, carrito." },
  { id: "editorial", nombre: "Editorial", descripcion: "Para escribir de verdad, no para vender." },
];

export interface DefPreset {
  id: string;
  nombre: string;
  descripcion: string;
  /** En qué pestaña de la galería va. Ausente = de automation, no sale ahí. */
  familia?: Familia;
  /** Solo los de automation: a qué evento de la tienda responden. */
  trigger?: Trigger;
  /** Solo los de automation: cuánto espera después del disparador. */
  esperaHoras?: number;
  arma: (ctx: CtxPreset) => Armado;
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
export const cta = (texto: string, url: string) => ({
  botonTexto: url ? texto : "",
  botonUrl: url,
});

/** El bloque rico que, por diseño, no lleva botón: es una banda de texto. */
export const sinBoton = { botonTexto: "", botonUrl: "" } as const;

/** Botón suelto, o nada. Mismo criterio que `cta`. */
export const botonSi = (texto: string, url: string, align: "left" | "center" = "left"): Bloque[] =>
  url ? [{ tipo: "boton", texto, url, align, full: false }] : [];

/**
 * Las redes de la marca.
 *
 * 🔑 **La lista va vacía y eso ES el mecanismo**, no una carencia: un bloque
 * `redes` sin links propios dibuja las de la CUENTA (`Cuenta.config.redes`, que
 * se cargan en `/remitentes`), resueltas al renderizar igual que el logo. Así la
 * misma plantilla cierra con las redes de cada marca sin guardar la cuenta de
 * nadie adentro del Json — que es la regla 1 de `PLANTILLAS.md`.
 *
 * ⚠️ Hasta el 1-ago-2026 el bloque venía con tres links VACÍOS y el renderer,
 * con razón, no dibuja un link vacío: estaba en 12 presets y **no dibujó nunca
 * nada**. La galería entera terminaba en un bloque invisible mientras 20 de las
 * 21 referencias de la primera tanda cierran con una fila de iconos.
 *
 * Una marca sin redes cargadas sigue sin dibujar el bloque, que es lo correcto:
 * un `href=""` en un mail ya enviado no se arregla.
 */
export const redes: Bloque = { tipo: "redes", links: [] };

export const aire = (alto: number): Bloque => ({ tipo: "espaciador", alto });

/**
 * La barra de navegación de arriba: 15 de las 21 referencias de la primera
 * tanda la tienen, y no la usaba ningún preset.
 *
 * ⚠️ Los tres links van a la **home** de la tienda, no a rutas inventadas. No es
 * pereza: las categorías de Tiendanube son de cada tienda y no hay path
 * garantizado — un `/ofertas` adivinado es un 404 en un mail ya enviado, que es
 * exactamente lo que `cta()` existe para evitar. Quien arma el mail cambia el
 * destino de cada uno en el editor; hasta entonces, los tres llevan a un lugar
 * que existe.
 *
 * Sin tienda cargada no hay bloque: el renderer filtra los links sin URL, así
 * que un menú entero sin links sería un bloque invisible.
 */
export const menuTienda = (tienda: string, estilo?: Bloque["estilo"]): Bloque[] =>
  tienda
    ? [
        {
          tipo: "menu",
          links: [
            { texto: "Novedades", url: tienda },
            { texto: "Más vendidos", url: tienda },
            { texto: "Ofertas", url: tienda },
          ],
          ...(estilo ? { estilo } : {}),
        },
      ]
    : [];

/**
 * Una fila de 2 a 4 celdas de texto: título corto arriba, una línea abajo.
 *
 * Es la banda de beneficios ("Envíos a todo el país" · "12 cuotas" · "Cambios
 * sin cargo") que aparece en 15 de las 21 referencias. Va con `textos` y no con
 * imágenes a propósito: **una plantilla se tiene que ver llena sin que nadie
 * suba una foto** (regla 3).
 *
 * 🔑 El `icono` es de un catálogo nuestro (`lib/email/iconos.ts`), así que no es
 * una foto que el comerciante tenga que conseguir: es la parte de la banda que
 * las cinco referencias con ícono tienen y la nuestra no tenía. Sin clave, la
 * celda sale como salía.
 */
export const fila = (
  celdas: { titulo: string; texto: string; icono?: string }[],
  align: "left" | "center" = "center",
  estilo?: Bloque["estilo"],
): Bloque => ({
  tipo: "columnas",
  variante: "textos",
  celdas: celdas.map((c) => ({ imagen: "", url: "", titulo: c.titulo, texto: c.texto, ...(c.icono ? { icono: c.icono } : {}) })),
  // Centrada, que es como la dibujan las cinco referencias que la tienen (002 ·
  // 006 · 008 · 018 · 021). Se escribe explícito porque el `BASE` del rol trae
  // `align:"left"`: acá no alcanza con "no decir nada" — ver `alineacion()` en
  // `lib/email/estilos.ts`, donde ese default a la izquierda vive.
  //
  // El `estilo` del llamador se mezcla encima **por rol**, no por arriba de
  // todo: un spread plano le borraría el `align` a la fila entera, que es lo
  // único que esta pieza tiene que garantizar.
  estilo: {
    ...estilo,
    titulo: { align, ...estilo?.titulo },
    cuerpo: { align, ...estilo?.cuerpo },
  },
});

/**
 * La grilla que se llena sola con el catálogo, **como la dibujan las
 * referencias**: la tarjeta centrada y un botón propio abajo de cada precio.
 *
 * 🔑 Es lo que más separaba a los clones de su captura, y no la anatomía. Las
 * ocho referencias de la primera tanda que tienen grilla —002 · 006 · 007 · 008
 * · 010 · 012 · 019 · 020 · 021— la dibujan **centrada y con "Comprar" en cada
 * tarjeta**, sin una sola excepción. La nuestra alineaba a la izquierda y no
 * tenía botón; como la grilla ocupa media pantalla de cada mail, el mismo
 * esqueleto se leía distinto.
 *
 * ⚠️ **Solo las dos formas que la galería permite** (`tres` o el default de a
 * dos): `/plantillas` resuelve una consulta por `claveProductos` de la familia
 * activa, así que doce presets con su propio `n` convierten una pestaña de 2-3
 * llamadas a Tiendanube en una de 10.
 *
 * ⚠️ El `boton` va **vacío por default**, no con "Comprar" puesto: los presets
 * que no clonan ninguna referencia (`tienda`, `ecommerce`, `novedades`,
 * `grilla`, los de ciclo) siguen como estaban. Un default nuevo les cambiaría la
 * cara a todos sin que nadie lo haya pedido.
 */
export const grilla = (
  fuente: "destacados" | "recientes" | "oferta",
  opts: { tres?: boolean; boton?: string; estilo?: Bloque["estilo"] } = {},
): Bloque => ({
  tipo: "productos-dinamicos",
  fuente,
  ...(opts.tres ? { n: 6, porFila: 3 } : { n: 4 }),
  movil: 2,
  ...(opts.boton ? { botonTexto: opts.boton } : {}),
  // El `estilo` del llamador se mezcla ENCIMA, pero el `align` centrado se
  // queda: es la forma de la grilla en las once referencias, no una preferencia
  // de un preset.
  estilo: { ...opts.estilo, cuerpo: { align: "center", ...opts.estilo?.cuerpo } },
});

/**
 * La banda de color que se tiñe sola con el tema de la marca.
 *
 * 🔑 `bg: ""` es el punto: el renderer cae a `pal.seccion`, que sale del tema
 * (beige `#faf7f0` en claro, `#1f1f1f` en oscuro). Hasta el 1-ago-2026 los
 * presets clavaban el hex a mano —`#f0fdf4`, `#fff7ed`, `#f5f7ff`— y esos tintes
 * se veían como manchas ajenas en una marca con acento propio, y peor en una con
 * tema oscuro: la misma plantilla salía igual en las tres marcas en vez de
 * parecerse a cada una.
 *
 * Un color se clava **solo cuando el color ES la plantilla** (la invitación de
 * fondo negro, el carrito oscuro), y ahí va anotado por qué.
 */
export const banda = (titulo: string, texto: string): Bloque =>
  ({ tipo: "seccion", bg: "", titulo, texto, ...sinBoton });

// ─────────────────────────────────────────────────────────────────────────────
// Las piezas con foto del pack de stock
//
// Existen para que un preset con portada, fila de categorías y banda sean veinte
// líneas y no sesenta — y sobre todo para que **el truco del velo esté escrito
// una sola vez**. Ver `fotos.ts` para dónde viven las fotos y por qué.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El color del velo de toda banda con foto: **oscuro fijo, en los dos temas**.
 *
 * 🔴 Es la única excepción a la regla 4 que no depende de la plantilla, y la
 * razón es que **el velo no es un tinte de marca: es la condición para que el
 * texto se lea sobre una foto**. Con un token pasa lo siguiente:
 *
 * - `$texto` se porta perfecto en una marca clara (casi negro ⇒ oscurece) y **al
 *   revés en una oscura**: casi blanco ⇒ aclara la foto y deja una banda lavada
 *   adentro de un mail negro. Es el mismo rectángulo blanco gigante que hizo
 *   rechazar la portada de la bienvenida de BDI, verificado el 2-ago-2026
 *   mirando `audio` (tema oscuro) renderizada.
 * - `$fondo` y `$tarjeta` hacen exactamente lo mismo, invertido.
 * - `$acento` pinta el velo del color de la marca: en `audio` sería un velo
 *   amarillo sobre la foto.
 *
 * Ningún token del tema es oscuro en los dos temas, así que el velo se clava. El
 * contraste del título lo calcula `bandaConFoto` contra este mismo color ⇒ sale
 * claro siempre, que es lo que hacen 13 de las 21 referencias.
 */
const VELO = "#111111";

/**
 * La portada con foto de fondo y el texto encima.
 *
 * 🔑 **`bg: ""` + `estilo.caja.fondo` es el punto**: `colorCss()` solo acepta hex
 * (`render.ts:65`), así que `hero.bg` **no** toma `$acento` ni ningún token —
 * escribir un token ahí es un color inválido que cae al fallback. La caja sí los
 * toma (`bg = c.autoFondo ? b.bg || pal.tarjeta : c.fondo!`), y ese mismo color
 * es el que `bandaConFoto` usa para tres cosas a la vez: el velo, el respaldo
 * cuando la foto no carga, y el contraste del título.
 *
 * El velo va en 55: sin él, un título claro sobre una foto clara desaparece, que
 * es lo que hizo descartar esta portada en Zattia (ver `bloques.ts`, campo
 * `velo`, sobre por qué el DEFAULT del campo tiene que seguir siendo 0).
 */
export const portada = (
  clave: ClaveFoto,
  o: {
    titulo: string;
    subtitulo: string;
    boton?: { texto: string; url: string };
    alto?: number;
    velo?: number;
    /**
     * El color del velo. Por defecto el oscuro fijo; **la única razón para
     * pasarlo es una portada de texto NEGRO sobre una foto clara**, que es como
     * la dibujan R-018 y R-020. Ahí el velo tiene que aclarar y no oscurecer, y
     * de este mismo color sale el contraste que el renderer le calcula al
     * título — pasarle `#ffffff` es lo que hace que salga oscuro.
     */
    veloColor?: `#${string}`;
    /** Dónde va el texto adentro de la portada. Ausente = centrado, como siempre. */
    align?: "left" | "center" | "right";
    /** Overrides finos de la portada (tamaño del título, padding de la caja). */
    estilo?: Bloque["estilo"];
  },
): Bloque => ({
  tipo: "hero",
  imagen: "",
  fondoImagen: foto(clave),
  titulo: o.titulo,
  subtitulo: o.subtitulo,
  alto: o.alto ?? 300,
  velo: o.velo ?? 55,
  bg: "",
  estilo: {
    ...o.estilo,
    caja: { fondo: o.veloColor ?? VELO, ...(o.align ? { align: o.align } : {}), ...o.estilo?.caja },
  },
  ...(o.boton ? cta(o.boton.texto, o.boton.url) : sinBoton),
});

/**
 * La fila de categorías: foto arriba, cómo se llama debajo.
 *
 * La pide **10 de las 21 referencias** de la primera tanda y es la pieza que más
 * "llena" una plantilla sin que el comerciante suba nada.
 *
 * ⚠️ Los links van todos a la **home**, igual que `menuTienda` y por la misma
 * razón: las categorías son de cada tienda y un `/ofertas` adivinado es un 404 en
 * un mail ya enviado. Quien arma el mail les cambia el destino en el editor.
 *
 * 🔑 El tope es 4 (`CantidadCeldas`): a 600px, cinco celdas dan 104px por columna
 * y no se leen. R-002 usa cinco y se aproxima con cuatro.
 *
 * `boton` es el texto del botón propio de la celda (R-015, R-018, R-021). Sin
 * texto no se dibuja, y con botón la celda **deja de ser un ancla entera** — eso
 * lo resuelve el renderer, acá solo se pide.
 */
export const categorias = (
  tienda: string,
  celdas: { clave: ClaveFoto; titulo: string; boton?: string }[],
  estilo?: Bloque["estilo"],
): Bloque => ({
  tipo: "columnas",
  ...(estilo ? { estilo } : {}),
  celdas: celdas.map((c) => ({
    imagen: foto(c.clave),
    url: tienda,
    titulo: c.titulo,
    // Mismo criterio que `cta`: sin tienda cargada no hay botón, y sin botón la
    // celda vuelve a ser el ancla de siempre.
    ...(c.boton ? cta(c.boton, tienda) : {}),
  })),
});

/**
 * La banda con foto de fondo en el MEDIO del mail (no la portada): la que usa la
 * marca para contar quién es. Aparece en 4 de las 21 referencias.
 *
 * Comparte con `portada()` el truco del velo —es el mismo `bandaConFoto` del
 * renderer— y por eso comparte el comentario: ver arriba.
 */
export const bandaFoto = (
  clave: ClaveFoto,
  titulo: string,
  texto: string,
  boton?: { texto: string; url: string },
  alto = 220,
  estilo?: Bloque["estilo"],
): Bloque => ({
  tipo: "seccion",
  bg: "",
  fondoImagen: foto(clave),
  titulo,
  texto,
  alto,
  velo: 55,
  estilo: { ...estilo, caja: { fondo: VELO, ...estilo?.caja } },
  ...(boton ? cta(boton.texto, boton.url) : sinBoton),
});

/**
 * La barra fina de aviso de arriba de todo ("Envío gratis a partir de…").
 *
 * Es un `seccion` **sin título**, que es lo que la deja en una línea. Se pudo
 * recién el 2-ago-2026: hasta entonces el `<p>` tenía `margin:0 0 16px` cableado
 * y la barra salía 16px más alta de lo que pedía su padding, sin forma de
 * achicarla desde el panel.
 *
 * El color sale de `pal.seccion` (regla 4): en una marca clara es el beige del
 * tema y en una oscura el gris oscuro. Un `#f5f5f5` clavado sería una mancha.
 */
export const barra = (texto: string, bg: "" | `#${string}` = ""): Bloque => ({
  tipo: "seccion",
  bg,
  titulo: "",
  texto,
  ...sinBoton,
  estilo: { caja: { padY: 10 }, subtitulo: { tamano: 14 } },
});
