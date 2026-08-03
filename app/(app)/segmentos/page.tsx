import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { reglasToWhere, type Reglas } from "@/lib/segmentos";
import { MANDABLE } from "@/lib/campanias";
import { crearSegmento } from "./actions";

export const dynamic = "force-dynamic";

export default async function SegmentosPage() {
  const cuenta = await getCuentaActiva();
  const segmentos = await prisma.segmento.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: { createdAt: "asc" },
  });

  const conCount = await Promise.all(
    segmentos.map(async (s) => ({
      ...s,
      // MANDABLE, no `estado: "ACTIVO"` a secas: el número de la lista tiene que
      // ser el mismo que va a mandar `contactosElegibles`. Ver `contarSegmento`.
      count: await prisma.contacto.count({
        where: { cuentaId: cuenta.id, ...MANDABLE, ...reglasToWhere(s.reglas as unknown as Reglas) },
      }),
    })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audiencia"
        title="Segmentos"
        subtitle={`${segmentos.length} segmentos`}
        actions={
          <form action={crearSegmento}>
            <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
              + Crear segmento
            </button>
          </form>
        }
      />

      {conCount.length === 0 ? (
        <EmptyState
          title="Sin segmentos"
          message="Creá segmentos dinámicos por reglas (gastó, recencia, comprador…) y usalos como destino de campaña."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {conCount.map((s) => (
            <Link key={s.id} href={`/segmentos/${s.id}`} className="block">
              <Card className="hover:border-accent transition-colors">
                <div className="font-medium text-foreground">{s.nombre}</div>
                <div className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
                  {s.count.toLocaleString("es-AR")}
                  <span className="ml-1 text-sm font-normal text-subtle">contactos</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
