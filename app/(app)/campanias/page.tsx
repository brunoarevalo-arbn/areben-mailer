import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { crearCampania } from "./actions";

export const dynamic = "force-dynamic";

const estadoBadge: Record<string, "default" | "amber" | "blue" | "success"> = {
  BORRADOR: "default",
  PROGRAMADA: "amber",
  ENVIANDO: "blue",
  ENVIADA: "success",
  CANCELADA: "default",
};

export default async function CampaniasPage() {
  const cuenta = await getCuentaActiva();
  const campanias = await prisma.campania.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { envios: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Envíos"
        title="Campañas"
        subtitle={`${campanias.length} campañas`}
        actions={
          <form action={crearCampania}>
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              + Crear campaña
            </button>
          </form>
        }
      />

      {campanias.length === 0 ? (
        <EmptyState
          title="Sin campañas"
          message="Creá tu primera campaña para empezar a comunicarte con tus contactos."
        />
      ) : (
        <div className="space-y-2">
          {campanias.map((c) => (
            <Link key={c.id} href={`/campanias/${c.id}`} className="block">
              <Card padding="compact" className="hover:border-accent transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{c.nombre}</div>
                    <div className="text-sm text-muted truncate">
                      {c.asunto || <span className="italic">sin asunto</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c._count.envios > 0 && (
                      <span className="text-sm text-subtle tabular-nums">
                        {c._count.envios.toLocaleString("es-AR")} envíos
                      </span>
                    )}
                    <Badge variant={estadoBadge[c.estado] ?? "default"}>{c.estado}</Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
