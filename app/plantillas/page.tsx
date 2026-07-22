import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { usarPlantilla, eliminarPlantilla } from "./actions";
import type { ContenidoCampania } from "@/lib/email/render";

export const dynamic = "force-dynamic";

export default async function PlantillasPage() {
  const cuenta = await getCuentaActiva();
  const plantillas = await prisma.plantilla.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contenido"
        title="Plantillas"
        subtitle={`${plantillas.length} plantillas · guardá diseños desde el editor de campañas`}
      />

      {plantillas.length === 0 ? (
        <EmptyState
          title="Sin plantillas"
          message='Abrí una campaña, armá el diseño y tocá "Guardar como plantilla" para reusarlo.'
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plantillas.map((p) => {
            const nBloques = ((p.contenido as unknown as ContenidoCampania)?.bloques ?? []).length;
            return (
              <Card key={p.id}>
                <div className="font-medium text-neutral-800">{p.nombre}</div>
                <div className="mt-1 text-sm text-neutral-400">{nBloques} bloques</div>
                <div className="mt-3 flex items-center gap-2">
                  <form action={usarPlantilla.bind(null, p.id)}>
                    <button className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600">
                      Usar
                    </button>
                  </form>
                  <form action={eliminarPlantilla.bind(null, p.id)}>
                    <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50">
                      Eliminar
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
