// Una foto puede salir más chica que la tarjeta, y alineada.
//
//   node --import tsx scripts/probar-imagen-escala.ts
//
// 🔴 **Por qué existe este archivo y no alcanza `probar-panel-estilo`**: aquél
// recorre `PROPS_POR_ROL`, o sea las perillas de la CASCADA. `ancho` y `align`
// del bloque `imagen` son campos de **contenido** —van en el bloque, como
// `logoAncho`— así que ese guardián no los ve ni los vería nunca. Sin esto, el
// único test del camino nuevo sería el golden, que no tiene ningún fixture con
// una foto escalada.
//
// Las cinco invariantes que cuida:
//   1. **Sin `ancho` ni `align`, el HTML es EXACTAMENTE el de siempre.** Es lo
//      que hace que ningún mail ya guardado se mueva un byte, y lo que permitió
//      que esto entrara sin bump de `V_ACTUAL` ni migración.
//   2. **El ancho sale en píxeles y también como atributo.** Outlook de
//      escritorio ignora `max-width` y no escala una imagen por CSS: con un
//      `width:50%` dibujaría la foto a su tamaño original, que es justo el
//      defecto que esto viene a arreglar. Mismo camino que el logo del
//      encabezado.
//   3. **El porcentaje se mide contra el ancho ÚTIL, no contra 600.** El útil es
//      el del mail menos el padding lateral de `pad()`, y ese padding se puede
//      cambiar desde el panel: cablear 600 sería un número que miente en cuanto
//      alguien mueva el margen.
//   4. **`sangre` le gana a `ancho`.** Una foto a borde-a-borde saltea el
//      `pad()`, así que ahí un ancho no significa nada. El editor limpia la
//      clave al prender el checkbox, pero el freno de verdad va en el renderer:
//      un Json editado a mano tiene que salir igual.
//   5. **El clamp vive en el renderer.** `sanearBloque` deja pasar las claves
//      que no conoce y para un documento ya en la versión actual `esActual()` ni
//      lo corre, así que un `ancho: 9999` llega entero hasta acá.
import { renderEmailHtml } from "../lib/email/render";
import { V_ACTUAL } from "../lib/email/esquema";
import type { Bloque, ContenidoCampania } from "../lib/email/bloques";

let fallos = 0;
function ok(cond: boolean, que: string, detalle = "") {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    console.log(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
    fallos++;
  }
}

const OPTS = { unsubscribeUrl: "https://x/baja", nombreCuenta: "BDI" };
const URL_FOTO = "https://ejemplo.com/foto.jpg";

/**
 * `V_ACTUAL` y no un documento pelado: sin `v`, `leerContenido` migra y
 * materializa un encabezado, y estaríamos midiendo otro mail.
 */
const html = (b: Record<string, unknown>, estilos?: unknown): string =>
  renderEmailHtml(
    { v: V_ACTUAL, bloques: [{ tipo: "imagen", url: URL_FOTO, ...b } as unknown as Bloque], estilos } as ContenidoCampania,
    OPTS,
  );

/** El `<img>` del bloque, aislado del resto del mail (el logo no tiene esta url). */
const laFoto = (h: string): string => h.match(new RegExp(`<img[^>]*${URL_FOTO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^>]*>`))?.[0] ?? "";

console.log("\n1. Sin ancho ni alineación, el HTML no se movió");
{
  const base = html({});
  ok(base.includes("display:block"), "la foto sigue siendo un bloque");
  // ⚠️ Se mide sobre el `<img>` del bloque y no sobre el mail entero: el shell
  // trae sus propios `width="600"` y un `text-align:center` en el pie, así que
  // un `includes` pelado sobre el HTML completo mide otra cosa.
  ok(!laFoto(base).includes('width="'), "no aparece un atributo width que antes no estaba", laFoto(base));
  ok(laFoto(base).includes("margin:8px 0 16px"), "el margen sigue en el propio <img>");
  ok(!base.includes("margin:8px 0 16px;text-align:"), "no se emite ningún <div> de alineación de más");
}

console.log("\n2. Con ancho, píxeles y atributo (lo único que entiende Outlook)");
{
  // 600 de ancho de mail − 32 de padding de cada lado = 536 útiles. Al 50%, 268.
  const h = html({ ancho: 50 });
  ok(h.includes('width="268"'), "el atributo dice 268", laFoto(h));
  ok(h.includes("width:268px"), "y el inline también", laFoto(h));
  ok(h.includes("display:inline-block"), "la foto pasa a inline-block para poder alinearse");
  ok(h.includes("margin:8px 0 16px;text-align:left"), "el margen se mudó al contenedor");
  ok(!laFoto(h).includes("margin:"), "y no quedó duplicado en el <img>", laFoto(h));
}

console.log("\n3. La alineación");
{
  ok(html({ ancho: 50, align: "center" }).includes("text-align:center"), "centro");
  ok(html({ ancho: 50, align: "right" }).includes("text-align:right"), "derecha");
  // Sin ancho: la foto sale a su tamaño natural y lo único que se pide es dónde
  // queda. Es lo que se puede hacer con una foto más angosta que la tarjeta.
  const solo = html({ align: "center" });
  ok(solo.includes("text-align:center"), "alinear sin escalar también dibuja el contenedor");
  ok(!laFoto(solo).includes('width="'), "y no le inventa un ancho a la foto", laFoto(solo));
}

console.log("\n4. `sangre` le gana a `ancho`");
{
  const h = html({ ancho: 33, align: "center", sangre: true });
  ok(laFoto(h).includes('width="100%"'), "sale a borde-a-borde, como si el ancho no estuviera", laFoto(h));
  ok(!h.includes("margin:8px 0 16px;text-align:"), "y sin contenedor de alineación");
  ok(!h.includes("width:177px"), "el 33% no se dibujó en ninguna parte");
}

console.log("\n5. El clamp, que es lo único que frena un Json editado a mano");
{
  ok(html({ ancho: 9999 }).includes('width="536"'), "9999% se acota al ancho útil entero");
  ok(html({ ancho: -5 }).includes('width="134"'), "un negativo cae al mínimo de 25%");
  ok(html({ ancho: 50.4 }).includes('width="268"'), "un decimal se redondea");
}

console.log("\n6. El ancho útil NO está cableado en 600");
{
  // El padding lateral es una perilla del panel (`caja.padX`). Con 0, el ancho
  // útil es el del mail entero: si el cálculo estuviera clavado, esto daría 268.
  const h = html({ ancho: 50 }, { caja: { padX: 0 } });
  ok(h.includes('width="300"'), "con padX 0, el 50% son 300 y no 268", laFoto(h));
}

console.log(fallos === 0 ? "\n✅ La foto escala y se alinea\n" : `\n❌ ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);
