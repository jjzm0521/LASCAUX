# Convite (Círculos) — Natilleras, cadenas y círculos solidarios sobre Open Payments

Miembros de un círculo (en Medellín, EE. UU., España o donde estén) aportan **en su propia moneda** (`COP`, `USD`, etc.) y reciben entregas o repartos en su billetera local. Todos ven el libro auditable al instante, las salidas requieren **aprobación proporcional del grupo** (50 %, mayoría, 2/3 o unanimidad, sin que el beneficiario vote su propia entrega) y la reputación colectiva del círculo se calcula directamente de los pagos confirmados en la red (sin ML ni scoring individual).

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
Convite **coordina, no custodia fondos** (cumpliendo el límite del Decreto 1357/2018 y Ley 1266/2008 de habeas data). La billetera de la caja (`pot_wallet`) pertenece a quien el grupo designe como tesorero/a en una entidad proveedora de cuentas (ASE) compatible con Open Payments:
- **Llave 1 (Consenso social):** La app bloquea cualquier intento de desembolso hasta que el porcentaje requerido de miembros (excluyendo a quien recibe) apruebe la solicitud en el libro.
- **Llave 2 (Autorización criptográfica GNAP):** Convite nunca posee las credenciales de sesión de la caja; al pulsar *"Enviar la entrega"*, el servidor de autorización de la billetera de la caja exige el consentimiento interactivo de su titular.

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
Con Node.js 22 o superior instalado (recomendado: Node 24), ejecuta desde la raíz:

```sh
npm run setup
```

Instala las versiones del lockfile, crea `.env` sin sobrescribir uno existente y ejecuta la revisión de tipos (`npm run typecheck`). También puedes correr las pruebas de contrato y hash offline con `npm run op:test` y la auditoría de contraste WCAG 2.2 con `node scripts/contraste.mjs`.

## Evidencia y Wallets para la demo
- Consulta [WALLETS.md](WALLETS.md) para la configuración de pagos en ambos sentidos (`COP ↔ USD`) tanto de aportes como de entregas desde la caja.
- Revisa [docs/open-payments-evidence.md](docs/open-payments-evidence.md) y [docs/contrato-api-v2.md](docs/contrato-api-v2.md) para la evidencia real de ejecución en testnet y el contrato completo de producto.
- El ejemplo oficial independiente está en [examples/peer-to-peer](examples/peer-to-peer/README.md).
