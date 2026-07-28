// Escotilla de emergencia para crear un usuario sin pasar por el panel.
//
// El camino normal es /usuarios. Esto existe para el día en que la UI no esté
// disponible o —el caso real— alguien se autobloquee y no quede ningún ADMIN
// activo en una marca.
//
// Correr:
//   node --import tsx --env-file=.env scripts/crear-usuario.ts \
//     <email> "<nombre>" <ADMIN|EDITOR|VIEWER> <slug-de-la-marca> [--interno]
//
// Si el usuario ya existe, no lo duplica: le regenera la contraseña.
import { prisma } from '../lib/prisma.ts';
import { hashPassword } from '../lib/password.ts';
import { randomBytes } from 'node:crypto';

const ROLES = ['ADMIN', 'EDITOR', 'VIEWER'] as const;

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--interno');
  const interno = process.argv.includes('--interno');
  const [emailRaw, nombre, rol, slug] = args;

  if (!emailRaw || !rol || !slug) {
    console.error('Uso: scripts/crear-usuario.ts <email> "<nombre>" <ADMIN|EDITOR|VIEWER> <slug> [--interno]');
    process.exit(1);
  }
  if (!ROLES.includes(rol as (typeof ROLES)[number])) {
    console.error(`Rol inválido: ${rol}. Usá uno de ${ROLES.join(', ')}.`);
    process.exit(1);
  }

  const email = emailRaw.trim().toLowerCase();
  const cuenta = await prisma.cuenta.findUnique({ where: { slug } });
  if (!cuenta) throw new Error(`No existe la marca "${slug}"`);

  // El mismo mail en dos marcas rompe el login (no puede decidir a cuál entrar).
  const enOtra = await prisma.usuario.findFirst({
    where: { email, cuentaId: { not: cuenta.id } },
    include: { cuenta: { select: { slug: true } } },
  });
  if (enOtra) {
    console.error(`❌ ${email} ya existe en la marca "${enOtra.cuenta.slug}".`);
    console.error('   Si es la misma persona, marcala como interna allá en vez de duplicarla.');
    process.exit(1);
  }

  const password = randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(password);

  const existente = await prisma.usuario.findFirst({ where: { cuentaId: cuenta.id, email } });
  if (existente) {
    await prisma.usuario.update({
      where: { id: existente.id },
      data: { passwordHash, rol: rol as never, interno, activo: true },
    });
    console.log(`✓ ${email} ya existía en ${cuenta.nombre}: actualizado y reactivado.`);
  } else {
    await prisma.usuario.create({
      data: {
        cuentaId: cuenta.id,
        email,
        nombre: nombre?.trim() || null,
        rol: rol as never,
        interno,
        passwordHash,
      },
    });
    console.log(`✓ ${email} creado en ${cuenta.nombre}.`);
  }

  console.log(`\n   rol:      ${rol}`);
  console.log(`   marcas:   ${interno ? 'todas (interno)' : cuenta.nombre}`);
  console.log(`   password: ${password}`);
  console.log('\n⚠️ Anotala: no se vuelve a mostrar. Pedile que la cambie desde /usuarios.');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
