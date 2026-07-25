import { procesarLote } from "@/lib/email/procesar";

export const maxDuration = 60;

// La lógica vive en lib/email/procesar.ts para que la compartan esta ruta (que
// llama el editor desde el navegador) y los scripts de prueba.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await procesarLote(id);
  if (!resultado) return Response.json({ error: "no existe" }, { status: 404 });
  return Response.json(resultado);
}
