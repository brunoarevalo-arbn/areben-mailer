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
];

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
  const k = (nombre ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!k) return undefined;
  return REDES.find((r) => r.slug === k || r.nombre.toLowerCase() === k);
}

/** La URL absoluta del icono. Sin `base` no hay icono: ver el comentario del renderer. */
export function urlIcono(base: string | undefined, red: Red): string | undefined {
  const b = (base ?? "").replace(/\/+$/, "");
  return b ? `${b}/redes/${red.slug}.png` : undefined;
}
