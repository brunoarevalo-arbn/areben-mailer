// Qué le pasa al bloque `cupon` del último mail de la secuencia de carrito.
//
//   node --import tsx scripts/probar-cupon-carrito.ts
//
// 🔴 LA INVARIANTE QUE CUSTODIA: **un bloque `cupon` sin código real detrás se
// ELIMINA.** El preset trae `CARRITO10` de placeholder; mandarlo es darle a un
// cliente un código que el checkout de Tiendanube rechaza. Es el mismo criterio
// —y el mismo modo de falla— que `probar-bienvenida.ts` fija para el cupón de
// pop-up, y por eso se escribe igual en vez de inventar uno nuevo.
import { pideCupon, aplicarCuponDeCarrito, condicionesDe } from "../lib/email/cupon-carrito.ts";
import { renderEmailHtml } from "../lib/email/render.ts";
import type { Bloque } from "../lib/email/bloques.ts";

/** El mismo escape que emite el renderer, para poder buscar el texto en el HTML. */
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let ok = 0, mal = 0;
const chk = (nombre: string, cond: unknown, extra = "") => {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { mal++; console.error(`  ✗ ${nombre}${extra ? `\n      ${extra}` : ""}`); }
};
const titulo = (s: string) => console.log(`\n${s}`);

const conCupon = (): Bloque[] => [
  { tipo: "titulo", texto: "Última llamada" },
  { tipo: "cupon", texto: "10% OFF", codigo: "CARRITO10", botonTexto: "Usarlo", botonUrl: "${cart.url}" },
  { tipo: "boton", texto: "Volver al carrito", url: "${cart.url}" },
];
const sinCupon = (): Bloque[] => [
  { tipo: "titulo", texto: "¿Te olvidaste de algo?" },
  { tipo: "carrito", items: [] },
];

titulo("Sólo el mail que DECLARA el bloque pide cupón");
{
  chk("el mail con bloque `cupon` lo pide", pideCupon(conCupon()));
  chk("el 1º y el 2º de la secuencia NO lo piden", !pideCupon(sinCupon()));
  chk("y una lista vacía tampoco", !pideCupon([]));
}

titulo("🔴 Sin cupón emitido, el bloque DESAPARECE");
{
  const r = aplicarCuponDeCarrito(conCupon(), null);
  chk("no queda ningún bloque `cupon`", !r.some((b) => b.tipo === "cupon"));
  chk(
    "y el placeholder del preset no sobrevive en NINGÚN campo",
    !JSON.stringify(r).includes("CARRITO10"),
    JSON.stringify(r),
  );
  chk("el resto del mail queda entero", r.length === conCupon().length - 1);
  chk("y el botón al carrito sigue estando", r.some((b) => b.tipo === "boton"));
  // Un mail que no declara el bloque no cambia por pasar por acá.
  const intacto = aplicarCuponDeCarrito(sinCupon(), null);
  chk("un mail sin bloque `cupon` no se toca", JSON.stringify(intacto) === JSON.stringify(sinCupon()));
}

titulo("Con cupón emitido, se pisa el CÓDIGO y se anuncia el porcentaje EMITIDO");
{
  const r = aplicarCuponDeCarrito(conCupon(), {
    codigo: "BDI-K7M2QP", valor: 20, vence: "2026-08-28T23:59:00.000Z", minCompra: 0,
  });
  const b = r.find((x) => x.tipo === "cupon") as Extract<Bloque, { tipo: "cupon" }>;
  chk("el código es el real", b.codigo === "BDI-K7M2QP", b.codigo);
  chk("y no queda rastro del placeholder", !JSON.stringify(r).includes("CARRITO10"));
  // 🔴 El texto del preset dice "10% OFF" y el escalado emitió 20%: un titular
  // que nombra un porcentaje es de OTRO momento y se descarta, o el mail
  // anunciaría dos números distintos y uno sería falso.
  chk("el porcentaje anunciado es el EMITIDO, no el del preset", b.destacado === "20% OFF", b.destacado);
  chk("el titular con % del preset no sobrevive en NINGÚN campo", !JSON.stringify(b).includes("10% OFF"), JSON.stringify(b));
  chk("los otros bloques no se tocan", r.filter((x) => x.tipo !== "cupon").length === 2);
  chk("y la variante y el botón del bloque se conservan", b.botonTexto === "Usarlo" && b.botonUrl === "${cart.url}");
}

titulo("🔴 Cada cosa en SU campo: el mail tiene que poder darle jerarquía");
{
  // Hasta el 29-ago-2026 los tres textos iban en UNA línea unidos por " · ", y
  // el resultado se vio recién en Gmail: los tres a 14 px y sin negrita, o sea
  // el descuento leyéndose igual que el «no se acumula». Ningún ensayo lo podía
  // atrapar mirando el string —los tres SALÍAN—, así que lo que se fija acá es
  // que estén SEPARADOS, que es lo único que le deja al renderer darles tamaño
  // y peso distintos.
  const conTitular = (): Bloque[] => [
    { tipo: "cupon", texto: "Tu cupón por volver", codigo: "CARRITO10", botonTexto: "Usarlo", botonUrl: "${cart.url}" },
  ];
  const emitido = { codigo: "BDI-K7M2QP", valor: 20, vence: "2026-08-28T23:59:00.000Z", minCompra: 15000 };
  const b = aplicarCuponDeCarrito(conTitular(), emitido)[0] as Extract<Bloque, { tipo: "cupon" }>;
  chk("el titular queda SOLO en `texto`", b.texto === "Tu cupón por volver", b.texto);
  chk("el descuento va a `destacado`, sin nada más pegado", b.destacado === "20% OFF", b.destacado);
  chk("y la letra chica a `condiciones`", !!b.condiciones?.includes("No se acumula") && !!b.condiciones?.includes("15.000"), b.condiciones);
  // 🔴 La regresión exacta que se está arreglando: si alguno se volviera a unir
  // con " · ", el renderer no tendría cómo separarlos y volvería a salir plano.
  chk(
    "🔴 ningún campo trae DOS cosas pegadas con ' · '",
    !b.texto.includes(" · ") && !b.destacado!.includes(" · "),
    `texto="${b.texto}" destacado="${b.destacado}"`,
  );
  // Un titular vacío deja el campo vacío, no un separador colgando.
  const vacio = aplicarCuponDeCarrito(
    [{ tipo: "cupon", texto: "   ", codigo: "X", botonTexto: "", botonUrl: "" }],
    emitido,
  )[0] as Extract<Bloque, { tipo: "cupon" }>;
  chk("un titular vacío queda vacío, y el descuento sigue estando", vacio.texto === "" && vacio.destacado === "20% OFF", JSON.stringify(vacio));
  // El default del bloque (`nuevoBloque`) no habla de plata: tiene que pasar.
  const preset = aplicarCuponDeCarrito(
    [{ tipo: "cupon", texto: "Usá este código en el checkout", codigo: "X", botonTexto: "", botonUrl: "" }],
    emitido,
  )[0] as Extract<Bloque, { tipo: "cupon" }>;
  chk("el texto por defecto del bloque también sobrevive", preset.texto === "Usá este código en el checkout", preset.texto);
}

titulo("🔴 Y el HTML les da jerarquía DE VERDAD");
{
  // El oráculo del bug de Bruno: no alcanza con que los tres textos salgan, que
  // es lo que pasaba antes. El descuento tiene que salir **más grande y más
  // pesado** que el titular y que la letra chica, o vuelve a leerse como una
  // aclaración. Se mide sobre el HTML, que es lo único que llega a una casilla.
  const emitido = { codigo: "BDI-K7M2QP", valor: 20, vence: "2026-08-28T23:59:00.000Z", minCompra: 0 };
  const bl = aplicarCuponDeCarrito(
    [{ tipo: "cupon", texto: "Tu cupón por volver", codigo: "CARRITO10", botonTexto: "Usarlo", botonUrl: "#" }],
    emitido,
  );
  const html = renderEmailHtml({ v: 3, bloques: bl }, {
    unsubscribeUrl: "#", nombreCuenta: "Marca", logoCuenta: "", assetsBase: "https://x.test",
  });
  const trozo = (t: string) => {
    const i = html.indexOf(esc(t));
    const j = html.lastIndexOf("<div style=", i);
    return html.slice(j, i);
  };
  const num = (t: string, prop: string) => {
    const m = new RegExp(`${prop}:(\\d+)`).exec(trozo(t));
    return m ? Number(m[1]) : 0;
  };
  const tamTitular = num("Tu cupón por volver", "font-size");
  const tamDesc = num("20% OFF", "font-size");
  const tamChica = num("No se acumula", "font-size");
  const pesoDesc = num("20% OFF", "font-weight");
  chk("el descuento sale MÁS GRANDE que el titular", tamDesc > tamTitular, `${tamDesc} vs ${tamTitular}`);
  chk("y más grande que la letra chica", tamDesc > tamChica, `${tamDesc} vs ${tamChica}`);
  chk("🔴 y EN NEGRITA (>= 700)", pesoDesc >= 700, String(pesoDesc));
  chk("la letra chica es la más chica de las tres", tamChica < tamTitular, `${tamChica} vs ${tamTitular}`);
  // Y sale en el orden en que se lee: titular, premio, código, botón, letra chica.
  const orden = ["Tu cupón por volver", "20% OFF", "BDI-K7M2QP", "Usarlo", "No se acumula"].map((t) => html.indexOf(esc(t)));
  chk("y en ese orden en el HTML", orden.every((v, i) => v > 0 && (i === 0 || v > orden[i - 1])), JSON.stringify(orden));
}

titulo("Un cupón SIN los campos nuevos se dibuja como antes");
{
  // 🔴 Es lo que deja que la Bienvenida —ACTIVA, 3.708 envíos— no se mueva: su
  // bloque `cupon` no tiene `destacado` ni `condiciones`, y el renderer no puede
  // inventarle ninguno.
  const html = renderEmailHtml(
    { v: 3, bloques: [{ tipo: "cupon", texto: "Tu regalo", codigo: "BIENVENIDA10", botonTexto: "Comprar", botonUrl: "#" }] },
    { unsubscribeUrl: "#", nombreCuenta: "Marca", logoCuenta: "", assetsBase: "https://x.test" },
  );
  chk("dibuja el texto y el código", html.includes("Tu regalo") && html.includes("BIENVENIDA10"));
  chk("y NADA de la letra chica de fábrica", !html.includes("No se acumula"), "apareció una condición que el bloque no tiene");
}

titulo("🔴 La letra chica dice que NO SE ACUMULA");
{
  // El escalado existe para quien ya ganó un cupón en la ruleta, y el checkout
  // de TN toma UNO por orden. Sin esta línea la persona llega esperando sumar
  // los dos, no puede, y la culpa se la lleva la marca.
  const c = { codigo: "X", valor: 20, vence: "2026-08-28T23:59:00.000Z" };
  chk("siempre aparece", condicionesDe(c).includes("No se acumula"), condicionesDe(c));
  chk("aunque no haya vencimiento", condicionesDe({ codigo: "X", valor: 20, vence: null }).includes("No se acumula"));
  chk("aunque el vencimiento sea basura", condicionesDe({ codigo: "X", valor: 20, vence: "ayer" }).includes("No se acumula"));
  chk(
    "una fecha inválida no imprime 'Invalid Date'",
    !condicionesDe({ codigo: "X", valor: 20, vence: "ayer" }).toLowerCase().includes("invalid"),
    condicionesDe({ codigo: "X", valor: 20, vence: "ayer" }),
  );
  chk("la compra mínima aparece sólo si la hay", !condicionesDe(c).includes("mínima"));
  chk(
    "y cuando la hay, con el número",
    condicionesDe({ ...c, minCompra: 20000 }).includes("20.000"),
    condicionesDe({ ...c, minCompra: 20000 }),
  );
}

console.log(`\n${mal === 0 ? "✅ Todo en verde" : `❌ ${mal} fallas`} · ${ok} comprobaciones`);
process.exit(mal === 0 ? 0 : 1);
