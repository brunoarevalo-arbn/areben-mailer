import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CampaniaEditor } from "@/components/CampaniaEditor";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import type { ContenidoCampania } from "@/lib/email/render";

export const dynamic = "force-dynamic";

export default async function CampaniaEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cuenta = await getCuentaActiva();

  const [campania, listas] = await Promise.all([
    prisma.campania.findFirst({ where: { id, cuentaId: cuenta.id } }),
    prisma.lista.findMany({
      where: { cuentaId: cuenta.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { contactos: true } } },
    }),
  ]);

  if (!campania) notFound();

  return (
    <div className="space-y-6">
      <Link href="/campanias" className="text-sm text-amber-600 hover:text-amber-700">
        ← Campañas
      </Link>
      <PageHeader eyebrow="Campaña" title={campania.nombre} />
      <CampaniaEditor
        id={campania.id}
        nombreCuenta={cuenta.nombre}
        initial={{
          nombre: campania.nombre,
          asunto: campania.asunto ?? "",
          preheader: campania.preheader ?? "",
          listaId: campania.listaId,
          contenido: (campania.contenido as unknown as ContenidoCampania) ?? { bloques: [] },
        }}
        listas={listas}
        emailPrueba="brunoarevalo@arebensrl.com"
      />
    </div>
  );
}
