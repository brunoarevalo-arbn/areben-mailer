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
import { leerTienda, type Tienda } from "./email/tienda";
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
  /**
   * Las redes de la marca, en el orden en que se muestran. Las escribe una
   * persona en `/remitentes`: Tiendanube **no** las devuelve en `/store`.
   *
   * 🔑 Vive en la cuenta y no adentro del mail para que una PLANTILLA pueda
   * cerrar con redes. Un preset que guardara el Instagram de alguien sería la
   * bienvenida de Zattia linkeando al Instagram de BDI — la misma razón por la
   * que el logo tampoco se guarda en el Json.
   *
   * `red` es el slug de `lib/email/redes.ts` cuando hay icono; cualquier otro
   * nombre sale en texto, que es lo que el bloque hizo siempre.
   */
  redes?: { red: string; url: string }[];
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
   * ⚠️ El valor crudo no se dibuja y **no** sale por `marcaDe()`: lo que sí
   * sale es `assetsBase`, que se deriva de acá con `hostDeEnvio()` y de donde
   * cuelgan los iconos del bloque `redes`. Hasta el 2-ago-2026 este comentario
   * decía que no entraba a `RenderOpts` "porque el preview lo pediría sin tener
   * para qué", y era al revés: el preview lo necesita —son los iconos— y por no
   * tenerlo los dibujaba en texto.
   */
  dominioEnvio?: string;
  /**
   * Los datos duros del comercio —envío gratis, cuotas, plazos, el local— que
   * los mails leen con `${tienda.…}` en vez de tenerlos escritos adentro.
   *
   * 🔑 Vive acá por lo mismo que el logo y las redes: el documento se comparte
   * entre marcas y no puede llevar el número adentro. Ver `lib/email/tienda.ts`,
   * que es donde está la historia de los once mails que decían $50.000.
   *
   * ⚠️ Tiendanube **no** devuelve nada de esto en `/store`, así que "Traer de mi
   * tienda" no lo toca: se escribe a mano en `/remitentes`, una vez.
   */
  tienda?: Tienda;
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
  | "nombreCuenta"
  | "logoCuenta"
  | "urlCuenta"
  | "direccionPostal"
  | "temaMarca"
  | "permiteHtmlCrudo"
  | "redesMarca"
  | "assetsBase"
  | "tienda"
>;

const txt = (v: unknown): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || undefined;
};

/**
 * La lista de redes del config, sin confiar en nada.
 *
 * 🔴 **Una entrada sin `url` se descarta acá**, no en el renderer: estas URLs
 * van al `href` de un mail que ya está en la casilla de otra persona, y un
 * `href=""` es un link que no lleva a ningún lado y no se puede corregir. Es la
 * misma postura de `normalizarDominioEnvio`: ante la duda, afuera.
 *
 * El tope de 8 no es capricho: son los iconos que entran en un renglón a 600px.
 */
function redesDe(valor: unknown): { red: string; url: string }[] | undefined {
  if (!Array.isArray(valor)) return undefined;
  const out = valor
    .map((v) => {
      if (!v || typeof v !== "object") return null;
      const r = v as Record<string, unknown>;
      const red = txt(r.red);
      const url = txt(r.url);
      // `https://` y nada más: `javascript:` en el href de un mail no lo
      // ejecutaría ningún cliente serio, pero tampoco tiene por qué llegar.
      if (!red || !url || !/^https?:\/\//i.test(url)) return null;
      return { red, url };
    })
    .filter((x): x is { red: string; url: string } => x !== null)
    .slice(0, 8);
  return out.length ? out : undefined;
}

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
    redes: redesDe(c.redes),
    lastSyncContactos: txt(c.lastSyncContactos),
    marcaSync: txt(c.marcaSync),
    htmlCrudoHabilitado: c.htmlCrudoHabilitado === true,
    // Se re-valida al LEER, no solo al guardar: el config es un Json libre que
    // también tocan scripts y podría entrar editado a mano.
    dominioEnvio: normalizarDominioEnvio(c.dominioEnvio),
    tienda: leerTienda(c.tienda),
  };
}

/**
 * La marca de una cuenta, lista para pasarle al renderer.
 *
 * `appUrl` es el fallback de `hostDeEnvio` y va **por parámetro**, no leyendo
 * `process.env` acá: este archivo se declara puro (ver el aviso de arriba) y es
 * el mismo criterio que `hostDeEnvio`, que existía con esa firma desde antes.
 * Es obligatorio a propósito — un call site que se lo olvide tiene que ser un
 * error de tipos, no un mail sin iconos que se descubre en la casilla de otro.
 */
export function marcaDe(cuenta: { nombre: string; config: unknown }, appUrl: string): Marca {
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
    // Igual que el domicilio y el logo: la marca la resuelve el render, no el
    // documento. Así el mismo Json sale con las redes de cada tienda.
    redesMarca: c.redes,
    // 🔴 De acá salen los iconos de `redes`, y por eso viaja con la marca y no
    // suelto: era el único campo de `RenderOpts` que cada call site armaba a
    // mano, y el preview del editor —el único que no podía resolverlo en el
    // servidor— lo sacaba de `window.location.origin`. En el render del
    // servidor `window` no existe ⇒ `assetsBase` vacío ⇒ el bloque `redes`
    // caía al fallback de texto y el mail se veía SIN iconos en el editor,
    // mientras el envío real los mandaba bien. Con el campo acá adentro llega
    // a los ocho lugares que dibujan un mail, editores incluidos, sin que
    // ninguno tenga que acordarse.
    assetsBase: hostDeEnvio(cuenta, appUrl),
    // Igual que el logo, el domicilio y las redes: el dato de la tienda lo
    // resuelve el render y no el documento. Entra por acá y no suelto para que
    // llegue a los ocho call sites sin que ninguno tenga que acordarse — es la
    // misma razón por la que `assetsBase` terminó adentro de `Marca`.
    tienda: c.tienda,
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
