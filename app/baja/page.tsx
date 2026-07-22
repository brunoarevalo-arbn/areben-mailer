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
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", fontFamily: "system-ui", padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>Desuscripción</h1>
      <p style={{ color: "#666", lineHeight: 1.5 }}>
        {ok
          ? "Listo, te desuscribiste. No vas a recibir más emails nuestros."
          : "Tu pedido de baja fue registrado."}
      </p>
    </div>
  );
}
