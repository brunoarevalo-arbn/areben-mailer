// Crea/actualiza el remitente principal de una marca (idempotente, upsert por email).
// El estado se toma en vivo de SES (verifica el dominio de la identidad).
// Correr:  node --env-file=.env scripts/set-remitente.ts <slug> <email> "<nombre>" [responderA]
//   ej:    node --env-file=.env scripts/set-remitente.ts zattia info@zattia.com.ar "Zattia"
import { prisma } from '../lib/prisma.ts';
import { getIdentityStatus } from '../lib/ses/client.ts';

async function main() {
  const [slug, email, nombre, responderA] = process.argv.slice(2);
  if (!slug || !email || !nombre) {
    console.error('Uso: set-remitente.ts <slug> <email> "<nombre>" [responderA]');
    process.exit(1);
  }
  const cuenta = await prisma.cuenta.findUnique({ where: { slug } });
  if (!cuenta) throw new Error(`No existe la marca con slug "${slug}"`);

  const dominio = email.split('@')[1];
  const statusSes = await getIdentityStatus(dominio); // el dominio es lo que verifica SES (Easy DKIM)
  const estado = statusSes === 'AUTENTICADO' ? 'AUTENTICADO' : statusSes === 'RECHAZADO' ? 'RECHAZADO' : 'PENDIENTE';

  const rem = await prisma.remitente.upsert({
    where: { cuentaId_email: { cuentaId: cuenta.id, email } },
    create: { cuentaId: cuenta.id, nombre, email, responderA: responderA || null, dominio, estado, esPrincipal: true },
    update: { nombre, responderA: responderA || null, dominio, estado, esPrincipal: true },
  });
  // Garantizar un solo principal por marca.
  await prisma.remitente.updateMany({
    where: { cuentaId: cuenta.id, id: { not: rem.id } },
    data: { esPrincipal: false },
  });
  console.log(`Remitente ${email} (${nombre}) en ${slug} → estado ${estado}, principal.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
