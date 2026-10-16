# Evidencia de Open Payments — 16 de octubre de 2026

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
- Concurrencia pendiente: la guarda que B describe como «sin conflicto con callbacks simultáneos» no reserva la fila antes del primer await. Dos callbacks pueden leer el mismo pending_json y entrar en finishPayment; la actualización condicional del expirador no evita esa carrera. Una respuesta fallida puede además sobrescribir el confirmed de la otra porque las escrituras finales son incondicionales. Pedir a B exclusión atómica del procesamiento y escrituras finales condicionadas al estado/propietario del intento. No basta con un AND status='pending' solo en la escritura final, porque el efecto remoto ya se habría intentado.

Los archivos de B no se modificaron durante esta revisión. La corrección de concurrencia sigue a cargo de B.
