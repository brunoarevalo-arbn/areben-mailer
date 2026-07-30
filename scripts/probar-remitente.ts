// Invariante única y no negociable: **una marca sin remitente propio no manda**.
//
//   node --import tsx scripts/probar-remitente.ts
//
// Puro: no toca la base ni la red.
//
// Por qué existe. Hasta el 30-jul-2026 `armarFrom()` caía a `SES_FROM_EMAIL`
// cuando la marca no tenía fila en `Remitente`. Esa env es **una sola para todo
// el proyecto** y valía `info@bdiaccesorios.com.ar`, así que un mail de Stunned
// o de Resorty Lab habría salido firmado por BDI Accesorios. No fallaba: salía
// mal, que es el modo de falla peor, porque nadie se entera hasta que lo recibe
// un cliente de otra marca.
//
// Es el mismo criterio que ya rige en `presets.ts` (un preset no hornea el
// nombre de una marca) y en el bloque `encabezado` (`texto` vacío = el nombre de
// la cuenta, resuelto al renderizar). Ningún dato de una marca es el default de
// otra.
import { armarFrom, EmailError, MSG_SIN_REMITENTE } from "../lib/email/proveedor";

let fallas = 0;
let corridas = 0;

function ok(cond: boolean, que: string) {
  corridas++;
  if (cond) return;
  fallas++;
  console.error(`  ✗ ${que}`);
}

function tira(fn: () => unknown, que: string) {
  corridas++;
  try {
    fn();
    fallas++;
    console.error(`  ✗ ${que} — no tiró`);
  } catch (e) {
    if (e instanceof EmailError) return;
    fallas++;
    console.error(`  ✗ ${que} — tiró ${(e as Error).name}, se esperaba EmailError`);
  }
}

const base = { to: "alguien@ejemplo.com", subject: "x", html: "<p>x</p>" };

console.log("\n  Remitente propio o no se manda\n");

// ── Lo que tiene que salir bien ─────────────────────────────────────────────
const con = armarFrom({ ...base, fromEmail: "info@zattia.com.ar", fromName: "Zattia" });
ok(con.email === "info@zattia.com.ar", "usa el email de la marca");
ok(con.nombre === "Zattia", "usa el nombre de la marca");

const sinNombre = armarFrom({ ...base, fromEmail: "info@zattia.com.ar" });
ok(sinNombre.nombre === "", "sin nombre cargado, el nombre queda vacío (no hereda otro)");

// ── Lo que NO puede salir ───────────────────────────────────────────────────
tira(() => armarFrom({ ...base }), "sin fromEmail no manda");
tira(() => armarFrom({ ...base, fromEmail: "" }), "fromEmail vacío no manda");
tira(() => armarFrom({ ...base, fromEmail: "   " }), "fromEmail en blanco no manda");
tira(() => armarFrom({ ...base, fromEmail: undefined }), "fromEmail undefined no manda");

// El corazón del asunto: con la env global puesta, el resultado NO cambia.
// Si alguien reintrodujera el fallback, este bloque se pone rojo.
const guardadoEmail = process.env.SES_FROM_EMAIL;
const guardadoNombre = process.env.SES_FROM_NAME;
process.env.SES_FROM_EMAIL = "info@bdiaccesorios.com.ar";
process.env.SES_FROM_NAME = "BDI Accesorios";
tira(
  () => armarFrom({ ...base }),
  "🔴 con SES_FROM_EMAIL cargada, una marca sin remitente SIGUE sin poder mandar",
);
const otra = armarFrom({ ...base, fromEmail: "hola@stunned.com.ar", fromName: "Stunned" });
ok(otra.email === "hola@stunned.com.ar", "la env global no le pisa el remitente a la marca");
ok(otra.nombre === "Stunned", "la env global no le pisa el nombre a la marca");
if (guardadoEmail === undefined) delete process.env.SES_FROM_EMAIL;
else process.env.SES_FROM_EMAIL = guardadoEmail;
if (guardadoNombre === undefined) delete process.env.SES_FROM_NAME;
else process.env.SES_FROM_NAME = guardadoNombre;

// El mensaje tiene que decir dónde se arregla: es lo que ve quien aprieta enviar.
ok(MSG_SIN_REMITENTE.includes("/remitentes"), "el mensaje dice dónde cargarlo");

console.log(
  fallas === 0
    ? `\n  ✓ ${corridas} invariantes\n`
    : `\n  ✗ ${fallas} de ${corridas} fallaron\n`,
);
process.exit(fallas === 0 ? 0 : 1);
