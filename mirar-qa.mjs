import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

const l = await p.lista.findUnique({
  where: { id: 'cms2aubx9000020ysljafegwg' },
  select: {
    nombre: true,
    tipo: true,
    cuenta: { select: { slug: true } },
    contactos: { select: { contacto: { select: { email: true, estado: true, tnAcceptsMkt: true } } } },
  },
})
console.log(`LISTA "${l.nombre}" (${l.tipo}) de ${l.cuenta.slug}:`)
for (const { contacto: c } of l.contactos) {
  console.log(`  ${c.email.padEnd(34)} ${c.estado} mkt=${c.tnAcceptsMkt}`)
}

const r = await p.remitente.findMany({
  where: { cuenta: { slug: 'bdi' } },
  select: { email: true, estado: true },
})
console.log('\nREMITENTE de bdi:', JSON.stringify(r))

await p.$disconnect()
