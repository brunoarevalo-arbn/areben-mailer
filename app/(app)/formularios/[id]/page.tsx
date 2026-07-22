import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { FormularioEditor } from "@/components/FormularioEditor";

export const dynamic = "force-dynamic";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://areben-mailer.vercel.app";

export default async function FormularioEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cuenta = await getCuentaActiva();

  const [form, listas] = await Promise.all([
    prisma.formulario.findFirst({ where: { id, cuentaId: cuenta.id } }),
    prisma.lista.findMany({
      where: { cuentaId: cuenta.id },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  if (!form) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/formularios"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Formularios
      </Link>

      <PageHeader eyebrow="Formulario" title={form.nombre} />

      <FormularioEditor
        listas={listas}
        publicUrl={`${BASE_URL}/f/${form.slug}`}
        initial={{
          id: form.id,
          nombre: form.nombre,
          titulo: form.titulo,
          descripcion: form.descripcion ?? "",
          botonTexto: form.botonTexto,
          exitoMensaje: form.exitoMensaje,
          pedirNombre: form.pedirNombre,
          listaId: form.listaId ?? "",
          activo: form.activo,
          submits: form.submits,
        }}
      />
    </div>
  );
}
