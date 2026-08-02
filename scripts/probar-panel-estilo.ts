// ¿Cada control del panel de estilo mueve algo en el mail?
//
// El panel arma sus controles con `ROLES_POR_TIPO` y `propsDeRol`, que son las
// tablas que dicen qué emite el renderer. Una tabla que dice de más produce
// **una perilla desconectada**: no falla, no avisa,
// simplemente no pasa nada — y quien la mueve concluye que el mail está roto.
//
// Este script no lee el renderer, lo EJERCITA: por cada control que el panel
// ofrece, renderiza el bloque con y sin esa propiedad y exige que el HTML
// cambie. Si mañana alguien reescribe un `case` y deja de emitir algo, esto se
// pone rojo el mismo día.
//
// De yapa lista lo contrario: propiedades que el renderer SÍ respeta y el panel
// no está ofreciendo. Eso no es un error —puede ser a propósito— pero es
// exactamente la lista de lo que se podría sumar sin tocar el motor.
//
//   node --import tsx scripts/probar-panel-estilo.ts

import {
  ROLES, ROLES_POR_TIPO, propsDeRol,
  type EstiloBloque, type Estilos, type RolEstilo,
} from "../lib/email/estilos";
import { TIPOS_BLOQUE, nuevoBloque, renderEmailHtml, type Bloque, type TipoBloque } from "../lib/email/render";
import { claveProductos } from "../lib/email/bloques";

/** El producto de prueba, para los tres bloques que dibujan productos. */
const PRODUCTO = [
  { nombre: "Producto", precio: "1000", imagen: "https://ejemplo.com/p.jpg", url: "#", variante: "Rojo", cantidad: 2 },
];

let fallas = 0;

/**
 * Valores de prueba por propiedad: los que tienen que hacer cambiar el HTML.
 *
 * Van **listas y no un valor suelto** para los enums cortos: `bordeEstilo` sale
 * punteado en el cupón y lleno en el divisor, así que cualquier valor único
 * coincide con el default de alguno y ese control pasaría por desconectado sin
 * estarlo. Alcanza con que UNO de los candidatos mueva algo.
 *
 * El resto son valores que pasan el saneador (están adentro de `RANGOS`) y que
 * ningún bloque usa de fábrica.
 */
const VALORES: Record<string, readonly unknown[]> = {
  color: ["#123456"],
  fondo: ["#654321"],
  bordeColor: ["#abcdef"],
  tamano: [41],
  peso: [500],
  interlinea: [2.1],
  espaciado: [7],
  align: ["right", "center"],
  mayusculas: [true],
  subrayado: [true],
  padX: [61],
  padY: [59],
  radio: [27],
  bordeAncho: [7],
  bordeEstilo: ["solid", "dashed"],
  fuente: ["georgia"],
  ocultarMovil: [true],
  ocultarEscritorio: [true],
};

/** Un bloque de cada tipo, con contenido adentro: uno vacío no dibuja nada. */
function muestra(tipo: TipoBloque): Bloque {
  const b = nuevoBloque(tipo) as Record<string, unknown>;
  if (tipo === "imagen" || tipo === "video") b.imagen = b.url = "https://ejemplo.com/f.jpg";
  if (tipo === "hero") b.imagen = "https://ejemplo.com/f.jpg";
  if (tipo === "boton") b.url = "https://ejemplo.com";
  if (tipo === "seccion" || tipo === "cupon") { b.botonTexto = "Comprar"; b.botonUrl = "https://ejemplo.com"; }
  if (tipo === "columnas") {
    // "imagen-texto" ejercita los dos tipos de celda en el mismo fixture: la
    // izquierda dibuja imagen (rol `imagen`) y la derecha texto (`titulo` y
    // `cuerpo`). Con la variante por defecto ("imagenes") los roles de texto
    // nunca tendrían nada que mostrar, sea cual sea el estilo.
    b.variante = "imagen-texto";
    // El botón va en la celda de foto y no en las dos: así el fixture ejercita
    // a la vez el rol `boton` y la celda que SÍ queda envuelta en su ancla.
    b.celdas = [
      { imagen: "https://ejemplo.com/a.jpg", url: "https://ejemplo.com", botonTexto: "Comprar", botonUrl: "https://ejemplo.com" },
      { titulo: "Título", texto: "Texto", url: "https://ejemplo.com" },
    ];
  }
  if (tipo === "productos" || tipo === "carrito") b.items = PRODUCTO;
  if (tipo === "redes") b.links = [{ red: "Instagram", url: "https://instagram.com/x" }];
  if (tipo === "menu") b.links = [{ texto: "Inicio", url: "https://ejemplo.com" }];
  if (tipo === "html") b.contenido = "<p>Hola</p>";
  return b as unknown as Bloque;
}

const render = (b: Bloque, estilo?: Estilos) => {
  const bl = estilo ? ({ ...b, estilo } as Bloque) : b;
  return renderEmailHtml(
    { v: 3, bloques: [bl] },
    {
      unsubscribeUrl: "#",
      muestraCarrito: false,
      nombreCuenta: "Marca",
      logoCuenta: "",
      urlCuenta: "",
      // `productos-dinamicos` NO guarda productos adentro: se los pasa el envío
      // por `opts`. Sin esto el bloque sale vacío y los 17 controles de estilo
      // que sí funcionan se leerían como perillas desconectadas.
      productosDinamicos:
        bl.tipo === "productos-dinamicos" ? { [claveProductos(bl)]: PRODUCTO } : undefined,
      // El bloque `html` está gateado por cuenta: sin esto, CUALQUIER estilo de
      // `caja` se leería como desconectado, porque el bloque ni se dibuja.
      permiteHtmlCrudo: bl.tipo === "html",
    },
  );
};

/** ¿Poner `rol.prop` cambia el HTML de este bloque, con alguno de sus valores? */
function mueve(tipo: TipoBloque, rol: RolEstilo, prop: keyof EstiloBloque): boolean {
  const b = muestra(tipo);
  const base = render(b);
  return (VALORES[prop] ?? []).some((v) => render(b, { [rol]: { [prop]: v } } as Estilos) !== base);
}

console.log("\nControles que el panel ofrece y NO mueven nada:");
for (const tipo of TIPOS_BLOQUE) {
  for (const rol of ROLES_POR_TIPO[tipo]) {
    for (const prop of propsDeRol(tipo, rol)) {
      if (!mueve(tipo, rol, prop)) {
        fallas++;
        console.error(`  ✗ ${tipo} · ${rol}.${String(prop)} — el panel lo ofrece y el mail no cambia`);
      }
    }
  }
}
if (!fallas) console.log("  (ninguno)");

console.log("\nPropiedades que el renderer respeta y el panel no ofrece (informativo):");
const sueltas: string[] = [];
for (const tipo of TIPOS_BLOQUE) {
  for (const rol of ROLES) {
    const ofrecidas = new Set<string>(
      (ROLES_POR_TIPO[tipo] as readonly RolEstilo[]).includes(rol)
        ? (propsDeRol(tipo, rol) as readonly string[])
        : [],
    );
    for (const prop of Object.keys(VALORES) as (keyof EstiloBloque)[]) {
      if (ofrecidas.has(prop)) continue;
      if (mueve(tipo, rol, prop)) sueltas.push(`${tipo} · ${rol}.${String(prop)}`);
    }
  }
}
console.log(sueltas.length ? sueltas.map((s) => `  · ${s}`).join("\n") : "  (ninguna)");

console.log();
if (fallas) {
  console.error(`❌ ${fallas} control${fallas === 1 ? "" : "es"} desconectado${fallas === 1 ? "" : "s"}.\n`);
  process.exit(1);
}
console.log("✅ Todo control que el panel muestra mueve algo en el mail.\n");
