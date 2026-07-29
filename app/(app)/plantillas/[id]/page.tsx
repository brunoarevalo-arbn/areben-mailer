import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlantillaEditor } from "@/components/PlantillaEditor";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { leerContenido } from "@/lib/email/esquema";
import { marcaDe } from "@/lib/marca";

export const dynamic = "force-dynamic";

export default async function PlantillaEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cuenta = await getCuentaActiva();
  const plantilla = await prisma.plantilla.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!plantilla) notFound();

  return (
    <div className="space-y-6">
      <Link href="/plantillas" className="text-sm text-accent transition-colors hover:text-accent-hover">
        ← Plantillas
      </Link>
      <PageHeader eyebrow="Plantilla" title={plantilla.nombre} />
      <PlantillaEditor
        id={plantilla.id}
        marca={marcaDe(cuenta)}
        initial={{ nombre: plantilla.nombre, contenido: leerContenido(plantilla.contenido) }}
      />
    </div>
  );
}
