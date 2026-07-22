import Link from "next/link";
import { Hand, ShoppingBag, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { crearAutomation } from "./actions";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = {
  NUEVO_CLIENTE: "Nuevo cliente",
  COMPRA: "Compra pagada",
  CARRITO_ABANDONADO: "Carrito abandonado",
};

export default async function AutomationsPage() {
  const cuenta = await getCuentaActiva();
  const automations = await prisma.automation.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { runs: true } },
      runs: { where: { estado: "ENVIADO" }, select: { id: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automatización"
        title="Automations"
        subtitle="Emails que se envían solos cuando pasa algo en tu tienda."
      />

      {/* Presets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Hand className="h-5 w-5 text-accent" aria-hidden />
            Bienvenida
          </div>
          <p className="mt-1 text-sm text-muted">Se envía cuando un cliente nuevo se registra en tu tienda.</p>
          <form action={crearAutomation.bind(null, "NUEVO_CLIENTE")} className="mt-3">
            <button className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover">Crear</button>
          </form>
        </Card>
        <Card>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <ShoppingBag className="h-5 w-5 text-accent" aria-hidden />
            Post-compra
          </div>
          <p className="mt-1 text-sm text-muted">Se envía cuando se paga un pedido (agradecimiento).</p>
          <form action={crearAutomation.bind(null, "COMPRA")} className="mt-3">
            <button className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover">Crear</button>
          </form>
        </Card>
        <Card>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <ShoppingCart className="h-5 w-5 text-accent" aria-hidden />
            Carrito abandonado
          </div>
          <p className="mt-1 text-sm text-muted">Recupera ventas: incluye el link al carrito y los productos que dejó.</p>
          <form action={crearAutomation.bind(null, "CARRITO_ABANDONADO")} className="mt-3">
            <button className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover">Crear</button>
          </form>
        </Card>
      </div>

      {/* Activas / creadas */}
      {automations.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted">Tus automations</div>
          {automations.map((a) => (
            <Link key={a.id} href={`/automations/${a.id}`} className="block">
              <Card padding="compact" className="hover:border-accent transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{a.nombre}</div>
                    <div className="text-sm text-muted">{TRIGGER_LABEL[a.trigger]} · espera {a.esperaHoras}h</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-subtle tabular-nums">{a.runs.length} enviados</span>
                    <Badge variant={a.estado === "ACTIVO" ? "success" : "default"}>{a.estado}</Badge>
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
