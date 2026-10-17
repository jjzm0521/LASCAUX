# Evidencia de Open Payments — 16 de octubre de 2026

## Entregas reales v2: débito fijo desde la caja

Se leyeron las secciones 2 y 3 de docs/contrato-api-v2.md. startPayout({ potWallet, memberWallet, debitValue, finishUri }) devuelve el mismo StartResult/PendingPayment. Incoming en destino sin incomingAmount; quote en origen con debitAmount (moneda y escala de la caja). finishPayment reutilizado sin modificar firma ni retorno; solo se agregaron códigos a los errores. Ninguna prueba de esta sección simula un outgoing remoto como si fuera real.

### Caja USD → miembro COP

Comando: `npm run op:pay -- --debit https://ilp.interledger-test.dev/receptor_op https://ilp.interledger-test.dev/emisor_op 100`.

```text
Modo: entrega (monto fijo a debitar de la caja)
1/3 Creando incoming payment, cotización y solicitud de autorización...
[OpenPayments] Entrega preparada { durationMs: 3406, quoteRemainingMs: 299636 }
    Preparación: 3408 ms.
    Se debitan 1.00 USD; el destino recibe 3176.97 COP.
    La cotización caduca: 2026-10-17T01:41:10.668Z

2/3 Abre este enlace en el navegador y autoriza el pago en la billetera que envía:
    [enlace de autorización temporal omitido]

3/3 Autorización recibida. Verificando hash y creando el outgoing payment...
    Finalización: 1842 ms.

OK. Outgoing payment creado: https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/outgoing-payments/74c5141e-f549-4785-9cd3-892a24abbb7f
Estado: en curso/completado | debitAmount: 1.00 USD | receiveAmount: 3176.97 COP
```

debit={value:"100",assetCode:"USD",assetScale:2}; receive={value:"317697",assetCode:"COP",assetScale:2}. Accept real en Test Wallet; código de salida 0. expiresAt corresponde a las 20:41:10 de Bogotá del 16-oct. El tiempo de finalización excluye el tiempo humano de autorizar.

### Caja COP → miembro USD

Comando: `npm run op:pay -- --debit https://ilp.interledger-test.dev/emisor_op https://ilp.interledger-test.dev/receptor_op 10000`.

```text
Modo: entrega (monto fijo a debitar de la caja)
1/3 Creando incoming payment, cotización y solicitud de autorización...
[OpenPayments] Entrega preparada { durationMs: 3257, quoteRemainingMs: 299551 }
    Preparación: 3259 ms.
    Se debitan 100.00 COP; el destino recibe 0.03 USD.
    La cotización caduca: 2026-10-17T01:42:34.296Z

2/3 Abre este enlace en el navegador y autoriza el pago en la billetera que envía:
    [enlace de autorización temporal omitido]

3/3 Autorización recibida. Verificando hash y creando el outgoing payment...
    Finalización: 1690 ms.

OK. Outgoing payment creado: https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/outgoing-payments/76af2572-bc00-4d31-8936-e46e115b35d2
Estado: en curso/completado | debitAmount: 100.00 COP | receiveAmount: 0.03 USD
```

debit={value:"10000",assetCode:"COP",assetScale:2}; receive={value:"3",assetCode:"USD",assetScale:2}. Accept real; código de salida 0. expiresAt corresponde a las 20:42:34 de Bogotá del 16-oct. El débito coincide exactamente con el solicitado. Creación de outgoing no equivale a liquidación remota final; no se consultó dicha liquidación.

### Rechazo real de una entrega

Mismo comando USD → COP, debitValue=100. Preparación 3784 ms (módulo 3783 ms), quoteRemainingMs=299601, debit=1.00 USD, receive=3176.97 COP, expiresAt=2026-10-17T01:43:15.282Z. Se pulsó Decline y el callback real devolvió:

```text
ERROR [rejected]: El dueño de la billetera rechazó el pago
```

Código de salida 1; no se ejecutó finishPayment ni se creó outgoing. Para B: el rechazo que llega como query result=grant_rejected ocurre en su callback, antes de llamar finishPayment; debe convertirlo explícitamente con `new PaymentError('rejected', mensajeActual)` o su propio mapeo. `paymentError(new Error('El miembro rechazó el pago'))` también devuelve code=rejected sin cambiar el texto.

### Vencimiento de una entrega

Nueva entrega USD → COP con debitValue=100, preparada en 2629 ms, quoteRemainingMs=299639; debit=1.00 USD, receive=3176.97 COP; expiresAt=2026-10-17T01:43:54.082Z (20:43:54 Bogotá). Se mantiene una sola autorización en curso para evitar invalid session por interacciones simultáneas.

Se pulsó Accept después de esa hora (aproximadamente 01:44:08 UTC / 20:44:08 Bogotá). Callback real recibido; salida del proceso:

```text
3/3 Autorización recibida. Verificando hash y creando el outgoing payment...

ERROR [expired]: La cotización venció, vuelve a intentar
```

Código de salida 1, sin Outgoing payment creado. Aunque el CLI anuncia el paso 3 completo antes de llamar a finishPayment, el guard de vencimiento corta el flujo antes de continuar el grant y crear outgoing. En este ensayo el error español y code=expired corresponden a la protección del módulo nuevo, no a una simulación offline.

Validación final: npm run typecheck, npm run op:test y git diff --check pasan. Las firmas públicas previas siguen iguales. Se preservaron los cambios concurrentes de otros roles en db.ts, seed.ts y public/; no se incorporan al commit de A.

### Quién autoriza: comprobación y límite

El grant outgoing identifica `sender.id`, que en una entrega es la wallet de la caja; lo solicita a su authServer y limita debitAmount a quote.debitAmount. La clave del cliente puede seguir siendo la de Emisor: autentica al cliente que pide permiso, no sustituye el consentimiento del dueño de Receptor.

El texto «Juan Pérez is requesting access» de la Test Wallet identifica al cliente solicitante; no prueba por sí solo quién es el dueño de la caja ni quién tiene la sesión. Se contrastó con la página Accounts y con el origen de la cotización.

Se inspeccionó la página Accounts de la sesión utilizada: Emisor COP y Receptor USD pertenecen al mismo usuario de Test Wallet. Por tanto, una sesión puede autorizar las dos; cambiar de cuenta monetaria seleccionada no es cambiar de usuario. No sería correcto afirmar que «la sesión de otra wallet» siempre es inválida: si ambas tienen el mismo dueño, es válida para ambas.

El [servicio público de grants de Test Wallet](https://github.com/interledger/testnet/blob/main/packages/wallet/backend/src/grant/service.ts) comprueba `belongsToUser(userId, identifier)` al leer y al responder una interacción. Si la wallet no pertenece a ese usuario, rechaza el grant y lanza Forbidden('NO_ACCESS'). El [frontend](https://github.com/interledger/testnet/blob/main/packages/wallet/frontend/src/pages/grant-interactions/index.tsx) redirige ese caso a /no-access. Esto es revisión del código público main, no certificación de la revisión exacta desplegada ni una prueba negativa real con otro usuario.

Se solicitó una cuenta ajena para el ensayo negativo; el usuario indicó continuar de forma independiente con las wallets conocidas y que el equipo está probando otras cuentas para el video. La negativa real con otro usuario queda para ese ensayo. No se cerró la sesión ni se pidieron/compartieron contraseñas.

### Contrato de errores y montos para B

PaymentError.code: expired | rejected | network | hash | other. Los mensajes existentes se conservan. Los errores genéricos HTTP 401/403 no se confunden con rechazo voluntario; tampoco `invalid quote` por sí solo demuestra vencimiento. Los rechazos explícitos request_denied/access_denied/grant_rejected se clasifican como rejected. Los errores originales se conservan en cause cuando se normalizan.

receiveValue/debitValue deben ser strings de enteros positivos en unidades mínimas, máximo uint64 (18446744073709551615); se usa BigInt, sin pérdida por flotantes. Se aceptan ceros iniciales y se normalizan. Se rechazan vacío, cero, negativos, decimales, exponente, espacios y desbordamiento antes de llamar a la red. Mensaje de aporte: «El monto del aporte debe ser un entero positivo en unidades mínimas»; code=other.

op:test incluye hash válido de una entrega, rechazo de hash alterado, expired sin red, los cinco códigos, flujos de receiveValue=1,17,12345 y máximo uint64 con SDK simulado, incoming sin monto en entrega, quote debit-only con moneda origen, grant limitado al débito y finishPayment reutilizado. Son pruebas offline de contrato, no pruebas de que una wallet tenga saldo para el máximo uint64.

Ensayo posterior, mediciones de tiempos, rechazo real y contrato de errores para la interfaz: [payment-ui-handoff.md](payment-ui-handoff.md). Incluye una nueva captura del aporte completo desde la app.

Ejecuciones reales desde este checkout, sin tokens ni llaves. Se omiten las URL de autorización interactivas (capacidades temporales); el resto de la salida del CLI se reproduce completo. Crear outgoing no acredita por sí solo liquidación final.

## COP → USD

```text
> circulos-op@1.0.0 op:pay
> tsx src/opPayCli.ts https://ilp.interledger-test.dev/emisor_op https://ilp.interledger-test.dev/receptor_op 1000

1/3 Creando incoming payment, cotización y solicitud de autorización...
    Se debitan 31766.58 COP; el destino recibe 10.00 USD.
    La cotización caduca: 2026-10-16T21:47:57.532Z

2/3 Abre este enlace en el navegador y autoriza el pago en la billetera que envía:

    [URL de autorización omitida]

3/3 Autorización recibida. Verificando hash y creando el outgoing payment...

OK. Outgoing payment creado: https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/outgoing-payments/c0901faa-e022-4dde-afd6-310c247c1960
Estado: en curso/completado | debitAmount: 31766.58 COP | receiveAmount: 10.00 USD
```

## USD → COP

```text
> circulos-op@1.0.0 op:pay
> tsx src/opPayCli.ts https://ilp.interledger-test.dev/receptor_op https://ilp.interledger-test.dev/emisor_op 1000

1/3 Creando incoming payment, cotización y solicitud de autorización...
    Se debitan 0.01 USD; el destino recibe 10.00 COP.
    La cotización caduca: 2026-10-16T21:48:44.423Z

2/3 Abre este enlace en el navegador y autoriza el pago en la billetera que envía:

    [URL de autorización omitida]

3/3 Autorización recibida. Verificando hash y creando el outgoing payment...

OK. Outgoing payment creado: https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/outgoing-payments/68cd47a4-377e-45a9-a8cb-9c0e2b57e643
Estado: en curso/completado | debitAmount: 0.01 USD | receiveAmount: 10.00 COP
```

## Aplicación

`npm run seed` creó el círculo 1; `npm run dev` inició localhost:3000. Se pulsó Aportar en Juan, se aceptó la confirmación de débito y se autorizó en la Test Wallet. El callback real regresó a `/?circle=1&ok=1`; la UI mostró «✔ Aporte confirmado» y «Juan (CO) · ronda 1 · recibe 10.00 · confirmed».

SQLite confirmó aporte 1, status `confirmed`, outgoing_id `https://ilp.interledger-test.dev/f537937b-7016-481b-b655-9f0d1014822c/outgoing-payments/e4842bc9-0f35-448a-918e-62a365fcfa5b`.

La wallet COP permitió crear tanto el pago CLI como el aporte del seed por 1000 unidades USD (10,00 USD), debitando 31.766,58 COP cada uno. No se consultó saldo restante. Un segundo intento en la app falló al crear incoming con `description: 'fetch failed'`; quedó `failed`.

## Coordinación inicial con B, C y D (antes de f004f3e)

No se identificaron chats de B/C/D en esta sesión; no se ha enviado ningún mensaje ni acordado cambios con ellos.

- B / seed: con dos wallets distintas, usar Juan (COP) como único aportante y Receptor (USD) como caja sin membresía sirve para una demo de aportes. No representa un círculo de tres personas ni permite demostrar desembolsos con dos aprobadores. Para ese escenario hacen falta más wallets independientes. Eliminar fallback de WALLET_CO2 y fallar claramente cuando falte configuración, en vez de sembrar una wallet ficticia. Ambas direcciones funcionan como origen y destino según las pruebas anteriores.
- B / pendientes: expirar los registros `pending` usando `pending_json.expiresAt`, pasando a `failed`; preservar registros `confirmed`. Acordar cómo tratar callbacks que llegan mientras se expiran registros.
- B y C / API: exponer `debit: { value, assetCode, assetScale }` desde debit_json y `receive: { value, assetCode, assetScale }` desde pending_json.receive. Persistir receive aparte antes de borrar pending_json al confirmar; receive_value por sí solo no permite recuperar la moneda del destino. La UI debe formatear receive con su propia escala.
- D: esta ejecución usa Codex y queda registrada en AI_USAGE.md y prompts/02-verificacion-open-payments.md.
- README.md y WALLETS.md ya estaban modificados/sin seguimiento al iniciar. Sus cambios iniciales no se atribuyen a esta ejecución. Se revisaron y se incluyen en el commit local de evidencia; no se encontraron llaves ni tokens y no se incluyen .env ni bases de datos. WALLETS se actualizó para enlazar estas pruebas. La publicación remota queda pendiente.

## Cotización vencida: error real

Se inició otro CLI con `OP_CALLBACK_PORT=3998 npm run op:pay -- https://ilp.interledger-test.dev/emisor_op https://ilp.interledger-test.dev/receptor_op 100`, con ventana de callback ampliada a diez minutos y el módulo anterior todavía cargado en ese proceso. Cotización: débito 3176.66 COP, recepción 1.00 USD, expiresAt `2026-10-16T21:52:37.332Z`. Se pulsó Accept después de esa hora (aproximadamente 21:52:40 UTC).

```text
3/3 Autorización recibida. Verificando hash y creando el outgoing payment...

ERROR: Error making Open Payments POST request invalid quote
```

Código de salida 1; no apareció Outgoing payment creado. El intento previo con espera de cinco minutos terminó en «Tiempo agotado esperando la autorización», sin llegar a probar la cotización; por eso se amplió la espera.

El módulo nuevo verifica expiresAt después de validar el hash y otra vez después de continuar el grant; rechaza con «La cotización venció, vuelve a intentar». Se comprobó offline que un callback con hash válido y cotización vencida devuelve ese mensaje sin acceder a la red, y que un hash inválido se rechaza primero. No se repitió la espera real de cinco minutos con el módulo nuevo.

Validación: `npm run typecheck`, `npm run op:test` y `git diff --check` pasan. Captura del libro: app-confirmed.png.

El usuario confirmó que B está trabajando en seed/API/expiraciones y recibió las preguntas exactas para coordinar esos cambios; aún no hay respuesta técnica ni commit de B.

## Respuesta de B verificada: f004f3e

Se recibió la respuesta de B y se contrastó con el código del commit, presente en este checkout. Typecheck y op:test pasan también sobre ese commit. No se repitieron los pagos de la evidencia anterior después de sus cambios.

- Seed: caja Receptor USD; los tres perfiles usan Emisor COP por defecto. WALLET_US se usa si difiere literalmente de POT_WALLET y WALLET_CO2 cae a WALLET_CO. Esto permite una demo con tres perfiles, pero no acredita tres dueños de wallets ni aprobadores independientes. No actualiza círculos ya sembrados. La validación de wallets debe comparar URLs normalizadas y cubrir también WALLET_CO y WALLET_CO2 para garantizar que ninguna coincida con la caja.
- Expiración: se ejecuta al leer el círculo y antes de iniciar otro aporte; no hay tarea periódica sin tráfico. Se conserva pending_json al expirar por reloj para que el callback pueda mostrar el error español. Al iniciar otro aporte, se invalidan los pending anteriores del mismo miembro/ronda.
- API para C: ledger incluye debit y receive como objetos `{ value, assetCode, assetScale }` o null. receive_json conserva el activo receptor después de confirmar. Para filas antiguas sin receive_json, solo existe fallback mientras quede pending_json; un aporte antiguo confirmed como el aporte 1 de esta evidencia puede seguir devolviendo receive=null. La UI no debe inventar moneda/escala en ese caso.
- Concurrencia (registro histórico; **resuelta después** en `8802148` y `2fe9999` con reserva atómica `status='processing'` antes del primer `await`): la guarda que B describe como «sin conflicto con callbacks simultáneos» no reserva la fila antes del primer await. Dos callbacks pueden leer el mismo pending_json y entrar en finishPayment; la actualización condicional del expirador no evita esa carrera. Una respuesta fallida puede además sobrescribir el confirmed de la otra porque las escrituras finales son incondicionales. Pedir a B exclusión atómica del procesamiento y escrituras finales condicionadas al estado/propietario del intento. No basta con un AND status='pending' solo en la escritura final, porque el efecto remoto ya se habría intentado.

Los archivos de B no se modificaron durante esta revisión. La corrección de concurrencia quedó a cargo de B y se resolvió en los commits indicados arriba.
