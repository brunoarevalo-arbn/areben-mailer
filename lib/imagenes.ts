// Cliente de la biblioteca de imágenes. Lo importa el navegador: sin prisma,
// sin next/headers.

import {
  encuadre,
  cajaDeTinta,
  recorteDeAire,
  ANCHO_MAX,
  POS_CENTRO,
  type Recorte,
} from '@/lib/imagenes-encuadre';
import { escalaDe, normalizar, pedazosDe, PREFIJO_PEDAZO } from '@/lib/email/mosaico';
import type { FilaMosaico } from '@/lib/email/bloques';

/** Lo que devuelve /api/imagenes. Es el modelo de Prisma con las fechas en string. */
export interface ImagenMailDto {
  id: string;
  url: string;
  nombre: string;
  mime: string;
  bytes: number;
  ancho: number | null;
  alto: number | null;
  createdAt: string;
}

export interface TotalImagenes {
  archivos: number;
  bytes: number;
}

export const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Lo más grande que se intenta decodificar en el navegador antes de achicar.
 *
 * No es el tope de lo que se guarda —ése sigue siendo `MAX_BYTES`, y lo hace
 * cumplir el servidor—: es el punto en el que abrir el archivo en un `<canvas>`
 * puede colgar la pestaña. Una foto de celular anda por 3-8 MB; 40 es holgado
 * para eso y sigue frenando el video que alguien arrastró por error.
 */
export const TOPE_DECODIFICA = 40 * 1024 * 1024;

/** "1,4 MB". Con un decimal desde 1 MB: "1 MB" para 1,49 MB miente demasiado. */
export function formatoBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
}

/**
 * Ancho y alto reales, leídos en el navegador antes de subir.
 *
 * Se miden acá y no en el servidor porque el navegador ya tiene que decodificar
 * la imagen igual para mostrar la miniatura: hacerlo del otro lado sería una
 * dependencia nueva para un dato informativo. Si falla, se sube sin medidas.
 */
function medir(file: File): Promise<{ ancho: number; alto: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ ancho: img.naturalWidth, alto: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Recortar y achicar, en el navegador
//
// Con `<canvas>` y nada más: meter `sharp` sería una dependencia nativa en el
// runtime que manda TODOS los mails, para un trabajo que el navegador de quien
// sube la foto ya puede hacer —y que ya está haciendo, porque `medir()` la
// decodifica igual.
//
// 🔴 **Tres trampas del re-encode, y las tres están acá porque las tres
// arruinan la foto en la casilla de otra persona:**
//   1. **Un GIF no se toca nunca.** El canvas dibuja un cuadro y devuelve una
//      imagen quieta: un GIF animado sale muerto y no hay forma de volver atrás.
//   2. **Un PNG sigue siendo PNG.** Canvas → JPEG pinta de NEGRO lo que era
//      transparente, que es justo lo que tiene un logo o un packshot recortado.
//   3. **La extensión sale del `type` REAL del blob**, no del que se pidió:
//      Safari devuelve PNG cuando no puede dar el formato pedido, y un archivo
//      PNG servido como JPEG es una imagen rota en varios clientes de mail.
// ─────────────────────────────────────────────────────────────────────────────

/** Un GIF puede estar animado y el canvas lo aplasta. Nunca se re-encodea. */
const esGif = (mime: string) => mime === 'image/gif';

/**
 * La foto, decodificada y lista para dibujar.
 *
 * 🔴 **`crossOrigin` va ANTES del `src` o no sirve de nada**: el navegador ya
 * arrancó la descarga y el canvas queda contaminado igual (`toBlob` tira
 * `SecurityError`). Medido el 11-ago-2026: el store de Blob y el CDN de
 * Tiendanube mandan los dos `access-control-allow-origin: *`, así que se puede
 * recortar tanto una foto de la biblioteca como una de un producto pegada a
 * mano. Una URL de un servidor sin ese header falla, y se avisa.
 */
function cargarImagen(fuente: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = typeof fuente === 'string' ? fuente : URL.createObjectURL(fuente);
    const img = new Image();
    if (typeof fuente === 'string') img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (typeof fuente !== 'string') URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof fuente !== 'string') URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = url;
  });
}

/** El `File` que sale del canvas, con el nombre y el tipo que de verdad tiene. */
function archivoDe(blob: Blob, base: string): File {
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const limpio = base.replace(/\.[^.]+$/, '') || 'imagen';
  return new File([blob], `${limpio}.${ext}`, { type: blob.type });
}

/**
 * Dibuja el recorte y devuelve el archivo nuevo.
 *
 * `ratio` ausente = no recorta, sólo achica (el modo de toda subida).
 * Devuelve `null` cuando no hay nada que hacer: un GIF, o una foto que ya entra
 * y no se está recortando. Ahí sube el original y no se pierde calidad por nada.
 */
export async function procesarImagen(
  fuente: File | string,
  nombre: string,
  mime: string,
  opts: { ratio?: number; pos?: number } = {},
): Promise<File | null> {
  if (esGif(mime)) return null;

  const img = await cargarImagen(fuente);
  const r = encuadre(img.naturalWidth, img.naturalHeight, opts.ratio, ANCHO_MAX, opts.pos);
  if (!r.dw || !r.dh) throw new Error('No se pudo leer el tamaño de la imagen.');
  // Sin recorte y ya entrando en el tope, tocarla sólo la degradaría.
  if (opts.ratio === undefined && r.dw === img.naturalWidth) return null;

  return dibujar(img, r, nombre, mime);
}

/**
 * El recorte, dibujado y devuelto como archivo.
 *
 * 🔑 **Es el ÚNICO lugar que llama a `toBlob`**, y por eso las dos reglas del
 * re-encode que dependen del formato viven acá una sola vez: un PNG sigue siendo
 * PNG, y la extensión sale del `type` real del blob (`archivoDe`). Escribirlas
 * de nuevo en cada recorte nuevo es cómo uno de ellos termina mandando un logo
 * transparente aplastado contra un fondo negro.
 */
function dibujar(img: HTMLImageElement, r: Recorte, nombre: string, mime: string): Promise<File> {
  const lienzo = document.createElement('canvas');
  lienzo.width = r.dw;
  lienzo.height = r.dh;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo dibujar la imagen.');
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, r.dw, r.dh);

  // El PNG conserva su transparencia; todo lo demás sale JPEG, que es lo que
  // dibuja cualquier cliente de mail (Outlook 2016 no muestra WEBP).
  const destino = mime === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise<File>((res, rej) => {
    lienzo.toBlob((blob) => {
      if (blob) res(archivoDe(blob, nombre));
      else rej(new Error('El navegador no pudo generar la imagen recortada.'));
    }, destino, 0.72);
  });
}

/**
 * Sube un archivo. Devuelve la imagen creada o el motivo por el que no se pudo.
 *
 * ⚠️ **Achica antes de subir.** Hasta el 11-ago-2026 se guardaba el original
 * crudo: una foto de celular de 4.000 px viajaba entera **a cada casilla**, y el
 * egress de Blob se paga por destinatario. Un GIF y una foto que ya entra en el
 * tope se suben tal cual.
 */
export async function subirImagen(
  file: File,
): Promise<{ ok: true; imagen: ImagenMailDto } | { ok: false; error: string }> {
  // 🔑 **El tope de 5 MB se mide sobre lo que SE SUBE, no sobre lo que se
  // eligió.** Desde que el navegador achica, rechazar de entrada una foto de
  // celular de 7 MB era una pared puesta por el paso que justamente la
  // resolvía: esa misma foto queda en unos cientos de KB.
  //
  // ⚠️ Igual hay un techo, y va ANTES de decodificar: abrir 40 MB en un canvas
  // cuelga la pestaña, y ahí no hay mensaje de error que valga.
  if (file.size > TOPE_DECODIFICA) {
    return { ok: false, error: `"${file.name}" pesa ${formatoBytes(file.size)}. Es demasiado grande para procesarla.` };
  }

  // Si el navegador no puede achicarla, se sube como está: que la foto entre
  // siempre gana sobre que pese poco.
  let subir = file;
  try {
    subir = (await procesarImagen(file, file.name, file.type)) ?? file;
  } catch {
    subir = file;
  }

  if (subir.size > MAX_BYTES) {
    return { ok: false, error: `"${file.name}" pesa ${formatoBytes(subir.size)}. El tope son 5 MB.` };
  }
  return subirArchivo(subir);
}

/**
 * Recorta una foto que YA está elegida —de la biblioteca, subida o pegada a
 * mano— y sube el resultado como una imagen nueva.
 *
 * 🔑 **Siempre una clave nueva, jamás se pisa la anterior.** La URL vieja puede
 * estar adentro de un mail que ya está entregado en la casilla de otra persona:
 * es la misma regla que las fotos de stock. El original queda intacto en la
 * biblioteca, que es lo que hace que se pueda volver atrás.
 */
export async function recortarImagen(
  fuente: File | string,
  nombre: string,
  mime: string,
  ratio: number,
  pos: number = POS_CENTRO,
): Promise<{ ok: true; imagen: ImagenMailDto } | { ok: false; error: string }> {
  if (esGif(mime)) {
    return { ok: false, error: 'Un GIF no se puede recortar: perdería la animación.' };
  }
  let archivo: File | null;
  try {
    archivo = await procesarImagen(fuente, nombre, mime, { ratio, pos });
  } catch {
    // El modo de falla que se ve en la práctica: la foto vive en un servidor que
    // no manda CORS, así que el navegador la dibuja pero no deja leerla.
    return { ok: false, error: OTRO_SERVIDOR };
  }
  if (!archivo) return { ok: false, error: 'No se pudo recortar la imagen.' };
  return subirArchivo(archivo);
}

/**
 * Lo más ancho que se ESCANEA para medir la tinta.
 *
 * El recorte final se dibuja igual desde el original a resolución completa: esto
 * sólo acota la lectura de píxeles. Un logo de 4500×4500 —el que Tiendanube
 * devuelve para BDI— son 20 millones de píxeles y **81 MB de `ImageData`** en un
 * solo array; a 2400 son 23, y la caja no se mueve de forma visible.
 */
const ANCHO_ESCANEO = 2400;

const OTRO_SERVIDOR =
  'Esta foto vive en otro servidor y no se puede recortar desde acá. Subila a tu biblioteca.';

/**
 * Mide la tinta y devuelve el recorte al ras. `null` = no hay aire que sacar.
 *
 * 🔴 **`getImageData` tira `SecurityError` si el canvas quedó contaminado**, y es
 * un error distinto del que tira `cargarImagen`: una foto de un servidor sin
 * CORS *se dibuja* perfecto y recién falla al leerla. Por eso la llamada va
 * adentro del `try` del llamador y cae en el mismo mensaje.
 */
function aireDe(img: HTMLImageElement): Recorte | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!(w > 0) || !(h > 0)) throw new Error('No se pudo leer el tamaño de la imagen.');

  // Se mide sobre una copia achicada cuando la foto es grande, y la caja se
  // devuelve al tamaño original **redondeando HACIA AFUERA**: sobrar un píxel de
  // aire no se ve, comerse un píxel de la letra sí.
  const mw = Math.min(w, ANCHO_ESCANEO);
  const mh = Math.max(1, Math.round((h * mw) / w));
  const lienzo = document.createElement('canvas');
  lienzo.width = mw;
  lienzo.height = mh;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('El navegador no pudo dibujar la imagen.');
  ctx.drawImage(img, 0, 0, mw, mh);

  const caja = cajaDeTinta(ctx.getImageData(0, 0, mw, mh).data, mw, mh);
  if (!caja) return null;
  const kx = w / mw;
  const ky = h / mh;
  return recorteDeAire(w, h, {
    x0: Math.floor(caja.x0 * kx),
    y0: Math.floor(caja.y0 * ky),
    x1: Math.min(w - 1, Math.ceil((caja.x1 + 1) * kx) - 1),
    y1: Math.min(h - 1, Math.ceil((caja.y1 + 1) * ky) - 1),
  });
}

/**
 * Recorta una imagen al borde de su tinta y sube el resultado.
 *
 * 🔴 **De dónde salió** (26-ago-2026): el logo del encabezado de BDI es un PNG de
 * 1080×1350 con la marca ocupando 1045×408 — 465 px de aire arriba y 477 abajo.
 * El mail lo dibujaba con `width="120"`, o sea un encabezado de **120×150 px para
 * una marca de 116×45**. Ese vacío no lo puede sacar ni `logoAncho` ni el `padY`
 * del bloque, porque está adentro de los píxeles. Y no era un archivo mal
 * exportado: los tres logos que devuelve Tiendanube en `/store` tienen lo mismo.
 *
 * 🔑 **Sube una clave nueva y no pisa nada**, igual que `recortarImagen`: el
 * original queda en la biblioteca y la URL vieja puede estar adentro de un mail
 * ya entregado. Volver atrás es elegir el original de la biblioteca.
 *
 * `sinAire` distingue "no había nada que sacar" de un error: es una respuesta,
 * no una falla, y la pantalla la dice con otro tono.
 */
export async function recortarAire(
  fuente: File | string,
  nombre: string,
  mime: string,
): Promise<{ ok: true; imagen: ImagenMailDto } | { ok: false; error: string; sinAire?: true }> {
  // Mismo motivo que en `recortarImagen`: el canvas dibuja un cuadro y devuelve
  // una imagen quieta.
  if (esGif(mime)) {
    return { ok: false, error: 'Un GIF no se puede recortar: perdería la animación.' };
  }
  // La imagen se carga UNA vez y se usa para medir y para dibujar: son dos pasos
  // de la misma operación y el segundo tiene que ver exactamente lo que midió el
  // primero.
  let img: HTMLImageElement;
  let recorte: Recorte | null;
  let archivo: File;
  try {
    img = await cargarImagen(fuente);
    recorte = aireDe(img);
    if (!recorte) {
      return { ok: false, sinAire: true, error: 'Esta imagen no tiene aire alrededor para sacar.' };
    }
    archivo = await dibujar(img, recorte, nombre, mime);
  } catch {
    return { ok: false, error: OTRO_SERVIDOR };
  }
  return subirArchivo(archivo);
}

/** El POST de siempre, compartido por la subida y por el recorte. */
async function subirArchivo(
  file: File,
): Promise<{ ok: true; imagen: ImagenMailDto } | { ok: false; error: string }> {
  const fd = new FormData();
  fd.append('archivo', file);
  // ⚠️ Las medidas que se guardan son las del archivo que se SUBE, no las del
  // original: describen lo que quedó en la biblioteca.
  const medidas = await medir(file);
  if (medidas) {
    fd.append('ancho', String(medidas.ancho));
    fd.append('alto', String(medidas.alto));
  }

  const r = await fetch('/api/imagenes', { method: 'POST', body: fd });
  if (r.ok) return { ok: true, imagen: (await r.json()).imagen };
  const d = await r.json().catch(() => ({}));
  return { ok: false, error: d.error || 'No se pudo subir la imagen.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cortar una foto en pedazos (el bloque `mosaico`)
//
// 🔴 El único camino que existe para que una zona de una foto sea un link en un
// mail: `<map>`/`<area>` lo borra Gmail, así que cada zona tiene que ser **su
// propia imagen**. El corte lo hace el navegador con el mismo `<canvas>` que ya
// recorta al 16:9 — **cero infra nueva en el servidor**, que es lo que hace que
// esto se pueda tener hoy.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Corta la foto según la grilla y sube cada pedazo. Devuelve la grilla con las
 * URLs puestas.
 *
 * 🔑 **La foto original queda intacta.** Los pedazos son objetos nuevos: es la
 * misma regla que el recorte a un formato, y es lo que permite volver a cortar de
 * otra manera sin haber perdido nada.
 *
 * 🔴 **Si un pedazo falla, los anteriores YA se subieron.** No hay transacción
 * posible contra un store de blobs, así que en vez de fingir que se puede volver
 * atrás se devuelve el error y la grilla NO se toca: el bloque sigue mostrando la
 * foto entera y quien vuelve a cortar deja los huérfanos de la vez pasada. Se
 * pagan; no se pierde ningún mail.
 *
 * `avance` se llama por pedazo terminado: doce recortes de una foto de 4000 px no
 * son instantáneos y sin esto el botón se queda mudo.
 */
export async function cortarEnPedazos(
  fuente: string,
  nombre: string,
  mime: string,
  filas: readonly FilaMosaico[],
  anchoUtil: number,
  avance?: (hechos: number, total: number) => void,
): Promise<{ ok: true; filas: FilaMosaico[] } | { ok: false; error: string }> {
  // Un GIF animado sale muerto de cualquier canvas, y acá saldría muerto doce
  // veces. Es la misma pared que en `recortarImagen`, por la misma razón.
  if (esGif(mime)) {
    return { ok: false, error: 'Un GIF no se puede cortar: cada pedazo perdería la animación.' };
  }

  let img: HTMLImageElement;
  try {
    img = await cargarImagen(fuente);
  } catch {
    return {
      ok: false,
      error: 'Esta foto vive en otro servidor y no se puede cortar desde acá. Subila a tu biblioteca.',
    };
  }
  if (!(img.naturalWidth > 0) || !(img.naturalHeight > 0)) {
    return { ok: false, error: 'No se pudo leer el tamaño de la foto.' };
  }

  const escala = escalaDe(img.naturalWidth, anchoUtil);
  // 🔴 **La grilla se normaliza UNA vez y es la que vuelve.** `pedazosDe` normaliza
  // igual, así que usar la de entrada para repartir las URLs sería numerar lo mismo
  // de dos formas: una fila con cinco columnas se recorta a cuatro, y el reparto
  // quedaría corrido — el pedazo de abajo a la derecha puesto arriba a la izquierda.
  const grilla = normalizar(filas);
  const trozos = pedazosDe(grilla, img.naturalWidth, img.naturalHeight, escala);
  // El PNG conserva su transparencia; todo lo demás sale JPEG, que es lo que
  // dibuja cualquier cliente de mail. Mismo criterio que `procesarImagen`.
  const destino = mime === 'image/png' ? 'image/png' : 'image/jpeg';
  const base = (nombre.split('/').pop() || 'foto').replace(/\.[^.]+$/, '');

  const urls: string[] = [];
  for (let i = 0; i < trozos.length; i++) {
    const t = trozos[i];
    const lienzo = document.createElement('canvas');
    lienzo.width = t.dw;
    lienzo.height = t.dh;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return { ok: false, error: 'El navegador no pudo dibujar la imagen.' };
    ctx.drawImage(img, t.sx, t.sy, t.sw, t.sh, 0, 0, t.dw, t.dh);
    const blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, destino, 0.72));
    if (!blob) return { ok: false, error: `No se pudo generar el pedazo ${i + 1}.` };
    // 🔑 El nombre arranca con `PREFIJO_PEDAZO` y de eso depende que la biblioteca
    // no se llene: el listado filtra por ahí. La fila y la columna van adentro
    // para poder reconocer un pedazo suelto en el store.
    const archivo = archivoDe(blob, `${PREFIJO_PEDAZO}${base}-${t.fila + 1}x${t.celda + 1}`);
    if (archivo.size > MAX_BYTES) {
      return { ok: false, error: `El pedazo ${i + 1} pesa ${formatoBytes(archivo.size)}. El tope son 5 MB.` };
    }
    const r = await subirArchivo(archivo);
    if (!r.ok) return { ok: false, error: r.error };
    urls.push(r.imagen.url);
    avance?.(i + 1, trozos.length);
  }

  // Las URLs vuelven en el orden de `pedazosDe`: fila por fila y de izquierda a
  // derecha. Se reparten recorriendo la MISMA grilla normalizada.
  let k = 0;
  return {
    ok: true,
    filas: grilla.map((f) => ({ ...f, celdas: f.celdas.map((c) => ({ ...c, url: urls[k++] })) })),
  };
}
