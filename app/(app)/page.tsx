import Link from "next/link";
import {
  Users,
  Send,
  MailOpen,
  MousePointerClick,
  Zap,
  UserMinus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EnviosChart, type PuntoSerie } from "@/components/EnviosChart";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { authorizeUrl } from "@/lib/tn/client";
import { PrimerosPasos } from "@/components/PrimerosPasos";

export const dynamic = "force-dynamic";

const ESTADO_CAMPANIA: Record<
  string,
  { label: string; variant: "default" | "amber" | "blue" | "success" | "danger" }
> = {
  BORRADOR: { label: "Borrador", variant: "default" },
  PROGRAMADA: { label: "Programada", variant: "amber" },
  ENVIANDO: { label: "Enviando", variant: "blue" },
  ENVIADA: { label: "Enviada", variant: "success" },
  CANCELADA: { label: "Cancelada", variant: "danger" },
};

function pct(part: number, total: number): string {
  if (!total) return "—";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export default async function Home() {
  const cuenta = await getCuentaActiva();
  const cid = cuenta.id;

  // Cuenta sin estrenar (recién instalada): en vez del dashboard con todo en
  // cero, mostramos la guía de primeros pasos. Con datos, sigue el de siempre.
  const [nContactos, nCampanias] = await Promise.all([
    prisma.contacto.count({ where: { cuentaId: cid } }),
    prisma.campania.count({ where: { cuentaId: cid } }),
  ]);
  if (nContactos === 0 && nCampanias === 0) {
    const remitenteOk = await prisma.remitente.count({
      where: { cuentaId: cid, estado: "AUTENTICADO" },
    });
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Inicio"
          title={cuenta.nombre}
          subtitle="Configurá tu cuenta para empezar a enviar."
        />
        <PrimerosPasos
          nombreTienda={cuenta.nombre}
          tiendaConectada={!!(cuenta.tnStoreId && cuenta.tnToken)}
          tieneContactos={false}
          tieneRemitente={remitenteOk > 0}
          tieneCampania={false}
          urlConectar={authorizeUrl(cid)}
        />
      </div>
    );
  }
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const scope = { campania: { cuentaId: cid } };

  // Serie temporal: 30 días (UTC) para envíos/aperturas/clicks.
  const dias: string[] = [];
  const hoy = new Date();
  for (let k = 29; k >= 0; k--) {
    const dt = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - k));
    dias.push(dt.toISOString().slice(0, 10));
  }
  const desde = new Date(`${dias[0]}T00:00:00.000Z`);

  const [
    contactosByEstado,
    listas,
    campaniasEnviadas,
    automationsActivas,
    enviados,
    aperturas,
    clicks,
    enviados30,
    ultimas,
    serieRaw,
  ] = await Promise.all([
    prisma.contacto.groupBy({
      by: ["estado"],
      where: { cuentaId: cid },
      _count: true,
    }),
    prisma.lista.count({ where: { cuentaId: cid } }),
    prisma.campania.count({ where: { cuentaId: cid, estado: "ENVIADA" } }),
    prisma.automation.count({ where: { cuentaId: cid, estado: "ACTIVO" } }),
    prisma.envio.count({ where: { ...scope, enviadoAt: { not: null } } }),
    prisma.envio.count({ where: { ...scope, abiertoAt: { not: null } } }),
    prisma.envio.count({ where: { ...scope, clickAt: { not: null } } }),
    prisma.envio.count({ where: { ...scope, enviadoAt: { gte: d30 } } }),
    prisma.campania.findMany({
      where: { cuentaId: cid },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, nombre: true, asunto: true, estado: true },
    }),
    prisma.$queryRaw<{ dia: string; metric: string; n: number }[]>`
      SELECT d AS dia, m AS metric, COUNT(*)::int AS n FROM (
        SELECT to_char(date_trunc('day', e."enviadoAt"), 'YYYY-MM-DD') AS d, 'env' AS m
          FROM "Envio" e JOIN "Campania" c ON c.id = e."campaniaId"
          WHERE c."cuentaId" = ${cid} AND e."enviadoAt" >= ${desde}
        UNION ALL
        SELECT to_char(date_trunc('day', e."abiertoAt"), 'YYYY-MM-DD'), 'abr'
          FROM "Envio" e JOIN "Campania" c ON c.id = e."campaniaId"
          WHERE c."cuentaId" = ${cid} AND e."abiertoAt" >= ${desde}
        UNION ALL
        SELECT to_char(date_trunc('day', e."clickAt"), 'YYYY-MM-DD'), 'clk'
          FROM "Envio" e JOIN "Campania" c ON c.id = e."campaniaId"
          WHERE c."cuentaId" = ${cid} AND e."clickAt" >= ${desde}
      ) t GROUP BY d, m
    `,
  ]);

  const serieKey = (m: string, dia: string) => `${m}:${dia}`;
  const serieCnt = new Map<string, number>();
  for (const r of serieRaw) serieCnt.set(serieKey(r.metric, r.dia), Number(r.n));
  const serie: PuntoSerie[] = dias.map((dia) => ({
    dia,
    env: serieCnt.get(serieKey("env", dia)) ?? 0,
    abr: serieCnt.get(serieKey("abr", dia)) ?? 0,
    clk: serieCnt.get(serieKey("clk", dia)) ?? 0,
  }));
  const sumaEnvSerie = serie.reduce((s, p) => s + p.env, 0);

  const porEstado = Object.fromEntries(
    contactosByEstado.map((r) => [r.estado, r._count])
  ) as Record<string, number>;
  const totalContactos = contactosByEstado.reduce((s, r) => s + r._count, 0);
  const activos = porEstado.ACTIVO ?? 0;
  const bajas = porEstado.BAJA ?? 0;
  const rebotados = porEstado.REBOTADO ?? 0;
  const spam = porEstado.SPAM ?? 0;

  // Métricas por campaña para la tabla (3 groupBy sobre las últimas visibles).
  const ids = ultimas.map((c) => c.id);
  const [envG, abrG, clkG] = await Promise.all([
    prisma.envio.groupBy({
      by: ["campaniaId"],
      where: { campaniaId: { in: ids }, enviadoAt: { not: null } },
      _count: true,
    }),
    prisma.envio.groupBy({
      by: ["campaniaId"],
      where: { campaniaId: { in: ids }, abiertoAt: { not: null } },
      _count: true,
    }),
    prisma.envio.groupBy({
      by: ["campaniaId"],
      where: { campaniaId: { in: ids }, clickAt: { not: null } },
      _count: true,
    }),
  ]);
  const enviadosMap = Object.fromEntries(
    envG.map((r) => [r.campaniaId, r._count])
  ) as Record<string, number>;
  const aperturasMap = Object.fromEntries(
    abrG.map((r) => [r.campaniaId, r._count])
  ) as Record<string, number>;
  const clicksMap = Object.fromEntries(
    clkG.map((r) => [r.campaniaId, r._count])
  ) as Record<string, number>;

  const kpis = [
    {
      label: "Contactos activos",
      value: activos.toLocaleString("es-AR"),
      hint: `${totalContactos.toLocaleString("es-AR")} totales`,
      icon: Users,
    },
    {
      label: "Enviados (30 días)",
      value: enviados30.toLocaleString("es-AR"),
      hint: `${enviados.toLocaleString("es-AR")} históricos`,
      icon: Send,
    },
    {
      label: "Tasa de apertura",
      value: pct(aperturas, enviados),
      hint: `${aperturas.toLocaleString("es-AR")} aperturas`,
      icon: MailOpen,
    },
    {
      label: "Tasa de clicks",
      value: pct(clicks, enviados),
      hint: `${clicks.toLocaleString("es-AR")} clicks`,
      icon: MousePointerClick,
    },
  ];

  const hayEnvios = enviados > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inicio"
        title={cuenta.nombre}
        subtitle="Resumen de tu cuenta de email marketing."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} elevated>
              <div className="flex items-start justify-between">
                <div className="text-sm text-muted">{k.label}</div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle text-accent-subtle-foreground">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
              </div>
              <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                {k.value}
              </div>
              <div className="mt-1 text-xs text-subtle">{k.hint}</div>
            </Card>
          );
        })}
      </div>

      {/* Serie temporal de actividad */}
      {sumaEnvSerie > 0 && (
        <Card>
          <div className="mb-1 text-sm font-medium text-foreground">Actividad</div>
          <EnviosChart data={serie} />
        </Card>
      )}

      {/* Salud de la audiencia + automations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="text-sm font-medium text-foreground mb-4">
            Salud de la audiencia
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Activos", value: activos, tone: "text-foreground" },
              { label: "Bajas", value: bajas, tone: "text-muted" },
              { label: "Rebotados", value: rebotados, tone: "text-muted" },
              { label: "Spam", value: spam, tone: "text-muted" },
            ].map((s) => (
              <div key={s.label}>
                <div
                  className={`text-2xl font-semibold tabular-nums ${s.tone}`}
                >
                  {s.value.toLocaleString("es-AR")}
                </div>
                <div className="text-xs text-muted mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-subtle">
            <span>{listas.toLocaleString("es-AR")} listas</span>
            <span>·</span>
            <span>{campaniasEnviadas.toLocaleString("es-AR")} campañas enviadas</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div className="text-sm text-muted">Automations activas</div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle text-accent-subtle-foreground">
              <Zap className="h-4 w-4" aria-hidden />
            </div>
          </div>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            {automationsActivas.toLocaleString("es-AR")}
          </div>
          <Link
            href="/automations"
            className="mt-3 inline-block text-xs font-medium text-accent hover:text-accent-hover"
          >
            Ver automations →
          </Link>
        </Card>
      </div>

      {/* Últimas campañas o próximo paso */}
      {ultimas.length > 0 ? (
        <Card padding="none">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="text-sm font-medium text-foreground">
              Últimas campañas
            </div>
            <Link
              href="/campanias"
              className="text-xs font-medium text-accent hover:text-accent-hover"
            >
              Ver todas →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="px-6 py-2.5 font-medium">Campaña</th>
                  <th className="px-6 py-2.5 font-medium">Estado</th>
                  <th className="px-6 py-2.5 font-medium text-right">Enviados</th>
                  <th className="px-6 py-2.5 font-medium text-right">Aperturas</th>
                  <th className="px-6 py-2.5 font-medium text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {ultimas.map((c) => {
                  const env = enviadosMap[c.id] ?? 0;
                  const abr = aperturasMap[c.id] ?? 0;
                  const clk = clicksMap[c.id] ?? 0;
                  const est = ESTADO_CAMPANIA[c.estado] ?? {
                    label: c.estado,
                    variant: "default" as const,
                  };
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-surface-muted/60 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <Link
                          href={`/campanias/${c.id}`}
                          className="font-medium text-foreground hover:text-accent"
                        >
                          {c.nombre}
                        </Link>
                        <div className="text-xs text-subtle truncate max-w-xs">
                          {c.asunto || "Sin asunto"}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={est.variant} size="sm">
                          {est.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-foreground">
                        {env.toLocaleString("es-AR")}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-muted">
                        {env ? pct(abr, env) : "—"}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-muted">
                        {env ? pct(clk, env) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <UserMinus className="h-4 w-4 text-accent" aria-hidden />
            Próximo paso
          </div>
          <p className="mt-1 text-sm text-muted">
            Conectá Tiendanube para importar tus contactos, o creá una lista
            manual para empezar. El envío se activa cuando el dominio esté
            autenticado en SES.
          </p>
        </Card>
      )}

      {!hayEnvios && ultimas.length > 0 && (
        <p className="text-xs text-subtle">
          Todavía no enviaste ninguna campaña — las métricas de apertura y click
          van a aparecer acá cuando lo hagas.
        </p>
      )}
    </div>
  );
}
