import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutomationEditor } from "@/components/AutomationEditor";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import type { ContenidoCampania } from "@/lib/email/render";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = {
  NUEVO_CLIENTE: "Nuevo cliente se registra",
  COMPRA: "Se paga un pedido",
  CARRITO_ABANDONADO: "Carrito abandonado",
};

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cuenta = await getCuentaActiva();
  const a = await prisma.automation.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!a) notFound();

  return (
    <div className="space-y-6">
      <Link href="/automations" className="text-sm text-amber-600 hover:text-amber-700">← Automations</Link>
      <PageHeader eyebrow="Automation" title={a.nombre} />
      <AutomationEditor
        id={a.id}
        nombreCuenta={cuenta.nombre}
        triggerLabel={TRIGGER_LABEL[a.trigger] ?? a.trigger}
        estadoInicial={a.estado}
        initial={{
          nombre: a.nombre,
          asunto: a.asunto ?? "",
          preheader: a.preheader ?? "",
          esperaHoras: a.esperaHoras,
          capDias: a.capDias,
          contenido: (a.contenido as unknown as ContenidoCampania) ?? { bloques: [] },
        }}
      />
    </div>
  );
}
