/**
 * Sobre qué se apoya cada texto del mail, y si se lee.
 *
 * 🔴 **Existe por el T01 de BDI (9-ago-2026), que salió a 501 personas con los
 * nombres de los productos INVISIBLES.** El bloque `productos` tenía
 * `estilo.cuerpo.color: "$fondo"` —el token del fondo de página— guardado a
 * mano, y el motor lo dibujó tal cual: contraste **1.00:1**, seis fundas sin
 * nombre. Nadie elige texto invisible, y no había nada que lo frenara.
 *
 * La cascada ya se cuida sola cuando **nadie eligió** el color: `resolverEstilo`
 * lo recalcula contra el fondo real (`tonosSobre`) y `probar-tema.ts` lo fija. El
 * agujero es el camino contrario, y es deliberado: *"si alguien lo eligió, se
 * respeta aunque quede ilegible — es su mail"*. Eso no cambia. Lo que cambia es
 * que ahora el panel lo puede **avisar** antes de que salga.
 *
 * Dos preguntas distintas, y por eso dos funciones:
 *
 *   `superficieDe`  →  el color que hay DETRÁS de este bloque. Siempre contesta.
 *   `sobreDeRol`    →  qué le pasa el renderer a `resolverEstilo` como `sobre`.
 *                      Contesta `undefined` para casi todo, porque el recálculo
 *                      automático vale sólo donde el renderer lo pide.
 *
 * La segunda es la que hace que **el panel y el mail no se puedan contradecir**:
 * hasta ahora el panel resolvía sin `sobre`, así que la pastilla "auto" de una
 * portada mostraba el color de la paleta mientras el mail dibujaba otro.
 */
import type { TipoBloque } from "./bloques";
import type { EstiloResuelto, RolEstilo } from "./estilos";
import type { Paleta } from "./tema";

/** Lo mínimo que hace falta saber de la caja de un bloque para ubicar su fondo. */
type Caja = Pick<EstiloResuelto, "autoFondo" | "fondo">;

/**
 * El color que hay detrás de un bloque.
 *
 * ⚠️ **Es el espejo literal de los cinco `case` del renderer que arman un `bg`**
 * (`render.ts`: encabezado, menu, hero, seccion, cupon). No es una regla nueva:
 * si acá dijera otra cosa, el aviso del panel sería mentira. Por eso el renderer
 * llama a ESTA función y no vuelve a calcularlo — una sola verdad.
 *
 * El default es la **tarjeta de contenido**, que es la superficie sobre la que
 * se dibuja todo lo demás. `pal.fondo` (el fondo de página) es la excepción del
 * `encabezado`, que se dibuja fuera de la tarjeta.
 *
 * ⛔ No mira `caja.fondo` fuera de esos cinco tipos: en los demás el panel ni
 * ofrece el control (`propsCaja`) y el renderer no lo pinta, así que tomarlo en
 * cuenta sería avisar contra un fondo que el mail no dibuja.
 */
export function superficieDe(tipo: TipoBloque, caja: Caja, pal: Paleta, bg?: string): string {
  switch (tipo) {
    // Se dibuja FUERA de la tarjeta: su fondo es el de la página.
    case "encabezado":
      return pal.fondo;
    case "hero":
      return caja.autoFondo ? bg || pal.tarjeta : caja.fondo!;
    case "seccion":
      return caja.autoFondo ? bg || pal.seccion : caja.fondo!;
    // La misma cuenta que el `hero`: `bg` es el respaldo de la banda Y el color
    // del velo, así que es lo que hay atrás del texto cuando la foto no carga.
    // ⚠️ Con la foto cargada atrás hay una FOTO, y ahí no se mide: `sobreFoto`
    // en `revisar.ts` calla el aviso. Esto sigue haciendo falta igual, porque es
    // lo que decide el color automático del título.
    case "foto-encima":
      return caja.autoFondo ? bg || pal.tarjeta : caja.fondo!;
    case "cupon":
      return caja.fondo ?? pal.cuponFondo;
    // Sin banda, el menú se apoya en la tarjeta como cualquier otro bloque.
    case "menu":
      return caja.autoFondo ? pal.tarjeta : caja.fondo!;
    default:
      return pal.tarjeta;
  }
}

/**
 * Los roles cuyo color el renderer recalcula contra la superficie del bloque.
 *
 * 🔑 **Es por ROL y no por bloque**, y las ausencias son reales: el título de un
 * `cupon` va en `$cuponTexto` —un color de marca, no un tono derivado— y el
 * botón de una portada trae su propio fondo, así que ninguno de los dos se
 * recalcula. Copiar la lista de tipos en vez de la de roles haría que el panel
 * mostrara un color que el mail no dibuja, que es el bug que esto cierra.
 *
 * Lo fija `probar-contraste.ts`, que renderiza cada par con un fondo extremo y
 * exige que el color se mueva **sólo** donde esta tabla lo promete.
 */
const ROLES_SOBRE: Partial<Record<TipoBloque, readonly RolEstilo[]>> = {
  encabezado: ["titulo"],
  menu: ["cuerpo"],
  hero: ["titulo", "subtitulo"],
  seccion: ["titulo", "subtitulo"],
  // El título y el texto que van ENCIMA de la foto: los dos se recalculan contra
  // el color de la banda. El botón no, igual que en la portada: trae su propio
  // fondo.
  "foto-encima": ["titulo", "cuerpo"],
  cupon: ["cuerpo"],
};

/**
 * Qué le pasa el renderer a `resolverEstilo` como cuarto parámetro.
 *
 * `undefined` significa "este rol no se recalcula": el color sale de la paleta.
 * Lo usa el panel para resolver **igual que el mail**.
 */
export function sobreDeRol(
  tipo: TipoBloque,
  rol: RolEstilo,
  caja: Caja,
  pal: Paleta,
  bg?: string,
): string | undefined {
  if (!ROLES_SOBRE[tipo]?.includes(rol)) return undefined;
  // El menú sólo es una banda cuando alguien le eligió fondo; sin eso el
  // renderer no pasa nada y el color sale de la paleta, como siempre.
  if (tipo === "menu" && caja.autoFondo) return undefined;
  return superficieDe(tipo, caja, pal, bg);
}

// ─────────────────────────────────────────────────────────────────────────────
// El número
//

/**
 * Luminancia relativa de WCAG. **No es `luminancia()` de `tema.ts`.**
 *
 * 🔴 Son dos cuentas distintas y confundirlas ya costó una lectura equivocada.
 * La de `tema.ts` pesa los canales **crudos** (Rec. 709 sobre 0-1) y sirve para
 * lo suyo —contestar "¿este color es oscuro?" para elegir el texto de encima—,
 * pero como ratio da números falsos: el primer cálculo del contraste del T01 dio
 * "3,09:1, flojo" con esa fórmula, cuando el real era otro. Un ratio necesita
 * **linealizar cada canal** antes de pesarlo, porque el sRGB de un `#rrggbb` no
 * es proporcional a la luz que sale de la pantalla.
 *
 * ⚠️ El 1.00:1 del bug sí daba bien con las dos fórmulas —dos colores iguales
 * dan 1 con cualquiera— y por eso el error no se notó.
 *
 * Devuelve `null` ante algo que no es un color, para que quien pregunte pueda
 * **callarse** en vez de inventar un número.
 */
function luminanciaWcag(hex: string): number | null {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * El ratio de contraste entre dos colores: **1 son idénticos**, 21 es negro
 * sobre blanco. `null` si alguno de los dos no se puede leer.
 */
export function contraste(a: string, b: string): number | null {
  const la = luminanciaWcag(a);
  const lb = luminanciaWcag(b);
  if (la === null || lb === null) return null;
  const [alto, bajo] = la > lb ? [la, lb] : [lb, la];
  return (alto + 0.05) / (bajo + 0.05);
}

/**
 * Los dos umbrales, y por qué no son los de WCAG.
 *
 * 🔑 **La vara acá no es la accesibilidad, es "¿esto se manda o no?".** WCAG AA
 * pide 4,5:1 y con ese corte el panel se pondría amarillo sobre decisiones de
 * diseño legítimas —el gris tenue de un pie mide 2,3:1 contra blanco y está en
 * todas las plantillas publicadas—, y un cartel que aparece siempre no lo lee
 * nadie. El aviso tiene que valer lo que cuesta mirarlo.
 *
 *   < 1,5  el texto **no se ve**: es el caso del T01
 *   < 3    se lee con dificultad
 *   ≥ 3    silencio
 */
export const CONTRASTE_INVISIBLE = 1.5;
export const CONTRASTE_FLOJO = 3;

export interface AvisoContraste {
  ratio: number;
  nivel: "invisible" | "flojo";
}

/**
 * ¿Hay que avisar por este par de colores?
 *
 * 🔑 **Sólo cuando una persona eligió alguno de los dos.** Lo que el motor pone
 * solo es problema del motor —y ya se recalcula donde hace falta—; avisar sobre
 * los defaults sería quejarse de las 38 plantillas propias en su primer render.
 * Es la misma pregunta que gobierna toda la cascada: *¿lo eligió alguien?*
 *
 * ⚠️ Alcanza con que hayan elegido **el fondo**, no sólo el color: un botón al
 * que se le cambia el fondo y se le deja el texto en automático se queda con el
 * `$sobreAcento`, que se calculó contra el **acento de la marca** y no contra el
 * fondo nuevo. Ahí el color no lo tocó nadie y el par igual queda ilegible.
 */
export function avisarContraste(
  texto: string,
  fondo: string,
  elegido: boolean,
): AvisoContraste | null {
  if (!elegido) return null;
  const ratio = contraste(texto, fondo);
  if (ratio === null || ratio >= CONTRASTE_FLOJO) return null;
  return { ratio, nivel: ratio < CONTRASTE_INVISIBLE ? "invisible" : "flojo" };
}

/** "1,04" — con coma, que es como se escribe todo lo demás del panel. */
export function ratioEnTexto(ratio: number): string {
  return `${ratio.toFixed(2).replace(".", ",")}:1`;
}
