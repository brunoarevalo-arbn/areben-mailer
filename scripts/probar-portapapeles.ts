// Copiar y pegar bloques entre marcas. Lógica pura: sin base, sin red, sin DOM.
//
//   node --import tsx scripts/probar-portapapeles.ts
//
// Por qué existe: el portapapeles es la **segunda puerta** por la que entra un
// Json de mail al editor, y a diferencia de la primera —la base, que la escribió
// esta misma app— acá adentro puede haber literalmente cualquier cosa: lo que la
// persona copió antes, el mail de otro, un archivo. Lo que se prueba es que
// nada de eso pueda pasar por bloques, y que lo que SÍ es nuestro sobreviva el
// viaje entero.
//
// 🔴 El caso caro es el `tipo` desconocido. `leerContenido` lo tira, pero tiene
// un camino rápido para los documentos que ya declaran la versión actual (existe
// para no rehacer el saneo en cada render) y el `v` del sobre lo escribe quien
// quiera: un `tipo` inventado que se colara deja `ICONO[b.tipo]` en `undefined`
// y `ListaBloques` se cae con la pantalla en blanco.

import { armarClip, leerClip } from "../lib/email/portapapeles";
import { duplicarBloque, nuevoBloque, type Bloque } from "../lib/email/bloques";
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

const sobre = (extra: Record<string, unknown>) =>
  JSON.stringify({ app: "areben-mailer/bloques@1", ...extra });

titulo("Ida y vuelta: lo que se copia es lo que se pega");
{
  const b = { ...nuevoBloque("seccion"), titulo: "Sweaters 30% off" } as Bloque;
  const p = leerClip(armarClip([b], "Zattia"));
  ok(p !== null, "un clip propio se reconoce");
  ok(p?.bloques.length === 1, "vuelve un bloque");
  ok(p?.bloques[0].tipo === "seccion", "con su tipo");
  ok(
    p?.bloques[0].tipo === "seccion" && p.bloques[0].titulo === "Sweaters 30% off",
    "y con lo que se había escrito adentro",
  );
  ok(p?.marca === "Zattia", "el sobre se acuerda de qué marca vino");
}

titulo("Los estilos del bloque cruzan enteros");
{
  // Es la mitad del valor de la tanda: rehacer los estilos a mano en la otra
  // marca es exactamente la fricción que esto viene a sacar. El token `$acento`
  // se repinta con la paleta del destino y el hex clavado llega clavado — esa
  // distinción la resuelve la cascada, acá lo único que importa es que llegue.
  const b = { ...nuevoBloque("titulo"), estilo: { titulo: { color: "$acento", tam: 28 } } } as Bloque;
  const p = leerClip(armarClip([b]));
  ok(p?.bloques[0].estilo?.titulo?.color === "$acento", "el token de marca sobrevive");
  ok(p?.bloques[0].estilo?.titulo?.tam === 28, "y el tamaño elegido también");
  ok(p?.marca === undefined, "sin marca declarada, no se inventa ninguna");
}

titulo("Lo que NO es nuestro se devuelve al navegador (null)");
{
  ok(leerClip("") === null, "vacío");
  ok(leerClip("Hola, te escribo por el pedido") === null, "un texto cualquiera");
  ok(leerClip("https://zattia.com.ar/productos") === null, "una URL");
  ok(leerClip("{ no es json") === null, "algo que arranca con { y no parsea");
  ok(leerClip('{"bloques":[{"tipo":"titulo"}]}') === null, "un Json de mail SIN el sobre");
  ok(leerClip(sobre({ app: "otra-app" })) === null, "un sobre de otra app");
  ok(leerClip(sobre({ contenido: { v: V_ACTUAL, bloques: [] } })) === null, "un sobre sin bloques");
  ok(leerClip(sobre({ contenido: "texto" })) === null, "un sobre con el contenido roto");
  ok(leerClip(sobre({})) === null, "un sobre sin contenido");
  ok(leerClip(JSON.stringify([1, 2, 3])) === null, "un array");
}

titulo("🔴 Un `tipo` inventado NO llega a la lista de bloques");
{
  // Con el `v` actual, `leerContenido` entra por el camino rápido y devuelve el
  // documento tal cual: si el filtro no viviera en `leerClip`, esto pasaría.
  const p = leerClip(
    sobre({ contenido: { v: V_ACTUAL, bloques: [{ id: "x", tipo: "iframe-malicioso", src: "..." }] } }),
  );
  ok(p === null, "un sobre con un solo bloque de tipo desconocido no pega nada");

  const mixto = leerClip(
    sobre({
      contenido: {
        v: V_ACTUAL,
        bloques: [{ id: "a", tipo: "no-existe" }, { ...nuevoBloque("texto"), id: "b" }],
      },
    }),
  );
  ok(mixto?.bloques.length === 1, "mezclado con uno bueno, se cae solo el desconocido");
  ok(mixto?.bloques[0].tipo === "texto", "y el bueno queda");

  const basura = leerClip(
    sobre({ contenido: { v: V_ACTUAL, bloques: [null, 7, "titulo", [], { ...nuevoBloque("boton") }] } }),
  );
  ok(basura?.bloques.length === 1, "lo que ni siquiera es un objeto se descarta");
}

titulo("El tope de bloques por pegada");
{
  const muchos = Array.from({ length: 200 }, () => nuevoBloque("divisor"));
  const p = leerClip(armarClip(muchos));
  ok((p?.bloques.length ?? 0) <= 50, `${p?.bloques.length} bloques: no pasa de 50`);
}

titulo("🔴 Los ids: la garantía es `duplicarBloque`, y NO es opcional");
{
  // ⚠️ **`leerClip` no promete ids únicos y no puede prometerlos.** Medido al
  // escribir esto: `leerContenido` tiene un camino rápido (`esActual`) que
  // devuelve el documento tal cual cuando el `v` ya es el actual, y ese chequeo
  // **no mira los ids repetidos**. Así que un sobre con dos ids iguales sale con
  // dos ids iguales — y el sobre lo escribe el portapapeles, no nosotros.
  //
  // Lo que cierra el agujero es el paso siguiente en `EditorMail`: **todo bloque
  // pegado pasa por `duplicarBloque`**, que le pone un id nuevo a cada uno. Sin
  // eso, pegar dos veces el mismo bloque deja dos con el mismo id: React colapsa
  // las dos tarjetas en una y el panel edita la equivocada. Se prueba la cadena
  // entera, que es lo que corre de verdad.
  const p = leerClip(
    sobre({
      contenido: {
        v: V_ACTUAL,
        bloques: [{ ...nuevoBloque("texto"), id: "mismo" }, { ...nuevoBloque("boton"), id: "mismo" }],
      },
    }),
  );
  ok(p?.bloques.length === 2, "entran los dos");

  // El documento de destino, con un id que además choca con el del sobre.
  const destino = [{ ...nuevoBloque("titulo"), id: "mismo" } as Bloque];
  const pegados = (p?.bloques ?? []).map(duplicarBloque);
  const ids = [...destino, ...pegados].map((b) => b.id);
  ok(new Set(ids).size === ids.length, "después de `duplicarBloque` no queda un id repetido");
  ok(pegados.every((b) => b.id !== "mismo"), "ni uno solo conserva el id del origen");

  // Pegar DOS veces el mismo clip: el caso que motiva todo esto.
  const otraVez = (p?.bloques ?? []).map(duplicarBloque);
  const todos = [...pegados, ...otraVez].map((b) => b.id);
  ok(new Set(todos).size === todos.length, "pegar el mismo clip dos veces da cuatro ids distintos");
}

titulo("Un sobre de un deploy VIEJO se migra en vez de romperse");
{
  // Las dos pestañas pueden estar en deploys distintos, que es el caso normal
  // el día de un deploy. Por eso el `v` viaja adentro del sobre y no se asume.
  const p = leerClip(
    sobre({ contenido: { v: 3, bloques: [{ id: "c", tipo: "columnas", izq: { imagen: "a.jpg", url: "" }, der: { imagen: "b.jpg", url: "" } }] } }),
  );
  ok(p?.bloques.length === 1, "el bloque en forma vieja entra igual");
  ok(
    p?.bloques[0].tipo === "columnas" && Array.isArray(p.bloques[0].celdas) && p.bloques[0].celdas.length === 2,
    "y llega en la forma actual (`celdas`), no con `izq`/`der`",
  );
}

titulo("🔴 Lo pegado no comparte memoria con lo copiado");
{
  // La otra mitad de la garantía de `duplicarBloque`: además de un id nuevo,
  // tiene que dar un objeto NUEVO hasta el fondo. Un `columnas` pegado que
  // compartiera el array `celdas` con el original haría que editar el de abajo
  // le cambiara la foto al de arriba, en la misma pestaña y sin aviso.
  const original = nuevoBloque("columnas");
  const p = leerClip(armarClip([original], "BDI Accesorios"));
  const [pegado] = (p?.bloques ?? []).map(duplicarBloque);

  ok(pegado?.tipo === "columnas", "el bloque pegado sigue siendo `columnas`");
  if (pegado?.tipo === "columnas" && original.tipo === "columnas") {
    pegado.celdas[0].imagen = "https://ejemplo.com/pisada.jpg";
    ok(original.celdas[0].imagen === "", "editar la celda del pegado no toca la del copiado");

    // Y dos pegadas del mismo clip tampoco se pisan entre ellas.
    const [a] = (leerClip(armarClip([original], "BDI"))?.bloques ?? []).map(duplicarBloque);
    const [b] = (leerClip(armarClip([original], "BDI"))?.bloques ?? []).map(duplicarBloque);
    if (a?.tipo === "columnas" && b?.tipo === "columnas") {
      a.celdas[0].url = "https://ejemplo.com/a";
      ok(b.celdas[0].url === "", "dos pegadas del mismo clip no comparten celdas");
    }
  }
}

titulo("El texto que se pone en el portapapeles se puede leer");
{
  // Si alguien lo pega en una nota o en un mail, tiene que verse algo que se
  // entiende y que se puede volver a pegar acá, no una línea de 4 KB.
  const txt = armarClip([nuevoBloque("cupon")], "BDI Accesorios");
  ok(txt.includes("\n"), "sale con sangría");
  ok(txt.includes("BDI Accesorios"), "dice de qué marca salió");
  ok(leerClip(txt) !== null, "y se vuelve a leer");
}

console.log(fallas === 0 ? "\n✅ Todo en verde" : `\n❌ ${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
