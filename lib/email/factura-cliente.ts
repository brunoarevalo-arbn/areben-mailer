// La FACTURA de un cliente mayorista, que manda el monitor desde el panel (pedido de Darío §5; Bruno 31-oct-2026:
// «un botón para enviar por mail»). Lógica pura: valida el pedido y arma el mail, sin base ni red.
// La ruta es `app/api/externo/factura/route.ts`.
//
// 🔴 A diferencia de `/aviso`, esta puerta le escribe a un TERCERO con el dominio de la marca. Para que una llave
// filtrada ⛔ sirva para mandar cualquier cosa: UN destinatario por pedido, el texto lo arma ESTA app (el monitor
// sólo manda el número, el nombre, el total y el PDF) y el adjunto tiene que ser un PDF de verdad (`%PDF-`) y chico.
// 🔑 ⛔ Toca la base: una factura ⛔ es un contacto ni una campaña (el cliente ⛔ queda suscripto a nada).

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Una factura de jsPDF pesa ~60 KB; 1,5 MB deja aire y queda lejos del límite de Vercel (4,5 MB con el base64). */
export const MAX_PDF_BYTES = 1_500_000;
const MAX_NOMBRE = 120;

export type FacturaCliente = {
  para: string;
  /** «A 00002-00000007» */
  comprobante: string;
  cliente: string;
  total: number;
  /** YYYY-MM-DD */
  fecha: string;
  archivo: string;
  pdf: Buffer;
};

const limpiar = (x: unknown, max: number) => (typeof x === 'string' ? x.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) : '');

export function leerFacturaCliente(body: unknown): { ok: true; factura: FacturaCliente } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const para = typeof b.para === 'string' ? b.para.trim().toLowerCase() : '';
  if (!MAIL.test(para) || para.length > 200) return { ok: false, error: 'email inválido' };
  const comprobante = limpiar(b.comprobante, 40);
  if (!/^[AB] \d{5}-\d{8}$/.test(comprobante)) return { ok: false, error: 'comprobante inválido (se espera «A 00002-00000007»)' };
  const cliente = limpiar(b.cliente, MAX_NOMBRE);
  const total = Number(b.total);
  if (!(Number.isFinite(total) && total > 0)) return { ok: false, error: 'total inválido' };
  const fecha = typeof b.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.fecha) ? b.fecha : '';
  if (!fecha) return { ok: false, error: 'fecha inválida' };
  const archivo = limpiar(b.archivo, 80).replace(/[^\w.\- ]/g, '') || 'factura.pdf';
  if (typeof b.pdf !== 'string' || !b.pdf) return { ok: false, error: 'falta el PDF' };
  if (b.pdf.length > Math.ceil((MAX_PDF_BYTES * 4) / 3) + 4) return { ok: false, error: 'el PDF es demasiado grande' };
  const pdf = Buffer.from(b.pdf, 'base64');
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') return { ok: false, error: 'el adjunto no es un PDF' };
  return { ok: true, factura: { para, comprobante, cliente, total, fecha, archivo: archivo.endsWith('.pdf') ? archivo : `${archivo}.pdf`, pdf } };
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pesos = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaAr = (iso: string) => iso.split('-').reverse().join('/');

/** El asunto, el HTML y el texto del mail. `marca` = el nombre del remitente («BDI Accesorios»). */
export function armarMailFactura(f: FacturaCliente, marca: string): { asunto: string; html: string; texto: string } {
  const de = marca || 'Areben';
  const asunto = `Factura ${f.comprobante} · ${de}`;
  const saludo = f.cliente ? `Hola, ${f.cliente}:` : 'Hola:';
  const cuerpo = `Te mandamos adjunta la factura ${f.comprobante} del ${fechaAr(f.fecha)}, por ${pesos(f.total)}.`;
  const texto = `${saludo}\n\n${cuerpo}\n\nCualquier consulta, respondé este mail.\n\n${de}`;
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222">`
    + `<p>${escapar(saludo)}</p><p>${escapar(cuerpo)}</p><p>Cualquier consulta, respondé este mail.</p><p>${escapar(de)}</p>`
    + `</body></html>`;
  return { asunto, html, texto };
}
