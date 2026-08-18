// Invariantes de `RenderOpts.marcarBloques`. Lógica pura: sin base ni red.
//
// El marcado existe para que un click en el preview abra el formulario del
// bloque que se tocó. Lo que este script custodia es que sea **solo eso**:
//
//   1. ⛔ Sin la opción no aparece ni un `data-b`. Es la garantía de que ningún
//      envío lleva el atributo: son bytes contra los ~102 KB con los que Gmail
//      recorta, y el golden compara el HTML del ENVÍO.
//   2. Con la opción, todo bloque que dibuja algo queda marcado — si no, hay
//      partes del mail que no se pueden tocar y no se sabe cuáles.
//   3. La marca queda donde el NAVEGADOR la ve: fuera de los comentarios
//      condicionales de Outlook, o el click no encuentra nada.
//   4. Un id con comillas no se escapa del atributo (todo lo que sale del Json
//      pasa por un filtro, `esc()` no alcanza — es la regla de siempre).
//
// Correr:  node --import tsx scripts/probar-marcado.ts
import { renderEmailHtml, nuevoBloque, type Bloque } from '../lib/email/render.ts';
import { TIPOS_BLOQUE } from '../lib/email/bloques.ts';
import { V_ACTUAL } from '../lib/email/esquema.ts';

const OPTS = {
  unsubscribeUrl: '#',
  nombreCuenta: 'BDI',
  // Para que los bloques que dependen de la marca o de la tienda dibujen algo:
  // un bloque vacío no se dibuja a propósito, y ahí no hay nada que marcar.
  urlCuenta: 'https://bdiaccesorios.com.ar',
  assetsBase: 'https://links.bdiaccesorios.com.ar',
  muestraCarrito: true,
  permiteHtmlCrudo: true,
  redesMarca: [{ red: 'instagram', url: 'https://instagram.com/bdi_accesorios' }],
};

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

/** El HTML sin los comentarios condicionales: lo que un navegador ve de verdad. */
const sinComentarios = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

// Un documento con TODOS los tipos de bloque. `nuevoBloque` les pone id.
const todos: Bloque[] = TIPOS_BLOQUE.map((t) => nuevoBloque(t));
// ⚠️ Los que nacen vacíos NO se dibujan a propósito (un hueco es peor que
// nada), así que se les da lo mínimo o el marcado no tendría a qué agarrarse.
for (const b of todos) {
  if (b.tipo === 'imagen') b.url = 'https://ejemplo.com/foto.jpg';
  if (b.tipo === 'video') { b.imagen = 'https://ejemplo.com/mini.jpg'; b.url = 'https://youtu.be/x'; }
  if (b.tipo === 'html') b.contenido = '<p>hola</p>';
  if (b.tipo === 'productos') b.items = [{ nombre: 'Funda', precio: '1000', imagen: 'x.jpg', url: '#' }];
  if (b.tipo === 'menu') b.links = [{ texto: 'Novedades', url: 'https://x.com/new-in' }];
  if (b.tipo === 'redes') b.links = [{ red: 'Instagram', url: 'https://instagram.com/bdi' }];
  if (b.tipo === 'columnas') b.celdas = [{ imagen: 'a.jpg', url: '#' }, { imagen: 'b.jpg', url: '#' }];
  // Nace con un título encima pero SIN foto, y sin foto no hay banda que marcar.
  if (b.tipo === 'foto-encima') b.foto = 'https://ejemplo.com/fondo.jpg';
}

/**
 * 🔴 `v: V_ACTUAL` NO es decorativo.
 *
 * `renderEmailHtml` vuelve a pasar el documento por `leerContenido`, y un
 * documento sin versión se MIGRA: la migración le materializa un encabezado
 * nuevo, con id nuevo. Un `data-b` con un id que el editor no conoce es un click
 * que no selecciona nada, y sería un bug invisible desde acá. Los documentos de
 * verdad ya vienen en la versión actual (el editor los lee con `leerContenido`),
 * así que el camino rápido los devuelve intactos y los ids se respetan.
 */
const doc = (bloques: Bloque[]) => ({ v: V_ACTUAL, bloques });

const conMarca = renderEmailHtml(doc(todos), { ...OPTS, marcarBloques: true });
const sinMarca = renderEmailHtml(doc(todos), OPTS);

// ─── 1. El envío no lleva marcas ─────────────────────────────────────────────
ok(!sinMarca.includes('data-b'), 'sin `marcarBloques`: cero `data-b` en el HTML');
ok(sinMarca.length < conMarca.length, 'el marcado solo AGREGA (el envío es más liviano)');

// ─── 2 y 3. Todo lo que se dibuja, se puede tocar ────────────────────────────
const visible = sinComentarios(conMarca);

// ⚠️ La referencia lleva SIEMPRE un encabezado: `leerContenido` se lo materializa
// a todo documento que no lo tenga, así que comparar contra `[]` diría que el
// encabezado "no aporta" cuando en realidad se dibuja siempre.
const enc = todos.find((b) => b.tipo === 'encabezado')!;
const solo = (bs: Bloque[]) => renderEmailHtml(doc(bs), OPTS).length;

for (const b of todos) {
  if (b.tipo === 'encabezado') continue;
  const aporta = solo([enc, b]) > solo([enc]);
  if (!aporta) {
    ok(false, `${b.tipo}: no dibujó nada — el caso de prueba está mal armado`);
    continue;
  }
  ok(visible.includes(`data-b="${b.id}"`), `${b.tipo}: marcado y VISIBLE para el navegador`);
}
// El encabezado se dibuja FUERA de la tarjeta y por otro camino del renderer:
// es el que más fácil se queda sin marcar de un refactor.
ok(visible.includes(`data-b="${enc.id}"`), 'encabezado: marcado (va por su propio camino)');

// ─── 4. El id no se escapa del atributo ──────────────────────────────────────
const sucio = renderEmailHtml(
  doc([{ ...nuevoBloque('titulo'), id: 'x" onload="alert(1)' } as Bloque]),
  { ...OPTS, marcarBloques: true },
);
ok(!sucio.includes(' onload='), 'un id con comillas NO se escapa del atributo');
ok(sucio.includes('data-b="xonloadalert1"'), 'el id sucio queda filtrado, no descartado');

// ─── El bloque que devuelve "" se devuelve tal cual ──────────────────────────
// El `html` sin el permiso de la cuenta no emite NADA (no un hueco: nada), y ahí
// no hay etiqueta a la que pegarle el atributo.
const crudo = nuevoBloque('html');
const sinPermiso = renderEmailHtml(doc([enc, crudo]), { ...OPTS, permiteHtmlCrudo: false, marcarBloques: true });
ok(!sinPermiso.includes(`data-b="${crudo.id}"`), 'un bloque que emite vacío no deja un `data-b` colgado');

console.log(errores.length ? `\n❌ ${errores.length} fallo(s)` : '\n✅ El marcado es solo del preview');
process.exit(errores.length ? 1 : 0);
