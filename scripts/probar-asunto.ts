// Los merge tags del ASUNTO.
//
//   node --import tsx scripts/probar-asunto.ts
//
// 🔴 LA INVARIANTE QUE CUSTODIA: **el asunto resuelve los mismos tags que el
// cuerpo.** Hasta el 29-ago-2026 no lo hacía —ni la cola de campañas ni el
// procesador de automations— mientras el editor los ofrece abajo y los explica
// en su hint. Escribir `${contacto.primerNombre}` en el asunto, que es lo primero
// que intenta cualquiera que lo vio andar en el cuerpo, mandaba el literal a
// TODA la lista, en la única línea que se lee antes de abrir y sin arreglo
// después de enviado. No falla, no avisa: simplemente sale mal.
import { aplicarMergeTags, aplicarMergeTagsAsunto } from "../lib/email/render.ts";

let ok = 0, mal = 0;
const chk = (nombre: string, cond: unknown, extra = "") => {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { mal++; console.error(`  ✗ ${nombre}${extra ? `\n      ${extra}` : ""}`); }
};
const titulo = (s: string) => console.log(`\n${s}`);

const franca = { nombre: "Franca Sotelo", email: "franca@ejemplo.com" };

titulo("Resuelve los mismos tres tags que el cuerpo");
{
  chk(
    "el primer nombre",
    aplicarMergeTagsAsunto("${contacto.primerNombre}, última llamada", franca) === "Franca, última llamada",
    aplicarMergeTagsAsunto("${contacto.primerNombre}, última llamada", franca),
  );
  chk("el nombre completo", aplicarMergeTagsAsunto("Hola ${contacto.nombre}", franca) === "Hola Franca Sotelo");
  chk("el mail", aplicarMergeTagsAsunto("${contacto.email}", franca) === "franca@ejemplo.com");
  // 🔴 El oráculo de fondo: NO puede resolver distinto que el cuerpo. Dos
  // implementaciones que se separan es cómo el asunto dice "Hola Franca" arriba
  // de un mail que adentro dice "Hola Franca Sotelo".
  for (const t of ["${contacto.primerNombre}", "${contacto.nombre}", "${contacto.email}", "sin tags"]) {
    chk(`resuelve igual que el cuerpo: ${t}`, aplicarMergeTagsAsunto(t, franca) === aplicarMergeTags(t, franca));
  }
}

titulo("🔴 Sin nombre no queda un saludo colgando ni un literal");
{
  const anon = { nombre: null, email: "x@ejemplo.com" };
  const r = aplicarMergeTagsAsunto("${contacto.primerNombre}, última llamada", anon);
  chk("el tag desaparece", !r.includes("${"), r);
  chk("y no queda el literal 'contacto'", !r.includes("contacto"), r);
  // Queda ", última llamada" — feo, pero es el mismo comportamiento que el
  // cuerpo, y arreglarlo acá y no allá sería peor: dos reglas para lo mismo.
  chk("y se recorta el borde", !r.startsWith(" ") && !r.endsWith(" "), JSON.stringify(r));
}

titulo("🔴 Un salto de línea NO puede partir la cabecera");
{
  // El asunto es una CABECERA del correo. Un `\r\n` adentro del nombre la
  // partiría en dos y lo que siguiera se leería como otra cabecera — el nombre
  // lo escribe quien compra, así que esto no puede depender de la buena fe.
  const feo = { nombre: "Ana\r\nBcc: otro@ejemplo.com", email: "a@ejemplo.com" };
  const r = aplicarMergeTagsAsunto("Hola ${contacto.nombre}", feo);
  chk("no queda ningún salto de línea", !/[\r\n]/.test(r), JSON.stringify(r));
  chk("ni una tabulación", !/\t/.test(r));
  chk("el texto sigue estando, en una sola línea", r.includes("Ana") && r.includes("Bcc"), r);
  // Y el cuerpo NO se toca: ahí un salto es texto y nada más.
  chk("el cuerpo sigue dejando pasar el salto", /[\r\n]/.test(aplicarMergeTags("Hola ${contacto.nombre}", feo)));
}

titulo("Un asunto sin tags sale exactamente igual");
{
  const a = "Última llamada para tu carrito 🛒";
  chk("byte por byte", aplicarMergeTagsAsunto(a, franca) === a, aplicarMergeTagsAsunto(a, franca));
}

console.log(`\n${mal === 0 ? "✅ Asunto OK" : `❌ ${mal} fallas`} · ${ok} comprobaciones`);
process.exit(mal === 0 ? 0 : 1);
