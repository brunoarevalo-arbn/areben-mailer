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
npx tsc --noEmit                               # ⚠️ los scripts NO los mira `next build`
node --import tsx scripts/auditar-permisos.ts  # toda action declara su permiso
node --import tsx scripts/probar-permisos.ts   # invariantes de la matriz
node --import tsx scripts/probar-gate.ts       # el gate no se abre solo
node --import tsx scripts/probar-webhooks.ts   # los webhooks de rebotes fallan CERRADO
node --import tsx scripts/probar-carrito.ts    # el carrito de muestra no sale en un envío real
node --import tsx scripts/probar-bienvenida.ts # el cupón del pop-up entra, y el placeholder nunca sale
node --import tsx scripts/probar-productos-dinamicos.ts # la consulta se guarda, los productos no
node --env-file=.env --import tsx scripts/verificar-productos-tn.ts # ↑ pero contra la API real de TN
node --import tsx scripts/probar-tema.ts       # un tema no deja el mail ilegible
node --import tsx scripts/probar-esquema.ts    # el Json de bloques migra sin perder nada
node --import tsx scripts/probar-estilos.ts    # la cascada respeta el orden y no inyecta
node --import tsx scripts/probar-render.ts     # golden: el mail no cambió sin querer
node --import tsx scripts/probar-html.ts       # VML, media queries, tracking, peso
node --import tsx scripts/probar-encabezado.ts # el link de baja no se puede borrar
node --import tsx scripts/probar-imagenes.ts   # permisos, multi-tenant y SVG de /api/imagenes
node --import tsx scripts/probar-marca.ts      # la marca de TN no se guarda adentro del Json
node --import tsx scripts/probar-panel-estilo.ts # ningún control del panel está desconectado
node --import tsx scripts/probar-presets.ts    # ninguna plantilla prearmada tiene un botón que no lleva a nada
node --import tsx scripts/probar-import.ts     # la supresión de un import es de una sola vía
node --import tsx scripts/probar-tramos.ts     # el ramp no pierde ni duplica a nadie, y Microsoft va último
node --import tsx scripts/probar-remitente.ts  # una marca sin remitente propio NO manda (no hay fallback)
```

⚠️ `probar-render.ts` compara contra `scripts/fixtures/render-golden.json`. Si el
HTML cambió **a propósito**, se bendice con `--capturar` y el golden se commitea
**junto** con el cambio, así el diff del commit muestra qué se movió en el mail.
Nunca "para que pase".

⚠️ **`next build` typechequea lo que la app importa, no `scripts/`.** El 30-jul-2026
tres scripts (`ensayo-motor`, `ensayo-campania`, `ses-e2e-supresion`) llamaban a
`crearEnvios` con la firma vieja —sin el `cuentaId` que ganó adelante— y reventaban
recién al correrlos. `npx tsc --noEmit` los agarra a todos; corrélo antes de pushear.

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
default `ses`). **Producción está en `ses` desde el 30-jul-2026** (env cambiada +
redeploy, verificado con el ensayo de volumen: los message id salen con formato
de SES, `0100019f…-000000`, y no el UUID pelado de Resend). Está aprobado
(50k/día) y toda la base cuesta menos de un dólar, contra USD 20/mes de Resend
Pro. ⚠️ El `.env` local **no** define `EMAIL_PROVIDER`, así que localmente cae a
SES también.

**Resend no se da de baja**: el plan free (100 mails/día, 3.000/mes) cuesta cero y
es la red de seguridad **medida** — el 28-jul la misma casilla de Hotmail cayó en
spam por SES y entró en inbox por Resend. Cambiar de proveedor es esa env var
**más un redeploy**.

⚠️ **Los 100/día son un límite de Resend, no del mailer.** Con SES no hay tope
práctico: el escalonado se decide por reputación, no porque el proveedor frene.

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

**El panel de estilo no ofrece lo que el mail no hace.** Los controles salen de
`propsDeRol(tipo, rol)` en `estilos.ts`, y `probar-panel-estilo.ts` renderiza el
bloque con y sin cada propiedad para exigir que el HTML cambie. Encontró 24
perillas desconectadas el día que se escribió: casi todas eran la alineación, que
en `titulo`/`texto`/`boton` la gana el campo de Contenido y en
`hero`/`seccion`/`cupon` está centrada por diseño. Si un `case` del renderer deja
de emitir algo, ese script se pone rojo el mismo día.

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
- **`texto` vacío = el nombre de la cuenta** y **`variante` ausente = el logo de
  la tienda si lo hay**, resueltos al renderizar. Que el default sea vacío y no
  el dato copiado adentro es lo que deja compartir una plantilla entre marcas
  sin que la bienvenida de Zattia salga firmada por BDI. `variante:"texto"` es
  una elección explícita y le gana al logo.
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

## Las plantillas que vienen con la app (`lib/plantillas/presets.ts`)

Un solo archivo con **los presets de campaña y los de automation**, un solo tipo
`Preset` y una sola forma de instanciarlos: `presetsPara(cuenta, remitenteEmail)`.
Hasta F6 eran dos tipos en dos archivos y solo el de automations se resolvía
contra la tienda — por eso las 5 plantillas de la galería tenían **todos los
botones vacíos**.

- **Un preset se declara como función de la cuenta**, nunca como una constante:
  el nombre de la marca va al copy y su sitio a los links, y eso se resuelve al
  instanciar. El logo ni se toca — lo pone el bloque `encabezado` al renderizar.
  Guardar cualquiera de las tres cosas adentro del Json es la bienvenida de
  Zattia firmando como "BDI Accesorios".
- **Sin sitio cargado, el botón no se dibuja.** Los bloques ricos dibujan el
  botón cuando `botonTexto` tiene algo, así que vaciar el texto es cómo se lo
  saca. Un `href=""` que ya salió no se arregla. Lo fija `probar-presets.ts`,
  que renderiza cada preset con y sin tienda.
- **El contenido pasa por `leerContenido()` al instanciarse**, igual que el que
  viene de la base: así lo que se guarda nace en la versión actual del esquema,
  con ids y con la cabecera de marca puesta.
- Los de automation son los mismos de la lista, distinguidos solo por tener
  `trigger`. `presetsGaleria()` es "todos menos esos".
- Las plantillas guardadas se editan en **`/plantillas/[id]`** con el mismo
  `EditorMail` que campañas y automations. Antes había que crear una campaña
  desde la plantilla para poder tocarla, y quedaba una campaña fantasma.

## Productos automáticos (`productos-dinamicos`)

El bloque que justifica que este mailer viva sobre Tiendanube. Se ve igual que
`productos` —es literalmente la misma grilla— pero **guarda la consulta, no los
productos**: `fuente` (más vendidos · novedades · en oferta · de una categoría),
`categoriaId` y cuántos. Una plantilla de "novedades del mes" se arma una vez y
sale distinta cada vez, sin que nadie la edite.

- **Los productos se resuelven al enviar**, con `resolverProductosDinamicos()`,
  que devuelve un mapa `claveProductos(bloque) → productos` y viaja por
  **`RenderOpts.productosDinamicos`** — igual que el logo y el nombre de la
  marca. Lo llaman los **cuatro** caminos por los que sale un mail: la cola de
  campañas, el procesador de automations y las dos acciones de "mandar prueba".
- ⛔ **Los productos NO van adentro del bloque**, a diferencia del `carrito`. El
  primer intento lo hizo así y falló por los dos lados: cada camino de guardado
  tenía que acordarse de limpiarlos (son cuatro, y el quinto que se agregue
  guarda el catálogo de una marca en una plantilla), y la limpieza que evitaba
  eso vivía en `leerContenido` — que `renderEmailHtml` llama de nuevo por las
  dudas, así que **borraba los productos justo antes de dibujarlos y el bloque no
  aparecía nunca**. Con los productos afuera, el bloque no puede guardar lo que
  no tiene.
- ⚠️ **Se resuelve una vez por LOTE, antes del loop de destinatarios.** Adentro
  del loop, los 16.800 contactos de BDI serían 16.800 llamadas a TN contra un
  límite que se comparte con el monitor y con Resorty. Encima hay un caché de
  proceso de 10 minutos por `cuenta+consulta`, que baja las ~840 llamadas de una
  campaña a unas seis.
- `leerContenido` **igual tira** cualquier `items` que llegue en un
  `productos-dinamicos` (y un bloque así no entra por el camino rápido de
  `esActual`): es la red por si un Json entra editado a mano o por un script.
- **Sin productos el bloque no se dibuja** — no se manda un hueco. Vale para TN
  caído, para "no quedó nada en oferta" y para `categoria` sin categoría elegida
  (que además ni pregunta: mandar "lo que sea" donde el autor pidió una
  categoría es peor que no mandar nada).
- **Lo agotado no sale.** Se mira variante por variante, y ⚠️ **`stock: null` es
  ilimitado, no cero**: tratarlo como cero deja media tienda afuera del mail.
- ⚠️ **El modo de falla es silencioso.** Si el `sort_by` que le pedimos a TN
  dejara de existir, la llamada falla, el bloque queda vacío y —como un bloque
  vacío no se dibuja a propósito— **el mail sale sin él y sin ningún error**. Por
  eso hay dos scripts: `probar-productos-dinamicos.ts` (puro, con un `fetch` de
  mentira: verifica que le pedimos a TN lo que creemos) y
  `verificar-productos-tn.ts` (contra la API real: verifica que TN lo entienda).
  El segundo hay que correrlo cuando se toca `lib/tn/products.ts`. Corrido el
  29-jul-2026: las cuatro fuentes devuelven productos en BDI, Zattia y Stunned.
- El preview del editor resuelve la misma consulta por `/api/productos?fuente=…`,
  con la **misma llave** (`claveProductos`, en el archivo puro). Dos definiciones
  de "la misma consulta" serían dos respuestas distintas.

## La marca la trae Tiendanube sola (`lib/marca.ts`)

El logo, el sitio, el idioma y el domicilio salen del endpoint `/store` y viven
en **`Cuenta.config`** (Json libre — sin columna nueva: la base es compartida).
`lib/marca.ts` es el **único** archivo que conoce la forma de ese Json.

- **`marcaDe(cuenta)` devuelve un pedazo de `RenderOpts`**, así que los 8 call
  sites del renderer hacen `{ unsubscribeUrl, ...marcaDe(cuenta) }`. Está atado
  por tipos a `RenderOpts` a propósito: un campo de marca nuevo llega a todos
  lados sin que haya que acordarse de ninguno. Enumerar campos a mano es el bug
  que hacía que el preview mostrara una cosa y el mail saliera otra.
- **Nada de esto se guarda adentro del contenido**: son defaults que resuelve el
  render. El mismo Json sale con el logo de BDI en BDI y con el de Zattia en
  Zattia. Lo fija `probar-marca.ts`.
- ⚠️ **TN devuelve el logo sin protocolo** (`//d1a9….cloudfront.net/…`). En un
  `<img>` de mail eso es una imagen rota: no hay página de la cual heredar el
  `https:`. Lo normaliza `normalizarStore()`.
- El sitio sale de `url_with_protocol` (el dominio propio), no de
  `original_domain`. Sin barra final: los links se arman concatenando.
- **Cómo entra**: sola en el callback del OAuth (una única llamada a `/store`
  para nombre, mail y marca) · el botón **"Traer de mi tienda"** de
  `/remitentes` para las cuentas ya conectadas · `scripts/traer-marcas.ts`
  (dry-run por defecto) para hacerlo de a todas.
- ⚠️ **El merge nunca pisa el resto del `config`** — ahí viven `tema` y
  `lastSyncContactos`. Va siempre por `configConTienda()`, y un campo que TN
  devuelve vacío no borra el que ya estaba.

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

## Importar contactos de afuera (`lib/contactos/importar.ts`)

La mecánica de "traer una lista que vivía en otro proveedor". Hoy la usa
`scripts/importar-nuby-perfit.ts` (la migración de Perfit, que se corre a mano y
una sola vez); está en `lib/` porque es la misma que necesita `importarCSV` de
`/contactos`, y escribirla dos veces es garantizar que se porten distinto.

- ⛔ **La supresión es de UNA SOLA VÍA.** Un mail que aparece como baja, rebote o
  queja en cualquier archivo queda suprimido aunque también esté en la lista de
  altas, y **un contacto ya suprimido no vuelve a `ACTIVO` porque aparezca en un
  CSV**. Es lo único que frena a los 638 rebotados que estaban `ACTIVO` en BDI
  porque los había traído el sync de Tiendanube: sin eso el primer envío propio
  arranca con 3,8% de rebote y AWS revisa arriba de 5%.
- ⚠️ **El consentimiento de un import sale de la pertenencia al archivo, no del
  campo.** `tn_accepts_marketing` es el espejo del casillero de Tiendanube y
  viene `false`/vacío para gente que sí se anotó en un pop-up. En BDI eran 4.423
  suscriptores con el campo vacío que hubieran quedado **invisibles para
  siempre**: la audiencia exige `tnAcceptsMkt: true` (`lib/campanias.ts:21`) y el
  default de la columna es `false`.
- 🔴 **Quien compró sin tildar el casillero y no se anotó en ningún lado se queda
  en `false`** — 1.376 casos en BDI, decidido el 29-jul-2026. Que el proveedor
  anterior les haya mandado igual no es consentimiento.
- ⚠️ **Los export vienen en ISO-8859-1, separados por `;`.** Leerlos como UTF-8
  mete "Ludueña" roto en la base y sale roto en el mail. Y la columna se busca
  **por nombre de header**, nunca por posición: el export de bajas de una campaña
  agrega `Acción` y `Fecha Acción` adelante.
- **El export de bajas trae un registro por EVENTO**, así que la misma casilla
  aparece dos veces. La dedup corre dentro de cada archivo y entre archivos.
- ⚠️ **Los segmentos no saben filtrar por `Contacto.custom`** (ver `CAMPOS` en
  `lib/segmentos.ts`): lo que tiene que poder mandarse va a una **lista**, no a
  `custom`. Por eso el script crea `Perfit — abrieron 2026` con los 800 que
  tenían actividad registrada, en vez de guardar la fecha y esperar segmentarla.

## Auth y permisos

- Sesión: cookie `session` firmada (jose). `proxy.ts` hace el chequeo optimista
  (sin DB); la seguridad real vive en el DAL y en `autorizar()`.
- Rutas públicas (ver `PUBLIC_PREFIXES` en `proxy.ts`): `/login`, `/api/tn/`,
  `/api/track/`, `/api/webhooks/`, `/baja`, `/f/`, los dos endpoints del cron
  (protegidos por `CRON_SECRET`).
- Las rutas `/api/` sin sesión devuelven **401**, no un redirect a HTML.
- Roles: `ADMIN` (todo) · `EDITOR` (arma, no envía) · `VIEWER` (mira). Permisos:
  `ver`, `editar`, `probar`, `enviar`, `integrar`, `remitentes`, `usuarios`,
  `avanzado`.
- `avanzado` es el único permiso **sin action detrás**: gatea los controles finos
  del panel de estilo (interlineado, espaciado, bordes, ocultar en celular). Vive
  en la matriz y no en `localStorage` porque una preferencia de navegador no
  sirve para empaquetar un plan ni para bajarle el ruido a un comerciante.
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

## Los webhooks de rebotes fallan CERRADO

`/api/webhooks/{resend,sendgrid}` y `/api/ses/sns` son **públicos** (`PUBLIC_PREFIXES`)
y lo único que saben hacer es **suprimir contactos** — que es de una sola vía: un
suprimido no vuelve a `ACTIVO` ni re-importando el CSV.

⚠️ **Sin la env de autenticación cargada, los handlers devuelven 503 y no procesan
nada.** Hasta el 30-jul-2026 hacían `if (secret) { verificar }`, así que sin la env
—el estado real, porque el webhook nunca se había dado de alta— un POST anónimo con
`{"type":"email.bounced","data":{"to":[…]}}` quemaba a quien quisiera.

503 y no 401 a propósito: Svix reintenta ante 5xx, así que los eventos que lleguen
antes de que la env esté puesta no se pierden. Lo fija `scripts/probar-webhooks.ts`,
verificado que se pone **rojo** si se restaura la forma vieja.

**Alta del webhook de Resend**: `POST https://api.resend.com/webhooks` con
`{endpoint, events:["email.bounced","email.complained"]}` devuelve el `signing_secret`.
⚠️ **La `RESEND_API_KEY` del `.env` es de solo-envío** (`restricted_api_key`): para
esto hace falta una key **Full access**.

## La bienvenida de los leads de pop-up

Un lead de Resorty **no crea un cliente en Tiendanube**, así que nunca pasaba por
`app/api/tn/eventos/route.ts` —el único lugar que creaba `AutomationRun`— y no
recibía nada. Desde el 30-jul-2026 lo encola **Resorty**: `dispararBienvenida()`
en `areben-popups/lib/mailer.ts`, por SQL crudo, llamada desde `/api/lead`
después de crear el cupón.

- **Una bienvenida es una sola vez en la vida del contacto.** Ese camino mira si
  hubo *algún* run, sin ventana. ⚠️ Es más estricto que el del webhook de TN, que
  re-dispara pasados `capDias` — son dos criterios distintos a propósito.
- `triggerData` trae `{ origen:'popup', campaniaId, cupon, vence, condiciones,
  prizeLabel }`, y **`lib/email/cupon-trigger.ts`** (puro) lo resuelve contra el
  bloque `cupon`: con código lo pisa, **sin código elimina el bloque**, y un run
  del webhook de TN no se toca.
- 🔴 **Sin cupón el bloque se va entero.** Dejar el `BIENVENIDA10` del preset es
  mandar un código que no existe en TN. Es el caso del backfill.
- `scripts/backfill-bienvenida.ts` para los leads históricos: `--marca=` y
  `--dry-run` por default. ⚠️ **El gate tiene que estar en `real` antes**, o los
  runs se marcan `ENVIADO/"dry-run"` y se queman sin reintento.
- ⚠️ **Ninguna de las 4 bienvenidas declara el bloque `cupon`** (verificado el
  30-jul). Hasta que se agregue desde `/automations`, el mail sale sin cupón.

## Estado del trabajo

- **Nada está enviando hoy.** El gate está cerrado y ninguna automation está
  prendida en producción — prenderlas se hace **desde la UI**, que es lo que
  registra el webhook en Tiendanube (un `UPDATE` a mano deja la automation
  activa y sorda).
- 🔴 **BDI tiene la Bienvenida DUPLICADA** (`cmrwf6j3m…` de 3 bloques y
  `cms6kpmqg…` de 4), las dos `PAUSADO` con el mismo asunto. Medido: activar las
  dos encola **354 runs sobre 177 leads** = dos mails por persona.
- 🔴 **Una marca sin fila en `Remitente` NO manda** (30-jul-2026). Antes caía al
  default de `SES_FROM_EMAIL`, que es **uno solo para todo el proyecto**
  (`info@bdiaccesorios.com.ar`): un mail de Stunned o de Resorty Lab salía
  firmado por BDI. No fallaba, salía mal. El fallback se sacó de `armarFrom()`
  y hay guardas antes de encolar (`enviarCampania`, `promoverGanador`,
  `toggleAutomation`) para no descubrirlo con 5.000 envíos en curso.
  - **Nada se marca FALLIDO por esto.** `procesarLote` corta antes del loop y
    devuelve `bloqueado`; el cron de automations deja el run **PENDIENTE**.
    `FALLIDO` es terminal y sin reintento: quemaría un tramo entero —o la única
    bienvenida que un contacto recibe en su vida— por un dato de diez segundos.
  - Hoy **solo Zattia** tiene remitente (`info@zattia.com.ar`). BDI, Stunned,
    Resorty Lab y la cuenta de QA no ⇒ **BDI no puede enviar hasta cargarlo**,
    con `scripts/set-remitente.ts` o desde `/remitentes`.
- **Proveedor sin decidir.** Resend está activo; SES quedó aprobado. Falta el
  ensayo comparativo y el webhook de Resend.
- **Verificar en browser lo de permisos** con el usuario EDITOR de prueba: las
  4 fases están deployadas pero solo se probaron por script.
- **✅ El import de Perfit está APLICADO** (29-jul-2026,
  `scripts/importar-nuby-perfit.ts`). BDI pasó de 16.976 a **21.225 contactos**:
  4.249 nuevos, **650 suprimidos (615 rebotes + 22 bajas + 1 queja + 12 creados
  ya suprimidos)** y 127 que pasaron a aceptar marketing. **Audiencia real:
  18.554.** Verificado: acentos sin mojibake, `custom` en los 4.249 nuevos, y
  correrlo de nuevo da 0 en todo (idempotente).
- **El primer envío propio ya tiene forma**: la lista `Perfit — abrieron 2026`
  va sola y primero — 800 miembros, de los cuales **685 son mandables** (los 115
  restantes son de los que dijeron "no" en el checkout). Después
  `Nuby — suscriptores` (5.280) por tramos. La base completa tenía 6,9% de
  apertura y 6,7% de rebote en Perfit: es un histórico frío y no se manda de una.
- ⚠️ **4.241 de los 5.280 de `Nuby — suscriptores` no tienen nombre**: el pop-up
  de Nuby pedía solo el mail. El merge tag `${contacto.nombre}` se reemplaza por
  **string vacío** (`lib/email/render.ts:586`), así que un "Hola ${contacto.nombre}"
  les llega como "Hola ". En esa lista no se usa el merge tag, o se usa con un
  saludo que funcione vacío. En `Perfit — abrieron 2026` casi no pasa: 668 de 685
  tienen nombre.
- 🔴 **El ramp del primer envío se ordena por BUZÓN, no por antigüedad.** Medido:
  `Perfit — abrieron 2026` es **55,6% Microsoft** (381 de 685) y solo 14,7% Gmail,
  mientras `Nuby — suscriptores` es **87,4% Gmail** y 8,3% Microsoft. Estrenar la
  IP fría de SES contra la lista "tibia" sería mandar la mitad al buzón que ya nos
  mandó a spam. **Gmail primero, Microsoft al final** (o por Resend free, que ahí
  entra en inbox).
- ⚠️ **Las 880 "aperturas" de la campaña de Perfit están infladas.** Outlook y
  Hotmail pre-cargan las imágenes en su escaneo de seguridad y disparan el pixel
  sin que nadie mire nada — es la razón de ese 55,6%. La señal real son los **94
  clicks**, que no se falsifican por prefetch. Falta exportarlos de Perfit.
- ⚠️ **El motor manda a una lista o segmento COMPLETO**: no hay "mandale a 500 de
  estos 5.280", y los segmentos no filtran por dominio ni por cantidad (ver
  `CAMPOS` en `lib/segmentos.ts`). Escalonar es **fabricar listas**:
  `scripts/listas-por-tramo.ts` (dry-run por default) parte una lista en tramos de
  un solo buzón siguiendo una escalera de volumen, con `lib/contactos/tramos.ts`
  como parte pura. Es la misma pieza que después necesita la cuarentena del SaaS.
  - **Nadie se re-asigna**: quien ya está en un tramo del prefijo no entra en otro,
    así que re-correrlo cuando la lista crece solo agrega tramos al final. Eso es
    lo que impide mandar dos veces.
  - **La audiencia sale de `MANDABLE`** (`lib/campanias.ts`), la misma constante que
    usa la campaña: dos criterios serían un tramo que promete 500 y un envío de 430.
  - Medido el 30-jul-2026 con el script: `Nuby — suscriptores` son 5.280 mandables
    (87,4% Gmail) y `Perfit — abrieron 2026` 685, de los cuales **74 también están
    en Nuby** — por eso existe `--excluir`.
