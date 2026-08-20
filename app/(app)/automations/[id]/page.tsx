import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutomationEditor } from "@/components/AutomationEditor";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { leerContenido } from "@/lib/email/esquema";
import { marcaDe } from "@/lib/marca";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = {
  NUEVO_CLIENTE: "Nuevo cliente se registra",
  COMPRA: "Se paga un pedido",
  CARRITO_ABANDONADO: "Carrito abandonado",
  NUEVO_SUSCRIPTOR: "Alguien se anota a la lista",
};

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cuenta, email } = await getAuth();
  const a = await prisma.automation.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!a) notFound();

  return (
    <div className="space-y-6">
      <Link href="/automations" className="text-sm text-accent transition-colors hover:text-accent-hover">← Automations</Link>
      <PageHeader eyebrow="Automation" title={a.nombre} />
      <AutomationEditor
        id={a.id}
        marca={marcaDe(cuenta, process.env.APP_URL ?? "")}
        triggerLabel={TRIGGER_LABEL[a.trigger] ?? a.trigger}
        estadoInicial={a.estado}
        emailPrueba={email}
        initial={{
          nombre: a.nombre,
          asunto: a.asunto ?? "",
          preheader: a.preheader ?? "",
          esperaHoras: a.esperaHoras,
          capDias: a.capDias,
          contenido: leerContenido(a.contenido),
        }}
        version={a.docVersion}
      />
    </div>
  );
}
