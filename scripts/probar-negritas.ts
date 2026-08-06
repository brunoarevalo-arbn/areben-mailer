// La negrita inline: `**palabra**` → `<strong>palabra</strong>`.
//
//   node --import tsx scripts/probar-negritas.ts
//
// 🔴 **La invariante que importa no es que la negrita ande, es el ORDEN.**
// `negritas()` recibe texto que ya pasó por `esc()`, así que los únicos `<` y
// `>` que quedan en la salida son los `<strong>` que emite el motor. Invertir
// ese orden —o agregar un llamador nuevo que no escape antes— convierte el
// campo de texto de una campaña en un XSS almacenado que se ejecuta en el panel
// de la marca y viaja a la casilla de cada destinatario. Por eso la sección 2
// es la mitad de este archivo.
//
// La otra mitad es el alcance: la negrita entra por `nl()`, y `nl()` lo llaman
// exactamente cuatro campos. Un `case` del renderer que empiece a llamarlo (o
// que deje de hacerlo) tiene que ponerse rojo acá.
import { renderEmailHtml, renderEmailTexto } from "../lib/email/render";
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

const OPTS = { unsubscribeUrl: "https://x/baja", nombreCuenta: "Zattia" };
// ⚠️ `V_ACTUAL` y no un documento pelado: sin `v`, `leerContenido` migra y
// materializa un encabezado, y estaríamos midiendo otro mail.
const doc = (bloques: Bloque[]): ContenidoCampania => ({ v: V_ACTUAL, bloques } as ContenidoCampania);
const html = (bloques: Bloque[]) => renderEmailHtml(doc(bloques), OPTS);
const texto = (bloques: Bloque[]) => renderEmailTexto(doc(bloques), OPTS);

/** Los cuatro campos que admiten negrita, cada uno en su bloque. */
const CAMPOS: { que: string; con: (s: string) => Bloque }[] = [
  { que: "el bloque `texto`", con: (s) => ({ tipo: "texto", texto: s } as Bloque) },
  { que: "la bajada de `seccion`", con: (s) => ({ tipo: "seccion", titulo: "T", texto: s } as Bloque) },
  { que: "la bajada de `hero`", con: (s) => ({ tipo: "hero", titulo: "T", subtitulo: s } as Bloque) },
  {
    que: "el texto de una celda de `columnas`",
    con: (s) => ({ tipo: "columnas", variante: "texto", celdas: [{ titulo: "C", texto: s }] } as unknown as Bloque),
  },
];

console.log("\n1) Los cuatro campos que se escriben admiten negrita");
for (const { que, con } of CAMPOS) {
  const h = html([con("Solo hasta el **domingo**.")]);
  ok(h.includes("<strong>domingo</strong>"), `${que} emite <strong>`);
  ok(!h.includes("**"), `${que} no deja los asteriscos a la vista`);
}

console.log("\n2) 🔴 Escapar primero: el único tag de la salida es el nuestro");
// Cada uno de estos entró alguna vez a un motor de mails de verdad.
const VENENOS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "**<script>alert(1)</script>**",
  "<strong>ya venía en negrita</strong>",
];
for (const v of VENENOS) {
  const h = html([{ tipo: "texto", texto: v } as Bloque]);
  // ⚠️ La pregunta correcta NO es "¿aparece la cadena `onerror=`?": `esc()` no
  // escapa el `=` ni las comillas, así que `onerror=alert(1)` aparece igual
  // —como TEXTO inerte adentro de un `&lt;img …&gt;`— y buscarlo así daba un
  // rojo que no era un agujero. Lo que decide es si el `<` sobrevivió: sin él
  // no hay etiqueta, y sin etiqueta no hay atributo que ejecute nada.
  ok(!h.includes(v), `el veneno no sale verbatim: ${v}`);
  ok(h.includes(v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")),
    `…sale escapado, con el <strong> como único tag nuestro: ${v}`);
}
// El caso que prueba el ORDEN y no solo el escapado: los asteriscos son
// nuestros y el tag de adentro es del atacante. Tiene que quedar UN `<strong>`
// (el que emitimos) con el `<script>` inerte adentro.
const mixto = html([{ tipo: "texto", texto: "**<script>x</script>**" } as Bloque]);
ok(
  mixto.includes("<strong>&lt;script&gt;x&lt;/script&gt;</strong>"),
  "con `**<script>…</script>**` el <strong> es nuestro y el script queda inerte",
  mixto.slice(mixto.indexOf("<strong>"), mixto.indexOf("</strong>") + 9),
);

console.log("\n3) Lo que NO es un pedido de negrita queda literal");
const literales: [string, string][] = [
  ["Cuesta 2 ** 3", "un `**` suelto"],
  ["Esto **no cierra", "un `**` sin cerrar"],
  ["**", "dos asteriscos pelados"],
  ["****", "cuatro asteriscos (nada adentro)"],
  ["**\nhola\n**", "un `**` que cruza renglones"],
];
for (const [entrada, que] of literales) {
  const h = html([{ tipo: "texto", texto: entrada } as Bloque]);
  ok(!h.includes("<strong>"), `${que} no emite <strong>`);
}
// Dos negritas en un renglón son dos, no una sola que se come el medio.
const dos = html([{ tipo: "texto", texto: "**uno** y **dos**" } as Bloque]);
ok(
  (dos.match(/<strong>/g) ?? []).length === 2 && dos.includes("</strong> y <strong>"),
  "`**uno** y **dos**` da DOS negritas (el patrón es perezoso)",
);

console.log("\n4) El alcance: los títulos quedan afuera a propósito");
// Van por `esc()` pelado. Si alguien los pasa a `nl()` sin decidirlo, acá se ve.
const conTitulo = html([{ tipo: "titulo", texto: "Un **título**" } as Bloque]);
ok(!conTitulo.includes("<strong>"), "el bloque `titulo` NO interpreta negritas");
ok(conTitulo.includes("**título**"), "…y deja los asteriscos como se escribieron");
const heroTit = html([{ tipo: "hero", titulo: "Un **título**", subtitulo: "" } as Bloque]);
ok(!heroTit.includes("<strong>"), "el título de `hero` tampoco");

console.log("\n5) 🔴 La parte text/plain sale SIN los asteriscos");
// Va en cada envío y es una de las señales que mira el filtro: un cuerpo que
// dice "**Solo hasta el domingo**" se lee como marcado, no como énfasis.
for (const { que, con } of CAMPOS) {
  const t = texto([con("Solo hasta el **domingo**.")]);
  ok(!t.includes("**"), `${que} no deja asteriscos en el texto plano`);
  ok(t.includes("domingo"), `${que} sí conserva la palabra`);
}

console.log("\n6) Un mail sin negritas sale EXACTAMENTE igual que antes");
// La red que protege a las 38 plantillas ya publicadas: si esto cambiara, el
// golden se movería sin que nadie lo pidiera.
const sinNada = "Un texto normal, con & y < adentro.";
const h1 = html([{ tipo: "texto", texto: sinNada } as Bloque]);
ok(h1.includes("Un texto normal, con &amp; y &lt; adentro."), "el escapado de siempre no cambió");
ok(!h1.includes("<strong>"), "y no aparece ningún <strong> de la nada");
// El salto de línea sigue siendo un <br>, que es lo que `nl()` hacía antes.
ok(html([{ tipo: "texto", texto: "a\nb" } as Bloque]).includes("a<br>b"), "el \\n sigue saliendo <br>");

console.log("\n7) 🔴 Adentro de un TROZO, `**` no es marcado: son dos asteriscos");
// El texto rico y `**negrita**` son dos vocabularios distintos y no se mezclan.
// Un `string` interpreta los asteriscos; un `Trozo[]` los deja literales, porque
// ahí la negrita se pide con `peso` y no con sintaxis. Es la única asimetría del
// diseño, y `canonizar()` la respeta negándose a colapsar un trozo que los
// tenga: si colapsara, aparecería un <strong> que nadie pidió.
{
  const conTrozo = html([{ tipo: "texto", texto: [{ t: "Solo hasta el **domingo**." }] } as Bloque]);
  ok(!conTrozo.includes("<strong>"), "un trozo con `**` no emite <strong>");
  ok(conTrozo.includes("**domingo**"), "y los asteriscos salen a la vista");

  const negritaDeVerdad = html([{ tipo: "texto", texto: [{ t: "Solo hasta el " }, { t: "domingo", peso: 700 }] } as Bloque]);
  ok(negritaDeVerdad.includes('<span style="font-weight:700">domingo</span>'), "la negrita del trozo va por `peso`");

  const plano = texto([{ tipo: "texto", texto: [{ t: "Solo hasta el " }, { t: "domingo", peso: 700 }] } as Bloque]);
  ok(plano.includes("Solo hasta el domingo") && !plano.includes("<span"), "el texto plano de un trozo es la concatenación");
}

console.log(fallos === 0 ? "\n✅ Negritas OK" : `\n❌ ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
