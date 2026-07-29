import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { RemitentesManager } from "@/components/RemitentesManager";
import { TemaMarca } from "@/components/TemaMarca";
import { temaDe } from "@/lib/email/tema";

export const dynamic = "force-dynamic";

export default async function RemitentesPage() {
  const cuenta = await getCuentaActiva();
  const remitentes = await prisma.remitente.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: [{ esPrincipal: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      nombre: true,
      email: true,
      dominio: true,
      responderA: true,
      estado: true,
      esPrincipal: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Remitentes"
        subtitle={`Desde qué dirección envía ${cuenta.nombre}. El dominio debe estar verificado en SES.`}
      />
      <RemitentesManager marca={cuenta.nombre} remitentes={remitentes} />
      <TemaMarca inicial={temaDe(cuenta.config)} nombreCuenta={cuenta.nombre} />
    </div>
  );
}
