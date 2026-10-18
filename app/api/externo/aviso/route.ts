// Un aviso INTERNO que pide el monitor (Darío, 12-oct-2026): hoy, el correo del
// chequeo de exhibición de Zattia a los dueños apenas la empleada cierra el recorrido.
// El monitor ⛔ manda mails: los canaliza por acá, igual que el ticket de la Caja.
//
//   POST /api/externo/aviso   header `x-ticket-key: <TICKET_KEY>`
//   { para: ["…@arebensrl.com"], asunto, html, texto }   (ver lib/email/aviso-interno.ts)
//
// 🔑 Una segunda llave, `TICKET_KEY_ERP`, para el ERP (alertas del motor, 18-oct): sólo vale en esta ruta.
// 🔑 La llave es la MISMA del ticket: es la llave del monitor, que ya está cargada en
// los dos lados (`MAILER_TICKET_KEY` allá, `TICKET_KEY` acá). Falla CERRADO: sin
// `TICKET_KEY`, todo es 401.
// 🔴 Sólo a casillas internas (`DOMINIOS_INTERNOS`), y respeta el gate de envío
// (`destinatarioPermitido`): ⛔ se abre para esto.
// ⛔ Toca la base, ⛔ crea contactos ni Envio: sale directo por `sendEmail`.
import { createHash, timingSafeEqual } from "node:crypto";
import { sendEmail } from "@/lib/email/enviar";
import { destinatarioPermitido } from "@/lib/email/proveedor";
import { leerAviso } from "@/lib/email/aviso-interno";

/** El remitente de los avisos del monitor: el dominio de BDI está verificado en SES con DKIM. */
const DE = { email: process.env.AVISO_FROM_EMAIL || "monitor@bdiaccesorios.com.ar", nombre: "Monitor Areben" };

/**
 * La del monitor (`TICKET_KEY`) o la del ERP (`TICKET_KEY_ERP`, Bruno 18-oct: las alertas del motor). Cada una se revoca
 * sola; la del ERP sirve SÓLO acá (⛔ en `/ticket`).
 */
function llaveValida(recibida: string | null): boolean {
  if (!recibida) return false;
  const b = createHash("sha256").update(recibida).digest();
  return [process.env.TICKET_KEY, process.env.TICKET_KEY_ERP].some(
    (esperada) => !!esperada && timingSafeEqual(createHash("sha256").update(esperada).digest(), b),
  );
}

export async function POST(req: Request) {
  if (!llaveValida(req.headers.get("x-ticket-key"))) return new Response("unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const leido = leerAviso(body);
  if (!leido.ok) return Response.json({ error: leido.error }, { status: 400 });
  const { para, asunto, html, texto } = leido.aviso;

  const enviados: { para: string; id: string }[] = [];
  const fallas: { para: string; motivo: string }[] = [];
  for (const to of para) {
    if (!destinatarioPermitido(to)) {
      fallas.push({ para: to, motivo: "el envío está bloqueado para esta casilla (ver /envio)" });
      continue;
    }
    try {
      const r = await sendEmail({ to, subject: asunto, html, text: texto || undefined, fromEmail: DE.email, fromName: DE.nombre });
      enviados.push({ para: to, id: r.messageId });
    } catch (e) {
      fallas.push({ para: to, motivo: (e as Error).message.slice(0, 200) });
    }
  }
  console.log(JSON.stringify({ aviso: asunto.slice(0, 80), enviados: enviados.length, fallas: fallas.length }));
  return Response.json({ ok: enviados.length > 0, enviados, fallas }, { status: enviados.length ? 200 : 502 });
}
