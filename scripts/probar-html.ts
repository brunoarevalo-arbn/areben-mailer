// Invariantes del HTML que sale al mail. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-html.ts

import { renderEmailHtml, renderEmailTexto, nuevoBloque, TIPOS_BLOQUE } from "../lib/email/render";
import { inyectarTracking } from "../lib/email/tracking";
import { CLASES } from "../lib/email/shell";
import { V_ACTUAL } from "../lib/email/esquema";
import { presetsPara } from "../lib/plantillas/presets";

/** Una cuenta de mentira para instanciar los presets. */
const CUENTA = { nombre: "Marca de prueba", config: { url: "https://ejemplo.com" } };
import type { ContenidoCampania } from "../lib/email/render";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const OPTS = { unsubscribeUrl: "https://x.com/baja?t=1", nombreCuenta: "Marca", direccionPostal: "Calle 1" };
const render = (c: unknown) => renderEmailHtml(c as ContenidoCampania, OPTS);

// Un mail con todos los tipos de bloque adentro, para barrer de una.
const TODO = render({ bloques: TIPOS_BLOQUE.map((t) => nuevoBloque(t)) });

// ─── Outlook de escritorio ───────────────────────────────────────────────────
titulo("Outlook de escritorio");
{
  ok(TODO.includes("<o:PixelsPerInch>96</o:PixelsPerInch>"), "PixelsPerInch=96 (si no, todo sale 25% más grande)");
  ok(TODO.includes('xmlns:v="urn:schemas-microsoft-com:vml"'), "el namespace de VML está en el <html>");
  ok(TODO.includes("<table role=\"presentation\" width=\"100%\""), "hay tabla exterior");
  ok(!/<div style="max-width:\d+px;margin:0 auto/.test(TODO), "ya no se centra con un div (Outlook lo ignora)");
  ok(TODO.includes("mso-hide:all"), "hay reglas mso para lo que se oculta");
}

titulo("El botón VML");
{
  const html = render({ bloques: [{ tipo: "boton", texto: "Comprar ahora", url: "https://x.com" }] });
  ok(html.includes("<v:roundrect"), "se dibuja el roundrect");
  ok(html.includes("<w:anchorlock/>"), "lleva anchorlock (si no, el texto no queda clickeable)");
  ok(/arcsize="\d+%"/.test(html), "arcsize va en porcentaje, no en px");
  const arc = Number(html.match(/arcsize="(\d+)%"/)?.[1] ?? 0);
  ok(arc > 0 && arc <= 50, `arcsize dentro de rango (salió ${arc}%)`);

  // El ancla tiene que estar escondida de Outlook o dibuja los dos botones.
  const iVml = html.indexOf("<v:roundrect");
  const iNoMso = html.indexOf("<!--[if !mso]><!-->");
  const iA = html.indexOf("<a href", iVml);
  ok(iNoMso > iVml && iNoMso < iA, "el ancla queda dentro de <!--[if !mso]>");
  ok(html.includes("<!--<![endif]-->"), "y el condicional se cierra");

  const vml = html.slice(iVml, html.indexOf("</v:roundrect>"));
  ok(/width:\d+px/.test(vml) && /height:\d+px/.test(vml), "el VML lleva width y height en px");
}

// ─── El tracking ve los dos botones ──────────────────────────────────────────
titulo("El tracking no se olvida de Outlook");
{
  const html = render({ bloques: [{ tipo: "boton", texto: "Ir", url: "https://tienda.com/p" }] });
  const conT = inyectarTracking(html, "envio123", "https://app.com");
  const tracked = conT.match(/https:\/\/app\.com\/api\/track\/click\/envio123/g) ?? [];
  ok(tracked.length === 2, "se envuelven los DOS links: el <a> y el <v:roundrect>", `envueltos: ${tracked.length}`);
  ok(!conT.includes('href="https://tienda.com/p"'), "no quedó ninguno sin envolver");
  ok(conT.includes("/api/track/open/envio123"), "el pixel de apertura sigue estando");
}
{
  // Lo que NO se toca sigue sin tocarse.
  const html = `<a href="mailto:a@b.com">m</a><a href="#x">a</a><a href="https://x.com/baja?t=1">baja</a>`;
  const conT = inyectarTracking(html, "e", "https://app.com");
  ok(conT.includes('href="mailto:a@b.com"'), "mailto: intacto");
  ok(conT.includes('href="#x"'), "ancla intacta");
  ok(conT.includes('href="https://x.com/baja?t=1"'), "el link de baja NO se trackea");
}

// ─── Responsive ──────────────────────────────────────────────────────────────
titulo("Responsive");
{
  ok(TODO.includes("@media only screen and (max-width:"), "hay media query");
  ok((TODO.match(/<style>/g) ?? []).length === 1, "un solo bloque <style>");

  const grilla = render({
    bloques: [{ tipo: "productos", items: [
      { nombre: "A", precio: "1000", imagen: "https://x/a.jpg", url: "https://x/a" },
      { nombre: "B", precio: "2000", imagen: "https://x/b.jpg", url: "https://x/b" },
    ] }],
  });
  ok(grilla.includes(`class="${CLASES.col}"`), "la grilla de productos apila en el celular");

  const cols = render({ bloques: [{ tipo: "columnas", izq: { imagen: "https://x/a.jpg", url: "#" }, der: { imagen: "https://x/b.jpg", url: "#" } }] });
  ok(cols.includes(`class="${CLASES.col}"`), "las columnas apilan en el celular");
}
{
  // La regla que sostiene todo: una clase es SIEMPRE un override, nunca el
  // único lugar donde vive una propiedad. Si un cliente descarta el <style>
  // —Outlook, o Gmail cuando recorta— tiene que ver el layout de escritorio,
  // no uno roto.
  const cuerpo = TODO.slice(TODO.indexOf("<body"));
  const conClase = cuerpo.match(/<[^>]*class="[^"]*"[^>]*>/g) ?? [];
  const sinInline = conClase.filter((t) => !/style="/.test(t) && !/width="/.test(t));
  ok(sinInline.length === 0, "toda etiqueta con clase trae también su valor inline", sinInline.slice(0, 2).join("\n      "));
}
{
  // Un título con tamaño elegido no puede ser pisado por la media query.
  const libre = render({ bloques: [{ tipo: "titulo", texto: "T" }] });
  const elegido = render({ bloques: [{ tipo: "titulo", texto: "T", estilo: { titulo: { tamano: 40 } } }] });
  ok(libre.includes(`class="${CLASES.titulo}"`), "un título por defecto se achica en el celular");
  ok(!elegido.includes(`class="${CLASES.titulo}"`), "un título de 40px elegido a mano NO se achica");
  ok(elegido.includes("font-size:40px"), "y sale con los 40px");
}

// ─── Lo que no puede aparecer ────────────────────────────────────────────────
titulo("Propiedades que los clientes de mail no soportan");
{
  ok(!TODO.includes("position:absolute"), "cero position:absolute (Gmail lo elimina)");
  ok(!/[^-]display:flex|display:grid/.test(TODO), "cero flex y grid");
  ok(!/[^-]float:/.test(TODO), "cero float");
  ok(!TODO.includes("box-shadow"), "cero box-shadow");
  ok(!/\bcalc\(/.test(TODO), "cero calc()");
  ok(!/font-size:\s*\d+(\.\d+)?(rem|em)\b/.test(TODO), "ningún tamaño en rem/em");
}

// ─── Cosas que no se pueden perder ───────────────────────────────────────────
titulo("Lo que no puede faltar nunca");
{
  for (const bloques of [[], TIPOS_BLOQUE.map((t) => nuevoBloque(t))]) {
    const html = render({ bloques });
    ok(html.includes(OPTS.unsubscribeUrl), `el link de baja está (con ${bloques.length} bloques)`);
  }
  ok(TODO.includes("a[x-apple-data-detectors]"), "iOS no pinta de azul la dirección del pie");
}
{
  // Un tipo nuevo que se olvide de `bloqueATexto` tiene que fallar acá, no
  // salir con la parte de texto vacía —que es señal de spam clásica.
  //
  // Se compara contra el mail SIN ese bloque, no contra un separador fijo: el
  // pie ya trae un "—" siempre, así que buscarlo daba verde para cualquier
  // tipo, aportara texto o no.
  // Con `v` puesta: un contenido sin versión pasa por la migración, que le
  // materializa el encabezado, y entonces el bloque `encabezado` no se
  // distinguiría del mail vacío.
  const base = { v: V_ACTUAL, bloques: [] } as unknown as ContenidoCampania;
  const vacio = renderEmailTexto(base, OPTS);
  const sinTexto = TIPOS_BLOQUE.filter((t) => {
    const b = nuevoBloque(t);
    // Los que no aportan texto legible a propósito: recién creados están vacíos.
    // `productos-dinamicos` está acá por lo mismo que `productos` —nace sin nada
    // que decir— y además sus productos ni siquiera viven en el bloque. Que SÍ
    // aporte texto cuando los tiene lo fija `probar-productos-dinamicos.ts`.
    // "menu" nace con links sin URL (mismo motivo que "redes"), y "html" nace
    // sin contenido y además no tiene conversión razonable a texto plano.
    if (["espaciador", "imagen", "carrito", "productos", "productos-dinamicos", "columnas", "video", "redes", "menu", "html"].includes(t)) return false;
    return renderEmailTexto({ ...base, bloques: [b] }, OPTS) === vacio;
  });
  ok(sinTexto.length === 0, "todo tipo con contenido aporta algo a la parte de texto", sinTexto.join(", "));
}

// ─── Peso ────────────────────────────────────────────────────────────────────
titulo("Peso: Gmail recorta a ~102 KB y al recortar TIRA el <style>");
{
  for (const p of presetsPara(CUENTA)) {
    const kb = Buffer.byteLength(render(p.contenido), "utf8") / 1024;
    ok(kb < 80, `${p.id}: ${kb.toFixed(1)} KB (tope 80)`);
  }
  ok(!TODO.includes("data:image"), "cero imágenes en base64");
}

console.log(fallas === 0 ? "\n✅ HTML OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
