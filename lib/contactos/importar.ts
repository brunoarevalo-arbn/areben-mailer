// Importación de contactos desde los export de Perfit (base "Nuby" + compradores
// de Tiendanube). Este archivo es PURO: no toca Prisma ni el filesystem, así que
// `scripts/probar-import.ts` puede ejercitarlo entero sin base de datos.
//
// La mecánica vive acá y no adentro del script porque es la misma que después
// necesita `importarCSV` de la app (app/(app)/contactos/actions.ts): escribir dos
// veces "normalizar un mail" y "resolver una supresión" es garantizar que se
// comporten distinto el día que una de las dos cambie.

/** Un mail sin espacios, con arroba y con TLD de al menos dos letras. */
export const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;

/** Los cuatro estados de `EstadoContacto` en el schema. */
export type EstadoImport = "ACTIVO" | "BAJA" | "REBOTADO" | "SPAM";

// Severidad para resolver la precedencia. La regla es de UNA SOLA VÍA: cualquier
// estado de supresión le gana a ACTIVO, aparezca en el archivo que aparezca y
// esté como esté en la base. Nunca al revés. Entre supresiones gana la más
// grave, solo para que el resultado sea determinista (las tres suprimen igual).
const SEVERIDAD: Record<EstadoImport, number> = { ACTIVO: 0, BAJA: 1, REBOTADO: 2, SPAM: 3 };

export function masSevero(a: EstadoImport, b: EstadoImport): EstadoImport {
  return SEVERIDAD[b] > SEVERIDAD[a] ? b : a;
}

export function esSuprimido(e: EstadoImport): boolean {
  return e !== "ACTIVO";
}

// ─────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────

export interface FilasCsv {
  /** Los headers tal como venían, para poder mostrarlos en `--ver`. */
  headers: string[];
  /** Una fila por registro, con las claves ya normalizadas por `claveHeader`. */
  filas: Record<string, string>[];
}

/**
 * Normaliza un nombre de columna: sin acentos, minúsculas, separadores a `_`.
 *
 * ⚠️ Es lo que permite buscar la columna POR NOMBRE y no por posición. Los tres
 * archivos de Perfit tienen distinta cantidad de columnas (el de bajas agrega
 * `Acción` y `Fecha Acción` al principio), así que la posición no sirve.
 * "Cumpleaños (DD/MM)" → "cumpleanos_dd_mm".
 */
export function claveHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Parsea el CSV de un export de Perfit.
 *
 * ⚠️ **Los archivos vienen en ISO-8859-1 (Latin-1), no en UTF-8.** Medido el
 * 29-jul-2026: el header sale `Acci\xf3n`, `G\xe9nero`, `Cumplea\xf1os`. Si se
 * lee como UTF-8, todo nombre con acento entra roto a la base y sale roto en el
 * mail. Por eso la firma toma un Buffer y decide acá, en vez de recibir un
 * string que ya se decodificó mal en el llamador.
 *
 * El separador es `;` (la columna `Intereses` está llena de comas, así que la
 * coma no sirve). Igual se respetan las comillas dobles: un export puede
 * escapar un `;` que venga adentro de un valor.
 */
export function parsearCsv(buf: Buffer, separador = ";"): FilasCsv {
  const texto = buf.toString("latin1").replace(/^\uFEFF/, "");
  const filasCrudas = partirFilas(texto, separador);
  if (filasCrudas.length === 0) return { headers: [], filas: [] };

  const headers = filasCrudas[0];
  const claves = headers.map(claveHeader);
  const filas = filasCrudas.slice(1).map((celdas) => {
    const fila: Record<string, string> = {};
    claves.forEach((k, i) => {
      if (k) fila[k] = (celdas[i] ?? "").trim();
    });
    return fila;
  });
  return { headers, filas };
}

/** Recorre el texto carácter por carácter respetando comillas y CRLF. */
function partirFilas(texto: string, sep: string): string[][] {
  const filas: string[][] = [];
  let celdas: string[] = [];
  let celda = "";
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          celda += '"';
          i++;
        } else enComillas = false;
      } else celda += c;
      continue;
    }
    if (c === '"') { enComillas = true; continue; }
    if (c === sep) { celdas.push(celda); celda = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      celdas.push(celda);
      // Una línea en blanco al final del archivo no es una fila.
      if (celdas.length > 1 || celdas[0] !== "") filas.push(celdas);
      celdas = [];
      celda = "";
      continue;
    }
    celda += c;
  }
  if (celda !== "" || celdas.length > 0) {
    celdas.push(celda);
    if (celdas.length > 1 || celdas[0] !== "") filas.push(celdas);
  }
  return filas;
}

// ─────────────────────────────────────────────────────────────
// Normalización de una fila
// ─────────────────────────────────────────────────────────────

/** Minúsculas, sin espacios, o `null` si no es un mail. */
export function normalizarEmail(raw: string | undefined): string | null {
  const e = (raw ?? "").trim().toLowerCase();
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) return null;
  return e;
}

/**
 * Traduce el estado de Perfit al del mailer, mirando `Estado` y —si la fila lo
 * trae— `Acción`.
 *
 * El archivo de bajas de una campaña tiene ambas: `Acción=UNSUBSCRIBE` y
 * `Estado=UNSUBSCRIBED`. Se toma la más severa de las dos porque son eventos y
 * el estado podría estar recalculado (alguien que se dio de baja y se volvió a
 * anotar quedaría `ACTIVE` con un evento `UNSUBSCRIBE` viejo). Ante la duda, no
 * se le manda: la regla one-way vale también acá.
 */
export function estadoDeFila(fila: Record<string, string>): EstadoImport {
  return masSevero(traducirEstado(fila.estado), traducirEstado(fila.accion));
}

function traducirEstado(raw: string | undefined): EstadoImport {
  const v = (raw ?? "").trim().toUpperCase();
  if (v.includes("COMPLAIN") || v.includes("SPAM")) return "SPAM";
  if (v.includes("BOUNCE")) return "REBOTADO";
  if (v.includes("UNSUBSCRIB")) return "BAJA";
  return "ACTIVO";
}

/** `"true"`/`"false"`/`""` → `true`/`false`/`null`. El vacío NO es un `false`. */
export function boolDeArchivo(raw: string | undefined): boolean | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "si" || v === "sí") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return null;
}

/**
 * `2026-04-23 03:00:05.0` / `2026-05-10T00:35:06.000+0000` / `2026-03-02` → Date.
 * Devuelve `null` para el vacío y para cualquier cosa que no parsee: una fecha
 * inventada es peor que no tenerla.
 */
export function fechaDeArchivo(raw: string | undefined): Date | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  // "2026-04-23 03:00:05.0" no es ISO: sin la T, Date lo interpreta como hora
  // local en algunos runtimes y como UTC en otros.
  const iso = /^\d{4}-\d{2}-\d{2} /.test(v) ? v.replace(" ", "T").replace(/\.0$/, "") + "Z" : v;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Columnas que se guardan en `Contacto.custom` para no perder el dato del
// export. ⚠️ Los segmentos NO saben filtrar por `custom` (ver `CAMPOS` en
// lib/segmentos.ts): esto es para consultar y auditar, no para segmentar. Lo que
// hay que poder mandar va a una LISTA.
const COLUMNAS_CUSTOM = [
  "calidad",
  "fuente",
  "creado",
  "ultimo_envio",
  "ultima_actividad",
  "intereses",
  "cumpleanos_dd_mm",
  "nuby_discount_code",
  "nuby_prize",
  "nuby_req_product_id",
  "nuby_req_variant_id",
] as const;

// ─────────────────────────────────────────────────────────────
// Resolución
// ─────────────────────────────────────────────────────────────

export interface ArchivoImport {
  /** Para los mensajes: el nombre del archivo. */
  nombre: string;
  filas: Record<string, string>[];
  /**
   * `true` para el export de Nuby: **estar en ese archivo ES el
   * consentimiento** (la persona se anotó en el pop-up) y además define quién va
   * a la lista de suscriptores.
   *
   * ⚠️ No se puede deducir del campo `tn_accepts_marketing`, porque ese campo
   * es el espejo del casillero de Tiendanube y viene en `false`/vacío para
   * alguien que sí se anotó en el pop-up. La señal es la PERTENENCIA al archivo.
   */
  optin: boolean;
}

export interface ContactoResuelto {
  email: string;
  nombre: string | null;
  apellido: string | null;
  estado: EstadoImport;
  /** Ya resuelto: `optin` de algún archivo O `tn_accepts_marketing=true`. */
  aceptaMkt: boolean;
  tnTotalGastado: string | null;
  tnUltimaCompra: Date | null;
  ultimaActividad: Date | null;
  custom: Record<string, string>;
  /** Vino de un archivo `optin` (define la lista de suscriptores). */
  enOptin: boolean;
  /** `tn_accepts_marketing=false` en algún archivo y sin optin que lo levante. */
  negoMktEnTn: boolean;
}

export interface Resolucion {
  contactos: Map<string, ContactoResuelto>;
  /** Mails que no pasaron `EMAIL_RE`, con muestra para el dry-run. */
  invalidos: string[];
  filasSinEmail: number;
  /** Filas cuyo mail ya se había visto (dentro del mismo archivo o entre archivos). */
  filasDuplicadas: number;
  /** Por archivo, para que el dry-run muestre de dónde salió cada cosa. */
  porArchivo: { nombre: string; filas: number; validos: number }[];
}

/**
 * Junta todos los archivos en un solo mapa por mail, resolviendo estado,
 * consentimiento y datos. **No escribe nada**: se resuelve entero en memoria y
 * después se compara contra la base. Así el dry-run puede mostrar exactamente lo
 * que va a pasar.
 *
 * Merge de datos entre archivos: el primer valor no vacío gana, salvo las fechas,
 * donde gana la más reciente. El orden en que se pasan los archivos es
 * determinista, así que el resultado también.
 */
export function resolverImport(archivos: ArchivoImport[]): Resolucion {
  const contactos = new Map<string, ContactoResuelto>();
  const invalidos: string[] = [];
  const porArchivo: Resolucion["porArchivo"] = [];
  let filasSinEmail = 0;
  let filasDuplicadas = 0;

  for (const archivo of archivos) {
    let validos = 0;
    for (const fila of archivo.filas) {
      const email = normalizarEmail(fila.email);
      if (!email) {
        if ((fila.email ?? "").trim()) invalidos.push((fila.email ?? "").trim());
        else filasSinEmail++;
        continue;
      }
      validos++;

      const estado = estadoDeFila(fila);
      const aceptaTn = boolDeArchivo(fila.tn_accepts_marketing);
      const ultimaActividad = fechaDeArchivo(fila.ultima_actividad);
      const tnUltimaCompra = fechaDeArchivo(fila.tn_ultima_compra);
      const custom = customDeFila(fila);

      const previo = contactos.get(email);
      if (!previo) {
        contactos.set(email, {
          email,
          nombre: vacioANull(fila.nombre),
          apellido: vacioANull(fila.apellido),
          estado,
          aceptaMkt: archivo.optin || aceptaTn === true,
          tnTotalGastado: vacioANull(fila.tn_total_gastado),
          tnUltimaCompra,
          ultimaActividad,
          custom,
          enOptin: archivo.optin,
          negoMktEnTn: aceptaTn === false,
        });
        continue;
      }

      // Ya lo habíamos visto: dentro del mismo archivo (el export de bajas trae
      // un registro por EVENTO, así que la misma persona aparece dos veces) o en
      // otro archivo (870 mails están en Nuby y en compradores a la vez).
      filasDuplicadas++;
      previo.estado = masSevero(previo.estado, estado);
      previo.nombre ??= vacioANull(fila.nombre);
      previo.apellido ??= vacioANull(fila.apellido);
      previo.tnTotalGastado ??= vacioANull(fila.tn_total_gastado);
      previo.tnUltimaCompra = masReciente(previo.tnUltimaCompra, tnUltimaCompra);
      previo.ultimaActividad = masReciente(previo.ultimaActividad, ultimaActividad);
      previo.enOptin ||= archivo.optin;
      if (aceptaTn === false) previo.negoMktEnTn = true;
      // El optin le gana al `false` de Tiendanube: son los 98 que compraron sin
      // tildar el casillero pero después se anotaron en el pop-up.
      previo.aceptaMkt ||= archivo.optin || aceptaTn === true;
      for (const [k, v] of Object.entries(custom)) previo.custom[k] ??= v;
    }
    porArchivo.push({ nombre: archivo.nombre, filas: archivo.filas.length, validos });
  }

  return { contactos, invalidos, filasSinEmail, filasDuplicadas, porArchivo };
}

function customDeFila(fila: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of COLUMNAS_CUSTOM) {
    const v = (fila[col] ?? "").trim();
    if (v) out[`perfit_${col}`] = v;
  }
  return out;
}

function vacioANull(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}

function masReciente(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return b.getTime() > a.getTime() ? b : a;
}

/** Parte un array en tandas de `n`. Mismo `CHUNK` que usa lib/tn/import.ts. */
export function lotes<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
