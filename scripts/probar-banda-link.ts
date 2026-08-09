// Una banda con foto (`hero` / `seccion`) puede ser ella misma el link.
//
//   node --import tsx scripts/probar-banda-link.ts
//
// 🔴 **Por qué existe la feature**: hasta el 9-ago-2026 el motor no tenía
// NINGUNA forma de hacer clickeable una foto. El `hero` sólo emitía un `<a>` por
// su botón, y el bloque `imagen` no emite ninguno (su `url` es el `src`, no un
// destino). Se pagó medido: el T01 de BDI salió con 350 px de foto arriba de
// todo, la abrieron 141 personas, tocarla no hacía nada, y el CTOR fue 2,1%
// contra 5,9% de la campaña equivalente de Zattia.
//
// La combinación que lo activa es **`botonUrl` sin `botonTexto`**, que antes no
// significaba nada. Verificado contra prod ese mismo día: 0 casos en los 23
// documentos guardados. Por eso no hay campo nuevo, ni bump de `V_ACTUAL`, ni
// migración — y por eso el golden no se mueve.
//
// Las dos invariantes que este archivo cuida, y que no son "que ande":
//   1. **Nunca un `<a>` adentro de otro.** Si la banda tiene botón, la banda no
//      es link. Un ancla anidada la resuelve cada cliente de mail a su manera y
//      el click se pierde justo en el mail que se quería arreglar.
//   2. **El esquema de la URL se filtra acá, en el emisor.** `esActual()` deja
//      pasar los documentos por el camino rápido sin re-sanear, así que un
//      `javascript:` que sólo estuviera filtrado en el saneo saldría entero.
//      Misma doctrina que los trozos de texto rico.
import { renderEmailHtml, renderEmailTexto } from "../lib/email/render";
import { inyectarTracking } from "../lib/email/tracking";
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
// `V_ACTUAL` y no un documento pelado: sin `v`, `leerContenido` migra y
// materializa un encabezado, y estaríamos midiendo otro mail.
const doc = (bloques: Bloque[]): ContenidoCampania => ({ v: V_ACTUAL, bloques } as ContenidoCampania);
const html = (bloques: Bloque[]) => renderEmailHtml(doc(bloques), OPTS);
const texto = (bloques: Bloque[]) => renderEmailTexto(doc(bloques), OPTS);

const FOTO = "https://ejemplo.test/portada.jpg";
const DESTINO = "https://bdiaccesorios.com.ar/fundas/girlhood-collection/";

/** El `<div>`/`<a>` de la rama no-Outlook: el que lleva el `background-image`. */
const banda = (h: string) => /<(a|div)([^>]*background-image[^>]*)>/.exec(h);

/** Los dos bloques que comparten `bandaConFoto`. Lo que vale para uno vale para el otro. */
const BANDAS: { que: string; con: (extra: Record<string, unknown>) => Bloque }[] = [
  { que: "hero", con: (x) => ({ tipo: "hero", fondoImagen: FOTO, titulo: "", subtitulo: "", ...x } as Bloque) },
  { que: "seccion", con: (x) => ({ tipo: "seccion", fondoImagen: FOTO, titulo: "", texto: "", ...x } as Bloque) },
];

console.log("\n1) `botonUrl` sin `botonTexto` ⇒ la banda entera es el link");
for (const { que, con } of BANDAS) {
  const h = html([con({ botonUrl: DESTINO })]);
  const m = banda(h);
  ok(m?.[1] === "a", `${que}: la banda es un <a>, no un <div>`, `abre con: ${m?.[0]?.slice(0, 90)}`);
  ok(h.includes(`href="${DESTINO}"`), `${que}: el href es el destino pedido`);
  // Una `<a>` inline no toma el `min-height`: sería un link del alto de una
  // línea sobre una foto de 350 px. Parece clickeable toda y responde una franja.
  ok(/<a[^>]*display:block/.test(h), `${que}: va display:block, así que la foto entera responde`);
  ok(/<a[^>]*text-decoration:none/.test(h), `${que}: sin subrayado (lo heredarían el título y la bajada)`);
  // Outlook no entiende `background-image` en un div y va por su propio camino.
  ok(/<v:rect[^>]*href="/.test(h), `${que}: el <v:rect> de Outlook también lleva el destino`);
  ok(h.includes("</a>"), `${que}: el ancla cierra`);
}

console.log("\n2) 🔴 Con botón, la banda NO es link: jamás un <a> adentro de otro");
for (const { que, con } of BANDAS) {
  const h = html([con({ botonTexto: "Ver la colección", botonUrl: DESTINO })]);
  const m = banda(h);
  ok(m?.[1] === "div", `${que}: con botón, la banda vuelve a ser un <div>`, `abre con: ${m?.[0]?.slice(0, 90)}`);
  ok(h.includes(">Ver la colección</a>"), `${que}: el botón sigue siendo el ancla`);
  // La prueba de que no hay anidamiento: adentro de la banda hay exactamente
  // un `<a>`, el del botón.
  //
  // ⚠️ El corte va hasta el `<!--<![endif]-->` que cierra la rama no-Outlook, no
  // hasta el final del HTML: el pie lleva el link de baja en el 100% de los
  // renders y contarlo daba dos anclas con el código bien.
  const desde = h.indexOf(m![0]);
  const banda2 = h.slice(desde, h.indexOf("<!--<![endif]-->", desde));
  ok((banda2.match(/<a\s/g) ?? []).length === 1, `${que}: un solo <a> en la banda`,
    `anclas encontradas: ${(banda2.match(/<a\s[^>]*/g) ?? []).join(" | ").slice(0, 160)}`);
}

console.log("\n3) 🔴 El esquema de la URL se filtra en el emisor");
const VENENOS = ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox"];
for (const { que, con } of BANDAS) {
  for (const v of VENENOS) {
    const h = html([con({ botonUrl: v })]);
    ok(banda(h)?.[1] === "div", `${que}: \`${v.slice(0, 22)}…\` no produce link`);
    ok(!h.includes(v), `${que}: \`${v.slice(0, 22)}…\` no aparece en el HTML`);
  }
}

console.log("\n4) Lo que no cambió: sin `botonUrl` sale como salía");
for (const { que, con } of BANDAS) {
  const h = html([con({})]);
  ok(banda(h)?.[1] === "div", `${que}: sin URL, la banda es un <div>`);
  ok(!/<v:rect[^>]*href="/.test(h), `${que}: sin URL, el <v:rect> no lleva href`);
  // Sin foto no hay banda: el camino es otro y `botonUrl` solo sigue sin hacer nada.
  const sinFoto = html([{ tipo: que, titulo: "T", botonUrl: DESTINO } as Bloque]);
  ok(!sinFoto.includes(`href="${DESTINO}"`), `${que} sin foto: \`botonUrl\` solo sigue sin dibujar nada`);
}

console.log("\n5) La versión de texto no se queda sin destino");
for (const { que, con } of BANDAS) {
  const t = texto([con({ botonUrl: DESTINO })]);
  ok(t.includes(DESTINO), `${que}: la URL pelada aparece en el text/plain`);
  const conBoton = texto([con({ botonTexto: "Ver la colección", botonUrl: DESTINO })]);
  ok(conBoton.includes(`Ver la colección: ${DESTINO}`), `${que}: con botón sigue saliendo "texto: url"`);
  ok((conBoton.match(new RegExp(DESTINO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length === 1,
    `${que}: con botón la URL no sale dos veces`);
}

console.log("\n6) El link de la banda pasa por el tracking de clicks");
// Es lo que hace que el arreglo se pueda MEDIR. Un click que no se registra
// deja el CTOR igual de bajo y la conclusión sería que la foto tampoco tira.
for (const { que, con } of BANDAS) {
  const h = inyectarTracking(html([con({ botonUrl: DESTINO })]), "envio1", "https://app.test");
  ok(h.includes(`https://app.test/api/track/click/envio1?u=${encodeURIComponent(DESTINO)}`),
    `${que}: el ancla de la banda queda reescrita al redirect`);
  // El `<v:rect>` no lo matchea el regex del tracking (mira `a` y `v:roundrect`),
  // así que el click desde Outlook de escritorio NO se mide. Se deja anotado
  // como límite conocido, no como falla: el destino igual funciona.
  ok(h.includes(`<v:rect xmlns:v="urn:schemas-microsoft-com:vml" href="${DESTINO}"`),
    `${que}: ⚠️ el <v:rect> lleva la URL cruda — el click desde Outlook de escritorio no se mide`);
}

console.log(fallos === 0 ? "\n✅ todo en verde\n" : `\n❌ ${fallos} fallas\n`);
process.exit(fallos === 0 ? 0 : 1);
