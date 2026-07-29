// Comprueba contra la API REAL de Tiendanube que las cuatro fuentes del bloque
// de productos automáticos devuelven algo.
//
//   node --env-file=.env --import tsx scripts/verificar-productos-tn.ts
//
// Por qué existe, y por qué no alcanza `probar-productos-dinamicos.ts`: ese
// script usa un `fetch` de mentira, así que verifica que le pedimos a TN lo que
// creemos, pero **no** que TN entienda lo que le pedimos. Si `sort_by` no acepta
// `best-selling`, la llamada devuelve 4xx, el bloque queda vacío y —porque un
// bloque vacío no se dibuja a propósito— **el mail sale sin él, sin ningún
// error**. Es el modo de falla más caro que tiene este bloque: silencioso.
//
// Solo lee. No escribe nada, ni en TN ni en la base.
import { prisma } from "../lib/prisma";
import { traerProductos, listarCategorias } from "../lib/tn/products";
import { ETIQUETA_FUENTE, type FuenteProductos } from "../lib/email/bloques";
import { vaciarCacheProductos } from "../lib/email/productos-dinamicos";

async function main() {
  const cuentas = await prisma.cuenta.findMany({
    where: { tnStoreId: { not: null }, tnToken: { not: null } },
    select: { id: true, slug: true, tnStoreId: true, tnToken: true },
    orderBy: { createdAt: "asc" },
  });
  if (!cuentas.length) {
    console.log("No hay ninguna cuenta con Tiendanube conectada.");
    return;
  }

  let vacias = 0;

  for (const c of cuentas) {
    console.log(`\n· ${c.slug}`);

    // Una categoría real de la tienda, para poder probar esa fuente de verdad:
    // con un id inventado, "no devolvió nada" no distingue entre "la fuente no
    // anda" y "esa categoría está vacía".
    let categoriaId: string | undefined;
    try {
      const cats = await listarCategorias(c.tnStoreId!, c.tnToken!);
      categoriaId = cats[0]?.id;
      console.log(`    categorías: ${cats.length}${categoriaId ? ` · probando con "${cats[0].nombre}"` : ""}`);
    } catch (e) {
      console.log(`    ✗ categorías: ${(e as Error).message}`);
    }

    for (const fuente of Object.keys(ETIQUETA_FUENTE) as FuenteProductos[]) {
      // Sin vaciar el caché, la segunda cuenta leería lo de la primera si la
      // consulta coincidiera. Acá queremos preguntar de verdad, cada vez.
      vaciarCacheProductos();
      const productos = await traerProductos(c.tnStoreId!, c.tnToken!, {
        fuente,
        categoriaId: fuente === "categoria" ? categoriaId : undefined,
        n: 4,
      });
      const etiqueta = ETIQUETA_FUENTE[fuente].padEnd(26);
      if (!productos.length) {
        vacias++;
        // Vacío NO siempre es un error: una tienda sin nada rebajado devuelve
        // cero en `oferta` y está bien. Por eso se marca y se mira, no se falla.
        console.log(`    ⚠️  ${etiqueta} 0 productos — revisar si es la tienda o la consulta`);
        continue;
      }
      console.log(`    ✅ ${etiqueta} ${productos.length} · ${productos[0].nombre}`);
    }
  }

  console.log(
    vacias
      ? `\n⚠️  ${vacias} consulta(s) sin resultados. En "oferta" puede ser normal; en "los más vendidos" es que el orden que le pedimos a TN no existe.\n`
      : "\n✅ Las cuatro fuentes devuelven productos en todas las tiendas.\n",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
