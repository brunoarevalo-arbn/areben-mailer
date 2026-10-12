import { prisma } from "@/lib/prisma";
import { cuandoSale, grupoDeContacto, vaAHoraFija, type Trigger } from "@/lib/automations";
import { leerConfigCuenta } from "@/lib/marca";
import { tnGet } from "@/lib/tn/client";
import { esMailQueSigue, type Compra } from "@/lib/secuencia-bienvenida";

// La secuencia de bienvenida, del lado que toca la base y Tiendanube. Las reglas en
// sí son puras y viven en `lib/secuencia-bienvenida.ts` y `lib/automations.ts`.

/**
 * Cuántos runs recién nacidos se preparan por corrida. Son ~4 por lead (los mails
 * que siguen al primero) y el procesador se pincha en cada lead: en régimen son
 * cuatro filas. El tope es para el día que el procesador estuvo caído.
 */
const LOTE_NACIDOS = 400;

/**
 * Le pone a cada run NUEVO de la secuencia lo que Resorty no sabe ponerle.
 *
 * 🔴 Existe porque los runs de `NUEVO_SUSCRIPTOR` NO los crea el mailer: los inserta
 * `dispararBienvenida()` de `areben-popups` por SQL crudo, con `alta + esperaHoras`.
 * En vez de enseñarle la regla a otro repo (y deployar los dos para cambiar una
 * hora), el procesador la aplica acá, una sola vez por run, antes de tomar el lote:
 *
 *  - **la hora fija**: `proximoAt` pasa a «día N a las 11» (`cuandoSale`). El de
 *    Resorty puede caer DESPUÉS (alta a las 15 + 24 h = 15 h del día 1) o antes;
 *    los dos se corrigen.
 *  - **el grupo de control**: con el % de `Cuenta.config.bienvenidaControlPct`. Se
 *    decide al NACER y queda escrito en el run, como el `grupo` del carrito: si
 *    alguien cambia el % mañana, a quien ya está en la secuencia no le cambia nada.
 *
 * La marca de hecho es `triggerData.nacio`: la fila se toca UNA vez. Sin la marca
 * habría que recalcular todos los pendientes en cada pinchazo (~150 por día).
 *
 * 🔑 Corre ANTES de `tomarRuns`, así que un run que todavía no se preparó no se puede
 * tomar con su hora vieja: la de Resorty es de por lo menos 24 h después del alta, y
 * esto corre segundos después (Resorty pincha el procesador en cada lead).
 */
export async function prepararNacidos(ahora: Date = new Date()): Promise<number> {
  const filas = await prisma.$queryRaw<
    { id: string; createdAt: Date; contactoId: string; triggerData: unknown; trigger: Trigger; esperaHoras: number; config: unknown }[]
  >`
    SELECT r.id, r."createdAt", r."contactoId", r."triggerData", a.trigger::text AS trigger, a."esperaHoras", c.config
    FROM "AutomationRun" r
    JOIN "Automation" a ON a.id = r."automationId"
    JOIN "Cuenta" c ON c.id = a."cuentaId"
    WHERE r.estado = 'PENDIENTE'
      AND a.trigger = 'NUEVO_SUSCRIPTOR'
      AND a."esperaHoras" > 0
      AND r."triggerData"->>'nacio' IS NULL
    ORDER BY r."createdAt" ASC
    LIMIT ${LOTE_NACIDOS}`;

  let preparados = 0;
  for (const f of filas) {
    if (!esMailQueSigue(f.trigger, f.esperaHoras)) continue;
    const td = (f.triggerData && typeof f.triggerData === "object" ? f.triggerData : {}) as Record<string, unknown>;
    const pct = leerConfigCuenta(f.config).bienvenidaControlPct ?? 0;
    const grupo = grupoDeContacto(f.contactoId, pct);
    const datos = {
      ...td,
      nacio: ahora.toISOString(),
      ...(grupo ? { grupo } : {}),
    };
    // `updateMany` con el estado en el WHERE: si otro proceso ya lo tomó o lo saltó,
    // esto no lo resucita ni le cambia la hora a un mail que ya salió.
    const { count } = await prisma.automationRun.updateMany({
      where: { id: f.id, estado: "PENDIENTE" },
      data: {
        triggerData: datos,
        ...(vaAHoraFija(f.trigger, f.esperaHoras) ? { proximoAt: cuandoSale(f.trigger, f.esperaHoras, f.createdAt) } : {}),
      },
    });
    preparados += count;
  }
  return preparados;
}

/**
 * Cuántos días de órdenes se leen para el corte. La secuencia dura 6 días desde el
 * alta (el D6); con 8 entra el más viejo de los pendientes aunque el procesador haya
 * estado caído un día. Medido el 11-oct-2026 en BDI: 116 órdenes en 7 días, UNA página.
 */
const DIAS_DE_ORDENES = 8;
const POR_PAGINA = 200;
const MAX_PAGINAS = 5;

interface OrdenTn {
  id?: number;
  contact_email?: string | null;
  customer?: { email?: string | null } | null;
  coupon?: Array<{ code?: string | null }> | null;
  payment_status?: string | null;
  status?: string | null;
  created_at?: string | null;
}

/**
 * Las órdenes de una tienda de los últimos días, reducidas a lo que pide el corte.
 *
 * 🔴 Devuelve `null` si TN falló —NO `[]`—: «no pude mirar» y «nadie compró» son
 * cosas distintas, y confundirlas acá es cortarle la secuencia a todos o a nadie
 * según cuál se elija. Con `null`, `yaCompro` deja salir el mail.
 * ⚠️ Una página que falla a la mitad también da `null`: con media lista, al que
 * compró en la parte que no llegó se le seguiría mandando, y no hay forma de saber
 * quién es.
 */
export async function comprasRecientes(storeId: string, token: string, ahora: Date = new Date()): Promise<Compra[] | null> {
  const desde = new Date(ahora.getTime() - DIAS_DE_ORDENES * 86_400_000).toISOString();
  const out: Compra[] = [];
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    let lote: OrdenTn[];
    try {
      ({ data: lote } = await tnGet<OrdenTn[]>(storeId, token, "orders", {
        per_page: POR_PAGINA,
        page,
        created_at_min: desde,
        fields: "id,contact_email,customer,coupon,payment_status,status,created_at",
      }));
    } catch (e) {
      // TN contesta 404 a una página vacía pasada la última: es el fin, no un error.
      if (page > 1 && String(e).includes("→ 404")) break;
      console.error("comprasRecientes falló", { storeId, page, e: String(e) });
      return null;
    }
    if (!Array.isArray(lote)) return null;
    for (const o of lote) {
      const creada = o.created_at ? new Date(o.created_at) : null;
      if (!creada || Number.isNaN(creada.getTime())) continue;
      out.push({
        email: (o.contact_email || o.customer?.email || "").trim().toLowerCase(),
        cupones: (Array.isArray(o.coupon) ? o.coupon : [])
          .map((c) => c?.code?.trim().toUpperCase())
          .filter((c): c is string => !!c),
        pagada: o.payment_status === "paid",
        cancelada: o.status === "cancelled",
        creada,
      });
    }
    if (lote.length < POR_PAGINA) break;
  }
  return out;
}
