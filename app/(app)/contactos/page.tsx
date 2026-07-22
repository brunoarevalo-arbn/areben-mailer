import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { ContactosAcciones } from "@/components/ContactosAcciones";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;

const estadoBadge: Record<string, "success" | "default" | "warning" | "danger"> = {
  ACTIVO: "success",
  BAJA: "default",
  REBOTADO: "warning",
  SPAM: "danger",
};

export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const cuenta = await getCuentaActiva();
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.ContactoWhereInput = {
    cuentaId: cuenta.id,
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { nombre: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, contactos, listas] = await Promise.all([
    prisma.contacto.count({ where }),
    prisma.contacto.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
    }),
    prisma.lista.findMany({ where: { cuentaId: cuenta.id }, orderBy: { createdAt: "asc" }, select: { id: true, nombre: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const linkPage = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/contactos?${qs}` : "/contactos";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audiencia"
        title="Contactos"
        subtitle={`${total.toLocaleString("es-AR")} ${q ? "resultados" : "contactos"}`}
      />

      <ContactosAcciones listas={listas} />

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por email o nombre…"
          className="w-full max-w-md rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-ring/30"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Buscar
        </button>
      </form>

      {contactos.length === 0 ? (
        <EmptyState
          title="Sin contactos"
          message={q ? "No hay resultados para tu búsqueda." : "Todavía no importaste contactos."}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-muted">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Marketing</th>
                  <th className="px-4 py-3 font-medium text-right">Gastado</th>
                </tr>
              </thead>
              <tbody>
                {contactos.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 font-medium text-foreground">{c.email}</td>
                    <td className="px-4 py-2.5 text-muted">{c.nombre ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={estadoBadge[c.estado] ?? "default"}>{c.estado}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {c.tnAcceptsMkt ? (
                        <Badge variant="success">acepta</Badge>
                      ) : (
                        <Badge variant="default">no</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                      {c.tnTotalGastado ? `$${Number(c.tnTotalGastado).toLocaleString("es-AR")}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <a
              href={linkPage(page - 1)}
              aria-disabled={page <= 1}
              className={`rounded-xl border border-border px-3 py-1.5 text-foreground transition-colors ${
                page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-surface-muted hover:border-border-strong"
              }`}
            >
              Anterior
            </a>
            <a
              href={linkPage(page + 1)}
              aria-disabled={page >= totalPages}
              className={`rounded-xl border border-border px-3 py-1.5 text-foreground transition-colors ${
                page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-surface-muted hover:border-border-strong"
              }`}
            >
              Siguiente
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
