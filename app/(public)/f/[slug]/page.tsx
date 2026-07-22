import type { Metadata } from "next";
import { MailX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FormularioPublico } from "./FormularioPublico";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const form = await prisma.formulario.findFirst({
    where: { slug, activo: true },
    select: { titulo: true },
  });
  return { title: form?.titulo ?? "Suscripción" };
}

export default async function FormularioPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await prisma.formulario.findFirst({
    where: { slug, activo: true },
    select: {
      titulo: true,
      descripcion: true,
      botonTexto: true,
      exitoMensaje: true,
      pedirNombre: true,
    },
  });

  if (!form) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-surface border border-border rounded-2xl shadow-md px-8 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-muted">
            <MailX className="h-6 w-6" aria-hidden />
          </div>
          <p className="mt-4 text-sm text-muted">
            Este formulario no está disponible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <FormularioPublico
      slug={slug}
      titulo={form.titulo}
      descripcion={form.descripcion}
      botonTexto={form.botonTexto}
      exitoMensaje={form.exitoMensaje}
      pedirNombre={form.pedirNombre}
    />
  );
}
