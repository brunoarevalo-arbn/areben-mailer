import { CheckCircle2, MailX } from "lucide-react";
import { prisma } from "@/lib/prisma";

// Página pública de desuscripción. ?e=<envioId> identifica al contacto.
export default async function BajaPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; c?: string; token?: string }>;
}) {
  const { e, c } = await searchParams;
  let ok = false;

  if (e) {
    try {
      const envio = await prisma.envio.findUnique({ where: { id: e } });
      if (envio) {
        await prisma.$transaction([
          prisma.contacto.update({ where: { id: envio.contactoId }, data: { estado: "BAJA" } }),
          prisma.envio.update({ where: { id: e }, data: { estado: "BAJA" } }),
          prisma.evento.create({ data: { envioId: e, tipo: "COMPLAINT", meta: { via: "unsubscribe" } } }),
        ]);
        ok = true;
      }
    } catch {
      /* noop */
    }
  } else if (c) {
    try {
      await prisma.contacto.update({ where: { id: c }, data: { estado: "BAJA" } });
      ok = true;
    } catch {
      /* noop */
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-surface border border-border rounded-2xl shadow-md px-8 py-10 text-center">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
            ok
              ? "bg-success text-success-foreground"
              : "bg-surface-muted text-muted"
          }`}
        >
          {ok ? (
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          ) : (
            <MailX className="h-6 w-6" aria-hidden />
          )}
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
          Desuscripción
        </h1>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          {ok
            ? "Listo, te desuscribiste. No vas a recibir más emails nuestros."
            : "Tu pedido de baja fue registrado."}
        </p>
      </div>
    </div>
  );
}
