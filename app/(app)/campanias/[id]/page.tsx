import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CampaniaEditor } from "@/components/CampaniaEditor";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import { contactosElegibles } from "@/lib/campanias";
import { leerContenido } from "@/lib/email/esquema";
import { marcaDe } from "@/lib/marca";

export const dynamic = "force-dynamic";

export default async function CampaniaEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // getAuth y no getCuentaActiva: el input de "enviar prueba" tiene que arrancar
  // con el mail de quien está mirando. Con una dirección fija, un editor creía
  // que se mandaba la prueba a él cuando en realidad iba a otra casilla.
  const { cuenta, email } = await getAuth();

  const [campania, listas, segmentos] = await Promise.all([
    prisma.campania.findFirst({ where: { id, cuentaId: cuenta.id } }),
    prisma.lista.findMany({
      where: { cuentaId: cuenta.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { contactos: true } } },
    }),
    prisma.segmento.findMany({
      where: { cuentaId: cuenta.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  if (!campania) notFound();

  const destinoInicial = campania.listaId
    ? `lista:${campania.listaId}`
    : campania.segmentoId
      ? `seg:${campania.segmentoId}`
      : "";

  const [enviados, aperturas, clicks, rebotes, bajas] = await Promise.all([
    prisma.envio.count({ where: { campaniaId: id, estado: { in: ["ENVIADO", "ABIERTO", "CLICK", "BAJA"] } } }),
    prisma.envio.count({ where: { campaniaId: id, abiertoAt: { not: null } } }),
    prisma.envio.count({ where: { campaniaId: id, clickAt: { not: null } } }),
    prisma.envio.count({ where: { campaniaId: id, estado: "REBOTE" } }),
    prisma.envio.count({ where: { campaniaId: id, estado: "BAJA" } }),
  ]);
  // Info de A/B (si aplica): stats por variante + holdout pendiente.
  let abInfo:
    | {
        ganador: string | null;
        testPct: number;
        a: { enviados: number; aperturas: number };
        b: { enviados: number; aperturas: number };
        holdout: number;
      }
    | undefined;
  if (campania.abTestPct != null) {
    const [envA, envB, abrA, abrB] = await Promise.all([
      prisma.envio.count({ where: { campaniaId: id, variante: "A", enviadoAt: { not: null } } }),
      prisma.envio.count({ where: { campaniaId: id, variante: "B", enviadoAt: { not: null } } }),
      prisma.envio.count({ where: { campaniaId: id, variante: "A", abiertoAt: { not: null } } }),
      prisma.envio.count({ where: { campaniaId: id, variante: "B", abiertoAt: { not: null } } }),
    ]);
    let holdout = 0;
    if (!campania.abGanador) {
      const elig = await contactosElegibles(cuenta.id, campania);
      const testSent = await prisma.envio.count({ where: { campaniaId: id } });
      holdout = Math.max(0, (elig?.length ?? 0) - testSent);
    }
    abInfo = {
      ganador: campania.abGanador,
      testPct: campania.abTestPct,
      a: { enviados: envA, aperturas: abrA },
      b: { enviados: envB, aperturas: abrB },
      holdout,
    };
  }

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
      <Link href="/campanias" className="text-sm text-accent transition-colors hover:text-accent-hover">
        ← Campañas
      </Link>
      <PageHeader eyebrow="Campaña" title={campania.nombre} />
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-surface p-3 shadow-sm">
              <div className="text-xs text-muted">{s.label}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{s.value}</div>
            </div>
          ))}
        </div>
      )}
      <CampaniaEditor
        id={campania.id}
        marca={marcaDe(cuenta, process.env.APP_URL ?? "")}
        initial={{
          nombre: campania.nombre,
          asunto: campania.asunto ?? "",
          preheader: campania.preheader ?? "",
          destino: destinoInicial,
          contenido: leerContenido(campania.contenido),
          asuntoB: campania.asuntoB ?? "",
          abTestPct: campania.abTestPct ?? null,
        }}
        listas={listas}
        segmentos={segmentos}
        emailPrueba={email}
        estado={campania.estado}
        programadaAt={campania.programadaAt?.toISOString() ?? null}
        abInfo={abInfo}
      />
    </div>
  );
}
