// Guardado con detección de conflicto. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-guardado.ts
//
// Por qué existe. Guardar escribe el registro ENTERO con lo que tenía la
// pantalla, y no había historial ni chequeo: una pantalla cargada ANTES de un
// cambio y guardada DESPUÉS lo borraba, sin error y sin rastro. El 8-ago-2026
// pasó dos veces — una se comió el bloque `cupon` de GIRLHOOD y hubo que
// reconstruirlo a ojo desde una captura; la otra revirtió el destino de una
// campaña de Zattia que, de no verse, salía a 178 personas que ya tenían ese
// mismo mail en la casilla.
//
// Lo que se prueba acá es la DECISIÓN (`veredictoGuardado`), que es lo único
// puro. El `updateMany` condicional que la alimenta se ejerce contra la base.
import { MENSAJE_CONFLICTO, MENSAJE_NO_EXISTE, VERSION_INICIAL, veredictoGuardado } from "../lib/documentos";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else { fallas++; console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`); }
};
const titulo = (s: string) => console.log(`\n${s}`);

titulo("Escribió: devuelve la versión NUEVA");
{
  const r = veredictoGuardado(1, true, 8);
  ok(r.ok, "ok");
  ok(r.ok && r.version === 8, "la versión que vuelve es la de después del guardado", JSON.stringify(r));
  // 🔴 Si devolviera la vieja, el segundo guardado seguido chocaría contra su
  // propio primero: la pantalla diría "alguien más lo guardó" y ese alguien
  // sería uno mismo. Un aviso falso que se aprende a ignorar en dos días.
}

titulo("No escribió y el documento SIGUE ahí: es conflicto");
{
  const r = veredictoGuardado(0, true, 5);
  ok(!r.ok, "no ok");
  ok(!r.ok && r.conflicto === true, "marcado como conflicto");
  ok(!r.ok && r.error === MENSAJE_CONFLICTO, "con el mensaje de conflicto");
  ok(
    MENSAJE_CONFLICTO.includes("NO se guardó"),
    "y el mensaje dice que lo de la pantalla NO se guardó",
    "el modo de falla que más duele es creer que sí se guardó",
  );
  ok(/recarg/i.test(MENSAJE_CONFLICTO), "y dice QUÉ HACER, no sólo qué pasó");
}

titulo("No escribió y el documento NO está: es otra cosa");
{
  const r = veredictoGuardado(0, false, 5);
  ok(!r.ok, "no ok");
  ok(!r.ok && r.conflicto === false, "NO se marca como conflicto");
  ok(!r.ok && r.error === MENSAJE_NO_EXISTE, "el mensaje es el de borrado");
  ok(
    MENSAJE_CONFLICTO !== MENSAJE_NO_EXISTE,
    "y los dos mensajes son distintos",
    "con `filas === 0` sola no se puede distinguir 'alguien lo pisó' de 'lo borraron', y una se arregla recargando y la otra no",
  );
}

titulo("La versión inicial es 0 y 0 es un valor VÁLIDO");
{
  ok(VERSION_INICIAL === 0, "arranca en 0");
  // 🔴 `docVersion` se agregó a tablas que YA tenían filas, todas en 0. Un
  // `version || 1` —el reflejo de siempre— convertiría ese 0 en 1 y el primer
  // guardado de todo documento existente fallaría por conflicto contra sí mismo.
  const r = veredictoGuardado(1, true, VERSION_INICIAL + 1);
  ok(r.ok && r.version === 1, "y guardar desde 0 lleva a 1, no rebota");
  const falso = VERSION_INICIAL || 1;
  ok(falso === 1, "(demostración: `version || 1` sobre 0 da 1 — por eso no se usa)");
}

console.log(fallas === 0 ? "\n✅ Todo en verde" : `\n❌ ${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
