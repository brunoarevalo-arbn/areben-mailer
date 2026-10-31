// La factura del cliente mayorista que manda el monitor (`/api/externo/factura`, Bruno 31-oct-2026).
// Lo que no se ve si falla: un adjunto que no es un PDF, un asunto partido por un salto de línea, el nombre del
// cliente inyectando HTML, o un proveedor que suelta el adjunto callado (el mail sale «te mandamos la factura» SIN ella).
// Correr:  node --import tsx scripts/probar-factura.ts
import { armarMailFactura, leerFacturaCliente, MAX_PDF_BYTES } from '../lib/email/factura-cliente.ts';
import { resendProvider } from '../lib/email/proveedores/resend.ts';

let fallas = 0;
function ok(c: unknown, msg: string) { if (c) console.log(`  ✓ ${msg}`); else { fallas++; console.log(`  ✗ ${msg}`); } }

const PDF = Buffer.from('%PDF-1.3\n%prueba\n').toString('base64');
const BASE = { para: 'Cliente@Ejemplo.com ', comprobante: 'A 00002-00000007', cliente: 'Ferretería <b>Pepe</b>', total: 123456.5, fecha: '2026-10-31', archivo: 'Factura A 00002-00000007.pdf', pdf: PDF };

const l = leerFacturaCliente(BASE);
ok(l.ok, 'el pedido completo se acepta');
if (l.ok) {
  ok(l.factura.para === 'cliente@ejemplo.com', 'el mail se normaliza (minúsculas, sin espacios)');
  ok(l.factura.pdf.subarray(0, 5).toString() === '%PDF-', 'el PDF llega como bytes');
  const m = armarMailFactura(l.factura, 'BDI Accesorios');
  ok(m.asunto === 'Factura A 00002-00000007 · BDI Accesorios', `asunto: ${m.asunto}`);
  ok(!m.html.includes('<b>Pepe</b>') && m.html.includes('&lt;b&gt;Pepe'), 'el nombre del cliente se ESCAPA en el HTML');
  ok(m.texto.includes('$123.456,50') && m.texto.includes('31/10/2026'), 'el texto lleva el total y la fecha argentinos');
}
ok(!leerFacturaCliente({ ...BASE, pdf: Buffer.from('<html>').toString('base64') }).ok, 'un adjunto que no es PDF se rechaza');
ok(!leerFacturaCliente({ ...BASE, pdf: 'A'.repeat(Math.ceil(MAX_PDF_BYTES * 4 / 3) + 100) }).ok, 'un PDF demasiado grande se rechaza');
ok(!leerFacturaCliente({ ...BASE, para: 'a@b.com, c@d.com' }).ok, 'dos destinatarios se rechazan (uno por pedido)');
ok(!leerFacturaCliente({ ...BASE, comprobante: 'A 1\nBcc: x@y.com' }).ok, 'un comprobante con salto de línea se rechaza');
ok(!leerFacturaCliente({ ...BASE, total: 0 }).ok, 'total cero se rechaza');
ok(!leerFacturaCliente({ ...BASE, fecha: '31/10/2026' }).ok, 'fecha con otro formato se rechaza');
const sinExt = leerFacturaCliente({ ...BASE, archivo: '../../etc/passwd' });
ok(sinExt.ok && !sinExt.factura.archivo.includes('/') && sinExt.factura.archivo.endsWith('.pdf'), 'el nombre del archivo pierde las barras y termina en .pdf');

// Un proveedor que ⛔ manda adjuntos tiene que FALLAR, ⛔ mandar el mail sin el PDF.
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'clave-de-mentira';
async function main() {
const r = await resendProvider.enviar({ to: 'x@simulator.amazonses.com', subject: 's', html: 'h', fromEmail: 'a@b.com', adjuntos: [{ nombre: 'f.pdf', tipo: 'application/pdf', contenido: new Uint8Array([1]) }] })
  .then(() => 'salió', (e: Error) => e.message);
ok(/adjuntos/.test(r), `Resend con adjunto falla en vez de soltarlo (${r})`);

console.log(fallas ? `\n${fallas} FALLA(S)` : '\ntodo verde');
process.exit(fallas ? 1 : 0);
}
main();
