// Invariantes del bloque `carrito`. Lógica pura: sin base ni red.
//
// El caso que justifica el archivo es el segundo: el editor dibuja el carrito
// con productos de muestra para que se vea cómo va a quedar, y esa muestra
// **no puede salir en un envío real**. Un cliente recibiendo "Producto de
// ejemplo — Variante · Color" no es un bug cosmético: es el mail contando que
// nadie lo revisó.
//
// Correr:  node --import tsx scripts/probar-carrito.ts
import {
  renderEmailHtml,
  renderEmailTexto,
  type Bloque,
  type ProductoEmail,
} from '../lib/email/render.ts';

const OPTS = { unsubscribeUrl: '#', nombreCuenta: 'BDI' };

const P: ProductoEmail[] = [
  { nombre: 'STAR CASE', variante: 'iPhone 13 · Gris', cantidad: 2, precio: '3490', imagen: 'x.jpg', url: '#' },
];

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

const html = (bloques: Bloque[], muestraCarrito = false) =>
  renderEmailHtml({ bloques }, { ...OPTS, muestraCarrito });
const texto = (bloques: Bloque[]) => renderEmailTexto({ bloques }, OPTS);

// ─── La muestra del editor no se filtra ──────────────────────────────────────
ok(
  !html([{ tipo: 'carrito', items: [] }]).includes('Producto de ejemplo'),
  'carrito vacío en ENVÍO: la muestra NO aparece',
);
ok(
  html([{ tipo: 'carrito', items: [] }], true).includes('Producto de ejemplo'),
  'carrito vacío en PREVIEW: la muestra sí aparece',
);

// ─── Compatibilidad con lo que ya existe ─────────────────────────────────────
// Las 3 automations creadas antes de este bloque no lo declaran: el procesador
// se lo appendea, y tiene que dibujarse igual.
ok(
  html([{ tipo: 'titulo', texto: 'Hola' }, { tipo: 'carrito', items: P, restantes: 0 }]).includes('STAR CASE'),
  'automation sin bloque declarado: el carrito appendeado se dibuja',
);
// Una campaña vieja con `productos` cargados a mano, sin los campos nuevos.
ok(
  (() => {
    const h = html([{ tipo: 'productos', items: [{ nombre: 'Remera', precio: '9990', imagen: 'y.jpg', url: '#' }] }]);
    return h.includes('Remera') && h.includes('$9.990');
  })(),
  'campaña vieja con `productos`: sin cambios',
);

// ─── La línea dice lo justo ──────────────────────────────────────────────────
ok(
  !html([{ tipo: 'carrito', items: [{ ...P[0], cantidad: 1 }], restantes: 0 }]).includes('1 u.'),
  'cantidad 1: no ensucia la línea',
);
ok(
  html([{ tipo: 'carrito', items: P, restantes: 0 }]).includes('2 u.'),
  'cantidad 2: se muestra',
);
ok(
  html([{ tipo: 'carrito', items: P, restantes: 0 }]).includes('iPhone 13 · Gris'),
  'la variante se muestra aparte del nombre',
);

// ─── Lo que se recorta se avisa ──────────────────────────────────────────────
ok(texto([{ tipo: 'carrito', items: P, restantes: 3 }]).includes('y 3 productos más'), 'plural');
ok(
  (() => {
    const t = texto([{ tipo: 'carrito', items: P, restantes: 1 }]);
    return t.includes('y 1 producto más') && !t.includes('1 productos');
  })(),
  'singular conjugado',
);

// ─── El texto plano no pierde información ────────────────────────────────────
// Un mail solo-HTML es señal de spam, sobre todo en Outlook. Si la parte de
// texto se queda sin los productos, el carrito abandonado se vuelve un mail
// vacío para quien lo lea así.
ok(
  (() => {
    const t = texto([{ tipo: 'carrito', items: P, restantes: 0 }]);
    return t.includes('STAR CASE') && t.includes('iPhone 13 · Gris') && t.includes('2 u.') && t.includes('$3.490');
  })(),
  'texto plano: nombre, variante, cantidad y precio formateado',
);

console.log();
if (errores.length) {
  for (const e of errores) console.error(`❌ ${e}`);
  process.exit(1);
}
console.log('✅ Invariantes del carrito OK.\n');
