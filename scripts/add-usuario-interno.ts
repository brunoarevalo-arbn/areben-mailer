// Agrega la columna Usuario.interno por SQL crudo y marca como internos a los
// usuarios de Areben (los únicos que pueden cambiar de marca).
//
// OJO: NO usar `prisma db push` en esta base — la comparte con areben-popups y
// push dropearía sus tablas. Cambios de schema por SQL crudo.
// Correr:  node --env-file=.env scripts/add-usuario-interno.ts
import { prisma } from '../lib/prisma.ts';

async function main() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "interno" BOOLEAN NOT NULL DEFAULT false;',
  );
  console.log('✓ Columna "interno" asegurada en "Usuario"');

  // Los usuarios @arebensrl.com son del equipo: ven el selector de marcas y
  // pueden operar cualquier cuenta. Los comerciantes quedan en false.
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "Usuario" SET "interno" = true WHERE email ILIKE '%@arebensrl.com';`,
  );
  console.log(`✓ ${n} usuario(s) de Areben marcados como internos`);

  const filas = await prisma.$queryRawUnsafe<{ email: string; interno: boolean }[]>(
    'SELECT email, interno FROM "Usuario" ORDER BY email;',
  );
  console.table(filas);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
