# SES — qué está resuelto y qué no (areben-mailer)

> Estado verificado **en vivo el 25-jul-2026 ~19:15** con
> `node --env-file=.env --experimental-strip-types scripts/ses-status.ts`
> (SESv2 `GetAccount`, región `us-east-1`). Cuenta AWS `986232521997`.
> Este archivo es un handoff: sirve para retomar sin releer todo el historial.

---

## Titular

**Lo único que falta es el acceso a producción de SES.** Todo el resto del andamiaje de
envío (dominios, DKIM, remitentes, rebotes, quejas, supresión) está terminado y verificado.
La cuenta sigue en **sandbox**: solo entrega a direcciones verificadas, 200 mails cada 24 h,
1 por segundo.

---

## 1. Lo que devuelve la API hoy

```json
{
  "ProductionAccessEnabled": false,
  "SendingEnabled": true,
  "EnforcementStatus": "HEALTHY",
  "SendQuota": { "Max24HourSend": 200, "MaxSendRate": 1, "SentLast24Hours": 0 },
  "SuppressionAttributes": { "SuppressedReasons": ["BOUNCE", "COMPLAINT"] },
  "PricingAttributes": { "CurrentPlan": "ESSENTIALS" },
  "Details": {
    "MailType": "MARKETING",
    "WebsiteURL": "https://bdiaccesorios.com.ar",
    "ContactLanguage": "EN",
    "ReviewDetails": { "Status": "DENIED", "CaseId": "178473604500639" }
  }
}
```

### ⚠️ Cómo leer `Status: "DENIED"`

**No es un rechazo definitivo.** La consola de SES muestra ese mismo estado como
**"Se necesita más información"** (verificado contra la pantalla de la consola el 25-jul).
`DENIED` es simplemente la palabra que usa la API para "la última revisión cerrada no
otorgó el acceso". Mientras el caso siga abierto y respondido, el campo no cambia hasta
que AWS apruebe.

Traducción práctica: **es el mismo estado que ya estaba el 24-jul.** No hubo respuesta
nueva de AWS ni novedad de ningún tipo.

---

## 2. Lo que SÍ está resuelto (no tocar, no rehacer)

| Pieza | Estado |
|---|---|
| Dominio `bdiaccesorios.com.ar` | **AUTENTICADO** en SES (Easy DKIM), us-east-1, 0 recomendaciones |
| Dominio `zattia.com.ar` | **AUTENTICADO** en SES (Easy DKIM), CNAMEs + DMARC cargados en Cloudflare (DNS-only) |
| Remitente Zattia | `info@zattia.com.ar`, fila `Remitente` creada, estado AUTENTICADO, principal |
| Remitente BDI | Sin fila propia: envía por el fallback `SES_FROM_EMAIL=info@bdiaccesorios.com.ar` (dominio autenticado). Si se quiere en `/remitentes`: `scripts/set-remitente.ts bdi info@bdiaccesorios.com.ar "BDI Accesorios"` |
| Rebotes y quejas (SNS) | **COMPLETO y verificado el 24-jul.** Topic `arn:aws:sns:us-east-1:986232521997:areben-mailer-ses-events` + policy (SES publica) + suscripción HTTPS a `/api/ses/sns` **CONFIRMADA sola** (= prueba E2E de que SNS llega a la app) |
| Configuration Set | `areben-mailer`, con event destination `sns-bounces-complaints` (BOUNCE + COMPLAINT, Enabled) |
| Envs en Vercel prod + `.env` | `SES_CONFIGURATION_SET=areben-mailer`, `SES_SNS_TOPIC_ARN=…` |
| Lista de supresión de cuenta | Activa para BOUNCE y COMPLAINT |
| Reputación | `EnforcementStatus: HEALTHY` — ningún problema del lado de AWS |
| IAM | El user `areben-mailer-ses` ya no necesita `AmazonSNSFullAccess` (era solo para correr `scripts/setup-sns.ts`); el runtime no lo usa |

---

## 3. Lo que NO está resuelto

### 3.1 El acceso a producción (el único blocker real)

- Caso de soporte **`178473604500639`**, a nivel cuenta (sirve para las tres marcas).
- Bruno **respondió el 24-jul-2026** con la justificación completa: use case mixto
  transaccional + marketing, base ~25.000 clientes opt-in, rebotes y quejas por SNS,
  baja one-click, pedido de cuota diaria ~50.000. El texto está en
  `~/Desktop/aws-ses-respuesta.txt`.
- Al 25-jul **el caso no tiene respuesta nueva de AWS** y el estado no se movió.

**Consecuencias directas mientras siga así:**

1. No se puede hacer el **primer envío real** de BDI ni de Zattia (Zattia tiene 6823
   contactos importados y todo listo).
2. No se puede cerrar el **E2E del A/B de asunto** (implementado y deployado, sin probar).
3. **No se puede publicar en la App Store de Tiendanube**: una app de email marketing no
   se homologa entregando solo a direcciones verificadas.

### 3.2 Marca Stunned — pendiente aparte (no depende de AWS)

Falta entero: (a) conectar su Tiendanube + importar contactos; (b) correr
`node --env-file=.env scripts/ses-verify-domain.ts <dominio-stunned>` y cargar los CNAME +
DMARC en el DNS (DNS-only); (c) `scripts/set-remitente.ts stunned info@<dominio> "Stunned"`.

### 3.3 ✅ Rebotes y quejas: VERIFICADO E2E el 25-jul-2026 (runId `250726-2020`)

El camino **Bounce → `REBOTADO`** y **Complaint → `SPAM`** **ya está probado de punta a
punta**, con la cuenta todavía en sandbox, usando el *mailbox simulator* de SES (funciona en
sandbox, no consume cuota diaria y no ensucia la reputación).

Resultado: los dos contactos quedaron en `REBOTADO`/`SPAM` y los dos `Envio` en
`REBOTE`/`SPAM`. Que el `Envio` cambie de estado **solo puede pasar** por el `updateMany` que
casa el `sesMessageId`, así que quedó probado el eslabón completo
SES → SNS → `/api/ses/sns` → `aplicarSupresion` → base.

**Cómo repetirlo** (los datos van a una cuenta descartable `qa-ses`, nunca a BDI/Zattia/Stunned;
no toca `SES_SANDBOX`):

```
APP_URL=https://areben-mailer.vercel.app \
  node --import tsx --env-file=.env scripts/ses-e2e-supresion.ts
node --import tsx --env-file=.env scripts/ses-e2e-supresion.ts --verificar <runId>
node --import tsx --env-file=.env scripts/ses-e2e-supresion.ts --limpiar
```

⚠️ **Hay que deployar antes de correrlo**: la suscripción SNS apunta a prod, así que el
evento lo recibe el deploy, no el localhost.

El receptor SNS ahora emite una línea JSON por evento (`ev: "ses-sns"`, filtrable en los logs
de Vercel) con `contactos`/`envios` marcados y `ms`. Antes no tenía ningún log: un evento que
llegaba y no matcheaba nada era indistinguible de uno que nunca llegó.

**🔒 La ruta verifica la firma RSA de Amazon** (`lib/email/sns-firma.ts`) antes de tocar la
base, y responde **403** si no valida. Antes alcanzaba con conocer el ARN del topic para
postear rebotes falsos y quemar contactos: se comprobó con un `curl` desde afuera, que la
ruta procesaba con 200. Verificado el 25-jul-2026 por los dos lados — el `curl` forjado ahora
da 403, y el E2E con mensajes reales de AWS sigue en verde (runId `250726-2029`).

> Nota para diagnosticar: el `curl` sintético contra `/api/ses/sns` ya **no** sirve para
> simular un evento — devuelve 403. Sigue sirviendo para confirmar que el deploy tomó y que
> la ruta está viva; para ejercitar el camino completo hay que usar el script del simulador.

---

## 4. El gate en el código

La decisión vive en **un solo lugar**: `lib/email/proveedor.ts`. Hay **tres** estados, no
dos, y el del medio es el que permite probar el motor sin arriesgar la lista real:

| Modo | Cómo se activa | Qué hace |
|---|---|---|
| `bloqueado` | ninguna env (**es prod hoy**) | No sale nada. Default seguro: env ausente, vacía o mal escrita = bloqueado. |
| `ensayo` | `ENVIO_ENSAYO="@zattia.com.ar, qa@bdiaccesorios.com.ar"` | Corre el camino real completo —cola, lease, tracking, estados— pero **solo** a esos destinatarios. El resto se omite. |
| `real` | `ENVIO_REAL="true"` | Sale todo. Le gana a `ENVIO_ENSAYO` si están las dos. |

En `ENVIO_ENSAYO`, una entrada que arranca con `@` habilita el dominio entero. Sirve
porque en el sandbox de SES un dominio verificado habilita todas sus casillas: hoy
`@bdiaccesorios.com.ar` y `@zattia.com.ar` ya reciben, sin verificar nada nuevo.

⚠️ **El mailbox simulator (`@simulator.amazonses.com`) está permitido siempre**, en
cualquier modo. Es un agujero negro por construcción — no llega a ninguna persona, no
consume la cuota diaria, no toca la reputación — y los scripts de QA dependen de eso para
poder correr con el gate cerrado.

El corte que de verdad protege está en `procesarLote`, **pegado al envío**, no solo al
encolar: los `Envio` también nacen por otros caminos (una campaña encolada antes de cambiar
la lista, los scripts de QA) y a esos el filtro de la entrada no los ve. Lo que se corta ahí
queda `FALLIDO` con una línea de log `ev: "envio-bloqueado"`.

Los tres puntos de entrada del envío masivo:

- `app/(app)/campanias/actions.ts` — `enviarCampania`
- `app/(app)/campanias/actions.ts` — `promoverGanador`
- `app/api/automations/procesar/route.ts` — el cron de automations (a quien no esté
  habilitado igual le corre el flujo y marca el run como `ENVIADO` con
  `sesMessageId: "dry-run"`, así se ve que la automation dispara sin mandar nada)

### Ensayo del motor a volumen

`scripts/ensayo-motor.ts` arma una cuenta descartable (`qa-motor`) con N destinatarios del
simulador y empuja la campaña por la cola **de producción**, sin volver a empujar: ejercita
el lease, el auto-encadenamiento, el camino de throttle (en sandbox SES entrega 1 mail/seg,
así que un lote de 20 lo toca sí o sí) y los estados finales.

```
APP_URL=https://areben-mailer.vercel.app \
  node --import tsx --env-file=.env scripts/ensayo-motor.ts [--contactos=60]
node --import tsx --env-file=.env scripts/ensayo-motor.ts --limpiar
```

⚠️ Hay que deployar antes: el worker que levanta la campaña corre en prod.

**Cuando llegue la aprobación:** poner `ENVIO_REAL=true` en Vercel prod y en `.env`,
redeployar (`vercel deploy --prod --yes`, no hay autodeploy de GitHub) y recién ahí hacer
el E2E real del envío, incluido el A/B.

> **Por qué se renombró (26-jul-2026):** el flag se llamaba `SES_SANDBOX`, y ese nombre
> mentía — bloqueaba el envío **con cualquier proveedor**. Migrar a Resend habría dejado la
> app sin mandar un solo mail, sin ninguna pista de por qué. `ENVIO_REAL` es neutro.
> Mientras `ENVIO_REAL` no esté definida se sigue respetando `SES_SANDBOX`, así que el
> deploy actual no cambia de comportamiento; la compat se puede borrar en cuanto la env
> nueva esté cargada.

---

## 5. Plan B si AWS sigue sin moverse

La app **ya está preparada** para cambiar de proveedor — no es un refactor, es config:

- Capa de proveedor: `lib/email/proveedor.ts` (contrato común) + las tres implementaciones
  completas en `lib/email/proveedores/{ses,resend,sendgrid}.ts`. Se elige con la env
  `EMAIL_PROVIDER` (default `ses`).
- Webhooks de rebotes/quejas del proveedor nuevo: **ya existen y verifican firma** —
  `/api/webhooks/resend` (firma Svix, ventana anti-replay de 5 min) y `/api/webhooks/sendgrid`.
  Los dos terminan en el mismo `aplicarSupresion` que usa el SNS de SES.

**Lo que sí hay que hacer a mano para migrar:**

1. Verificar **los dos dominios de nuevo** en el proveedor nuevo (otro juego de registros
   DKIM/SPF en Cloudflare).
2. Dar de alta el webhook en su panel y guardar el signing secret
   (`RESEND_WEBHOOK_SECRET` / equivalente de SendGrid).
3. Setear `EMAIL_PROVIDER` + la API key en Vercel y en `.env`.
4. Generalizar el gate `SES_SANDBOX` (ver 4).

**Costo:** SES es lejos lo más barato. Ojo con el número: la cuenta está en el plan
**Essentials**, que son **US$0,16 cada 1.000** — los US$0,10 son el plan *à la carte*, al que
se puede volver desde la consola. Resend son US$20/mes por 50.000 envíos y US$35 por 100.000
(a los ~95.000/mes de BDI + Zattia, el plan que aplica es el de US$35). La ventaja de Resend
es que aprueba casos de marketing sin el vía crucis de AWS.

📊 El análisis completo de costos y modelo de negocio está en **`MODELO-DE-NEGOCIO.md`**.

---

## 6. Links y comandos

- **Caso de soporte** — https://support.console.aws.amazon.com/support/home#/case/?displayId=178473604500639
- **Todos los casos** — https://support.console.aws.amazon.com/support/home#/case/history
- **Panel de cuenta de SES (us-east-1)** — https://us-east-1.console.aws.amazon.com/ses/home?region=us-east-1#/account
- **Rechequear el estado** —
  `cd ~/Projects/areben-mailer && node --env-file=.env --experimental-strip-types scripts/ses-status.ts`

Desde el estado actual, la consola habilita la tarjeta **"Solicitar acceso a producción"**:
si el caso viejo quedara cerrado sin respuesta, ese botón abre un pedido nuevo en vez de
seguir empujando el mismo.

---

## 7. Resumen de una línea para quien retome

> SES: todo listo salvo el permiso de producción. Caso `178473604500639` respondido el
> 24-jul, sin respuesta de AWS al 25-jul; el `DENIED` de la API es la forma en que se
> muestra "se necesita más información", no un rechazo final. Sin eso no hay primer envío
> ni publicación en Tiendanube. Lo que sí se puede hacer hoy sin AWS: probar el camino de
> rebotes/quejas con el mailbox simulator, y avanzar la marca Stunned.
