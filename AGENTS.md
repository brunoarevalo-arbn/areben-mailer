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

## ⛔ Las seis reglas que no se negocian

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
6. **El `contenido` de la base se lee con `leerContenido()` de `lib/email/esquema`**,
   nunca con un cast. Y lo que se le pasa al renderer es el contenido **entero**
   (`{ ...contenido, bloques }`), no una lista de campos a mano: enumerarlos hacía
   que cada campo nuevo se perdiera **solo en el envío**. Lo verifica
   `probar-esquema.ts`.

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
node --import tsx scripts/probar-esquema.ts    # el Json de bloques migra sin perder nada
node --import tsx scripts/probar-estilos.ts    # la cascada respeta el orden y no inyecta
node --import tsx scripts/probar-render.ts     # golden: el mail no cambió sin querer
node --import tsx scripts/probar-html.ts       # VML, media queries, tracking, peso
node --import tsx scripts/probar-encabezado.ts # el link de baja no se puede borrar
node --import tsx scripts/probar-imagenes.ts   # permisos, multi-tenant y SVG de /api/imagenes
```

⚠️ `probar-render.ts` compara contra `scripts/fixtures/render-golden.json`. Si el
HTML cambió **a propósito**, se bendice con `--capturar` y el golden se commitea
**junto** con el cambio, así el diff del commit muestra qué se movió en el mail.
Nunca "para que pase".

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
                  bloques.ts  ← QUÉ es un mail (tipos + nuevoBloque). Sin HTML.
                  esquema.ts  ← leerContenido(): ÚNICA puerta al Json de la base
                  estilos.ts  ← cascada de estilo por bloque (tokens + lista blanca)
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

## El aspecto del mail: la cascada

Cuatro escalones, de abajo hacia arriba (`lib/email/estilos.ts`):

1. `BASE[rol]` — lo que cada rol vale cuando nadie tocó nada
2. `BASE_POR_TIPO[tipo][rol]` — el título de un `hero` mide 30px, el de una `seccion` 22
3. `ContenidoCampania.estilos` — "en ESTE mail, todos los títulos…"
4. `Bloque.estilo` — el override puntual

Un color se guarda de tres formas: **`$acento`** (token de la marca, se repinta
solo cuando cambia el tema) · **`#f59e0b`** (elegido a mano, queda clavado) ·
**clave ausente** (heredar). Ese "ausente" es la convención, no un `""` ni un
`null`: `EstiloResuelto.elegidas` responde "¿lo eligió una persona?" y de eso
dependen la legibilidad contextual y el modo oscuro.

⚠️ **La plantilla de cada bloque escribe lo que siempre escribió y solo le cambia
los valores; `extra()` agrega únicamente lo elegido.** Si `extra()` emitiera
también el BASE, un mail sin estilos saldría distinto al de ayer. Lo custodia el
golden.

⚠️ **Ningún string del Json llega al HTML sin pasar por `hex()`, `px()` o un
enum** — `esc()` no escapa comillas, así que un color con una comilla se escapa
del atributo `style="…"`. Los preview van con `sandbox=""` por lo mismo.

## El HTML que sale (`lib/email/shell.ts`)

**REGLA ÚNICA: el inline lleva el valor de escritorio; una clase solo puede ser
un override.** Nunca hay una propiedad que viva solo en el `<style>`. Hay
clientes que lo descartan —Outlook de escritorio, y Gmail cuando **recorta arriba
de ~102 KB**— y con esta regla lo peor que ven es el layout de escritorio, nunca
uno roto. Lo verifica `probar-html.ts` recorriendo las etiquetas con `class`.

- **Tabla exterior**, no un `div` con `max-width` — Outlook ignora `max-width` y
  `margin:0 auto`, y el mail salía a ancho de ventana y pegado a la izquierda.
- **`<o:PixelsPerInch>96`**: sin eso Outlook renderiza a 120 DPI y todo sale 25%
  más grande.
- **Botones**: VML para Outlook + `<a>` envuelta en `<!--[if !mso]>`. Si el ancla
  no se esconde, Outlook dibuja los dos botones.
- ⚠️ **`inyectarTracking` matchea `<a>` Y `<v:roundrect>`.** Con solo `<a>`, todo
  click desde Outlook quedaba sin medir.
- El corte responsive es **el ancho del mail**, no 600px fijos.
- ⛔ Prohibido: `position` (Gmail lo elimina), `flex`/`grid`/`float`, `box-shadow`,
  `calc()`, `rem`/`em`, base64.

### El encabezado es un bloque; el pie no

El nombre de la marca que va arriba de todo es el bloque `encabezado`: se edita,
se cambia por un logo y se puede borrar. Tres cosas que no son obvias:

- **Se dibuja FUERA de la tarjeta de contenido**, sobre el fondo de página —
  donde estuvo siempre. Por eso hay **uno solo y va primero**: `leerContenido` lo
  acomoda y `renderEmailHtml` lo saca de la lista antes de recorrer el cuerpo.
- **`texto` vacío = el nombre de la cuenta**, resuelto al renderizar. Que el
  default sea vacío y no el nombre copiado adentro es lo que deja compartir una
  plantilla entre marcas sin que la bienvenida de Zattia salga firmada por BDI.
- **La migración v2→v3 se lo materializa a todo documento que no lo tenga.** Sin
  eso, cada campaña y plantilla ya guardada habría salido sin cabecera.

**El pie NO es un bloque y no va a serlo**: lleva el link de baja, que es
obligatorio y no puede depender de que nadie lo borre. `probar-encabezado.ts`
fija que aparece en el 100% de los renders, con la lista de bloques que sea.

**Modo oscuro: solo declarado, no implementado.** Van `color-scheme` y
`supported-color-schemes` para que Apple Mail no invierta a la fuerza, pero **no
hay `@media (prefers-color-scheme)`**: recolorear el shell sin que los bloques
acompañen deja texto oscuro sobre fondo oscuro, que es peor que no hacer nada.
Entra cuando los bloques emitan sus propias clases de tema.

## Biblioteca de imágenes (Vercel Blob)

Store propio del proyecto: **`mailer-imagenes`**, linkeado a `areben-mailer`, que
inyecta `BLOB_READ_WRITE_TOKEN` en los tres entornos. El SDK lo toma solo — no
hay que pasarle `token` a `put()`.

- Tabla **`ImagenMail`** (`scripts/add-imagenes-mail.ts`, SQL crudo). Se llama
  así y no `Imagen` porque el esquema lo comparte Resorty.
- `app/api/imagenes` (GET `ver` · POST `editar`) y `[id]` (DELETE `editar`).
- ⛔ **SVG rechazado** aunque sea una imagen: ningún cliente de mail lo rasteriza
  y es un archivo con `<script>` adentro servido desde un dominio propio. Va
  PNG/JPG/GIF/WEBP hasta 5 MB.
- **El `cuentaId` va en el WHERE**, nunca en un chequeo después del `findUnique`.
- **El contador de bytes por cuenta existe desde el día uno.** La cuota puede
  venir después; medir no se retrofitea: Blob se paga y el egress de una imagen
  se paga **por destinatario** — 16.800 envíos con cinco fotos es ancho de banda
  de verdad.
- ⚠️ **Borrar una imagen rompe los mails ya enviados**: la URL está adentro del
  correo que ya está en la casilla de otra persona. La UI avisa; no hay borrado
  masivo.

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

- `SES-ESTADO.md` — 22 KB: estado de SES/Resend, DNS, DKIM, MAIL FROM, webhooks.
  Leerlo antes de tocar deliverability o DNS.
- `MODELO-DE-NEGOCIO.md` — 25 KB: precios, GTM, combo con Resorty.
- `TIENDANUBE-PUBLICACION.md` — requisitos de la App Store de TN.

## Higiene de contexto

Todo lo que entra al contexto se re-paga en cada turno posterior: un output largo
temprano cuesta varias veces su tamaño.

- **Los tres `.md` de arriba no se abren "para ver"** — son 50 KB entre los tres.
  Buscar adentro con grep antes de leerlos enteros.
- **Comandos largos van cortados**: `git log`, builds y deploys con `| tail -30`.
- **Avisar el `/clear` al cerrar cada unidad de trabajo** — Bruno no lo tiene que
  pedir. El marcador natural es después de deployar y verificar. El criterio no
  es "cambió el tema" sino **"¿vamos a volver a abrir los mismos archivos?"**.
  Donde más rinde es justo después de resolver un bug difícil: ese contexto es
  casi todo intento fallido. Dentro de una tarea sin terminar va `/compact`.

## Estado del trabajo

- **Nada está enviando hoy.** El gate está cerrado y ninguna automation está
  prendida en producción — prenderlas se hace **desde la UI**, que es lo que
  registra el webhook en Tiendanube (un `UPDATE` a mano deja la automation
  activa y sorda).
- **Proveedor sin decidir.** Resend está activo; SES quedó aprobado. Falta el
  ensayo comparativo y el webhook de Resend.
- **Verificar en browser lo de permisos** con el usuario EDITOR de prueba: las
  4 fases están deployadas pero solo se probaron por script.
