import Link from "next/link";
import { Hand, MailPlus, ShoppingBag, ShoppingCart, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { automationDelTrigger, type Trigger } from "@/lib/automations";
import { TRIGGERS_UI } from "./presets-ui";
import { crearAutomation } from "./actions";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = {
  NUEVO_CLIENTE: "Nuevo cliente",
  COMPRA: "Compra pagada",
  CARRITO_ABANDONADO: "Carrito abandonado",
  NUEVO_SUSCRIPTOR: "Nuevo suscriptor",
};

// `Record` completo y no un mapa suelto: un trigger nuevo sin icono no compila.
const ICONO: Record<Trigger, LucideIcon> = {
  NUEVO_CLIENTE: Hand,
  NUEVO_SUSCRIPTOR: MailPlus,
  COMPRA: ShoppingBag,
  CARRITO_ABANDONADO: ShoppingCart,
};

const BOTON =
  "inline-block rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover";

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

      {/* Presets. La tarjeta de un trigger que YA tiene automation no ofrece
          crear otra: el disparador manda todas las que matcheen, así que la
          segunda es un segundo mail a la misma persona. La guarda de verdad está
          en `crearAutomation` —esta página puede estar cacheada—, pero un botón
          que dice "Crear" y no crea nada es peor que uno que dice "Editar". */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TRIGGERS_UI.map(({ trigger, titulo, texto }) => {
          const ya = automationDelTrigger(automations, trigger);
          const Icono = ICONO[trigger];
          return (
            <Card key={trigger}>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Icono className="h-5 w-5 text-accent" aria-hidden />
                {titulo}
              </div>
              <p className="mt-1 text-sm text-muted">{texto}</p>
              {ya ? (
                <div className="mt-3">
                  <Link href={`/automations/${ya.id}`} className={BOTON}>
                    Editar
                  </Link>
                </div>
              ) : (
                <form action={crearAutomation.bind(null, trigger)} className="mt-3">
                  <button className={BOTON}>Crear</button>
                </form>
              )}
            </Card>
          );
        })}
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
