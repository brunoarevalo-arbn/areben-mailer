# Modelo de negocio y costos — areben-mailer

> Análisis hecho el **25-jul-2026**. Todos los datos de infraestructura están **medidos en
> vivo**, no estimados; los precios de proveedores están verificados contra las páginas
> oficiales ese día. Los supuestos comerciales están marcados como tales.
>
> Este archivo existe para **no volver a hacer el análisis desde cero**. Si algo acá está
> desactualizado, corregilo en vez de rehacerlo. Complementa a `SES-ESTADO.md` (estado del
> envío) y `TIENDANUBE-PUBLICACION.md` (requisitos de la App Store).
>
> **Actualizado el 27-jul-2026** con la respuesta de Tiendanube a las 6 consultas: §6.7
> (cómo se cobra), §7.6 (NubeSDK y los temas) y §7.7 (Plan D confirmado).
>
> **Actualizado el 1-ago-2026** contra el código y contra la base: §1, §3 (estado remedido),
> §6.7 (**el 30% NO es obligatorio** — se corrigió el encuadre), §9 y §10.
>
> **Actualizado el 2-ago-2026 — la revisión más grande hasta ahora.** Todo pasó a **pesos**, con
> el tipo de cambio y la carga fiscal reales (§4). Se corrigieron cuatro errores de costos que
> venían de julio (§4.2, §6.2, §6.7). Y se midieron **los precios de la competencia**, que dieron
> vuelta dos conclusiones centrales: el margen del rubro es mucho más alto de lo que decía este
> archivo, y **el incumbente no es un tercero: es Tiendanube, que compró Perfit** (§7.1).

---

## 1. Veredicto en tres líneas

- **Uso propio: lanzalo.** El marginal de mandar los 94.592 mails propios es **~$35.500/mes**
  contra los >USD 150/mes que se pagan hoy. El 97,7% del costo variable es el proveedor de
  email; optimizar Vercel o Neon es irrelevante.
- 🔑 **El margen del rubro es MUCHO más alto de lo que decía este archivo.** Medido el
  2-ago-2026: el mercado local cobra **entre 9 y 16 veces el costo de mandar** — Marketing Nube
  factura $75.480/mes por 3.000 contactos, cuyos envíos cuestan $5.625. **Esto no es un negocio
  de reventa de envíos con 57% de margen: es software con 70-90%**, si se cobra cerca del
  mercado. La pregunta deja de ser "¿cierra la economía?" y pasa a ser "¿cuánto de esa brecha
  capturo?" → §7.1.
- 🔴 **El incumbente NO es un tercero: es Tiendanube.** Compró Perfit en diciembre de 2023 y
  hoy es **Marketing Nube (ex Perfit)**, producto oficial, con **4,7★ sobre 337 reseñas**. El
  riesgo que este archivo anotaba como futuro —"si TN saca su propio email marketing se cierra
  el canal"— **ya ocurrió hace más de dos años**, y las versiones anteriores lo daban por
  pendiente mirando a Doppler, que es el competidor equivocado.
- **Precio PROPUESTO —Bruno todavía no lo confirmó—: $19.900 / $59.900 / $149.900**, con
  $14.900 de lanzamiento para los primeros 15 clientes por 3 meses → §6.4. Es la mitad de la
  alternativa más barata que tiene un comerciante de Tiendanube y un cuarto de lo que cobra
  Marketing Nube.
- **Publicar en la App Store no cuesta el 30%** (§6.7) — pero ahora cuesta algo peor:
  **competir contra el dueño del local, adentro del local**, con él controlando ranking,
  ubicación y la homologación que hay que pedirle. ⇒ **La venta directa por GTM deja de ser el
  atajo y pasa a ser la estrategia**: es la única vía que no depende de la empresa dueña de tu
  competidor → §7.7.
- **Lo que frena no es Tiendanube ni la infraestructura: es que el producto no es
  multi-inquilino.** Un comerciante que instala **no puede mandar un mail** (no hay alta de
  dominio autoservicio), la supresión de rebotes cruza cuentas y el import de CSV se
  auto-declara consentido → `TIENDANUBE-PUBLICACION.md` §3.
- El costo que importa sigue sin ser la infraestructura: es **la reputación de envío
  compartida entre inquilinos** y **el soporte de onboarding de dominio**, que hoy es una hora
  de Bruno por cliente y no aparece en ninguna tabla → §4.4.

---

## 2. Objetivos

*(Inferidos de la conversación del 25-jul-2026.)*

| # | Objetivo | Cómo se mide |
|---|---|---|
| O1 | Dejar de pagar la herramienta actual de email marketing | Baja del gasto de >USD 150/mes |
| O2 | Controlar el canal: segmentar con datos propios de Tiendanube que la herramienta actual no ve | Campañas segmentadas por compra/producto/marca |
| O3 | Convertirlo en producto vendible a comerciantes de Tiendanube | Ingreso recurrente mensual |
| O4 | No poner en riesgo lo que ya está en producción (Resorty, mails de BDI/Zattia) | Cero incidentes por recursos compartidos |

O1 y O2 se logran solos. **O3 depende de O4**: hoy el SaaS y la operación propia comparten
base de datos y reputación de envío.

⚠️ **O3 decía "vendible en la App Store de Tiendanube" hasta el 2-ago.** Se corrigió a "a
comerciantes de Tiendanube": la App Store es un canal posible, no el objetivo, desde que se
supo que su dueña es también la dueña del competidor (§7.1).

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

### 4.0 Los parámetros fiscales — sin esto, todos los números de abajo mienten

Fijados el 2-ago-2026 con los datos de Bruno. **Todo se paga y se cobra por el monotributo.**

| Parámetro | Valor | Por qué |
|---|---|---|
| Tipo de cambio | **$1.550** | El que usa Bruno |
| Recargo de la tarjeta | **×1,51** | 21% de IVA que un monotributista **no computa** + 30% de percepción de Ganancias sobre todo pago a proveedor del exterior |
| Costo de cobranza | **7,5%** | MP 4,99% + IVA sobre la comisión (tampoco se recupera) = 6,04%, más hasta 1,5% de IIBB por SIRTAC |

⚠️ **El ×1,51 hay que confirmarlo mirando el resumen de la tarjeta**: si al lado del cargo de
AWS, Vercel o Neon figura una línea de percepción, aplica. Si AWS factura desde su entidad
argentina, ese cargo lleva IVA pero **no** percepción, y el costo por mail baja de $0,375 a
$0,30 — un 25% menos, que se propaga a todos los márgenes de este archivo. La percepción de
Ganancias además es **recuperable por trámite**; se cuenta como costo hasta que alguien lo haga.

Ver [[project_resorty_cobranza]] en la memoria: la misma carga fiscal es la que descartó Paddle.

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

### 4.2 Costos fijos — 🔴 el piso estaba contado DOS VECES

Hasta el 1-ago este archivo le cargaba al mailer un piso propio de **USD 27** (Vercel 20 +
Neon 5 + dominio 2) y `areben-popups/MODELO-DE-NEGOCIO.md` le cargaba a Resorty uno de
**USD 41** (Vercel 20 + Neon 19 + 2). **Es el mismo asiento de Vercel y la misma instancia de
Neon.** El piso de los dos juntos no es 68.

| Concepto | USD/mes | ARS/mes (×1.550×1,51) | Nota |
|---|---|---|---|
| Vercel Pro | **20** | $46.810 | Se cobra **por asiento**: un solo USD 20 cubre los 4 proyectos del team |
| Neon | **~19** | $44.470 | Una instancia. La mantiene despierta el widget de Resorty, que le pega en cada pageview |
| Dominios | ~4 | $9.360 | Mailer + Resorty |
| GitHub Actions (cron) | 0 – 7 | $0 – 16.380 | Repo privado: 2.000 min/mes gratis, mínimo 1 min por corrida. Cada 15 min = 2.880 min. Hoy GitHub throttlea a ~1/hora y zafa |
| SES IP dedicada *(opcional)* | 15 | $34.900 | + $0,02-0,08/1k. Recién con volumen y varios inquilinos |
| **Piso combo mailer + Resorty** | **~45** | **≈ $105.000** | Sin IP dedicada |

🔑 **La consecuencia: el piso marginal del mailer es casi cero.** Resorty ya paga Vercel y ya
mantiene Neon despierta. Lo único que el mailer suma de verdad es el variable de SES. ⚠️ Si se
corrige el número de un lado, **hay que corregirlo del otro** o vuelve la doble contabilidad.

### 4.3 Precios de proveedores de envío (verificados 25-jul-2026)

| Proveedor | USD/1.000 | ARS por mail | Estructura |
|---|---|---|---|
| Elastic Email (pay-as-you-go) | **0,09** | $0,211 | Sin cargo fijo. Starter $19/50k = $0,38/1k |
| SES à la carte | **0,10** | $0,234 | Sin cargo fijo. Se cambia de plan desde la consola |
| SES Essentials *(el plan actual)* | **0,16** | **$0,375** | Sin cargo fijo. Incluye Virtual Deliverability Manager |
| Resend | **0,90** | $2,106 | $20/50k · $35/100k · overage $0,90/1k |
| MailerSend | **0,90** | $2,106 | $28/50k · overage $0,90/1k |

**El costo de un mail hoy es $0,375** ($375 el mil). Sin percepción sería $0,30.

📌 **Decisión que está sobre la mesa y nunca se miró: pasar SES a *à la carte*.** Baja el mail
de $0,375 a $0,234 ⇒ **$13.300/mes de ahorro solo con el uso propio**, ~$160.000 al año. Lo que
se pierde es el Virtual Deliverability Manager. Con Outlook ya mandando a spam por reputación
del dominio ([[project_mailer_deliverability_outlook]]), puede que valga los $13.300 — pero es
una decisión que hay que tomar, no un default.

**Umbral de decisión:** con el precio de §6.4 y el cupo de §6.4, el equilibrio del plan de
entrada está en **$0,40 por mail**. SES y Elastic Email entran cómodos; Resend, a $2,11 por
mail, **no cierra a ningún precio de mercado** y por eso el SaaS con Resend no existe.

### 4.4 El costo que no está en ninguna tabla: el onboarding de dominio

Hoy **un comerciante que instala no puede mandar un mail**: `crearRemitente` escribe una fila
pero no da de alta el dominio en SES ni muestra los CNAME de DKIM — eso lo corre Bruno a mano
con `scripts/ses-verify-domain.ts`. Entre explicarle el DNS a alguien que no sabe qué es un
CNAME, esperar propagación y volver a mirar, es **una hora larga por cliente**.

| Si la hora de Bruno vale | Meses de margen del Emprendedor | Del valor de vida del cliente |
|---|---|---|
| $15.000 | 1,1 | 7% |
| $30.000 | 2,2 | 14% |
| $60.000 | 4,4 | 27% |

Contra $13.726 de contribución mensual (§6.4) y vida media de 16 meses (6% de rotación).

🔴 **Mientras esto lo haga Bruno a mano, el tramo de entrada no cierra por más prolijo que sea
el precio.** Las dos salidas: construir el alta autoservicio —que hace falta igual para vender
directo, así que no es trabajo extra— o cobrar una implementación por única vez, que además
filtra curiosos. Es el bloqueante #10 de §10.

---

## 5. Escenario A — uso propio (BDI + Zattia + Stunned)

**Supuesto:** 4 campañas/mes a lista completa = **94.592 envíos/mes**. *(Confirmar la
frecuencia real.)*

| Concepto | ARS/mes |
|---|---|
| SES Essentials (94.592 × $0,375) | **$35.472** |
| Neon compute + almacenamiento | $450 |
| Vercel memoria + CPU + invocaciones | $400 |
| **Marginal del uso propio** | **≈ $36.300** |
| Piso compartido (§4.2) | $105.000 |
| **Total si se le imputara el piso entero** | **≈ $141.300** |

🔑 **El número honesto es $36.300, no $141.300**: el piso ya se paga por Resorty, que está en
vivo en tres tiendas. Lo que cuesta reemplazar la herramienta actual es el marginal.

Pasando SES a *à la carte* el variable baja a **$22.100** (−$13.300/mes). A escala SaaS la
diferencia se multiplica — ver §4.3.

**Si SES no se destraba:** Resend plan de $35 (100k) → total ~USD 56/mes. Sigue ahorrando
>USD 95/mes. **Para uso propio el proyecto cierra con cualquier proveedor.**

---

## 6. Escenario B — SaaS vendido a comerciantes de Tiendanube

### 6.1 Costo por comerciante

A 5 envíos por contacto por mes, que es un comerciante activo (y más o menos lo que va a usar BDI).

| Perfil | Contactos | Envíos/mes | Costo real (ARS) |
|---|---|---|---|
| Chico | 1.000 | 5.000 | **$1.873** |
| Mediano | 2.500 | 12.500 | **$4.681** |
| Grande | 10.000 | 50.000 | **$18.725** |
| Muy grande | 30.000 | 150.000 | **$56.175** |

### 6.2 Punto de equilibrio

⚠️ Las versiones anteriores usaban **5% de comisión de cobro**; el número real es **7,5%**
(§4.0), y la tabla de §6.7 directamente no restaba ninguna comisión.

Con los precios de §6.4 y el piso combo de $105.000:

| Cómo se llega al piso | Contribución c/u | Clientes |
|---|---|---|
| Solo Emprendedores ($19.900) | $13.726 | **8** |
| Solo Tienda ($59.900) | $36.682 | **3** |
| Combo Resorty + Emprendedor ($39.900) | $32.226 | **4** |

**4 clientes del combo pagan toda la infraestructura de las dos apps.** Antes este archivo decía
5 comerciantes a USD 10; el número cambió porque cambiaron el piso, la comisión y el precio.

### 6.3 Sensibilidad — dónde se rompe el "ilimitado"

El punto donde la contribución del plan se hace cero, a $0,375 por mail y 7,5% de cobranza:

| Plan | Precio | Se rompe a los | = envíos por contacto/mes |
|---|---|---|---|
| Emprendedor | $19.900 | 49.200 | **19,7** |
| Tienda | $59.900 | 147.900 | **14,8** |
| Pro | $149.900 | 370.300 | **12,3** |

🔑 **Esto invierte la conclusión de julio.** El archivo decía que "no conviene copiar el modelo
de Perfit/Doppler" de envíos ilimitados. A los precios de julio (USD 9-10) era cierto: se rompía
a los 14,7 por contacto y hacía falta un cupo defensivo. **A los precios de §6.4 el ilimitado
entra cómodo**, y eso importa porque los dos competidores lo ofrecen: con cupo, la oferta se ve
peor en la única línea que el comerciante compara además del precio. Va **"ilimitado" con tope
de uso justo escrito en los términos (15 por contacto al mes)**, que es lo que hacen todos.

⚠️ Lo que **no** cambia: con un puñado de clientes no existe la ley de los grandes números. A
Marketing Nube el que manda todos los días se le promedia contra miles que mandan una vez al
mes; con 5 clientes, uno pesado **es** el margen. Por eso el tope de uso justo va escrito desde
el día uno, aunque no se aplique nunca.

### 6.4 Modelo de precio — ⚠️ PROPUESTA, todavía sin confirmar por Bruno

> Reemplaza la tabla en dólares del 25-jul. **La diferencia con aquella no es que se
> tradujo: es que ahora está anclada en los precios medidos de la competencia (§7.1) y no
> en una referencia inventada.** Sigue sin estar validada con un solo cliente.

**Por contactos, con envíos ilimitados y tope de uso justo.** Es como te comparan, y a este
nivel de precio el ilimitado entra cómodo (§6.3).

| Plan | Contactos | Precio | Costo envíos | Cobranza | Contribución | Margen |
|---|---|---|---|---|---|---|
| Prueba | 500 | **$0** | $749 | — | −$749 | adquisición |
| Emprendedor | 2.500 | **$19.900** | $4.681 | $1.493 | $13.726 | **69%** |
| Tienda | 10.000 | **$59.900** | $18.725 | $4.493 | $36.682 | **61%** |
| Pro | 30.000 | **$149.900** | $56.175 | $11.243 | $82.482 | **55%** |

**Lanzamiento: $14.900 los primeros 15 clientes por 3 meses**, con el precio pleno publicado
desde el día uno. Mismo mecanismo que ya se usó en Resorty, y por el mismo motivo: MP deja
cambiar el monto de una suscripción activa sin reautorización **pero le manda un mail al
cliente**, y un aumento que no estaba escrito de antes se lee como carnada
([[project_resorty_cobranza]]).

**Las tres razones para NO bajar de $19.900** — Bruno propuso $14.900 buscando inserción:

1. **El piso contra el que hay que verse barato es Doppler con el 35% de TN: $40.897** a 2.500
   contactos. A $19.900 el comerciante ya ahorra la mitad. **El que no se muda por 51% tampoco
   se muda por 74%**; esos $5.000 por cliente por mes se regalan a cambio de nada.
2. 🔴 **Un precio cinco veces abajo del mercado no lee como barato: lee como que no sirve.** Te
   está entregando su lista de clientes — ahí la desconfianza sale más cara que el descuento.
3. **El precio más alto compra aguante cambiario.** Con el dólar 60% arriba, a $14.900 el
   Emprendedor queda en 42% de margen; a $19.900, en 55%. Los $5.000 son, en buena medida, el
   seguro de cambio del plan (§6.6).

**Excedente: $1.200 cada 1.000 envíos** (3,2× el costo). **Paquetes sueltos** para el
estacional —el que manda en Hot Sale y en Navidad y nada en febrero—: 10.000 envíos a $16.900 y
50.000 a $69.900. 🔴 **Con vencimiento a 6 meses**: un crédito sin vencimiento en Argentina es
una posición corta en dólares, porque cobrás hoy y entregás el costo con el dólar de dentro de
ocho meses.

### 6.5 El combo con Resorty — el descuento NO sale de los envíos

| Paquete | Suelto | Combo | Descuento |
|---|---|---|---|
| Resorty + Emprendedor | $44.800 | **$39.900** | $4.900 |
| Resorty + Tienda | $84.800 | **$79.900** | $4.900 |

🔑 **El descuento sale íntegro del margen de Resorty**, cuyo costo marginal por comerciante son
centavos, y no toca el costo de SES. Descontar envíos es descontar el único costo variable real
que hay — y encima los primeros envíos son los que le pagás a un cliente que todavía puede irse
en el mes 2.

⛔ **El mailer suelto nunca más barato que el del combo.** Si "envío solo" sale menos, se
canibaliza el paquete que es justamente la tesis del negocio (§7.5).

### 6.6 Qué pasa si se mueve el dólar

Es la diferencia estructural con Resorty y la razón por la que no se puede copiar su esquema:
**Resorty aguanta un precio en pesos sin indexar porque su costo marginal son centavos; el del
mailer está en dólares y escala con el uso.**

| Dólar | Emprendedor | Tienda | Pro |
|---|---|---|---|
| $1.550 *(hoy)* | 69% | 61% | 55% |
| $2.015 *(+30%)* | 62% | 52% | 44% |
| $2.480 *(+60%)* | 55% | 43% | 33% |
| $3.100 *(+100%)* | 45% | 30% | 18% |

Un año se aguanta; dos no. El que se licúa primero es el tramo grande, que es el que más cuesta
conseguir. ⚠️ **El precio en pesos no se indexa solo**: sin que alguien lo toque, se vende por
debajo sin haberlo decidido.

### 6.7 Cómo se cobra — RESPUESTA DE TIENDANUBE (27-jul-2026)

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

**Lo que costaría** (sobre los precios de §6.4). ⚠️ La versión anterior de esta tabla estaba
mal: la columna "cobrando por afuera" **no restaba ninguna comisión de cobro**.

| Plan | Precio | Contribución por afuera (−7,5% MP) | Contribución con TN 30% | Margen |
|---|---|---|---|---|
| Emprendedor | $19.900 | $13.726 | $9.249 | 69% → 46% |
| Tienda | $59.900 | $36.682 | $23.205 | 61% → 39% |
| Pro | $149.900 | $82.482 | $48.755 | 55% → 33% |

En los planes baratos la comisión **pesa más que todo el costo de envío**: en Emprendedor son
$5.970 de comisión contra $4.681 de SES, y el equilibrio de §6.2 pasaría de 8 comerciantes a 12.
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

### 7.1 Lo que hay hoy — MEDIDO el 2-ago-2026

El email marketing para e-commerce es una categoría **madura y muy poblada a nivel global**
(Mailchimp, Klaviyo, Omnisend, Brevo) y **con jugadores locales fuertes en Argentina**. No hay
ningún hueco de producto: todo lo que hace el mailer ya existe en algún lado, mejor hecho.

#### 🔴 Perfit es Tiendanube

**Tiendanube compró Perfit en diciembre de 2023.** Hoy la app se llama **Marketing Nube (ex
Perfit)** y es producto oficial de la plataforma, no una app de terceros.

| Señal | Marketing Nube (ex Perfit) | Doppler |
|---|---|---|
| Reseñas en la App Store de TN | **4,7 ★ sobre 337** | 3,4 ★ sobre 25 |
| Quién es | **El dueño de la plataforma** | Tercero |
| Descuento a comercios de TN | — | 35% |

**Esto corrige dos cosas que este archivo venía diciendo mal:**

1. El argumento de §7.1 hasta el 1-ago era *"un incumbente con 25 reseñas y 3,4 estrellas no es
   una posición dominante ⇒ la oportunidad es el canal"*. **Miraba al competidor equivocado.**
   El que manda tiene 4,7★ y 337 reseñas, y es el dueño del local.
2. El riesgo que §9 anotaba como futuro —*"si TN saca su propio email marketing, se cierra el
   canal"*— **ya ocurrió hace más de dos años**.

#### Los precios, en pesos

Verificados dos veces: en la página pública de Perfit **y contra el panel de compra de la cuenta
real de Nuby**, que dan idénticos ⇒ el precio de lista es el precio real, no hay descuento oculto
para comercios. Todos con **envíos ilimitados**.

| Contactos | Marketing Nube | Doppler | Doppler −35% TN | Propuesta §6.4 |
|---|---|---|---|---|
| 500 | $15.096 | $17.977 | $11.685 | — |
| 1.000 | $30.192 | — | — | — |
| 2.000 | $60.384 | — | — | — |
| **2.500** | **$75.480** | **$62.919** | **$40.897** | **$19.900** |
| 4.000 | $100.640 | — | — | — |
| **10.000** | **$163.540** | **$165.388** | **$107.502** | **$59.900** |

⚠️ **Perfit publica con impuestos incluidos; Doppler sin impuestos** y en valores que él mismo
llama aproximados ⇒ su columna lleva el 21% sumado por nosotros. Doppler descuenta además 5/15/25%
por comprometerse a 3/6/12 meses (a 2.500 contactos, el anual son $38.999 sin IVA) y tiene 50%
por 6 meses en el tramo de entrada para quien nunca tuvo plan pago.
📌 **Falta confirmar cómo se aplica el 35% de TN** (¿sobre el mensual, sobre el anual, se acumula
con el 50%?). De eso depende si el piso real es $40.897 o $47.189.

#### 🔑 El hallazgo que da vuelta el análisis

**Marketing Nube factura $75.480/mes por 3.000 contactos.** A 5 envíos por contacto son 15.000
mails, que cuestan **$5.625**. El mercado local cobra **entre 9 y 16 veces el costo de mandar**.

**Este archivo venía tratando al rubro como reventa de envíos con margen ajustado** (§7.2 decía
"57-67% está por debajo del SaaS típico"). Con los precios a la vista, no lo es: **es software
con 70-90% de margen** para quien cobra precio de mercado. La pregunta deja de ser "¿cierra la
economía?" y pasa a ser **"¿cuánto de esa brecha capturo?"**.

#### ¿Somos competitivos para entrar?

| Dimensión | Respuesta |
|---|---|
| **Precio** | ✅ **Sí, con margen de sobra.** 74% abajo de Marketing Nube y la mitad de la alternativa más barata. Y **la queja nº 1 en las reseñas de Marketing Nube es el precio que escala con la lista** — de 3.000 a 4.000 contactos la factura salta de $75.480 a $100.640 sin que el comerciante haga nada distinto. Ese salto es la puerta de entrada, y no hay que adivinarlo: está escrito en la ficha de la app |
| **Canal** | 🔴 **No, y peor que lo que decía este archivo.** Publicar es competir contra el dueño del local, adentro del local, con él controlando ranking, ubicación y la homologación que hay que pedirle |
| **Producto** | 🔴 **Todavía no.** Marketing Nube está adentro del panel, con instalación de un clic y 337 comerciantes que lo recomiendan. Acá hay 24 mails enviados en total, sin alta de dominio autoservicio, con la supresión cruzando cuentas y el CSV auto-consentido |

⚠️ **Entrar con producto a medio hacer Y precio muy barato es la peor combinación posible**:
confirma la sospecha de que barato es sinónimo de que no sirve. El orden de §10 —terminar los
envíos propios, cerrar las fugas, después vender— **no se puede saltear apoyándose en el precio**.

### 7.2 Por qué el margen alto no es la ventaja que parece

⚠️ **Corregido el 2-ago:** la versión anterior decía que 57-67% "está por debajo del SaaS típico"
y concluía que esto es reventa de envíos. Con los precios medidos de §7.1, el rubro corre al
90%+ y **la restricción no es el margen posible, es cuánto se anima uno a cobrar**. Lo que
sigue valiendo es todo lo demás, que es lo que de verdad decide:

- El margen de §6.4 es **antes de trabajo humano**. Con una contribución de $13.726/mes, **una
  hora de onboarding se come de 1 a 4 meses de esa cuenta** (§4.4), y hoy cada alta necesita
  una hora de Bruno cargando DKIM a mano.
- El número absoluto es chico: 50 Emprendedores dejan **~$581.000/mes** después del piso — unos
  USD 375. Esto recién se parece a un negocio en el orden de los **cientos** de comerciantes, y
  eso es un problema de distribución, no de software.
- **Y la distribución ahora la controla el competidor**, que es el dueño de la plataforma
  (§7.1). Es el cambio más importante respecto de todas las versiones anteriores de este
  archivo.

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
  muda: es de los pocos SaaS donde la retención no depende de seguir gustando mes a mes.
  🔴 **Pero corregido el 2-ago: hoy eso juega EN CONTRA.** "El que entra primero en cada tienda
  se queda con esa tienda" se escribió imaginando tiendas vacías; **Marketing Nube ya entró
  primero en muchísimas y es el default de la plataforma** (§7.1). No se trata de ocupar, se
  trata de **desalojar** — que necesita una razón más grande que "soy más barato", y la única
  medida es la queja de precio de sus propias reseñas.
- **El precio que escala con la lista es el punto blando del incumbente**, y está documentado
  por sus propios clientes en la ficha de la App Store. No hay que adivinar dónde duele.
- **Dogfooding**: se usa en tres tiendas propias antes de vendérselo a nadie.
- **Resorty como canal — pero todavía es una apuesta, no un activo.** ⚠️ Al 25-jul-2026
  Resorty **no está publicado en la App Store**: está en vivo en Zattia (tienda propia)
  instalado por GTM, y no tiene clientes externos. El argumento de "canal de distribución
  propio" vale **cuando** Resorty esté publicado e instalado en tiendas ajenas; hoy es el
  plan, no el punto de partida. Ver §7.6, que es donde está el problema.
- 🔑 **El combo captura + envío es lo único que NO compite de frente con el dueño del local.**
  Marketing Nube trabaja la lista que el comerciante ya tiene; **Resorty la construye**. Ese es
  el pedazo donde no se pelea contra Tiendanube, es el que ya está funcionando y midiendo venta
  atribuida, y ninguno de los incumbentes locales lo ofrece integrado. Es la parte de la tesis
  que sobrevive intacta al hallazgo de §7.1.
- **Los datos de Tiendanube** (productos, pedidos, comportamiento) permiten segmentación que
  una herramienta genérica conectada por integración no tiene con la misma fidelidad.

### 7.5 Conclusión de esta sección

Es posible, pero **no por ser simple ni por el margen**. El modelo de negocio es claro y
conocido justamente porque muchos ya lo hicieron. La versión defendible de esta apuesta no
es "otro email marketing barato", sino **el paquete Resorty + mailer vendido a comerciantes de
Tiendanube que ya confían en la primera app**.

⚠️ **Corregido el 2-ago:** hasta ayer esta línea decía "vendido **dentro de** Tiendanube".
Sabiendo que Tiendanube es dueña del competidor (§7.1), la preposición importa: **el paquete se
vende a comerciantes de Tiendanube, por afuera de su App Store**. La distribución propia deja de
ser una comodidad y pasa a ser lo único que no está en manos del rival.

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
| Cobro | **Elegís**: TN cobra y retiene 30%, **o cobrás vos con el 100%** (§6.7) | Facturación propia, 100% |
| Riesgo de plataforma | 🔴 **Muy alto: el dueño de la plataforma ES tu competidor** (§7.1) | Bajo |

Lo importante es que **ya no es "mientras tanto"**: la venta directa es un camino completo y
permanente, con el 100% del ingreso y cero dependencia del calendario de Tiendanube.

⚠️ **Y las dos no son excluyentes.** Como la modalidad de *cobros externos* deja el 100%, la
App Store no cuesta margen: cuesta **homologación, mantenimiento del trámite y riesgo de
plataforma** — y, para Resorty, la reescritura a NubeSDK (al mailer eso no lo toca).

🔴 **Actualizado el 2-ago: el argumento para no publicar dejó de ser solo "no hay tracción".**
Sabiendo que Tiendanube es dueña de Marketing Nube (§7.1), publicar es **competir contra el
dueño del local, adentro del local**, con él decidiendo ranking, ubicación, bundling — y
otorgando la homologación que hay que pedirle. El 30% nunca fue el problema; esto sí.

⇒ **La venta directa por GTM deja de ser "el atajo mientras tanto" y pasa a ser la estrategia.**
Es el único camino que no depende de la empresa dueña de tu competidor, y ya está probado en
Zattia (GTM-P5B8T7QV), sin fecha de corte y sin homologación.

**Recomendación**: vender directo, y tratar a la App Store como un canal secundario que se
evalúa **cuando haya clientes pagos y producto multi-inquilino** (§10) — no como el objetivo.
Cinco tiendas conseguidas a mano valen más que una ficha bien puesta en la vidriera del rival.

⚠️ Pero ojo con el orden: **vender directo adelanta los blanqueos de infraestructura**. Vercel
sigue en Hobby, que prohíbe uso comercial, y Neon en Free compartido con Resorty en vivo
(§10). Antes del primer peso cobrado, eso se arregla.

---

## 8. Planes A, B y C

> ✅ **Resuelto: SES quedó aprobado el 29-jul-2026** (50k/día). Estamos en el Plan A y los
> planes B y C quedan como registro de las alternativas evaluadas — B sigue siendo la red de
> seguridad real, porque Resend está activo en el plan free y es lo que se usó para medir el
> inbox de Outlook.

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
| ~~**Cómo se cobra una app paga está sin documentar**~~ ✅ **RESUELTO 27-jul-2026** | — | Tres modalidades, y **cobros externos deja el 100%** → §6.7 |
| **Soporte de onboarding de dominio** | Cada comerciante que no sabe cargar DKIM es un ticket. Es el costo oculto grande del SaaS, y no aparece en ninguna tabla de arriba | Asistente guiado por proveedor de DNS; detección automática de registros |
| **El motor nunca mandó un blast** | 24 envíos reales en total al 1-ago. Publicar expone comerciantes ajenos a un camino que no se probó a volumen | Terminar los tramos propios (BDI T01-T06, Zattia) antes de vender |
| **Descalce cambiario** | Ingresos en ARS, costo variable 100% en USD. Con el dólar 60% arriba el tramo Tienda pasa de 61% a 43% de margen (§6.6) | Precio pleno publicado desde el día uno para poder actualizarlo sin que se lea como carnada; paquetes de envíos con vencimiento a 6 meses |
| 🔴 **~~Concentración en Tiendanube~~ YA OCURRIÓ** | Esto figuraba como riesgo futuro: *"si TN saca su propio email marketing, se cierra el canal"*. **TN compró Perfit en diciembre de 2023** y es Marketing Nube, 4,7★ sobre 337 reseñas (§7.1). El canal oficial es hoy la vidriera del competidor | Venta directa por GTM, que no pasa por la App Store. Y apoyarse en el combo con Resorty, que es la parte que TN **no** ofrece (§7.4) |
| **El costo del onboarding de dominio** | Una hora de Bruno por cliente: de 1 a 4 meses del margen de esa cuenta (§4.4) | Alta de dominio autoservicio (#10), o implementación cobrada aparte |

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
| 8 | Definir cómo se cobra | ✅ §6.7 — cobros externos deja el 100% | — | — |
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
5. **Publicar, si conviene**: webhooks de LGPD dados de alta (#6), legales (#14), scopes (#15),
   homologación. **Marcada "Gratis con cobros externos"** salvo que se mida que el 30% se
   paga solo en conversión.

🔴 **El paso 5 dejó de ser el objetivo (2-ago-2026).** La versión anterior decía que la App
Store "no compite con la venta directa: es adquisición casi gratis". Sabiendo que **Tiendanube
es dueña de Marketing Nube** (§7.1), la vidriera es del competidor: él decide el ranking, la
ubicación y la homologación. **Los pasos 1 a 4 no cambian** —son los mismos para las dos vías—
pero el 5 pasa de "el plan" a "una opción a evaluar con clientes pagos en la mano".

---

## 11. Supuestos a validar

Todo lo que sigue lo puso Claude en el análisis, no está medido:

- 4 campañas/mes a lista completa (uso propio)
- 25% de apertura, 3% de clic — afectan solo al 2% no-SES del costo
- **5 envíos por contacto por mes** como uso de un comerciante activo (§6.1). Es el supuesto
  que define el margen de todos los tramos; conviene probárselo primero a BDI
- 6% de churn mensual ⇒ vida media de 16 meses, que es lo que sostiene la tabla de §4.4
- **Los precios de §6.4 son propuesta y Bruno todavía no los confirmó.** Lo que sí está medido
  son los de la competencia (§7.1)

Y lo que dejó de ser supuesto:

- ✅ **Tipo de cambio 1.550 y todo por el monotributo** — dato de Bruno, 2-ago-2026
- ✅ **7,5% de comisión de cobro**, no 5% (§4.0)
- ✅ **Precios de la competencia**, verificados en las páginas públicas y contra el panel real
  de la cuenta de Nuby
- ✅ **~170 ms por email** (mediana entre envíos consecutivos, n=5 sobre los 24 envíos reales).
  El supuesto era 250 ms; la diferencia no mueve nada porque es el 2% no-SES del costo
- ⏳ **El ×1,51 de la tarjeta sigue sin confirmarse** contra un resumen (§4.0). Es el supuesto
  con más consecuencias que queda: mueve el costo por mail un 25%

---

## 12. Fuentes

Consultadas el 25-jul-2026:

- [SES pricing](https://aws.amazon.com/ses/pricing/) · [SES quotas](https://docs.aws.amazon.com/ses/latest/dg/quotas.html)
- [Vercel pricing](https://vercel.com/pricing) · [Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing)
- [Neon pricing](https://neon.com/pricing)
- [Resend pricing](https://resend.com/pricing) · [MailerSend pricing](https://www.mailersend.com/pricing) · [Elastic Email pricing](https://elasticemail.com/email-api-pricing)
- [Doppler precios](https://www.fromdoppler.com/en/pricing/) · [Doppler en la App Store de Tiendanube](https://www.tiendanube.com/tienda-aplicaciones-nube/doppler)
- [Tiendanube Partners](https://www.tiendanube.com/blog/tiendanube-partners/)

Consultadas el 2-ago-2026, para §7.1:

- [Perfit — planes y precios](https://www.perfit.com/es/precios) *(precios en ARS con impuestos
  incluidos; verificados además contra el panel de compra de la cuenta real de Nuby)*
- [Doppler — Plan Premium, calculadora por contactos](https://www.fromdoppler.com/es/precios-plan-premium/)
  *(en ARS, **sin** impuestos, valores que Doppler llama aproximados)*
- [Marketing Nube (ex Perfit) en la App Store de Tiendanube](https://www.tiendanube.com/tienda-aplicaciones-nube/perfit)
  — 4,7★ sobre 337 reseñas
- [El Economista — Tiendanube adquiere Perfit](https://eleconomista.com.ar/tech/tiendanube-adquiere-perfit-potenciar-ventas-eficiencia-campanas-marketing-su-plataforma-n69046)
  · [Canal-AR](https://www.canal-ar.com.ar/31421-Tiendanube-adquiere-Perfit-y-se-sumerge-en-el-Marketing-Automation.html)
  — la adquisición, anunciada en diciembre de 2023
