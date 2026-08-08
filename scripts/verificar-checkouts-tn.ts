/**
 * Verifica contra la API REAL de Tiendanube que la lectura de carritos sigue
 * funcionando. El hermano de `verificar-productos-tn.ts`, y por el mismo motivo:
 * hay cosas que sólo se rompen del lado de TN y ningún test puro las ve.
 *
 *   node --env-file=.env --import tsx scripts/verificar-checkouts-tn.ts
 *
 * 🔴 LO QUE FIJA, Y POR QUÉ NO ES PARANOIA:
 *
 * `contact_accepts_marketing` sólo es un `fields` válido **si en la misma lista
 * va `customer`**. Aislado el 8-ago-2026 contra la tienda de BDI:
 *
 *     fields=id,contact_accepts_marketing                      → 422
 *     fields=contact_email,contact_accepts_marketing           → 422
 *     fields=contact_identification,contact_accepts_marketing  → 422
 *     fields=customer,contact_accepts_marketing                → 200 ✅
 *
 * La documentación de TN no lo menciona. Y el modo de falla es el peor que hay:
 * no devuelve el campo vacío, devuelve **422 y no devuelve nada**, así que el
 * poller se queda sin leer un solo carrito. Alguien que "limpie" el FIELDS
 * sacando `customer` —que a simple vista casi no se usa— apaga la detección
 * entera sin tocar una línea de lógica.
 *
 * El segundo invariante es más chico pero de la misma familia: un campo que no
 * se pide se lee como `undefined`, y `undefined !== true` es indistinguible de
 * "no acepta marketing". La primera versión de `medir-checkouts-tn.ts` reportó
 * **0% de consentimiento en las tres tiendas** por eso mismo, cuando el valor
 * real es 99% / 92% / 67%.
 */
import { prisma } from "../lib/prisma.ts";
import { listarAbandonados, estadoDeCheckout } from "../lib/tn/checkouts.ts";

let fallas = 0;
function ok(cond: boolean, msg: string, detalle = "") {
  console.log(`${cond ? "  ✅" : "  🔴"} ${msg}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallas++;
}

async function main() {
  const cuentas = await prisma.cuenta.findMany({
    where: { tnStoreId: { not: null }, tnToken: { not: null } },
    select: { slug: true, tnStoreId: true, tnToken: true },
    orderBy: { slug: "asc" },
  });
  if (cuentas.length === 0) {
    console.log("No hay tiendas conectadas. Nada que verificar.");
    return;
  }

  for (const c of cuentas) {
    console.log(`\n${c.slug}`);
    const storeId = c.tnStoreId!;
    const token = c.tnToken!;

    // 1. El FIELDS de producción no da 422. Es el invariante principal: si
    //    alguien saca `customer`, esto se pone rojo acá y no en producción.
    let carritos;
    try {
      const r = await listarAbandonados(storeId, token);
      carritos = r.checkouts;
      ok(true, `listarAbandonados() → ${carritos.length} carritos`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ok(false, "listarAbandonados() falló", msg.slice(0, 180));
      if (/422/.test(msg) && /contact_accepts_marketing/.test(msg)) {
        console.log("     ⛔ Es el acoplamiento de arriba: falta `customer` en FIELDS.");
      }
      continue;
    }

    if (carritos.length === 0) {
      console.log("     (sin carritos ahora; el resto de las pruebas necesita al menos uno)");
      continue;
    }

    const k = carritos[0];

    // 2. El consentimiento llega como booleano de verdad, no como `undefined`.
    //    Un `undefined` acá significa que el campo dejó de venir, y eso deja al
    //    100% de la gente fuera del envío sin que nada falle.
    const algunoAcepta = carritos.some((x) => x.acceptsMkt === true);
    ok(
      algunoAcepta,
      "`contact_accepts_marketing` llega y alguno es true",
      `${carritos.filter((x) => x.acceptsMkt).length}/${carritos.length}`,
    );

    // 3. Los campos que el mail necesita para no salir roto.
    ok(!!k.abandonedUrl, "el carrito trae `abandoned_checkout_url`", k.abandonedUrl.slice(0, 50));
    ok(!!k.email, "el carrito trae mail");
    ok(k.productos.length > 0, "el carrito trae productos", `${k.productos.length}`);
    ok(
      k.productos.every((p) => p.nombre && p.precio),
      "todo producto tiene nombre y precio",
      k.productos.map((p) => p.nombre).join(" · ").slice(0, 60),
    );

    // 4. El cursor. Si TN dejara de respetar `since_id`, el poller releería todo
    //    en cada corrida: el UNIQUE lo salvaría de mandar dos veces, pero
    //    gastaría la API entera cada 15 minutos.
    const { checkouts: despues } = await listarAbandonados(storeId, token, k.tnCheckoutId);
    ok(
      despues.every((x) => BigInt(x.tnCheckoutId) > BigInt(k.tnCheckoutId)),
      "`since_id` se respeta",
      `${despues.length} después del cursor`,
    );

    // 5. El endpoint individual, que es la guarda que impide escribirle a quien
    //    ya compró. Sobre un carrito vivo tiene que decir `abierto`.
    const est = await estadoDeCheckout(storeId, token, k.tnCheckoutId);
    ok(est.estado === "abierto", "estadoDeCheckout() de un carrito vivo → abierto", est.estado);

    // 6. Y sobre un id que no existe, `completado` — nunca `abierto`. El listado
    //    de TN saca a los que compraron, así que un id que no está es alguien
    //    que compró, y ante la duda no se manda.
    const fantasma = await estadoDeCheckout(storeId, token, "1");
    ok(
      fantasma.estado !== "abierto",
      "estadoDeCheckout() de un id inexistente NO dice abierto",
      fantasma.estado,
    );
  }

  console.log(fallas === 0 ? "\n✅ Todo en verde." : `\n🔴 ${fallas} fallas.`);
  if (fallas) process.exitCode = 1;
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
