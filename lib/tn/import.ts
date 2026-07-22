import { prisma } from '../prisma';
import { tnPaginate } from './client';

interface TnCustomer {
  id: number;
  name?: string | null;
  email?: string | null;
  total_spent?: string | null;
  accepts_marketing?: boolean | null;
  last_order_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ImportResult {
  leidos: number;
  importados: number;
  sinEmail: number;
  aceptanMkt: number;
}

/** Importa/actualiza los clientes de una tienda TN como Contactos. */
export async function importCustomers(
  cuentaId: string,
  storeId: string,
  token: string,
  onProgress?: (r: ImportResult) => void,
): Promise<ImportResult> {
  const result: ImportResult = { leidos: 0, importados: 0, sinEmail: 0, aceptanMkt: 0 };

  // Lista de sistema "Todos los contactos"
  const listaTodos = await ensureListaTodos(cuentaId);

  for await (const page of tnPaginate<TnCustomer>(storeId, token, 'customers')) {
    for (const c of page) {
      result.leidos += 1;
      const email = c.email?.trim().toLowerCase();
      if (!email) {
        result.sinEmail += 1;
        continue;
      }
      const aceptaMkt = c.accepts_marketing === true;
      if (aceptaMkt) result.aceptanMkt += 1;

      const contacto = await prisma.contacto.upsert({
        where: { cuentaId_email: { cuentaId, email } },
        update: {
          nombre: c.name ?? undefined,
          tnCustomerId: c.id.toString(),
          tnTotalGastado: c.total_spent ? Number(c.total_spent) : undefined,
          tnAcceptsMkt: aceptaMkt,
          source: 'tiendanube',
        },
        create: {
          cuentaId,
          email,
          nombre: c.name ?? null,
          tnCustomerId: c.id.toString(),
          tnTotalGastado: c.total_spent ? Number(c.total_spent) : null,
          tnAcceptsMkt: aceptaMkt,
          source: 'tiendanube',
        },
      });

      await prisma.contactoLista.upsert({
        where: { contactoId_listaId: { contactoId: contacto.id, listaId: listaTodos.id } },
        update: {},
        create: { contactoId: contacto.id, listaId: listaTodos.id },
      });

      result.importados += 1;
    }
    onProgress?.({ ...result });
  }

  return result;
}

async function ensureListaTodos(cuentaId: string) {
  const existing = await prisma.lista.findFirst({
    where: { cuentaId, tipo: 'SISTEMA', nombre: 'Todos los contactos' },
  });
  if (existing) return existing;
  return prisma.lista.create({
    data: { cuentaId, nombre: 'Todos los contactos', tipo: 'SISTEMA' },
  });
}
