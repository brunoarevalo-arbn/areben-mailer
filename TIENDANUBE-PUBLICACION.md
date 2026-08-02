# Publicar areben-mailer en la App Store de Tiendanube

> Investigado el **25-jul-2026** sobre `dev.tiendanube.com/docs`, corregido el **27-jul** con
> la respuesta de Tiendanube (Lucas, socios@) y **actualizado contra el código el 1-ago-2026**.
> La parte de costos y de canal vive en `MODELO-DE-NEGOCIO.md`; acá va solo qué falta
> construir y tramitar.

## Resumen en una línea

**El andamiaje de Tiendanube está casi terminado; lo que falta es que el producto sea
multi-inquilino.** El mailer no pone nada dentro de la tienda, así que **NubeSDK no lo afecta**
y no tiene ninguna fecha de corte encima. El OAuth público con alta automática —que este
documento listaba como el trabajo grande— **ya está construido**. Lo que hoy frena la
publicación es que **un comerciante que instala la app no puede mandar un solo mail**.

---

## 1. El cambio grande que NO nos afecta

Tiendanube está migrando a **NubeSDK** las apps que renderizan algo en la tienda: el código
corre en un Web Worker aislado, sin DOM, y la UI se declara en slots.

| Fecha | Qué pasa |
|---|---|
| 5-jun-2026 | NubeSDK obligatorio **en homologación**. |
| 30-ago-2026 | Se bloquean las **nuevas instalaciones** de apps sin SDK. |
| 30-oct-2026 | Deprecación y desinstalación progresiva de las apps sin SDK. |

**Por qué no nos toca**: el mailer no inyecta scripts en el storefront. Si algún día se suma un
formulario de suscripción embebido en la tienda, ahí sí entra el SDK.

⚠️ A **Resorty sí lo toca de lleno** (~884 líneas manipulando el DOM). Son apps separadas en
Partners desde el 30-jul: mailer **#37222**, Resorty **#37985**. Ese bloqueante está resuelto.

---

## 2. Lo que ya está hecho (verificado en el código el 1-ago-2026)

### 2.1 ✅ OAuth público + alta automática de la tienda

Era el punto pendiente más grande de este documento y **está construido**:

- `app/api/tn/entrar/route.ts` es la URL que se declara en Partners ("abrir aplicación"). Si
  hay sesión va al panel; si no, manda a autorizar.
- `app/api/tn/callback/route.ts` canjea el `code`, y con el `user_id` que devuelve TN
  resuelve tres casos: tienda ya vinculada (refresca token y marca), vinculación pedida desde
  el panel (`?state=`), o **tienda desconocida → crea la `Cuenta` sola**, con slug libre y la
  marca traída de `/store` en una sola llamada.
- `entrarComoComerciante()` **crea el `Usuario` ADMIN con el mail de la tienda y le abre la
  sesión**. El comerciante entra sin contraseña, sin registro y sin invitación.

⚠️ La cuenta destino sale **siempre del `user_id` de TN**, nunca de `getCuentaActiva()`: el
25-jul eso le pisó el token a BDI al instalar en una tienda demo.

### 2.2 ✅ Los cuatro webhooks obligatorios

Los cuatro endpoints existen en `app/api/tn/webhooks/`: `store-redact`, `customers-redact`,
`customers-data-request` y `app-uninstalled`.

🔴 **Que el código exista no es que estén dados de alta.** Los tres de LGPD **no van por
`POST /webhooks`** —eso es lo que devolvía el 422 "The selected event is invalid"— sino
cargados a mano en el formulario de **"Datos básicos"** del Partner Portal. `app/uninstalled`
sí va por API y ya funcionaba. **Falta cargarlos y probar que de verdad borren y exporten**,
que es lo que homologación va a mirar en una app que guarda contactos.

### 2.3 ✅ Responsividad y estados

Obligatorias para homologar y están: el panel se volvió responsive en cinco tandas (31-jul),
piso 375px, custodiado por `auditar-responsive.ts` en cero. Y hay `EmptyState`, `ErrorState`
y `LoadingState` en `components/ui/`.

---

## 3. Lo que falta de verdad

### 3.1 🔴 El comerciante nuevo no puede mandar un mail

Es el bloqueante real, y no es de Tiendanube. Instala en un clic, entra sin contraseña, arma
la campaña, aprieta enviar — y no sale nada. Tres cosas encadenadas:

1. **`crearRemitente` solo escribe una fila en la base** (`app/(app)/remitentes/actions.ts`).
   No da de alta el dominio en SES ni le muestra al comerciante los CNAME de DKIM. Eso hoy se
   hace **a mano, desde la máquina de Bruno**, con `scripts/ses-verify-domain.ts`.
2. **El guard de envío pregunta si HAY remitente, no si está verificado.**
   `getRemitenteEnvio()` (`lib/remitentes.ts`) ordena por `esPrincipal` y antigüedad y
   devuelve el primero, sin mirar `estado`. La columna `EstadoRemitente` existe y **no la lee
   nadie en el camino de envío**. Medido el 1-ago: el remitente de BDI está en `PENDIENTE`
   —porque nadie apretó "verificar" desde que se creó— y su dominio sí está verificado en SES.
   O sea que la columna **hoy no es autoritativa ni para bien ni para mal**.
3. **El modo de falla es mudo.** Sin remitente, `procesarLote` corta antes del loop y devuelve
   `bloqueado`; el cron de automations deja el run `PENDIENTE`. Nada se marca `FALLIDO`, a
   propósito. Para la operación propia es la protección correcta; para un desconocido es "la
   app no anda y no dice por qué".

**Lo que hay que construir**: alta del dominio en SES desde el panel (`CreateEmailIdentity`),
los CNAME de DKIM en pantalla con copiar-al-portapapeles, botón de re-chequeo, y que el envío
**exija `AUTENTICADO`** con un mensaje que se entienda. Es el "soporte de onboarding de
dominio" que `MODELO-DE-NEGOCIO.md` §9 marcaba como el costo oculto grande — solo que hoy no
es un costo de soporte, es un bloqueante funcional.

### 3.2 🔴 Aislamiento entre inquilinos: dos fugas concretas

Con tres marcas propias no molestan. Con comerciantes ajenos, sí:

- **`lib/email/supresion.ts:35`** — el `updateMany` de contactos matchea **por email, sin
  `cuentaId`**. Una queja en la tienda A marca `SPAM` al mismo mail en la tienda B. Es fuga de
  datos entre clientes y bajas que nadie pidió.
- **`app/(app)/contactos/actions.ts:54`** — `importarCSV` pone `tnAcceptsMkt: true` fijo: un
  CSV se auto-declara consentido. Es la puerta por la que entra una lista comprada y quema la
  cuenta SES de **todos**, BDI incluido.

Y encima está el riesgo de fondo: **la cuenta de SES es una sola y el destino es compartido**.
La cuarentena por tramos está diseñada (plan `fluffy-chasing-wirth.md`) y **no construida**,
decidido a propósito: nada de eso se hace hasta que haya un inquilino pago.

### 3.3 🔴 No hay nada de negocio adentro de la app

No existe modelo `Plan`, ni `Suscripcion`, ni cuota, ni límite de envíos, ni pantalla de
precio. Ninguno de los 18 modelos de `schema.prisma` es de facturación. Resorty ya tiene
precio y MP Suscripciones; el mailer tiene cero. **Aun eligiendo que cobre Tiendanube**, hace
falta el gating por plan adentro de la app.

### 3.4 🟡 Legal

Las únicas rutas públicas son `/login`, `/f/[slug]`, `/baja` y las de API. **No hay
`/privacidad` ni `/terminos`.** Para una app que guarda contactos de terceros los van a pedir
en homologación y en *Datos de publicación*.

### 3.5 🟡 Scopes

**Pedir permisos de más es motivo de rechazo.** Hay que revisar qué declara la #37222 y
dejar solo lo que el mailer usa de verdad (`lib/tn/`: store, productos, clientes, órdenes).

---

## 4. Homologación y publicación

- **Se pide desde el Partner Portal**, no por socios@. Ahí llega un mail de Tech Solutions con
  los pasos. Las dudas de opt-in simple vs. doble **siguen sin respuesta** hasta que se
  arranque el trámite.
- Para apps de marketing, Tiendanube **instala la app en tiendas internas y la prueba a mano**,
  con ciclo iterativo de ajustes (a diferencia de ERPs, pagos o envíos, que piden videos).
- El mailer es una **app externa** (panel propio, fuera del admin): no necesita Nimbus ni Nexo.
  Sí se evalúan responsividad, estados vacío/error, y nomenclatura y tono de voz.
- Aprobada: llega un mail con instrucciones para mandar los **artefactos** y completar **Datos
  de publicación** (URLs, contacto, *handle*, país y modalidad de cobro).
- **Ambiente de prueba**: activan el slot en **tiendas demo a pedido** — eso destraba el
  deadlock de desarrollo que el 25-jul se creía cerrado. (Aplica a Resorty; el mailer no lo
  necesita.)

---

## 5. Orden sugerido

El orden viejo de este archivo arrancaba por SES y por el OAuth: los dos ya están. El que
queda es:

1. **Onboarding de dominio autoservicio** (§3.1). Sin esto no hay app publicable, y sirve
   igual para la venta directa.
2. **Las dos fugas multi-inquilino** (§3.2). Baratas ahora, caras con el primer cliente.
3. **`/privacidad` y `/terminos`** (§3.4) y **revisión de scopes** (§3.5).
4. **Cargar los tres webhooks de LGPD en Datos básicos** y probarlos de punta a punta (§2.2).
5. **Planes y límites** (§3.3), que dependen de un precio decidido.
6. Pedir **homologación** → artefactos → *Datos de publicación*.

⚠️ **Nada de esto decide si conviene publicar.** Esa discusión está en `MODELO-DE-NEGOCIO.md`
§6.5 y §7.7: la App Store es un canal de adquisición, y la recomendación vigente es arrancar
por **venta directa** —que no necesita nada de este archivo salvo el punto 1— y evaluar la
publicación cuando haya comerciantes pagando.
