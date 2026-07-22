import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { crearFormulario } from "./actions";

export const dynamic = "force-dynamic";

export default async function FormulariosPage() {
  const cuenta = await getCuentaActiva();
  const formularios = await prisma.formulario.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: { createdAt: "desc" },
    include: { lista: { select: { nombre: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audiencia"
        title="Formularios"
        subtitle={`${formularios.length} formularios de captura (suscripción directa, single opt-in)`}
        actions={
          <form action={crearFormulario}>
            <Button type="submit" variant="accent">
              + Crear formulario
            </Button>
          </form>
        }
      />

      {formularios.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Sin formularios"
          message="Creá un formulario para captar suscriptores desde un link o embebido en tu sitio. El contacto queda suscripto al instante (sin email de confirmación)."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {formularios.map((f) => (
            <Link key={f.id} href={`/formularios/${f.id}`}>
              <Card className="h-full transition-colors hover:border-accent">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-foreground">{f.nombre}</div>
                  <Badge variant={f.activo ? "success" : "default"} size="sm">
                    {f.activo ? "Activo" : "Pausado"}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-subtle truncate">/f/{f.slug}</div>
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <span className="font-semibold tabular-nums text-foreground">
                    {f.submits.toLocaleString("es-AR")}
                  </span>
                  <span className="text-muted">suscripciones</span>
                </div>
                <div className="mt-1 text-xs text-subtle">
                  {f.lista ? `→ ${f.lista.nombre}` : "sin lista destino"}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
