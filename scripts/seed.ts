// Seed inicial: crea la cuenta BDI, el usuario admin, los campos custom de TN
// y una lista de sistema. Idempotente (upsert por claves únicas).
// Correr:  node scripts/seed.ts   (Node 25 stripea los tipos)
import { prisma } from '../lib/prisma.ts';

async function main() {
  const cuenta = await prisma.cuenta.upsert({
    where: { slug: 'bdi' },
    update: {},
    create: { nombre: 'BDI Accesorios', slug: 'bdi' },
  });

  await prisma.usuario.upsert({
    where: { cuentaId_email: { cuentaId: cuenta.id, email: 'brunoarevalo@arebensrl.com' } },
    update: {},
    create: {
      cuentaId: cuenta.id,
      email: 'brunoarevalo@arebensrl.com',
      nombre: 'Bruno Arevalo',
      rol: 'ADMIN',
    },
  });

  const camposTN = [
    { nombre: 'tn_ultima_compra', tipo: 'FECHA' as const, codigoReemplazo: '${contacto.tn_ultima_compra}' },
    { nombre: 'tn_total_gastado', tipo: 'NUMERO' as const, codigoReemplazo: '${contacto.tn_total_gastado}' },
  ];
  for (const c of camposTN) {
    await prisma.campoCustom.upsert({
      where: { cuentaId_nombre: { cuentaId: cuenta.id, nombre: c.nombre } },
      update: {},
      create: { cuentaId: cuenta.id, ...c },
    });
  }

  // Lista de sistema "Todos los contactos"
  const listaTodos = await prisma.lista.findFirst({
    where: { cuentaId: cuenta.id, tipo: 'SISTEMA', nombre: 'Todos los contactos' },
  });
  if (!listaTodos) {
    await prisma.lista.create({
      data: {
        cuentaId: cuenta.id,
        nombre: 'Todos los contactos',
        descripcion: 'Todos los contactos activos de la cuenta',
        tipo: 'SISTEMA',
      },
    });
  }

  const [nCuentas, nUsuarios, nCampos, nListas] = await Promise.all([
    prisma.cuenta.count(),
    prisma.usuario.count(),
    prisma.campoCustom.count(),
    prisma.lista.count(),
  ]);
  console.log(`✅ Seed OK — cuentas:${nCuentas} usuarios:${nUsuarios} campos:${nCampos} listas:${nListas}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
