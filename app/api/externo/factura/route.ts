// La FACTURA de un cliente mayorista, que manda el monitor con el botón «Enviar por mail» del panel (pedido de
// Darío §5; Bruno 31-oct-2026).
//
//   POST /api/externo/factura   header `x-ticket-key: <TICKET_KEY>`
//   { marca: "bdi", para, comprobante: "A 00002-00000007", cliente, total, fecha: "YYYY-MM-DD", archivo, pdf: <base64> }
//
// 🔑 Sale con el REMITENTE VERIFICADO de la marca (`getRemitenteEnvio`, el mismo de sus mails), con su «responder a»:
// si el cliente contesta, le llega a la marca. Sin remitente verificado ⛔ sale (no hay fallback a otra marca).
// 🔴 Sólo la llave del MONITOR (`TICKET_KEY`): la del ERP (`TICKET_KEY_ERP`) sirve para avisos internos y ⛔ para
// escribirle a un tercero. Falla CERRADO: sin `TICKET_KEY`, todo es 401.
// 🔴 Respeta el gate de envío (`destinatarioPermitido`): ⛔ se abre para esto.
// ⛔ Toca la base de contactos: el cliente ⛔ queda suscripto a nada. El PDF lo arma el monitor; acá se valida
// que sea un PDF y el texto del mail lo pone ESTA app (`lib/email/factura-cliente.ts`).
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { sendEmail } from "@/lib/email/enviar";
import { destinatarioPermitido } from "@/lib/email/proveedor";
import { armarMailFactura, leerFacturaCliente } from "@/lib/email/factura-cliente";

function llaveValida(recibida: string | null): boolean {
  const esperada = process.env.TICKET_KEY;
  if (!esperada || !recibida) return false;
  const a = createHash("sha256").update(esperada).digest();
  const b = createHash("sha256").update(recibida).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!llaveValida(req.headers.get("x-ticket-key"))) return new Response("unauthorized", { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const marca = typeof body.marca === "string" ? body.marca.trim().toLowerCase() : "";
  const leido = leerFacturaCliente(body);
  if (!leido.ok) return Response.json({ error: leido.error }, { status: 400 });
  const f = leido.factura;

  if (!destinatarioPermitido(f.para)) {
    return Response.json({ error: "El envío está bloqueado para esa casilla (ver /envio en el mailer)." }, { status: 409 });
  }
  const cuenta = await prisma.cuenta.findUnique({ where: { slug: marca }, select: { id: true, nombre: true } });
  if (!cuenta) return Response.json({ error: `marca desconocida: ${marca}` }, { status: 400 });
  const rem = await getRemitenteEnvio(cuenta.id);
  if (!rem) return Response.json({ error: "La marca no tiene un remitente verificado en el mailer." }, { status: 409 });

  const { asunto, html, texto } = armarMailFactura(f, rem.nombre || cuenta.nombre);
  try {
    const r = await sendEmail({
      to: f.para, subject: asunto, html, text: texto,
      fromEmail: rem.email, fromName: rem.nombre, replyTo: rem.responderA ?? undefined,
      adjuntos: [{ nombre: f.archivo, tipo: "application/pdf", contenido: f.pdf }],
    });
    // ⛔ el mail del cliente en el log: el comprobante alcanza para encontrarlo.
    console.log(JSON.stringify({ factura: f.comprobante, marca, id: r.messageId }));
    return Response.json({ ok: true, id: r.messageId, de: rem.email });
  } catch (e) {
    return Response.json({ error: `No salió: ${(e as Error).message.slice(0, 200)}` }, { status: 502 });
  }
}
