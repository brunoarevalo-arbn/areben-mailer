// Arma una campaña BORRADOR con los tres bloques nuevos, para mirarlos en un
// buzón de verdad (T2 `foto-encima`, T3 `mosaico`, T4 `regresiva`).
//
//   node --env-file=.env --import tsx scripts/crear-campania-prueba-bloques.ts [--slug=bdi] [--dias=4]
//
// 🔴 **No manda nada.** Deja la campaña en BORRADOR: el envío lo dispara una
// persona desde el panel con "Enviar prueba". Y toca la base UNA vez —Neon está
// al filo de los 100 CU-h y es compartida con Resorty—, así que lee y escribe en
// la misma corrida en vez de en dos.
//
// ⚠️ El `mosaico` queda **sin cortar** a propósito: apretar "Cortar la foto" es
// justamente el paso que nunca se ejerció (sube los pedazos a Blob y escribe
// filas en `ImagenMail`), así que tiene que hacerlo quien prueba. La grilla ya
// está marcada en cuatro zonas con su texto alternativo y su link para que ese
// sea el único paso que quede.
import { prisma } from "../lib/prisma";
import { nuevoBloque, type Bloque } from "../lib/email/bloques";
import { leerContenido, V_ACTUAL } from "../lib/email/esquema";
import { renderEmailHtml } from "../lib/email/render";
import { marcaDe } from "../lib/marca";
import { PREFIJO_PEDAZO } from "../lib/email/mosaico";
import { horaLocal } from "../lib/fechas";

const arg = (n: string, def: string) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? def;

const SLUG = arg("slug", "bdi");
const DIAS = Number(arg("dias", "4"));

async function main() {
  const cuenta = await prisma.cuenta.findUnique({ where: { slug: SLUG } });
  if (!cuenta) throw new Error(`No existe la cuenta "${SLUG}"`);
  console.log(`Cuenta: ${cuenta.nombre} (${cuenta.slug})`);

  // Fotos de la biblioteca de esa marca, sin los pedazos de un mosaico anterior
  // (mismo filtro que `/api/imagenes`, y en el WHERE por la misma razón).
  const fotos = await prisma.imagenMail.findMany({
    where: { cuentaId: cuenta.id, NOT: { nombre: { startsWith: PREFIJO_PEDAZO } } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  if (fotos.length === 0) {
    throw new Error("La biblioteca de imágenes de esta marca está vacía: subí una foto antes.");
  }
  console.log(`Fotos en la biblioteca: ${fotos.length}`);

  // Para la banda con cosas encima conviene una foto ancha; para la que se corta
  // en pedazos, una alta —así las cuatro zonas se ven como zonas y no como una
  // tira—. Si no hay medidas, cae a "la más reciente" y se ve igual.
  const conMedidas = fotos.filter((f) => f.ancho && f.alto);
  const ancha = conMedidas.sort((a, b) => b.ancho! / b.alto! - a.ancho! / a.alto!)[0] ?? fotos[0];
  const alta = conMedidas.sort((a, b) => a.ancho! / a.alto! - b.ancho! / b.alto!)[0] ?? fotos[0];
  console.log(`  banda:   ${ancha.nombre} (${ancha.ancho}×${ancha.alto})`);
  console.log(`  pedazos: ${alta.nombre} (${alta.ancho}×${alta.alto})`);

  const tienda = marcaDe(cuenta, process.env.APP_URL ?? "").urlCuenta || "https://www.bdiaccesorios.com.ar";
  const hasta = new Date(Date.now() + DIAS * 86_400_000);
  hasta.setSeconds(0, 0);

  const b = <T extends Bloque["tipo"]>(tipo: T, campos: Record<string, unknown> = {}) =>
    ({ ...nuevoBloque(tipo), ...campos }) as Bloque;

  const bloques: Bloque[] = [
    b("encabezado"),
    b("titulo", { texto: "Prueba de los tres bloques nuevos" }),
    b("texto", {
      texto:
        "Este mail existe para mirarlo en Gmail web, Gmail del celular y **Outlook de escritorio**. Abajo van los tres bloques, en orden.",
    }),

    // T2 — dos botones en ESQUINAS DISTINTAS, que es el caso que decide si la
    // tabla de adentro del `<v:rect>` está bien: con uno solo no se nota.
    b("titulo", { texto: "1 · Foto con textos encima" }),
    b("foto-encima", {
      foto: ancha.url,
      bg: "#111111",
      velo: 35,
      elementos: [
        { id: "pe-tit", clase: "titulo", texto: "Lo que va encima de la foto", x: 6, y: 15, ancho: 60 },
        { id: "pe-b1", clase: "boton", texto: "Arriba a la derecha", url: tienda, x: 55, y: 5, ancho: 40 },
        { id: "pe-b2", clase: "boton", texto: "Abajo a la izquierda", url: tienda, x: 6, y: 80, ancho: 40 },
      ],
    }),

    // T3 — la grilla ya marcada en cuatro zonas, pero SIN cortar: el botón
    // "Cortar la foto" es el paso que falta ejercer.
    b("titulo", { texto: "2 · Foto en pedazos (hay que apretar «Cortar la foto»)" }),
    b("mosaico", {
      foto: alta.url,
      ratio: alta.ancho && alta.alto ? alta.alto / alta.ancho : undefined,
      filas: [
        {
          alto: 50,
          celdas: [
            { ancho: 50, alt: "Zona de arriba a la izquierda", enlace: tienda },
            { ancho: 50, alt: "Zona de arriba a la derecha", enlace: tienda },
          ],
        },
        {
          alto: 50,
          celdas: [
            { ancho: 50, alt: "Zona de abajo a la izquierda", enlace: tienda },
            { ancho: 50, alt: "Zona de abajo a la derecha", enlace: tienda },
          ],
        },
      ],
    }),

    // T4 — la cuenta regresiva, con una fecha lo bastante lejos como para que
    // siga corriendo cuando la abran, y lo bastante cerca como para que los días
    // sean un número chico y se note si cambia.
    b("titulo", { texto: "3 · Cuenta regresiva" }),
    b("regresiva", { hasta: hasta.toISOString() }),
    b("texto", {
      texto:
        "El contador de arriba se dibuja **cada vez que se abre este mail**. La línea que dice hasta cuándo es lo único que queda con las imágenes bloqueadas.",
    }),
  ];

  const contenido = { v: V_ACTUAL, bloques };

  // Antes de escribir nada: que el documento pase el saneo y que el motor lo
  // dibuje. Un borrador que rompe el editor es peor que no crearlo.
  const leido = leerContenido(contenido);
  const html = renderEmailHtml(leido, {
    unsubscribeUrl: "#",
    ...marcaDe(cuenta, process.env.APP_URL ?? ""),
  });
  const tieneRegresiva = html.includes("/api/regresiva?");
  console.log(`\nHTML: ${(html.length / 1024).toFixed(1)} KB · cuenta regresiva en el HTML: ${tieneRegresiva ? "sí" : "NO"}`);
  if (!tieneRegresiva) throw new Error("El bloque de cuenta regresiva no salió en el HTML: no creo nada.");

  const campania = await prisma.campania.create({
    data: {
      cuentaId: cuenta.id,
      nombre: `PRUEBA · bloques nuevos (${new Date().toISOString().slice(0, 10)})`,
      asunto: "Prueba de los tres bloques nuevos",
      preheader: "Foto con textos encima, foto en pedazos y cuenta regresiva",
      contenido: leido as unknown as object,
      estado: "BORRADOR",
    },
  });

  console.log(`\n✅ Campaña creada en BORRADOR`);
  console.log(`   id:    ${campania.id}`);
  console.log(`   link:  ${process.env.APP_URL ?? "https://areben-mailer.vercel.app"}/campanias/${campania.id}`);
  console.log(`   la cuenta regresiva termina el ${horaLocal(hasta)}`);
  console.log(`\n   Falta a mano: abrir el bloque «Foto en pedazos» y apretar «Cortar la foto».`);
}

main()
  .catch((e) => {
    console.error(`\n❌ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
