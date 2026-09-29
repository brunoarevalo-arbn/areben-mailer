// DDL del 29-sep-2026, la secuencia de carrito de 4 mails:
//
//   - `Automation.remitenteNombre` / `Automation.responderA`: el mail en texto
//     plano lo firma el dueño y sus respuestas le llegan a él.
//   - `CarritoVisto.grupo`: el grupo de control, que no recibe mails.
//
// Las tres son TEXT NULL y aditivas. 🔴 Pero van ANTES del deploy: la Prisma
// nueva las nombra al leer `Automation`, y sin la columna `/automations` y el
// procesador revientan en producción.
//
//   node --env-file=.env --import tsx scripts/add-remitente-automation.ts
import { prisma } from '../lib/prisma.ts';

const COLUMNAS = [
  ['Automation', 'remitenteNombre'],
  ['Automation', 'responderA'],
  ['CarritoVisto', 'grupo'],
] as const;

async function main() {
  for (const [t, c] of COLUMNAS) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "${c}" TEXT`);
  }
  console.log('\n── columnas ──');
  for (const [t, c] of COLUMNAS) {
    const [col] = await prisma.$queryRawUnsafe<{ tipo: string; nulo: string }[]>(
      `SELECT data_type AS tipo, is_nullable AS nulo FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2`,
      t, c,
    );
    if (!col) throw new Error(`${t}.${c}: la columna no quedó`);
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM "${t}" WHERE "${c}" IS NOT NULL`,
    );
    console.log(`   ${`${t}.${c}`.padEnd(28)} ${col.tipo} · nulo=${col.nulo} · filas con valor: ${Number(n)}`);
  }
  console.log('\n✅ Listo. Sigue: el deploy de los dos repos.\n');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
