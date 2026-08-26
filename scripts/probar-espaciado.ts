// ¿Se puede pedir que el mail vaya PEGADO? Lógica pura: sin base ni red.
//
// Salió de una tarjeta de Bruno: *«Que el espaciado entre elementos o márgenes
// sea 0. que la foto vaya de punta a punta»*. Hasta el 18-ago-2026 eso no se
// podía **ni pedir**, por tres motivos distintos que se tapaban entre sí:
//
//   1. Casi ningún bloque ofrecía margen VERTICAL (`CAJA_BASE` era sólo `padX`).
//   2. El aire de arriba y abajo estaba **cableado** en cada `case` del renderer
//      (`margin:16px 0` en el título, `0 0 16px` en el texto…), así que sumar la
//      perilla sólo habría dejado SUMAR aire, nunca sacarlo.
//   3. 🔴 Y el margen lateral se podía poner en 0 y **en el celular salían 20px
//      igual**: la media query del shell los emite con `!important` sobre la
//      clase `m-pad`, que `pad()` colgaba siempre.
//
// Lo que este script custodia, y que ningún otro ensayo ve:
//
//   A. Elegir el margen **reemplaza** el cableado, no se le suma. Sin esto,
//      `padY: 0` deja los 16px de fábrica y la perilla es mentira. ⚠️
//      `probar-panel-estilo.ts` NO lo caza: le alcanza con que el HTML cambie, y
//      cambia igual por el padding aunque el margen quede intacto.
//   B. Elegido el margen lateral, el bloque **pierde `m-pad`** — o la media
//      query le gana a la elección y el celular sale distinto de lo que dice el
//      panel.
//   C. La cáscara acompaña: el marco de la página y los dos colchones de adentro
//      de la tarjeta salen de la capa de DOCUMENTO. Con los bloques en 0 y el
//      marco en 16, la foto sigue sin ir de punta a punta.
//   D. ⚠️ Y lo contrario, que es lo que protege a las 38 plantillas: **sin
//      elegir nada no se mueve un byte**. Eso ya lo fija el golden; acá se
//      verifica que la diferencia entre "no elegí" y "elegí 0" exista de verdad,
//      porque si `ausente` y `0` se leyeran igual todo lo de arriba sería
//      inalcanzable.
//
// Correr:  node --import tsx scripts/probar-espaciado.ts
import { renderEmailHtml, type Bloque } from '../lib/email/render.ts';
import { V_ACTUAL } from '../lib/email/esquema.ts';
import type { Estilos } from '../lib/email/estilos.ts';

const OPTS = {
  unsubscribeUrl: '#',
  nombreCuenta: 'BDI',
  urlCuenta: 'https://bdiaccesorios.com.ar',
  assetsBase: 'https://links.bdiaccesorios.com.ar',
  redesMarca: [{ red: 'instagram', url: 'https://instagram.com/bdi_accesorios' }],
};

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

/**
 * Un bloque de cada uno de los que dibujan aire vertical propio.
 *
 * ⚠️ Los que nacen vacíos no se dibujan a propósito, así que van completos o el
 * ensayo mediría un mail sin nada adentro y pasaría siempre.
 */
const BLOQUES: Bloque[] = [
  { id: 't1', tipo: 'titulo', texto: 'Título' },
  { id: 'x1', tipo: 'texto', texto: 'Un párrafo.' },
  { id: 'i1', tipo: 'imagen', url: 'https://ejemplo.com/foto.jpg', alt: 'foto' },
  { id: 'b1', tipo: 'boton', texto: 'Comprar', url: 'https://ejemplo.com' },
  { id: 'd1', tipo: 'divisor' },
  // 🔴 El `menu` SIN banda entró el 26-ago-2026 y no es decorativo: sin él, §A
  // daba verde mientras ese bloque SUMABA el margen elegido al cableado en vez
  // de reemplazarlo (20 elegidos salían 40). Un fixture al que le falta un tipo
  // de bloque es un ensayo que promete más de lo que mira.
  { id: 'm1', tipo: 'menu', links: [{ texto: 'Novedades', url: 'https://ejemplo.com' }] },
  { id: 'r1', tipo: 'redes', links: [{ red: 'Instagram', url: 'https://instagram.com/bdi' }] },
  { id: 'p1', tipo: 'productos', items: [{ nombre: 'Funda', precio: '1000', imagen: 'x.jpg', url: '#' }] },
] as Bloque[];

// 🔴 `v: V_ACTUAL` no es decorativo: `renderEmailHtml` re-normaliza, y un
// documento sin versión se MIGRA (materializa un encabezado que acá sobra).
const render = (estilos?: Estilos) =>
  renderEmailHtml({ v: V_ACTUAL, bloques: BLOQUES, estilos } as never, OPTS as never);

/**
 * Los `margin:` con aire VERTICAL vivo.
 *
 * ⚠️ El filtro no sobra: los iconos de `redes` van con `margin:0 8px`, que es el
 * aire **entre un icono y el siguiente** —horizontal, adentro de un bloque— y no
 * tiene nada que ver con el espaciado entre elementos del mail. Sin separarlos,
 * este ensayo exigiría borrar algo que nadie pidió borrar.
 */
const margenesVerticales = (html: string) =>
  [...html.matchAll(/style="[^"]*?(margin:[^;"]*)/g)]
    .map((m) => m[1])
    .filter((m) => {
      const [arriba, , abajo] = m.slice('margin:'.length).trim().split(/\s+/);
      const vivo = (v?: string) => v !== undefined && v !== '0' && v !== '0px';
      return vivo(arriba) || vivo(abajo ?? arriba);
    });

const base = render();
const cero = render({ caja: { padX: 0, padY: 0 } });
const aire = render({ caja: { padY: 40 } });

console.log('\n── A · elegir el margen REEMPLAZA el cableado');

// Los tres cableados que más se notan, y que son los que alguien quiere en 0.
for (const m of ['margin:16px 0', 'margin:0 0 16px', 'margin:24px 0']) {
  ok(base.includes(m), `sin elegir nada sigue saliendo \`${m}\``);
}
const vivos = margenesVerticales(cero).filter((m) => m !== 'margin:0');
ok(
  vivos.length === 0,
  `con el margen en 0 no queda ni un \`margin\` cableado${vivos.length ? ` (quedan: ${[...new Set(vivos)].join(', ')})` : ''}`,
);
// Con aire ELEGIDO el cableado también se va: si no, 40px se sumarían a los 16
// de fábrica y el bloque saldría con 56 sin que nadie lo pidiera.
const sumados = margenesVerticales(aire).filter((m) => m !== 'margin:0');
ok(sumados.length === 0, 'con el margen elegido en 40 tampoco se SUMA al cableado');

console.log('\n── B · el margen elegido le gana a la media query del celular');

// El `m-pad` del `<style>` no cuenta: es la regla, no un elemento que la use.
const conClase = (html: string) => (html.slice(html.indexOf('</style>')).match(/m-pad/g) ?? []).length;
ok(conClase(base) > 0, 'sin elegir nada los bloques siguen llevando `m-pad` (el celular achica solo)');
ok(conClase(cero) === 0, 'con el margen lateral elegido ningún bloque lleva `m-pad`');
ok(
  /\.m-pad\{padding-left:20px!important/.test(base),
  'la media query sigue emitiendo los 20px — lo que cambió es a quién se los aplica',
);

console.log('\n── C · la cáscara acompaña');

/**
 * El padding del MARCO, y sólo el del marco.
 *
 * 🔴 La primera versión de este ensayo preguntaba `html.includes('padding:0px 0px')`
 * y **daba verde con el marco cableado**: con los bloques en 0 esa cadena aparece
 * igual, en el `<div>` de cada bloque. El mutante que ignoraba el aire del
 * documento sobrevivió. La aserción tiene que anclar en la celda de la cáscara.
 */
const marco = (html: string) => html.match(/<td align="center" style="padding:([^"]*)"/)?.[1];
ok(marco(base) === '24px 16px', `sin elegir nada el marco de la página sigue en 24/16 (salió ${marco(base)})`);
ok(marco(cero) === '0px 0px', `con el margen en 0 el marco de la página también va a 0 (salió ${marco(cero)})`);
ok(marco(aire) === '40px 16px', `con el margen elegido en 40 el marco lo acompaña y el lateral no se mueve (salió ${marco(aire)})`);
ok(base.includes('<div style="height:12px">'), 'sin elegir nada el colchón de adentro de la tarjeta sigue en 12px');
ok(!cero.includes('<div style="height:12px">'), 'con el margen en 0 el colchón de adentro también se va');
ok(aire.includes('<div style="height:40px">'), 'con el margen elegido en 40 el colchón lo acompaña');

console.log('\n── D · "ausente" y "0" no son lo mismo');

// 🔑 Es la invariante de la que dependen las otras tres: si el motor leyera un
// `padY` ausente como 0, las 38 plantillas saldrían pegadas y no habría forma de
// pedir lo contrario.
ok(base !== cero, 'un mail sin elegir nada y uno con todo en 0 NO rinden el mismo HTML');
ok(
  render({ caja: { padY: 0 } }) !== render({ caja: { padX: 0 } }),
  'el margen vertical y el lateral se eligen por separado',
);

console.log('\n── E · arriba y abajo se eligen POR SEPARADO');

// 🔴 La aserción que sostiene todo el diseño. Elegir un solo lado NO puede
// apagar el otro: el atajo obvio —"si eligieron algo vertical, `margin:0`"—
// deja el bloque pegado abajo, y eso no se ve en ninguna captura del panel.
// Verificado en rojo con esa mutación (`margen` devolviendo siempre 0).
const soloArriba = render({ caja: { padArriba: 40 } });
ok(
  soloArriba.includes('margin:0 0 16px'),
  'elegir SOLO el margen de arriba deja vivo el cableado de abajo del texto (`0 0 16px`)',
);
ok(!soloArriba.includes('margin:16px 0'), 'y sí apaga el de arriba del título');
ok(
  soloArriba.includes('padding:40px 32px 0'),
  'el aire elegido sale como padding de a TRES valores, con el lado no elegido en 0',
);

// El otro lado del mismo caso: con abajo elegido, arriba conserva lo suyo.
const soloAbajo = render({ caja: { padAbajo: 0 } });
ok(soloAbajo.includes('margin:16px 0 0'), 'elegir SOLO abajo deja vivo el `16px` de arriba del título');
ok(soloAbajo !== base, 'y mueve el mail');
ok(
  soloAbajo !== render({ caja: { padY: 0 } }),
  'elegir abajo en 0 NO es lo mismo que elegir los dos lados en 0',
);

// 🔑 La forma corta y las dos largas con el MISMO número tienen que rendir el
// mismo HTML, o el candado del panel movería el mail al abrirse. Es lo que deja
// que `ControlAireY` copie `padY` a los dos lados sin tocar nada.
ok(
  render({ caja: { padY: 40 } }) === render({ caja: { padArriba: 40, padAbajo: 40 } }),
  'con los dos lados iguales el HTML es idéntico al de la forma corta (el candado no mueve el mail)',
);

// 🔴 La cascada respeta el ORDEN, también acá. El documento pone un lado y el
// bloque contesta con la forma corta: gana el bloque, de los DOS lados. Un
// `padArriba ?? padY` sobre el mezclado devolvería 8 arriba y 30 abajo.
const cruzado = renderEmailHtml(
  {
    v: V_ACTUAL,
    bloques: [{ id: 'x9', tipo: 'texto', texto: 'Un párrafo.', estilo: { caja: { padY: 30 } } }],
    estilos: { caja: { padArriba: 8 } },
  } as never,
  OPTS as never,
);
// ⚠️ La aserción ancla en el `padding` DEL BLOQUE (que lleva el `32px` lateral),
// no en cualquier `padding:8px` del documento: el `padArriba: 8` de la capa de
// documento también gobierna el marco de la página, y ahí sale legítimamente.
// Es el mismo error que ya se pagó en §C, del otro lado.
ok(
  cruzado.includes('padding:30px 32px') && !/padding:8px 32px/.test(cruzado),
  'la forma corta de un BLOQUE le gana al lado suelto del DOCUMENTO, de los dos lados',
);

// La cáscara acompaña, lado por lado: los dos colchones son de fábrica
// distintos (12 y 16) y hasta hoy un solo número los igualaba.
const partidoDoc = render({ caja: { padArriba: 0, padAbajo: 40 } });
ok(marco(partidoDoc) === '0px 16px 40px', `el marco de la página se parte (salió ${marco(partidoDoc)})`);
ok(!partidoDoc.includes('<div style="height:12px">'), 'el colchón de arriba sigue al lado de arriba');
ok(partidoDoc.includes('<div style="height:40px">'), 'y el de abajo al de abajo');

// ⚠️ Esto NO contradice a §A: allá el margen se elige de los DOS lados y por eso
// no puede quedar ni un cableado vivo. Acá se elige UNO y el otro tiene que
// sobrevivir. Si alguien "arregla" §A para que valga siempre, esta sección se
// pone roja — que es exactamente lo que tiene que pasar.
ok(
  render({ caja: { padArriba: 0 } }) !== base,
  'ausente y 0 tampoco son lo mismo para los lados sueltos',
);

console.log(errores.length ? `\n❌ ${errores.length} fallas\n` : '\n✅ El espaciado se puede llevar a cero\n');
process.exit(errores.length ? 1 : 0);
