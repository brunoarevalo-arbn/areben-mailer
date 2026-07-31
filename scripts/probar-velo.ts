// El velo de la portada con foto de fondo: que el texto se lea, y que ningún
// mail ya guardado cambie de aspecto por existir esta función.
//
// Puro: sin base y sin red. Correr:
//   node --import tsx scripts/probar-velo.ts
import { renderEmailHtml } from '../lib/email/render.ts';
import { leerContenido } from '../lib/email/esquema.ts';
import type { Bloque } from '../lib/email/bloques.ts';

let fallos = 0;
function ok(cond: boolean, desc: string, detalle = '') {
  console.log(`${cond ? '  ✅' : '  ❌'} ${desc}${detalle ? ` — ${detalle}` : ''}`);
  if (!cond) fallos++;
}

const FOTO = 'https://ejemplo.com/banner.jpg';

function render(hero: Partial<Bloque & { tipo: 'hero' }>): string {
  const bloque = {
    id: 'h', tipo: 'hero', imagen: '', titulo: 'Bienvenido', subtitulo: 'Tu premio',
    botonTexto: '', botonUrl: '', bg: '#161616', ...hero,
  } as Bloque;
  return renderEmailHtml(leerContenido({ v: 3, bloques: [bloque] }), {
    unsubscribeUrl: 'https://x/baja',
    nombreCuenta: 'QA',
  });
}

/** Solo la rama que ven los clientes modernos, sin el bloque VML de Outlook. */
const moderno = (html: string) => html.split('<!--[if !mso]><!-->')[1] ?? '';
/**
 * Solo la rama de Outlook DE LA PORTADA.
 *
 * ⚠️ No sirve agarrar el primer `<!--[if mso]>` del documento: el `<head>` del
 * shell ya trae el suyo (el `<o:PixelsPerInch>`). Hay que buscar el que tiene el
 * `<v:rect>`, que es el de este bloque.
 */
const vml = (html: string) =>
  html.split('<!--[if mso]>').find((t) => t.includes('<v:rect'))?.split('<![endif]-->')[0] ?? '';

console.log('\n① Lo que ya está guardado no se mueve');
{
  // 🔴 La invariante que más importa. Si el default fuera distinto de 0, toda
  // portada con foto ya guardada saldría con un velo que nadie pidió.
  const sinVelo = render({ fondoImagen: FOTO });
  ok(!sinVelo.includes('linear-gradient'), 'sin `velo`, no se dibuja ningún velo');
  const conCero = render({ fondoImagen: FOTO, velo: 0 });
  ok(!conCero.includes('linear-gradient'), '`velo: 0` tampoco dibuja velo');
  ok(sinVelo === conCero, 'ausente y 0 producen el MISMO html');
  ok(!vml(sinVelo).includes('opacity'), 'sin velo, el VML de Outlook no lleva opacity');
}

console.log('\n② Con velo, el texto se apoya en algo');
{
  const html = render({ fondoImagen: FOTO, velo: 55 });
  const m = moderno(html);
  ok(m.includes('linear-gradient'), 'aparece la capa del velo');
  ok(m.includes('rgba(22,22,22,0.55)'), 'usa el color `bg` y la opacidad pedida', '#161616 → rgba(22,22,22,0.55)');
  // 🔴 El orden es la diferencia entre un velo y nada: en `background-image` la
  // PRIMERA capa es la de arriba. Invertido, el gradiente queda DEBAJO de la
  // foto y no se ve absolutamente nada.
  const iGrad = m.indexOf('linear-gradient');
  const iUrl = m.indexOf(`url(${FOTO}`);
  ok(iGrad >= 0 && iUrl >= 0 && iGrad < iUrl, 'el velo va ANTES de la foto (si no, queda debajo)');
}

console.log('\n③ Outlook, que no entiende gradientes');
{
  const v = vml(render({ fondoImagen: FOTO, velo: 55 }));
  ok(v.includes('opacity="0.45"'), 'el VML lleva la opacidad COMPLEMENTARIA', 'velo 55 → imagen al 45%');
  ok(v.includes('color="#161616"'), 'y el color de fondo contra el que se mezcla');
}

console.log('\n④ Si la foto no carga');
{
  const m = moderno(render({ fondoImagen: FOTO, velo: 40 }));
  // Con las imágenes bloqueadas —el default de Outlook— antes el texto quedaba
  // sobre el fondo de la tarjeta. Si ese fondo era claro y el texto también,
  // no se veía nada.
  ok(m.includes('background-color:#161616'), 'hay un color de respaldo debajo de la foto');
}

console.log('\n⑤ Un color no puede escaparse del atributo style');
{
  // ⚠️ `esc()` NO escapa comillas: si el color se interpolara crudo, un `"`
  // cerraría el `style="…"` y lo que sigue serían atributos del div.
  const m = moderno(render({ fondoImagen: FOTO, velo: 50, bg: '#161616" onload="alert(1)' }));
  ok(m.includes('rgba(0,0,0,0.50)'), 'un color inválido cae a negro, que es un velo válido');
  ok(!m.includes('onload='), 'no se cuela ningún atributo nuevo');
  ok(moderno(render({ fondoImagen: FOTO, velo: 50, bg: '#f0a' })).includes('rgba(255,0,170,0.50)'), 'un hex de 3 dígitos se expande bien');
}

console.log('\n⑥ El velo se recorta a un rango que existe');
{
  ok(moderno(render({ fondoImagen: FOTO, velo: 150 })).includes('rgba(22,22,22,1.00)'), 'arriba de 100 se recorta a 100');
  const bajo = render({ fondoImagen: FOTO, velo: -20 });
  ok(!bajo.includes('linear-gradient'), 'un velo negativo es 0, no un gradiente al revés');
}

console.log('\n⑦ Sin foto de fondo, nada de esto existe');
{
  const html = render({ imagen: FOTO, velo: 60 });
  ok(!html.includes('linear-gradient'), 'un `velo` suelto sin `fondoImagen` no dibuja nada');
  ok(!html.includes('background-size:cover'), 'y la portada sigue siendo la de imagen arriba del texto');
}

console.log(fallos === 0 ? '\n✅ El velo OK' : `\n❌ ${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
