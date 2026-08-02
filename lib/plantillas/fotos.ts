/**
 * El pack de fotos de las plantillas prearmadas.
 *
 * Por qué existe: la galería tiene que verse como un catálogo del que uno elige
 * —Perfit tiene 651 plantillas llenas de foto y color— y no como una lista de
 * bloques vacíos. La regla 3 de PLANTILLAS.md ("se tiene que ver llena sin que
 * nadie suba una foto") se resolvía hasta acá con `productos-dinamicos` + color,
 * que alcanza para que no se vea rota pero no para que dé ganas de usarla.
 *
 * 🔑 Este archivo es la ÚNICA fuente de verdad del pack: lo lee el código (los
 * presets, vía `foto()`), lo lee el script que sube (`subir-fotos-stock.ts`) y lo
 * lee la auditoría (`probar-fotos.ts`). Que "lo que está en el código" y "lo que
 * está en el store" se verifiquen leyendo UN archivo es todo el punto.
 *
 * ⛔ Ningún preset escribe una URL de imagen a mano. Va siempre `foto(clave)`, y
 * `probar-fotos.ts` pone en rojo cualquier URL que no arranque con `BASE`.
 *
 * ## Dónde viven las fotos
 *
 * Vercel Blob, store `mailer-imagenes` (el mismo del proyecto), bajo el prefijo
 * `stock/v1/`. Tres decisiones que no son obvias:
 *
 * - **Fuera de `mail/<cuentaId>/…`**, que es donde van las imágenes que sube un
 *   comerciante. Ese prefijo existe para poder borrar de un saque todo lo de una
 *   cuenta que se va; el stock no puede caer en esa red.
 * - **Sin fila en `ImagenMail`**, que es una tabla por cuenta. Con fila, el pack
 *   se duplicaría por comerciante, aparecería en su biblioteca —y un DELETE
 *   rompería las plantillas de TODOS— y le inflaría el contador de bytes, que
 *   existe para medir lo que consume él, no lo nuestro. Sin fila, el borrado
 *   desde la app es directamente inalcanzable: `/api/imagenes/[id]` borra por id
 *   de fila.
 * - **`v1` no es versionado semántico**: es la promesa de que un archivo
 *   publicado NUNCA se pisa. Las URLs quedan adentro de mails que ya están en la
 *   casilla de otra persona. Cambiar una foto es una clave nueva, no un
 *   `allowOverwrite`.
 *
 * ⚠️ Descartado guardarlas en `public/` del repo: los íconos de redes se pueden
 * porque se resuelven en el RENDER contra `assetsBase`, pero una foto adentro de
 * un bloque queda congelada en el Json cuando se instancia el preset. Atarla a un
 * dominio que varía por marca es garantizar mails rotos a futuro. Y `vercel
 * --prod` sube el directorio: serían 2,5 MB en cada deploy.
 *
 * ## De dónde salen
 *
 * Unsplash. La licencia permite uso comercial sin atribución. El criterio de
 * selección es más estricto que la licencia, y es por el contexto de envío:
 * ⛔ **sin caras reconocibles y sin logos de marca**, porque la plantilla la manda
 * un tercero a su propia lista y no controlamos con qué queda al lado. Por eso
 * quedaron afuera un montón de fotos buenas (perfumes Chanel, zapatillas Nike,
 * carteras Gucci, cosmética de marca).
 */

/**
 * El origen del store. Lo escribe el primer `put()`, y
 * `scripts/subir-fotos-stock.ts` verifica que cada `blob.url` que devuelve Blob
 * coincida exactamente con lo que arma `foto()`.
 *
 * 🔴 Si esto quedara mal, TODAS las plantillas con foto salen con el ícono roto.
 * Es el único error de este pack que llega a una casilla ajena, y por eso se
 * chequea en dos lugares: el script al subir y `probar-fotos.ts --red`.
 */
export const BASE_FOTOS =
  "https://80wkelaj24ephh6z.public.blob.vercel-storage.com/stock/v1";

/**
 * Los cuatro slots, con el tamaño en el que se baja cada foto.
 *
 * Los anchos salen del mail real: `pal.ancho` es 600 por default (700 el máximo)
 * y `pad()` mete 32px de cada lado, así que el contenido útil son 536px. Se baja
 * a ~1,4× ese ancho: alcanza para que no se vea blanda y no paga el doble.
 *
 * ⚠️ Medido, no estimado: a 1200px de ancho las portadas daban 85-108 KB y a
 * 1000px con q=50 dan 62-71 KB, sin diferencia visible a 600px de ancho. La
 * primera calibración (1200 / q=55) hacía fallar el tope, que es justamente lo
 * que el tope tiene que hacer.
 *
 * ⚠️ `fm=jpg` explícito y nada de `auto=format`: Unsplash devolvería WEBP a veces
 * y un mail necesita un JPEG de verdad (Outlook 2016 no dibuja WEBP). `cs=srgb`
 * porque Outlook no gestiona perfiles de color y una foto en Display P3 sale
 * lavada.
 *
 * `tope` es en bytes y lo hace cumplir el script: una foto que se pasa NO se sube
 * con menos calidad, falla ruidoso. El costo de una foto pesada no es el store,
 * es que se descarga una vez por destinatario.
 */
export const SLOTS = {
  /** Portada del mail: `hero.fondoImagen` y las imágenes a sangre. */
  portada: { w: 1000, h: 560, q: 45, tope: 88_000 },
  /**
   * Banda de sección con foto de fondo.
   *
   * 🔑 La `q` más baja de las cuatro, y no es descuido: una banda va SIEMPRE con
   * velo (45-55% de color encima), así que el detalle fino no se ve. Medido con
   * `banda-envios`, que es la más difícil —un depósito con estanterías es puro
   * detalle de alta frecuencia—: a q=50 pesa 111 KB y a q=35, 77 KB. Debajo del
   * velo son indistinguibles.
   */
  banda: { w: 1000, h: 380, q: 35, tope: 82_000 },
  /** Celda de `columnas`: entre 175px (4 celdas) y 268px (2 celdas). Cuadrada. */
  celda: { w: 640, h: 640, q: 55, tope: 65_000 },
  /** Packshot vertical, para el bloque `imagen` y las celdas imagen-texto. */
  producto: { w: 760, h: 950, q: 55, tope: 85_000 },
} as const;

export type Slot = keyof typeof SLOTS;

interface Foto {
  slot: Slot;
  /** El id de Unsplash, tal cual va en `images.unsplash.com/<origen>`. */
  origen: string;
  /**
   * El `alt`. No es decorativo: Outlook bloquea las imágenes por default y en
   * esa primera pasada el alt ES el contenido. Va en la tabla y no en cada
   * preset porque la foto no cambia de significado según dónde se use.
   */
  alt: string;
}

/**
 * Las 36. Las claves son semánticas (`portada-moda-1`), nunca el id de Unsplash:
 * un preset dice qué necesita, no qué archivo hay.
 */
const CATALOGO = {
  // ── Portadas ───────────────────────────────────────────────────────────────
  "portada-moda-1": {
    slot: "portada",
    origen: "photo-1441984904996-e0b6ba687e04",
    alt: "Interior de un local de ropa",
  },
  "portada-moda-2": {
    slot: "portada",
    origen: "photo-1441986300917-64674bd600d8",
    alt: "Vidriera de una tienda de ropa",
  },
  "portada-cuero-1": {
    slot: "portada",
    // ⚠️ La primera elección (photo-1607969891222) era un taller de
    // marroquinería y en miniatura parecía que el artesano estaba de espaldas;
    // al verla a tamaño real, la cara se reconoce. Por eso el criterio se
    // verifica mirando la foto grande, no el thumbnail.
    origen: "photo-1497031937139-3a0aad6859e9",
    alt: "Carteras de cuero en exhibición",
  },
  "portada-joyas-1": {
    slot: "portada",
    origen: "photo-1605100804763-247f67b3557e",
    alt: "Anillo sobre fondo oscuro",
  },
  "portada-deco-1": {
    slot: "portada",
    origen: "photo-1662733853648-329a0d258be4",
    alt: "Mesa de madera con una planta junto a la ventana",
  },
  "portada-tech-1": {
    slot: "portada",
    origen: "photo-1616440347437-b1c73416efc2",
    alt: "Escritorio con equipo de audio y monitores",
  },
  "portada-gastro-1": {
    slot: "portada",
    origen: "photo-1553361371-9b22f78e8b1d",
    alt: "Copa de vino servida sobre la mesa",
  },
  "portada-verano-1": {
    slot: "portada",
    origen: "photo-1507525428034-b723cf961d3e",
    alt: "Playa de arena clara y agua turquesa",
  },
  "portada-escolar-1": {
    slot: "portada",
    // ⚠️ La anterior (lápices alineados) era vertical: recortada a 1000×560 el
    // `crop=entropy` dejaba los lápices contra el borde y el resto blanco.
    origen: "photo-1636014724389-270c4e9c0100",
    alt: "Cuadernos de colores abiertos sobre la mesa",
  },
  "portada-belleza-1": {
    slot: "portada",
    origen: "photo-1608571423902-eed4a5ad8108",
    alt: "Frasco con gotero y la sombra de una hoja",
  },

  // ── Bandas (van siempre con velo: lo que importa es la textura) ────────────
  "banda-taller": {
    slot: "banda",
    origen: "photo-1644258676710-ffb99d7d7a1b",
    alt: "Herramientas de cuero sobre la mesa de trabajo",
  },
  "banda-envios": {
    slot: "banda",
    origen: "photo-1586528116311-ad8dd3c8310d",
    alt: "Depósito con estanterías y cajas",
  },
  "banda-marmol": {
    slot: "banda",
    origen: "photo-1566305977571-5666677c6e98",
    alt: "Textura de mármol claro",
  },
  "banda-madera": {
    slot: "banda",
    origen: "photo-1576092762791-dd9e2220abd1",
    alt: "Textura de madera oscura",
  },
  "banda-tela": {
    slot: "banda",
    origen: "photo-1591625591034-75d303d2e1a4",
    alt: "Telas de lino dobladas",
  },
  "banda-gimnasio": {
    slot: "banda",
    origen: "photo-1576678927484-cc907957088c",
    alt: "Interior de un gimnasio",
  },

  // ── Celdas de categoría (cuadradas) ───────────────────────────────────────
  "celda-remeras": {
    slot: "celda",
    origen: "photo-1523381210434-271e8be1f52b",
    alt: "Remeras colgadas en perchas",
  },
  "celda-abrigos": {
    slot: "celda",
    origen: "photo-1490481651871-ab68de25d43d",
    alt: "Perchero con abrigos",
  },
  "celda-calzado": {
    slot: "celda",
    origen: "photo-1605733160314-4fc7dac4bb16",
    alt: "Bota de gamuza sobre fondo claro",
  },
  "celda-bolsos": {
    slot: "celda",
    origen: "photo-1584917865442-de89df76afd3",
    alt: "Cartera roja",
  },
  "celda-joyas": {
    slot: "celda",
    origen: "photo-1515562141207-7a88fb7ce338",
    alt: "Collar de perlas en su estuche",
  },
  "celda-auriculares": {
    slot: "celda",
    origen: "photo-1505740420928-5e560c06d30e",
    alt: "Auriculares sobre fondo amarillo",
  },
  "celda-tecnologia": {
    slot: "celda",
    origen: "photo-1629317337307-e37f95ebc372",
    alt: "Notebook sobre un escritorio despejado",
  },
  "celda-hogar": {
    slot: "celda",
    // ⚠️ La anterior tenía un libro con el título legible ("Gospels"): en una
    // plantilla que manda un tercero a su lista, un texto reconocible en la foto
    // dice algo que el comerciante no eligió decir.
    origen: "photo-1631125915902-d8abe9225ff2",
    alt: "Vasijas de cerámica sobre una repisa",
  },
  "celda-plantas": {
    slot: "celda",
    origen: "photo-1485955900006-10f4d324d411",
    alt: "Planta suculenta en maceta",
  },
  "celda-belleza": {
    slot: "celda",
    origen: "photo-1585945037805-5fd82c2e60b1",
    alt: "Textura de crema sobre fondo claro",
  },
  "celda-regalos": {
    slot: "celda",
    origen: "photo-1513201099705-a9746e1e201f",
    alt: "Caja de regalo con moño",
  },
  "celda-deporte": {
    slot: "celda",
    origen: "photo-1603077492340-e6e62b2a688b",
    alt: "Mancuernas ordenadas",
  },

  // ── Packshots verticales ──────────────────────────────────────────────────
  "producto-perfume": {
    slot: "producto",
    origen: "photo-1458538977777-0549b2370168",
    alt: "Frasco de perfume",
  },
  "producto-calzado": {
    slot: "producto",
    origen: "photo-1608256246200-53e635b5b65f",
    alt: "Par de borcegos de cuero",
  },
  "producto-auricular": {
    slot: "producto",
    origen: "photo-1546435770-a3e426bf472b",
    alt: "Auriculares vinchados",
  },
  "producto-vino": {
    slot: "producto",
    origen: "photo-1547595628-c61a29f496f0",
    alt: "Copa siendo servida",
  },
  "producto-textil": {
    slot: "producto",
    origen: "photo-1521572163474-6864f9cf17ab",
    alt: "Remera blanca lisa",
  },
  "producto-reloj": {
    slot: "producto",
    origen: "photo-1524805444758-089113d48a6d",
    alt: "Reloj de pulsera",
  },
  "producto-mochila": {
    slot: "producto",
    origen: "photo-1622560480605-d83c853bc5c3",
    alt: "Mochila de cuero",
  },
  "producto-escolar": {
    slot: "producto",
    origen: "photo-1503676260728-1c00da094a0b",
    alt: "Libros apilados con una manzana encima",
  },
} as const satisfies Record<string, Foto>;

export type ClaveFoto = keyof typeof CATALOGO;

/** Todas las claves. Lo usan el script y la auditoría. */
export const CLAVES_FOTO = Object.keys(CATALOGO) as ClaveFoto[];

/** El pathname dentro del store. Determinístico: es lo que hace que re-correr el script recupere una foto borrada CON LA MISMA URL. */
export const ruta = (k: ClaveFoto): string =>
  `stock/v1/${CATALOGO[k].slot}/${k}.jpg`;

/** La URL pública. Es lo único que un preset tiene permitido escribir en un bloque. */
export const foto = (k: ClaveFoto): string =>
  `${BASE_FOTOS}/${CATALOGO[k].slot}/${k}.jpg`;

/** El texto alternativo. Obligatorio en todo bloque `imagen` (lo exige `probar-fotos.ts`). */
export const alt = (k: ClaveFoto): string => CATALOGO[k].alt;

/** El slot, para que el script sepa con qué tamaño y qué tope bajarla. */
export const slotDe = (k: ClaveFoto): Slot => CATALOGO[k].slot;

/** La URL de Unsplash de la que se baja, ya recortada al slot. Solo la usa el script. */
export function origenDe(k: ClaveFoto): string {
  const { w, h, q } = SLOTS[CATALOGO[k].slot];
  return `https://images.unsplash.com/${CATALOGO[k].origen}?w=${w}&h=${h}&fit=crop&crop=entropy&fm=jpg&q=${q}&cs=srgb`;
}
