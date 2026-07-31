// Prueba de vida del dominio de links de una marca.
//
// POR QUÉ EXISTE: el dominio propio (`links.zattia.com.ar`) necesita DOS pasos
// —un CNAME en el DNS y el alta del dominio en Vercel— y el DNS resuelve desde
// el primero. O sea que hay una ventana en la que el dominio "anda" para `dig`
// y devuelve 404 para un navegador. Guardarlo en esa ventana mandaría mails con
// TODOS los links muertos, incluido el de baja, a casillas donde ya no se
// pueden corregir.
//
// `guardarDominioEnvio` le pega acá antes de aceptar el valor. Que la respuesta
// venga de ESTA ruta y no de la home es lo que prueba lo que importa: que el
// dominio llega a esta app y que el prefijo `/api/track/` —del que cuelgan el
// pixel y el redirect de clicks— se sirve desde ahí.
//
// Es público (cae bajo `/api/track/` en PUBLIC_PREFIXES) y no dice nada de
// nadie: un literal fijo, sin datos de cuenta ni de envío.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("areben-mailer", {
    status: 200,
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  });
}
