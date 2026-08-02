// Los íconos que una celda de `columnas` sabe dibujar arriba de su título.
//
// Es la banda de beneficios —"Envíos a todo el país" · "12 cuotas" · "Cambios
// sin cargo"— que aparece con ícono en **cinco** de las 21 referencias de la
// primera tanda (R-002, R-006, R-008, R-018 y R-021). Nuestra versión era solo
// texto, y al lado de la captura se veía floja: el ícono es lo que convierte
// tres frases sueltas en una banda.
//
// ⚠️ Puro: lo importan el renderer (servidor) y el formulario del editor
// (cliente). Sin prisma, sin next/headers, sin fs.
//
// 🔴 **Esta lista es exactamente el conjunto de archivos que existen en
// `public/iconos/`**, igual que `REDES`. Una clave sin su PNG es una imagen rota
// en la casilla de otra persona, y un mail enviado no se arregla. Para sumar
// un ícono van las dos cosas, y el orden es archivo primero
// (`scripts/dibujar-iconos.ts`).

export interface Icono {
  /** Nombre del archivo y llave estable del Json. */
  slug: string;
  /** Lo que se muestra en el editor y va al `alt`. */
  nombre: string;
}

/**
 * Los ocho del arranque: los cuatro que piden las cinco referencias (envío,
 * cuotas, cambios, atención) más los cuatro que aparecen una vez cada uno.
 *
 * ⚠️ No es un set de aspiraciones. Cada uno es un par de archivos que hay que
 * mantener, así que entra por lo mismo que un bloque nuevo: porque una
 * referencia lo pidió.
 */
export const ICONOS: Icono[] = [
  { slug: "envio", nombre: "Envío" },
  { slug: "tarjeta", nombre: "Cuotas / tarjeta" },
  { slug: "cambios", nombre: "Cambios y devoluciones" },
  { slug: "atencion", nombre: "Atención" },
  { slug: "seguro", nombre: "Compra protegida" },
  { slug: "regalo", nombre: "Regalo" },
  { slug: "descuento", nombre: "Descuento" },
  { slug: "calidad", nombre: "Calidad" },
];

/** ¿Esta clave tiene ícono? `undefined` si no la conocemos. */
export function iconoDe(clave: string | undefined): Icono | undefined {
  const k = (clave ?? "").trim().toLowerCase();
  return k ? ICONOS.find((i) => i.slug === k) : undefined;
}

/**
 * La URL absoluta del PNG.
 *
 * 🔑 **Dos variantes por ícono, y las elige el renderer, no el autor.** Un PNG
 * no se tiñe con CSS —no hay `filter` confiable en un mail—, así que un ícono
 * gris oscuro desaparece adentro de una plantilla de fondo negro. La pregunta
 * "¿el fondo es oscuro?" ya la responde `Paleta.esOscuro`, así que se responde
 * sola: quien arma el mail elige *qué* ícono, nunca *de qué color*.
 *
 * Sin `base` no hay ícono, igual que en `redes`: mejor la celda como estaba que
 * un `<img>` sin `src`.
 *
 * ⚠️ El sufijo del archivo es el color de la **tinta**, no el del fondo:
 * `envio-claro.png` es el ícono claro, que es el que va sobre fondo oscuro.
 */
export function urlIconoCelda(base: string | undefined, icono: Icono, oscuro: boolean): string | undefined {
  const b = (base ?? "").replace(/\/+$/, "");
  return b ? `${b}/iconos/${icono.slug}-${oscuro ? "claro" : "oscuro"}.png` : undefined;
}
