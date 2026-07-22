import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CampaniaEditor } from "@/components/CampaniaEditor";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import type { ContenidoCampania } from "@/lib/email/render";

export const dynamic = "force-dynamic";

export default async function CampaniaEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cuenta = await getCuentaActiva();

  const [campania, listas] = await Promise.all([
    prisma.campania.findFirst({ where: { id, cuentaId: cuenta.id } }),
    prisma.lista.findMany({
      where: { cuentaId: cuenta.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { contactos: true } } },
    }),
  ]);

  if (!campania) notFound();

  const [enviados, aperturas, clicks, rebotes, bajas] = await Promise.all([
    prisma.envio.count({ where: { campaniaId: id, estado: { in: ["ENVIADO", "ABIERTO", "CLICK", "BAJA"] } } }),
    prisma.envio.count({ where: { campaniaId: id, abiertoAt: { not: null } } }),
    prisma.envio.count({ where: { campaniaId: id, clickAt: { not: null } } }),
    prisma.envio.count({ where: { campaniaId: id, estado: "REBOTE" } }),
    prisma.envio.count({ where: { campaniaId: id, estado: "BAJA" } }),
  ]);
  const pct = (n: number) => (enviados ? `${Math.round((n / enviados) * 100)}%` : "0%");
  const stats = enviados > 0
    ? [
        { label: "Enviados", value: enviados.toLocaleString("es-AR") },
        { label: "Aperturas", value: `${aperturas} · ${pct(aperturas)}` },
        { label: "Clicks", value: `${clicks} · ${pct(clicks)}` },
        { label: "Rebotes", value: `${rebotes}` },
        { label: "Bajas", value: `${bajas}` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Link href="/campanias" className="text-sm text-amber-600 hover:text-amber-700">
        ← Campañas
      </Link>
      <PageHeader eyebrow="Campaña" title={campania.nombre} />
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="text-xs text-neutral-500">{s.label}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>
      )}
      <CampaniaEditor
        id={campania.id}
        nombreCuenta={cuenta.nombre}
        initial={{
          nombre: campania.nombre,
          asunto: campania.asunto ?? "",
          preheader: campania.preheader ?? "",
          listaId: campania.listaId,
          contenido: (campania.contenido as unknown as ContenidoCampania) ?? { bloques: [] },
        }}
        listas={listas}
        emailPrueba="brunoarevalo@arebensrl.com"
        estado={campania.estado}
      />
    </div>
  );
}
