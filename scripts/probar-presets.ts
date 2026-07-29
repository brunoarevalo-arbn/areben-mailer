// Las plantillas que vienen con la app. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-presets.ts
//
// Un preset es lo primero que ve un comerciante y lo último que alguien mira
// después: se instancia con dos clicks y sale a una lista. Los dos modos de
// falla son silenciosos:
//
//   1. Un botón sin URL. El mail se ve perfecto en el editor y el click no
//      lleva a ningún lado. Es la forma que tenía la galería entera hasta F6.
//   2. La marca de OTRA tienda adentro. Ya pasó: la bienvenida de Zattia
//      saludaba en nombre de "BDI Accesorios".

import { presetsPara, presetsGaleria, presetDeTrigger, presetDe } from "../lib/plantillas/presets";
import { renderEmailHtml } from "../lib/email/render";
import type { Trigger } from "../lib/automations";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const ZATTIA = { nombre: "Zattia", config: { url: "https://zattia.com.ar", logo: "https://cdn/z.png" } };
const BDI = { nombre: "BDI Accesorios", config: { url: "https://bdiaccesorios.com.ar" } };
/** Cuenta recién creada: sin Tiendanube conectada y sin remitente. */
const NUEVA = { nombre: "Tienda Nueva", config: {} };

const opts = (nombre: string, url?: string) => ({
  unsubscribeUrl: "https://ejemplo.com/baja?t=1",
  nombreCuenta: nombre,
  urlCuenta: url,
});

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

// ─── Ningún botón apunta a la nada ───────────────────────────────────────────
titulo("Con la tienda cargada, todos los links llevan a algún lado");
for (const p of presetsPara(ZATTIA)) {
  const html = renderEmailHtml(p.contenido, opts("Zattia", "https://zattia.com.ar"));
  const vacios = hrefs(html).filter((h) => !h.trim());
  ok(vacios.length === 0, `preset "${p.id}": ningún href vacío`, `${vacios.length} vacíos`);
}

titulo("Sin tienda cargada, el botón NO se dibuja (mejor sin botón que roto)");
for (const p of presetsPara(NUEVA)) {
  const html = renderEmailHtml(p.contenido, opts("Tienda Nueva"));
  const vacios = hrefs(html).filter((h) => !h.trim());
  ok(vacios.length === 0, `preset "${p.id}": ningún href vacío`, `${vacios.length} vacíos`);
}

titulo("El remitente es el fallback del sitio cuando la cuenta no lo tiene");
{
  const p = presetDe("ecommerce", NUEVA, "info@tiendanueva.com.ar")!;
  const html = renderEmailHtml(p.contenido, opts("Tienda Nueva"));
  ok(hrefs(html).some((h) => h.includes("tiendanueva.com.ar")), "sale el dominio del remitente");
}

// ─── La marca se resuelve al instanciar, no se hereda ────────────────────────
titulo("El mismo preset instanciado en dos marcas no arrastra a la otra");
for (const id of ["ecommerce", "bienvenida", "auto-bienvenida"]) {
  const z = JSON.stringify(presetDe(id, ZATTIA)!.contenido) + presetDe(id, ZATTIA)!.asunto;
  const b = JSON.stringify(presetDe(id, BDI)!.contenido) + presetDe(id, BDI)!.asunto;
  ok(!z.includes("BDI"), `preset "${id}" de Zattia no menciona a BDI`);
  ok(!b.includes("Zattia"), `preset "${id}" de BDI no menciona a Zattia`);
  ok(!z.includes("bdiaccesorios.com.ar"), `preset "${id}" de Zattia no linkea a la tienda de BDI`);
}

// ─── ${cart.url} sobrevive ───────────────────────────────────────────────────
titulo("El carrito abandonado conserva su merge tag");
for (const id of ["carrito-oscuro", "auto-carrito"]) {
  const json = JSON.stringify(presetDe(id, ZATTIA)!.contenido);
  ok(json.includes("${cart.url}"), `preset "${id}": el link del checkout sigue siendo un merge tag`);
  // Es el único link que NO depende de que la tienda tenga sitio: lo resuelve el
  // procesador con el checkout real de esa persona.
  const sinTienda = JSON.stringify(presetDe(id, NUEVA)!.contenido);
  ok(sinTienda.includes("${cart.url}"), `preset "${id}": y sigue estando sin sitio cargado`);
}

// ─── Galería y automations no se pisan ───────────────────────────────────────
titulo("Cada preset va donde corresponde");
{
  const galeria = presetsGaleria(ZATTIA);
  ok(galeria.every((p) => !p.trigger), "la galería no muestra los de automation");
  ok(galeria.length >= 10, `la galería tiene ${galeria.length} plantillas`);
  ok(galeria.every((p) => p.asunto === ""), "una plantilla de campaña no trae asunto: se escribe al armarla");

  const triggers: Trigger[] = ["NUEVO_CLIENTE", "COMPRA", "CARRITO_ABANDONADO"];
  for (const t of triggers) {
    const p = presetDeTrigger(t, ZATTIA);
    ok(!!p.asunto, `${t}: trae asunto`, "vino vacío");
    ok(p.contenido.bloques.length > 1, `${t}: trae contenido`);
  }
  // La bienvenida saluda con el nombre de quien la crea. Es el caso que motivó
  // todo esto, así que se mira el string entero y no que "tenga asunto".
  ok(presetDeTrigger("NUEVO_CLIENTE", ZATTIA).asunto.includes("Zattia"), "la bienvenida saluda por la marca correcta");
}

// ─── Ids ─────────────────────────────────────────────────────────────────────
titulo("Ids");
{
  const ids = presetsPara(ZATTIA).map((p) => p.id);
  ok(new Set(ids).size === ids.length, "ningún id repetido", ids.join(","));
  const bloques = presetsPara(ZATTIA).flatMap((p) => p.contenido.bloques.map((b) => `${p.id}:${b.id}`));
  ok(bloques.every((b) => !b.endsWith(":undefined")), "todo bloque nace con id");
}

console.log(fallas === 0 ? "\n✅ Presets OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
