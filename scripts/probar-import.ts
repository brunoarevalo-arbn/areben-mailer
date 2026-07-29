// La importación de contactos desde un export de Perfit. Lógica pura: sin base,
// sin red, sin archivos.
//
//   node --import tsx scripts/probar-import.ts
//
// Cuatro cosas que tienen que ser ciertas para que el import no queme el dominio:
//
//   1. **La supresión es de una sola vía.** Un mail que aparece como baja o
//      rebote en cualquier archivo queda suprimido aunque también esté en la
//      lista de altas, y aunque en la base figure ACTIVO. Nunca al revés: un
//      contacto ya suprimido no revive por aparecer en un CSV. Es lo único que
//      frena a los 613 rebotados que hoy están ACTIVO en la base porque los
//      trajo Tiendanube.
//   2. **El consentimiento sale de la pertenencia al archivo, no del campo.**
//      `tn_accepts_marketing` es el espejo del casillero de Tiendanube y viene
//      `false` o vacío para gente que sí se anotó en el pop-up de Nuby. Los 98
//      que compraron sin tildar pero se anotaron después tienen que quedar en
//      `true`; los 1.379 que solo dijeron "no" en el checkout, en `false`.
//   3. **Los archivos son Latin-1.** Si se leen como UTF-8, "Ludueña" entra roto
//      a la base y sale roto en el mail.
//   4. **La misma persona repetida es una sola.** El export de bajas trae un
//      registro por EVENTO, así que la misma casilla aparece dos veces; y 870
//      mails están en Nuby y en compradores a la vez.

import {
  boolDeArchivo,
  claveHeader,
  esSuprimido,
  estadoDeFila,
  fechaDeArchivo,
  lotes,
  masSevero,
  normalizarEmail,
  parsearCsv,
  resolverImport,
  type ArchivoImport,
} from "../lib/contactos/importar";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

/** Arma un CSV en Latin-1 como los que exporta Perfit. */
const csvLatin1 = (headers: string[], filas: string[][]): Buffer =>
  Buffer.from([headers.join(";"), ...filas.map((f) => f.join(";"))].join("\r\n"), "latin1");

const HEADERS = [
  "Email", "Nombre", "Apellido", "Género", "Idioma", "Estado", "Calidad", "Fuente",
  "Creado", "Modificado", "Ultimo envío", "Ultima actividad", "Cumpleaños (DD/MM)",
  "nuby_discount_code", "nuby_prize", "nuby_req_product_id", "nuby_req_variant_id",
  "tn_accepts_marketing", "tn_total_gastado", "tn_ultima_compra", "Intereses",
];

/** Una fila con los campos que importan; el resto vacío. */
function fila(o: {
  email: string; nombre?: string; estado?: string; aceptaTn?: string;
  actividad?: string; gastado?: string; compra?: string;
}): string[] {
  const f = new Array(HEADERS.length).fill("");
  f[0] = o.email;
  f[1] = o.nombre ?? "";
  f[5] = o.estado ?? "ACTIVE";
  f[11] = o.actividad ?? "";
  f[17] = o.aceptaTn ?? "";
  f[18] = o.gastado ?? "";
  f[19] = o.compra ?? "";
  return f;
}

const archivo = (nombre: string, filas: string[][], optin: boolean): ArchivoImport => ({
  nombre,
  filas: parsearCsv(csvLatin1(HEADERS, filas)).filas,
  optin,
});

// ─────────────────────────────────────────────────────────────
titulo("1. Latin-1: los acentos sobreviven");
{
  const { headers, filas } = parsearCsv(csvLatin1(HEADERS, [fila({ email: "a@x.com", nombre: "Ludueña" })]));
  ok(headers.includes("Género"), "el header con acento se decodifica", headers.join(" | "));
  ok(filas[0].nombre === "Ludueña", "el nombre con ñ llega entero", `salió "${filas[0].nombre}"`);
  ok(filas[0].ultima_actividad === "", "una columna vacía es string vacío, no undefined");

  // El mismo buffer leído como UTF-8 es exactamente el bug que esto evita.
  const roto = csvLatin1(HEADERS, [fila({ email: "a@x.com", nombre: "Ludueña" })]).toString("utf8");
  ok(!roto.includes("Ludueña"), "leerlo como UTF-8 sí lo rompe (por eso la firma toma Buffer)");
}

titulo("2. claveHeader: la columna se busca por nombre, no por posición");
{
  ok(claveHeader("Ultima actividad") === "ultima_actividad", "espacios → _");
  ok(claveHeader("Acción") === "accion", "los acentos se van");
  ok(claveHeader("Cumpleaños (DD/MM)") === "cumpleanos_dd_mm", "paréntesis y barra → _, sin cola");
  ok(claveHeader("tn_accepts_marketing") === "tn_accepts_marketing", "lo que ya está normalizado no cambia");
}

titulo("3. El archivo de bajas tiene otras columnas y no rompe el mapeo");
{
  // Este export agrega Acción y Fecha Acción ADELANTE: por posición, "Email"
  // caería en la columna del nombre.
  const headers = ["Acción", "Fecha Acción", ...HEADERS, "url"];
  const f = new Array(headers.length).fill("");
  f[0] = "UNSUBSCRIBE";
  f[1] = "2026-05-10T00:35:06.000+0000";
  f[2] = "baja@x.com";
  f[7] = "UNSUBSCRIBED";
  const { filas } = parsearCsv(csvLatin1(headers, [f]));
  ok(filas[0].email === "baja@x.com", "el email se encuentra igual", JSON.stringify(filas[0].email));
  ok(estadoDeFila(filas[0]) === "BAJA", "y el estado sale BAJA");
}

titulo("4. normalizarEmail");
{
  ok(normalizarEmail("  A@X.COM ") === "a@x.com", "trim y minúsculas");
  ok(normalizarEmail("pepe@@gmail.com") === null, "doble arroba es inválido");
  ok(normalizarEmail("pepe") === null, "sin arroba es inválido");
  ok(normalizarEmail("pepe@gmail") === null, "sin TLD es inválido");
  ok(normalizarEmail("") === null, "vacío es inválido");
  ok(normalizarEmail(`${"a".repeat(250)}@x.com`) === null, "más de 254 es inválido");
  // ⚠️ Un typo de dominio SÍ pasa: la regex no sabe si el dominio existe. Eso lo
  // resuelve el chequeo de MX que va en la captura de Resorty, no acá.
  ok(normalizarEmail("pepe@gmial.com") === "pepe@gmial.com", "un dominio con typo pasa (lo agarra el MX check, no la regex)");
}

titulo("5. Precedencia: cualquier supresión le gana a ACTIVO");
{
  ok(masSevero("ACTIVO", "BAJA") === "BAJA", "baja > activo");
  ok(masSevero("BAJA", "ACTIVO") === "BAJA", "y en el orden inverso también");
  ok(masSevero("BAJA", "REBOTADO") === "REBOTADO", "rebote > baja");
  ok(masSevero("REBOTADO", "SPAM") === "SPAM", "queja > rebote");
  ok(masSevero("SPAM", "ACTIVO") === "SPAM", "activo nunca gana");
  ok(!esSuprimido("ACTIVO") && esSuprimido("BAJA") && esSuprimido("REBOTADO") && esSuprimido("SPAM"),
    "los tres no-ACTIVO son supresión");
}

titulo("6. Un mail en altas y en bajas queda suprimido (one-way entre archivos)");
{
  const r = resolverImport([
    archivo("nuby", [fila({ email: "dos@x.com", estado: "ACTIVE" }), fila({ email: "sano@x.com" })], true),
    archivo("compradores", [fila({ email: "dos@x.com", estado: "BOUNCED" })], false),
  ]);
  ok(r.contactos.get("dos@x.com")!.estado === "REBOTADO",
    "el que está ACTIVE en nuby y BOUNCED en compradores queda REBOTADO");
  ok(r.contactos.get("sano@x.com")!.estado === "ACTIVO", "el que no aparece suprimido sigue activo");
  ok(r.contactos.size === 2, "y son dos contactos, no tres", `size=${r.contactos.size}`);
  ok(r.filasDuplicadas === 1, "el repetido se cuenta como duplicado", `dup=${r.filasDuplicadas}`);

  // El orden de los archivos no puede cambiar el resultado.
  const inverso = resolverImport([
    archivo("compradores", [fila({ email: "dos@x.com", estado: "BOUNCED" })], false),
    archivo("nuby", [fila({ email: "dos@x.com", estado: "ACTIVE" })], true),
  ]);
  ok(inverso.contactos.get("dos@x.com")!.estado === "REBOTADO",
    "y da lo mismo en el orden inverso: el archivo de altas no lo revive");
}

titulo("7. La misma persona repetida DENTRO de un archivo es un solo contacto");
{
  // El export de bajas trae un registro por evento: la misma casilla dos veces.
  const r = resolverImport([
    archivo("bajas", [
      fila({ email: "evento@x.com", estado: "UNSUBSCRIBED" }),
      fila({ email: "evento@x.com", estado: "UNSUBSCRIBED" }),
    ], false),
  ]);
  ok(r.contactos.size === 1, "un solo contacto", `size=${r.contactos.size}`);
  ok(r.filasDuplicadas === 1, "y una fila contada como duplicada");
}

titulo("8. Consentimiento: la pertenencia al archivo de opt-in manda");
{
  const r = resolverImport([
    archivo("compradores", [
      fila({ email: "los98@x.com", aceptaTn: "false" }),   // compró sin tildar…
      fila({ email: "los1379@x.com", aceptaTn: "false" }), // …y no se anotó en ningún lado
      fila({ email: "tildo@x.com", aceptaTn: "true" }),
    ], false),
    // …pero después se anotó en el pop-up: estar en este archivo ES el opt-in.
    archivo("nuby", [
      fila({ email: "los98@x.com", aceptaTn: "false" }),
      fila({ email: "popup@x.com", aceptaTn: "" }),        // nunca compró: campo vacío
    ], true),
  ]);
  ok(r.contactos.get("los98@x.com")!.aceptaMkt === true,
    "el que compró sin tildar pero se anotó en el pop-up → true");
  ok(r.contactos.get("los1379@x.com")!.aceptaMkt === false, "el que solo dijo no en el checkout → false");
  ok(r.contactos.get("tildo@x.com")!.aceptaMkt === true, "el que tildó → true");
  ok(r.contactos.get("popup@x.com")!.aceptaMkt === true,
    "el suscriptor del pop-up con el campo VACÍO → true (si no, queda invisible para siempre)");
  ok(r.contactos.get("popup@x.com")!.enOptin === true, "y va a la lista de suscriptores");
  ok(r.contactos.get("tildo@x.com")!.enOptin === false, "el comprador que no está en nuby, no");
  ok(r.contactos.get("los1379@x.com")!.negoMktEnTn === true,
    "queda marcado que dijo no en TN, para poder contarlo en el dry-run");
}

titulo("9. Fechas y datos: gana la más reciente, y el primer valor no vacío");
{
  ok(fechaDeArchivo("") === null, "vacío → null");
  ok(fechaDeArchivo("no es una fecha") === null, "basura → null, no una fecha inventada");
  ok(fechaDeArchivo("2026-03-02")!.getUTCFullYear() === 2026, "fecha corta");
  ok(fechaDeArchivo("2026-04-23 03:00:05.0")!.getUTCHours() === 3,
    "el formato de Perfit sin T se lee como UTC");
  ok(fechaDeArchivo("2026-05-10T00:35:06.000+0000")!.getUTCMinutes() === 35, "el ISO con offset");

  const r = resolverImport([
    archivo("a", [fila({ email: "m@x.com", nombre: "", actividad: "2026-01-01" })], false),
    archivo("b", [fila({ email: "m@x.com", nombre: "Ana", actividad: "2026-06-15" })], false),
  ]);
  const c = r.contactos.get("m@x.com")!;
  ok(c.nombre === "Ana", "el nombre lo aporta el archivo que lo tiene", `nombre=${c.nombre}`);
  ok(c.ultimaActividad?.toISOString().startsWith("2026-06-15"),
    "y de dos actividades gana la más reciente", `${c.ultimaActividad?.toISOString()}`);
}

titulo("10. Inválidos y vacíos se descartan, con muestra");
{
  const r = resolverImport([
    archivo("sucio", [
      fila({ email: "bien@x.com" }),
      fila({ email: "malmail" }),
      fila({ email: "" }),
    ], false),
  ]);
  ok(r.contactos.size === 1, "solo entra el válido");
  ok(r.invalidos.length === 1 && r.invalidos[0] === "malmail",
    "el inválido queda con su texto para poder mostrarlo", JSON.stringify(r.invalidos));
  ok(r.filasSinEmail === 1, "la fila sin mail se cuenta aparte");
  ok(r.porArchivo[0].filas === 3 && r.porArchivo[0].validos === 1,
    "y el resumen por archivo cuadra", JSON.stringify(r.porArchivo[0]));
}

titulo("11. lotes()");
{
  ok(JSON.stringify(lotes([1, 2, 3, 4, 5], 2)) === "[[1,2],[3,4],[5]]", "parte en tandas");
  ok(lotes([], 1000).length === 0, "vacío no genera tandas");
  ok(lotes(new Array(2500).fill(0), 1000).length === 3, "2500 con CHUNK 1000 son 3 tandas");
}

titulo("12. boolDeArchivo: el vacío NO es un false");
{
  ok(boolDeArchivo("true") === true, "true");
  ok(boolDeArchivo("false") === false, "false");
  ok(boolDeArchivo("") === null, "vacío es null, no false");
  ok(boolDeArchivo(undefined) === null, "ausente es null");
}

console.log(fallas === 0 ? "\n✅ todo bien\n" : `\n❌ ${fallas} falla(s)\n`);
process.exit(fallas === 0 ? 0 : 1);
