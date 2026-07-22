// Crea la tabla "Formulario" por SQL crudo (matchea el modelo Prisma).
// ⛔ NO usar `prisma db push` en esta base: la comparte areben-popups y push
// dropearía sus tablas. Cambios de schema del mailer van por SQL crudo.
// Correr:  node --env-file=.env scripts/create-formulario-table.ts
import { prisma } from '../lib/prisma.ts';

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Formulario" (
      "id"           TEXT NOT NULL,
      "cuentaId"     TEXT NOT NULL,
      "nombre"       TEXT NOT NULL,
      "slug"         TEXT NOT NULL,
      "titulo"       TEXT NOT NULL DEFAULT 'Suscribite a nuestro newsletter',
      "descripcion"  TEXT,
      "botonTexto"   TEXT NOT NULL DEFAULT 'Suscribirme',
      "exitoMensaje" TEXT NOT NULL DEFAULT '¡Listo! Gracias por suscribirte.',
      "pedirNombre"  BOOLEAN NOT NULL DEFAULT true,
      "listaId"      TEXT,
      "activo"       BOOLEAN NOT NULL DEFAULT true,
      "submits"      INTEGER NOT NULL DEFAULT 0,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Formulario_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Formulario_cuentaId_fkey" FOREIGN KEY ("cuentaId")
        REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Formulario_listaId_fkey" FOREIGN KEY ("listaId")
        REFERENCES "Lista"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Formulario_cuentaId_slug_key" ON "Formulario"("cuentaId", "slug");'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Formulario_cuentaId_idx" ON "Formulario"("cuentaId");'
  );

  console.log('✓ Tabla "Formulario" creada/asegurada (sin tocar tablas de popups)');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
