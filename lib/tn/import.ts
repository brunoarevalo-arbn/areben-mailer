import { prisma } from '../prisma';
import { tnPaginate } from './client';
import { Prisma } from '@prisma/client';

interface TnCustomer {
  id: number;
  name?: string | null;
  email?: string | null;
  total_spent?: string | null;
  accepts_marketing?: boolean | null;
}

export interface ImportResult {
  leidos: number;
  importados: number;
  sinEmail: number;
  duplicados: number;
  aceptanMkt: number;
}

const CHUNK = 1000;

/** Importa/actualiza los clientes de una tienda TN como Contactos (bulk). */
export async function importCustomers(
  cuentaId: string,
  storeId: string,
  token: string,
  onProgress?: (leidos: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { leidos: 0, importados: 0, sinEmail: 0, duplicados: 0, aceptanMkt: 0 };

  // 1) Traer todos los clientes de TN a memoria (deduplicados por email).
  const porEmail = new Map<string, TnCustomer>();
  for await (const page of tnPaginate<TnCustomer>(storeId, token, 'customers')) {
    for (const c of page) {
      result.leidos += 1;
      const email = c.email?.trim().toLowerCase();
      if (!email) {
        result.sinEmail += 1;
        continue;
      }
      if (porEmail.has(email)) result.duplicados += 1;
      porEmail.set(email, c);
    }
    onProgress?.(result.leidos);
  }

  const rows = [...porEmail.entries()].map(([email, c]) => {
    if (c.accepts_marketing === true) result.aceptanMkt += 1;
    return {
      cuentaId,
      email,
      nombre: c.name ?? null,
      tnCustomerId: c.id.toString(),
      tnTotalGastado: c.total_spent ? new Prisma.Decimal(c.total_spent) : null,
      tnAcceptsMkt: c.accepts_marketing === true,
      source: 'tiendanube',
    };
  });

  // 2) Insertar contactos por lotes (ignora los que ya existen).
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await prisma.contacto.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    result.importados += res.count;
  }

  // 3) Asignar todos a la lista de sistema "Todos los contactos" (bulk).
  const listaTodos = await ensureListaTodos(cuentaId);
  const contactos = await prisma.contacto.findMany({
    where: { cuentaId },
    select: { id: true },
  });
  for (let i = 0; i < contactos.length; i += CHUNK) {
    await prisma.contactoLista.createMany({
      data: contactos.slice(i, i + CHUNK).map((c) => ({ contactoId: c.id, listaId: listaTodos.id })),
      skipDuplicates: true,
    });
  }

  return result;
}

interface TnOrder {
  id: number;
  customer?: { id?: number } | null;
  created_at?: string | null;
}

export interface OrdersResult {
  pedidos: number;
  clientesActualizados: number;
}

/** Trae los pedidos de TN y setea tnUltimaCompra (recencia) por contacto. */
export async function importOrders(
  cuentaId: string,
  storeId: string,
  token: string,
  onProgress?: (pedidos: number) => void,
): Promise<OrdersResult> {
  const result: OrdersResult = { pedidos: 0, clientesActualizados: 0 };

  // Fecha máxima de compra por tnCustomerId. Procesamos del más nuevo al más viejo,
  // así el primer pedido visto por cliente ya es su última compra (y el tope de
  // paginación de TN ~10k solo deja afuera pedidos viejos, irrelevantes para recencia).
  const ultima = new Map<string, string>();
  try {
    for await (const page of tnPaginate<TnOrder>(storeId, token, "orders", {
      fields: "id,customer,created_at",
      sort_by: "created-at-descending",
    })) {
      for (const o of page) {
        result.pedidos += 1;
        const cid = o.customer?.id?.toString();
        const fecha = o.created_at;
        if (!cid || !fecha) continue;
        if (!ultima.has(cid)) ultima.set(cid, fecha);
      }
      onProgress?.(result.pedidos);
    }
  } catch {
    // TN corta la paginación profunda (422): seguimos con lo juntado.
  }

  // Update en bloque por chunks (UPDATE ... FROM VALUES)
  const rows = [...ultima.entries()];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk.map(([cid, fecha]) => Prisma.sql`(${cid}, ${fecha}::timestamptz)`);
    const n = await prisma.$executeRaw`
      UPDATE "Contacto" AS c
      SET "tnUltimaCompra" = v.fecha
      FROM (VALUES ${Prisma.join(values)}) AS v(tnid, fecha)
      WHERE c."tnCustomerId" = v.tnid AND c."cuentaId" = ${cuentaId}
    `;
    result.clientesActualizados += Number(n);
  }

  return result;
}

/** Sync incremental: trae solo clientes creados/actualizados desde `since` y hace upsert. */
export async function importCustomersIncremental(
  cuentaId: string,
  storeId: string,
  token: string,
  since?: Date,
): Promise<{ nuevos: number; actualizados: number }> {
  const params: Record<string, string | number> = {};
  if (since) params.updated_at_min = since.toISOString();

  const listaTodos = await ensureListaTodos(cuentaId);
  let nuevos = 0;
  let actualizados = 0;

  for await (const page of tnPaginate<TnCustomer>(storeId, token, "customers", params)) {
    for (const c of page) {
      const email = c.email?.trim().toLowerCase();
      if (!email) continue;
      const existe = await prisma.contacto.findUnique({
        where: { cuentaId_email: { cuentaId, email } },
        select: { id: true },
      });
      const contacto = await prisma.contacto.upsert({
        where: { cuentaId_email: { cuentaId, email } },
        update: {
          nombre: c.name ?? undefined,
          tnCustomerId: c.id.toString(),
          tnTotalGastado: c.total_spent ? Number(c.total_spent) : undefined,
          tnAcceptsMkt: c.accepts_marketing === true,
        },
        create: {
          cuentaId,
          email,
          nombre: c.name ?? null,
          tnCustomerId: c.id.toString(),
          tnTotalGastado: c.total_spent ? Number(c.total_spent) : null,
          tnAcceptsMkt: c.accepts_marketing === true,
          source: "tiendanube",
        },
      });
      if (existe) actualizados++;
      else {
        nuevos++;
        await prisma.contactoLista.create({ data: { contactoId: contacto.id, listaId: listaTodos.id } });
      }
    }
  }
  return { nuevos, actualizados };
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
