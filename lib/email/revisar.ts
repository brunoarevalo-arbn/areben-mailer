/**
 * Lo que hay que mirar antes de que un mail salga.
 *
 * 🔴 **Existe porque el cartel del panel no alcanza.** `PanelEstilo` avisa del
 * bloque que está ABIERTO, y el `$fondo` que dejó los seis nombres de producto
 * invisibles en el T01 de BDI vivía en un bloque que nadie había vuelto a abrir.
 * Un aviso que hay que ir a buscar no frena nada: la red tiene que estar en el
 * momento de apretar Enviar, y para eso hace falta recorrer el documento
 * entero.
 *
 * 🔑 **No decide nada, sólo cuenta lo que ve.** El motor sigue obedeciendo un
 * color elegido —es el mail de quien lo arma— y esto no bloquea ningún envío:
 * lo que devuelve es lo que la pantalla nombra antes de confirmar. La misma
 * decisión que ya tomó `contraste.ts`, un nivel más arriba.
 *
 * ⚠️ **Puro y sin prisma**: lo importa el cliente (los dos editores). Todo lo
 * que necesita llega por parámetro.
 */
import type { Bloque, ContenidoCampania, TipoBloque } from "./bloques";
import { ETIQUETA_BLOQUE } from "./bloques";
import { avisarContraste, ratioEnTexto, sobreDeRol, superficieDe, type AvisoContraste } from "./contraste";
import { ROL_LABEL, ocultoEnTodas, resolverEstilo, type RolEstilo } from "./estilos";
import { redConIcono, urlIcono } from "./redes";
import { combinarTema, resolverPaleta, type Tema } from "./tema";
import { textoPlano, type TextoRico } from "./texto-rico";

/** Un texto del mail que no se lee, con dónde está para poder ir a arreglarlo. */
export interface HallazgoContraste {
  /** El `id` del bloque: es lo que el editor usa para seleccionarlo. */
  bloqueId: string;
  /** Su lugar en el documento, empezando en 1 — para nombrarlo si no hay más. */
  posicion: number;
  tipo: TipoBloque;
  /** "Grilla de productos", lo mismo que muestra el editor. */
  etiqueta: string;
  rol: RolEstilo;
  aviso: AvisoContraste;
}

/** Lo que hace falta saber de la marca para leer el documento como lo lee el mail. */
export interface OpcionesRevision {
  /** El tema de la cuenta. El de la campaña le gana campo por campo. */
  temaMarca?: Tema | null;
  /**
   * El logo de la tienda. Cambia una sola respuesta, pero la cambia entera: con
   * logo cargado, el `encabezado` **no dibuja el nombre**, y avisar del color de
   * un texto que no existe es la clase de ruido que hace que nadie lea el
   * cartel.
   */
  logoCuenta?: string;
  /** De dónde salen los íconos de `redes`. Sin esto, el bloque cae al texto. */
  assetsBase?: string;
  /** Las redes de la cuenta, que son las que dibuja un bloque sin links propios. */
  redesMarca?: { red: string; url: string }[];
}

/** ¿Este campo de texto tiene algo que leer? */
const hay = (v: TextoRico | undefined): boolean => !!v && textoPlano(v).trim() !== "";

/**
 * Los roles que este bloque **de verdad dibuja**, con el contenido que tiene
 * puesto ahora.
 *
 * 🔑 **No es `ROLES_POR_TIPO`, y la diferencia es el punto entero.** Esa tabla
 * contesta "qué controles ofrece el panel para este tipo", que es una pregunta
 * de TIPO. Acá la pregunta es de INSTANCIA: una portada sin bajada no dibuja
 * ningún subtítulo, y un color de subtítulo elegido en la capa de documento
 * —que aplica a todos los bloques a la vez— haría cantar el aviso en cada una
 * de las portadas del mail por un texto que no existe.
 *
 * ⚠️ **Es un espejo de las condiciones del renderer**, igual que `superficieDe`:
 * cada `if` de acá tiene su `case` en `render.ts`. Si se separan, el aviso
 * miente — por eso `probar-contraste.ts` cruza cada caso contra el HTML real.
 */
export function rolesDibujados(b: Bloque, opts: OpcionesRevision = {}): readonly RolEstilo[] {
  switch (b.tipo) {
    // Con logo no hay texto: el nombre de la marca sólo se dibuja cuando no hay
    // ninguna imagen que poner (ver los tres estados en `render.ts`).
    case "encabezado": {
      const logo =
        b.variante === "logo"
          ? b.logo?.trim() || opts.logoCuenta
          : b.variante === "texto"
            ? ""
            : opts.logoCuenta;
      return logo ? [] : ["titulo"];
    }
    case "titulo":
      return hay(b.texto) ? ["titulo"] : [];
    case "texto":
      return hay(b.texto) ? ["cuerpo"] : [];
    case "boton":
      return hay(b.texto) ? ["boton"] : [];
    // La grilla: el nombre va en `cuerpo`, el tachado y la variante en `nota`.
    // 🔴 Es el bloque del T01 y el `cuerpo` es el rol que salió invisible.
    case "productos":
      return b.items?.length ? grillaRoles(b.precioOculto, b.botonTexto, b.porFila, b.items) : [];
    // Los productos llegan de Tiendanube al renderizar, así que acá no hay lista
    // que mirar: se lo trata como que dibuja. Un aviso de más en un bloque que
    // esa mañana vuelve vacío es infinitamente más barato que callarse en el que
    // sí sale.
    case "productos-dinamicos":
      return grillaRoles(b.precioOculto, b.botonTexto, b.porFila);
    // Ídem: el carrito real lo llena el procesador. Su nombre va en `titulo`.
    case "carrito":
      return ["titulo", "precio", "nota"];
    case "columnas": {
      const variante = b.variante ?? "imagenes";
      const todas = b.celdas ?? [];
      const esImagen = (i: number) =>
        variante === "imagenes" ||
        (variante === "imagen-texto" && i === 0) ||
        (variante === "texto-imagen" && i === todas.length - 1);
      // El mismo filtro del renderer: una celda sin nada no reserva lugar.
      const celdas = todas
        .map((c, i) => ({ c, img: esImagen(i) }))
        .filter(({ c, img }) => !!c.botonTexto || (img ? !!c.imagen : !!(c.titulo || c.texto || c.icono)));
      const roles: RolEstilo[] = [];
      // En una celda de imagen el título es la ETIQUETA de abajo de la foto, y
      // se dibuja igual: los dos caminos usan el rol `titulo`.
      if (celdas.some(({ c }) => hay(c.titulo))) roles.push("titulo");
      if (celdas.some(({ c, img }) => !img && hay(c.texto))) roles.push("cuerpo");
      if (celdas.some(({ c }) => hay(c.botonTexto))) roles.push("boton");
      return roles;
    }
    // La pastilla "▶ Ver el video" se dibuja con el rol `boton`, y sólo si hay
    // miniatura: sin `imagen` el bloque entero desaparece.
    case "video":
      return b.imagen ? ["boton"] : [];
    case "menu":
      return (b.links ?? []).some((l) => l.url && l.texto) ? ["cuerpo"] : [];
    case "hero":
      return bandaRoles(hay(b.titulo), hay(b.subtitulo), hay(b.botonTexto));
    // 🔑 El texto de una sección se dibuja con el rol **subtitulo**, no con
    // `cuerpo`: es la otra mitad del par título/bajada que comparte con la
    // portada. Mirar el nombre del campo y no el del rol daría un aviso sobre
    // un color que ese texto no usa.
    case "seccion":
      return bandaRoles(hay(b.titulo), hay(b.texto), hay(b.botonTexto));
    // Los roles salen de los elementos que HAY, no de los tres que el bloque
    // podría tener: una foto con un solo botón encima no dibuja ningún título, y
    // un color de título elegido en la capa de documento haría cantar el aviso
    // por un texto que no existe. Es la misma pregunta de instancia de arriba.
    // ⚠️ El aviso igual se calla siempre en este bloque: ver `sobreFoto`.
    case "foto-encima": {
      const vivos = (b.elementos ?? []).filter((el) => hay(el.texto));
      const roles: RolEstilo[] = [];
      if (vivos.some((el) => el.clase === "titulo")) roles.push("titulo");
      if (vivos.some((el) => el.clase === "texto")) roles.push("cuerpo");
      if (vivos.some((el) => el.clase === "boton")) roles.push("boton");
      return roles;
    }
    /**
     * Lo único que este bloque dibuja con TEXTO es la fecha escrita de abajo del
     * PNG, y va con el rol `cuerpo`.
     *
     * 🔑 Y es justo el renglón que más importa que se lea: es lo que queda
     * cuando el cliente de mail bloquea las imágenes. Los números no entran acá
     * —los dibuja el endpoint, sobre el fondo de la casilla, con una tinta que
     * el renderer recalcula por luminancia y que nadie puede dejar ilegible.
     */
    case "regresiva":
      return b.hasta ? ["cuerpo"] : [];
    // El código del cupón va en `titulo` (y no se recalcula: es color de marca).
    case "cupon": {
      const roles: RolEstilo[] = [];
      if (hay(b.texto)) roles.push("cuerpo");
      // El descuento y la letra chica: los roles salen de los campos que HAY,
      // igual que en `foto-encima`. Un cupón sin `destacado` no dibuja nada en
      // `precio`, y hacer cantar el aviso de contraste por un texto que no
      // existe es la misma falla que el aviso sobre un título ausente.
      if (hay(b.destacado)) roles.push("precio");
      if (b.codigo?.trim()) roles.push("titulo");
      if (hay(b.botonTexto)) roles.push("boton");
      if (hay(b.condiciones)) roles.push("nota");
      return roles;
    }
    /**
     * Las redes dibujan ÍCONOS, y el color del rol `cuerpo` es el respaldo:
     * sale sólo cuando la red no tiene ícono o no hay de dónde bajarlo. Es el
     * caso raro, pero es exactamente el caso en el que el color importa.
     */
    case "redes": {
      const propios = (b.links ?? []).filter((l) => l.url);
      const lista = propios.length ? propios : opts.redesMarca ?? [];
      const conIcono = (nombre: string) => {
        const red = redConIcono(nombre);
        return !!red && !!urlIcono(opts.assetsBase, red, b.iconos);
      };
      return lista.some((l) => !conIcono(l.red)) ? ["cuerpo"] : [];
    }
    /**
     * ⛔ Los que quedan afuera: `imagen`, `divisor` y `espaciador` no dibujan
     * texto, y el `html` es de quien lo escribió —con sus colores adentro, que
     * el motor no conoce y no va a adivinar.
     *
     * `mosaico` también: es una foto cortada en pedazos y no dibuja **una sola
     * letra**. Su riesgo es el opuesto al del contraste —que con las imágenes
     * apagadas no se lea NADA— y eso no se mide con un ratio: lo cobra el editor
     * contando los pedazos sin texto alternativo.
     */
    default:
      return [];
  }
}

/**
 * Los roles de una grilla de productos, que son los mismos en las dos versiones.
 *
 * ⚠️ **La `nota` depende de los PRODUCTOS, no del bloque**: es el renglón de la
 * variante ("Talle M — 2 u.") y el precio tachado, así que una grilla de tres
 * productos sin variante y sin promo no dibuja ni una. Con la lista a la vista
 * se mira; sin ella —los dinámicos, que los trae Tiendanube al renderizar— se
 * asume que sí.
 */
function grillaRoles(
  precioOculto?: boolean,
  botonTexto?: string,
  porFila?: number,
  items?: readonly { variante?: string; cantidad?: number; precioPromo?: string }[],
): RolEstilo[] {
  const detalle = !items || items.some((p) => p.variante || (p.cantidad ?? 1) > 1);
  const tachado = !precioOculto && (!items || items.some((p) => p.precioPromo));
  const roles: RolEstilo[] = ["cuerpo"];
  if (detalle || tachado) roles.push("nota");
  if (!precioOculto) roles.push("precio");
  // Con cuatro por fila el botón no viaja: a 118px de celda no entra y Outlook
  // lo parte en dos renglones (ver `renderProductos`).
  if (botonTexto?.trim() && porFila !== 4) roles.push("boton");
  return roles;
}

/** Portada y sección dibujan el mismo trío. */
function bandaRoles(titulo: boolean, bajada: boolean, boton: boolean): RolEstilo[] {
  const roles: RolEstilo[] = [];
  if (titulo) roles.push("titulo");
  if (bajada) roles.push("subtitulo");
  if (boton) roles.push("boton");
  return roles;
}

/**
 * El fondo propio de una portada o una sección. Es la mitad de la superficie que
 * `superficieDe` no puede adivinar, porque `bg` es un campo del bloque.
 */
function bgDe(b: Bloque): string | undefined {
  return b.tipo === "hero" || b.tipo === "seccion" || b.tipo === "foto-encima" ? b.bg : undefined;
}

/**
 * ¿El texto de este bloque se apoya sobre una FOTO?
 *
 * 🔑 Entonces no hay ratio que calcular y **hay que callarse**. Contra una banda
 * con foto de fondo el color de atrás lo pone la imagen (más el velo), no el
 * `bg`: medir contra el color de respaldo daría un número que no es el que ve
 * nadie, en las dos direcciones. Es la misma regla que ya tiene `contraste()`
 * cuando le pasan algo que no es un color: `null` antes que inventar.
 */
function sobreFoto(b: Bloque): boolean {
  if (b.tipo === "foto-encima") return !!b.foto;
  return (b.tipo === "hero" || b.tipo === "seccion") && !!b.fondoImagen;
}

/**
 * Todos los textos del documento que no se leen sobre lo que tienen atrás.
 *
 * Recorre bloque por bloque resolviendo la cascada **igual que el renderer** —
 * misma paleta, mismo `sobre` por rol, misma superficie—, así que un hallazgo de
 * acá es un texto que de verdad va a salir así. Vacío significa que no hay nada
 * que avisar, que es el caso de las 38 plantillas propias.
 */
export function revisarContraste(
  contenido: ContenidoCampania,
  opts: OpcionesRevision = {},
): HallazgoContraste[] {
  const pal = resolverPaleta(combinarTema(opts.temaMarca, contenido.tema));
  const hallazgos: HallazgoContraste[] = [];

  (contenido.bloques ?? []).forEach((b, i) => {
    // Un bloque escondido en las dos vistas no lo ve nadie: no se dibuja en el
    // mail y tampoco tiene por qué frenar un envío.
    if (ocultoEnTodas(b.estilo, contenido.estilos)) return;
    if (sobreFoto(b)) return;

    const ctx = { pal, doc: contenido.estilos, propio: b.estilo };
    const caja = resolverEstilo(b.tipo, "caja", ctx);
    const bg = bgDe(b);
    const superficie = superficieDe(b.tipo, caja, pal, bg);

    for (const rol of rolesDibujados(b, opts)) {
      const sobre = sobreDeRol(b.tipo, rol, caja, pal, bg);
      const e = resolverEstilo(b.tipo, rol, ctx, sobre);
      // El botón se mide contra SU fondo: es la única parte del mail que trae
      // la suya puesta. Igual que en el panel.
      const fondo = rol === "boton" ? e.fondo ?? superficie : superficie;
      const aviso = avisarContraste(e.color, fondo, e.elegidas.has("color") || e.elegidas.has("fondo"));
      if (aviso)
        hallazgos.push({
          bloqueId: b.id ?? "",
          posicion: i + 1,
          tipo: b.tipo,
          etiqueta: ETIQUETA_BLOQUE[b.tipo],
          rol,
          aviso,
        });
    }
  });

  return hallazgos;
}

/** Los que no se ven — el corte que decide si la pantalla pregunta o sólo avisa. */
export const invisiblesDe = (hs: readonly HallazgoContraste[]): HallazgoContraste[] =>
  hs.filter((h) => h.aviso.nivel === "invisible");

/** "Grilla de productos — el texto (1,00:1)", que es como se nombra en las dos pantallas. */
export const hallazgoEnTexto = (h: HallazgoContraste): string =>
  `${h.etiqueta} — ${ROL_LABEL[h.rol].toLowerCase()} (${ratioEnTexto(h.aviso.ratio)})`;

/**
 * Lo que se le pregunta a una persona antes de mandar, o `null` si no hay nada
 * que preguntar.
 *
 * 🔑 **Sólo lo INVISIBLE interrumpe.** Un "flojo" se muestra en el cartel y no
 * frena a nadie: son grises elegidos a propósito —cinco de las 42 plantillas
 * propias tienen alguno— y una pregunta que aparece siempre se contesta sin
 * leerla, que es la forma más cara de no tener red.
 *
 * ⚠️ Devuelve el texto, no un `confirm`: quien pregunta es la pantalla. Acá vive
 * para que las cuatro puertas de envío y el botón de activar una automation
 * digan **lo mismo**, y para que el texto se pueda leer en un ensayo.
 */
export function preguntaAntesDeMandar(hs: readonly HallazgoContraste[]): string | null {
  const ciegos = invisiblesDe(hs);
  if (!ciegos.length) return null;
  const cuantos = ciegos.length === 1 ? "Hay un texto que no se ve" : `Hay ${ciegos.length} textos que no se ven`;
  return `⚠️ ${cuantos} sobre su fondo:\n\n${ciegos.map((h) => `· ${hallazgoEnTexto(h)}`).join("\n")}\n\nVa a llegar así a la casilla de cada persona.`;
}
