// Cuántas automations admite cada trigger, y cuál se edita. Puro: sin base, sin red.
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
// 🔑 **Desde el 20-ago-2026 la regla ya no es "una por trigger".** El carrito
// abandonado admite DOS, porque ahí el segundo mail al mismo contacto es la
// secuencia (a la hora y al otro día) y no el accidente. O sea que la regla pasó
// a ser un NÚMERO por trigger (`MAX_POR_TRIGGER`), y este script prueba las dos
// puntas: que el carrito llegue a dos y **se frene en dos**, y que la bienvenida
// se siga frenando en una.
//
// El arreglo no es un cartel: es que las cuatro puertas que crean —la tarjeta de
// `/automations`, la galería de plantillas y sus dos actions— decidan con **las
// mismas funciones**, `puedeCrearOtra` y `automationDelTrigger`. Lo que se prueba
// acá son esas funciones, más el hecho de que la pantalla ofrece exactamente los
// triggers que existen — un trigger nuevo sin tarjeta es una automation que no
// se puede crear, y una tarjeta de un trigger que no existe es un botón que
// revienta al apretarlo.

import {
  automationDelTrigger,
  ESPERA_SIGUIENTE_HORAS,
  ESPERAS_SIGUIENTES,
  MAX_POR_TRIGGER,
  motivoNoBorrable,
  nacimientoDelMail,
  puedeCrearOtra,
  type Trigger,
} from "../lib/automations";
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

// Los valores del enum. Escritos a mano y no derivados de `TRIGGERS_UI`: si la
// pantalla perdiera una tarjeta, derivarla haría que este script perdiera la
// prueba junto con ella.
const TODOS: Trigger[] = ["NUEVO_CLIENTE", "COMPRA", "CARRITO_ABANDONADO", "NUEVO_SUSCRIPTOR", "RESENA"];

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

// La forma que tiene el servidor: la action consulta, y si ya llegó al tope
// redirige sin insertar. Simular las llamadas seguidas es la prueba del doble
// click, que es como se duplicó la bienvenida de Zattia.
const simulador = () => {
  const base: ReturnType<typeof fila>[] = [];
  const crear = (t: Trigger) => {
    if (!puedeCrearOtra(base, t)) {
      const ya = automationDelTrigger(base, t);
      return { redirigioA: ya?.id, creo: false };
    }
    const nueva = fila(`n${base.length + 1}`, t, 20 + base.length);
    base.push(nueva);
    return { redirigioA: nueva.id, creo: true };
  };
  return { base, crear };
};

titulo("Dos llamadas seguidas dejan UNA fila (los triggers de tope 1)");
{
  const { base, crear } = simulador();
  const uno = crear("NUEVO_SUSCRIPTOR");
  const dos = crear("NUEVO_SUSCRIPTOR");
  ok(uno.creo && !dos.creo, "la segunda no inserta");
  ok(dos.redirigioA === uno.redirigioA, "y lleva a la misma automation");
  ok(base.length === 1, "queda una sola fila", `quedaron ${base.length}`);

  const otro = crear("COMPRA");
  ok(otro.creo && base.length === 2, "otro trigger SÍ se puede crear");
}

titulo("El carrito abandonado llega a TRES, y se frena en tres");
{
  const { base, crear } = simulador();
  const uno = crear("CARRITO_ABANDONADO");
  const dos = crear("CARRITO_ABANDONADO");
  const tres = crear("CARRITO_ABANDONADO");
  const cuatro = crear("CARRITO_ABANDONADO");
  ok(uno.creo && dos.creo, "el 2º mail de la secuencia SÍ se crea");
  ok(tres.creo, "y el 3º también", "es el del cupón; entró el 21-ago-2026");
  ok(!cuatro.creo, "el 4º no", "el tope está en 3: un cuarto toque a la misma persona es acoso");
  ok(base.length === 3, "quedan tres filas", `quedaron ${base.length}`);
  ok(cuatro.redirigioA === uno.redirigioA, "y el intento de más lleva a la PRIMERA, no a la última");
}

titulo("Cada trigger declara su tope, y ninguno queda en cero");
{
  // `Record` completo: un trigger nuevo no compila sin decidir esto. Lo que el
  // tipo no puede exigir es que el número tenga sentido.
  for (const t of TODOS) {
    ok(MAX_POR_TRIGGER[t] >= 1, `${t}: admite al menos una`, `declara ${MAX_POR_TRIGGER[t]}`);
  }
  ok(MAX_POR_TRIGGER.CARRITO_ABANDONADO > 1, "el carrito es el único con secuencia");
  // 🔴 El invariante que hace inalcanzable el fallback de `nacimientoDelMail`:
  // la escalera tiene que tener un escalón por cada mail MENOS el 1º (que trae
  // el suyo del preset). Sin esto, subir el tope y olvidar la escalera saca dos
  // mails a la misma hora, callado.
  for (const t of TODOS) {
    ok(
      ESPERAS_SIGUIENTES[t].length === MAX_POR_TRIGGER[t] - 1,
      `${t}: la escalera acompaña al tope`,
      `tope ${MAX_POR_TRIGGER[t]} · escalones ${ESPERAS_SIGUIENTES[t].length}`,
    );
  }
  ok(
    TODOS.filter((t) => MAX_POR_TRIGGER[t] > 1).length === 1,
    "y es el ÚNICO",
    "un segundo trigger con tope >1 es un segundo mail a la misma persona: tiene que ser una decisión, no un arrastre",
  );
}

titulo("Los tres mails nacen distintos, y NINGUNO a la misma hora que otro");
{
  // Sin esto, `/automations` dibuja filas idénticas y la única forma de saber
  // cuál se edita es abrirlas.
  const base = { nombre: "Carrito abandonado", esperaHoras: 3 };
  const primero = nacimientoDelMail(1, base, "CARRITO_ABANDONADO");
  const segundo = nacimientoDelMail(2, base, "CARRITO_ABANDONADO");
  const tercero = nacimientoDelMail(3, base, "CARRITO_ABANDONADO");
  ok(primero.nombre === base.nombre, "el 1º conserva el nombre del preset");
  ok(primero.esperaHoras === base.esperaHoras, "y su espera");
  ok(segundo.nombre !== primero.nombre, "el 2º se llama distinto", segundo.nombre);
  ok(segundo.nombre.includes("2º"), "y el nombre dice QUÉ NÚMERO es", segundo.nombre);
  ok(tercero.nombre.includes("3º"), "el 3º también", tercero.nombre);

  // 🔴 ESTE es el caso que no existía antes del 21-ago: con una constante única
  // para todo `orden > 1`, el 2º y el 3º salían los dos a las 24 h.
  const horas = [primero.esperaHoras, segundo.esperaHoras, tercero.esperaHoras];
  ok(
    new Set(horas).size === 3,
    "las tres esperas son distintas",
    `1º ${horas[0]}h · 2º ${horas[1]}h · 3º ${horas[2]}h`,
  );
  ok(
    horas[0] < horas[1] && horas[1] < horas[2],
    "y van de menor a mayor: cada toque espera más que el anterior",
    horas.join(" < "),
  );
  ok(
    segundo.esperaHoras === ESPERAS_SIGUIENTES.CARRITO_ABANDONADO[0] &&
      tercero.esperaHoras === ESPERAS_SIGUIENTES.CARRITO_ABANDONADO[1],
    "y salen de la escalera, no de una constante suelta",
  );
  ok(
    nacimientoDelMail(0, base, "CARRITO_ABANDONADO").nombre === base.nombre,
    "un orden 0 se trata como el 1º, no revienta",
  );
  // Un trigger sin secuencia nunca llega acá (lo frena `puedeCrearOtra`), pero
  // si llegara tiene que dar un número, no `undefined`.
  ok(
    nacimientoDelMail(2, base, "COMPRA").esperaHoras === ESPERA_SIGUIENTE_HORAS,
    "un trigger sin escalera cae en el fallback, no en undefined",
  );
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

titulo("Una automation con historial NO se borra");
{
  // La guarda es la que comparten `/automations` y `scripts/borrar-automation.ts`.
  // Lo que protege no es el historial: borrar y recrear una bienvenida deja a
  // todos elegibles otra vez, y esa gente ya la recibió.
  ok(motivoNoBorrable({ estado: "PAUSADO" }, 0, 0) === null, "pausada y sin runs: se borra");
  ok(motivoNoBorrable({ estado: "ACTIVO" }, 0, 0) !== null, "ACTIVA: no se borra (el webhook de TN quedaría colgado)");
  ok(motivoNoBorrable({ estado: "PAUSADO" }, 1, 0) !== null, "con un run: no se borra");
  ok(motivoNoBorrable({ estado: "PAUSADO" }, 0, 1) !== null, "con un envío y sin runs: tampoco");
  ok(
    (motivoNoBorrable({ estado: "PAUSADO" }, 177, 177) ?? "").includes("177"),
    "el motivo dice CUÁNTOS mails, no 'no se puede'",
  );
}

console.log(fallas === 0 ? "\n✅ Todo en verde" : `\n❌ ${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
