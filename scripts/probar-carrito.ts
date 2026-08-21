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
import { conCarrito, muestraDePrueba, urlVueltaDePrueba } from '../lib/email/prueba.ts';

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

// ─── El «y N más» emite un placeholder, y quien lo emita tiene que resolverlo ─
// 🔴 El bloque `carrito` escribe `${cart.url}` **por su cuenta** cuando quedan
// productos afuera, y hasta el 20-ago-2026 el procesador lo reemplazaba sólo
// para el trigger `CARRITO_ABANDONADO`. Mientras el bloque fue exclusivo de ese
// mail eso alcanzaba; dejó de alcanzar el día que el pedido de reseña usó el
// mismo bloque, y ese mail salía con el texto `${cart.url}` escrito tal cual en
// la casilla de un cliente. Medido antes de arreglarlo, en el HTML y en el texto.
//
// Esta comprobación fija el HECHO —el bloque emite el placeholder— para que se
// vea por qué el reemplazo del procesador no puede estar gateado por el trigger.
ok(
  (() => {
    const h = html([{ tipo: 'carrito', items: P, restantes: 2 }]);
    const t = texto([{ tipo: 'carrito', items: P, restantes: 2 }]);
    return h.includes('${cart.url}') && t.includes('${cart.url}');
  })(),
  'con productos afuera, el bloque emite ${cart.url} en HTML y en texto (el procesador lo resuelve SIEMPRE, sea cual sea el trigger)',
);
ok(
  (() => {
    const h = html([{ tipo: 'carrito', items: P, restantes: 0 }]);
    const t = texto([{ tipo: 'carrito', items: P, restantes: 0 }]);
    return !h.includes('${cart.url}') && !t.includes('${cart.url}');
  })(),
  'y sin productos afuera no lo emite: por eso el pedido de reseña manda restantes 0',
);

console.log();
if (errores.length) {
  for (const e of errores) console.error(`❌ ${e}`);
  process.exit(1);
}
console.log('✅ Invariantes del carrito OK.\n');

// ─── El mail de PRUEBA se parece al que va a salir ───────────────────────────
// 🔴 El agujero medido el 21-ago-2026: «mandar una prueba» renderizaba el
// documento tal como está guardado, sin nada de lo que pone el procesador. El
// pedido de reseña llegaba SIN el bloque `carrito` —o sea sin productos y sin
// estrellas, su único contenido concreto— y el carrito abandonado llegaba con
// `${cart.url}` LITERAL en el href del botón. Los dos sin ningún error: el mail
// parecía terminado. Y «mandar una prueba» es el único camino para mirar el
// correo en Gmail y en Outlook de verdad.
{
  // El documento del preset de reseña: título, texto y el `carrito` en modo resena.
  const doc: Bloque[] = [
    { tipo: 'titulo', texto: '¿Nos contás qué te pareció?' },
    { tipo: 'carrito', items: [], modo: 'resena' } as Bloque,
  ];

  ok(
    !html(doc).includes('Puntuá'),
    'sin items, el bloque no se dibuja (es la causa del agujero, no un bug)',
  );

  const TIENDA = 'https://bdiaccesorios.com.ar';
  // ⚠️ Con el `unsubscribeUrl` REAL de una prueba y no el `'#'` de `OPTS`: si no,
  // el chequeo de «ningún link muerto» se pondría rojo por el pie del propio
  // ensayo y no por el mail.
  const htmlPrueba = (bs: Bloque[]) =>
    renderEmailHtml({ bloques: bs }, { ...OPTS, unsubscribeUrl: `${TIENDA}/baja?token=preview` });
  const items = muestraDePrueba(TIENDA, (pid, _n, r) => `https://resorty.test/opinar/tok-${pid}-${r}`);
  const conMuestra = htmlPrueba(conCarrito(doc, items));
  ok(conMuestra.includes('Puntuá'), 'PRUEBA de reseña: la fila de estrellas SÍ se dibuja');
  ok(
    (conMuestra.match(/opinar\/tok-/g) ?? []).length === 10,
    'PRUEBA de reseña: cinco estrellas por cada uno de los dos productos de muestra',
    `salieron ${(conMuestra.match(/opinar\/tok-/g) ?? []).length}`,
  );
  // 🔴 Un `#` en una casilla es un link que no lleva a ningún lado.
  ok(!conMuestra.includes('href="#"'), 'PRUEBA de reseña: NINGÚN link del mail apunta a "#" (ni la estrella ni la línea)');

  // Sin poder firmar (falta RESENA_SECRET) NO salen cinco links rotos: no salen.
  const sinFirma = htmlPrueba(conCarrito(doc, muestraDePrueba(TIENDA, () => null)));
  ok(sinFirma.includes('Producto de ejemplo'), 'sin firma: los productos igual se dibujan');
  ok(!sinFirma.includes('Puntuá'), 'sin firma: NO se dibuja media escala de estrellas');

  // El bloque appendeado, para las automations viejas que no lo declaran.
  const viejo = conCarrito([{ tipo: 'titulo', texto: 'Hola' }], items);
  ok(viejo.some((b) => b.tipo === 'carrito'), 'sin bloque declarado, la prueba lo appendea igual que el procesador');

  // Y el destino de `${cart.url}`.
  ok(urlVueltaDePrueba('https://bdiaccesorios.com.ar') === 'https://bdiaccesorios.com.ar', 'la vuelta lleva a la tienda');
  ok(urlVueltaDePrueba(undefined) === '#', 'sin sitio cargado, "#" — un href vacío recarga la misma página');
}
