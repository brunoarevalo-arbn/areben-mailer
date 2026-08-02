// La marca que entra sola desde Tiendanube. Lógica pura: sin base, sin red.
//
//   node --import tsx scripts/probar-marca.ts
//
// Tres cosas que tienen que ser ciertas para que esto sirva de algo:
//
//   1. **La marca no se guarda adentro del Json.** Si el logo quedara clavado en
//      el bloque, una plantilla compartida saldría con el logo de otra tienda —
//      la versión visual del bug donde la bienvenida de Zattia saludaba en
//      nombre de "BDI Accesorios".
//   2. **Nadie ve cambiar su mail sin pedirlo.** Una cuenta sin logo cargado
//      tiene que renderizar exactamente lo que renderizaba ayer, y una elección
//      explícita ("quiero el nombre, no el logo") manda sobre lo que trajo TN.
//   3. **Traer la marca no pisa lo que ya estaba.** El `config` es un Json
//      compartido: adentro viven el tema y la fecha del último sync.

import { normalizarStore } from "../lib/tn/client";
import { configConTienda, leerConfigCuenta, marcaDe } from "../lib/marca";
import { renderEmailHtml } from "../lib/email/render";
import { V_ACTUAL } from "../lib/email/esquema";
import type { ContenidoCampania } from "../lib/email/render";

let fallas = 0;
const ok = (cond: boolean, que: string, detalle = "") => {
  if (cond) console.log(`  ✓ ${que}`);
  else {
    fallas++;
    console.error(`  ✗ ${que}${detalle ? `\n      ${detalle}` : ""}`);
  }
};
const titulo = (s: string) => console.log(`\n${s}`);

const BAJA = "https://ejemplo.com/baja?token=abc";
/** El fallback de `hostDeEnvio`, que `marcaDe` pide por parámetro (nunca de `process.env`). */
const APP = "https://areben-mailer.vercel.app";
const render = (c: unknown, opts: Record<string, unknown> = {}) =>
  renderEmailHtml(c as ContenidoCampania, {
    unsubscribeUrl: BAJA,
    nombreCuenta: "Marca Uno",
    ...opts,
  } as Parameters<typeof renderEmailHtml>[1]);

/** Lo que TN devolvió de verdad para Zattia el 29-jul-2026, recortado. */
const STORE_REAL = {
  name: { es: "ZATTIA CO" },
  email: "zattiaco@hotmail.com",
  logo: "//d1a9qnv764bsoo.cloudfront.net/stores/004/445/369/themes/common/logo-874.png?0",
  url_with_protocol: "https://zattia.com.ar",
  original_domain: "zattiaco.mitiendanube.com",
  main_language: "es",
  business_name: "AREBEN COMERCIAL S. R. L.",
  business_address: "PJE HUTCHINSON 3869",
  address: "Santa Fe 1435",
};

// ─── Lo que devuelve TN → lo que usa el mailer ───────────────────────────────
titulo("Normalización del endpoint /store");
{
  const d = normalizarStore(STORE_REAL);
  ok(d.nombre === "ZATTIA CO", "el nombre multiidioma se desarma", d.nombre);
  // Este es EL detalle de la fase: TN manda el logo sin protocolo y un `<img
  // src="//…">` en un mail es una imagen rota — el cliente de correo no tiene
  // página de la cual heredar el https.
  ok(d.logo.startsWith("https://"), "el logo protocolo-relativo pasa a https", d.logo);
  ok(d.url === "https://zattia.com.ar", "el sitio sale con el dominio propio, no el de mitiendanube", d.url);
  ok(d.idioma === "es", "el idioma principal");
  ok(d.direccion.includes("AREBEN") && d.direccion.includes("HUTCHINSON"), "el pie lleva razón social y domicilio legal", d.direccion);
}
{
  const d = normalizarStore({ ...STORE_REAL, url_with_protocol: undefined });
  ok(d.url === "https://zattiaco.mitiendanube.com", "sin dominio propio cae al de mitiendanube", d.url);
}
{
  // Resorty Lab: una tienda recién creada tiene todo en null. No puede explotar
  // ni escribir "null" en el pie de un mail.
  const d = normalizarStore({ name: { es: "Resorty Lab" }, logo: null, business_address: null, address: null });
  ok(d.logo === "" && d.direccion === "" && d.url === "", "una tienda vacía devuelve strings vacíos, no null");
  ok(normalizarStore(null).nombre === "", "y si TN no manda nada, tampoco rompe");
}
{
  const d = normalizarStore({ ...STORE_REAL, url_with_protocol: "https://zattia.com.ar/" });
  ok(d.url === "https://zattia.com.ar", "la barra final se saca (los links se arman concatenando)", d.url);
}

// ─── El merge sobre Cuenta.config ───────────────────────────────────────────
titulo("Traer la marca no pisa el resto del config");
{
  const previo = {
    tema: { acento: "#f59e0b", ancho: 640 },
    lastSyncContactos: "2026-07-22T23:50:38.306Z",
  };
  const c = configConTienda(previo, normalizarStore(STORE_REAL), "2026-07-29T00:00:00.000Z");
  ok(JSON.stringify(c.tema) === JSON.stringify(previo.tema), "el tema de la marca sigue entero");
  ok(c.lastSyncContactos === previo.lastSyncContactos, "y la fecha del sync de contactos también");
  ok(typeof c.logo === "string" && (c.logo as string).startsWith("https://"), "el logo quedó guardado");
  ok(c.marcaSync === "2026-07-29T00:00:00.000Z", "queda registrado cuándo se trajo");
}
{
  // Una tienda que borró su logo en TN no tiene por qué apagar el que ya
  // estaba: el mail se seguiría mandando, pero sin cara.
  const previo = { logo: "https://cdn.x/viejo.png", url: "https://viejo.com" };
  const c = configConTienda(previo, normalizarStore({ name: "X", logo: null }), "t");
  ok(c.logo === "https://cdn.x/viejo.png", "un campo vacío de TN no borra el que ya estaba");
}
{
  const c = leerConfigCuenta({ url: "https://zattia.com.ar/", logo: "  ", idioma: "es" });
  ok(c.url === "https://zattia.com.ar", "leer el config también normaliza la barra final");
  ok(c.logo === undefined, "un logo en blanco se lee como ausente, no como string vacío");
  ok(leerConfigCuenta(null).logo === undefined, "un config nulo no rompe");
}

// ─── marcaDe: el idioma ─────────────────────────────────────────────────────
titulo("El idioma de la tienda llega al mail");
{
  const m = marcaDe({ nombre: "Zattia", config: { idioma: "pt" } }, APP);
  ok(m.temaMarca?.idioma === "pt", "el idioma de TN entra al tema");
  ok(render({ v: V_ACTUAL, bloques: [] }, m as Record<string, unknown>).includes('lang="pt"'), "y sale en el `lang` del documento");
}
{
  const m = marcaDe({ nombre: "Zattia", config: { idioma: "pt", tema: { idioma: "en" } } }, APP);
  ok(m.temaMarca?.idioma === "en", "pero si alguien eligió idioma en el diseño, ese manda");
}
{
  const m = marcaDe({ nombre: "Zattia", config: { tema: { acento: "#000" } } }, APP);
  ok(m.temaMarca?.acento === "#000" && !m.temaMarca?.idioma, "sin idioma de TN el tema queda como estaba");
}

// ─── El encabezado toma el logo de la cuenta ────────────────────────────────
titulo("El logo de la tienda es el DEFAULT del encabezado, no un valor clavado");
const LOGO = "https://cdn.tienda/logo.png";
{
  // El caso que importa: una campaña vieja, a la que la migración le
  // materializó un `{tipo:"encabezado"}` pelado, muestra el logo sin que nadie
  // la edite. Es la fase entera en una aserción.
  const html = render({ v: V_ACTUAL, bloques: [{ tipo: "encabezado" }] }, { logoCuenta: LOGO });
  ok(html.includes(`src="${LOGO}"`), "un encabezado sin variante muestra el logo de la tienda");
  ok(html.includes('alt="Marca Uno"'), "con el nombre de alt, para el que bloquea imágenes");
}
{
  const html = render({ v: V_ACTUAL, bloques: [{ tipo: "encabezado" }] });
  ok(!html.includes("<img"), "una cuenta sin logo sigue mostrando el nombre, como siempre");
  ok(html.includes("MARCA UNO"), "…y el nombre es el de la cuenta");
}
{
  // "texto" no es el default: es una elección. Tiene que ganarle a TN.
  const html = render({ v: V_ACTUAL, bloques: [{ tipo: "encabezado", variante: "texto" }] }, { logoCuenta: LOGO });
  ok(!html.includes("<img"), "quien eligió `texto` no ve aparecer el logo");
  ok(html.includes("MARCA UNO"), "sigue el nombre");
}
{
  const propio = "https://cdn.otra/otro.png";
  const html = render({ v: V_ACTUAL, bloques: [{ tipo: "encabezado", variante: "logo", logo: propio }] }, { logoCuenta: LOGO });
  ok(html.includes(propio) && !html.includes(LOGO), "un logo cargado a mano le gana al de la tienda");
}
{
  const html = render({ v: V_ACTUAL, bloques: [{ tipo: "encabezado", variante: "logo", logo: "" }] }, { logoCuenta: LOGO });
  ok(html.includes(LOGO), "`logo` vacío cae al de la tienda antes que al nombre");
}

// ─── El mismo Json, dos marcas ──────────────────────────────────────────────
titulo("Una plantilla no lleva la marca adentro (ahora tampoco el logo)");
{
  const c = { v: V_ACTUAL, bloques: [{ tipo: "encabezado" }] };
  const bdi = render(c, { nombreCuenta: "BDI Accesorios", logoCuenta: "https://cdn/bdi.png", urlCuenta: "https://bdiaccesorios.com.ar" });
  const zat = render(c, { nombreCuenta: "Zattia", logoCuenta: "https://cdn/zattia.png", urlCuenta: "https://zattia.com.ar" });
  ok(bdi.includes("cdn/bdi.png") && !bdi.includes("cdn/zattia.png"), "el mismo bloque saca el logo de BDI en la cuenta de BDI");
  ok(zat.includes("cdn/zattia.png") && !zat.includes("cdn/bdi.png"), "y el de Zattia en la de Zattia");
  ok(bdi.includes('href="https://bdiaccesorios.com.ar"'), "y el link va a la tienda de cada una", bdi.slice(bdi.indexOf("<a"), bdi.indexOf("<a") + 60));
}
{
  const html = render(
    { v: V_ACTUAL, bloques: [{ tipo: "encabezado", url: "https://promo.especial/verano" }] },
    { urlCuenta: "https://zattia.com.ar" },
  );
  ok(html.includes("promo.especial/verano") && !html.includes('href="https://zattia.com.ar"'), "un link propio le gana al de la tienda");
}
{
  const html = render({ v: V_ACTUAL, bloques: [{ tipo: "encabezado" }] });
  ok(!html.slice(0, html.indexOf("<!-- Cuerpo -->")).includes("<a href"), "sin sitio cargado el encabezado no lleva link a ningún lado");
}

// ─── El pie ─────────────────────────────────────────────────────────────────
titulo("El domicilio de la tienda va al pie");
{
  const html = render({ v: V_ACTUAL, bloques: [] }, { direccionPostal: "AREBEN COMERCIAL S. R. L. · PJE HUTCHINSON 3869" });
  ok(html.includes("PJE HUTCHINSON 3869"), "sale en el pie");
  ok(html.includes(BAJA), "y el link de baja sigue estando");
}

// ─── Las redes viven en la cuenta, no en el mail ─────────────────────────────
//
// Es lo que permite que una PLANTILLA cierre con redes: si el preset guardara
// los links adentro del Json, la bienvenida de Zattia linkearía al Instagram de
// BDI — la misma falla que ya tuvo el logo.
titulo("Las redes las pone la marca, no el documento");
{
  const REDES = [
    { red: "instagram", url: "https://instagram.com/zattia_co" },
    { red: "tiktok", url: "https://tiktok.com/@zattia" },
  ];
  const m = marcaDe({ nombre: "Marca Uno", config: { redes: REDES } }, APP);
  ok(m.redesMarca?.length === 2, "`marcaDe` las devuelve como parte de RenderOpts");

  // El bloque nace con la lista vacía —así lo puede traer un preset— y el mail
  // igual sale con las dos.
  const bloque = { tipo: "redes", links: [] };
  const html = render({ v: V_ACTUAL, bloques: [bloque] }, { ...m, assetsBase: "https://links.zattia.com.ar" });
  ok(html.includes("instagram.com/zattia_co"), "un bloque sin links dibuja las de la marca");
  ok(html.includes("/redes/tiktok.png"), "…con su icono");

  // Y sin redes cargadas el bloque no se dibuja: nunca un `href=""`.
  const vacio = render({ v: V_ACTUAL, bloques: [bloque] }, { nombreCuenta: "Marca Uno" });
  ok(!vacio.includes('href=""'), "una marca sin redes no emite un link vacío");

  // Lo que el mail escribió gana: quien puso un link en ESTE mail quiso ese.
  const propio = render(
    { v: V_ACTUAL, bloques: [{ tipo: "redes", links: [{ red: "instagram", url: "https://instagram.com/otra" }] }] },
    { ...m, assetsBase: "https://links.zattia.com.ar" },
  );
  ok(propio.includes("instagram.com/otra") && !propio.includes("zattia_co"), "el link del bloque le gana al de la marca");

  // Basura adentro del config: una entrada sin URL usable no puede llegar al
  // `href` de un mail que ya está en la casilla de otra persona.
  const sucia = leerConfigCuenta({ redes: [{ red: "instagram" }, { red: "x", url: "javascript:alert(1)" }, { red: "", url: "https://a.com" }] });
  ok(sucia.redes === undefined, "una lista sin ninguna entrada usable queda en `undefined`");
}

// ─── El domicilio se puede apagar, el link de baja no ───────────────────────
titulo("Mostrar el domicilio es una decisión de la marca");
{
  const DIR = "AREBEN COMERCIAL S. R. L. · PJE HUTCHINSON 3869";
  const con = marcaDe({ nombre: "Marca Uno", config: { direccion: DIR } }, APP);
  ok(con.direccionPostal === DIR, "sin la clave, el domicilio sale como salió siempre");

  const sin = marcaDe({ nombre: "Marca Uno", config: { direccion: DIR, direccionOculta: true } }, APP);
  ok(sin.direccionPostal === undefined, "con `direccionOculta` no llega al renderer");

  // 🔴 Apagarlo no puede llevarse puesto el dato: "Traer de mi tienda" lo
  // reescribe en cada corrida, así que borrarlo no serviría de nada, y hay que
  // poder volver a prenderlo sin ir a buscar el domicilio otra vez.
  ok(
    leerConfigCuenta({ direccion: DIR, direccionOculta: true }).direccion === DIR,
    "…pero el domicilio sigue guardado en el config",
  );

  const html = render({ v: V_ACTUAL, bloques: [] }, sin);
  ok(!html.includes("PJE HUTCHINSON"), "el pie sale sin domicilio");
  ok(html.includes("Marca Uno"), "con el nombre de la marca");
  // El link de baja NO es negociable: por eso el pie no es un bloque.
  ok(html.includes(BAJA), "y con el link de baja, que no se puede apagar");
}
{
  // El default importa: las cuentas que ya existen no tienen la clave, y no
  // pueden empezar a mandar sin domicilio por un cambio de código.
  const vieja = marcaDe({ nombre: "Marca Uno", config: { direccion: "CALLE FALSA 123" } }, APP);
  ok(vieja.direccionPostal === "CALLE FALSA 123", "una cuenta vieja no cambia de comportamiento");
}

// ─── El domicilio se puede escribir a mano ──────────────────────────────────
titulo("El domicilio del pie se puede cambiar, y traer la marca no lo pisa");
{
  const FISCAL = "AREBEN COMERCIAL S. R. L. · PJE HUTCHINSON 3869";
  const PROPIO = "Zattia · Córdoba, Argentina";

  const m = marcaDe({ nombre: "Zattia", config: { direccion: FISCAL, direccionPropia: PROPIO } }, APP);
  ok(m.direccionPostal === PROPIO, "el escrito a mano le gana al fiscal que trajo TN");

  const solo = marcaDe({ nombre: "Zattia", config: { direccion: FISCAL } }, APP);
  ok(solo.direccionPostal === FISCAL, "sin uno propio sale el de Tiendanube");

  const vacio = marcaDe({ nombre: "Zattia", config: { direccion: FISCAL, direccionPropia: "   " } }, APP);
  ok(vacio.direccionPostal === FISCAL, "vaciarlo vuelve al de Tiendanube (no deja el pie mudo)");

  // 🔴 La razón de que sean dos claves y no una: "Traer de mi tienda" se corre
  // para actualizar el logo, y no puede llevarse puesto el texto elegido.
  const despues = configConTienda(
    { direccion: FISCAL, direccionPropia: PROPIO },
    normalizarStore({
      name: { es: "Zattia" },
      logo: "//cdn/zattia.png",
      url_with_protocol: "https://zattia.com.ar",
      business_name: "AREBEN COMERCIAL S. R. L.",
      business_address: "OTRA CALLE 999",
    } as Parameters<typeof normalizarStore>[0]),
    "2026-07-30T00:00:00.000Z",
  );
  ok(despues.direccionPropia === PROPIO, "traer la marca NO pisa el domicilio escrito a mano");
  ok(
    marcaDe({ nombre: "Zattia", config: despues }, APP).direccionPostal === PROPIO,
    "…y el pie sigue saliendo con el propio",
  );

  const oculto = marcaDe({ nombre: "Zattia", config: { direccionPropia: PROPIO, direccionOculta: true } }, APP);
  ok(oculto.direccionPostal === undefined, "el interruptor apaga también al escrito a mano");
}

console.log(fallas === 0 ? "\n✅ Marca OK\n" : `\n❌ ${fallas} fallas\n`);
process.exit(fallas === 0 ? 0 : 1);
