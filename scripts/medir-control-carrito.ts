// ¿La secuencia de carrito VENDE, o acompaña compras que iban a pasar igual?
// Compara cuántos carritos terminan en compra con mails y sin mails (el grupo de
// control de `grupoDeCarrito`). Sólo lee.
//
//   node --env-file=.env --import tsx scripts/medir-control-carrito.ts [--cuenta=bdi]
//
// El oráculo de «compró» es `RECUPERADO`, que escribe el barrido de
// `/api/carritos/recuperados` — el mismo para los dos grupos, que es lo que
// hace válida la comparación. ⚠️ El barrido mira 7 días: un carrito de hace
// menos de una semana todavía puede pasar a comprado, así que esos se excluyen.
//
// 🔑 Con ~6 carritos por día y 10% al control, son ~4 carritos de control por
// semana. Hasta tener unos 60 (≈ 3-4 meses) la diferencia es ruido: el script
// dice el tamaño de cada grupo para que nadie decida con 12.
import { prisma } from '../lib/prisma.ts';

const slug = process.argv.find((a) => a.startsWith('--cuenta='))?.split('=')[1] ?? 'bdi';

async function main() {
  const filas = await prisma.$queryRawUnsafe<{ grupo: string; n: number; compraron: number; desde: Date | null }[]>(
    `SELECT COALESCE(v.grupo, 'CON MAILS') AS grupo,
            COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE v.estado = 'RECUPERADO')::int AS compraron,
            MIN(v."createdAt") AS desde
       FROM "CarritoVisto" v JOIN "Cuenta" c ON c.id = v."cuentaId"
      WHERE c.slug = $1
        AND v.estado IN ('ENCOLADO', 'RECUPERADO')
        AND v."createdAt" < now() - interval '7 days'
        AND v."createdAt" >= (SELECT MIN(x."createdAt") FROM "CarritoVisto" x WHERE x."cuentaId" = c.id AND x.grupo = 'CONTROL')
      GROUP BY 1 ORDER BY 1`,
    slug,
  );
  if (!filas.length) {
    console.log('Todavía no hay carritos de control con más de 7 días. Volvé en unas semanas.');
    return;
  }
  console.log(`\n${slug} — desde el primer carrito de control (${filas[0].desde?.toISOString().slice(0, 10)}), sin la última semana\n`);
  for (const f of filas) {
    const pct = f.n ? ((100 * f.compraron) / f.n).toFixed(1) : '—';
    console.log(`   ${f.grupo.padEnd(10)} ${String(f.n).padStart(5)} carritos · ${String(f.compraron).padStart(4)} compraron · ${pct}%`);
  }
  const control = filas.find((f) => f.grupo === 'CONTROL');
  if (!control || control.n < 60) console.log(`\n⚠️ El control tiene ${control?.n ?? 0} carritos: con menos de ~60 la diferencia no dice nada todavía.`);
  console.log();
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
