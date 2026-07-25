# Modelo de negocio y costos — areben-mailer

> Análisis hecho el **25-jul-2026**. Todos los datos de infraestructura están **medidos en
> vivo**, no estimados; los precios de proveedores están verificados contra las páginas
> oficiales ese día. Los supuestos comerciales están marcados como tales.
>
> Este archivo existe para **no volver a hacer el análisis desde cero**. Si algo acá está
> desactualizado, corregilo en vez de rehacerlo. Complementa a `SES-ESTADO.md` (estado del
> envío) y `TIENDANUBE-PUBLICACION.md` (requisitos de la App Store).

---

## 1. Veredicto en tres líneas

- **Uso propio: lanzalo.** Cuesta ~USD 40/mes contra los >USD 150/mes que se pagan hoy.
  Ahorro ≥ USD 1.300/año, y el 97% del costo marginal es el proveedor de email.
- **SaaS en la App Store: la economía cierra** (equilibrio en 5 comerciantes, ~57% de margen
  a 50), **pero tres cimientos no están**: SES en sandbox, la cola de envío corre en el
  navegador, y la base productiva está en el plan gratuito de Neon compartida con Resorty,
  que está en vivo.
- El costo que importa no es la infraestructura: es **la reputación de envío compartida
  entre inquilinos** y **el soporte de onboarding de dominio**.

---

## 2. Objetivos

*(Inferidos de la conversación del 25-jul-2026.)*

| # | Objetivo | Cómo se mide |
|---|---|---|
| O1 | Dejar de pagar la herramienta actual de email marketing | Baja del gasto de >USD 150/mes |
| O2 | Controlar el canal: segmentar con datos propios de Tiendanube que la herramienta actual no ve | Campañas segmentadas por compra/producto/marca |
| O3 | Convertirlo en producto vendible en la App Store de Tiendanube | Ingreso recurrente mensual |
| O4 | No poner en riesgo lo que ya está en producción (Resorty, mails de BDI/Zattia) | Cero incidentes por recursos compartidos |

O1 y O2 se logran solos. **O3 depende de O4**: hoy el SaaS y la operación propia comparten
base de datos y reputación de envío.

---

## 3. Estado medido (25-jul-2026)

| Qué | Valor | Cómo se midió |
|---|---|---|
| Contactos activos | **23.648** (BDI 16.825 · Zattia 6.823 · Stunned 0) | `prisma.contacto.groupBy` |
| Campañas / envíos / eventos | 4 / **0** / 0 | idem — nunca se mandó nada real |
| Tamaño de la base | **23 MB** (Contacto 10 MB, ContactoLista 4,1 MB) | `pg_database_size` |
| Plan de Neon | **Free** — 0,5 GB, 100 CU-h/mes, us-east-1 | `neon.max_cluster_size = 512 MB` |
| Base compartida con | **areben-popups (Resorty), EN VIVO en tiendas** | misma `DATABASE_URL` |
| Plan de Vercel | **Hobby** | `GET /v2/user` → `billing.plan` |
| Región y config de funciones | **iad1**, Fluid, memoria estándar, timeout 300 s | `GET /v9/projects/:id` |
| Plan de SES | **Essentials** ($0,16/1k), us-east-1, `HEALTHY` | `SESv2 GetAccount` |
| Acceso a producción SES | **Sandbox** — 200/día, 1/seg. Caso `178473604500639` respondido, esperando | ver `SES-ESTADO.md` |
| Dominios autenticados | `bdiaccesorios.com.ar`, `zattia.com.ar` (Easy DKIM) | `ListEmailIdentities` |
| Cron | GitHub Actions cada 15 min, **repo privado** | `.github/workflows/cron.yml` |
| Peso de un email renderizado | 2,6 – 3,1 KB (esqueleto, sin copy real) | `renderEmailHtml` sobre los 4 presets |

**Re-verificar SES:** `node --env-file=.env scripts/ses-status.ts`. El resto sale de los
comandos citados en la columna derecha.

---

## 4. Estructura de costos

### 4.1 Costo marginal por 1.000 envíos

Supone lotes de 20 (`app/api/campanias/[id]/procesar/route.ts`), ~250 ms por email,
25% de apertura y 3% de clic.

| Componente | USD / 1.000 envíos | % |
|---|---|---|
| SES Essentials | 0,1600 | **97,7%** |
| Neon compute (~0,017 CU-h) | 0,0018 | 1,1% |
| Vercel memoria provisionada (0,14 GB-h) | 0,0015 | 0,9% |
| Vercel invocaciones (50 envío + 280 tracking) | 0,0002 | 0,1% |
| Neon almacenamiento (520 KB nuevos) | 0,0002 | 0,1% |
| Vercel CPU activo | 0,0001 | 0,1% |
| **Total** | **≈ 0,164** | 100% |

**La conclusión que gobierna todo lo demás: el costo variable es el proveedor de email y
nada más.** Optimizar Vercel o Neon es irrelevante; elegir bien el proveedor lo es todo.

### 4.2 Costos fijos

| Concepto | USD/mes | Nota |
|---|---|---|
| Vercel Pro | **20** | Hobby prohíbe uso comercial. Incluye USD 20 de crédito de uso |
| Neon Launch | ~5 | Pago por uso: $0,106/CU-h + $0,35/GB-mes |
| Dominio propio | ~2 | Hoy corre en `areben-mailer.vercel.app` |
| GitHub Actions (cron) | 0 – 7 | Repo privado: 2.000 min/mes gratis, mínimo 1 min por corrida. Cada 15 min = 2.880 min → ~$7 de exceso. Hoy GitHub throttlea a ~1/hora y zafa |
| SES IP dedicada *(opcional, más adelante)* | 15 | + $0,02-0,08/1k. Recién con volumen y varios inquilinos |
| **Piso realista** | **~27** | Sin IP dedicada |

### 4.3 Precios de proveedores de envío (verificados 25-jul-2026)

| Proveedor | USD/1.000 | Estructura |
|---|---|---|
| Elastic Email (pay-as-you-go) | **0,09** | Sin cargo fijo. Starter $19/50k = $0,38/1k |
| SES à la carte | **0,10** | Sin cargo fijo. Se cambia de plan desde la consola |
| SES Essentials *(el plan actual)* | **0,16** | Sin cargo fijo. Incluye Virtual Deliverability Manager |
| Resend | **0,90** | $20/50k · $35/100k · overage $0,90/1k |
| MailerSend | **0,90** | $28/50k · overage $0,90/1k |

**Umbral de decisión:** con un plan de USD 10/mes y un comerciante de 20.000 envíos, el
equilibrio está en **$0,45 por mil**. Todo lo que esté por debajo permite el modelo de precio
del mercado; por encima, hay que vender cupo en vez de "ilimitado".

---

## 5. Escenario A — uso propio (BDI + Zattia + Stunned)

**Supuesto:** 4 campañas/mes a lista completa = **94.592 envíos/mes**. *(Confirmar la
frecuencia real.)*

| Concepto | USD/mes |
|---|---|
| SES Essentials (94.592 × $0,16/1k) | 15,13 |
| Neon compute + almacenamiento | 0,19 |
| Vercel memoria + CPU + invocaciones | 0,17 |
| GitHub Actions | 0 – 7 |
| Vercel Pro (piso) | 20,00 |
| **Total** | **35,5 – 42,5** |

Anual: **~USD 430 – 510**. Gasto actual: **>USD 1.800/año**. → **Ahorro ≥ USD 1.300/año.**

Pasando SES a *à la carte* el costo variable baja a $9,46 (−$5,70/mes). A este volumen es
marginal; a escala SaaS no.

**Si SES no se destraba:** Resend plan de $35 (100k) → total ~USD 56/mes. Sigue ahorrando
>USD 95/mes. **Para uso propio el proyecto cierra con cualquier proveedor.**

---

## 6. Escenario B — SaaS en la App Store de Tiendanube

### 6.1 Costo por comerciante

| Perfil | Contactos | Envíos/mes | Costo real (SES Essentials) |
|---|---|---|---|
| Chico | 1.000 | 4.000 | **$0,70** |
| Mediano | 5.000 | 20.000 | **$3,30** |
| Grande | 25.000 | 150.000 | **$25,00** |

### 6.2 Punto de equilibrio

Con un plan de USD 10/mes, comerciante mediano, comisión de cobro 5%:

- Contribución por cuenta: `10 − 3,20 (SES) − 0,10 (infra) − 0,50 (cobro)` = **$6,20**
- Piso fijo $27 → **equilibrio en 5 comerciantes pagos**
- 50 comerciantes: ingreso $500 − variable $190 − fijo $27 = **$283/mes (57%)**
- 200 comerciantes: ~$1.150/mes, pero requiere subir la cuota de SES (4M envíos/mes =
  133k/día) y probablemente IP dedicada

### 6.3 Sensibilidad — dónde se rompe el plan plano

Un plan de USD 10 con envíos ilimitados deja de ser rentable arriba de:

- **~58.000 envíos/mes por cuenta** con SES Essentials
- **~10.400 envíos/mes por cuenta** con Resend

Por eso **no conviene copiar el modelo de Perfit/Doppler** (precio por contactos, envíos
ilimitados): nuestro costo es por envío y el de ellos también, pero ellos ya tienen escala
para absorberlo.

### 6.4 Modelo de precio — ⚠️ PROPUESTA DE CLAUDE, NO DECISIÓN

> Los números de esta tabla los propuso Claude en el análisis del 25-jul-2026 a partir de
> los costos reales y de una referencia de mercado. **No están validados con clientes ni
> decididos por Bruno.** Tomarlos como punto de partida para discutir, no como el precio.

Precio por contactos **con cupo de envíos** (lo que hacen Mailchimp y Klaviyo), excedente
facturado aparte:

| Plan | Contactos | Cupo envíos/mes | Costo SES | Precio propuesto | Margen bruto |
|---|---|---|---|---|---|
| Gratis | 500 | 2.000 | $0,32 | USD 0 | costo de adquisición |
| Emprendedor | 2.500 | 15.000 | $2,40 | **USD 9** | ~67% |
| Tienda | 10.000 | 60.000 | $9,60 | **USD 25** | ~57% |
| Pro | 30.000 | 180.000 | $28,80 | **USD 59** | ~46% |

Excedente propuesto: **USD 2 cada 1.000 envíos** (12,5× el costo — el excedente subsidia al
que se pasa sin castigarlo).

Referencia de mercado: Doppler arranca en USD 10 con 2.500 contactos y envíos ilimitados.

---

## 7. Competencia y viabilidad comercial

### 7.0 Que sea fácil de construir no es una ventaja

Es la trampa central de este análisis, y conviene tenerla escrita antes que cualquier número:
**armar un email marketing es simple, y eso lo cumplen también los otros veinte que lo
pensaron.** Cuando un negocio se ve fácil de construir y con margen visible, lo que falta no
suele ser la idea sino la barrera que impide que te copien. La pregunta útil no es "¿puedo
hacerlo?" sino "¿por qué el comerciante me elegiría a mí y por qué se quedaría?".

### 7.1 Lo que hay hoy

El email marketing para e-commerce es una categoría **madura y muy poblada a nivel global**
(Mailchimp, Klaviyo, Omnisend, Brevo) y **con jugadores locales fuertes en Argentina**
(Perfit, Doppler, emBlue). No hay ningún hueco de producto: todo lo que hace el mailer ya
existe en algún lado, mejor hecho.

Lo que sí se ve más flojo es **la presencia dentro de la App Store de Tiendanube**:

| Señal | Dato (25-jul-2026) |
|---|---|
| Doppler en la App Store de TN | **3,4 ★ sobre 25 evaluaciones** |
| Descuento que ofrece Doppler a clientes de TN | 35% |
| Apps de la categoría con etiqueta "Pago" o "Compras dentro de la aplicación" | Existen — hay camino para cobrar, aunque falta confirmar cómo fluye la plata |

Un incumbente con 25 reseñas y 3,4 estrellas en el canal no es una posición dominante. **La
oportunidad no es el producto: es el canal.**

### 7.2 Por qué el margen alto no es la ventaja que parece

- 57-67% de margen bruto **está por debajo del SaaS típico** (75-85%). Es un negocio de
  reventa de envíos: el costo del proveedor es un *pass-through* que no se puede optimizar.
- El margen de la sección 6 es **antes de trabajo humano**. Con un ARPU de USD 9-25, un solo
  ticket de soporte de 30 minutos se come el margen de varios meses de esa cuenta.
- El número absoluto es chico: 50 comerciantes son ~USD 283/mes. Esto recién se parece a un
  negocio en el orden de los **cientos** de comerciantes, y eso es un problema de
  distribución, no de software.

### 7.3 Las barreras reales (ninguna es programar)

1. **Distribución.** Aparecer y rankear en la App Store, juntar reseñas, competir con marcas
   que el comerciante ya conoce.
2. **Entregabilidad.** No es una feature, es una disciplina operativa: warmup, feedback
   loops, higiene de listas, aislamiento por inquilino, monitoreo de rebotes. Es donde
   mueren la mayoría de los mailers caseros.
3. **Confianza.** El comerciante te entrega su lista de clientes. Necesita creer que vas a
   existir dentro de tres años.
4. **Soporte en español y rápido.** Es, en buena medida, con lo que Perfit ganó Argentina.
5. **Churn.** Los comerciantes chicos rotan fuerte. A 50 cuentas con 6% mensual hacen falta
   3 altas por mes solo para no perder terreno.

### 7.4 Las ventajas propias que sí son reales

- **Los costos de cambio son altos, y esa es la única barrera estructural del rubro.** Una
  vez que el comerciante tiene adentro su lista, sus plantillas y sus automatizaciones, no se
  muda: es de los pocos SaaS donde la retención no depende de seguir gustando mes a mes. La
  consecuencia estratégica es que **el que entra primero en cada tienda se queda con esa
  tienda**, y por eso la velocidad de instalación importa más que la completitud del producto.
- **Dogfooding**: se usa en tres tiendas propias antes de vendérselo a nadie.
- **Resorty como canal — pero todavía es una apuesta, no un activo.** ⚠️ Al 25-jul-2026
  Resorty **no está publicado en la App Store**: está en vivo en Zattia (tienda propia)
  instalado por GTM, y no tiene clientes externos. El argumento de "canal de distribución
  propio" vale **cuando** Resorty esté publicado e instalado en tiendas ajenas; hoy es el
  plan, no el punto de partida. Ver §7.6, que es donde está el problema.
- **El combo captura + envío** (pop-up que capta el mail y mailer que lo trabaja) es un
  producto más difícil de copiar que un mailer suelto, y ninguno de los incumbentes locales
  lo ofrece integrado.
- **Los datos de Tiendanube** (productos, pedidos, comportamiento) permiten segmentación que
  una herramienta genérica conectada por integración no tiene con la misma fidelidad.

### 7.5 Conclusión de esta sección

Es posible, pero **no por ser simple ni por el margen**. El modelo de negocio es claro y
conocido justamente porque muchos ya lo hicieron. La versión defendible de esta apuesta no
es "otro email marketing barato", sino **el paquete Resorty + mailer vendido dentro de
Tiendanube a comerciantes que ya confían en la primera app**.

### 7.6 El canal está bloqueado por Tiendanube, no por falta de desarrollo

Si la apuesta es el combo y no el mailer suelto, **la prioridad no la marca el mailer** — y
acá aparece el problema de fondo, que no es de código:

- **NubeSDK es obligatorio en homologación desde el 5-jun-2026**: sin él no se aprueba
  ninguna app nueva de storefront. Esa fecha ya pasó, así que Resorty **hoy no se puede
  publicar** sin migrar.
- **Pero NubeSDK no se puede usar en los temas actuales.** La documentación oficial dice que
  los slots solo están soportados en el tema **Patagonia**, y Patagonia **ya no está
  disponible para instalaciones nuevas** — la tienda demo creada desde el Portal de Partners
  vino con Morelia. O sea: el camino obligatorio está cerrado por el otro extremo.
- Después vienen las fechas de corte para las apps que **ya están publicadas**: 30-ago-2026
  se bloquean las instalaciones nuevas sin SDK, 30-oct-2026 empieza la desinstalación
  progresiva (`project_tiendanube_nubesdk`).
- **El mailer no tiene ninguna fecha límite** — no inyecta nada en el storefront, así que
  NubeSDK no lo toca (`TIENDANUBE-PUBLICACION.md` §1).

**La consecuencia estratégica:** el cuello de botella del negocio no es tiempo de desarrollo
ni plata de infraestructura, es **una respuesta de Tiendanube que todavía no llegó**. Las
preguntas 1, 2, 3 y 5 de `areben-popups/CONSULTA-TIENDANUBE.md` — el mail a
socios@tiendanube.com que está redactado y **sin enviar** — determinan si el canal existe,
cuándo, y si se puede cobrar por él. **Enviarlo es la acción de mayor palanca de todo este
documento, y no cuesta nada.**

### 7.7 Plan D — vender fuera de la App Store

La pregunta 3 de esa consulta abre una salida que no depende de la homologación: si un script
que **el propio comerciante** pega en *Códigos externos* o inyecta por GTM **no** cae bajo el
bloqueo de NubeSDK, entonces el combo Resorty + mailer se puede vender **directo**, sin App
Store, sin homologación y sin fechas de corte. Es exactamente como está instalado Resorty en
Zattia hoy (GTM-P5B8T7QV).

| | App Store | Venta directa (GTM) |
|---|---|---|
| Homologación | Obligatoria, hoy bloqueada | No aplica |
| Descubrimiento | El comerciante te encuentra solo | Hay que salir a buscarlo |
| Fricción de instalación | Un clic | El comerciante pega un script |
| Cobro | Sin documentar (pregunta 5) | Facturación propia, control total |
| Riesgo de plataforma | Alto: cambian las reglas y te caés | Bajo |

No es tan bueno como la App Store para adquirir, pero **no depende de que Tiendanube
conteste** y sirve para conseguir los primeros comerciantes mientras el canal oficial se
destraba. Con el costo de cambio de §7.4 jugando a favor, cinco tiendas conseguidas a mano
hoy valen más que cincuenta dentro de un año.

---

## 8. Planes A, B y C

### Plan A — SES aprobado (objetivo)

Uso propio + SaaS con la mejor economía posible ($0,10-0,16/1k). Es el único camino que
soporta el modelo de precio del mercado con margen cómodo.

- **Depende de:** el caso `178473604500639`.
- **Costo de esperar:** cero en dinero, alto en tiempo — hoy no se puede mandar ni una
  campaña propia.

### Plan B — SES no llega a tiempo → destrabar uso propio con Resend

Se cambia una env var (`EMAIL_PROVIDER=resend`); la capa de proveedor y el webhook de
rebotes con verificación de firma ya existen (`lib/email/proveedores/resend.ts`,
`/api/webhooks/resend`).

- **Costo:** ~USD 56/mes en vez de ~USD 40. Sigue ahorrando >USD 95/mes.
- **Trabajo real:** re-verificar los dos dominios en Resend (otro juego de DKIM en
  Cloudflare), dar de alta el webhook, y **generalizar el gate `SES_SANDBOX`** — hoy bloquea
  el envío con cualquier proveedor (`campanias/actions.ts:98` y `:137`,
  `automations/procesar/route.ts:17`).
- **El SaaS queda en pausa:** a $0,90/1k no cierra con precio plano.

### Plan C — SES no llega y aun así queremos el SaaS

Dos salidas, combinables:

1. **Proveedor barato alternativo:** Elastic Email a ~$0,09/1k pay-as-you-go, con producto de
   whitelabel para multi-inquilino. Hay que auditarle la entregabilidad antes de apoyar un
   negocio encima.
2. **Cambiar el modelo de precio:** vender cupo en vez de ilimitado. A $0,90/1k, revendiendo
   a $2-3/1k el margen es 55-70%. Cierra, pero el posicionamiento comercial es más difícil
   contra el "ilimitado" de la competencia.

**Lo que ningún plan resuelve cambiando de proveedor:** todos revisan al remitente masivo, y
ser un ESP encima de otro ESP (mandar en nombre de comerciantes que no controlamos) es una
figura que varios prohíben o exigen acuerdo aparte. SES la contempla explícitamente
(*tenants*, pools de IP); Elastic Email tiene whitelabel; al resto hay que leerles la letra
chica **antes** de construir encima.

---

## 9. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Reputación compartida entre inquilinos** | Un comerciante con lista comprada quema la cuenta SES entera — y con ella los mails de BDI y Zattia | *Tenants* de SES (hasta 10.000), doble opt-in obligatorio, límite de rebote por cuenta con suspensión automática, IP dedicada con volumen |
| **Base de datos compartida con Resorty, que está en vivo** | Neon Free = 512 MB; 43 MB/mes de filas `Envio`. Si se llena, se cae Resorty también | Neon a plan pago **antes** del primer blast; retención/purga de `Envio` y `Evento` |
| **La cola de envío vive en el navegador** | `CampaniaEditor.tsx:112` manda de a 20 por request: ~1h20m de pestaña abierta para los 16.825 de BDI. Inviable multi-inquilino | Mover la cola al servidor (cron por minuto, o QStash/Inngest) |
| **Vercel Hobby prohíbe uso comercial** | Riesgo de ToS desde el primer peso cobrado | Pro, USD 20/mes |
| **Cómo se cobra una app paga en Tiendanube está sin documentar** | Puede exigir cobro fuera de plataforma (fricción) o quedarse un % | Preguntar a socios@tiendanube.com — ya está en la consulta pendiente |
| **Soporte de onboarding de dominio** | Cada comerciante que no sabe cargar DKIM es un ticket. Es el costo oculto grande del SaaS, y no aparece en ninguna tabla de arriba | Asistente guiado por proveedor de DNS; detección automática de registros |
| **Descalce cambiario** | Ingresos probablemente en ARS, costos 100% en USD | Precios en USD o indexados |
| **Concentración en Tiendanube** | Si TN saca su propio email marketing, se cierra el canal | El producto también sirve fuera de TN |

---

## 10. Bloqueantes para publicar (checklist)

| # | Bloqueante | ¿Bloquea uso propio? | ¿Bloquea SaaS? |
|---|---|---|---|
| 1 | Acceso a producción de SES | **Sí** | **Sí** |
| 2 | Vercel Pro | No (aunque el ToS ya aplica) | **Sí** |
| 3 | Neon a plan pago | Antes del primer blast grande | **Sí** |
| 4 | Cola de envío del lado del servidor | No (tolerable) | **Sí** |
| 5 | Aislamiento de reputación por inquilino | No | **Sí** |
| 6 | Los 4 webhooks obligatorios de TN | No | **Sí** — ver `TIENDANUBE-PUBLICACION.md` |
| 7 | App propia en Partners (hoy comparte credencial con Resorty) | No | **Sí** |
| 8 | Definir cómo se cobra | No | **Sí** |

**Orden sugerido:** (1) destrabar el envío — Resend ya, apelación de SES en paralelo ·
(2) Neon pago antes del primer blast · (3) cola en el servidor · (4) el resto del andamiaje
de Tiendanube · (5) publicar.

---

## 11. Supuestos a validar

Todo lo que sigue lo puso Claude en el análisis, no está medido:

- 4 campañas/mes a lista completa (uso propio)
- 25% de apertura, 3% de clic — afectan solo al 2% no-SES del costo
- Comerciante mediano = 5.000 contactos y 20.000 envíos/mes
- 5% de comisión de cobro
- Precio de USD 10/mes en los cálculos de equilibrio; la tabla de planes de §6.4 es propuesta
- ~250 ms por email (SES + escritura en Neon) — no se midió con envíos reales porque todavía
  no hubo ninguno
- 6% de churn mensual en la proyección de la §7.3

---

## 12. Fuentes

Consultadas el 25-jul-2026:

- [SES pricing](https://aws.amazon.com/ses/pricing/) · [SES quotas](https://docs.aws.amazon.com/ses/latest/dg/quotas.html)
- [Vercel pricing](https://vercel.com/pricing) · [Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing)
- [Neon pricing](https://neon.com/pricing)
- [Resend pricing](https://resend.com/pricing) · [MailerSend pricing](https://www.mailersend.com/pricing) · [Elastic Email pricing](https://elasticemail.com/email-api-pricing)
- [Doppler precios](https://www.fromdoppler.com/en/pricing/) · [Doppler en la App Store de Tiendanube](https://www.tiendanube.com/tienda-aplicaciones-nube/doppler)
- [Tiendanube Partners](https://www.tiendanube.com/blog/tiendanube-partners/)
