// Invariantes de la cascada de estilos. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-estilos.ts

import { resolverEstilo, extra, type Estilos } from "../lib/email/estilos";
import { renderEmailHtml } from "../lib/email/render";
import { resolverPaleta } from "../lib/email/tema";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const PAL = resolverPaleta({});

// ─── El orden de las capas ───────────────────────────────────────────────────
titulo("Bloque > documento > tipo > base");
{
  const base = resolverEstilo("titulo", "titulo", { pal: PAL });
  ok(base.tamano === 26, "sin nada: el base (26px)", `salió ${base.tamano}`);

  const porTipo = resolverEstilo("hero", "titulo", { pal: PAL });
  ok(porTipo.tamano === 30, "el hero pisa al base (30px)", `salió ${porTipo.tamano}`);

  const doc: Estilos = { titulo: { tamano: 40 } };
  ok(resolverEstilo("hero", "titulo", { pal: PAL, doc }).tamano === 40, "el documento pisa al tipo");

  const propio: Estilos = { titulo: { tamano: 44 } };
  ok(resolverEstilo("hero", "titulo", { pal: PAL, doc, propio }).tamano === 44, "el bloque pisa al documento");

  // Y lo que el bloque NO dice sigue viniendo de abajo: si el merge fuera por
  // objeto en vez de por campo, poner el tamaño borraría la interlínea.
  const e = resolverEstilo("hero", "titulo", { pal: PAL, doc, propio });
  ok(e.interlinea === 1.2, "lo que nadie tocó sigue bajando del tipo", `interlínea ${e.interlinea}`);
}

// ─── El argumento de venta del SaaS ──────────────────────────────────────────
titulo("Un token se repinta cuando cambia la marca; un hex no");
{
  const contenido = {
    bloques: [
      { id: "a", tipo: "boton", texto: "Token", url: "#", estilo: { boton: { fondo: "$acento" } } },
      { id: "b", tipo: "boton", texto: "Clavado", url: "#", estilo: { boton: { fondo: "#ff0000" } } },
    ],
  } as never;
  const opts = { unsubscribeUrl: "#", nombreCuenta: "X" };

  const ambar = renderEmailHtml(contenido, { ...opts, temaMarca: { acento: "#f59e0b" } });
  const azul = renderEmailHtml(contenido, { ...opts, temaMarca: { acento: "#2d9ff7" } });

  ok(ambar.includes("#f59e0b") && !ambar.includes("#2d9ff7"), "con la marca ámbar, el token sale ámbar");
  ok(azul.includes("#2d9ff7") && !azul.includes("#f59e0b"), "cambia la marca y el token se repinta solo");
  ok(ambar.includes("#ff0000") && azul.includes("#ff0000"), "el hex elegido a mano NO se mueve");
}

// ─── Nada del Json llega crudo al HTML ───────────────────────────────────────
titulo("Un color inválido no se escapa del atributo style");
{
  // `esc()` no escapa comillas, así que un color con una comilla se saldría del
  // `style="…"` y podría inyectar atributos. El iframe del preview hereda el
  // origen del panel: eso sería XSS almacenado.
  const veneno = '#fff" onmouseover="alert(1)';
  const html = renderEmailHtml(
    { bloques: [{ id: "a", tipo: "titulo", texto: "T", estilo: { titulo: { color: veneno } } }] } as never,
    { unsubscribeUrl: "#", nombreCuenta: "X" },
  );
  ok(!html.includes("onmouseover"), "⛔ el veneno no aparece en el HTML");
  ok(html.includes(`color:${PAL.texto}`), "y el título cae al color del tema");
}

// ─── Clamps ──────────────────────────────────────────────────────────────────
titulo("Los clamps atajan los bordes");
{
  const c = (e: Estilos) => resolverEstilo("titulo", "titulo", { pal: PAL, propio: e });
  // El saneo del esquema es el que acota; acá se verifica que un valor ya
  // saneado pasa derecho y que el resolvedor no lo vuelve a tocar.
  ok(c({ titulo: { tamano: 48 } }).tamano === 48, "48px pasa (es el tope)");
  ok(c({ titulo: { padX: 64 } }).padX === 64, "64px de padding pasa (es el tope)");
}

// ─── Legibilidad contextual ──────────────────────────────────────────────────
titulo("El texto se decide por el fondo REAL del bloque");
{
  // Una sección clara dentro de un mail oscuro. Si el texto heredara la paleta
  // del tema saldría casi blanco sobre casi blanco.
  const html = renderEmailHtml(
    {
      tema: { base: "oscuro" },
      bloques: [{ id: "a", tipo: "seccion", bg: "#ffffff", titulo: "Se lee?", texto: "Sí", botonTexto: "", botonUrl: "" }],
    } as never,
    { unsubscribeUrl: "#", nombreCuenta: "X" },
  );
  ok(html.includes("color:#171717"), "sobre fondo blanco el título sale oscuro");
  ok(!html.includes("color:#fafafa;"), "no hereda el texto claro del tema oscuro");
}
{
  // Y al revés: si alguien ELIGIÓ el color, se respeta aunque quede feo. Es su
  // mail; la corrección automática es para lo que nadie tocó.
  const html = renderEmailHtml(
    {
      bloques: [{
        id: "a", tipo: "seccion", bg: "#ffffff", titulo: "T", texto: "", botonTexto: "", botonUrl: "",
        estilo: { titulo: { color: "#ffffff" } },
      }],
    } as never,
    { unsubscribeUrl: "#", nombreCuenta: "X" },
  );
  ok(html.includes("color:#ffffff"), "un color elegido a mano no se corrige solo");
}

// ─── extra(): solo lo elegido ────────────────────────────────────────────────
titulo("extra() emite lo elegido, no el base");
{
  const sinNada = resolverEstilo("cupon", "cuerpo", { pal: PAL });
  ok(extra(sinNada, ["tamano", "color"]) === "", "sin estilos propios no agrega nada", extra(sinNada, ["tamano", "color"]));

  const conPeso = resolverEstilo("cupon", "cuerpo", { pal: PAL, propio: { cuerpo: { peso: 700 } } });
  ok(extra(conPeso, ["tamano", "color"]) === ";font-weight:700", "el peso elegido sí sale", extra(conPeso, ["tamano", "color"]));

  const dup = resolverEstilo("titulo", "titulo", { pal: PAL, propio: { titulo: { tamano: 40 } } });
  ok(!extra(dup, ["tamano"]).includes("font-size"), "lo que la plantilla ya escribió no se duplica");

  // `false` no es una elección: el saneo lo borra, así que nunca llega acá.
  const falso = resolverEstilo("titulo", "titulo", { pal: PAL, propio: { titulo: { mayusculas: false } } });
  ok(!extra(falso).includes("uppercase"), "un `false` no emite nada");
}

// ─── El padding simétrico se escribe corto ───────────────────────────────────
titulo("padding:32px, no padding:32px 32px");
{
  const html = renderEmailHtml(
    { bloques: [{ id: "a", tipo: "seccion", bg: "#eee", titulo: "T", texto: "", botonTexto: "", botonUrl: "" }] } as never,
    { unsubscribeUrl: "#", nombreCuenta: "X" },
  );
  ok(html.includes("padding:32px;"), "los dos lados iguales van en un solo valor");
}

console.log(fallas === 0 ? "\n✅ Estilos OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
