// La cáscara del mail: lo que envuelve a los bloques.
//
// Hasta acá el mail era un `<div style="max-width:700px;margin:0 auto">`. En un
// navegador eso se ve perfecto; en **Outlook de escritorio no existe** — ignora
// `max-width` y `margin:0 auto`, así que el mail salía a ancho de ventana y
// pegado a la izquierda. Es el defecto más visible que tenía.
//
// ⚠️ Puro: lo importan el SERVIDOR y el CLIENTE (el preview). Sin prisma.

import type { Paleta } from "./tema";
import { px, type EstiloResuelto } from "./estilos";

/**
 * Clases que el renderer le cuelga a los bloques.
 *
 * ⚠️ **REGLA ÚNICA: el inline siempre lleva el valor de escritorio; una clase
 * solo puede ser un override.** Nunca existe una propiedad que viva únicamente
 * acá. El motivo es que hay clientes que descartan el `<style>` —Outlook de
 * escritorio, y Gmail cuando recorta el mensaje— y con esta regla lo peor que
 * les puede pasar es ver el layout de escritorio, nunca uno roto.
 */
export const CLASES = {
  /** Celda que en el celular pasa a ocupar el ancho completo. */
  col: "m-col",
  /** Contenedor con margen lateral: se achica en pantalla chica. */
  pad: "m-pad",
  /**
   * Achica el título en pantalla chica.
   *
   * ⚠️ Se cuelga **solo si nadie eligió el tamaño**. Si alguien puso 40px y la
   * media query lo bajara a 22 igual, el control del panel sería mentira: el
   * mail se vería distinto en el celular de lo que dice el editor.
   */
  titulo: "m-h1",
  subtitulo: "m-h2",
  ocultarMovil: "m-hide",
  ocultarEscritorio: "d-hide",
  /** La tabla del cuerpo, para que no se pase del ancho de la pantalla. */
  full: "m-full",
} as const;

/** `class="a b"` o `""`. Para pegarlo dentro de un tag sin pensar. */
export function clase(...cs: (string | false | undefined)[]): string {
  const xs = cs.filter(Boolean);
  return xs.length ? ` class="${xs.join(" ")}"` : "";
}

/** Las clases responsive que salen del estilo del bloque. */
export function clasesDe(e: EstiloResuelto): string[] {
  return [
    e.ocultarMovil ? CLASES.ocultarMovil : "",
    e.ocultarEscritorio ? CLASES.ocultarEscritorio : "",
  ].filter(Boolean);
}

/**
 * El `<head>` completo.
 *
 * `PixelsPerInch = 96` parece un detalle y es, con diferencia, el arreglo de
 * mayor efecto de todo esto: sin eso Outlook renderiza a 120 DPI y **el mail
 * entero sale 25% más grande** que como se diseñó.
 */
export function cabeza(pal: Paleta): string {
  // El corte se hace al ancho del mail y no en 600px fijos: con un mail de 700
  // una ventana de 650 mostraría scroll horizontal en vez de apilar.
  const corte = pal.ancho;
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table{border-collapse:collapse}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
  /* iOS autolinkea la dirección postal del pie y la pinta de azul. */
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}
  .${CLASES.ocultarEscritorio}{display:none;mso-hide:all}
  @media only screen and (max-width:${corte}px){
    .${CLASES.full}{width:100%!important}
    .${CLASES.col}{display:block!important;width:100%!important;max-width:100%!important}
    .${CLASES.pad}{padding-left:20px!important;padding-right:20px!important}
    .${CLASES.titulo}{font-size:22px!important}
    .${CLASES.subtitulo}{font-size:19px!important}
    .${CLASES.ocultarMovil}{display:none!important;max-height:0!important;overflow:hidden!important;mso-hide:all}
    .${CLASES.ocultarEscritorio}{display:block!important;mso-hide:none}
  }
</style>
</head>`;
}

/**
 * Apertura: tabla al 100% con el fondo, celda centrada, tabla del contenido.
 *
 * Dos tablas y no una porque el fondo de página tiene que pintar todo el ancho
 * mientras el contenido queda centrado y acotado. Un `<div>` centrado con
 * `margin:0 auto` hace eso en un navegador y en Outlook no hace nada.
 */
export function apertura(pal: Paleta): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${pal.fondo};width:100%">
  <tr><td align="center" style="padding:24px 16px">
    <table role="presentation" width="${pal.ancho}" cellpadding="0" cellspacing="0" border="0"${clase(CLASES.full)} style="width:${px(pal.ancho)};max-width:100%">
      <tr><td>`;
}

export const cierre = `      </td></tr>
    </table>
  </td></tr>
</table>`;

/**
 * Botón para Outlook de escritorio, que no dibuja `padding` ni `border-radius`
 * sobre un `<a>`: sin esto el botón es un link de texto suelto.
 *
 * Los tres detalles que lo hacen fallar y por eso están calculados así:
 *
 * - `width`/`height` van en px **calculados**, no derivados del texto. La
 *   estimación es generosa a propósito: por debajo, Outlook corta el texto.
 * - `arcsize` es un **porcentaje de la mitad del alto**, no px.
 * - El ancla normal va dentro de `<!--[if !mso]><!-->` o Outlook dibuja los dos
 *   botones, uno abajo del otro.
 */
export function botonVml(
  texto: string, url: string, e: EstiloResuelto, pal: Paleta, full: boolean,
): string {
  // El ancho útil: el del mail menos los dos márgenes laterales.
  const anchoMax = pal.ancho - 64;
  const tam = e.tamano ?? 16;
  const padY = e.padY ?? 14;
  const padX = e.padX ?? 32;
  const alto = Math.round(tam * 1.2 + padY * 2);
  const ancho = full
    ? anchoMax
    : Math.min(anchoMax, Math.round(texto.length * tam * 0.62 + padX * 2));
  // El radio se expresa contra la mitad del alto y no puede pasar del 50%: con
  // más, Outlook dibuja una cápsula deforme.
  const arc = Math.min(50, Math.round(((e.radio ?? 8) / (alto / 2)) * 100));
  const escUrl = url || "#";
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escUrl}" style="height:${alto}px;v-text-anchor:middle;width:${ancho}px" arcsize="${arc}%" stroke="f" fillcolor="${e.fondo}">
<w:anchorlock/>
<center style="color:${e.color};font-family:${e.fuente ?? pal.fuente};font-size:${tam}px;font-weight:${e.peso ?? 600}">${texto}</center>
</v:roundrect>
<![endif]-->`;
}
