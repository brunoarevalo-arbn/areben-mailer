// Agrega la columna Usuario.passwordHash por SQL crudo.
// OJO: NO usar `prisma db push` en esta base — la comparte con areben-popups
// y push dropearía PopupCampania/PopupEvento. Cambios de schema por SQL crudo.
// Correr:  node --env-file=.env scripts/add-password-column.ts
import { prisma } from '../lib/prisma.ts';

async function main() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;'
  );
  console.log('✓ Columna "passwordHash" asegurada en "Usuario"');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
