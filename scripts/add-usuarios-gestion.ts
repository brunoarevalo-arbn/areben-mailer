// Columnas para poder administrar el equipo desde el panel.
//
// `activo` en vez de borrar: desactivar CORTA LA SESIÓN VIVA (getAuth lo
// chequea en cada request), que es lo que querés cuando echás a alguien un
// viernes. Borrar la fila también funcionaría, pero es irreversible y no deja
// rastro de que esa persona existió.
//
// ⛔ Por SQL crudo: la base la comparte areben-popups y `prisma db push` quiere
//    dropear sus tablas.
//
// Correr:  node --import tsx --env-file=.env scripts/add-usuarios-gestion.ts
//
// Idempotente.
import { prisma } from '../lib/prisma.ts';

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "ultimoLoginAt" TIMESTAMP(3)`,
  );

  // El login busca case-insensitive; sin este índice es un seq scan sobre la
  // tabla entera cada vez que alguien entra.
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Usuario_email_lower_idx" ON "Usuario" (lower(email))`,
  );

  // ⚠️ NO se agrega un unique global sobre email a propósito: rompería el
  // callback OAuth de Tiendanube (app/api/tn/callback/route.ts), donde un
  // comerciante que instale la app con un mail ya existente en otra cuenta haría
  // fallar el create con un 500 en plena instalación. El caso se maneja como
  // validación en crearUsuario, que puede explicar el problema.

  const cols = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string }[]>(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_name = 'Usuario' AND column_name IN ('activo','ultimoLoginAt')
     ORDER BY column_name`,
  );
  console.log('── Usuario ──');
  for (const c of cols) console.log(`   ${c.column_name.padEnd(16)} nullable: ${c.is_nullable}`);

  const usuarios = await prisma.$queryRawUnsafe<{ email: string; activo: boolean }[]>(
    `SELECT email, activo FROM "Usuario" ORDER BY email`,
  );
  console.log('\n── Usuarios existentes ──');
  for (const u of usuarios) console.log(`   ${u.email.padEnd(36)} activo: ${u.activo}`);

  console.log('\n✅ Listo. Falta `npx prisma generate` con el schema actualizado.');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
