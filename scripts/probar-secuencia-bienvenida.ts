// La secuencia de bienvenida de 5 mails (11-oct-2026): hora fija, corte si compró y
// grupo de control. Puro: sin base, sin red.
//
//   node --import tsx scripts/probar-secuencia-bienvenida.ts
//
// 🔑 Los oráculos de hora están escritos A MANO en UTC («martes 11:00 de Argentina =
// martes 14:00Z»), no recalculados con `instanteLocal`: si la regla y su prueba usan la
// misma cuenta, un error en la cuenta da verde en las dos.
import { cuandoSale, esperaEnPalabras, grupoDeContacto, vaAHoraFija, ESPERAS_SIGUIENTES } from "../lib/automations";
import { diaALaHora } from "../lib/fechas";
import { esMailQueSigue, yaCompro, type Compra } from "../lib/secuencia-bienvenida";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);
const iso = (d: Date) => d.toISOString();

titulo("Hora fija: día N a las 11 de Argentina, no N×24 horas");
{
  // Lunes 12-oct-2026, 23:50 en Argentina = martes 13-oct 02:50Z. En UTC ya es martes:
  // contar el día en UTC adelantaría la serie entera un día.
  const altaNoche = new Date("2026-10-13T02:50:00Z");
  ok(iso(cuandoSale("NUEVO_SUSCRIPTOR", 24, altaNoche)) === "2026-10-13T14:00:00.000Z",
    "alta lunes 23:50 → día 1 = martes 11:00 (14:00Z), 11 horas después", iso(cuandoSale("NUEVO_SUSCRIPTOR", 24, altaNoche)));
  // Lunes 15:00 de Argentina = 18:00Z. Con 24 h saldría martes 15:00; tiene que ser 11:00.
  const altaTarde = new Date("2026-10-12T18:00:00Z");
  ok(iso(cuandoSale("NUEVO_SUSCRIPTOR", 24, altaTarde)) === "2026-10-13T14:00:00.000Z",
    "alta lunes 15:00 → día 1 = martes 11:00, ANTES de las 24 h que pone Resorty");
  // Lunes 00:10 de Argentina = 03:10Z.
  const altaMadrugada = new Date("2026-10-12T03:10:00Z");
  ok(iso(cuandoSale("NUEVO_SUSCRIPTOR", 24, altaMadrugada)) === "2026-10-13T14:00:00.000Z",
    "alta lunes 00:10 → día 1 es el martes, no el mismo lunes");
  ok(iso(cuandoSale("NUEVO_SUSCRIPTOR", 48, altaTarde)) === "2026-10-14T14:00:00.000Z", "día 2 = miércoles 11:00");
  ok(iso(cuandoSale("NUEVO_SUSCRIPTOR", 96, altaTarde)) === "2026-10-16T14:00:00.000Z", "día 4 = viernes 11:00");
  ok(iso(cuandoSale("NUEVO_SUSCRIPTOR", 144, altaTarde)) === "2026-10-18T14:00:00.000Z", "día 6 = domingo 11:00");
  // Cruce de mes.
  ok(iso(diaALaHora(new Date("2026-10-30T18:00:00Z"), 4, "11:00")) === "2026-11-03T14:00:00.000Z", "el día 4 de un alta del 30-oct es el 3-nov");

  // Lo que NO cambia.
  ok(iso(cuandoSale("NUEVO_SUSCRIPTOR", 0, altaTarde)) === iso(altaTarde), "el 1º (espera 0) sale al instante: es el del código");
  ok(!vaAHoraFija("NUEVO_SUSCRIPTOR", 0), "la bienvenida de un mail de hoy (espera 0) no se toca");
  ok(iso(cuandoSale("CARRITO_ABANDONADO", 24, altaTarde)) === "2026-10-13T18:00:00.000Z", "el carrito sigue contando horas exactas");
  ok(!vaAHoraFija("CARRITO_ABANDONADO", 72), "el carrito no tiene hora fija");

  // Los cinco salen en días distintos: ningún par a la misma hora.
  const horas = [0, ...ESPERAS_SIGUIENTES.NUEVO_SUSCRIPTOR].map((h) => iso(cuandoSale("NUEVO_SUSCRIPTOR", h, altaNoche)));
  ok(new Set(horas).size === 5, "los cinco mails salen en cinco momentos distintos", horas.join(" · "));

  ok(esperaEnPalabras("NUEVO_SUSCRIPTOR", 48) === "día 2 a las 11:00", "la pantalla dice el día y la hora, no «48h»", esperaEnPalabras("NUEVO_SUSCRIPTOR", 48));
  ok(esperaEnPalabras("NUEVO_SUSCRIPTOR", 0) === "espera 0h", "y la de un solo mail sigue diciendo lo de siempre");
  ok(esperaEnPalabras("CARRITO_ABANDONADO", 24) === "espera 24h", "el carrito también");
}

titulo("Cuáles son «los que siguen»");
{
  ok(!esMailQueSigue("NUEVO_SUSCRIPTOR", 0), "el 1º no: le llega a todos, control incluido");
  ok(esMailQueSigue("NUEVO_SUSCRIPTOR", 24) && esMailQueSigue("NUEVO_SUSCRIPTOR", 144), "del día 1 al 6, sí");
  ok(!esMailQueSigue("CARRITO_ABANDONADO", 24), "el carrito tiene su propio corte (estadoDeCheckout) y su propio control");
  ok(!esMailQueSigue("NUEVO_CLIENTE", 24), "NUEVO_CLIENTE no es la secuencia");
}

titulo("Corte: canjeó el cupón, o compró desde el alta");
{
  const alta = new Date("2026-10-12T18:00:00Z");
  const orden = (o: Partial<Compra>): Compra => ({
    email: "otra@x.com", cupones: [], pagada: true, cancelada: false, creada: new Date("2026-10-13T12:00:00Z"), ...o,
  });

  ok(yaCompro([orden({ cupones: ["BDI-BZGP78"] })], "lead@x.com", alta, "BDI-BZGP78") === "canjeo",
    "una orden con SU código corta, aunque la haya hecho con otro mail");
  ok(yaCompro([orden({ cupones: ["BDI-BZGP78"] })], "lead@x.com", alta, "bdi-bzgp78") === "canjeo",
    "el código se compara sin mayúsculas");
  ok(yaCompro([orden({ cupones: ["BDI-BZGP78"], pagada: false })], "lead@x.com", alta, "BDI-BZGP78") === "canjeo",
    "canjear alcanza aunque el pago esté pendiente (transferencia)");
  ok(yaCompro([orden({ cupones: ["BDI-BZGP78"], cancelada: true })], "lead@x.com", alta, "BDI-BZGP78") === null,
    "una orden CANCELADA con el código no corta");
  ok(yaCompro([orden({ email: "lead@x.com" })], "Lead@X.com ", alta, "BDI-BZGP78") === "compro",
    "una orden PAGADA con su mail, sin el cupón, corta (el mail sin mayúsculas ni espacios)");
  ok(yaCompro([orden({ email: "lead@x.com", pagada: false })], "lead@x.com", alta, null) === null,
    "una orden con su mail pero SIN pagar no corta (puede no pagarse nunca)");
  ok(yaCompro([orden({ email: "lead@x.com", creada: new Date("2026-10-10T12:00:00Z") })], "lead@x.com", alta, null) === null,
    "una compra de ANTES del alta no corta: un cliente viejo recibe la secuencia");
  ok(yaCompro([orden({ email: "lead@x.com", cancelada: true })], "lead@x.com", alta, null) === null, "una pagada y cancelada no corta");
  ok(yaCompro([orden({ cupones: ["OTRO"] })], "lead@x.com", alta, "BDI-BZGP78") === null, "el código de otro no corta");
  ok(yaCompro([], "lead@x.com", alta, "BDI-BZGP78") === null, "sin órdenes, sale");
  // 🔴 El caso que importa: TN caído no puede leerse como «nadie compró» NI como «todos».
  ok(yaCompro(null, "lead@x.com", alta, "BDI-BZGP78") === null, "TN no contestó (null) ⇒ el mail SALE");
  ok(yaCompro([orden({ email: "" })], "", alta, null) === null, "un mail vacío no matchea una orden sin mail");
}

titulo("Grupo de control: por persona, estable, y del tamaño pedido");
{
  ok(grupoDeContacto("cualquiera", 0) === null, "con 0% nadie va al control");
  ok(grupoDeContacto("", 10) === null, "un id vacío recibe la secuencia: el control nunca se come un mail por error");
  const id = "cms6kpmqg000004l4s4tg6djo";
  ok(grupoDeContacto(id, 10) === grupoDeContacto(id, 10), "la misma persona da siempre el mismo grupo");
  // Dos formas de id: cuid del mailer y UUID de Resorty (`registrarLead`).
  const ids: string[] = [];
  for (let i = 0; i < 5000; i++) ids.push(`c${(i * 7919).toString(36)}x${i.toString(36)}`);
  for (let i = 0; i < 5000; i++) ids.push(crypto.randomUUID());
  const pct = (100 * ids.filter((x) => grupoDeContacto(x, 10)).length) / ids.length;
  ok(pct > 8.5 && pct < 11.5, "con 10% cae ~10% de 10.000 ids", `${pct.toFixed(2)}%`);
  const todos = ids.every((x) => grupoDeContacto(x, 10) !== "CONTROL" || grupoDeContacto(x, 20) === "CONTROL");
  ok(todos, "subir el % sólo SUMA gente al control: nadie del 10% sale con el 20%");
}

console.log(fallas ? `\n❌ ${fallas} falla(s)\n` : "\n✅ todo bien\n");
process.exit(fallas ? 1 : 0);
