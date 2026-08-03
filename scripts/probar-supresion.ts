// Una queja no cruza de tienda; un rebote duro sí. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-supresion.ts
//
// Por qué existe: hasta el 2-ago-2026 `aplicarSupresion` hacía un `updateMany`
// por email **sin `cuentaId`**, así que una queja contra un mail de Zattia
// marcaba `SPAM` al mismo contacto en BDI. La supresión es de **una sola vía**
// —no vuelve ni re-importando el CSV—, así que ese cruce no se arregla después:
// es un contacto de otro comerciante que se apaga para siempre.
//
// La asimetría que se fija acá (rebote global / queja por tienda / queja sin
// atribuir no se aplica) está argumentada en `lib/email/supresion-alcance.ts`.

import { decidirAlcance, normalizarEmails, type EnvioCasado } from "../lib/email/supresion-alcance";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const envio = (id: string, cuentaId: string, email: string): EnvioCasado => ({
  id,
  cuentaId,
  contactoId: `c-${cuentaId}-${email}`,
  email,
});

const ANA = "ana@gmail.com";
const ZATTIA = envio("e1", "cuenta-zattia", ANA);

titulo("Una queja se queda en la tienda que mandó el mail");
{
  const a = decidirAlcance("QUEJA", [ANA], [ZATTIA]);
  ok(a.emailsGlobales.length === 0, "no toca a nadie por email suelto");
  ok(
    a.contactoIds.length === 1 && a.contactoIds[0] === ZATTIA.contactoId,
    "marca al contacto de ESE envío",
    JSON.stringify(a.contactoIds),
  );
  ok(a.envioIds.join() === "e1", "marca el envío casado");
  ok(a.cuentaIds.join() === "cuenta-zattia", "declara una sola cuenta alcanzada");
  ok(a.sinAtribuir.length === 0, "no queda nada sin atribuir");
}

titulo("La misma persona en otra tienda NO se toca");
{
  // El mismo email existe como contacto en BDI: es lo que pasaba de verdad, y
  // el `updateMany` por email lo apagaba también.
  const a = decidirAlcance("QUEJA", [ANA], [ZATTIA]);
  ok(!a.cuentaIds.includes("cuenta-bdi"), "BDI no aparece en el alcance");
  ok(
    a.emailsGlobales.length === 0 && a.contactoIds.every((id) => id.includes("cuenta-zattia")),
    "todo lo que se marca cuelga de la cuenta que envió",
  );
}

titulo("Una queja que no se puede atribuir no se aplica");
{
  const a = decidirAlcance("QUEJA", [ANA], []); // sin message id casado
  ok(a.contactoIds.length === 0 && a.emailsGlobales.length === 0, "no escribe nada");
  ok(a.sinAtribuir.join() === ANA, "la reporta para que quede en el log");
}

titulo("Un rebote duro sí se propaga a todas las cuentas");
{
  const a = decidirAlcance("REBOTE_PERMANENTE", [ANA], [ZATTIA]);
  ok(a.emailsGlobales.join() === ANA, "suprime el email en toda la base");
  ok(a.envioIds.join() === "e1", "y marca el envío casado");
  ok(a.sinAtribuir.length === 0, "un rebote nunca queda sin aplicar");
}

titulo("Un rebote sin message id igual se aplica");
{
  const a = decidirAlcance("REBOTE_PERMANENTE", [ANA], []);
  ok(a.emailsGlobales.join() === ANA, "el buzón no existe para nadie, haya envío o no");
  ok(a.envioIds.length === 0, "sin envío casado no marca ningún Envio");
}

titulo("El envío casado tiene que ser de quien rebotó");
{
  // Un message id casa el MAIL; el evento nombra la CASILLA. Si no coinciden
  // (un id reusado, un payload armado a mano), no se marca a un tercero.
  const otro = envio("e2", "cuenta-bdi", "otro@gmail.com");
  const a = decidirAlcance("QUEJA", [ANA], [otro]);
  ok(a.contactoIds.length === 0, "no marca al contacto que no está en el evento");
  ok(a.envioIds.length === 0, "no marca ese envío");
  ok(a.sinAtribuir.join() === ANA, "y la queja queda sin atribuir");
}

titulo("Normalización");
{
  ok(normalizarEmails([" ANA@Gmail.com "]).join() === ANA, "recorta y baja a minúsculas");
  ok(normalizarEmails([ANA, ANA]).length === 1, "no repite");
  ok(normalizarEmails(["", "  "]).length === 0, "descarta los vacíos");

  // El proveedor manda "Ana@Gmail.com" y en la base está en minúsculas: si el
  // casado comparara sin normalizar, la queja quedaría sin atribuir y se
  // perdería.
  const a = decidirAlcance("QUEJA", [" Ana@Gmail.com "], [ZATTIA]);
  ok(a.contactoIds.length === 1, "casa el envío aunque el evento venga con mayúsculas");
}

titulo("Varios destinatarios en un solo evento");
{
  const beto = envio("e3", "cuenta-zattia", "beto@gmail.com");
  const a = decidirAlcance("QUEJA", [ANA, "beto@gmail.com", "sin-envio@gmail.com"], [ZATTIA, beto]);
  ok(a.contactoIds.length === 2, "marca a los dos atribuidos");
  ok(a.sinAtribuir.join() === "sin-envio@gmail.com", "y deja afuera al que no casó");
}

console.log(fallas === 0 ? "\n✅ Todo OK" : `\n❌ ${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
