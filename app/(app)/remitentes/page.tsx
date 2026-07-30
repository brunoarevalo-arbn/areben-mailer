import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { RemitentesManager } from "@/components/RemitentesManager";
import { TemaMarca } from "@/components/TemaMarca";
import { temaDe } from "@/lib/email/tema";
import { leerConfigCuenta, marcaDe } from "@/lib/marca";

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

  // 🔴 La dirección va aparte de `marcaDe`: ahí ya viene filtrada por el toggle,
  // así que "oculta" y "no hay dato" llegarían iguales y el checkbox no sabría
  // qué mostrar. El componente necesita el dato crudo Y la decisión.
  const config = leerConfigCuenta(cuenta.config);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Remitentes"
        subtitle={`Desde qué dirección envía ${cuenta.nombre}. El dominio debe estar verificado en SES.`}
      />
      <RemitentesManager marca={cuenta.nombre} remitentes={remitentes} />
      <TemaMarca
        inicial={temaDe(cuenta.config)}
        marca={marcaDe(cuenta)}
        conectada={!!cuenta.tnStoreId}
        direccion={config.direccion}
        direccionOculta={!!config.direccionOculta}
      />
    </div>
  );
}
