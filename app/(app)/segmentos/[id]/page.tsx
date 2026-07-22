import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentoBuilder } from "@/components/SegmentoBuilder";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import type { Reglas } from "@/lib/segmentos";

export const dynamic = "force-dynamic";

export default async function SegmentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cuenta = await getCuentaActiva();
  const seg = await prisma.segmento.findFirst({ where: { id, cuentaId: cuenta.id } });
  if (!seg) notFound();

  return (
    <div className="space-y-6">
      <Link href="/segmentos" className="text-sm text-accent transition-colors hover:text-accent-hover">← Segmentos</Link>
      <PageHeader eyebrow="Segmento" title={seg.nombre} />
      <SegmentoBuilder
        id={seg.id}
        initial={{ nombre: seg.nombre, reglas: (seg.reglas as unknown as Reglas) ?? { op: "AND", condiciones: [] } }}
      />
    </div>
  );
}
