// Un mail `formato: "completo"`: sale el documento tal cual, con SU `<style>`, sin
// el pie del motor, con el link de baja de cada envío, tracking y text/plain.
import assert from "node:assert/strict";
import { renderEmailHtml, renderEmailTexto } from "../lib/email/render.ts";
import { leerContenido, V_ACTUAL } from "../lib/email/esquema.ts";
import { inyectarTracking } from "../lib/email/tracking.ts";
import { urlsDeProductoEnHtml, MARCADOR_BAJA } from "../lib/email/html-completo.ts";

const BAJA = "https://links.ejemplo.com/baja?e=E1";
const doc = `<!doctype html><html><head><style>@media only screen and (max-width:600px){.m-q{width:50%!important}}</style></head><body>
<div style="display:none;max-height:0">preheader oculto</div>
<a href="https://t.com/productos/top-a/?utm_source=m"><img src="x.jpg" alt=""></a>
<div>CORPI&Ntilde;O $5.490</div><a href="https://t.com/?utm_content=c">COMPRAR</a>
<a href="${MARCADOR_BAJA}">Desuscribirme</a></body></html>`;
const c = { v: V_ACTUAL, bloques: [], formato: "completo" as const, htmlCompleto: doc };
const opts = { unsubscribeUrl: BAJA, nombreCuenta: "X", permiteHtmlCrudo: true };

const leido = leerContenido(JSON.parse(JSON.stringify(c)));
assert.equal(leido.formato, "completo", "leerContenido conserva el formato");
assert.equal(leido.htmlCompleto, doc, "leerContenido conserva el documento");
assert.equal(leerContenido({ v: 1, bloques: [], formato: "completo", htmlCompleto: doc }).htmlCompleto, doc, "también por el camino lento");

const html = renderEmailHtml(c, opts);
assert.ok(html.includes("@media only screen"), "conserva el <style> del head");
assert.ok(html.includes(`href="${BAJA}"`), "el marcador pasa a ser el link de baja del envío");
assert.ok(!html.includes(MARCADOR_BAJA), "el marcador no sale crudo");
assert.equal(html.match(/Desuscribirme/g)?.length, 1, "sin pie duplicado");

const sinMarcador = renderEmailHtml({ ...c, htmlCompleto: "<html><body>hola</body></html>" }, opts);
assert.ok(sinMarcador.includes(BAJA), "🔴 sin marcador, el link de baja se agrega igual");

assert.equal(renderEmailHtml(c, { ...opts, permiteHtmlCrudo: false }), "", "sin permiso de la cuenta no se dibuja");

const t = inyectarTracking(html, "E1", "https://links.ejemplo.com");
assert.ok(t.includes("/api/track/click/E1?u=https%3A%2F%2Ft.com%2F%3Futm_content%3Dc"), "los links pasan por el tracking y conservan el utm");
assert.ok(t.includes(`href="${BAJA}"`), "la baja no pasa por el tracking");
assert.ok(t.includes("/api/track/open/E1"), "lleva pixel");

const texto = renderEmailTexto(c, opts);
assert.ok(!texto.includes("preheader oculto"), "lo oculto no va en el texto");
assert.ok(!texto.includes("@media"), "el CSS no va en el texto");
assert.ok(texto.includes("CORPIÑO $5.490"), "decodifica entidades");
assert.ok(texto.includes("COMPRAR (https://t.com/?utm_content=c)"), "el botón conserva su destino");
assert.ok(texto.includes(`Desuscribirme: ${BAJA}`), "el texto lleva la baja");
assert.ok(!texto.includes(MARCADOR_BAJA), "el marcador no sale en el texto");

assert.deepEqual(urlsDeProductoEnHtml(doc), ["https://t.com/productos/top-a/"]);
console.log("ok probar-html-completo");
