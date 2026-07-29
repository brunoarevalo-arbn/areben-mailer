// Trae de Tiendanube la marca (logo, sitio, idioma, domicilio) de TODAS las
// cuentas conectadas y la guarda en `Cuenta.config`.
//
//   node --env-file=.env --import tsx scripts/traer-marcas.ts            # muestra qué haría
//   node --env-file=.env --import tsx scripts/traer-marcas.ts --aplicar  # lo escribe
//
// El camino normal es el botón "Traer de mi tienda" de /remitentes, y el
// callback del OAuth ya lo hace solo al instalar. Esto es para el arranque: las
// cuentas que se conectaron ANTES de que existiera todo esto tienen el config
// vacío y nadie va a entrar a apretar el botón en cada una.
//
// ⚠️ Escribe en la base de producción (el `.env` local apunta ahí). Por eso el
// default es el dry-run. El merge no pisa `tema` ni `lastSyncContactos`.
import { prisma } from "../lib/prisma";
import { leerStore } from "../lib/tn/client";
import { configConTienda } from "../lib/marca";
import type { Prisma } from "@prisma/client";

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const cuentas = await prisma.cuenta.findMany({
    where: { tnStoreId: { not: null }, tnToken: { not: null } },
    select: { id: true, slug: true, nombre: true, tnStoreId: true, tnToken: true, config: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${cuentas.length} cuenta(s) conectada(s)${aplicar ? "" : " · DRY-RUN, no escribe nada"}\n`);

  for (const c of cuentas) {
    const tienda = await leerStore(c.tnStoreId!, c.tnToken!);
    if (!tienda) {
      console.log(`✗ ${c.slug}: Tiendanube no contestó (¿token vencido?)`);
      continue;
    }
    console.log(`· ${c.slug} (${c.nombre})`);
    console.log(`    logo:      ${tienda.logo || "— sin logo cargado en TN"}`);
    console.log(`    sitio:     ${tienda.url || "—"}`);
    console.log(`    idioma:    ${tienda.idioma || "—"}`);
    console.log(`    pie:       ${tienda.direccion || "—"}`);

    if (!aplicar) continue;
    const config = configConTienda(c.config, tienda, new Date().toISOString());
    await prisma.cuenta.update({ where: { id: c.id }, data: { config: config as Prisma.JsonObject } });
    console.log("    ✓ guardado");
  }

  if (!aplicar) console.log("\nPara guardarlo: agregá --aplicar");
  await prisma.$disconnect();
}

main();
