# Wallets de prueba para LAUCAUX

| Persona ficticia (nombre público) | Cuenta en la Test Wallet | Dirección Open Payments | Moneda |
|---|---|---|---|
| Juan Pérez | Emisor | https://ilp.interledger-test.dev/emisor_op | COP |
| Sofía Ramírez | Receptor | https://ilp.interledger-test.dev/receptor_op | USD |

Ambas direcciones pueden enviar y recibir. Los nombres Emisor y Receptor de las cuentas no limitan sus funciones. No se crearon cuentas adicionales.

## Cómo integrarlas en la aplicación

El servidor firma con la clave de desarrollador de Juan. Esa identidad de cliente puede solicitar pagos desde cualquiera de las dos wallets: el dueño de la wallet de origen debe autorizar el permiso interactivo en cada caso. No se necesita intercambiar las claves privadas para invertir el sentido del pago.

Configuración local del servidor (el .env ya está preparado; KEY_ID y PRIVATE_KEY_PATH permanecen solo allí):

```dotenv
WALLET_ADDRESS_URL=https://ilp.interledger-test.dev/emisor_op
POT_WALLET=https://ilp.interledger-test.dev/receptor_op
WALLET_CO=https://ilp.interledger-test.dev/emisor_op
WALLET_US=https://ilp.interledger-test.dev/receptor_op
DB_PATH=./circulos.db
```

En `src/openPayments.ts`, los aportes usan `startPayment` (monto fijo a recibir en la caja) y las entregas usan `startPayout` (monto fijo a debitar de la caja):

```ts
// Aporte: Juan envía desde COP; la caja (Sofía) recibe exactamente 1.00 USD (escala 2).
await startPayment({
  senderWallet: 'https://ilp.interledger-test.dev/emisor_op',
  receiverWallet: 'https://ilp.interledger-test.dev/receptor_op',
  receiveValue: '100',
  finishUri: 'http://localhost:3000/api/contributions/ID_REAL/finish',
});

// Entrega desde la caja: la caja (USD) debita exactamente 1.00 USD; el miembro recibe en COP según cotización.
await startPayout({
  potWallet: 'https://ilp.interledger-test.dev/receptor_op',
  memberWallet: 'https://ilp.interledger-test.dev/emisor_op',
  debitValue: '100',
  finishUri: 'http://localhost:3000/api/payouts/ID_REAL/finish',
});
```

Es un ejemplo de parámetros: la aplicación crea el ID real del aporte o de la entrega y persiste el estado antes del callback. La cotización determina el tipo de cambio entre las monedas de ambas billeteras.

## Probar ambos sentidos con el ejemplo independiente

Desde `examples/peer-to-peer`, copia `.env.example` a `.env`, configura la clave vigente y KEY_ID del cliente Juan, y ejecuta `npm start`.

Juan → Sofía:

```dotenv
CLIENT_WALLET_ADDRESS_URL=https://ilp.interledger-test.dev/emisor_op
SENDING_WALLET_ADDRESS_URL=https://ilp.interledger-test.dev/emisor_op
RECEIVING_WALLET_ADDRESS_URL=https://ilp.interledger-test.dev/receptor_op
```

Sofía → Juan (conserva CLIENT_WALLET_ADDRESS_URL, KEY_ID y PRIVATE_KEY_PATH):

```dotenv
SENDING_WALLET_ADDRESS_URL=https://ilp.interledger-test.dev/receptor_op
RECEIVING_WALLET_ADDRESS_URL=https://ilp.interledger-test.dev/emisor_op
```

El ejemplo oficial solicita 1000 unidades mínimas de la moneda receptora: 10 USD o 10 COP respectivamente. Deposita saldo ficticio en la cuenta que envía antes de cada prueba. Abre el enlace de autorización que imprime la terminal y acepta el pago en la wallet emisora.

## Estado actual y notas para la demo

- Se crearon y verificaron `outgoing-payments` reales en testnet en ambos sentidos (`COP → USD` y `USD → COP`), tanto para **aportes** (`startPayment` con `receiveAmount` fijo) como para **entregas desde la caja** (`startPayout` con `debitAmount` fijo e `incoming-payment` abierto). Salidas, identificadores y pruebas de rechazo/vencimiento: [docs/open-payments-evidence.md](docs/open-payments-evidence.md).
- La aplicación ejecuta el ciclo completo en la interfaz (`POST /api/circles/:id/contribute` + callback `/finish` para aportes, y `POST /api/payouts/:id/execute` + callback `/finish` para entregas y repartos de cierre de natillera), exigiendo primero el umbral de aprobación del grupo y luego la autorización interactiva GNAP del titular de la billetera correspondiente.
- En el seed por defecto, si `WALLET_US` coincide con `POT_WALLET`, los tres perfiles iniciales usan `WALLET_CO` para que ningún miembro tenga la misma billetera que la caja; para mostrar múltiples billeteras emisoras en distintas monedas durante la demo, configura una tercera billetera en `WALLET_US` o agrégala en vivo desde **"Crear mi usuario"** en la interfaz.
- Mantén `.env`, `private.key` y archivos `*.db` fuera del control de versiones.
