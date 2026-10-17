# Uso de IA

Este documento registra cómo se usaron herramientas de inteligencia artificial durante la Hackathon Interledger Open Payments (Ruta N, Medellín, 16-17 de octubre de 2026), los roles del equipo, qué validó el equipo directamente y los **prompts principales** que guiaron la arquitectura, los pagos, el backend y el sistema de diseño.

---

## 1. Resumen por herramienta y rol

- **Claude (Anthropic) y Claude Design — Ideación, Arquitectura de Contrato (`docs/contrato-api-v2.md`) y Rol C (`public/`)**:
  - Ideación del concepto ("Convite"), investigación del contexto colombiano (cadenas, natilleras, círculos solidarios de la Corporación Fomentamos, Decreto 1357/2018) y andamiaje inicial (`prompts/01-concepto-y-stack.md`).
  - Generación del sistema de diseño completo en **Claude Design** y su integración en HTML/CSS/JS plano sin frameworks (`public/tokens.css`, `public/components.css`, `public/guia.html`, `public/index.html`): tokens semánticos claro/oscuro, stepper de 4 pasos (`Solicitud → Autorización → Pago → Listo`), comprobantes verificables, vista de caja (`pot`), reparto proporcional de natillera y aprobación por proporción del grupo (`prompts/06-sistema-diseno-convite.md`).
  - Definición del contrato v2 entre roles (`docs/contrato-api-v2.md`) y estructuración narrativa del demo ("Entra, se ve, sale").
  - Herramienta exacta del Rol C: **Claude Code (Claude Sonnet 5.5)** en la app de escritorio de Claude, más Claude Design. Los mensajes literales de esa sesión están en [`prompts/07-interfaz-claude-code.md`](./prompts/07-interfaz-claude-code.md).
  - Claude Code también escribió, a pedido del usuario del Rol C y fuera de `public/`: `GET` y `POST /api/circles` y las columnas de moneda de la caja (`src/server.ts`, `src/db.ts`, commit `84175d8`), `docs/contrato-api-v2.md`, `scripts/contraste.mjs` y `scripts/lan.mjs`. El resto del backend v2 lo implementó el Rol B.

- **Codex (OpenAI) — Rol A (`src/openPayments.ts`, `scripts/`)**:
  - Incorporación del flujo oficial P2P de `@interledger/open-payments`, verificación real en ambos sentidos (`COP ↔ USD`) en la Test Wallet (`wallet.interledger-test.dev`), normalización y verificación del `hash` de `interact_ref` + `nonce`, e idempotencia del callback (`prompts/02-verificacion-open-payments.md`).
  - Traducción de errores de transporte, rechazo de cotizaciones vencidas en español, pruebas offline sin `pending` huérfano y medición de tiempos reales para la UI (`prompts/04-robustez-y-ensayo.md`, `docs/payment-ui-handoff.md`).
  - Implementación de `startPayout` para entregas reales desde la billetera de la caja hacia la billetera del miembro con cotización por monto fijo a debitar (`debitAmount`), incoming payment sin monto fijo, errores tipados (`expired | rejected | network | hash | other`), validación `uint64` y modo `--debit` en CLI (`prompts/05-entregas-reales.md`, `docs/open-payments-evidence.md`).

- **Gemini / Antigravity y Claude — Rol B (`src/db.ts`, `src/server.ts`, `src/seed.ts`)**:
  - Exposición de monedas y escalas (`assetCode`, `assetScale`) en el libro público, expiración automática de aportes y entregas colgadas (`expiresAt`), reserva atómica en SQLite (`status='processing'` / `'processing_payout'`) antes del primer `await` para evitar doble consumo de `grant.continue`, y protección SSRF al registrar billeteras (`prompts/03-backend-reglas-y-libro.md`).
  - Implementación completa del Contrato v2 (Fases 1, 2, 3 y Sección 1b): diferenciación de reglas entre `cadena` (monto fijo y turno rotativo), `natillera` (aporte libre y cierre con liquidación proporcional `shares[]` usando `BigInt`) y `circulo` (aporte libre y solicitudes de apoyo con motivo hasta `pot.free`), ejecución real de entregas (`POST /api/payouts/:id/execute` y callback `/finish`), y umbral proporcional de aprobaciones congelado por solicitud (`approval_percent`).

- **Lo que el equipo completó y validó directamente**:
  - Lectura, comprensión y prueba línea por línea de `src/openPayments.ts` (`docs/open-payments-walkthrough.md`), pruebas de pagos y entregas reales contra la testnet de Interledger con sesiones separadas por billetera, decisiones de producto y guion de pitch.

---

## 2. Prompts principales de las conversaciones

Los archivos completos de cada sesión se encuentran en la carpeta [`prompts/`](./prompts/). A continuación se listan los **prompts principales** que estructuraron el proyecto en cada etapa:

> **Aviso sobre los textos de abajo:** son **extractos y resúmenes** para leer rápido. Los prompts **literales y completos** están en los archivos de [`prompts/`](./prompts/); si un extracto difiere del archivo, vale el archivo. En especial, los puntos 2.3 y 2.5 mezclan varios prompts en uno, y el Prompt B del punto 2.6 es una versión abreviada.

### 2.1. Ideación y stack inicial (`prompts/01-concepto-y-stack.md`)

```text
Somos cuatro personas... círculos solidarios/natilleras/cadenas con miembros en otros países (mi mamá en EE. UU.), usando Open Payments; implementa las opciones y empieza el stack.
```

### 2.2. Verificación real de Open Payments en Testnet (`prompts/02-verificacion-open-payments.md`)

```text
Revisé tu commit 0a74ca2. Typecheck y op:test pasan, y el cambio a debitAmount, el hash normalizado y el callback idempotente están bien. Pero el commit dice "exitoso end-to-end" y en el repo no hay evidencia. Pendientes:

TUYOS (src/openPayments.ts)
1. Evidencia: pega aquí la salida completa de `npm run op:pay` con el "Outgoing payment creado: ..." (sin tokens ni llaves). Prueba los DOS sentidos: Emisor (COP) -> Receptor (USD) y Receptor (USD) -> Emisor (COP).
2. Prueba el flujo con la app, no solo con op:pay (que usa su propio servidor en el puerto 3999): `npm run seed`, `npm run dev`, botón "Aportar", autorizar en la billetera y confirmar que el aporte queda "confirmed" en el libro.
3. Cotización vencida: espera a que pase expiresAt, autoriza y dime el error real que sale. Hay que convertirlo en un mensaje claro en español ("La cotización venció, vuelve a intentar").
4. Saldo de prueba: confirma que la wallet COP alcanza para el aporte del seed (contribution=1000, que en escala 2 son 10.00 USD recibidos).
```

### 2.3. Reglas del libro, concurrencia y modelo de Círculos Solidarios (`prompts/03-backend-reglas-y-libro.md`)

```text
"Convite": app de natilleras, cadenas y círculos solidarios digitales sobre Open Payments (Interledger). Los miembros de un círculo (que ya se conocen) aportan desde su propia billetera y su propia moneda; la caja del círculo recibe un monto fijo o variable según el tipo. Todos ven el libro de aportes, los desembolsos requieren aprobaciones del grupo y la reputación del círculo se calcula del libro. La app COORDINA, NO custodia dinero.

PENDIENTES DE BACKEND (src/db.ts, src/server.ts, src/seed.ts):
1. API del libro: GET /api/circles/:id debe devolver en cada fila del ledger la moneda y escala del aporte (assetCode y assetScale del débito y del recibido), parseando debit_json, además de outgoingId y confirmedAt para el comprobante.
2. Aportes colgados: si el miembro abandona la autorización, pasar el aporte de 'pending' a 'failed' cuando venza expiresAt o cuando el mismo miembro inicie un aporte nuevo.
3. Concurrencia del callback: reserva atómica con status='processing' antes del primer await conservando pending_json durante el vuelo.
4. Endpoint POST /api/circles/:id/members con validación de billetera real en Open Payments (client.walletAddress.get), extracción de assetCode y protección SSRF (lista blanca .interledger-test.dev).
```

### 2.4. Entregas reales desde la caja (`startPayout`) (`prompts/05-entregas-reales.md`)

```text
Vamos a hacer entregas reales: pagos DESDE la caja hacia la billetera de un miembro. Hoy solo hay pagos de un miembro hacia la caja.

1. startPayout: nueva función en openPayments.ts. Origen = billetera de la caja; destino = billetera del miembro. La diferencia con startPayment: la cotización se hace por monto a DEBITAR (debitAmount), no por monto a recibir. La caja paga exactamente X en su moneda y la billetera destino recibe lo que resulte en la suya. El incoming payment en el destino va SIN monto fijo.
   - Firma sugerida: startPayout({ potWallet, memberWallet, debitValue, finishUri }) con debitValue en unidades mínimas del activo de la caja.
   - Debe devolver el mismo tipo de estado que startPayment (redirectUrl, state con debit, receive, expiresAt, nonce, etc.) para reutilizar finishPayment sin cambios.
2. Errores tipados: que los errores de startPayment, startPayout y finishPayment lleven un `code`: 'expired' | 'rejected' | 'network' | 'hash' | 'other'.
3. Aportes con monto libre: verifica que startPayment funcione con cualquier receiveValue entero positivo (uint64).
4. Pruebas REALES con las dos billeteras de prueba, en los dos sentidos y con monedas distintas (Caja USD -> Miembro COP y Caja COP -> Miembro USD).
```

### 2.5. Contrato v2: Tres tipos de círculo, caja (`pot`), cierre de natillera y aprobación proporcional (`prompts/03-backend-reglas-y-libro.md`)

```text
Implementa docs/contrato-api-v2.md por fases en src/db.ts y src/server.ts:

FASE 1 (Tipos de círculo, caja pot y aportes variables):
- Diferenciar los tres tipos: cadena (monto fijo por ronda y entrega por turno), natillera (aporte libre, nadie saca durante el año y al final se liquida en proporción a lo aportado) y círculo solidario inspirado en Corporación Fomentamos (aporte libre y solicitudes de ayuda con monto y motivo hasta pot.free).
- Conversión de montos decimales a unidades mínimas sin flotantes (BigInt) según el assetScale de la caja.
- GET /api/circles/:id agrega pot { contributed, paidOut, reserved, balance, free, shares[] } y reputación según el tipo.

FASE 2 (Ejecución real de entregas):
- POST /api/payouts/:id/execute y GET /api/payouts/:id/finish usando startPayout y finishPayment. Estados approved -> paying -> paid | failed, con una sola entrega paying por círculo y reserva atómica processing_payout.

FASE 3 y SECCIÓN 1b (Cierre de natillera y umbral proporcional de aprobación):
- POST /api/circles/:id/closing y POST /api/closings/:id/approve: crea entregas kind='reparto' según pot.shares[]; cuando todas quedan paid, pasa closing a 'done' y el círculo a 'closed'.
- Umbral proporcional de aprobación (approval_percent: 50% mitad, 67% mayoría, 100% todos): needed = min(votantes, max(1, ceil(approval_percent * votantes / 100))), donde votantes = miembros - 1 en entregas y votantes = miembros en el cierre de natillera. Congelar needed al crear la solicitud.
```

### 2.6. Sistema de diseño completo en Claude Design (`prompts/06-sistema-diseno-convite.md`)

#### Prompt A — Guía de diseño base (Design System v1)

```text
Necesito una guía de diseño completa (design system) para "Convite", una app web móvil para natilleras, cadenas y círculos solidarios digitales en Colombia. Un grupo de personas que ya se conocen aporta cada ronda un monto fijo a una caja común desde su propia billetera digital (cada una puede tener una moneda distinta). Todos ven un libro público de aportes, los desembolsos requieren varias aprobaciones, y el círculo tiene una reputación calculada del libro. La app coordina, no custodia dinero. Funciona sobre Open Payments (Interledger) con billeteras de prueba.

PÚBLICO: personas no técnicas, muchas mayores de 35 años, que usan el celular (390px de ancho es el diseño principal; escritorio es secundario). Textos en español claro y sin jerga financiera.

PERSONALIDAD: cálida, comunitaria y confiable, con solidez fintech. Esquinas redondeadas, mucho aire, tono cercano.

ENTREGABLES:
1. Marca: propón el wordmark "Convite" (y un símbolo simple que evoque reunirse en círculo), con versión clara y oscura.
2. Paleta: propón 2 alternativas de color principal y recomienda una. Para la elegida entrega escalas completas (primario, secundario/acento, neutros) y colores semánticos: éxito, advertencia, error, información, y los estados de un aporte (esperando autorización, confirmado, falló). Da los valores hex y la relación de contraste de cada par texto/fondo.
3. Modo claro y modo oscuro, ambos completos, con los mismos nombres de token.
4. Design tokens con nombres semánticos (por ejemplo --color-fondo, --color-superficie, --color-texto, --color-primario, --color-exito...), no solo nombres de color. Incluye tokens de: color, tipografía, espaciado (escala de 4px), radios, sombras/elevación, bordes, tamaños mínimos de toque (44px), duraciones de animación y z-index. Entrégalos como variables CSS (:root y [data-theme="dark"]).
5. Tipografía: una familia legible y amable (de Google Fonts, con fallback a system-ui). Escala tipográfica móvil con tamaño, peso e interlineado. Cifras tabulares para los montos.
6. Componentes con todos sus estados (normal, hover, foco, presionado, deshabilitado, cargando, error): botón primario/secundario/peligro/fantasma, tarjeta, chip de estado, fila del libro de aportes, avatar de miembro, selector "Estoy viendo como", campo de formulario, aviso/toast (éxito, error, info), diálogo de confirmación, estado vacío, y barra de progreso de aprobaciones ("1 de 2").
7. Componente stepper del flujo de pago con 4 pasos: Solicitud → Autorización → Pago → Listo. Con estados: pendiente, activo, completado, error. Es el momento más importante de la demo, debe leerse a la primera.
8. Skeletons: para tarjeta de reputación, lista de miembros, filas del libro y desembolsos. Con animación sutil que respete prefers-reduced-motion.
9. Pantallas de ejemplo a 390px en claro y oscuro: (a) Inicio del círculo (tarjeta "Tu próximo paso", reputación, miembros, libro de aportes, desembolsos), (b) Resumen antes de pagar ("Se te cobrará X en tu moneda y tu círculo recibe Y"), (c) Pago en curso con el stepper, (d) Éxito, (e) Error comprensible, (f) Estado de carga con skeletons, (g) Estado vacío.
10. Accesibilidad (WCAG 2.2 AA): contraste mínimo 4.5:1 en texto y 3:1 en componentes, anillo de foco visible, objetivos de 44px, no depender solo del color (los estados llevan ícono y texto), soporte de prefers-reduced-motion y de zoom del texto al 200%, lectura por lector de pantalla (roles ARIA sugeridos para stepper, toasts y barra de progreso).
11. Microcopy: 10 ejemplos de textos del producto en tono cálido y claro (botones, errores, estados vacíos, confirmaciones).

RESTRICCIONES TÉCNICAS: la implementación será HTML y CSS planos con JavaScript simple, SIN framework ni librerías de estilos. Por eso todo debe poder expresarse con variables CSS y clases simples. Íconos como SVG en línea. Sin imágenes pesadas.

FORMATO DE SALIDA: la guía visual navegable, y aparte un bloque de CSS con todos los tokens listo para copiar, más una lista de los componentes con el nombre de clase sugerido.
```

#### Prompt B — Ampliación del diseño para Tipos de Círculo, Caja, Entregas Reales y Cierre (`prompts/06-sistema-diseno-convite.md`)

```text
Amplía el sistema de diseño "Convite" manteniendo los mismos tokens, prefijo cv-, nomenclatura BEM en español, modo claro y oscuro, 390px primero y WCAG 2.2 AA:

1. Tipos de círculo, aporte libre y la caja:
   - TipoCirculo: tarjetas seleccionables para elegir Cadena, Natillera o Círculo solidario (cómo se aporta y cómo se recibe) y variante chip.
   - PantallaCrearCirculo, PantallaCirculos y PantallaQuien ("¿Quién eres en este círculo?" + "Crear mi usuario" con validación de billetera).
   - CampoMonto y PantallaAporteLibre ("¿Cuánto vas a aportar?") para natillera y círculo solidario.
   - ResumenCaja ("La caja": saldo, Aportado, Entregado, Reservado y Libre para entregar) y PartesCaja ("Así se repartiría hoy" con porcentaje y monto proporcional por persona).

2. Entregas reales desde la caja:
   - EstadoEntrega y TarjetaEntrega con estados Pedida -> Aprobada -> Enviando -> Entregada | Falló, barra de aprobaciones por proporción del grupo y botón "Enviar la entrega" ("La autoriza quien tiene la billetera de la caja").
   - StepperEntrega (Solicitud -> Autorización de la caja -> Envío -> Listo), PantallaEntregaResumen ("Sale de la caja X / Recibe Y en su moneda") y ComprobanteEntrega verificable.

3. Rondas y cierre de natillera:
   - TarjetaRonda ("Abrir la ronda siguiente"), PantallaProponerCierre, TarjetaCierre (progreso de envíos por persona) y PantallaCierreCompleto.
```

---

## 3. Qué se validó, qué no y límites conocidos

### 3.1. Verificado con pruebas (corridas por las herramientas de IA)
- `npm run typecheck` y `npm run op:test` en verde (hash, URLs, cotización vencida y errores de red sin conexión).
- Pagos reales en la Test Wallet con `npm run op:pay`, en ambos sentidos y también en modo entrega (`--debit`), documentados en `docs/open-payments-evidence.md` (Rol A).
- Interfaz probada en móvil, escritorio, modo claro y oscuro contra el backend real con una base temporal, y el flujo de aportes libres, entregas, cierre de natillera, cadena y círculo solidario con **billeteras simuladas** (Rol C y Rol B).
- Contraste de 28 pares de color de los tokens (`node scripts/contraste.mjs`).

### 3.2. Por confirmar por una persona del equipo 
- [X] Un aporte real desde la interfaz contra la testnet, de punta a punta (el equipo lo ensayó el 16 de octubre; falta ensayar con la versión final).
- [X] Una entrega real desde la interfaz (execute y callback) contra la testnet, no solo con `op:pay`.
- [X] El redirect de la Test Wallet hacia una IP local si se usa  `BASE_URL=http://IP:3000`.
- [X] Lector de pantalla real, «Guardar como PDF» y «Compartir» en un dispositivo.

### 3.3. Límites que el equipo reconoce
- La **caja es la billetera de una persona**: las aprobaciones del grupo son una regla que la app muestra y exige, no un candado criptográfico. El dueño de esa billetera puede mover la plata por fuera de Convite. Un candado real requiere custodia por una entidad vigilada o una cuenta con varias firmas (siguiente paso; Decreto 1357/2018).
- El saldo de la caja sale del libro de Convite; Open Payments no tiene un endpoint de saldo. Verificar cada aporte contra el pago entrante es un siguiente paso.
- «Listo» significa que la billetera aceptó enviar el pago; la liquidación final la hace la red de pagos.
- No hay autenticación (fuera de alcance): quien entra a la red local puede elegir ser cualquier miembro.
- La testnet es inestable: una autorización a la vez; con dos abiertas respondió `invalid session`.
- Intereses, préstamos, scoring individual y custodia son siguientes pasos, no funciones.
