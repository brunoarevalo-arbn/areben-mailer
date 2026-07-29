// Crea la tabla "ImagenMail" por SQL crudo (matchea el modelo de schema.prisma).
//
// ⛔ NO usar `prisma db push` en esta base: la comparte areben-popups (Resorty)
// y push dropearía sus tablas. Los cambios de schema del mailer van así.
//
// El nombre lleva el sufijo "Mail" a propósito: en este mismo esquema conviven
// las tablas de Resorty (PopupCampania, Resena, ColorFamilia, ResortyUsuario…),
// y una tabla llamada "Imagen" a secas se leería como de los dos productos.
//
// Correr:  node --env-file=.env scripts/add-imagenes-mail.ts

import { prisma } from '../lib/prisma.ts';

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ImagenMail" (
      "id"        TEXT NOT NULL,
      "cuentaId"  TEXT NOT NULL,
      -- URL pública del blob. Es lo que termina adentro del mail, así que
      -- borrar la fila sin borrar el blob dejaría la imagen viva y al revés
      -- rompería los mails ya enviados. Ver el DELETE de /api/imagenes/[id].
      "url"       TEXT NOT NULL,
      -- Ruta dentro del store: es lo que necesita @vercel/blob para borrarla.
      "pathname"  TEXT NOT NULL,
      "nombre"    TEXT NOT NULL,
      "mime"      TEXT NOT NULL,
      -- El contador de consumo por cuenta arranca el día uno: Blob se paga y el
      -- egress se paga POR DESTINATARIO. Medir después no se puede retrofitear.
      "bytes"     INTEGER NOT NULL,
      -- Medidas reales, informadas por el navegador al subir. Sirven para
      -- avisar "esta imagen mide 2400px" antes de que engorde el mail.
      "ancho"     INTEGER,
      "alto"      INTEGER,
      "subidoPor" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ImagenMail_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "ImagenMail_cuentaId_fkey" FOREIGN KEY ("cuentaId")
        REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "ImagenMail_cuentaId_createdAt_idx" ON "ImagenMail"("cuentaId", "createdAt");'
  );

  const [{ count }] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    'SELECT count(*)::bigint AS count FROM "ImagenMail";'
  );
  console.log(`✓ Tabla "ImagenMail" creada/asegurada (${count} filas). Sin tocar las tablas de Resorty.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
