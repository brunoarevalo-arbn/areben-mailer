// Invariantes de la biblioteca de imágenes. Análisis del código, sin base ni red.
//
//   node --import tsx scripts/probar-imagenes.ts
//
// Los dos endpoints de /api/imagenes escriben en un store que se paga y borran
// filas de otra gente si el WHERE está mal. No hay suite de tests, así que lo
// que se puede verificar sin levantar nada se verifica leyendo el código: es la
// misma idea que auditar-permisos.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const raiz = join(import.meta.dirname, "..");
const leer = (p: string) => readFileSync(join(raiz, p), "utf8");

const lista = leer("app/api/imagenes/route.ts");
const detalle = leer("app/api/imagenes/[id]/route.ts");
const cliente = leer("lib/imagenes.ts");
const schema = leer("prisma/schema.prisma");
const migracion = leer("scripts/add-imagenes-mail.ts");

// ─── Permisos ────────────────────────────────────────────────────────────────
titulo("Todo endpoint declara su permiso");
{
  ok(/autorizarApi\(['"]ver['"]\)/.test(lista), "GET pide `ver`");
  ok(/autorizarApi\(['"]editar['"]\)/.test(lista), "POST pide `editar`");
  ok(/autorizarApi\(['"]editar['"]\)/.test(detalle), "DELETE pide `editar`");
  // Sin el early return, `ctx` sería una Response y el código seguiría igual.
  ok(
    (lista.match(/if \(ctx instanceof Response\) return ctx;/g) ?? []).length === 2,
    "los dos handlers de la lista cortan cuando no hay permiso",
  );
  ok(detalle.includes("if (ctx instanceof Response) return ctx;"), "el DELETE también corta");
  ok(!/getCuentaActiva/.test(lista + detalle), "no se usa getCuentaActiva (no sabe quién pide)");
}

// ─── Multi-tenant ────────────────────────────────────────────────────────────
titulo("Una marca no ve ni borra las imágenes de otra");
{
  // Lo que importa no es que se chequee la cuenta: es que el `cuentaId` esté en
  // el WHERE. Con un findUnique por id suelto, el chequeo posterior se puede
  // olvidar en el próximo cambio y nadie se entera.
  // ⚠️ El WHERE puede llevar MÁS condiciones (desde el 18-ago-2026 excluye los
  // pedazos de un mosaico, ver `PREFIJO_PEDAZO`), así que la aserción termina en
  // "coma o llave" y no en "llave". Lo que se exige sigue siendo lo mismo: que el
  // `cuentaId` esté ADENTRO del WHERE y no en un chequeo posterior.
  ok(
    /findMany\(\{\s*where: \{ cuentaId: ctx\.cuenta\.id[,}]/.test(lista),
    "el listado filtra por cuentaId",
  );
  ok(
    /aggregate\(\{\s*where: \{ cuentaId: ctx\.cuenta\.id \}/.test(lista),
    "el contador de consumo también",
  );
  ok(
    /findFirst\(\{\s*where: \{ id, cuentaId: ctx\.cuenta\.id \}/.test(detalle),
    "el borrado busca por (id, cuentaId), no por id solo",
  );
  ok(!/findUnique\(\{ where: \{ id \}/.test(detalle), "no hay findUnique por id pelado");
  ok(
    /cuentaId: ctx\.cuenta\.id/.test(lista) && !/cuentaId: (form|body|req)/.test(lista),
    "la cuenta sale de la sesión, nunca del request",
  );
  ok(/mail\/\$\{ctx\.cuenta\.id\}/.test(lista), "el pathname del blob arranca por la cuenta");
}

// ─── Lo que se puede subir ───────────────────────────────────────────────────
titulo("La lista blanca de formatos");
{
  for (const t of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
    ok(lista.includes(`'${t}'`), `${t} está permitido`);
  }
  // ⛔ El que importa: un SVG es un archivo con <script> adentro, servido desde
  // un dominio propio. Y encima ningún cliente de mail lo rasteriza confiable.
  ok(!lista.includes("image/svg"), "⛔ SVG NO está en la lista");
  ok(
    !/archivo\.type\.startsWith\(['"]image\//.test(lista),
    "no se acepta cualquier image/* (eso dejaría pasar el SVG)",
  );
  ok(/TIPOS\.has\(archivo\.type\)/.test(lista), "el tipo se valida contra el Set");
  ok(/EXT\[archivo\.type\]/.test(lista), "la extensión sale del MIME, no del nombre del archivo");
}

titulo("El tope de tamaño");
{
  ok(/MAX_BYTES = 5 \* 1024 \* 1024/.test(lista), "el servidor corta en 5 MB");
  ok(/archivo\.size > MAX_BYTES/.test(lista), "y lo aplica");
  ok(/MAX_BYTES = 5 \* 1024 \* 1024/.test(cliente), "el navegador corta en el mismo número");
  // 🔑 **Desde el 11-ago-2026 el tope del cliente se mide sobre lo que SE SUBE,
  // no sobre lo elegido**: el navegador achica primero (una foto de celular de 7
  // MB queda en cientos de KB), así que rechazarla de entrada era una pared
  // puesta por el paso que la resolvía. Lo que no cambió es la invariante que
  // este renglón cuida: **al servidor no se le manda algo que va a rechazar**.
  ok(/subir\.size > MAX_BYTES/.test(cliente), "y no manda al servidor algo que va a rechazar");
  ok(
    /TOPE_DECODIFICA/.test(cliente) && /file\.size > TOPE_DECODIFICA/.test(cliente),
    "hay un techo ANTES de decodificar: abrir 40 MB en un canvas cuelga la pestaña",
  );
}

titulo("El re-encode no arruina la foto");
{
  // Las tres trampas del canvas, cada una de las cuales rompe la imagen en la
  // casilla de otra persona y sin forma de volver atrás.
  ok(/esGif|image\/gif/.test(cliente), "un GIF se detecta");
  ok(
    /if \(esGif\(mime\)\) return null/.test(cliente),
    "y no se re-encodea nunca: el canvas se come la animación",
  );
  ok(
    /mime === 'image\/png' \? 'image\/png'/.test(cliente),
    "un PNG sigue siendo PNG: a JPEG, lo transparente sale NEGRO",
  );
  ok(
    /blob\.type === 'image\/png'/.test(cliente),
    "la extensión sale del type REAL del blob (Safari devuelve PNG cuando no puede dar el pedido)",
  );
  ok(
    /crossOrigin = 'anonymous'/.test(cliente),
    "y el crossOrigin se pone antes del src, o el canvas queda contaminado",
  );
}

// ─── El contador de consumo ──────────────────────────────────────────────────
titulo("El consumo se mide desde el día uno");
{
  // Blob se paga, y el egress de una imagen se paga POR DESTINATARIO: un envío
  // de 16.800 con cinco imágenes es ancho de banda de verdad. La cuota puede
  // venir después; la medición no se retrofitea.
  ok(/"bytes"\s+INTEGER NOT NULL/.test(migracion), "la tabla guarda los bytes");
  ok(/bytes: archivo\.size/.test(lista), "cada subida los registra");
  ok(/_sum: \{ bytes: true \}/.test(lista), "el GET devuelve el total por cuenta");
  ok(
    /take: 200/.test(lista) && /truncado/.test(lista),
    "y avisa si la lista viene cortada (el total es de todas, no de la página)",
  );
}

// ─── Blob y base no se desincronizan ─────────────────────────────────────────
titulo("Borrar borra en los dos lados");
{
  const iDel = detalle.indexOf("await del(");
  const iPrisma = detalle.indexOf("imagenMail.delete");
  ok(iDel > 0 && iPrisma > iDel, "primero el blob, después la fila");
  ok(/} catch {/.test(detalle), "si el blob ya no está, la fila igual se limpia");
  ok(/pathname/.test(schema), "la fila guarda el pathname para poder borrarlo");
}

// ─── La base compartida ──────────────────────────────────────────────────────
titulo("La base es compartida con Resorty");
{
  ok(/CREATE TABLE IF NOT EXISTS "ImagenMail"/.test(migracion), "la tabla se crea por SQL crudo");
  // Sin comentarios: el propio script explica en su cabecera por qué NO usa
  // `db push`, y buscarlo con la explicación adentro es fallar por documentarse.
  const codigo = migracion.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  ok(!/db push|\$executeRaw\w*\(`?\s*DROP/i.test(codigo), "el script no dropea nada ni invoca db push");
  ok(/model ImagenMail/.test(schema), "el schema.prisma la refleja a mano");
  ok(!/model Imagen\b/.test(schema), '⛔ no se llama "Imagen" a secas: el esquema es de dos productos');
}

console.log(fallas === 0 ? "\n✅ Imágenes OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
