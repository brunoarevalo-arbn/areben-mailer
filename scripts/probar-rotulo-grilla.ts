// El rótulo de una grilla se va con ella. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-rotulo-grilla.ts
//
// El caso (12-oct-2026): el 2/4 de la bienvenida de Zattia tiene tres estantes
// «TOPS / BLUSAS / MINIS ······ VER MÁS →», cada uno sobre una grilla cruzada con
// NEW IN. El día que una categoría no tiene nada nuevo, la grilla no se dibuja
// —bien— pero el rótulo quedaba solo, prometiendo prendas que no estaban.
import { renderEmailHtml, renderEmailTexto, type Bloque, type ProductoEmail } from '../lib/email/render.ts';
import { claveProductos } from '../lib/email/bloques.ts';

let fallas = 0;
const ok = (cond: boolean, que: string) => {
  console.log(`  ${cond ? '✓' : '✗'} ${que}`);
  if (!cond) fallas++;
};

const rotulo = (texto: string, link = true): Bloque => ({
  id: `r-${texto}`, tipo: 'titulo', texto,
  ...(link ? { link: { texto: 'Ver más →', url: 'https://zattia.com.ar/x' } } : {}),
} as Bloque);
const grilla = (cat: string): Bloque => ({ id: `g-${cat}`, tipo: 'productos-dinamicos', fuente: 'categoria', categoriaId: cat, n: 4 } as Bloque);
const prenda = (n: string): ProductoEmail => ({ nombre: n, url: `https://zattia.com.ar/${n}`, imagen: `https://cdn/${n}.jpg`, precio: '$10.000' } as ProductoEmail);

const bloques: Bloque[] = [
  rotulo('Tops'), grilla('1'),
  rotulo('Minis'), grilla('2'),               // ← la vacía
  rotulo('Prosa sin link', false), grilla('3'), // ← vacía, pero el título no es rótulo
];
const productosDinamicos = {
  [claveProductos(grilla('1'))]: [prenda('top-quartz')],
  [claveProductos(grilla('2'))]: [],
  [claveProductos(grilla('3'))]: [],
};
const OPTS = { unsubscribeUrl: '#', nombreCuenta: 'Zattia', productosDinamicos };

for (const [nombre, html] of [
  ['HTML', renderEmailHtml({ bloques }, OPTS)],
  ['HTML con marcas del editor', renderEmailHtml({ bloques }, { ...OPTS, marcarBloques: true })],
  ['HTML adentro de una banda', renderEmailHtml({ bloques: [{ id: 'b', tipo: 'banda', fondo: '#fff', bloques } as unknown as Bloque] }, OPTS)],
  ['texto plano', renderEmailTexto({ bloques }, OPTS)],
  ['texto plano adentro de una banda', renderEmailTexto({ bloques: [{ id: 'b', tipo: 'banda', fondo: '#fff', bloques } as unknown as Bloque] }, OPTS)],
] as const) {
  console.log(`\n${nombre}`);
  ok(html.includes('Tops') && html.includes('top-quartz'), 'el estante con prendas sale con su rótulo');
  ok(!html.includes('Minis'), 'el estante vacío se lleva su rótulo');
  ok(html.includes('Prosa sin link'), 'un título SIN link se queda aunque lo que siga no salga');
}

if (fallas) { console.error(`\n${fallas} falla(s)`); process.exit(1); }
console.log('\nTodo bien.');
