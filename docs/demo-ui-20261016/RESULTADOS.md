# Ensayo de la interfaz actualizada

Repo: commit `47c25eb` al comenzar; `git pull` devolvió `Already up to date.`. Fecha local: 16 de octubre de 2026, America/Bogota. No se modificó código de la aplicación durante el ensayo.

Al terminar se observaron cambios concurrentes de otro trabajo en public/app.css, public/index.html y scripts/contraste.mjs; no se editaron, descartaron ni incluyeron en los artefactos de este ensayo. Las capturas corresponden a la interfaz servida en el momento de cada prueba.

Se conservó la base habitual. Se creó una base nueva con:

```sh
DB_PATH=/tmp/laucaux-ui-20261016-fresh.db npm run seed
DB_PATH=/tmp/laucaux-ui-20261016-fresh.db PORT=3000 BASE_URL=http://localhost:3000 npm run dev
```

Seed creó circle=1. Se sustituyó el proceso anterior que ocupaba localhost:3000 por el servidor de este ensayo.

## Pago autorizado: Juan

Desde «Estoy viendo como», se seleccionó Juan y se pulsó «Pagar mi aporte». Resumen: COP 31.769,80 debitados, USD 10,00 recibidos. Se pulsó «Continuar a mi billetera», Accept en la Test Wallet y se regresó a «¡Listo! Tu aporte llegó». «Ver el libro de aportes» mostró Juan Confirmado con ambas monedas.

- Aporte 1, memberId=2, status=confirmed.
- outgoing_id: `https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/outgoing-payments/20164265-5415-4cb9-8607-7ced232c9dd0`.
- startPayment: 4538 ms; vigencia restante al devolver redirect: 299612 ms.
- expiresAt: 2026-10-17T00:14:53.281Z (19:14:53 Bogotá del 16-oct).
- Se verificaron creación de outgoing y confirmación local; no liquidación remota final.

## Rechazo: Mamá

Se usó Mamá para no repetir el aporte confirmado de Juan en la misma ronda. Se pulsó Decline en la Test Wallet. La app mostró:

> No pudimos completar tu pago
>
> El miembro rechazó el pago. No se te cobró nada.

Aporte 3, memberId=1, status=failed, outgoing_id=null, error_msg=`El miembro rechazó el pago`. El stepper marcó Autorización como Falló.

## Vencimiento: Sofía

Se usó Sofía para dejar una autorización pendiente sin cambiar datos ni reloj. Aporte 2, memberId=3. Cotización con expiresAt=2026-10-17T00:15:40.885Z (19:15:40 Bogotá del 16-oct).

A las 00:15:52 UTC, GET /api/contributions/2 devolvió status=failed y error=`La cotización venció, vuelve a intentar`. Se pulsó Accept en la billetera después de esa consulta. La testnet NO regresó al callback de la app: quedó en la ruta del servidor de autorización `/interact/.../finish` mostrando:

```json
{"error":{"code":"invalid_request","description":"invalid session"}}
```

Se guardó la captura del error real. Al volver manualmente a `http://localhost:3000/?circle=1`, el libro mostró Sofía Falló, pero no una pantalla específica con «La cotización venció». No se fabricó una URL con ?error=... para simular que ese callback ocurrió. En este primer intento el backend detectó la expiración, pero la navegación quedó atrapada en el error de sesión de testnet. Como se mantuvieron autorizaciones de dos aportes abiertas en paralelo, no se atribuye invalid session al vencimiento sin una repetición aislada.

Estado final del aporte 2: failed, outgoing_id=null. Juan continúa confirmed y el rechazo de Mamá continúa failed.

### Repetición aislada

Se inició el aporte 4 de Sofía sin ninguna otra autorización en curso. expiresAt=2026-10-17T00:21:58.365Z (19:21:58 Bogotá). No se alteraron reloj ni base de datos. Captura adicional 13-autorizacion-en-curso.png: stepper real en Autorización antes de navegar a la billetera.

Se pulsó Accept aproximadamente a las 00:22:08 UTC, después de expiresAt. Esta vez el redirect sí regresó a la app, que mostró:

> No pudimos completar tu pago
>
> La cotización venció, vuelve a intentar. No se te cobró nada.

Autorización marcada como Falló. Aporte 4: status=failed, outgoing_id=null, error_msg=`La cotización venció, vuelve a intentar`. Captura: 14-error-cotizacion-vencida.png. El flujo aislado de vencimiento PASA. La hipótesis de interferencia entre sesiones del primer intento es compatible con este resultado, pero no se verificó la causa interna de invalid session. Para el video, ejecutar una autorización a la vez.

Resultado: pago de Juan, rechazo de Mamá y vencimiento aislado de Sofía verificados con la interfaz real; los tres casos solicitados pasan. El incidente paralelo de testnet se conserva como evidencia adicional.

## Capturas

- 01-inicio-juan.png: selector en Juan, antes del aporte.
- 02-solicitud.png: stepper en Solicitud.
- 03-resumen-cop-usd.png: resumen COP → USD.
- 04-transicion-a-billetera.png y 05-billetera.png: autorización real en la Test Wallet; la navegación ocurrió antes de capturar el estado transitorio de Autorización de la app.
- 06-listo.png: resultado de éxito.
- 07-libro-confirmado.png: libro con el aporte de Juan confirmado.
- 08-resumen-para-vencer.png: cotización de Sofía antes de vencer.
- 09-resumen-rechazo.png: resumen del intento rechazado.
- 10-error-rechazo.png: error de rechazo en la app.
- 11-error-testnet-invalid-session.png: error real al autorizar después del vencimiento.
- 12-libro-tras-vencimiento.png: libro tras volver manualmente; Sofía y Mamá Falló, Juan Confirmado.
- 13-autorizacion-en-curso.png: stepper en Autorización de la repetición aislada.
- 14-error-cotizacion-vencida.png: regreso real a la app tras autorizar la cotización aislada vencida.

Las capturas no incluyen claves ni tokens. La base de prueba permanece fuera del repo.
