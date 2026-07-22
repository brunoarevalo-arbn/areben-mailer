// Setea la contraseña (login del mailer) de un usuario existente.
// Correr:  node --env-file=.env scripts/set-password.ts <email> <password>
import { prisma } from '../lib/prisma.ts';
import { hashPassword } from '../lib/password.ts';

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: node --env-file=.env scripts/set-password.ts <email> <password>');
    process.exit(1);
  }

  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (!usuario) {
    console.error(`No existe usuario con email ${email}. Corré scripts/seed.ts primero.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { passwordHash } });
  console.log(`✓ Contraseña actualizada para ${usuario.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
