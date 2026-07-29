<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# areben-mailer

Plataforma propia de email marketing para tiendas Tiendanube. **En producción**
(https://areben-mailer.vercel.app), multi-marca (BDI, Zattia, Stunned) y con
~16.800 contactos reales de BDI en la base. Todo lo que manda mails toca gente
de verdad: leé el gate antes de tocar el motor de envío.

Next 16 (App Router, server actions) · React 19 · Prisma 7 + Postgres (Neon) ·
Tailwind 4 · Vercel.

## ⛔ Las cinco reglas que no se negocian

1. **Nunca `prisma db push` ni `npm run db:push`.** La base es **compartida con
   `areben-popups` (Resorty)** — mismo host Neon. Prisma no conoce esas tablas y
   las borra. Los cambios de schema se hacen con **SQL crudo** desde un script
   (`scripts/add-*.ts`) y después se refleja a mano en `schema.prisma`.
2. **El push a GitHub NO deploya.** El proyecto de Vercel no está conectado al
   repo: hay que correr `vercel --prod --yes` a mano después de commitear.
3. **En lo que escribe (`app/**/actions.ts`, `app/api/**/route.ts`) no se usa
   `getCuentaActiva()`** — devuelve la marca pero no sabe quién pide. Va
   `autorizar()` / `chequear()` / `autorizarApi()` de `@/lib/auth`. Lo frena el
   lint; no lo esquives.
4. **El rol nunca se lee del JWT.** El token dura 7 días; degradar a alguien no
   tendría efecto. El rol sale de la base, en `lib/auth.ts`.
5. **El gate de envío no se abre para probar.** Para probar está el modo ensayo
   (abajo).

## Comandos

```bash
npm run dev                                   # local (localhost:3000)
npm run lint                                  # eslint (incluye la regla de arriba)
npm run build                                 # prisma generate + next build
vercel --prod --yes                           # deploy (obligatorio a mano)
node --env-file=.env scripts/<x>.ts           # cualquier script (Node stripea los tipos)
```

Auditorías que valen como test (no hay suite de tests):

```bash
node --import tsx scripts/auditar-permisos.ts  # toda action declara su permiso
node --import tsx scripts/probar-permisos.ts   # invariantes de la matriz
node --import tsx scripts/probar-gate.ts       # el gate no se abre solo
node --import tsx scripts/probar-carrito.ts    # el carrito de muestra no sale en un envío real
node --import tsx scripts/probar-tema.ts       # un tema no deja el mail ilegible
```

⚠️ **`.github/workflows/permisos.yml` está en `.git/info/exclude` y nunca corrió
en CI** (falta el scope `workflow` en el token). Correr esos cinco scripts a mano
antes de pushear. Lo único que sí corre en CI es `cron.yml`, que cada 15 min
pinguea `/api/automations/procesar` y `/api/campanias/procesar-cola`.

## Mapa

```
app/(app)/…       panel: campanias, automations, contactos, listas, segmentos,
                  plantillas, formularios, remitentes, usuarios, envio (diagnóstico)
app/(public)/…    login · /f/[slug] (formularios de captura) · /baja
app/api/…         tn/* (OAuth + webhooks) · track/{open,click} · webhooks/{resend,sendgrid}
                  ses/sns · campanias/procesar-cola · automations/procesar
lib/email/…       motor: proveedor.ts (gate+contrato), cola.ts, procesar.ts,
                  enviar.ts, render.ts, tema.ts, tracking.ts, supresion.ts
lib/auth.ts       autorizar/chequear/autorizarApi ← ÚNICO camino de autorización
lib/permisos.ts   matriz de roles (puro: lo importa server Y cliente)
lib/tn/…          cliente Tiendanube, import de contactos/órdenes, webhooks
components/ui/    Button, Card, Badge, Input, Select, Textarea, NumInput,
                  PageHeader, EmptyState, LoadingState, ErrorState → reusar, no reinventar
```

El código está **densamente comentado y los comentarios explican el porqué**
(qué bug motivó cada decisión). Antes de cambiar algo raro, leé el comentario de
arriba: casi siempre está la razón.

## Envío: gate, modos y proveedor

Tres estados, no dos (`lib/email/proveedor.ts`):

| modo | env | quién recibe |
|---|---|---|
| `bloqueado` | ninguna (default) | nadie |
| `ensayo` | `ENVIO_ENSAYO="@dominio.com, qa@x.com"` | solo esas casillas/dominios |
| `real` | `ENVIO_REAL="true"` | todos (gana sobre ensayo) |

- El chequeo se hace **justo antes de cada envío**, no solo al encolar.
- `SES_SANDBOX` es el nombre viejo y ya no significa nada. No revivirlo.
- Un cambio de env **no aplica hasta un redeploy**.
- La vista `/envio` muestra el estado real del gate y del proveedor sin entrar a Vercel.

**Proveedor:** se elige con `EMAIL_PROVIDER` (`ses` | `resend` | `sendgrid`;
default `ses`). En producción está en **`resend`** — Hotmail pasó de spam a inbox
al migrar. ⚠️ El `.env` local **no** define `EMAIL_PROVIDER`, así que localmente
cae a SES: si probás envíos, seteala. SES quedó aprobado para producción
(50k/día) y sigue disponible como alternativa; la elección final está pendiente
de un ensayo comparativo.

**Cola:** el servidor manda, no el navegador. Lease en `Campania.procesandoHasta`
+ auto-encadenamiento entre invocaciones, con el cron de 15 min como perro
guardián. Un `updateMany` condicional evita que dos workers agarren la misma
campaña.

**Tracking:** todo mail —de campaña o de automation— termina en la tabla `Envio`
(`campaniaId` o `automationRunId`, nunca los dos). Por eso las métricas del home
son una sola consulta.

## Auth y permisos

- Sesión: cookie `session` firmada (jose). `proxy.ts` hace el chequeo optimista
  (sin DB); la seguridad real vive en el DAL y en `autorizar()`.
- Rutas públicas (ver `PUBLIC_PREFIXES` en `proxy.ts`): `/login`, `/api/tn/`,
  `/api/track/`, `/api/webhooks/`, `/baja`, `/f/`, los dos endpoints del cron
  (protegidos por `CRON_SECRET`).
- Las rutas `/api/` sin sesión devuelven **401**, no un redirect a HTML.
- Roles: `ADMIN` (todo) · `EDITOR` (arma, no envía) · `VIEWER` (mira). Permisos:
  `ver`, `editar`, `probar`, `enviar`, `integrar`, `remitentes`, `usuarios`.
- La UI y las actions leen **la misma** función `puede()` — por eso no hay
  botones visibles que después tiran 403.

## Multi-marca

Todo cuelga de `cuentaId`. La cuenta activa sale del `cuentaId` de la sesión
(selector de marca en el sidebar). **No hay cuenta por defecto**: sin sesión no
hay cuenta, se tira error. Caer a "bdi" sería una fuga de datos entre
comerciantes.

## Documentos largos (no los leas salvo que el tema sea ese)

- `SES-ESTADO.md` — estado de SES/Resend, DNS, DKIM, MAIL FROM, webhooks. Leerlo
  antes de tocar deliverability o DNS.
- `MODELO-DE-NEGOCIO.md` — precios, GTM, combo con Resorty.
- `TIENDANUBE-PUBLICACION.md` — requisitos de la App Store de TN.
