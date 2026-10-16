# Entrega para el stepper de pago — 16 de octubre de 2026

Se mantienen sin cambios los argumentos y retornos de startPayment/finishPayment. El módulo traduce fallos de transporte a español, conserva el error original como cause y registra duración/vida restante sin tokens, claves ni URL de autorización.

## Red y reintentos

Mensaje: **No pudimos conectar con la billetera de prueba, intenta de nuevo**.

Se detectan fetch failed, errores DNS/conexión/socket y timeout sin respuesta HTTP; también 502/503/504. No se reclasifican 400/401/403 como red ni se repite la autorización.

El SDK instalado usa ky con dos reintentos por defecto para métodos seguros como GET (no POST, y no para timeout por defecto). No se agregaron reintentos del flujo completo ni POST: si se pierde la respuesta, el incoming, quote o grant podría existir. No hay garantía de idempotencia de esas creaciones en la integración actual. Repetirlas automáticamente podría dejar recursos duplicados. Un error durante finish tampoco dispara otro outgoing automáticamente; tras un resultado remoto incierto hace falta reconciliar.

`npx tsx scripts/test-op-network.mts` prueba offline, con SDK simulado y SQLite temporal: incoming falla una vez; solo se invoca una vez; HTTP 500 devuelve el mensaje español; aporte 1 queda failed sin pending_json. Un reintento manual obtiene HTTP 200, redirectUrl y un único nuevo aporte pending. El registro failed se conserva como historial, no como un aporte abandonado. Esto no verifica limpieza de recursos remotos cuya respuesta se perdió.

## Mensajes para C: origen y grado de evidencia

| Caso | Mensaje que recibe la UI | Evidencia |
|---|---|---|
| Cotización vencida | La cotización venció, vuelve a intentar | Testnet devolvió `Error making Open Payments POST request invalid quote` al autorizar después de expiresAt; protección española probada offline. |
| Rechazo voluntario | El miembro rechazó el pago | Se pulsó Decline en la Test Wallet durante este ensayo; callback y pantalla devolvieron ese texto, aporte failed. |
| Hash inválido | Hash de interacción inválido | Probado offline con hash alterado/vacío; no es un error observado espontáneamente en un pago real. Texto alternativo para pantalla: «No pudimos verificar la autorización del pago». |
| Red | No pudimos conectar con la billetera de prueba, intenta de nuevo | Fallo real anterior: SDK message `Error making Open Payments POST request`, description `fetch failed`; mensaje nuevo y reintento comprobados con fallo inyectado. |
| Saldo insuficiente | Sin mensaje real capturado | No se observó ni se forzó saldo insuficiente. No existe aún una traducción verificada del error del proveedor para este caso; no clasificar cualquier error como falta de fondos. |
| Espera agotada del CLI | Tiempo agotado esperando la autorización | Observado en op:pay de cinco minutos. No es un mensaje de la app ni prueba de saldo insuficiente. |

## Tiempos medidos

Dos solicitudes reales desde el botón Aportar, mismo proceso de app en localhost:3198:

| Solicitud | startPayment | Vigencia restante al devolver redirectUrl |
|---|---:|---:|
| Juan, autorizado | 3976 ms | 299590 ms |
| Mamá, rechazado | 3596 ms | 299625 ms |

Son dos muestras, no un SLA. La medición empieza al entrar a startPayment, después de la validación/INSERT local; no incluye red navegador→app, render ni tiempo humano. Como texto de espera usar «Preparando la solicitud en la billetera de prueba…», sin prometer un tiempo máximo. En estas muestras la cotización tiene aproximadamente cinco minutos, pero el contador siempre debe usar expiresAt real, no cinco minutos fijos.

Mostrar «Autoriza antes de HH:MM» en la zona horaria del usuario (America/Bogota para esta demo). expiresAt puede faltar según el contrato. Si ya pasó, pedir un nuevo intento. La fecha límite corresponde a crear el outgoing, así que hay que dejar margen para el callback y procesamiento; no prometer que pulsar autorizar en el último segundo alcanza.

## Débito y recibido

Los 0.01 USD por 10.00 COP son los importes exactos devueltos por quote/outgoing en la evidencia anterior; no son un cálculo o error de formato de nuestra UI. Con USD scale=2, el menor valor positivo representable es 0.01 USD. Con el cambio aproximado inferido de COP→USD, 10 COP equivalen a menos de un centavo USD: el resultado es compatible con la granularidad del activo y el cambio/comisiones del proveedor. No se verificó el algoritmo concreto de redondeo del despliegue, por lo que no afirmar que sea exclusivamente «redondeo de la testnet» ni presentarlo como una tasa de mercado reproducible.

La UI debe mostrar debit y receive por separado, con sus propios assetCode/assetScale, tal como los entrega la cotización; no calcular una tasa de cambio con ese pago tan pequeño.

Referencias oficiales: [montos y escalas](https://openpayments.dev/concepts/amounts/), [cotizaciones](https://openpayments.dev/sdk/quote-create/), [tipos de cambio en Rafiki](https://rafiki.dev/es/integration/requirements/exchange-rates/).

## Ensayo de punta a punta

Base temporal separada `/tmp/laucaux-rehearsal-20261016-a.db`, seed nuevo y app en localhost:3198. Se pulsó Aportar en Juan, se aceptó el diálogo de la app y se autorizó en la Test Wallet. Regreso real a `/?circle=1&ok=1`, UI «✔ Aporte confirmado», libro `confirmed`.

- Aporte 1; débito 31769.80 COP; recibido 10.00 USD.
- outgoing_id: `https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/outgoing-payments/cb072fc8-1e74-47a6-9fd1-3666a941f6ac`.
- Registro creado a las 23:42:35 UTC (18:42:35 Bogotá) del 16 de octubre.
- Captura de respaldo: `app-rehearsal-20261016.png`.

Se verificó creación de outgoing y confirmación local; no se consultó liquidación remota final. El stepper debe reflejar ese significado de Listo. No hay eventos de progreso granular del SDK: startPayment prepara incoming/quote/grant antes de devolver redirectUrl; finishPayment continúa grant y crea outgoing.
