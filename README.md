# Convite (Círculos) — Natilleras, cadenas y círculos solidarios sobre Open Payments

Miembros de un círculo (en Medellín, EE. UU., España o donde estén) aportan **en su propia moneda** (`COP`, `USD`, etc.) y reciben entregas o repartos en su billetera local. Todos ven el libro auditable al instante, las salidas requieren **aprobación proporcional del grupo** (50 %, mayoría, 2/3 o unanimidad, sin que el beneficiario vote su propia entrega) y la reputación colectiva del círculo se calcula del libro de Convite a partir de los aportes confirmados (sin ML ni scoring individual). Un aporte queda «confirmado» cuando la billetera acepta crear el pago saliente; la app no consulta la liquidación final en la red (ver [límites conocidos](AI_USAGE.md#33-límites-que-el-equipo-reconoce)).

## Demo pregrabada (43 s)
Un pago de punta a punta: solicitud, autorización, ejecución y éxito, con subtítulos en español e inglés.
- Ver el video: [docs/demo/convite-demo-pago.mp4](https://github.com/jjzm0521/LASCAUX/blob/main/docs/demo/convite-demo-pago.mp4)
- Descarga directa: [convite-demo-pago.mp4](https://github.com/jjzm0521/LASCAUX/raw/main/docs/demo/convite-demo-pago.mp4)

## Tres modalidades culturales (Contrato v2)
- **Cadena (`cadena`):** Monto fijo por ronda definido al crear el círculo; recibe una persona por ronda según su orden de turno cuando todos aportaron, avanzando automáticamente a la siguiente ronda.
- **Natillera (`natillera`):** Aporte libre en cada ronda, visualización en tiempo real de la participación proporcional de cada miembro (*"Así se repartiría hoy"*) y cierre de ciclo aprobado por el grupo que genera los pagos de reparto exactos (con aritmética `BigInt` y residuo asignado al mayor aportante).
- **Círculo solidario (`circulo`):** Aporte libre y solicitud de ayudas emergentes con monto (`<= saldo libre`) y motivo, aprobadas por el grupo.

## Flujo bidireccional en Open Payments (`src/openPayments.ts`)
1. **Aportes hacia la caja (`startPayment` — monto fijo a recibir):**
   `incoming payment` en la billetera de la caja con `incomingAmount` fijo → `quote` en la billetera del miembro fijando `receiveAmount` → `grant` interactivo GNAP limitado a `quote.debitAmount` → el miembro autoriza en su billetera → callback con verificación de hash (`timingSafeEqual`) y guarda de expiración → `outgoing payment` → aporte confirmado en el libro.
2. **Entregas y repartos desde la caja (`startPayout` — monto fijo a debitar):**
   Una vez alcanzado el umbral de aprobaciones del grupo (`status = 'approved'`), se habilita **"Enviar la entrega"**: crea un `incoming payment` abierto (sin monto fijo) en la billetera del miembro beneficiario → `quote` en la billetera de la caja fijando `debitAmount` (para descontar exactamente el monto aprobado sin descuadrar la caja por tipo de cambio) → `grant` interactivo GNAP → **quien administra la billetera de la caja (tesorero/a del grupo) autoriza en su Test Wallet** → `outgoing payment` → entrega pagada (`paid`) con comprobante y tasa de cambio implícita.

## Gobernanza de doble llave y no custodia (honestidad regulatoria)
Convite **coordina, no custodia fondos**: no recibe ni administra el dinero del grupo. La billetera de la caja (`pot_wallet`) pertenece a quien el grupo designe como tesorero/a en una entidad proveedora de cuentas (ASE) compatible con Open Payments:
- **Llave 1 (Consenso social, regla de la app):** La app bloquea cualquier intento de desembolso hasta que el porcentaje requerido de miembros (excluyendo a quien recibe) apruebe la solicitud en el libro. Es una regla que la app muestra y exige, no un candado criptográfico: el titular de la billetera de la caja podría mover los fondos por fuera de Convite.
- **Llave 2 (Autorización GNAP):** Convite nunca posee las credenciales de sesión de la caja; al pulsar *"Enviar la entrega"*, el servidor de autorización de la billetera de la caja exige el consentimiento interactivo de su titular.

**Alcance regulatorio:** este proyecto es un prototipo de hackatón y no pretende cumplir ni sustituir la regulación aplicable. Para producción habría que revisar con asesoría legal, entre otras, la financiación colaborativa (Decreto 1357/2018) —una operación con custodia o préstamos requeriría una entidad vigilada— y la protección de datos personales (régimen general de la Ley 1581/2012 y, para datos financieros y crediticios, la Ley 1266/2008 de habeas data). Ver [Referencias](#referencias).

## Arrancar y variables de entorno (`.env`)
1. Crea cuentas de prueba en https://wallet.interledger-test.dev (billeteras en distintas monedas, p. ej. `COP` y `USD`, más la billetera que actuará como caja del círculo).
2. En la cuenta que firmará las solicitudes como cliente Open Payments: Settings → Developer Keys → genera clave; guarda `private.key` en la raíz y configura `KEY_ID`.
3. `cp .env.example .env` y revisa las variables de entorno:
   - `WALLET_ADDRESS_URL`, `KEY_ID`, `PRIVATE_KEY_PATH`: credenciales de la billetera cliente que firma las peticiones Open Payments.
   - `DB_PATH`: ruta al archivo SQLite de la base de datos (por defecto `./circulos.db`; puedes usar otra ruta o `:memory:` en pruebas).
   - `BASE_URL` y `PORT`: URL base para los callbacks de autorización (`http://localhost:3000` por defecto) y puerto del servidor (`3000`).
   - `POT_WALLET`, `WALLET_CO`, `WALLET_US`, `WALLET_CO2`, `CIRCLE_KIND`: billeteras y modalidad inicial usadas por `npm run seed`.
   - `ALLOWED_WALLET_HOSTS`: dominios permitidos al agregar billeteras de miembros (por defecto `.interledger-test.dev`).
4. `npm install && npm run seed && npm run dev` → http://localhost:3000/?circle=1

## Instalación automática
Con Node.js 22 o superior instalado (recomendado: Node 24), ejecuta desde la raíz. **Nota para Windows:** `better-sqlite3` incluye código nativo; si no hay binario precompilado para tu versión de Node, `npm` intenta compilarlo y necesita Visual Studio Build Tools con la carga «Desktop development with C++». Si la instalación falla con errores de `node-gyp`, instala esas herramientas o usa Node 22 LTS (ver `.nvmrc`).

```sh
npm run setup
```

Instala las versiones del lockfile, crea `.env` sin sobrescribir uno existente y ejecuta la revisión de tipos (`npm run typecheck`). También puedes correr las pruebas de contrato y hash offline con `npm run op:test` y la auditoría de contraste WCAG 2.2 con `node scripts/contraste.mjs`.

## Evidencia y Wallets para la demo
- Consulta [WALLETS.md](WALLETS.md) para la configuración de pagos en ambos sentidos (`COP ↔ USD`) tanto de aportes como de entregas desde la caja.
- Revisa [docs/open-payments-evidence.md](docs/open-payments-evidence.md) y [docs/contrato-api-v2.md](docs/contrato-api-v2.md) para la evidencia real de ejecución en testnet y el contrato completo de producto.
- El ejemplo oficial independiente está en [examples/peer-to-peer](examples/peer-to-peer/README.md).

## Documentación del proyecto
- [AI_USAGE.md](AI_USAGE.md): uso de IA por rol, qué se validó y límites conocidos. Las sesiones completas están en [prompts/](prompts/).
- [docs/contrato-api-v2.md](docs/contrato-api-v2.md): contrato de producto y API entre los roles.
- [docs/open-payments-walkthrough.md](docs/open-payments-walkthrough.md): guía de lectura de `src/openPayments.ts`.
- [docs/open-payments-evidence.md](docs/open-payments-evidence.md) y [docs/payment-ui-handoff.md](docs/payment-ui-handoff.md): evidencia de pagos reales, errores y tiempos medidos para la interfaz.
- [docs/demo-ui-20261016/RESULTADOS.md](docs/demo-ui-20261016/RESULTADOS.md): ensayo de la interfaz con capturas.
- [public/guia.html](public/guia.html): guía visual del sistema de diseño (se abre con la app en marcha, `/guia.html`).
- [PLAN.md](PLAN.md): plan inicial del equipo (histórico).

## Referencias
- Open Payments: [montos y escalas](https://openpayments.dev/concepts/amounts/), [cotizaciones](https://openpayments.dev/sdk/quote-create/) y [verificación del hash de interacción](https://openpayments.dev/identity/hash-verification/) (SHA-256 en Base64 sin relleno; la app compara ambas variantes).
- [Rafiki: tipos de cambio](https://rafiki.dev/es/integration/requirements/exchange-rates/) y [código de la Test Wallet](https://github.com/interledger/testnet) (el servicio de grants comprueba que la billetera pertenezca a quien autoriza: [`grant/service.ts`](https://github.com/interledger/testnet/blob/main/packages/wallet/backend/src/grant/service.ts)).
- GNAP: [RFC 9635](https://www.rfc-editor.org/rfc/rfc9635).
- Contexto colombiano: [Círculos Solidarios de la Corporación Fomentamos](https://www.elcolombiano.com/historico/circulos_solidarios_garrote_al_pagadiario-NDEC_118151) y [Decreto 1357 de 2018 (financiación colaborativa)](https://www.garrigues.com/es_ES/noticia/el-ministerio-de-hacienda-de-colombia-expidio-el-decreto-que-regula-la-actividad-de). Esto no es asesoría legal; verifica los textos oficiales.

## Licencia y créditos
- Código de Convite: licencia ISC, ver [LICENSE](LICENSE).
- [examples/peer-to-peer](examples/peer-to-peer/README.md): adaptado del ejemplo de Interledger (`open-payments-node`), bajo Apache-2.0 (licencia incluida en esa carpeta).
- Tipografía Figtree (`public/fonts/`): Erik Kennedy, bajo SIL Open Font License 1.1; conserva su aviso de licencia al redistribuirla.
