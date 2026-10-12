// Los avisos INTERNOS que pide el monitor (Darío, 12-oct-2026): el correo del chequeo
// de exhibición a los dueños, y los reportes de procesos que vengan. Lógica pura:
// valida el pedido, sin base ni red. La ruta es `app/api/externo/aviso/route.ts`.
//
// 🔴 **Sólo a casillas de la empresa** (`DOMINIOS_INTERNOS`). La llave es la del
// monitor: si se filtrara, esta puerta ⛔ puede servir para mandarle a terceros con
// el dominio de la marca —la reputación que sostiene los 16.800 contactos—.
// 🔑 ⛔ Toca la base: un aviso interno ⛔ es un contacto ni una campaña.

export const DOMINIOS_INTERNOS = ['@arebensrl.com'];
export const MAX_DESTINOS = 10;
const MAX_ASUNTO = 200;
const MAX_HTML = 400_000;
const MAX_TEXTO = 200_000;
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AvisoInterno = { para: string[]; asunto: string; html: string; texto: string };

export function leerAviso(body: unknown): { ok: true; aviso: AvisoInterno } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const crudos = Array.isArray(b.para) ? b.para : typeof b.para === 'string' ? [b.para] : [];
  const para = [...new Set(crudos.map((x) => String(x ?? '').trim().toLowerCase()).filter(Boolean))];
  if (!para.length) return { ok: false, error: 'falta a quién (para)' };
  if (para.length > MAX_DESTINOS) return { ok: false, error: `como mucho ${MAX_DESTINOS} destinatarios` };
  for (const p of para) {
    if (!MAIL.test(p)) return { ok: false, error: `email inválido: ${p}` };
    if (!DOMINIOS_INTERNOS.some((d) => p.endsWith(d))) return { ok: false, error: `sólo casillas internas (${DOMINIOS_INTERNOS.join(', ')}): ${p}` };
  }
  // Un salto de línea en el asunto parte la cabecera del mail.
  const asunto = typeof b.asunto === 'string' ? b.asunto.replace(/[\r\n]+/g, ' ').trim() : '';
  if (!asunto || asunto.length > MAX_ASUNTO) return { ok: false, error: 'asunto vacío o demasiado largo' };
  const html = typeof b.html === 'string' ? b.html : '';
  if (!html || html.length > MAX_HTML) return { ok: false, error: 'html vacío o demasiado largo' };
  const texto = typeof b.texto === 'string' ? b.texto.slice(0, MAX_TEXTO) : '';
  return { ok: true, aviso: { para, asunto, html, texto } };
}
