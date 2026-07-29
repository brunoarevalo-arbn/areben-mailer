// Invariantes del bloque `productos-dinamicos`. Sin base y sin red de verdad:
// el `fetch` global se reemplaza por uno de mentira que cuenta llamadas.
//
// Los dos casos que justifican el archivo:
//
//   1. **Los productos no se guardan.** El bloque guarda una consulta. Un Json
//      con productos adentro es una plantilla que le manda el catálogo de BDI a
//      Zattia — el mismo bug que ya pasó con el nombre de la marca.
//   2. **Una campaña no son 16.800 llamadas a Tiendanube.** El límite de la API
//      se comparte con el monitor y con Resorty. Si el caché deja de andar, la
//      cuenta se vuelve el cuello de botella del envío y nadie se entera hasta
//      que TN empieza a devolver 429.
//
// ⚠️ Todo va adentro de `main()`: `tsx` compila a CommonJS y ahí el `await` de
// nivel superior no existe.
//
// Correr:  node --import tsx scripts/probar-productos-dinamicos.ts
import { renderEmailHtml, renderEmailTexto, type Bloque, type ProductoEmail } from '../lib/email/render.ts';
import { leerContenido } from '../lib/email/esquema.ts';
import { claveProductos, nuevoBloque } from '../lib/email/bloques.ts';
import { resolverProductosDinamicos, vaciarCacheProductos } from '../lib/email/productos-dinamicos.ts';

const OPTS = { unsubscribeUrl: '#', nombreCuenta: 'BDI' };

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

const html = (bloques: Bloque[]) => renderEmailHtml({ bloques }, OPTS);

// ─── El fetch de mentira ─────────────────────────────────────────────────────
// Devuelve productos de TN con la forma real: `variants[].stock` donde `null`
// significa ilimitado, y `promotional_price` solo en los que están rebajados.
const prod = (id: number, nombre: string, stock: number | null, promo?: string) => ({
  id,
  name: { es: nombre },
  canonical_url: `https://bdi.com/${id}`,
  images: [{ src: `https://cdn/${id}.jpg` }],
  variants: [{ price: '10000', promotional_price: promo ?? null, stock }],
});

const CATALOGO = [
  prod(1, 'Con stock', 5),
  prod(2, 'Sin stock', 0),
  prod(3, 'Stock ilimitado', null),
  prod(4, 'En oferta', 8, '7000'),
];

let llamadas: string[] = [];
let responder: () => { ok: boolean; body: unknown } = () => ({ ok: true, body: CATALOGO });

globalThis.fetch = (async (url: string | URL) => {
  llamadas.push(String(url));
  const r = responder();
  return {
    ok: r.ok,
    status: r.ok ? 200 : 500,
    json: async () => r.body,
    text: async () => JSON.stringify(r.body),
  } as Response;
}) as typeof fetch;

const CUENTA = { id: 'cuenta-bdi', tnStoreId: '111', tnToken: 'tok' };
const reset = () => {
  llamadas = [];
  responder = () => ({ ok: true, body: CATALOGO });
  vaciarCacheProductos();
};

const dinamico = (extra: Partial<Extract<Bloque, { tipo: 'productos-dinamicos' }>> = {}): Bloque =>
  ({ tipo: 'productos-dinamicos', fuente: 'destacados', n: 4, ...extra }) as Bloque;

/** Los nombres que la consulta de este bloque devolvió. */
const nombresDe = (mapa: Record<string, ProductoEmail[]>, b: Bloque): string[] =>
  (mapa[claveProductos(b as Extract<Bloque, { tipo: 'productos-dinamicos' }>)] ?? []).map((p) => p.nombre);

async function main() {
  // ─── 1. Sin productos no se dibuja NADA ────────────────────────────────────
  // Si TN no contesta, o la consulta vuelve vacía, el mail sale sin el bloque en
  // vez de con un hueco. Es el mismo criterio que el carrito vacío.
  ok(
    !html([dinamico()]).includes('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px">'),
    'sin items: no dibuja la grilla',
  );
  ok(!renderEmailTexto({ bloques: [dinamico()] }, OPTS).includes('·'), 'sin items: tampoco en texto plano');

  // ─── 2. Con productos, es la MISMA grilla que `productos` ──────────────────
  // El bloque no tiene render propio a propósito: si divergieran, cambiar uno
  // elegido a mano por uno automático movería el diseño del mail.
  {
    const items = [{ nombre: 'Remera', precio: '9990', imagen: 'y.jpg', url: '#' }];
    const b = dinamico();
    const dinamicoHtml = renderEmailHtml(
      { bloques: [b] },
      { ...OPTS, productosDinamicos: { [claveProductos(b as Extract<Bloque, { tipo: 'productos-dinamicos' }>)]: items } },
    );
    ok(
      html([{ tipo: 'productos', items }]) === dinamicoHtml,
      'con los mismos productos, dibuja exactamente lo mismo que `productos`',
    );
  }

  // ─── 3. De punta a punta: resolver → renderizar → aparece ──────────────────
  // 🔴 Esta es la prueba que encontró el bug de diseño. En la primera versión los
  // productos viajaban ADENTRO del bloque, y `renderEmailHtml` normaliza el
  // contenido con `leerContenido` "por las dudas" — que es justo donde estaba la
  // limpieza que impedía guardarlos. Resultado: se borraban un instante antes de
  // dibujarse y el bloque no aparecía nunca, en ningún mail.
  reset();
  {
    const b = dinamico();
    const productosDinamicos = await resolverProductosDinamicos([b], CUENTA);
    const h = renderEmailHtml({ bloques: [b] }, { ...OPTS, productosDinamicos });
    ok(h.includes('Con stock'), 'el producto resuelto llega al HTML del mail');
    const t = renderEmailTexto({ bloques: [b] }, { ...OPTS, productosDinamicos });
    ok(t.includes('Con stock'), 'y también a la parte de texto plano');
  }

  // ─── 4. Los productos NUNCA se guardan ─────────────────────────────────────
  ok(!('items' in nuevoBloque('productos-dinamicos')), 'nace sin productos adentro');
  {
    // Un Json que llegó con productos adentro —editado a mano, o por un script,
    // o guardado por una versión vieja del panel— se lava al leerlo, incluso
    // declarando la versión actual (el camino rápido de `esActual`).
    const limpio = leerContenido({
      v: 3,
      bloques: [
        { tipo: 'encabezado' },
        {
          tipo: 'productos-dinamicos',
          fuente: 'destacados',
          n: 4,
          items: [{ nombre: 'De otra marca', precio: '1', imagen: 'z.jpg', url: '#' }],
        },
      ],
    });
    const bloque = limpio.bloques.find((b) => b.tipo === 'productos-dinamicos');
    ok(bloque !== undefined && !('items' in bloque), 'leerContenido tira los productos guardados');
    ok(bloque?.tipo === 'productos-dinamicos' && bloque.fuente === 'destacados', 'pero conserva la consulta');
  }

  // ─── 5. Una consulta, una llamada ──────────────────────────────────────────
  reset();
  {
    const b = dinamico();
    const mapa = await resolverProductosDinamicos([b, dinamico()], CUENTA);
    ok(llamadas.length === 1, `dos bloques iguales en el mismo mail: 1 llamada (fueron ${llamadas.length})`);
    ok(nombresDe(mapa, b).length > 0, 'y los dos comparten la misma respuesta');
  }
  {
    // El segundo lote de la misma campaña no vuelve a preguntar. Sin esto, los
    // 16.800 de BDI son 840 llamadas en una hora.
    await resolverProductosDinamicos([dinamico()], CUENTA);
    ok(llamadas.length === 1, `segundo lote dentro del TTL: sigue en 1 llamada (fueron ${llamadas.length})`);
  }
  {
    // Pero otra tienda es otra respuesta: mezclarlas mandaría productos de BDI
    // en un mail de Zattia.
    await resolverProductosDinamicos([dinamico()], { id: 'cuenta-zattia', tnStoreId: '222', tnToken: 'tok2' });
    ok(llamadas.length === 2, 'otra cuenta con la misma consulta: llamada aparte');
    ok(llamadas[1]?.includes('/222/') === true, 'y le pregunta a SU tienda');
  }

  // ─── 6. Lo agotado no se promociona ────────────────────────────────────────
  reset();
  {
    const b = dinamico({ n: 6 });
    const nombres = nombresDe(await resolverProductosDinamicos([b], CUENTA), b);
    ok(!nombres.includes('Sin stock'), 'un producto agotado no entra al mail');
    ok(nombres.includes('Stock ilimitado'), '`stock: null` es ilimitado, no cero');
    ok(nombres.includes('Con stock'), 'lo disponible sí entra');
  }

  // ─── 7. Cada fuente le pide a TN lo que corresponde ────────────────────────
  reset();
  await resolverProductosDinamicos([dinamico({ fuente: 'destacados' })], CUENTA);
  ok(llamadas[0]?.includes('sort_by=best-selling') === true, 'destacados → más vendidos');
  ok(llamadas[0]?.includes('published=true') === true, 'solo productos publicados');

  reset();
  await resolverProductosDinamicos([dinamico({ fuente: 'recientes' })], CUENTA);
  ok(llamadas[0]?.includes('sort_by=created-at-descending') === true, 'recientes → los últimos cargados');

  reset();
  {
    // TN no sabe responder "dame lo rebajado": se filtra en casa.
    const b = dinamico({ fuente: 'oferta', n: 6 });
    const nombres = nombresDe(await resolverProductosDinamicos([b], CUENTA), b);
    ok(
      nombres.length === 1 && nombres[0] === 'En oferta',
      `oferta → solo los que tienen precio promocional (quedaron: ${nombres.join(', ') || '—'})`,
    );
  }

  reset();
  await resolverProductosDinamicos([dinamico({ fuente: 'categoria', categoriaId: '99' })], CUENTA);
  ok(llamadas[0]?.includes('category_id=99') === true, 'categoría → filtra por esa categoría');

  reset();
  {
    // Sin categoría elegida NO se cae al catálogo entero: mandar "lo que sea"
    // donde el autor pidió una categoría es peor que no mandar el bloque.
    const b = dinamico({ fuente: 'categoria' });
    const mapa = await resolverProductosDinamicos([b], CUENTA);
    ok(llamadas.length === 0, 'categoría sin elegir: ni siquiera pregunta');
    ok(nombresDe(mapa, b).length === 0, 'y el bloque queda vacío');
  }

  // ─── 8. Que TN esté caído no frena la campaña ──────────────────────────────
  reset();
  responder = () => ({ ok: false, body: { error: 'boom' } });
  {
    const bloques: Bloque[] = [{ tipo: 'titulo', texto: 'Hola' }, dinamico()];
    const productosDinamicos = await resolverProductosDinamicos(bloques, CUENTA);
    const h = renderEmailHtml({ bloques }, { ...OPTS, productosDinamicos });
    ok(h.includes('Hola'), 'TN caído: no lanza y el resto del mail sale igual');
    ok(!h.includes('Con stock'), 'y el bloque no se dibuja');
  }

  // ─── 9. Una cuenta sin Tiendanube conectada ────────────────────────────────
  reset();
  {
    const b = dinamico();
    const mapa = await resolverProductosDinamicos([b], { id: 'x', tnStoreId: null, tnToken: null });
    ok(llamadas.length === 0, 'sin tienda conectada: no pregunta');
    ok(nombresDe(mapa, b).length === 0, 'y el bloque no se dibuja');
  }

  // ─── 10. Un mail sin bloques dinámicos no paga nada ────────────────────────
  reset();
  {
    const mapa = await resolverProductosDinamicos([{ tipo: 'titulo', texto: 'Hola' }], CUENTA);
    ok(Object.keys(mapa).length === 0, 'sin bloques dinámicos: no resuelve nada');
    ok(llamadas.length === 0, 'y sin tocar la red');
  }

  console.log();
  if (errores.length) {
    for (const e of errores) console.error(`❌ ${e}`);
    process.exit(1);
  }
  console.log('✅ Invariantes de productos automáticos OK.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
