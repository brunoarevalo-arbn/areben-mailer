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
import { esMailQueSigue, yaCompro, mailVencido, faltaCuponObligatorio, type Compra } from "../lib/secuencia-bienvenida";
import { aplicarCuponDelTrigger, valoresCupon } from "../lib/email/cupon-trigger";
import { cadaBloque, type Bloque } from "../lib/email/bloques";
import { renderEmailHtml, renderEmailTexto } from "../lib/email/render";
import { leerContenido } from "../lib/email/esquema";
import { V_ACTUAL } from "../lib/email/esquema";

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

titulo("Un mail que no sale: vencido (3/5) o sin el código que es su razón de ser (5/5)");
{
  ok(!mailVencido("2026-10-31", "2026-10-31"), "el 31/10 todavía sale: «hasta el 31/10» incluye el 31");
  ok(mailVencido("2026-10-31", "2026-11-01"), "el 1/11 ya no sale");
  ok(!mailVencido(undefined, "2099-01-01"), "sin `saleHasta` sale siempre");
  ok(leerContenido({ v: V_ACTUAL, bloques: [], saleHasta: "31/10" }).saleHasta === undefined, "una fecha ilegible se borra (el mail sale): no se inventa un vencimiento");
  ok(leerContenido({ v: 1, bloques: [], saleHasta: "2026-10-31" }).saleHasta === "2026-10-31", "la fecha sobrevive al camino lento del esquema");

  const cupon = (extra: Partial<Bloque> = {}) => ({ id: "c", tipo: "cupon", texto: "", destacado: "", codigo: "TUCUPON", botonTexto: "", botonUrl: "", ...extra }) as unknown as Bloque;
  // El 5/5 lleva el cupón ADENTRO de una banda: el chequeo tiene que mirar adentro.
  const doc5 = [{ id: "b", tipo: "banda", bloques: [cupon({ obligatorio: true } as Partial<Bloque>)] } as unknown as Bloque];
  const sinCodigo = aplicarCuponDelTrigger(doc5, { origen: "popup", cupon: null });
  ok(faltaCuponObligatorio(cadaBloque(doc5), cadaBloque(sinCodigo)), "lead sin código + cupón obligatorio (dentro de una banda) ⇒ no sale");
  const conCodigo = aplicarCuponDelTrigger(doc5, { origen: "popup", cupon: "BDI-1" });
  ok(!faltaCuponObligatorio(cadaBloque(doc5), cadaBloque(conCodigo)), "con código, sale");
  const comun = [cupon()];
  ok(!faltaCuponObligatorio(cadaBloque(comun), cadaBloque(aplicarCuponDelTrigger(comun, { origen: "popup", cupon: null }))),
    "un cupón NO obligatorio se cae solo y el mail sale (la bienvenida de hoy)");
}

titulo("Los tags del vencimiento y el premio en su lugar");
{
  const v = valoresCupon("2026-10-18");
  ok(v.vence === "18/10" && v.venceLargo === "el domingo 18/10", "2026-10-18 → «18/10» y «el domingo 18/10»", JSON.stringify(v));
  ok(valoresCupon("2026-11-01").venceLargo === "el domingo 01/11", "el día de semana sale del calendario, no del reloj del proceso");
  ok(!valoresCupon(null).vence && !valoresCupon("pronto").vence, "sin fecha legible no hay valor");

  const base = [
    { id: "t", tipo: "texto", texto: "Gracias por sumarte. Vale hasta el ${cupon.vence}." },
    { id: "c", tipo: "cupon", variante: "renglon", texto: "Tu código de bienvenida sigue vigente hasta el ${cupon.vence}:", destacado: "", codigo: "TUCUPON", botonTexto: "", botonUrl: "" },
  ] as unknown as Bloque[];
  const conFecha = aplicarCuponDelTrigger(base, { origen: "popup", cupon: "BDI-2C8XZG", prizeLabel: "15% OFF", vence: "2026-10-18" });
  const c = cadaBloque(conFecha).find((b) => b.tipo === "cupon") as Extract<Bloque, { tipo: "cupon" }>;
  ok(c.destacado === "15% OFF" && c.texto.startsWith("Tu código de bienvenida"), "con la clave `destacado` el premio va ahí y la frase NO se pisa", JSON.stringify(c));
  const sinFecha = aplicarCuponDelTrigger(base, { origen: "popup", cupon: "BDI-2C8XZG", prizeLabel: "15% OFF" });
  const todo = JSON.stringify(sinFecha);
  ok(!todo.includes("${cupon."), "sin vencimiento no queda ni un tag crudo");
  ok(todo.includes("Gracias por sumarte."), "sin vencimiento se cae SÓLO la oración que lo usaba");

  // El mail personal: el código SOLO en su renglón (pedido de Darío).
  const opts = { unsubscribeUrl: "https://x/baja", nombreCuenta: "BDI" };
  const html = renderEmailHtml({ v: V_ACTUAL, formato: "personal", bloques: conFecha }, opts);
  ok(/<p[^>]*><strong>BDI-2C8XZG<\/strong><\/p>/.test(html.replace(/<p style="margin:0 0 4px;font-size:18px;letter-spacing:1px">/, "<p>")),
    "personal `renglon`: el código va SOLO en su párrafo", html.match(/BDI-2C8XZG.{0,80}/)?.[0]);
  ok(!/15% OFF <strong>/.test(html), "ya no sale «15% OFF BDI-…» en una misma frase");
  ok(html.includes("sigue vigente hasta el 18/10:"), "la frase queda entera, con la fecha");
  const texto = renderEmailTexto({ v: V_ACTUAL, formato: "personal", bloques: conFecha }, opts);
  ok(/\nBDI-2C8XZG\n/.test(texto), "en el text/plain el código también va en su renglón");

  // Lo que nunca llega crudo: un `${cupon.…}` que no pasó por el trigger (la prueba, el editor).
  const crudo = { v: V_ACTUAL, bloques: base } as never;
  ok(!renderEmailHtml(crudo, opts).includes("${cupon."), "sin trigger, el renderer tampoco deja el tag crudo");
  ok(renderEmailHtml(crudo, { ...opts, muestraCarrito: true }).includes("Vale hasta el "), "en la muestra del editor se ve la frase con una fecha de ejemplo");
}

titulo("Bloque `lista`: pasos, escalones y categorías");
{
  const opts = { unsubscribeUrl: "https://x/baja", nombreCuenta: "BDI" };
  const lista = (extra: object) => ({ v: V_ACTUAL, bloques: [{ id: "l", tipo: "lista", items: [
    { titulo: "Despachamos en 24 h", texto: "A todo el país." },
    { titulo: "Pagás como te quede cómodo" },
  ], ...extra }] }) as never;
  const pasos = renderEmailHtml(lista({}), opts);
  ok(pasos.includes(">01<") && pasos.includes(">02<"), "pasos: el número lo pone el motor (01, 02)");
  const esc = renderEmailHtml(lista({ variante: "escalones", rotulo: "Llevando", items: [{ titulo: "Fundas", numero: "2", texto: "la segunda, −20%", sello: "más elegido" }] }), opts);
  ok(esc.includes(">LLEVANDO<") && esc.includes(">2<") && esc.includes("MÁS ELEGIDO"), "escalones: rótulo, número gigante y sello");
  const cats = renderEmailHtml(lista({ variante: "categorias", items: Array.from({ length: 6 }, (_, i) => ({ titulo: `Cat ${i}`, imagen: `https://x/${i}.jpg`, url: `https://x/c${i}` })) }), opts);
  ok((cats.match(/<tr><td width="50%"/g) ?? []).length === 3, "categorías: 6 ítems = 3 filas de a dos");
  ok(!/display:(flex|grid)/.test(pasos + esc + cats), "nada de flex ni grid (Outlook)");
  const t = renderEmailTexto(lista({}), opts);
  ok(t.includes("01 · Despachamos en 24 h — A todo el país."), "el text/plain lleva cada renglón con su número", t.split("\n")[0]);
  const siete = leerContenido({ v: 1, bloques: [{ tipo: "lista", items: Array.from({ length: 9 }, (_, i) => ({ titulo: `x${i}` })).concat([{ titulo: " " }]) }] });
  ok((siete.bloques.find((b) => b.tipo === "lista") as Extract<Bloque, { tipo: "lista" }>).items.length === 6, "el esquema la deja en 6 renglones y tira los vacíos");
}

console.log(fallas ? `\n❌ ${fallas} falla(s)\n` : "\n✅ todo bien\n");
process.exit(fallas ? 1 : 0);
