import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";

export const dynamic = "force-dynamic";

const tipoBadge: Record<string, "blue" | "amber" | "default"> = {
  TN_SYNC: "blue",
  SISTEMA: "amber",
  MANUAL: "default",
};

export default async function ListasPage() {
  const cuenta = await getCuentaActiva();

  const listas = await prisma.lista.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { contactos: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audiencia"
        title="Listas"
        subtitle={`${listas.length} listas`}
      />

      {listas.length === 0 ? (
        <EmptyState title="Sin listas" message="Todavía no hay listas creadas." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listas.map((l) => (
            <Card key={l.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-neutral-800">{l.nombre}</div>
                <Badge variant={tipoBadge[l.tipo] ?? "default"}>{l.tipo}</Badge>
              </div>
              {l.descripcion && (
                <div className="mt-1 text-sm text-neutral-500">{l.descripcion}</div>
              )}
              <div className="mt-3 text-2xl font-semibold tabular-nums">
                {l._count.contactos.toLocaleString("es-AR")}
                <span className="ml-1 text-sm font-normal text-neutral-400">contactos</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
