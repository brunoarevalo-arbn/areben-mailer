// Invariantes del tema del mail. Lógica pura: sin base ni red.
//
// Lo que se protege acá es la LEGIBILIDAD, que es la forma en que un tema falla
// sin avisar: nadie tira una excepción por mandar un mail con letras blancas
// sobre fondo blanco. Sale, llega, y del otro lado hay una pantalla en blanco.
//
// Correr:  node --import tsx scripts/probar-tema.ts
import { renderEmailHtml, type Bloque } from '../lib/email/render.ts';
import { resolverPaleta, combinarTema, esColorOscuro, temaDe, FUENTES } from '../lib/email/tema.ts';

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

const OPTS = { unsubscribeUrl: '#', nombreCuenta: 'BDI' };
const html = (bloques: Bloque[], tema?: object, temaMarca?: object) =>
  renderEmailHtml({ bloques, tema }, { ...OPTS, temaMarca });

// ─── Sin tema, nada cambia ───────────────────────────────────────────────────
// La red que permite tocar el renderer sin repintar los mails que ya existen.
const base = html([{ tipo: 'titulo', texto: 'Hola' }]);
ok(base.includes('background:#f4f4f5'), 'sin tema: el fondo sigue siendo el de siempre');
ok(base.includes('max-width:600px'), 'sin tema: el ancho sigue en 600');
ok(base.includes('#f59e0b'), 'sin tema: el acento sigue en ámbar');
ok(base.includes('lang="es"'), 'sin tema: el idioma sigue en es');

// ─── El texto del botón se decide por el botón ───────────────────────────────
// Un acento claro con letras blancas encima no se lee. Pasaría siempre si el
// color del texto fuera fijo, que es como estaba antes.
const clarito = resolverPaleta({ acento: '#fde047' }); // amarillo claro
const oscurito = resolverPaleta({ acento: '#1d4ed8' }); // azul oscuro
ok(clarito.sobreAcento === '#171717', 'botón claro: texto oscuro encima');
ok(oscurito.sobreAcento === '#ffffff', 'botón oscuro: texto claro encima');

// ─── Los bloques con fondo propio no heredan a ciegas ────────────────────────
// Un hero blanco dentro de un mail oscuro tiene que llevar texto OSCURO.
const heroBlancoEnOscuro = html(
  [{ tipo: 'hero', imagen: '', titulo: 'Título', subtitulo: 'Sub', botonTexto: '', botonUrl: '', bg: '#ffffff' }],
  { base: 'oscuro' },
);
ok(
  heroBlancoEnOscuro.includes('color:#171717'),
  'hero claro dentro de un mail oscuro: el título NO queda blanco sobre blanco',
);
const heroNegroEnClaro = html(
  [{ tipo: 'hero', imagen: '', titulo: 'Título', subtitulo: 'Sub', botonTexto: '', botonUrl: '', bg: '#161616' }],
  {},
);
ok(
  heroNegroEnClaro.includes('color:#fafafa'),
  'hero oscuro dentro de un mail claro: el título NO queda negro sobre negro',
);

// ─── El modo oscuro llega al cuerpo ──────────────────────────────────────────
const oscuro = html([{ tipo: 'texto', texto: 'Cuerpo', align: 'left' }], { base: 'oscuro' });
ok(oscuro.includes('background:#0f0f0f'), 'oscuro: el fondo de página cambia');
ok(!oscuro.includes('color:#404040'), 'oscuro: el cuerpo NO usa el gris del tema claro');

// ─── La campaña pisa a la marca, campo por campo ─────────────────────────────
// El merge es por campo para que una campaña pueda cambiar solo el botón sin
// perder el ancho que definió la marca.
const mezcla = combinarTema({ ancho: 700, acento: '#111111' }, { acento: '#ff0000' });
ok(mezcla.ancho === 700, 'merge: la campaña conserva el ancho de la marca');
ok(mezcla.acento === '#ff0000', 'merge: la campaña pisa el acento');
const conMarca = html([{ tipo: 'boton', texto: 'Ir', url: '#', align: 'left' }], { acento: '#ff0000' }, { ancho: 700 });
ok(conMarca.includes('max-width:700px') && conMarca.includes('background:#ff0000'), 'merge aplicado al render');

// ─── Un tema roto no puede frenar una campaña ────────────────────────────────
// Preferimos un mail feo a un mail que no sale.
ok(resolverPaleta({ ancho: 99999 }).ancho === 700, 'ancho absurdo: se acota a 700');
ok(resolverPaleta({ ancho: 1 }).ancho === 600, 'ancho absurdo: se acota a 600');
ok(resolverPaleta({ fondo: '   ' }).fondo === '#f4f4f5', 'color vacío: cae al del tema');
// @ts-expect-error a propósito: así llega un Json guardado con una fuente vieja.
ok(resolverPaleta({ fuente: 'inexistente' }).fuente === FUENTES.sistema, 'fuente desconocida: cae a la de siempre');

// ─── Nunca una webfont ───────────────────────────────────────────────────────
// Outlook y Gmail descartan el <link> a Google Fonts, así que ofrecerla sería
// diseñar para una tipografía que la mitad de la gente no ve.
ok(
  !Object.values(FUENTES).some((f) => /google|@import|http/i.test(f)),
  'ninguna fuente depende de una descarga',
);

// ─── temaDe lee lo que hay y no explota con lo que no ────────────────────────
ok(temaDe({ tema: { base: 'oscuro' } })?.base === 'oscuro', 'temaDe: lee el tema guardado');
ok(temaDe({ url: 'x' }) === undefined, 'temaDe: config sin tema devuelve undefined');
ok(temaDe(null) === undefined, 'temaDe: null no rompe');
ok(temaDe('no soy un objeto') === undefined, 'temaDe: basura no rompe');

// ─── Luminancia ──────────────────────────────────────────────────────────────
ok(esColorOscuro('#000000') && !esColorOscuro('#ffffff'), 'blanco y negro');
ok(esColorOscuro('#161616'), 'el negro de la plantilla es oscuro');
ok(!esColorOscuro('#fde047'), 'el amarillo NO es oscuro');
ok(!esColorOscuro('nada'), 'un color inválido no se toma por oscuro');

console.log();
if (errores.length) {
  for (const e of errores) console.error(`❌ ${e}`);
  process.exit(1);
}
console.log('✅ Invariantes del tema OK.\n');
