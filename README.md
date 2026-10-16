# Círculos — natilleras y cadenas solidarias sobre Open Payments

Miembros de un círculo (Medellín, EE. UU., donde sea) aportan **en su propia moneda**; la caja recibe un monto fijo.
Todos ven el libro al instante; los desembolsos requieren M aprobaciones; la reputación del **círculo** se calcula del libro (sin ML).

## Arrancar
1. Crea cuentas de prueba en https://wallet.interledger-test.dev (una por miembro + una "caja" del círculo; idealmente en monedas distintas).
2. En la cuenta que firmará las solicitudes: Settings → Developer Keys → genera clave; guarda `private.key` aquí y el `KEY_ID`.
3. `cp .env.example .env` y completa. Opcional: `POT_WALLET`, `WALLET_US`, `WALLET_CO`, `WALLET_CO2` para el seed.
4. `npm install && npm run seed && npm run dev` → http://localhost:3000/?circle=1

## Flujo de pago (src/openPayments.ts — léanlo todos)
incoming payment (caja) → quote con monto fijo a recibir (miembro) → grant interactivo → miembro autoriza en su billetera → callback con verificación de hash → outgoing payment → aporte confirmado en el libro.

## Fuera de alcance (honestidad ante el jurado)
Producción requeriría una entidad vigilada para custodia/préstamos (Decreto 1357/2018) y cumplir habeas data (Ley 1266/2008). La app coordina; no custodia fondos.

## Prueba independiente de Open Payments

El ejemplo oficial está en [examples/peer-to-peer](examples/peer-to-peer/README.md), con su propio package.json y configuración de prueba.

## Instalación automática

Con Node.js 22 o superior instalado (recomendado: Node 24), ejecuta desde la raíz:

```sh
npm run setup
```

Instala las versiones del lockfile, crea `.env` sin sobrescribir uno existente y ejecuta la revisión de tipos. Funciona en macOS, Linux y Windows. No instala el ejemplo independiente ni ejecuta pagos. Completa las credenciales en `.env` antes de probar Open Payments.

Después, crea datos de ejemplo **una sola vez** con `npm run seed` (repetirlo añade otro círculo) y arranca con `npm run dev`.
