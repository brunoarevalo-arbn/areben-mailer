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
node --import tsx scripts/auditar-responsive.ts # el panel no vuelve a nacer solo-para-escritorio
node --import tsx scripts/probar-permisos.ts   # invariantes de la matriz
node --import tsx scripts/probar-gate.ts       # el gate no se abre solo
node --import tsx scripts/probar-webhooks.ts   # los webhooks de rebotes fallan CERRADO
node --import tsx scripts/probar-supresion.ts  # una queja no cruza de tienda; un rebote duro sí
node --env-file=.env --import tsx scripts/probar-rebote-tipo.ts # el rebote deja escrito SI FUE DURO (y el reintento de SNS no lo duplica)
node --env-file=.env --import tsx scripts/probar-cadena-cola.ts # la posta de la cola se confirma por el LEASE, no por la request
node --import tsx scripts/probar-carrito.ts    # el carrito de muestra no sale en un envío real
node --import tsx scripts/probar-recuperados.ts # un fallo de TN no se lee como "no compró", y el barrido siempre avanza
node --import tsx scripts/probar-bienvenida.ts # el cupón del pop-up entra, el placeholder nunca sale, y NUEVO_SUSCRIPTOR no lo alcanza ningún evento de TN
node --import tsx scripts/probar-productos-dinamicos.ts # la consulta se guarda, los productos no
node --import tsx scripts/probar-links-productos.ts # un producto sin publicar no sale, y nada más frena
node --env-file=.env --import tsx scripts/verificar-productos-tn.ts # ↑ pero contra la API real de TN
node --import tsx scripts/probar-tema.ts       # un tema no deja el mail ilegible
node --import tsx scripts/probar-contraste.ts  # el panel avisa el texto invisible, la pantalla de envío lo pregunta, y los dos miden contra el fondo que el mail PINTA
node --import tsx scripts/probar-marcado.ts    # el `data-b` del preview NO sale en un envío
node --import tsx scripts/probar-esquema.ts    # el Json de bloques migra sin perder nada
node --import tsx scripts/probar-portapapeles.ts # lo que se pega es un bloque nuestro, y sale con id nuevo
node --import tsx scripts/probar-estilos.ts    # la cascada respeta el orden y no inyecta
node --import tsx scripts/probar-render.ts     # golden: el mail no cambió sin querer
node --import tsx scripts/probar-html.ts       # VML, media queries, tracking, peso
node --import tsx scripts/probar-banda-link.ts # una foto puede ser un link, y NUNCA un <a> dentro de otro
node --import tsx scripts/probar-imagen-escala.ts # una foto puede salir más chica y alineada, y Outlook obedece
node --import tsx scripts/probar-recorte.ts     # el recorte no deforma ni agranda, y el deslizador mueve un solo eje
node --import tsx scripts/probar-precio-oculto.ts # lo que el HTML oculta, el text/plain tampoco lo manda
node --import tsx scripts/probar-encabezado.ts # el link de baja no se puede borrar
node --import tsx scripts/probar-imagenes.ts   # permisos, multi-tenant y SVG de /api/imagenes
node --import tsx scripts/probar-marca.ts      # la marca de TN no se guarda adentro del Json
node --import tsx scripts/probar-panel-estilo.ts # ningún control del panel está desconectado
node --import tsx scripts/probar-presets.ts    # ninguna plantilla prearmada tiene un botón que no lleva a nada
node --import tsx scripts/probar-import.ts     # la supresión de un import es de una sola vía
node --import tsx scripts/probar-tramos.ts     # el ramp no pierde ni duplica a nadie, y Microsoft va último
node --import tsx scripts/probar-remitente.ts  # una marca sin remitente propio NO manda (no hay fallback)
node --import tsx scripts/probar-tracking.ts   # los links del mail cuelgan del dominio de la marca, y un valor basura cae al fallback
node --import tsx scripts/probar-redes.ts      # cada red de la lista tiene su PNG; lo que no tiene icono sale en texto, nunca roto
node --import tsx scripts/probar-negritas.ts   # `**negrita**` se resuelve DESPUÉS de escapar, y solo en los cuatro campos que se escriben
node --import tsx scripts/probar-texto-rico.ts # un campo de texto rico rinde el MISMO html que el string de siempre
node --env-file=.env --import tsx scripts/probar-segmentos.ts # el "no abrió/no clickeó" es RECIBIÓ y no lo hizo, nunca "no me consta"
node --import tsx scripts/probar-automations.ts # una automation por trigger: dos son dos mails a la misma persona
node --import tsx scripts/probar-fechas.ts      # el día de las métricas es el del calendario local, no el día UTC
```

⚠️ `probar-render.ts` compara contra `scripts/fixtures/render-golden.json`. Si el
HTML cambió **a propósito**, se bendice con `--capturar` y el golden se commitea
**junto** con el cambio, así el diff del commit muestra qué se movió en el mail.
Nunca "para que pase".

🔴 **NADA typechequea `scripts/`, ni siquiera `npx tsc --noEmit`.** `tsconfig.json`
los tiene en `exclude`, así que la línea de arriba —que decía que los agarra a
todos— era falsa; se verificó el 1-ago-2026 cambiando la forma de un bloque y
viendo que los dos scripts que la usaban con la forma vieja pasaban en verde.
Es el mismo agujero del 30-jul (`ensayo-motor`, `ensayo-campania` y
`ses-e2e-supresion` llamaban a `crearEnvios` con la firma vieja y reventaban
recién al correrlos). **La única red que hay es correrlos**: si tocaste un tipo
de `lib/email/` o de `lib/plantillas/`, corré las auditorías de la lista de
arriba antes de pushear — un `tsx` stripea los tipos y no se queja de nada.

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
                                (v4 desde el 1-ago-2026: `columnas` es `celdas[]`)
                  estilos.ts  ← cascada de estilo por bloque (tokens + lista blanca)
lib/auth.ts       autorizar/chequear/autorizarApi ← ÚNICO camino de autorización
lib/permisos.ts   matriz de roles (puro: lo importa server Y cliente)
lib/fechas.ts     ZONA + el día del calendario ← ÚNICO lugar con una zona horaria.
                  ⛔ Ningún `date_trunc('day', …)` pelado: agrupar en UTC hace que
                  a las 21:00 el panel estrene el día siguiente
lib/tn/…          cliente Tiendanube, import de contactos/órdenes, webhooks
components/ui/    Button, Card, Badge, Input, Select, Textarea, NumInput, Desplegable,
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

🔴 **La legibilidad contextual sirve para fondos EXTREMOS, no para los del medio**
(medido el 3-ago-2026 aplicando `caja.fondo` a los presets). Sobre negro o sobre
un rosa muy claro el recálculo acierta solo; sobre el celeste `#18a8e8` de
`final-sale` devolvió un celeste apenas más oscuro —links ilegibles sobre su
propia banda— y hubo que clavar el color a mano. **En una banda de saturación
media el color se escribe**, no se hereda. (El otro motivo para clavarlo es que
el color *sea* el rasgo: el lima de `dos-colores` sobre negro es legible como
blanco, pero blanco no es esa referencia.)

🔴 **Un color ELEGIDO se respeta aunque quede ilegible, y por eso el panel avisa**
(`lib/email/contraste.ts`, 9-ago-2026). El T01 de BDI salió a 501 personas con
los seis nombres de producto invisibles: el bloque `productos` tenía
`estilo.cuerpo.color: "$fondo"` guardado a mano y el motor lo dibujó — contraste
**1.00:1**. El motor no cambia (obedecer es correcto: es el mail de quien lo
arma); lo que cambia es que ahora se ve antes de mandarlo.

- **`superficieDe(tipo, caja, pal, bg)` es el fondo real de un bloque**, y es la
  ÚNICA definición: los cinco `case` del renderer que armaban un `bg` a mano
  (encabezado, menu, hero, seccion, cupon) ahora la llaman. Dos definiciones
  serían un aviso que dice una cosa y un mail que dibuja otra.
- **`sobreDeRol` es qué le pasa el renderer a `resolverEstilo` como `sobre`**, rol
  por rol — y el panel resuelve con eso, que antes no hacía: la pastilla "auto"
  de una portada mostraba el color de la paleta mientras el mail dibujaba el
  recalculado.
- ⚠️ **El ratio NO se calcula con `luminancia()` de `tema.ts`.** Esa pesa los
  canales crudos (sirve para "¿es oscuro?") y como ratio miente: la primera
  lectura del T01 dio "3,09:1" con esa fórmula. Un ratio linealiza cada canal
  antes de pesarlo.
- 🔑 **Sólo se avisa sobre un color que ELIGIÓ una persona**, y alcanza con que
  hayan elegido el **fondo** (un botón con fondo nuevo y texto en automático se
  queda con el `$sobreAcento` del acento viejo). Los defaults no se avisan: el
  gris tenue mide 2,3:1 y está en las 38 plantillas propias — un cartel que
  aparece siempre no lo lee nadie. Umbrales **1,5** (no se ve) y **3** (flojo),
  no los 4,5 de WCAG AA.

### El freno al mandar (`lib/email/revisar.ts`, 9-ago-2026)

🔴 **El cartel del panel sólo lo ve quien abrió ese bloque**, y el `$fondo` del
T01 estaba en uno que nadie había vuelto a abrir. `revisarContraste(contenido,
marca)` recorre el documento entero y devuelve los hallazgos; el cartel vive
**pegado al botón que manda** y `preguntaAntesDeMandar()` arma la pregunta.

- **Cinco puertas, un solo texto**: enviar, continuar la tanda, programar y
  promover el ganador del A/B (`CampaniaEditor`) + **activar** una automation
  (`AutomationEditor`, donde el envío empieza al encender y después sale solo).
  ⚠️ **Pausar nunca pregunta**: la acción segura no se frena por nada.
- 🔑 **Sólo lo INVISIBLE interrumpe.** El "flojo" se muestra y no corta: cinco de
  las 42 plantillas propias tienen alguno y una pregunta que aparece siempre se
  contesta sin leerla. ⚠️ **«Oscura con acento» tiene un invisible a propósito**
  (botón blanco sobre su amarillo, 1,49:1, clonado de R-019) y está anotada en
  el ensayo: si nace otra, se pone rojo.
- 🔑 **`rolesDibujados(bloque)` no es `ROLES_POR_TIPO`.** Esa contesta "qué
  controles ofrece el panel para este TIPO"; acá la pregunta es de INSTANCIA —
  una portada sin bajada no dibuja ningún subtítulo, y un color elegido en la
  capa de documento haría cantar el aviso en todas. Es un espejo de las
  condiciones del renderer, y `probar-contraste.ts` lo cruza **pintando cada rol
  de magenta y mirando si sale texto de ese color en el HTML**.
- ⛔ **Sobre una foto no se mide nada**: en un `hero`/`seccion` con `fondoImagen`
  el color de atrás lo pone la imagen, así que el bloque se saltea. Un bloque
  oculto en las dos vistas, también.
- ⚠️ **No hay freno del lado del servidor y es a propósito**: bloquear
  contradiría que un color elegido se respeta, y obligaría a persistir la
  confirmación para que el cron no frenara una campaña programada.

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
del atributo `style="…"`. Los preview van con `sandbox` por lo mismo.

### Negrita inline: `**palabra**` (2-ago-2026)

El único formato que se puede pedir adentro de un texto. **El bloque sigue siendo
un `string` plano**: no hay editor rich-text, ni esquema nuevo, ni migración — el
botón "Negrita" del editor (`components/editor/BotonNegrita.tsx`) no hace más que
escribir los cuatro asteriscos alrededor de la selección.

- 🔴 **`negritas()` recibe texto YA ESCAPADO, y ese orden es toda la seguridad.**
  Después de `esc()` no queda un `<` que venga de la base, así que los únicos tags
  de la salida son los `<strong>` que emite el motor. Llamarla antes de escapar
  abre el XSS almacenado que motivó que el motor escape todo. Por eso el único
  llamador es `nl()`, que escapa primero, y **no se exporta**.
- **El alcance sale gratis de `nl()`**: los cuatro campos que lo llaman —el bloque
  `texto`, la bajada de `seccion`, la bajada de `hero` y el texto de una celda de
  `columnas`— son exactamente los cuatro donde se escribe de verdad. Los títulos
  van por `esc()` pelado y quedan afuera **a propósito**: ya salen grandes y
  pesados.
- ⚠️ **La parte text/plain va por `sinNegritas()`**. Un cuerpo que dice
  `**Solo hasta el domingo**` se lee como marcado de spam, no como énfasis, y ese
  texto sale en cada envío.
- Lo fija `probar-negritas.ts`, verificado en rojo invirtiendo el orden de
  `esc()`/`negritas()` y sacando el `sinNegritas()` del texto plano.

### Texto con formato POR SELECCIÓN: `TextoRico` (5-ago-2026)

`lib/email/texto-rico.ts`. **Ocho campos** dejaron de ser `string` y pasaron a
`TextoRico = string | Trozo[]`: los cuatro de cuerpo (`texto.texto`,
`hero.subtitulo`, `seccion.texto`, `Columna.texto`) y los cuatro de título
(`titulo.texto`, `hero.titulo`, `seccion.titulo`, `Columna.titulo`). Un `Trozo`
es `{ t, fuente?, tamano?, peso?, italica?, subrayado?, color?, fondo?, url? }` —
**las mismas claves que `EstiloBloque`**, para que el saneo reuse los mismos
validadores y quien conoce la cascada lea un trozo sin manual.

- 🔑 **Es una UNIÓN, no un reemplazo, y el `string` es la forma NORMAL.** Por eso
  no hay migración, `V_ACTUAL` **no sube**, los 38 presets no se tocaron y el
  golden no se movió un byte. Precedente literal: `Columna.botonTexto` e `icono`
  entraron sin bump con el mismo argumento — `V_ACTUAL` existe para cambios de
  **forma que requieren conversión**, y acá no hay nada que convertir.
- 🔑 **`canonizar()` es lo que hace que esto sea barato.** Fusiona los trozos
  adyacentes iguales y, si queda uno solo sin formato, **devuelve el `string`
  pelado**. Sin eso, el primer click en negrita convertiría el campo a array para
  siempre y en seis meses la mitad de los mails guardados serían arrays de un
  trozo. Con eso, el array es la excepción.
- 🔴 **La única asimetría: un `string` interpreta `**negrita**` y un `Trozo[]`
  NO** (adentro de un trozo los asteriscos quedan literales — ahí la negrita se
  pide con `peso`). Por eso `canonizar` **se niega a colapsar un trozo cuyo texto
  tenga `**`**: colapsarlo haría aparecer un `<strong>` que nadie pidió.
- **El renderer**: `cuerpoHtml()` y `tituloHtml()` en `render.ts`. La rama
  `string` llama a `nl()` y a `esc()` **sin tocarlas**, y ahí está toda la
  garantía de compatibilidad. Son dos funciones y no una con bandera porque la
  diferencia es una invariante fijada por test (los títulos no interpretan `**`,
  y tampoco cortan renglones).
- 🔴 **`trozoCss()` es lista blanca pura: ni una interpolación de un string del
  Json adentro del `style`.** La tipografía sale de `FUENTES[clave]` (un literal
  del código), el tamaño de `px()` sobre un número ya acotado y el color de
  `sanearColor` + `resolverColor`. Por eso `Trozo.fuente` guarda una **clave** y
  no un stack CSS. Y `Trozo.color` acepta **token** (`$acento`) además de hex: si
  fuera solo hex, pintar una palabra la clavaría y dejaría de repintarse al
  cambiar el tema.
- 🔴 **La URL del link se valida en el EMISOR, no solo al sanear.** `esActual()`
  deja pasar los documentos por el camino rápido sin re-sanear, así que un
  `javascript:` filtrado únicamente en `sanearTrozos` saldría entero en un mail
  cuyo Json nunca volvió a pasar por el saneo. Misma doctrina que los colores.
- 🔴 **Tres cosas que no son el call site** y que solo se ven en el celular o en
  Outlook: (a) **un trozo con `tamano` le saca al contenedor la clase que lo
  achica** (`m-h1`/`m-h2`/`m-c1`/`m-c2`) — el inline de un hijo le gana a la
  clase del padre, así que si no, el título mezclaría dos tamaños en el teléfono;
  (b) **un trozo con link desactiva el ancla de la celda**, igual que
  `botonTexto`, o sale un `<a>` adentro de otro; (c) el **`alt`** de la foto de
  una celda va por `textoPlano()`, nunca por el HTML.
- ⛔ **Un trozo NO puede emitir una `class`** (regla única del shell) ⇒ no existe
  "un trozo que se achica en el celular". Lo frena `probar-html.ts`.
- ⛔ Afuera quedan los 5 `botonTexto` —el texto del botón se emite **dos veces**,
  VML + ancla, y el VML no dibuja spans adentro—, `cupon`, `menu`, `encabezado`
  (aplica mayúsculas en JS sobre el string) e `imagen.alt`.
- Lo fija **`scripts/probar-texto-rico.ts`**, cuyo test principal es la
  **equivalencia**: para todo `s` sin `**`, `render(campo = s)` es **idéntico** a
  `render(campo = [{t: s}])`. Encontró tres bugs reales al escribirlo (el `\n` de
  los títulos, el `<span>` vacío que movía el HTML al canonizar, y la URL sin
  validar en el emisor).

### El editor: `CampoRico` (5-ago-2026)

`components/editor/CampoRico.tsx`. Un `contenteditable` con una barra fija que
reemplaza al `<Input>`/`<Textarea>` en los ocho campos. Con esto el motor dejó de
estar apagado: `ConNegrita`/`BotonNegrita.tsx` **se borró** —nadie escribe más
asteriscos a mano— y `negritas()` queda sólo para lo ya guardado.

- 🔑 **No es un componente controlado, y no puede serlo.** Mientras el campo
  tiene el foco **el DOM es la fuente de verdad**: repintar es reemplazar nodos y
  la selección del navegador apunta a nodos, así que hacerlo en cada tecla le
  destruye el cursor a quien escribe. Se pinta al montar, cada tecla LEE el DOM y
  avisa para arriba, y sólo se repinta cuando el valor que baja **no es el último
  que subió** (`ultimo`, un ref) — que son exactamente dos casos: **⌘Z** y
  **elegir otro bloque**. Después de un botón de la barra sí se repinta, y por eso
  ahí la selección se restaura a mano.
- 🔑 **La selección viaja como dos números.** El componente traduce `Range` →
  offsets del texto plano (`medir`), llama a las funciones puras de
  `texto-rico.ts` y vuelve (`punto`). Es lo que deja que partir, fusionar y
  colapsar los trozos lo pruebe un script de Node; **nada de lo que pasa adentro
  de un `contenteditable` lo ve un test**.
- El formato de cada trozo vive en un **`data-f`** del `<span>`, que es lo que
  hace que tipear adentro de una palabra en negrita **siga en negrita** (el
  navegador clona el span solo). ⚠️ Se re-sanea al leerlo: `sanearFormato` está
  exportada por eso.
- 🔴 **`negritasATrozos` existe para que el primer click no meta asteriscos en un
  mail.** Un `string` interpreta `**domingo**` y un `Trozo[]` no, así que un campo
  con `**` que pasa a trozos por cualquier motivo perdía la negrita y ganaba
  cuatro asteriscos literales en la casilla — hay 9 presets con `**` adentro. La
  conversión usa **el mismo regex que `negritas()`** y corre **sólo en los cuatro
  campos de CUERPO** (`cuerpo`): en un título los asteriscos nunca significaron
  nada. ⚠️ El HTML de ese campo pasa de `<strong>x</strong>` a
  `<span style="font-weight:700">x</span>` —se ve idéntico— y la dispara **una
  edición de una persona**, nunca el render: el golden no se mueve.
- 🔴 **`ajustarSeleccion` cierra el modo de falla del merge tag.** Formatear media
  palabra de `${contacto.nombre}` partía el string con un `<span>`, el regex de
  `aplicarMergeTags` dejaba de matchear y el tag salía literal. La barra estira la
  selección hasta abarcar el tag entero antes de aplicar nada.
- ⛔ **Al pegar entra TEXTO, nunca HTML.** Lo del portapapeles trae `<span style>`,
  `<font>` y clases del programa del que salió, y el formato de un trozo es una
  lista blanca. El Enter también se maneja a mano o el navegador mete `<div>`
  propios.
- ⚠️ **El `<br data-fin>` del final de un campo multilínea no sobra**: un `<br>`
  final no dibuja el renglón que abre —es por lo que "el Enter al final no hace
  nada" en todo `contenteditable`— y `medir`, `punto` y `leerDom` lo saltean.
- **La barra es FIJA y no flotante.** Una que sólo aparece con algo seleccionado
  es una que el comerciante no descubre, y la posición de una selección adentro de
  un panel scrolleable es de lo primero que se rompe en Safari. Los botones frenan
  su `onMouseDown` (si no, el click roba el foco y se pierde la selección **antes**
  del `onClick`); los dos `<select>` no pueden, y por eso la última selección se
  guarda en estado y **no se limpia al perder el foco**.
- `enCampo()` de `EditorMail` ya preguntaba por `isContentEditable`, así que ⌫,
  ↑/↓ y el ⌘V de pegar bloques quedaron guardados solos.

### El preview del editor se puede tocar (2-ago-2026)

Un click adentro del mail abre el formulario de ESE bloque. Antes navegaba el
iframe a la tienda —que no se deja enmarcar— y **dejaba el preview en blanco**.

- **`RenderOpts.marcarBloques`** le pone `data-b="<id>"` a cada bloque, **en la
  etiqueta que ya emitía** (no envuelve nada, no cambia el layout). ⛔ Lo prende
  **solo** `PreviewMail`: `probar-marcado.ts` fija que sin la opción no aparezca
  ni un `data-b` —son bytes contra los ~102 KB con los que Gmail recorta— y que
  con ella **todo** bloque que dibuja algo quede marcado y **fuera de los
  comentarios condicionales** (adentro de un `<!--[if mso]>` el navegador no lo
  ve, que es justo quien lo tiene que leer).
- 🔴 **El id tiene que ser el que conoce el editor.** `renderEmailHtml` vuelve a
  pasar el documento por `leerContenido`, y un documento **sin `v`** se migra:
  la migración materializa un encabezado con id NUEVO y el click no selecciona
  nada. Los documentos reales ya vienen en la versión actual; los tests tienen
  que pasar `v: V_ACTUAL` o prueban otra cosa.
- 🔴 **El click NO se frena con un listener: se frena con `pointer-events: none`**
  (corregido el 4-ago-2026). Hasta entonces había un `preventDefault()` colgado
  del documento del iframe, y **en Safari no corre nunca**: WebKit, antes de
  despachar un evento, chequea si en ese contexto se puede ejecutar script, y en
  un frame sandboxeado sin `allow-scripts` la respuesta es no ⇒ descarta todos
  los listeners, **también los que colgó el padre**. Blink no hace ese chequeo,
  así que en Chrome andaba. Costó dos rondas de "ya está arreglado" contra un
  usuario que veía el preview en blanco.
  - ⚠️ **Lo que confunde: el contorno del bloque y el auto-scroll SÍ andan en los
    dos navegadores.** Son escrituras directas del padre sobre el DOM del hijo,
    no eventos. El preview parece vivo y el click está muerto.
  - ⛔ **La salida no es `allow-scripts`**: junto con `allow-same-origin` anula el
    sandbox entero y el bloque de `html` crudo correría con la cookie de sesión.
  - El precio de `pointer-events: none` es que el mail ya no scrollea adentro del
    iframe: **el iframe mide todo el mail y el que scrollea es el contenedor**.
    Como `transform: scale()` no cambia el tamaño de layout, hace falta una caja
    intermedia con el alto YA ESCALADO o el contenedor scrollea de más.
  - Qué bloque se tocó lo resuelve `elementFromPoint()` **desde el padre** —otra
    lectura directa, no un evento—, con las coordenadas divididas por la escala.
- 🔴 **Ningún script de Node puede ver esto.** `probar-marcado.ts` estaba en verde
  todo el tiempo: mira el HTML, y el HTML estaba bien. Lo que fallaba era el
  navegador. **Un cambio en el preview se verifica abriendo un navegador —y si el
  usuario usa Safari, ese navegador es Safari.**
- El iframe del editor va con **`sandbox="allow-same-origin"`**, sin
  `allow-scripts`: el panel necesita leer el `contentDocument` para saber qué se
  tocó, y sin `allow-scripts` no corre **nada** de adentro —ni `<script>`, ni
  `onerror=`, ni `javascript:`—, así que el XSS almacenado sigue tapado. Tampoco
  van `allow-forms`, `allow-popups` ni `allow-top-navigation`.
  ⛔ **La miniatura de la galería NO cambia**: sigue `sandbox=""` +
  `pointer-events-none`. Y `pointer-events-none` no servía para el editor: el
  mail es más alto que el marco y hay que poder scrollearlo adentro.

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
- 🔑 **Una banda con foto (`hero`/`seccion`) puede ser ella misma el link:
  `botonUrl` sin `botonTexto`.** Antes de eso el motor no tenía **ninguna** forma
  de hacer clickeable una foto —el bloque `imagen` tampoco: su `url` es el `src`—
  y un mail de portada fotográfica salía con su superficie más grande muerta. Se
  midió en el T01 de BDI: 350 px de foto, 141 aperturas, CTOR 2,1%.
  ⛔ **Excluyente con el botón**: un `<a>` adentro de otro. Outlook va por el
  `href` del `<v:rect>`, y ⚠️ **ese click no lo mide el tracking** (el regex mira
  `<a>` y `<v:roundrect>`). Lo fija `probar-banda-link.ts`.
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

📗 **Las reglas de qué plantilla puede entrar a la galería viven en `PLANTILLAS.md`**, junto
con el vocabulario de diseño y el backlog del motor. Leerlo antes de sumar o tocar un preset.

`presets.ts` es el **archivo público**: tipos, helpers (`cta`, `botonSi`, `sinBoton`,
`redes`, `aire`), la composición de `DEFS` y la API. Los presets en sí viven en
`lib/plantillas/familias/*.ts`, uno por familia. ⚠️ **No se convierte en `presets/index.ts`**:
`scripts/fix-automations-marca.ts` y `scripts/crear-automations-marca.ts` lo importan con
extensión explícita (`'../lib/plantillas/presets.ts'`) y se romperían.

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
- 🔑 **Mirar es gratis; crear no** (2-ago-2026). La tarjeta ofrece **"Ver"**, que
  abre el mail entero en un modal, y recién ahí se elige qué crear: **campaña** o
  **automation**. La palabra "Usar" no existe más — creaba una campaña `BORRADOR`
  sin decirlo, y `/campanias` se llenaba de plantillas que alguien quiso mirar.
  El HTML de la galería **ya viaja en el payload**, así que el modal no pide
  nada; las listas de campañas y automations sí, por `/api/vista`.
- Una automation desde una plantilla respeta las mismas guardas que
  `crearAutomation`: **una por trigger** (`automationDelTrigger`) y **nace
  PAUSADA**. Y avisa —mirando los bloques, no por regla general— cuando la
  plantilla elegida no trae el bloque que ese disparador necesita: sin `cupon`,
  la bienvenida sale sin el premio que la persona ganó
  (`aplicarCuponDelTrigger` **pisa** el bloque, no lo crea).

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

- **`marcaDe(cuenta, appUrl)` devuelve un pedazo de `RenderOpts`**, así que los 8
  call sites del renderer hacen `{ unsubscribeUrl, ...marcaDe(cuenta, appUrl) }`.
  Está atado por tipos a `RenderOpts` a propósito: un campo de marca nuevo llega
  a todos lados sin que haya que acordarse de ninguno. Enumerar campos a mano es
  el bug que hacía que el preview mostrara una cosa y el mail saliera otra.
  - **`appUrl` va por parámetro y es obligatorio.** Este archivo se declara puro
    (lo importa el cliente), así que no lee `process.env`: es el mismo criterio
    que `hostDeEnvio`, con el que se resuelve `assetsBase`. Obligatorio para que
    olvidarlo sea un error de tipos y no un mail sin iconos.
  - 🔴 **`assetsBase` —de donde salen los iconos de `redes`— entró acá el
    2-ago-2026 y era el último campo de `RenderOpts` que cada call site armaba a
    mano.** El preview del editor, el único que no podía resolverlo en el
    servidor, lo sacaba de `window.location.origin` con un ternario para el
    render del servidor — y ese ternario ERA el bug: en el servidor `window` no
    existe ⇒ `assetsBase` vacío ⇒ el bloque `redes` caía al fallback de texto.
    El editor mostraba las redes sin iconos mientras el envío real las mandaba
    bien. Lo fija `probar-tracking.ts`.
- **Nada de esto se guarda adentro del contenido**: son defaults que resuelve el
  render. El mismo Json sale con el logo de BDI en BDI y con el de Zattia en
  Zattia. Lo fija `probar-marca.ts`.
- ⚠️ **TN devuelve el logo sin protocolo** (`//d1a9….cloudfront.net/…`). En un
  `<img>` de mail eso es una imagen rota: no hay página de la cual heredar el
  `https:`. Lo normaliza `normalizarStore()`.
- El sitio sale de `url_with_protocol` (el dominio propio), no de
  `original_domain`. Sin barra final: los links se arman concatenando.
- 🔑 **Las redes son parte de la marca, no del mail** (`config.redes`, se cargan a
  mano en `/remitentes`: TN **no** las devuelve en `/store`). Un bloque `redes`
  sin links propios dibuja las de la cuenta, igual que el `encabezado` resuelve
  el logo. Es lo que permite que una **plantilla** cierre con redes sin guardar
  la cuenta de nadie adentro del Json. ⚠️ Hasta el 1-ago-2026 el helper `redes`
  de los presets traía tres links VACÍOS: estaba en 12 plantillas y **no dibujó
  nunca nada**. Sin redes cargadas el bloque sigue sin dibujarse — nunca un
  `href=""`.
- **Cómo entra**: sola en el callback del OAuth (una única llamada a `/store`
  para nombre, mail y marca) · el botón **"Traer de mi tienda"** de
  `/remitentes` para las cuentas ya conectadas · `scripts/traer-marcas.ts`
  (dry-run por defecto) para hacerlo de a todas.
- ⚠️ **El merge nunca pisa el resto del `config`** — ahí viven `tema` y
  `lastSyncContactos`. Va siempre por `configConTienda()`, y un campo que TN
  devuelve vacío no borra el que ya estaba.
- **El domicilio del pie se puede editar y apagar** (`/remitentes`). Lo que trae
  TN es el domicilio **fiscal** (`config.direccion`); el que escribe el
  comerciante vive aparte en **`config.direccionPropia`** y le gana. Son dos
  claves y no una porque "Traer de mi tienda" se corre para actualizar el logo y
  pisaría el texto elegido; así, además, vaciar el campo vuelve solo al de TN.
- **Se puede apagar** (`config.direccionOculta`, checkbox en `/remitentes`). La clave es "ocultar" y no "mostrar" para que una cuenta que no
  la tiene siga saliendo con domicilio: al revés, un default nuevo cambiaría el
  pie de todas las marcas existentes. **El dato no se borra** —"Traer de mi
  tienda" lo reescribe igual, y así se puede volver atrás con un click—: el
  filtro vive en `marcaDe()`, la única puerta por la que la marca llega a los
  ocho call sites del renderer. ⚠️ El domicilio del remitente es obligatorio
  bajo CAN-SPAM para lo que entra a EE.UU. y una señal que miran los filtros:
  apagarlo es decisión del comerciante. **El link de baja no se puede apagar** —
  por eso el pie no es un bloque.

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
- 🔑 **El navegador ACHICA antes de subir** (11-ago-2026, `lib/imagenes.ts`):
  tope de 1200 px de ancho y JPEG q 0,72, con `<canvas>` y sin ninguna
  dependencia nueva. Medido: una foto de 4000×3000 pasa de 7,4 MB a 392 KB. No
  es cosmético — **el egress de una imagen se paga por destinatario**. Por eso
  los 5 MB ahora se miden sobre lo que SE SUBE y no sobre lo elegido (una foto
  de celular de 7 MB entra), con un techo de 40 MB antes de decodificar porque
  abrir eso en un canvas cuelga la pestaña.
- El mismo camino recorta a **16:9 · 1:1 · 4:5** desde el bloque `imagen`
  (`lib/imagenes-encuadre.ts` es la geometría PURA, que es lo único que un
  script de Node puede probar). ⛔ **Un GIF no se toca nunca** (el canvas se come
  la animación), **un PNG sigue siendo PNG** (a JPEG, lo transparente sale
  negro) y **la extensión sale del `type` real del blob** (Safari devuelve PNG
  cuando no puede dar el pedido). El recorte **siempre parte del original**
  (`bloque.urlOriginal`, que se escribe una sola vez): recortar un recorte
  compone la pérdida y no hay vuelta atrás.
- ⚠️ **Cada recorte es un objeto nuevo en Blob y el anterior no se borra**, por
  lo mismo que no se borra ninguna: la URL puede estar en un mail ya entregado.
- **El `cuentaId` va en el WHERE**, nunca en un chequeo después del `findUnique`.
- **El contador de bytes por cuenta existe desde el día uno.** La cuota puede
  venir después; medir no se retrofitea: Blob se paga y el egress de una imagen
  se paga **por destinatario** — 16.800 envíos con cinco fotos es ancho de banda
  de verdad.
- ⚠️ **Borrar una imagen rompe los mails ya enviados**: la URL está adentro del
  correo que ya está en la casilla de otra persona. La UI avisa; no hay borrado
  masivo.
- 🔴 **El prefijo `stock/` es del proyecto, no de nadie**: son las 36 fotos de las
  plantillas prearmadas y **no tienen fila en `ImagenMail`** — así que no salen en
  la biblioteca de ningún comerciante, no le suman bytes al contador y **no se
  pueden borrar desde la app** (`/api/imagenes/[id]` borra por id de fila). Se
  suben con `node --env-file=.env.local --import tsx scripts/subir-fotos-stock.ts`:
  ⚠️ el token de Blob vive en **`.env.local`**, no en el `.env` que usan los demás
  scripts. El catálogo es `lib/plantillas/fotos.ts` y el porqué está en
  `PLANTILLAS.md`.

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
- 🔴 **Un CSV no se auto-declara consentido** (2-ago-2026). `importarCSV` pide una
  **declaración explícita** —tildar que esa gente pidió recibir mails, y contar de
  dónde salió la lista— y sin ella los contactos entran **apagados**
  (`tnAcceptsMkt: false` ⇒ afuera de `MANDABLE`) con `source:
  "import_csv_sin_declarar"`. Antes había un `tnAcceptsMkt: true` fijo: es por
  donde entra una lista comprada que quema la cuenta SES de **todas** las marcas.
  La declaración queda pegada al contacto (`custom.consentimiento` = origen,
  fecha y quién), que es la respuesta el día que AWS pregunta. Pide `integrar`
  (ADMIN), no `editar`. ⛔ **No hay ningún toggle masivo para prenderlos**:
  activarlos es volver a importar el archivo con la declaración, o sería el mismo
  agujero con otra puerta. ⚠️ Lo que la declaración mueve es el consentimiento,
  **nunca el `estado`**: quien se dio de baja o rebotó sigue suprimido.
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

## Segmentos por enganche (2-ago-2026)

`abrio` y `clickeo` son las dos únicas condiciones que **no miran una columna de
`Contacto`**: salen de `Envio` (`abiertoAt` / `clickAt`) por filtro de relación.
Existen para armar un funnel, que necesita un público que se recalcule solo — una
lista fabricada es una foto que envejece el mismo día.

- 🔴 **"No abrió / no clickeó" significa RECIBIÓ y no lo hizo.** Son dos
  condiciones: `some enviadoAt` en la ventana **y** `none` de la marca. Con un
  `none` pelado entra todo el que **nunca recibió un mail** y el tramo de
  reactivación le pega a gente que jamás supo de la marca. Medido en el momento
  de escribirlo: el `none` solo llevaba el segmento de **517 a 6.865** contactos.
  Lo fija `probar-segmentos.ts`, verificado en rojo.
- ⚠️ Es el mismo agujero que ya tiene **`noComproUltimos`**, donde una
  `tnUltimaCompra` vacía cuenta como "no compró". Ahí quedó como está —cambiarlo
  movería segmentos que alguien pueda tener guardados— pero **no se repite en los
  nuevos**.
- ⚠️ **La apertura miente y el click no.** El pixel lo dispara el escaneo de
  seguridad de Outlook sin que nadie mire (las 880 aperturas de Perfit). Para
  *premiar* al enganchado va el **click**; la apertura sirve para lo contrario,
  descartar al que ni abre. Por eso `clickeo` va primero en `CAMPOS`.
- La UI sale gratis: `SegmentoBuilder.tsx` se dibuja recorriendo `CAMPOS`, y
  `tipo: "dias"` ya existía. Un campo nuevo con un `tipo` ya soportado no toca
  una línea de componente.

## El panel se usa con el dedo

Hasta el 31-jul-2026 el panel no tenía **una sola media query propia**: ni un
`hidden md:block`, ni `matchMedia`, ni un evento `touch*`. Se volvió responsive
en cinco tandas. El público no es solo Bruno: es el comerciante de Tiendanube,
así que la vara es **"que esté bueno en el celular"**, no "que no se rompa".
Piso declarado **375px**, y de ahí se estira. **Tablet no es un objetivo**: hay
un solo set de cortes. Lo custodia `auditar-responsive.ts` (seis reglas), que
está **en cero** y de acá en más pone en rojo cualquier hallazgo.

- 🔴 **El corte del shell es `lg` (1024) y no se mueve.** Medido: con el sidebar
  de 240px clavado, un viewport de 640 o de 768 le deja al contenido **menos
  ancho que el celular que supuestamente mejora** (352 y 480 contra 343). Abajo
  de `lg` el sidebar es un cajón. ⛔ Su transform va con **`max-lg:`, nunca en
  `lg`**: un `transform` en el `<aside>` crea un containing block y el
  `fixed inset-0` de `BrandSwitcher` pasaría a medir el sidebar ⇒ el dropdown
  dejaría de cerrarse en escritorio.
- **Los campos van a 16px abajo de `lg`** (`text-base lg:text-sm`, o las
  constantes de `lib/ui.ts`): con menos de 16, **iOS Safari zoomea solo al
  enfocar** y el usuario queda con la página corrida. ⚠️ Eso **no se reproduce
  en Chrome DevTools** — o se prueba en un iPhone o se confía en la regla 2 del
  auditor. ⚠️ Hay **dos familias de estilo de campo** (`lib/ui.ts` con
  `rounded-lg`, y `components/ui/{Input,Select,Textarea}` con `rounded-xl`):
  unificarlas es un cambio estético de toda la app y se decidió **no** hacerlo.
- **Toda tabla pasa por `components/ui/TablaResponsive.tsx`**: una sola
  definición de columnas que se dibuja como `<table>` en `lg` y como tarjetas
  abajo. Un `<table>` suelto esconde columnas en el celular sin avisar, y por eso
  la regla 4 lo frena. ⚠️ La tarjeta esconde **una sola cosa: un par cuyo valor
  es "—"**, y mira el valor renderizado, **nunca el rol**: una columna no puede
  desaparecer del celular, que es justo para lo que existe el componente.
- **El editor (`/campanias/[id]`) corta por `@container`, no por el viewport**:
  la pregunta es "¿entran tres columnas en el espacio REAL del editor?", y con el
  `max-w-6xl` del layout un viewport de 1280 deja 976px, donde las tres columnas
  dejan el formulario inservible. Abajo de 66rem de contenedor va **una vista a la
  vez** (Bloques / Editar / Vista previa). 🔴 **`container-type` implica
  `contain: layout`**, así que el `@container` es el bloque de referencia de todo
  `position: fixed` que cuelgue adentro: por eso `ImagenPicker` dibuja su modal
  con un **portal a `document.body`**. Y 🔴 **un track de grilla con máximo FIJO
  se sirve antes de que el `1fr` reparta** — van dos `1fr` para que ninguna
  columna mate de hambre a la otra.
- ⚠️ **Lo táctil cuelga de `lg` (el viewport); la grilla, del contenedor.** Son
  preguntas distintas. A 1280 el editor apila pero hay un mouse, y ahí el hover
  es lo correcto.
- ⛔ **El toggle Escritorio/Celular de `VistaPreviaMail` es del MAIL, no del
  panel**: muestra cómo se ve el correo en el teléfono de quien lo recibe. No se
  elimina al hacer responsive el panel — son dos cosas que no tienen nada que
  ver. (El marco escalado salió de `PreviewMail` el 2-ago-2026: hoy lo comparten
  el editor, la galería y las listas.) Y
  ⛔ **`lib/email/**` no se toca**: los mails ya son responsive contra su propio
  ancho.
- **El drag & drop de bloques sigue sin andar con el dedo** y es a propósito: los
  eventos `drag*` de HTML5 **no se disparan en ningún navegador móvil**. El
  camino táctil son las **flechas ↑↓**, que ya existían y son también el camino
  de teclado; por eso el `GripVertical` se esconde abajo de `lg` (prometía algo
  que no pasa). Migrar a Pointer Events entra por `onReorder(desde, hasta)` y es
  **Etapa 2**, junto con sacar el editor del `max-w-6xl`.

⚠️ **Para medir anchos hay que montar un iframe del mismo origen**: el viewport
de la pestaña de Chrome queda clavado en 1440 y `resize_window` no lo mueve.
🔴 Adentro de un iframe las transiciones CSS quedan `running` para siempre — el
drawer mide `translate:-100%` con la clase `translate-x-0` ya puesta; se destraba
con `d.getAnimations().forEach(a => a.finish())` y **no es un bug del código**.
⚠️ Y un iframe con `srcDoc` y `sandbox=""` sale **en blanco en una captura de
pantalla completa** aunque esté pintando perfecto: se verifica con zoom sobre la
región.

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

- `PLANTILLAS.md` — el acumulador de la galería: el ritual de cada tanda de referencias,
  las reglas de qué plantilla puede entrar, el pack de **fotos de stock**, el vocabulario de
  diseño (✅/🟡/🔴) y el backlog del motor. **Se lee entero antes de tocar
  `lib/plantillas/`**; es el único de los cuatro que sí conviene abrir completo — y queda
  en 20 KB desde que las fichas se mudaron (abajo).
- `docs/referencias/tanda-AAAA-MM-DD.md` — la ficha de cada captura de referencia: anatomía,
  tema medido, y de qué preset salió. Salieron de `PLANTILLAS.md` el 2-ago-2026, cuando ese
  archivo pasó su propio umbral de 40 KB. **Se abren solo para clonar una referencia**, no
  para sumar una plantilla.
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

### A quién alcanza la supresión (2-ago-2026)

🔴 **Un rebote duro es del BUZÓN; una queja es de la RELACIÓN.** Lo decide
`lib/email/supresion-alcance.ts` (puro), no la consulta:

- **Rebote permanente ⇒ todas las cuentas.** Una casilla que no existe no existe
  para nadie, y la cuenta de SES es **una sola para todas las marcas**: si BDI le
  sigue pegando a un buzón muerto, la reputación que se quema es la de Zattia
  también.
- **Queja ⇒ solo la tienda que mandó ese mail**, resuelta por `sesMessageId` (que
  está indexado y es lo único que dice de quién era el envío). Hasta hoy acá
  había un `updateMany` por email **sin `cuentaId`**: una queja contra Zattia
  marcaba `SPAM` al mismo contacto en BDI, y la supresión no vuelve atrás.
- ⚠️ **Una queja que no se puede atribuir NO se aplica** y sale en el log como
  `sinAtribuir`. Elegir "todas" ante la duda es exactamente el bug.

Lo fija `probar-supresion.ts`, verificado en rojo (9 fallas) contra la forma vieja.

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

### El trigger `NUEVO_SUSCRIPTOR` ("alguien se anotó a la lista")

Cuarto valor de `TriggerTipo` (30-jul-2026, `scripts/add-trigger-suscriptor.ts`).
Existe porque `NUEVO_CLIENTE` mezcla dos públicos que no tienen nada que ver: el
que se anota en un pop-up y el que compra por primera vez.

- **Se llama por el EVENTO, no por el widget**, y no `LEAD_POPUP`: la fuente vive
  en `triggerData.origen`. Ya hay una segunda superficie de captura viva —los
  formularios `/f/[slug]`, que todavía no encolan runs— y con el widget en el
  nombre cada una pediría un valor de enum nuevo, que es DDL + deploy y **no se
  puede sacar**.
- **`TRIGGER_EVENT` no lo incluye** ⇒ es *incapaz* de dispararse desde el webhook
  de TN. No hay que filtrar en ningún lado: no hay evento que lo alcance. Lo fija
  `probar-bienvenida.ts`. Su contracara está en `toggleAutomation`, que **no
  llama a Tiendanube** cuando el trigger no tiene evento.
- **Por eso su preset trae el bloque `cupon` de fábrica y el de `NUEVO_CLIENTE`
  no puede**: un run de `NUEVO_SUSCRIPTOR` siempre viene de una captura, así que
  `aplicarCuponDelTrigger` o pisa el código o borra el bloque — el placeholder no
  llega nunca a una casilla. En `NUEVO_CLIENTE` el webhook deja el bloque intacto
  y saldría `BIENVENIDA10`, que no existe en TN.
- 🔴 **Su saludo NO usa `${contacto.nombre}`.** El pop-up simple pide solo el
  mail: al 30-jul los 22 leads de Zattia no tienen nombre y el merge tag se
  reemplaza por vacío ⇒ "¡Hola ! 👋" al 100% del público de ese trigger.
- **`aplicarCuponDelTrigger` pregunta si HAY `origen`, nunca si vale `"popup"`.**
  Con el literal hardcodeado, un lead de formulario caería en la rama del webhook.
- `dispararBienvenida()` y `backfill-bienvenida.ts` miran **los dos** triggers.
  ⚠️ Prender una bienvenida de cada uno le manda **dos mails** al mismo lead.
- 🔴 **El orden no se altera: enum a la base → DEPLOY (los DOS repos) → recién
  ahí tocar la fila de una automation.** Al revés, la Prisma de producción no
  conoce el valor y revienta al LEER esa fila: se cae `/automations` en vivo.

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
- ⚠️ **Ninguna de las 4 bienvenidas viejas declara el bloque `cupon`** (verificado
  el 30-jul). Hasta que se agregue desde `/automations`, ese mail sale sin cupón.
  La forma nueva de resolverlo es crear la de **`NUEVO_SUSCRIPTOR`**, que ya nace
  con el bloque puesto y con un saludo que funciona sin nombre.

## Estado del trabajo

- 🟢 **El mailer ESTÁ ENVIANDO** (medido contra prod el 3-ago-2026). El gate está
  **abierto** (`ENVIO_REAL=true`), el proveedor es **SES** y hay dos cosas en el aire:
  - **La bienvenida de Zattia** (`NUEVO_SUSCRIPTOR`) está **`ACTIVO`** y lleva **20 runs
    `ENVIADO`**, de a ~1 por día, disparados por los leads del pop-up de Resorty.
  - **El primer masivo propio salió el 2-ago 20:13**: T01 de Zattia, **500 envíos**, 8
    rebotes (1,6%), **0 quejas**, 1 baja, 39 aperturas y 3 clicks. Quedan **6 tramos**
    (`Todos los contactos — T02…T07`), y el siguiente escalón va **entre días, no entre
    horas**: lo que Gmail mide es el volumen diario de un dominio que hasta ayer valía cero.
  - ⚠️ **Las otras 7 automations siguen `PAUSADO`**, incluida la bienvenida de BDI, que
    tiene **360 leads de la Ruleta con 0 runs** entrando a ~50 por día. Prenderlas se hace
    **desde la UI**, que es lo que registra el webhook en Tiendanube (un `UPDATE` a mano
    deja la automation activa y sorda).
  - **Nada trabado**: 0 envíos `ENCOLADO` y 0 `FALLIDO` en toda la base.
- ✅ **Ya no se pueden duplicar** (31-jul-2026). BDI llegó a tener dos bienvenidas
  (`cmrwf6j3m…` y `cms6kpmqg…`) porque `/automations` dibujaba "Crear" siempre,
  sin mirar si ya había una con ese trigger; activar las dos encolaba **354 runs
  sobre 177 leads** = dos mails por persona. Hoy la tarjeta de un trigger que ya
  tiene automation dice **"Editar"**, y `crearAutomation` **redirige a la
  existente en vez de insertar** — la guarda del servidor es la que vale, porque
  la página puede estar cacheada o alguien hace doble click. Los dos lados
  deciden con **la misma función pura**, `automationDelTrigger` (`lib/automations.ts`),
  que ante duplicadas viejas devuelve **la más vieja**. Lo fija
  `probar-automations.ts`, verificado en rojo contra la forma anterior.
  ⚠️ No hay índice único en la base a propósito: dos carritos abandonados con
  esperas distintas (1 h y 24 h) es un caso legítimo, y un `@@unique` es DDL que
  después no se saca.
- 🔴 **Una marca sin remitente VERIFICADO no manda** (2-ago-2026). No alcanza con
  tener la fila: `getRemitenteEnvio` mira `estado` y, si dice `PENDIENTE`, **le
  pregunta a SES en el momento** y deja la columna al día — esperar a que alguien
  apriete "Verificar" hacía que el estado fuera una foto vieja (el remitente de
  BDI figuró `PENDIENTE` durante días con el dominio ya verificado). El camino
  normal no toca la red: un dominio autenticado no consulta nada.
  - **El alta del dominio la hace la app**, no un script: `crearRemitente` llama
    a `altaDominioSes()` (Easy DKIM) y `/remitentes` muestra los tres CNAME para
    copiar mientras el dominio no esté verificado. Sin esto, un comerciante que
    instalaba la app no podía mandar un solo mail y la pantalla no se lo decía —
    era lo que hacía al producto no vendible, más que cualquier requisito de TN.
    ⚠️ Si SES no contesta, el remitente **igual se crea** (`PENDIENTE`) y el botón
    reintenta. Los tokens **no se guardan**: SES los devuelve iguales siempre.
  - **El modo de falla dejó de ser mudo**: `motivoEnTexto()` (en `proveedor.ts`,
    puro) distingue "no hay remitente" de "falta verificar el dominio X" de
    "SES lo rechazó", y lo usan las guardas de campañas, automations y el lote.
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
  - Medido el 3-ago-2026: **Zattia (`info@zattia.com.ar`) y BDI
    (`info@bdiaccesorios.com.ar`) tienen remitente y los dos figuran `AUTENTICADO`.**
    **Stunned, Resorty Lab y la cuenta de QA no tienen ⇒ esas tres no pueden enviar**
    hasta cargarlo, con `scripts/set-remitente.ts` o desde `/remitentes`.
- ✅ **El proveedor está decidido: SES en producción desde el 30-jul-2026** (detalle en
  "Envío: gate, modos y proveedor"). Lo que sigue sin construirse es el **webhook de
  rebotes de Resend**, y no hace falta mientras el proveedor sea SES.
  - ⚠️ **Ningún envío llega jamás a `ENTREGADO`**: el event destination de SES solo está
    suscripto a `BOUNCE` y `COMPLAINT` (`scripts/setup-sns.ts:110`). La entrega se
    **calcula** (enviados − rebotes), no se mide. No es un bug — lo que decide la
    reputación sí llega — pero explica el `DELIVERY=0` al mirar eventos.
- **Verificar en browser lo de permisos** con el usuario EDITOR de prueba: las
  4 fases están deployadas pero solo se probaron por script.
- ▶️ **Dos huecos medidos el 3-ago-2026, los dos con reloj:**
  - **28 leads de pop-up de Zattia sin bienvenida**, todos del 28 al 31-jul, o sea de
    *antes* de que la automation se prendiera (no hay fuga: todo lo que entró después
    tiene run). 🔴 **Sus 28 cupones SIGUEN VIGENTES** —validez 7 días, el más viejo vence
    el 4-ago— y el código de cada uno está guardado en `PopupEvento.cupon`. El
    `backfill-bienvenida.ts` los manda **sin cupón**, por una premisa (*"los códigos ya
    vencieron"*) que hoy es falsa y que en dos días deja de serlo.
  - **85 contactos de Zattia quedaron fuera de los tramos**: la lista madre creció a
    6.823 y los 7 tramos suman 6.738. Re-correr `listas-por-tramo` los agrega **al
    final** sin re-asignar a nadie; si no, son gente que nunca recibe el masivo.
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
