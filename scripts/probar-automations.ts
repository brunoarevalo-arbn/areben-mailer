// Una automation por trigger y por cuenta. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-automations.ts
//
// Por qué existe: el disparador manda **todas** las automations que matcheen el
// trigger, así que dos filas con el mismo trigger son **dos mails a la misma
// persona** — y una bienvenida es una sola vez en la vida del contacto. El
// 31-jul-2026 pasó de verdad en Zattia: `/automations` dibujaba el botón "Crear"
// siempre, sin mirar si ya había una, y entrar a la pantalla "a ver cómo era"
// dejó una duplicada.
//
// El arreglo no es un cartel: es que la tarjeta y la action `crearAutomation`
// decidan con **la misma función**, `automationDelTrigger`. Lo que se prueba acá
// es esa función, más el hecho de que la pantalla ofrece exactamente los cuatro
// triggers que existen — un trigger nuevo sin tarjeta es una automation que no
// se puede crear, y una tarjeta de un trigger que no existe es un botón que
// revienta al apretarlo.

import { automationDelTrigger, type Trigger } from "../lib/automations";
import { TRIGGERS_UI } from "../app/(app)/automations/presets-ui";
import { presetDeTrigger } from "../lib/plantillas/presets";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const fila = (id: string, trigger: Trigger, dia: number) => ({
  id,
  trigger,
  createdAt: new Date(2026, 6, dia),
});

// Los cuatro valores del enum. Escritos a mano y no derivados de `TRIGGERS_UI`:
// si la pantalla perdiera una tarjeta, derivarla haría que este script perdiera
// la prueba junto con ella.
const TODOS: Trigger[] = ["NUEVO_CLIENTE", "COMPRA", "CARRITO_ABANDONADO", "NUEVO_SUSCRIPTOR"];

titulo("Sin automations previas se crea");
{
  for (const t of TODOS) {
    ok(automationDelTrigger([], t) === undefined, `${t}: nada que editar ⇒ crear`);
  }
}

titulo("Con una del mismo trigger se edita esa, no se crea otra");
{
  const existentes = [fila("a1", "NUEVO_SUSCRIPTOR", 10)];
  ok(automationDelTrigger(existentes, "NUEVO_SUSCRIPTOR")?.id === "a1", "devuelve la existente");
  ok(
    automationDelTrigger(existentes, "NUEVO_CLIENTE") === undefined,
    "y NO la confunde con la de otro trigger",
    "NUEVO_CLIENTE y NUEVO_SUSCRIPTOR son dos públicos distintos: el que compró y el que se anotó",
  );
}

titulo("Dos llamadas seguidas dejan UNA fila");
{
  // La forma que tiene el servidor: la action consulta, y si hay algo redirige
  // sin insertar. Simular las dos llamadas es la prueba del doble click.
  const base: ReturnType<typeof fila>[] = [];
  const crear = (t: Trigger) => {
    const ya = automationDelTrigger(base, t);
    if (ya) return { redirigioA: ya.id, creo: false };
    const nueva = fila(`n${base.length + 1}`, t, 20 + base.length);
    base.push(nueva);
    return { redirigioA: nueva.id, creo: true };
  };

  const uno = crear("NUEVO_SUSCRIPTOR");
  const dos = crear("NUEVO_SUSCRIPTOR");
  ok(uno.creo && !dos.creo, "la segunda no inserta");
  ok(dos.redirigioA === uno.redirigioA, "y lleva a la misma automation");
  ok(base.length === 1, "queda una sola fila", `quedaron ${base.length}`);

  const otro = crear("COMPRA");
  ok(otro.creo && base.length === 2, "otro trigger SÍ se puede crear");
}

titulo("Con duplicadas ya existentes gana la más vieja");
{
  // El caso real de BDI, que llegó a tener dos bienvenidas. Resolver a la nueva
  // mandaría a editar la que creó el accidente, mientras la que la gente venía
  // trabajando queda escondida.
  const existentes = [fila("nueva", "NUEVO_CLIENTE", 31), fila("vieja", "NUEVO_CLIENTE", 3)];
  ok(automationDelTrigger(existentes, "NUEVO_CLIENTE")?.id === "vieja", "devuelve la más vieja");
  ok(
    automationDelTrigger([...existentes].reverse(), "NUEVO_CLIENTE")?.id === "vieja",
    "y no depende del orden en que vengan",
  );
}

titulo("La pantalla ofrece exactamente los triggers que existen");
{
  const enUi = TRIGGERS_UI.map((p) => p.trigger);
  for (const t of TODOS) {
    ok(enUi.includes(t), `${t} tiene su tarjeta`);
  }
  ok(enUi.length === TODOS.length, "y no hay tarjetas de más", `la UI ofrece ${enUi.length}`);
  ok(new Set(enUi).size === enUi.length, "sin dos tarjetas del mismo trigger");
}

titulo("Cada tarjeta tiene un preset detrás");
{
  // Una tarjeta sin preset crearía una automation sin contenido — el botón
  // andaría y el mail saldría vacío.
  const cuenta = { config: { url: "https://ejemplo.com" } };
  for (const { trigger } of TRIGGERS_UI) {
    const p = presetDeTrigger(trigger, cuenta as never, "info@ejemplo.com");
    ok(Boolean(p?.asunto && p?.contenido), `${trigger}: preset con asunto y contenido`);
  }
}

console.log(fallas === 0 ? "\n✅ Todo en verde" : `\n❌ ${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
