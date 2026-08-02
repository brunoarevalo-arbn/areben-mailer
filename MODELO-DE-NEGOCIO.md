# Modelo de negocio y costos — areben-mailer

> Análisis hecho el **25-jul-2026**. Todos los datos de infraestructura están **medidos en
> vivo**, no estimados; los precios de proveedores están verificados contra las páginas
> oficiales ese día. Los supuestos comerciales están marcados como tales.
>
> Este archivo existe para **no volver a hacer el análisis desde cero**. Si algo acá está
> desactualizado, corregilo en vez de rehacerlo. Complementa a `SES-ESTADO.md` (estado del
> envío) y `TIENDANUBE-PUBLICACION.md` (requisitos de la App Store).
>
> **Actualizado el 27-jul-2026** con la respuesta de Tiendanube a las 6 consultas: §6.5
> (cómo se cobra), §7.6 (NubeSDK y los temas) y §7.7 (Plan D confirmado).
>
> **Actualizado el 1-ago-2026** contra el código y contra la base: §1, §3 (estado remedido),
> §6.5 (**el 30% NO es obligatorio** — se corrigió el encuadre), §9 y §10.

---

## 1. Veredicto en tres líneas

- **Uso propio: lanzalo.** Cuesta ~USD 40/mes contra los >USD 150/mes que se pagan hoy.
  Ahorro ≥ USD 1.300/año, y el 97% del costo marginal es el proveedor de email.
- **SaaS: la economía cierra** (equilibrio en 5 comerciantes, ~57% de margen a 50) **y los
  tres cimientos que faltaban ya están**: SES aprobado (50k/día), la cola corre en el servidor
  y la infra se paga desde el 31-jul (Vercel Pro + Neon pago). ✅ 1-ago-2026.
- **Publicar en la App Store NO cuesta el 30%**: marcada como "Gratis con cobros externos" se
  cobra por afuera con el 100% del ingreso → §6.5. El 30% es una modalidad que se elige, y lo
  que compra es el checkout adentro del panel.
- **Lo que hoy frena no es Tiendanube ni la infraestructura: es que el producto no es
  multi-inquilino.** Un comerciante que instala **no puede mandar un mail** (no hay alta de
  dominio autoservicio), la supresión de rebotes cruza cuentas y el import de CSV se
  auto-declara consentido → `TIENDANUBE-PUBLICACION.md` §3.
- El costo que importa sigue sin ser la infraestructura: es **la reputación de envío
  compartida entre inquilinos** y **el soporte de onboarding de dominio**.
- **El canal no está bloqueado** (27-jul): los scripts que instala el propio comerciante por
  GTM o Códigos externos **no caen bajo NubeSDK**. Se puede vender directo, con el 100% del
  ingreso y sin homologación → §7.7.

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

## 3. Estado medido (1-ago-2026)

Remedido contra la base y contra el código. Lo que cambió respecto del 25-jul va marcado.

| Qué | Valor | Cómo se midió |
|---|---|---|
| Contactos | **28.245** (BDI 21.381 · Zattia 6.864 · Stunned 0 · Resorty Lab 0) | `prisma.contacto.count` por cuenta |
| Audiencia mandable | **25.488** (BDI 18.711 · Zattia 6.777) | `estado ACTIVO` + `tnAcceptsMkt` |
| Campañas / envíos / eventos | 23 (4 enviadas) / **24** / 12 | ⬆️ era 4 / 0 / 0 — **ya salieron mails reales** |
| Tamaño de la base | **34 MB** | ⬆️ era 23 MB (`pg_database_size`) |
| Plan de Neon | ✅ **Pago desde el 31-jul** | era Free (512 MB, 100 CU-h) |
| Base compartida con | **areben-popups (Resorty), EN VIVO en tiendas** | misma `DATABASE_URL` |
| Plan de Vercel | ✅ **Pro desde el 31-jul** | era Hobby (prohíbe uso comercial) |
| Región y config de funciones | **iad1**, Fluid, memoria estándar, timeout 300 s | `GET /v9/projects/:id` |
| Plan de SES | **Essentials** ($0,16/1k), us-east-1, `HEALTHY` | `SESv2 GetAccount` |
| Acceso a producción SES | ✅ **APROBADO — 50.000/día** | era sandbox (caso `178473604500639`) |
| Proveedor activo | **SES** desde el 30-jul (`EMAIL_PROVIDER`); Resend free de respaldo | `/envio` |
| Gate de envío | 🔴 **`real` — abierto desde el 31-jul 12:20** | `ENVIO_REAL=true`, ver `/envio` |
| Remitentes cargados | Zattia `AUTENTICADO` · BDI `PENDIENTE` (columna stale) | `prisma.remitente.findMany` |
| Dominios autenticados en SES | `bdiaccesorios.com.ar`, `zattia.com.ar` (Easy DKIM + custom MAIL FROM) | `ListEmailIdentities` |
| Comerciantes externos pagos | **0** | — |
| Cron | GitHub Actions cada 15 min, **repo privado** | `.github/workflows/cron.yml` |
| Peso de un email renderizado | 2,6 – 3,1 KB (esqueleto, sin copy real) | `renderEmailHtml` sobre los 4 presets |

⚠️ **El `estado` de `Remitente` no es autoritativo**: BDI figura `PENDIENTE` y su dominio sí
está verificado en SES — nadie apretó "verificar" desde que se creó la fila. Y el camino de
envío **no lo lee** (`getRemitenteEnvio` ordena por `esPrincipal` y devuelve el primero). Ver
`TIENDANUBE-PUBLICACION.md` §3.1.

**Re-verificar SES:** `node --env-file=.env scripts/ses-status.ts`. Los conteos salen de un
script descartable con `prisma.contacto.count` por cuenta.

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

### 6.5 Cómo se cobra — RESPUESTA DE TIENDANUBE (27-jul-2026)

> 🔴 **LEER ESTO ANTES DE HABLAR DEL 30%.** Publicar en la App Store **no obliga a resignar
> el 30%**: es una de tres modalidades y se elige. **Publicada como "Gratis" con *cobros
> externos*, Areben cobra por afuera y se queda con el 100%** — y sigue estando en la App
> Store, con la ficha, el buscador y el botón de instalar. El 30% compra el checkout adentro
> del panel; no es el precio de entrada al canal. Cualquier análisis que trate al 30% como
> inevitable está mal, y este archivo lo dijo mal hasta el 1-ago-2026.

Contestó Lucas, de socios@. Se elige en *Datos de publicación* → modalidad de cobro, después
de completar el país. Hay tres opciones y **son excluyentes**:

| Modalidad | Quién cobra | Se queda Areben | Fricción para el comerciante |
|---|---|---|---|
| **Gratis, marcada con *cobros externos*** | **Areben** | **100%** | Paga fuera del panel |
| Suscripción mensual recurrente | Tiendanube | 70% | Un clic, adentro del panel |
| Pago único | Tiendanube | 70% | Un clic, adentro del panel |

Si cobra Tiendanube, la comisión se genera sola cuando el pago se confirma y se ve en
*Comisiones* del Partner Portal. Para retirarla hay que **emitir factura e iniciar el retiro**
— no es una acreditación automática.

**Qué se está comprando con el 30%**, entonces: fricción cero en el checkout, dentro del panel
donde el comerciante ya paga su plan, que es exactamente donde se pierden las conversiones. Es
una decisión de conversión, no un peaje.

**Lo que costaría** (sobre los precios *propuestos* de §6.4, que siguen sin decidirse):

| Plan | Precio | Contribución cobrando por afuera | Contribución con TN 30% | Margen |
|---|---|---|---|---|
| Emprendedor | USD 9 | $6,60 | $3,90 | 67% → 43% |
| Tienda | USD 25 | $15,40 | $7,90 | 57% → 32% |
| Pro | USD 59 | $30,20 | $12,50 | 46% → 21% |

En los planes baratos la comisión **pesa más que todo el costo de envío**: en Emprendedor son
$2,70 de comisión contra $2,40 de SES, y el equilibrio de §6.2 pasaría de 5 comerciantes a ~9.
Por eso la modalidad por defecto de este análisis es **cobros externos**, y el 30% se evalúa
recién si se mide que la conversión adentro del panel lo paga.

⚠️ **Cobrar por afuera no es gratis: es trabajo.** Hace falta la cobranza propia (Resorty ya
resolvió esa parte con **MP Suscripciones**, ver `areben-popups`) y **falta definir quién
factura**. Pero es trabajo que la venta directa (§7.7) necesita igual, así que no es un costo
extra de publicar.

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

### 7.6 El canal — RESPUESTA DE TIENDANUBE (27-jul-2026)

Hasta el 26-jul este documento decía que el canal estaba cerrado por los dos extremos:
NubeSDK obligatorio para homologar (desde el 5-jun-2026) pero imposible de usar, porque sus
slots solo corren en Patagonia y Patagonia ya no se puede instalar. **Contestaron y el
diagnóstico cambia.** Lo que dijo Lucas, punto por punto:

- **El deadlock de desarrollo se rompe**: pueden **activar el slot en tiendas demo** a pedido.
  Ese es el ambiente de prueba que no existía.
- **En tiendas productivas sigue igual**: los scripts con SDK corren **solo en Patagonia**;
  en el resto de los diseños corre **el script sin SDK**. Y **no hay fecha** para que el SDK
  llegue a todos los diseños.
- **Las apps legacy no se caen**: "si aún no se hizo el rollout del SDK en todos los diseños,
  se seguirá ejecutando el script sin SDK". Las fechas de corte (30-ago / 30-oct) hay que
  releerlas así: lo exigible es **tener cargado el script con SDK**, no que el SDK funcione en
  todos lados. Cuando el rollout llegue, empieza a impactar de inmediato.
- **Hay que cargar los dos scripts**, con SDK y sin SDK. La migración a NubeSDK no reemplaza
  al widget actual: **convive** con él. Es trabajo extra, no trabajo sustituto.
- **Los webhooks de LGPD no se dan de alta por API** — por eso el 422. Se cargan en el
  formulario de *Datos básicos* y con eso quedan. (`app/uninstalled` sí va por
  `POST /webhooks`, y ya funcionaba.)
- **Homologación**: no la responden por acá. Se pide desde el Partner Portal y ahí llega un
  mail de Tech Solutions con los pasos. O sea, los requisitos de consentimiento y listas
  siguen sin respuesta hasta que se arranque el trámite.

**La consecuencia estratégica:** el cuello de botella dejó de ser Tiendanube. De acá en
adelante es una decisión de Bruno — §7.7.

### 7.7 Plan D — CONFIRMADO: se puede vender fuera de la App Store

La pregunta que abría la salida era si un script que pega **el propio comerciante** cae bajo
el bloqueo de NubeSDK. La respuesta fue **no**, y es literal:

> "No, el SDK no impacta en códigos ingresados en esos lugares. Solo impacta en scripts
> cargados por los aplicativos a través del partner portal."

O sea: **Códigos externos y GTM quedan fuera del alcance de NubeSDK**, sin fecha de corte y
sin homologación. Es exactamente como está instalado Resorty en Zattia hoy (GTM-P5B8T7QV) —
y ese camino **no se rompe en agosto ni en octubre**.

| | App Store | Venta directa (GTM) |
|---|---|---|
| Homologación | Obligatoria; se pide y contesta Tech Solutions | No aplica |
| NubeSDK | Obligatorio cargarlo, además del legacy | **No aplica nunca** |
| Descubrimiento | El comerciante te encuentra solo | Hay que salir a buscarlo |
| Fricción de instalación | Un clic | El comerciante pega un script |
| Cobro | **Elegís**: TN cobra y retiene 30%, **o cobrás vos con el 100%** (§6.5) | Facturación propia, 100% |
| Riesgo de plataforma | Alto: cambian las reglas y te caés | Bajo |

Lo importante es que **ya no es "mientras tanto"**: la venta directa es un camino completo y
permanente, con el 100% del ingreso y cero dependencia del calendario de Tiendanube.

⚠️ **Y las dos no son excluyentes.** Como la modalidad de *cobros externos* deja el 100%, la
App Store no cuesta margen: cuesta **homologación, mantenimiento del trámite y riesgo de
plataforma** — y, para Resorty, la reescritura a NubeSDK (al mailer eso no lo toca). El
argumento para no publicar hoy no es el 30%: es que **todavía no hay un solo comerciante
pago**, así que se estaría optimizando la adquisición de un producto sin tracción.

**Recomendación**: arrancar por venta directa —cuesta cero desarrollo nuevo, ya está probado
en Zattia— y publicar en la App Store, con cobros externos, **cuando haya dos o tres
comerciantes pagando** y el producto sea multi-inquilino (§10). Con el costo de cambio de §7.4
jugando a favor, cinco tiendas conseguidas a mano hoy valen más que cincuenta dentro de un año.

⚠️ Pero ojo con el orden: **vender directo adelanta los blanqueos de infraestructura**. Vercel
sigue en Hobby, que prohíbe uso comercial, y Neon en Free compartido con Resorty en vivo
(§10). Antes del primer peso cobrado, eso se arregla.

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
  Cloudflare) y dar de alta el webhook. ~~Generalizar el gate `SES_SANDBOX`~~ **ya está
  hecho** (26-jul-2026): el gate es `ENVIO_REAL` y no menciona a ningún proveedor.
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
| **Reputación compartida entre inquilinos** | Un comerciante con lista comprada quema la cuenta SES entera — y con ella los mails de BDI y Zattia | Cuarentena por tramos (**diseñada, no construida** — plan `fluffy-chasing-wirth.md`), *tenants* de SES, límite de rebote por cuenta con corte automático, IP dedicada con volumen |
| 🔴 **La supresión cruza cuentas** | `lib/email/supresion.ts:35` hace `updateMany` **por email, sin `cuentaId`**: una queja en la tienda A marca `SPAM` al mismo contacto en la tienda B. Fuga entre clientes y bajas que nadie pidió | Agregar `cuentaId` al `where`. Barato ahora, caro con el primer cliente |
| 🔴 **Un CSV se auto-declara consentido** | `app/(app)/contactos/actions.ts:54` fija `tnAcceptsMkt: true` en el import. Es la puerta por la que entra una lista comprada | Que el consentimiento del import sea explícito y trazable, como en `importar.ts` |
| 🔴 **El comerciante no puede verificar su dominio solo** | Instala, arma la campaña, y no sale nada: `crearRemitente` no da de alta la identidad en SES ni muestra los DKIM. Hoy lo corre Bruno a mano | Alta autoservicio + CNAME en pantalla + exigir `AUTENTICADO` antes de enviar. Ver `TIENDANUBE-PUBLICACION.md` §3.1 |
| ~~**Base compartida con Resorty en Neon Free**~~ ✅ **RESUELTO 31-jul-2026** | Neon Free = 512 MB y suspende a las 100 CU-h; si se llenaba se caía Resorty también | Neon en plan pago. Queda pendiente la **retención/purga** de `Envio` y `Evento` (43 MB/mes proyectados) |
| ~~**La cola de envío vive en el navegador**~~ ✅ **RESUELTO 25-jul-2026** | Antes `CampaniaEditor.tsx` mandaba de a 20 por request: ~1h20m de pestaña abierta para los 16.825 de BDI | Ya está en el servidor (`lib/email/cola.ts`): worker con lease + auto-encadenamiento, y el cron de GitHub como perro guardián. El editor solo mira el progreso |
| ~~**Vercel Hobby prohíbe uso comercial**~~ ✅ **RESUELTO 31-jul-2026** | Riesgo de ToS desde el primer peso cobrado | Pro, USD 20/mes, cubre los 4 proyectos del team |
| ~~**Cómo se cobra una app paga está sin documentar**~~ ✅ **RESUELTO 27-jul-2026** | — | Tres modalidades, y **cobros externos deja el 100%** → §6.5 |
| **Soporte de onboarding de dominio** | Cada comerciante que no sabe cargar DKIM es un ticket. Es el costo oculto grande del SaaS, y no aparece en ninguna tabla de arriba | Asistente guiado por proveedor de DNS; detección automática de registros |
| **El motor nunca mandó un blast** | 24 envíos reales en total al 1-ago. Publicar expone comerciantes ajenos a un camino que no se probó a volumen | Terminar los tramos propios (BDI T01-T06, Zattia) antes de vender |
| **Descalce cambiario** | Ingresos probablemente en ARS, costos 100% en USD | Precios en USD o indexados |
| **Concentración en Tiendanube** | Si TN saca su propio email marketing, se cierra el canal | El producto también sirve fuera de TN |

---

## 10. Bloqueantes para publicar (checklist)

**Estado al 1-ago-2026. De los 8 originales quedan 1 y medio; aparecieron 4 nuevos** al mirar
el código en vez de la infraestructura.

| # | Bloqueante | Estado | ¿Bloquea venta directa? | ¿Bloquea App Store? |
|---|---|---|---|---|
| 1 | Acceso a producción de SES | ✅ Aprobado, 50k/día | — | — |
| 2 | Vercel Pro | ✅ Desde el 31-jul | — | — |
| 3 | Neon a plan pago | ✅ Desde el 31-jul | — | — |
| 4 | Cola de envío del lado del servidor | ✅ 25-jul | — | — |
| 5 | Aislamiento de reputación por inquilino | 🔴 Diseñado, sin construir | **Sí** | **Sí** |
| 6 | Los 4 webhooks obligatorios de TN | 🟡 El código está; **falta darlos de alta** en *Datos básicos* y probarlos | No | **Sí** |
| 7 | App propia en Partners | ✅ Mailer #37222, Resorty #37985 | — | — |
| 8 | Definir cómo se cobra | ✅ §6.5 — cobros externos deja el 100% | — | — |
| 9 | **OAuth público + alta automática** | ✅ **Ya estaba construido** (`/api/tn/entrar` + callback) | — | — |
| 10 | 🔴 **Alta de dominio autoservicio en SES** | Sin construir — hoy lo corre Bruno a mano | **Sí** | **Sí** |
| 11 | 🔴 **Supresión que cruza cuentas** | `supresion.ts:35` sin `cuentaId` | **Sí** | **Sí** |
| 12 | 🔴 **Import de CSV auto-consentido** | `contactos/actions.ts:54` | **Sí** | **Sí** |
| 13 | 🟡 **Planes, cuotas y límites** | No existe ningún modelo de facturación | **Sí** | **Sí** |
| 14 | 🟡 `/privacidad` y `/terminos` | No existen | Conviene | **Sí** |
| 15 | 🟡 Revisión de scopes de la #37222 | Sin hacer — pedir de más es rechazo | No | **Sí** |

**Lo que cambia respecto del 27-jul:** los bloqueantes de plata (1, 2, 3) y de arquitectura
(4, 7, 9) están todos cerrados. **Publicar dejó de depender de Tiendanube y pasa a depender de
que el producto sea multi-inquilino** — 10, 11, 12 y 13, que bloquean *las dos* vías por
igual. Detalle en `TIENDANUBE-PUBLICACION.md` §3.

**Orden sugerido:**

1. **Terminar los envíos propios** (BDI T01-T06, Zattia) — el motor todavía no mandó un blast.
2. **Alta de dominio autoservicio** (#10) y **las dos fugas** (#11, #12). Sirven igual para
   las dos vías y son lo más barato de la lista.
3. **Dos o tres comerciantes conocidos por venta directa**, cobrados a mano. Valida precio,
   soporte y onboarding con gente que perdona.
4. **Cuarentena por tramos** (#5) y **planes** (#13), construidos contra lo que rompan esos
   primeros clientes y no contra lo que adivinemos hoy.
5. **Publicar**: webhooks de LGPD dados de alta (#6), legales (#14), scopes (#15),
   homologación. **Marcada "Gratis con cobros externos"** salvo que se mida que el 30% se
   paga solo en conversión.

⚠️ Publicar en la App Store **no compite** con la venta directa ni la reemplaza: como la
modalidad de cobros externos deja el 100%, el canal oficial es adquisición casi gratis. Lo que
cuesta es la homologación y el riesgo de plataforma, no el margen.

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
