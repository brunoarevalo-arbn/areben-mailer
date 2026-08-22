// GET /api/cron/procesar — lo llama Vercel Cron (Authorization: Bearer <CRON_SECRET>).
//
// 🔑 **Esto reemplaza a `.github/workflows/cron.yml`, y el motivo es la FACTURA DE GITHUB.**
// Actions cobra **1 minuto entero por arranque**, así que los cuatro `curl` que este archivo
// reemplaza hacían **128 minutos de trabajo real al mes y facturaban 612** (medido sobre las 581
// corridas de agosto-2026: 4,8× de puro redondeo). El 22-ago-2026 la cuenta agotó los 2.000
// min/mes del plan Free y **la cola de mails se paró en seco**. Vercel Cron no cobra por arranque
// y el proyecto ya está en Pro. ⛔ No volver a colgar esto de Actions.
//
// 🔑 **Los CUATRO pasos van en un solo viaje, y el orden es el del workflow que reemplaza.** No es
// prolijidad: comparten la única cosa cara que hacen, que es **despertar la base de Neon**
// (compartida con Resorty, se cobra por hora de compute despierto, autosuspend a los 5 min). Cuatro
// crons sueltos serían cuatro despertadas. Es el mismo criterio que `/api/cron/limpieza` en Resorty.
//
// ⚠️ **Por eso también hay DOS horarios en `vercel.json` y no uno** — `*/15` de día ART y `0 * `
// de madrugada. Entre las 3 y las 10 AM ART no hay tráfico de storefront y este cron es **lo único**
// que levanta la base en esa franja. ⛔ No unificarlos "para simplificar": eso es plata de Neon.
import { GET as procesarAutomations } from '@/app/api/automations/procesar/route';
import { GET as procesarCola } from '@/app/api/campanias/procesar-cola/route';
import { GET as detectarCarritos } from '@/app/api/carritos/detectar/route';
import { GET as marcarRecuperados } from '@/app/api/carritos/recuperados/route';

export const runtime = 'nodejs';
// Los cuatro pasos juntos tardan **~13 s** medidos (128 min reales / 581 corridas de agosto).
// 300 es aire de sobra; lo que se está comprando acá es no cortarse a la mitad de un lote.
export const maxDuration = 300;

// Los cuatro handlers leen el secreto de `?secret=`, que es como los llamaba el `curl` del
// workflow. Vercel Cron en cambio manda `Authorization: Bearer`. En vez de tocar la autenticación
// de las cuatro rutas —que siguen existiendo y las sigue pinchando Resorty—, este orquestador
// traduce: valida el header y les arma la URL que ya saben leer.
const PASOS = [
  ['automations', procesarAutomations],
  ['cola', procesarCola],
  ['carritos-detectar', detectarCarritos],
  ['carritos-recuperados', marcarRecuperados],
] as const;

export async function GET(req: Request) {
  // 🔴 Falla CERRADO. Sin la env el chequeo no se saltea: `/api/cron/` está en
  // `PUBLIC_PREFIXES` del proxy, así que sin esto la ruta quedaría abierta a cualquiera.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('no autorizado', { status: 401 });
  }

  const url = `https://cron.interno/?secret=${encodeURIComponent(secret)}`;
  const resultados: Record<string, unknown> = {};

  for (const [nombre, handler] of PASOS) {
    // 🔴 **Un paso que falla NO corta los siguientes**, igual que en el workflow, donde cada
    // `curl` terminaba en `|| echo "fallo (se reintenta en el próximo ciclo)"`. Son cuatro
    // trabajos independientes: que TN no conteste no puede impedir que salgan los mails que ya
    // estaban listos. Lo que se pierde se retoma en la corrida siguiente.
    try {
      const res = await handler(new Request(url));
      resultados[nombre] = res.ok ? await res.json() : { error: res.status };
      if (!res.ok) console.error(`cron/procesar: ${nombre} contestó ${res.status}`);
    } catch (e) {
      resultados[nombre] = { error: String(e) };
      console.error(`cron/procesar: ${nombre} explotó`, e);
    }
  }

  // 200 aunque algún paso haya fallado: el detalle va en el cuerpo y en el log. Un 500 acá haría
  // que Vercel marque la corrida en rojo por un fallo de TN que se reintenta solo en 15 minutos.
  return Response.json(resultados);
}
