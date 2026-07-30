// El ramp del primer envío: partir una lista en TRAMOS, por buzón y por tamaño.
//
// El motor manda a una lista o segmento COMPLETO — no existe "mandale a 500 de
// estos 5.280" y los segmentos no filtran por dominio (ver `CAMPOS` en
// `lib/segmentos.ts`). Escalonar, entonces, es fabricar listas. Esta es la parte
// pura: clasificar y planificar. Escribirlas es `scripts/listas-por-tramo.ts`.
//
// 🔴 **El orden es por BUZÓN, no por antigüedad.** Medido el 29-jul-2026:
// `Perfit — abrieron 2026` es 55,6% Microsoft y 14,7% Gmail, mientras
// `Nuby — suscriptores` es 87,4% Gmail y 8,3% Microsoft. Estrenar una IP fría
// contra la lista "tibia" sería mandarle la mitad al buzón que en julio nos tiró
// a spam. Gmail primero, Microsoft al final.
//
// Un tramo tiene UN SOLO buzón a propósito: si el tramo 3 rebota o cae en spam,
// tiene que quedar claro quién lo rechazó. Un tramo mezclado no se puede leer.

export type Buzon = "gmail" | "microsoft" | "yahoo" | "otros";

export const BUZONES: Buzon[] = ["gmail", "microsoft", "yahoo", "otros"];

/**
 * Orden de envío por defecto. Gmail primero (es donde hay reputación que ganar
 * y el filtro que más pondera el engagement), Microsoft último porque es el que
 * ya nos mandó a spam con IP fría — para cuando le toque, el dominio llega con
 * historial. `otros` va antes que Microsoft pero después de Yahoo: son dominios
 * propios, y buena parte de ellos son Microsoft 365 disfrazado.
 */
export const ORDEN_DEFAULT: Buzon[] = ["gmail", "yahoo", "otros", "microsoft"];

/**
 * La escalera de volumen, en orden. El último peldaño se repite hasta terminar.
 * No es una regla del mailer: es cómo se calienta un dominio nuevo sin que el
 * primer día parezca una compra de base.
 */
export const ESCALERA_DEFAULT = [200, 500, 1000, 2000, 5000];

// La clasificación va por la PRIMERA etiqueta del dominio, no por el dominio
// entero: `hotmail.com`, `hotmail.com.ar` y `hotmail.es` son el mismo buzón y
// enumerarlos sería una lista que siempre queda corta.
const RAICES: Record<Exclude<Buzon, "otros">, string[]> = {
  gmail: ["gmail", "googlemail"],
  microsoft: ["hotmail", "outlook", "live", "msn", "passport", "windowslive"],
  // AOL comparte la infraestructura de Yahoo desde 2017: mismo filtro, mismo tramo.
  yahoo: ["yahoo", "ymail", "rocketmail", "aol"],
};

/**
 * A qué buzón pega un mail. ⚠️ Es una heurística por dominio, no un MX lookup:
 * un Google Workspace o un Microsoft 365 sobre dominio propio caen en `otros`.
 * Alcanza para ordenar el ramp —que es lo único que decide— y no depende de la red.
 */
export function buzonDe(email: string): Buzon {
  const dominio = (email.split("@")[1] ?? "").trim().toLowerCase();
  if (!dominio) return "otros";
  const etiquetas = dominio.split(".");
  // Más de tres etiquetas ya no es un buzón masivo, es un subdominio corporativo
  // (`correo.gmail.empresa.com` no es Gmail).
  if (etiquetas.length > 3 || etiquetas.length < 2) return "otros";
  const raiz = etiquetas[0];
  for (const b of ["gmail", "microsoft", "yahoo"] as const) {
    if (RAICES[b].includes(raiz)) return b;
  }
  return "otros";
}

/** Agrupa preservando el orden de entrada (el plan tiene que ser reproducible). */
export function agruparPorBuzon<T extends { email: string }>(contactos: T[]): Map<Buzon, T[]> {
  const mapa = new Map<Buzon, T[]>(BUZONES.map((b) => [b, [] as T[]]));
  for (const c of contactos) mapa.get(buzonDe(c.email))!.push(c);
  return mapa;
}

export function resumenPorBuzon<T extends { email: string }>(contactos: T[]): Record<Buzon, number> {
  const mapa = agruparPorBuzon(contactos);
  return Object.fromEntries(BUZONES.map((b) => [b, mapa.get(b)!.length])) as Record<Buzon, number>;
}

export interface Tramo<T> {
  /** Número global, 1-based: es el orden en que se mandan. */
  n: number;
  buzon: Buzon;
  contactos: T[];
}

export interface PlanOpts {
  escalera?: number[];
  orden?: Buzon[];
  /** Primer número de tramo. Si ya hay tramos hechos, sigue de ahí. */
  desdeTramo?: number;
  /** En qué peldaño de la escalera arranca (0-based). Idem: no se vuelve a empezar. */
  desdePeldano?: number;
}

/**
 * Parte los contactos en tramos. Reglas:
 *  - un tramo = un solo buzón;
 *  - los buzones salen en el orden pedido, y el que no esté nombrado va al final
 *    (nunca se pierde nadie en silencio);
 *  - la escalera avanza un peldaño POR TRAMO y sigue avanzando al cambiar de
 *    buzón: lo que se calienta es la IP, y no le importa quién recibe.
 */
export function planTramos<T extends { email: string }>(contactos: T[], opts: PlanOpts = {}): Tramo<T>[] {
  const escalera = opts.escalera?.length ? opts.escalera : ESCALERA_DEFAULT;
  const pedidos = opts.orden?.length ? opts.orden : ORDEN_DEFAULT;
  const orden = [...pedidos, ...BUZONES.filter((b) => !pedidos.includes(b))];

  const porBuzon = agruparPorBuzon(contactos);
  const tramos: Tramo<T>[] = [];
  let n = opts.desdeTramo ?? 1;
  let peldano = opts.desdePeldano ?? 0;

  for (const buzon of orden) {
    const pendientes = [...(porBuzon.get(buzon) ?? [])];
    while (pendientes.length) {
      const tam = escalera[Math.min(peldano, escalera.length - 1)];
      tramos.push({ n: n++, buzon, contactos: pendientes.splice(0, tam) });
      peldano++;
    }
  }
  return tramos;
}

/**
 * El nombre de la lista de un tramo. Va con el número en dos dígitos para que el
 * orden alfabético del panel sea el orden de envío, y sin el tamaño adentro: el
 * nombre es la identidad de la lista y no puede cambiar si se corrige la escalera.
 */
export function nombreTramo(prefijo: string, n: number, buzon: Buzon): string {
  return `${prefijo} — T${String(n).padStart(2, "0")} ${buzon}`;
}

/** Reconoce las listas que fabricó este script, para no re-asignar a nadie. */
export function esNombreDeTramo(prefijo: string, nombre: string): boolean {
  return new RegExp(`^${prefijo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} — T\\d\\d `).test(nombre);
}
