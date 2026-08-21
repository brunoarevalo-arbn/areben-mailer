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
import type { Bloque } from "../lib/email/bloques.ts";

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

titulo("Con cupón emitido, se pisa el CÓDIGO y el PORCENTAJE");
{
  const r = aplicarCuponDeCarrito(conCupon(), {
    codigo: "BDI-K7M2QP", valor: 20, vence: "2026-08-28T23:59:00.000Z", minCompra: 0,
  });
  const b = r.find((x) => x.tipo === "cupon") as Extract<Bloque, { tipo: "cupon" }>;
  chk("el código es el real", b.codigo === "BDI-K7M2QP", b.codigo);
  chk("y no queda rastro del placeholder", !JSON.stringify(r).includes("CARRITO10"));
  // 🔴 El texto del preset dice "10% OFF" y el escalado emitió 20%: si el texto
  // no se pisara, el mail anunciaría la mitad de lo que el cupón descuenta.
  chk("el porcentaje anunciado es el EMITIDO, no el del preset", b.texto.startsWith("20% OFF"), b.texto);
  chk("los otros bloques no se tocan", r.filter((x) => x.tipo !== "cupon").length === 2);
  chk("y la variante y el botón del bloque se conservan", b.botonTexto === "Usarlo" && b.botonUrl === "${cart.url}");
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
