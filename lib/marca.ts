// La marca de una cuenta: lo que hace que un mail se vea de quien lo manda.
//
// Todo esto vive en `Cuenta.config`, que es un Json libre — sin columna nueva a
// propósito: la base se comparte con Resorty y `prisma db push` está prohibido.
// Este archivo es el ÚNICO que conoce la forma de ese Json.
//
// De dónde sale cada cosa: la trae Tiendanube sola en `/store` (ver
// `lib/tn/client.ts` y el callback del OAuth). El comerciante no configura nada
// para que su primer mail salga con su logo, su link y su idioma; sin esto las
// plantillas le salen con la cara de la marca que las escribió.
//
// ⚠️ Puro: lo importa el servidor Y el cliente (el preview del editor arma las
// mismas opciones de render). Sin prisma, sin next/headers.
import { temaDe, type Tema } from "./email/tema";
import type { RenderOpts } from "./email/render";
import type { DatosTienda } from "./tn/client";

/** Lo que guardamos en `Cuenta.config`. Todo opcional. */
export interface ConfigCuenta {
  /** Aspecto por defecto de los mails (lo edita `/remitentes`). */
  tema?: Tema;
  /** Logo de la tienda, URL absoluta. Lo trae TN. */
  logo?: string;
  /** Sitio público de la tienda, sin barra final. Lo trae TN. */
  url?: string;
  /** Idioma principal de la tienda ("es"). Lo trae TN. */
  idioma?: string;
  /** Razón social y domicilio, para el pie del mail. Lo trae TN. */
  direccion?: string;
  /**
   * El domicilio escrito a mano en `/remitentes`. Si está, **le gana** al que
   * trae Tiendanube.
   *
   * Va en su propia clave y no pisando `direccion` a propósito: lo de TN es el
   * domicilio FISCAL de la empresa, y una tienda puede querer mostrar su local,
   * su casilla o solo la ciudad. Con una sola clave, "Traer de mi tienda"
   * —que se corre para actualizar el logo— borraría el texto elegido sin
   * avisar; con dos, traer la marca no puede pisar lo que escribió una persona,
   * y vaciar esto vuelve solo al de Tiendanube.
   */
  direccionPropia?: string;
  /**
   * ¿Esconder el domicilio del pie? Ausente = se muestra, que es como se portó
   * siempre.
   *
   * El flag es "ocultar" y no "mostrar" a propósito: con la pregunta al revés,
   * las cuentas que ya existen —que no tienen la clave— pasarían a mandar sin
   * domicilio de un día para el otro por un default.
   *
   * ⚠️ No borra `direccion`: "Traer de mi tienda" la vuelve a escribir en cada
   * corrida, así que vaciar el dato no alcanzaría para que deje de salir. Y
   * guardarla igual deja volver atrás con un click.
   */
  direccionOculta?: boolean;
  /** Cuándo se sincronizaron los contactos por última vez. */
  lastSyncContactos?: string;
  /** Cuándo se trajeron los datos de la tienda por última vez. */
  marcaSync?: string;
  /**
   * ¿Esta cuenta puede usar el bloque `html` (HTML crudo)? Lo prende un ADMIN
   * a mano desde Remitentes. Ausente = no: es la escotilla de administrador,
   * no un default para cualquier marca nueva.
   */
  htmlCrudoHabilitado?: boolean;
  /**
   * Dominio propio del que cuelgan los links de los mails de esta marca
   * (`https://links.zattia.com.ar`), sin barra final. Ausente = `APP_URL`.
   *
   * POR QUÉ EXISTE: los links de un mail no van derecho a la tienda, pasan por
   * el redirect que cuenta los clicks. Con un solo dominio para todas las
   * marcas, un mail firmado por Zattia sale con 18 links a `*.vercel.app` — un
   * dominio prestado, compartido con miles de apps, que no coincide con el que
   * firma el mail. Es una de las señales que miran los filtros, y la pagamos en
   * TODOS los envíos reales de TODAS las marcas.
   *
   * ⚠️ Esto NO es marca (no se dibuja): es de dónde cuelgan los links. Por eso
   * no sale por `marcaDe()` ni entra en `RenderOpts` — si viajara ahí, el
   * preview del editor lo pediría sin tener para qué.
   */
  dominioEnvio?: string;
}

/**
 * Normaliza un dominio de envío escrito a mano. Devuelve `undefined` si no es
 * usable, y ESO ES LO IMPORTANTE: un valor basura acá no rompe una imagen,
 * rompe **todos** los links del mail —incluido el de baja— en correos que ya
 * están en casillas ajenas y no se pueden corregir. Ante la duda, `undefined`
 * ⇒ el llamador cae a `APP_URL` y el mail sale como salía ayer.
 *
 * Acepta `links.zattia.com.ar` o `https://links.zattia.com.ar/` y devuelve
 * siempre `https://links.zattia.com.ar`.
 */
export function normalizarDominioEnvio(valor: unknown): string | undefined {
  const s = (typeof valor === "string" ? valor : "").trim().toLowerCase();
  if (!s) return undefined;
  // `http://` no se acepta y no se "arregla" a https: un link de mail que
  // arranca en texto plano es degradable, y acá lo que se degrada es el link de
  // baja de una campaña entera.
  if (/^http:\/\//.test(s)) return undefined;
  const host = s.replace(/^https:\/\//, "").replace(/\/+$/, "");
  // Un hostname y nada más: sin path, sin query, sin puerto, sin credenciales,
  // sin espacios. Todo eso entra al `href` de un mail, donde no hay forma de
  // escapar de un error después de mandarlo.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return undefined;
  // Sin punto no hay dominio público ("localhost", "intranet"): un mail que ya
  // salió con eso adentro es un link muerto en la casilla de otra persona.
  if (!host.includes(".")) return undefined;
  return `https://${host}`;
}

/**
 * De dónde cuelgan los links de los mails de esta cuenta.
 *
 * El fallback va por parámetro y no leyendo `process.env` acá porque este
 * archivo lo importa también el cliente (ver el aviso de arriba). Los cinco
 * call sites que arman un mail pasan su `APP_URL`.
 */
export function hostDeEnvio(cuenta: { config: unknown }, fallback: string): string {
  return leerConfigCuenta(cuenta.config).dominioEnvio ?? fallback;
}

/**
 * Todo lo que el renderer necesita saber de la cuenta, en un solo objeto.
 *
 * Va atado a `RenderOpts` a propósito: los call sites hacen
 * `renderEmailHtml(contenido, { unsubscribeUrl, ...marcaDe(cuenta) })` y así un
 * campo nuevo de marca llega a los ocho lugares que renderizan sin tener que
 * acordarse de ninguno. Enumerar campos a mano es exactamente el bug que hacía
 * que el preview mostrara una cosa y el mail saliera otra.
 */
export type Marca = Pick<
  RenderOpts,
  "nombreCuenta" | "logoCuenta" | "urlCuenta" | "direccionPostal" | "temaMarca" | "permiteHtmlCrudo"
>;

const txt = (v: unknown): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || undefined;
};

/** Lee `Cuenta.config` sin confiar en nada de lo que haya adentro. */
export function leerConfigCuenta(valor: unknown): ConfigCuenta {
  if (!valor || typeof valor !== "object") return {};
  const c = valor as Record<string, unknown>;
  return {
    tema: temaDe(c),
    logo: txt(c.logo),
    url: txt(c.url)?.replace(/\/+$/, ""),
    idioma: txt(c.idioma),
    direccion: txt(c.direccion),
    direccionPropia: txt(c.direccionPropia),
    direccionOculta: c.direccionOculta === true,
    lastSyncContactos: txt(c.lastSyncContactos),
    marcaSync: txt(c.marcaSync),
    htmlCrudoHabilitado: c.htmlCrudoHabilitado === true,
    // Se re-valida al LEER, no solo al guardar: el config es un Json libre que
    // también tocan scripts y podría entrar editado a mano.
    dominioEnvio: normalizarDominioEnvio(c.dominioEnvio),
  };
}

/** La marca de una cuenta, lista para pasarle al renderer. */
export function marcaDe(cuenta: { nombre: string; config: unknown }): Marca {
  const c = leerConfigCuenta(cuenta.config);
  // El idioma de la tienda solo se usa si el tema no dice otra cosa: quien
  // eligió un idioma a mano en el diseño mandó sobre lo que trajo TN.
  const temaMarca = c.idioma && !c.tema?.idioma ? { ...c.tema, idioma: c.idioma } : c.tema;
  return {
    nombreCuenta: cuenta.nombre,
    logoCuenta: c.logo,
    urlCuenta: c.url,
    // El filtro vive acá y no en el renderer: `marcaDe` es la única puerta por
    // la que la marca llega a los ocho call sites que dibujan un mail, así que
    // apagado acá queda apagado en el envío, en el preview y en las pruebas.
    // Y el domicilio escrito a mano le gana al que trajo Tiendanube.
    direccionPostal: c.direccionOculta ? undefined : c.direccionPropia ?? c.direccion,
    temaMarca,
    permiteHtmlCrudo: c.htmlCrudoHabilitado,
  };
}

/**
 * Mete los datos de la tienda en el config **sin pisar el resto**.
 *
 * ⚠️ Un `update` con `{ config: { logo, url } }` pelado borraría `tema` y
 * `lastSyncContactos`. Ya pasó una vez con el tema; por eso el merge está acá y
 * no repetido en cada call site.
 *
 * Un campo que TN devuelve vacío **no borra** el que ya estaba: una tienda sin
 * logo cargado no tiene por qué apagar el que se trajo la vez anterior.
 */
export function configConTienda(
  config: unknown,
  datos: DatosTienda,
  ahora: string,
): Record<string, unknown> {
  const base = (config && typeof config === "object" ? { ...(config as Record<string, unknown>) } : {});
  const poner = (k: keyof ConfigCuenta, v: string) => {
    if (v) base[k] = v;
  };
  poner("logo", datos.logo);
  poner("url", datos.url);
  poner("idioma", datos.idioma);
  poner("direccion", datos.direccion);
  base.marcaSync = ahora;
  return base;
}
