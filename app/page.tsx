import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cuenta = await getCuentaActiva();

  const [contactos, activos, listas, campanias] = await Promise.all([
    prisma.contacto.count({ where: { cuentaId: cuenta.id } }),
    prisma.contacto.count({ where: { cuentaId: cuenta.id, estado: "ACTIVO" } }),
    prisma.lista.count({ where: { cuentaId: cuenta.id } }),
    prisma.campania.count({ where: { cuentaId: cuenta.id } }),
  ]);

  const stats = [
    { label: "Contactos", value: contactos, hint: `${activos} activos` },
    { label: "Listas", value: listas },
    { label: "Campañas", value: campanias },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inicio"
        title={cuenta.nombre}
        subtitle="Resumen de tu cuenta de email marketing."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="text-sm text-neutral-500">{s.label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">
              {s.value.toLocaleString("es-AR")}
            </div>
            {s.hint && <div className="mt-1 text-xs text-neutral-400">{s.hint}</div>}
          </Card>
        ))}
      </div>

      <Card>
        <div className="text-sm text-neutral-500">Próximo paso</div>
        <p className="mt-1 text-neutral-700">
          Conectá Tiendanube para importar tus contactos, o creá una lista manual para
          empezar. El envío se activa cuando el dominio esté autenticado en SES.
        </p>
      </Card>
    </div>
  );
}
