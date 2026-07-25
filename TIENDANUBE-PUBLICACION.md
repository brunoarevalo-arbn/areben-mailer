# Publicar areben-mailer en la App Store de Tiendanube

> Investigación hecha el **25-jul-2026** sobre la documentación oficial
> (`dev.tiendanube.com/docs`). Este archivo resume lo que aplica al **mailer**;
> el análisis completo, con la parte de Resorty, está en
> `~/.claude/plans/synchronous-crafting-teacup.md`.

## Resumen en una línea

**El mailer está bastante mejor parado que Resorty para publicarse**: como no pone nada
dentro de la tienda (manda mails y usa la API), **el cambio obligatorio a NubeSDK no lo
afecta** y no tiene ninguna fecha límite encima. Lo que falta es andamiaje conocido y
acotado: OAuth público, webhooks obligatorios y la homologación.

---

## 1. El cambio grande que NO nos afecta (pero conviene conocer)

Tiendanube está migrando todas las apps que renderizan algo en la tienda a **NubeSDK**: el
código corre en un **Web Worker aislado, sin acceso al DOM** (nada de `document`, `window`,
jQuery) y la UI se declara en **slots predefinidos**.

Cronograma oficial:

| Fecha | Qué pasa |
|---|---|
| 5-jun-2026 | NubeSDK obligatorio **en homologación**: sin él no se aprueba ninguna app nueva. |
| 30-ago-2026 | Se **bloquean las nuevas instalaciones** de apps sin SDK. |
| 30-oct-2026 | **Deprecación y desinstalación progresiva** de las apps sin SDK. |

**Por qué no nos toca**: el mailer no inyecta scripts en el storefront. Si algún día se suma
un formulario de suscripción embebido en la tienda, ahí sí entra el SDK — y con las
limitaciones de los slots.

⚠️ A Resorty **sí** lo toca de lleno (su widget son ~884 líneas manipulando el DOM).

---

## 2. Lo que sí hay que construir

### 2.1 OAuth público + alta automática de la tienda

Hoy las tiendas se dan de alta a mano. Una app de la App Store se instala sola:

1. El comerciante entra a `https://www.tiendanube.com/apps/{app_id}/authorize`.
2. Vuelve a **nuestra URL de redirección** con un `code` (vale **5 minutos**).
3. `POST https://www.tiendanube.com/apps/authorize/token` con `client_id`, `client_secret`
   y `code` → devuelve `access_token`, `token_type`, `scope` y `user_id` (el id de la tienda).
4. Con eso hay que **crear la cuenta sola** y dejarla lista para usar.

### 2.2 Scopes mínimos

Pedir permisos de más es **motivo de rechazo** en homologación. Hay que revisar los scopes
actuales y dejar solo los que el mailer realmente usa.

### 2.3 Webhooks obligatorios (los cuatro)

- `store/redact` — borrar los datos del comerciante.
- `customers/redact` — borrar los datos de un consumidor.
- `customers/data_request` — reportar qué datos de un consumidor tenemos.
- `app/uninstalled` — enterarnos de la desinstalación.

Para un email marketing esto pesa más que para cualquier otra app: **guardamos contactos**.
Hay que poder **exportar y borrar** los datos de una persona a pedido, de verdad, no de
palabra. Hoy no existe ninguno de los cuatro endpoints.

### 2.4 Homologación

Para apps de marketing, Tiendanube **instala la app en tiendas internas y la prueba** a mano,
con un ciclo iterativo de ajustes hasta aprobar (a diferencia de ERPs, pagos o envíos, que
piden videos de demostración).

### 2.5 Diseño y textos

El mailer es una **app externa** (panel propio, fuera del admin), así que no necesita Nimbus
ni Nexo — eso rige para las apps embebidas en el administrador. Igual se evalúa:

- Páginas de **estado vacío/inicial** y de **error**.
- **Responsividad** (obligatoria).
- **Nomenclatura, tono de voz y UX writing** de Tiendanube.

### 2.6 Publicación

Después de aprobar la homologación llega un mail con instrucciones: mandar los **artefactos**
y completar **"Datos de Publicación"** en el Partner Panel (URLs, contacto y el *handle* de la
app).

---

## 3. Bloqueantes propios del mailer

1. **SES sigue en sandbox** (caso AWS `178473604500639`). Una app de email marketing publicada
   no puede depender de un remitente que solo entrega a `@bdiaccesorios.com.ar`. **Esto hay
   que resolverlo antes de publicar**, no después.
2. **La app OAuth está compartida con Resorty**: hoy los dos proyectos usan el mismo
   `TN_CLIENT_ID` / `TN_CLIENT_SECRET`. Para publicarlas por separado, **cada una necesita su
   propia app** en el panel de Partners, con su handle, sus scopes y su ficha.

---

## 4. Preguntas abiertas para Tiendanube

Ninguna de las dos la responde la documentación:

1. **¿Cómo se cobra una app paga?** No aparece documentada una API de billing/suscripciones
   para partners tecnológicos.
2. (De Resorty, pero conviene preguntarlo junto) Un script que **el propio comerciante** pega
   en Códigos externos o inyecta por GTM, ¿entra en el bloqueo de "apps privadas que inyectan
   scripts"?

---

## 5. Orden sugerido

1. Preguntar lo del cobro a Tiendanube (define si el modelo de negocio es viable ahí).
2. Sacar SES del sandbox.
3. App propia en Partners + OAuth callback con alta automática de la tienda.
4. Los cuatro webhooks + revisión de scopes.
5. Estados vacío/error y repaso de textos.
6. Homologación → artefactos → Datos de Publicación.
