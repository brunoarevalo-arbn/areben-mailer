// Cliente de la biblioteca de imágenes. Lo importa el navegador: sin prisma,
// sin next/headers.

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

/** Sube un archivo. Devuelve la imagen creada o el motivo por el que no se pudo. */
export async function subirImagen(
  file: File,
): Promise<{ ok: true; imagen: ImagenMailDto } | { ok: false; error: string }> {
  // El chequeo del tamaño va también acá, además del servidor: subir 30 MB para
  // que el servidor los rechace es tráfico y espera de quien está mirando.
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `"${file.name}" pesa ${formatoBytes(file.size)}. El tope son 5 MB.` };
  }

  const fd = new FormData();
  fd.append('archivo', file);
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
