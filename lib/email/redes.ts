// Las redes sociales que el bloque `redes` sabe dibujar con icono.
//
// ⚠️ Puro: lo importan el renderer (servidor) y el formulario del editor
// (cliente). Sin prisma, sin next/headers, sin fs.
//
// 🔴 **Esta lista es exactamente el conjunto de archivos que existen en
// `public/redes/`.** No es un catálogo de aspiraciones: si acá entrara una red
// sin su PNG, el mail saldría con una imagen rota a la casilla de otra persona,
// que es peor que el texto que se dibujaba antes. Para sumar una red hacen falta
// las dos cosas — el archivo y la entrada de acá — y el orden correcto es
// archivo primero.

export interface Red {
  /** Nombre del archivo en `public/redes/<slug>.png` y llave estable del Json. */
  slug: string;
  /** Lo que se muestra en el editor y va al `alt` del icono. */
  nombre: string;
}

export const REDES: Red[] = [
  { slug: "instagram", nombre: "Instagram" },
  { slug: "tiktok", nombre: "TikTok" },
  { slug: "whatsapp", nombre: "WhatsApp" },
  // Las cuatro del 1-ago-2026. Salen de la primera tanda de referencias: 20 de
  // los 21 mails cierran con una fila de iconos, y con solo tres archivos la
  // mitad de esa fila salía en texto al lado de los que sí tenían icono — que
  // se ve peor que el bloque entero en texto. Mismo formato que los tres
  // primeros: pastilla de 96px con el color oficial y el glifo en blanco.
  { slug: "facebook", nombre: "Facebook" },
  { slug: "youtube", nombre: "YouTube" },
  { slug: "x", nombre: "X" },
  { slug: "pinterest", nombre: "Pinterest" },
  // 🔴 El sitio web, 5-ago-2026. No es una red más: era **el agujero** de la
  // lista. Un comercio que quiere cerrar el mail con su propia web no tenía
  // ninguna opción que la dibujara, así que la única salida era "Otra (sin
  // icono)" y el mail salía con la palabra «Otra» en texto al lado de los
  // iconos. Lo reportó la diseñadora armando un mail de verdad.
  { slug: "web", nombre: "Sitio web" },
];

/**
 * Cómo se dibujan los iconos de un bloque `redes`.
 *
 * **Ausente = `marca`**, los PNG de color oficial de siempre: cualquier otro
 * default le cambiaría el cierre a todo mail ya guardado.
 *
 * `pleno` los dibuja en un solo color, y **cuál lo decide el renderer** según el
 * fondo (`Paleta.esOscuro`), nunca quien arma el mail. Es exactamente el mismo
 * criterio que los iconos de celda de `columnas` (`iconos.ts`): un PNG no se
 * tiñe, así que ofrecer "blanco o negro" a mano es ofrecer la forma de dejar un
 * icono blanco sobre fondo blanco.
 */
export type EstiloIconos = "marca" | "pleno";

/**
 * ¿Este nombre de red tiene icono? Devuelve `undefined` si no lo conocemos.
 *
 * El campo `red` del bloque era **texto libre** antes de que existiera el
 * selector, así que en la base ya hay valores escritos a mano ("Instagram",
 * "instagram", y lo que se le haya ocurrido a quien lo cargó). Se compara
 * normalizado para que esos sigan funcionando sin migrar ningún Json: lo que no
 * matchee cae al texto de siempre.
 */
export function redConIcono(nombre: string | undefined): Red | undefined {
  // 🔴 La normalización va de LOS DOS LADOS. Hasta el 5-ago-2026 el lado del
  // catálogo era un `toLowerCase()` pelado, y como ningún nombre tenía espacio
  // nadie lo notó: la primera red con nombre de dos palabras —"Sitio web"—
  // quedaba sin icono, porque del texto de entrada se sacaban los espacios y
  // del nombre no. Lo agarró `probar-redes.ts` el mismo día.
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "");
  const k = norm(nombre ?? "");
  if (!k) return undefined;
  return REDES.find((r) => r.slug === k || norm(r.nombre) === k);
}

/**
 * La URL absoluta del icono. Sin `base` no hay icono: ver el comentario del renderer.
 *
 * ⚠️ En `pleno`, el sufijo es el color de la **tinta**, no el del fondo:
 * `x-claro.png` es el icono claro, que es el que va sobre fondo oscuro. Mismo
 * criterio (y mismos nombres) que `urlIconoCelda` en `iconos.ts`.
 */
export function urlIcono(
  base: string | undefined,
  red: Red,
  estilo: EstiloIconos = "marca",
  oscuro = false,
): string | undefined {
  const b = (base ?? "").replace(/\/+$/, "");
  if (!b) return undefined;
  const suf = estilo === "pleno" ? (oscuro ? "-claro" : "-oscuro") : "";
  return `${b}/redes/${red.slug}${suf}.png`;
}
