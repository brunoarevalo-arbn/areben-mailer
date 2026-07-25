import { procesarCola, arrancarCola } from "@/lib/email/cola";

export const maxDuration = 60;

// Worker de la cola de envío. Lo llaman el cron (perro guardián, cada 15 min),
// el auto-encadenamiento de la invocación anterior, y `enviarCampania` cuando
// se encola una campaña nueva. Protegido por CRON_SECRET.
export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const r = await procesarCola();

  // Mientras quede trabajo, la invocación se pasa la posta a la siguiente.
  if (r.continuar) arrancarCola();

  console.log(JSON.stringify({ ev: "cola", ...r }));
  return Response.json(r);
}

// El cron de GitHub Actions pega con curl, que hace GET por default.
export const GET = POST;
