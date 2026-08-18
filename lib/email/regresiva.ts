/**
 * La cuenta regresiva: la aritmética, la geometría y los parámetros de la URL.
 *
 * Puro y aparte, misma doctrina que `encima.ts` (T2) y `mosaico.ts` (T3): es lo
 * único del bloque que se puede probar sin mirar un PNG. Lo importan **los dos
 * lados** —el renderer, que arma el `<img>`, y `app/api/regresiva/route.ts`, que
 * dibuja la imagen— y ahí está el motivo de que exista.
 *
 * 🔴 **La invariante que lo gobierna todo: el `<img>` DECLARA un tamaño en el
 * mail y el PNG se dibuja horas después, en otro proceso.** Si los dos no salen
 * del mismo cálculo, el cliente de mail estira la imagen — y no hay forma de
 * corregirlo, porque el mail ya está en la casilla de otra persona. Por eso las
 * medidas se calculan UNA vez en enteros (`medidas`) y la escala del dibujo es
 * una multiplicación entera arriba de eso (`escalar`): a escala 2 todo mide
 * exactamente el doble, nunca "el doble redondeado", que es donde aparecería el
 * píxel de diferencia.
 *
 * 🔴 **Y el PNG de "ya terminó" mide EXACTAMENTE lo mismo que el de la cuenta
 * corriendo.** Es el mismo `<img>` con el mismo `width`/`height` declarados: si
 * la pantalla de cierre fuera más baja, el mail la dibujaría estirada al alto de
 * la cuenta. La forma cambia adentro del mismo lienzo.
 */

import { repartir } from "./mosaico";
import { horaLocal } from "@/lib/fechas";

/**
 * A qué escala se dibuja el PNG contra lo que declara el `<img>`.
 *
 * Las pantallas de teléfono son de 2× o 3×, y una imagen dibujada a 1× se ve
 * borrosa justo en el bloque cuyo contenido son números grandes. 2 y no 3 porque
 * cada apertura pide esta imagen de nuevo (va con `no-store`): el peso se paga
 * por destinatario y por apertura.
 */
export const ESCALA = 2;

/** Ancho del `<img>` en el mail, sin contar el margen del bloque. */
export const ANCHO_MIN = 200;
export const ANCHO_MAX = 600;

/**
 * Topes de los textos que viajan por la URL.
 *
 * 🔴 **Esta ruta es pública y sin sesión** —tiene que serlo: la abre el cliente
 * de mail de un destinatario, ver `PUBLIC_PREFIXES` en `proxy.ts`—, así que
 * cualquiera puede pedirle un PNG con el texto que quiera y quedaría alojado en
 * nuestro dominio. Acotarlos a un rótulo corto es lo que hace que el peor caso
 * sea "una casilla que dice otra palabra", y no una imagen con un párrafo ajeno
 * servida desde el host que firma nuestros mails.
 */
export const MAX_ETIQUETA = 12;
export const MAX_FIN = 28;

/** Las tres casillas, en orden. */
export const ETIQUETAS_BASE: readonly [string, string, string] = ["DÍAS", "HORAS", "MIN"];
export const FIN_BASE = "¡TERMINÓ!";

/** Lo que falta, ya partido en las tres casillas que se dibujan. */
export interface Restante {
  /** La fecha ya pasó ⇒ se dibuja la pantalla de cierre, no la cuenta. */
  terminado: boolean;
  dias: number;
  horas: number;
  minutos: number;
}

/**
 * Cuánto falta, en días / horas / minutos.
 *
 * ⛔ **Sin segundos, y no es un recorte de alcance.** Gmail sirve las imágenes
 * de un mail desde su propio proxy y las cachea: el número que se dibuja en la
 * primera apertura es el que va a ver esa persona en las siguientes. Con
 * minutos el error que eso introduce es de un minuto y no se nota; con segundos
 * el mail muestra un cronómetro clavado, que es peor que no tenerlo.
 *
 * ⚠️ Se trunca hacia abajo, así que en el último minuto dibuja `00 00 00` sin
 * estar terminado. Es correcto —falta menos de un minuto— y dura 59 segundos.
 * Redondear para arriba sería peor: a 23 h 59 m 30 s diría "1 día".
 */
export function restante(hasta: Date, ahora: Date): Restante {
  const ms = hasta.getTime() - ahora.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return { terminado: true, dias: 0, horas: 0, minutos: 0 };
  const min = Math.floor(ms / 60000);
  return {
    terminado: false,
    dias: Math.floor(min / 1440),
    horas: Math.floor((min % 1440) / 60),
    minutos: min % 60,
  };
}

/**
 * Un número de casilla, siempre de dos dígitos.
 *
 * Los días pueden pasar de 99 (una cuenta a seis meses), y ahí se dibujan los
 * tres o cuatro dígitos que hagan falta: recortar mostraría "23" donde faltan
 * 123 días, que es un número mentido y no un número feo.
 */
export const dosDigitos = (n: number): string => String(Math.max(0, Math.trunc(n))).padStart(2, "0");

/** Las medidas del dibujo, en píxeles enteros a escala 1. */
export interface Medidas {
  /** El ancho total, que es el que declara el `<img>`. */
  ancho: number;
  alto: number;
  /** Los tres anchos de casilla. **Suman `ancho - 2 * hueco` exacto.** */
  casillas: number[];
  hueco: number;
  radio: number;
  /** Cuerpo del número y de la etiqueta. */
  numero: number;
  etiqueta: number;
  /** Aire entre el número y su etiqueta. */
  separacion: number;
  /** El espaciado entre letras de la etiqueta, que es lo que la hace rótulo. */
  espaciado: number;
}

/** El ancho, acotado a algo dibujable. */
export const anchoValido = (n: unknown): number => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return ANCHO_MAX;
  return Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, v));
};

/**
 * Todas las medidas del dibujo, derivadas del ancho y **en enteros**.
 *
 * 🔑 Que sean enteros a escala 1 es lo que hace que `escalar` no pueda mover
 * nada: el doble de un entero es un entero, así que el PNG mide exactamente el
 * doble de lo que el `<img>` declara y el cliente de mail no lo escala.
 *
 * Las proporciones salen del ancho y no hay ninguna perilla: el bloque se ve
 * igual de sólido a 320 que a 600, que es lo que hace falta cuando la misma
 * pieza se lee en un teléfono y en Outlook de escritorio.
 */
export function medidas(anchoPedido: number): Medidas {
  const ancho = anchoValido(anchoPedido);
  const hueco = Math.max(4, Math.round(ancho * 0.015));
  // El reparto va por `repartir` y no por una división: tres casillas de un
  // tercio redondeadas por separado suman un píxel de más o de menos, y acá ese
  // píxel es la diferencia entre las casillas y el borde del PNG.
  const casillas = repartir([1, 1, 1], ancho - 2 * hueco);
  const alto = Math.min(132, Math.max(72, Math.round(ancho * 0.205)));
  return {
    ancho,
    alto,
    casillas,
    hueco,
    radio: Math.round(alto * 0.09),
    numero: Math.round(alto * 0.47),
    etiqueta: Math.max(10, Math.round(alto * 0.118)),
    separacion: Math.max(2, Math.round(alto * 0.055)),
    espaciado: Math.max(1, Math.round(alto * 0.018)),
  };
}

/**
 * A qué cuerpo se dibuja el texto de cierre para que ENTRE en el lienzo.
 *
 * 🔴 No es cosmética: el texto de cierre lo escribe quien arma el mail y puede
 * tener hasta `MAX_FIN` caracteres. Al cuerpo del número —que está pensado para
 * dos dígitos— "ÚLTIMA CHANCE, SE ACABÓ" mide el triple que el PNG, y satori no
 * achica: lo parte en dos renglones que no entran en el alto y lo recorta. Sale
 * media palabra en la casilla de otra persona.
 *
 * El 0,62 es lo que mide una mayúscula de esta tipografía respecto de su cuerpo,
 * y el 0,86 es el aire de los costados. Estima de más antes que de menos: el
 * costo de un texto un punto más chico es cero, el de uno cortado no.
 */
export const cuerpoFin = (m: Medidas, texto: string): number => {
  const largo = Math.max(1, texto.trim().length);
  const cabe = Math.floor((m.ancho * 0.86) / (largo * 0.62));
  // Nunca más chico que la etiqueta de una casilla: abajo de eso no se lee, y a
  // esa altura el problema es el texto y no el tamaño.
  return Math.max(Math.round(m.etiqueta * 1.2), Math.min(m.numero, cabe));
};

/** Las mismas medidas, multiplicadas. Ver el aviso de arriba del archivo. */
export const escalar = (m: Medidas, k: number): Medidas => ({
  ancho: m.ancho * k,
  alto: m.alto * k,
  casillas: m.casillas.map((c) => c * k),
  hueco: m.hueco * k,
  radio: m.radio * k,
  numero: m.numero * k,
  etiqueta: m.etiqueta * k,
  separacion: m.separacion * k,
  espaciado: m.espaciado * k,
});

/** Todo lo que el PNG necesita saber, que es todo lo que viaja por la URL. */
export interface ParamsRegresiva {
  /** El instante límite, en ISO con zona (`2026-08-24T23:59:00.000Z`). */
  hasta: string;
  ancho: number;
  /** Las tres etiquetas de abajo de cada número. */
  etiquetas: [string, string, string];
  /** Lo que dice el PNG cuando la fecha ya pasó. */
  fin: string;
  /** Fondo de cada casilla. */
  bg: string;
  /** El número. */
  tinta: string;
  /** La etiqueta de abajo. */
  rotulo: string;
}

/**
 * ⚠️ **Los colores se validan, no se confían.** Entran por la query de una ruta
 * pública y terminan adentro del `style` de lo que dibuja satori: la lista
 * blanca de `#rgb` / `#rrggbb` es lo que hace que el peor caso sea un color
 * ignorado.
 */
export const colorValido = (v: unknown, respaldo: string): string => {
  const s = typeof v === "string" ? v.trim() : "";
  // Ocho dígitos también: el rótulo es la misma tinta del número con alfa (ver
  // `tenue`), y eso es lo que lo hace legible sobre CUALQUIER fondo de casilla
  // sin tener que elegir un gris que sólo anda sobre negro.
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) ? s : respaldo;
};

/**
 * La misma tinta, al 70%: es el color del rótulo de abajo de cada número.
 *
 * 🔑 Derivado y no elegido a propósito. Un gris fijo se pierde sobre un fondo
 * oscuro y grita sobre uno claro, y pedirle a quien arma el mail que elija DOS
 * colores para tres palabras que dicen "DÍAS" es una perilla que nadie quiere.
 * Con alfa sobre la tinta, la jerarquía se mantiene sea cual sea el fondo.
 */
export function tenue(tinta: string): string {
  const h = tinta.trim().replace("#", "");
  const seis = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return `#${seis}b3`;
}

/** Las tres etiquetas del bloque, completadas con las de fábrica. */
export const etiquetasDe = (v: readonly string[] | undefined): [string, string, string] => [
  v?.[0]?.trim() || ETIQUETAS_BASE[0],
  v?.[1]?.trim() || ETIQUETAS_BASE[1],
  v?.[2]?.trim() || ETIQUETAS_BASE[2],
];

const recortar = (v: unknown, max: number, respaldo: string): string => {
  const s = (typeof v === "string" ? v : "").trim().slice(0, max);
  return s || respaldo;
};

/**
 * La fecha límite de una campaña, tal como se guarda.
 *
 * `undefined` para cualquier cosa que no sea un instante legible: un bloque sin
 * fecha **no se dibuja**, que es mejor que un PNG que dice `NaN` en la casilla de
 * otra persona. Mismo criterio que el `<img src="">` del bloque `imagen`.
 */
export function instante(v: unknown): Date | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

/** Los parámetros de una URL, saneados. Es lo que lee el endpoint. */
export function leerParams(q: URLSearchParams): ParamsRegresiva | undefined {
  const hasta = instante(q.get("hasta"));
  if (!hasta) return undefined;
  const e = (q.get("e") ?? "").split("|");
  return {
    hasta: hasta.toISOString(),
    ancho: anchoValido(q.get("a")),
    etiquetas: [
      recortar(e[0], MAX_ETIQUETA, ETIQUETAS_BASE[0]),
      recortar(e[1], MAX_ETIQUETA, ETIQUETAS_BASE[1]),
      recortar(e[2], MAX_ETIQUETA, ETIQUETAS_BASE[2]),
    ],
    fin: recortar(q.get("fin"), MAX_FIN, FIN_BASE),
    bg: colorValido(q.get("bg"), "#111111"),
    tinta: colorValido(q.get("t"), "#ffffff"),
    rotulo: colorValido(q.get("r"), "#bbbbbb"),
  };
}

/**
 * La URL del PNG, absoluta y colgada del mismo host del que cuelgan los links
 * del mail (`assetsBase`).
 *
 * 🔴 **Absoluta o nada.** Un `src` relativo adentro de un mail lo resuelve el
 * cliente contra su propio dominio (`mail.google.com/api/regresiva`) y sale una
 * imagen rota para el 100% de los destinatarios. Por eso el llamador que no
 * tiene `assetsBase` no dibuja el `<img>` en vez de improvisar uno.
 */
export function urlRegresiva(base: string, p: ParamsRegresiva): string {
  const q = new URLSearchParams({
    hasta: p.hasta,
    a: String(p.ancho),
    e: p.etiquetas.join("|"),
    fin: p.fin,
    bg: p.bg,
    t: p.tinta,
    r: p.rotulo,
  });
  return `${base.replace(/\/+$/, "")}/api/regresiva?${q.toString()}`;
}

/**
 * La línea de texto que acompaña al PNG, en el HTML y en el `text/plain`:
 * "Hasta el lunes 24 de agosto, 23:59".
 *
 * 🔴 **Es lo único de este bloque que sobrevive a las imágenes apagadas**, que es
 * el default de Outlook. Sin ella el bloque entero desaparece y el mail no dice
 * hasta cuándo dura la promoción — la misma deuda que ya se pagó con `mosaico` y
 * sus `alt`. Por eso el renderer la emite SIEMPRE y no hay perilla para sacarla.
 *
 * 🔑 **Y por eso el `alt` del `<img>` es esta frase y no "faltan 2 días".** El
 * `alt` se escribe cuando se manda el mail y no cambia nunca más: cualquier
 * número adentro queda congelado en el momento del envío y miente en cuanto pasa
 * una hora. La fecha límite, en cambio, es verdad para siempre.
 *
 * ⚠️ El formato sale de `horaLocal`, que ya existía para las campañas
 * programadas: resuelve en la zona del NEGOCIO y se arma por partes porque el
 * separador que mete ICU entre el día de la semana y el resto cambia de versión
 * a versión. Escribir otro formateador acá habría sido una segunda definición de
 * la misma frase.
 */
export const lineaRegresiva = (hasta: Date): string => `Hasta el ${horaLocal(hasta)}`;
