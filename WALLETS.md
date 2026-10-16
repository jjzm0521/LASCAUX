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
```

En `src/openPayments.ts`, `startPayment` recibe:

```ts
// Juan envía; Sofía recibe 1 USD (escala 2).
await startPayment({
  senderWallet: 'https://ilp.interledger-test.dev/emisor_op',
  receiverWallet: 'https://ilp.interledger-test.dev/receptor_op',
  receiveValue: '100',
  finishUri: 'http://localhost:3000/api/contributions/ID_REAL/finish',
});
```

Es un ejemplo de parámetros: la aplicación crea el ID real del aporte y persiste el estado antes del callback. Para Sofía → Juan, intercambia senderWallet y receiverWallet. `receiveValue: '100'` significa entonces 1 COP. La cotización determina cuánto se descuenta al emisor según el cambio de monedas.

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

## Límites del estado actual

- Se crearon outgoing payments reales en testnet en ambos sentidos y se probó Aportar desde la app, con registro local confirmed. Salidas, identificadores y límites de esa evidencia: [docs/open-payments-evidence.md](docs/open-payments-evidence.md). No se verificó liquidación remota final.
- Desde f004f3e, el seed crea tres perfiles que comparten Emisor COP por defecto y usa Receptor USD como caja. Es una simulación con una sola wallet emisora; no demuestra tres propietarios o aprobadores independientes. Los círculos creados antes no se actualizan. No ejecutes seed repetidamente: añade nuevos círculos.
- La app coordina aportes hacia una caja. La ruta de desembolsos actual registra solicitudes y aprobaciones, pero todavía no ejecuta el pago del desembolso por Open Payments.
- La clave local configurada se compartió previamente en el chat. Reemplázala por una nueva antes de seguir utilizando esa identidad. No publiques .env, claves ni bases de datos.
