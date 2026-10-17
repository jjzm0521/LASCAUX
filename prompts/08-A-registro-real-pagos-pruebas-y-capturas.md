# Registro real de uso de IA — rol A

## 1. Herramienta, modelo y atribución

- Herramienta: Codex (OpenAI), app de escritorio; herramientas de terminal, Git y navegador mediante cua_repl.
- Modelo exacto/variante: **no consta**. La instrucción de identidad de la sesión dice «agente basado en GPT-6»; no consta un identificador más específico. No se deduce el modelo de la lista de modelos disponibles.
- Rol principal: **A, src/openPayments.ts**, con CLI, pruebas, evidencia y apoyo operativo de servidor/capturas. B corresponde a src/db.ts, src/server.ts y src/seed.ts; C a public/; D a documentos y entrega.
- Este registro describe mi ejecución en esta conversación. Los cambios comunicados por B/C y el contenido de otras sesiones no se atribuyen a mí. No se consultaron transcripciones completas de otras conversaciones: **no consta** su contenido literal completo ni la revisión humana de cada entrega.
- El commit inicial 0a74ca2 ya existía al comenzar. Revisé su flujo, hash normalizado y callback; no consta que yo haya escrito ese commit. No me atribuyo la implementación original del hash ni la reserva atómica de callbacks de B.

## 2. Fechas locales

- De **16 de octubre de 2026** a **17 de octubre de 2026**, zona America/Bogota (UTC−05:00).
- Hora exacta de inicio de la conversación y de cada mensaje humano: **no consta**.
- Commits propios corroborados: a3dcf69 (16-oct 16:53:00), 75331c6 (17:07:13), b95203d (18:45:08) y 3b456df (20:44:31), todos del 16-oct, hora Bogotá.
- Capturas nuevas con pagos reales el 17-oct: confirmaciones locales 09:08:59 y 09:27:08, contrastadas con estado del aporte e historiales. Hora de aprobación humana manual del código: **no consta**.

## 3. Mensajes del usuario: transcripción en orden

Se conservan texto, errores de dictado, formato y referencias originales. Se excluyen los bloques automáticos de entorno, fecha, estado de navegador y página abierta: no son instrucciones escritas por la persona. Se incluyen las dos respuestas humanas a preguntas asíncronas. Los pegados largos se identifican con su archivo y se abrevian con [...] como permite la solicitud. No se incorporan contenidos de archivos de credenciales ni valores de llaves o tokens; los nombres de archivos mencionados dentro de los prompts se conservan como referencias literales, no como contenidos.

### Mensaje 1

~~~~text
Imagina que eres en miembro quée acaba de hacer commint en el repo y haz esto Revisé tu commit 0a74ca2. Typecheck y op:test pasan, y el cambio a debitAmount, el hash normalizado y el callback idempotente están bien. Pero el commit dice "exitoso end-to-end" y en el repo no hay evidencia. Pendientes:

TUYOS (src/openPayments.ts)
1. Evidencia: pega aquí la salida completa de `npm run op:pay` con el "Outgoing payment creado: ..." (sin tokens ni llaves). Prueba los DOS sentidos: Emisor (COP) -> Receptor (USD) y Receptor (USD) -> Emisor (COP).
2. Prueba el flujo con la app, no solo con op:pay (que usa su propio servidor en el puerto 3999): `npm run seed`, `npm run dev`, botón "Aportar", autorizar en la billetera y confirmar que el aporte queda "confirmed" en el libro.
3. Cotización vencida: espera a que pase expiresAt, autoriza y dime el error real que sale. Hay que convertirlo en un mensaje claro en español ("La cotización venció, vuelve a intentar").
4. Saldo de prueba: confirma que la wallet COP alcanza para el aporte del seed (contribution=1000, que en escala 2 son 10.00 USD recibidos). Si no alcanza, dime qué valor sí funciona.

QUE DEBES COORDINAR CON OTROS
5. Con B (seed.ts): hay 3 miembros y solo 2 wallets de prueba, y seed.ts lee WALLET_CO2, que no existe en WALLETS.md. Además la caja (POT_WALLET) es la wallet de Sofía, que también es miembro: se pagaría a sí misma. Pónganse de acuerdo en qué miembro usa qué wallet y qué wallet es la caja. Tú sabes qué combinaciones funcionan.
6. Con B (aportes colgados): si el miembro abandona la autorización, el aporte queda "pending" para siempre. Dile a B que lo pase a "failed" cuando pase expiresAt; tú ya lo guardas en el state.
7. Con B (API): que GET /api/circles/:id devuelva assetCode y assetScale del aporte (hoy llega crudo en debit_json). C lo necesita para mostrar montos.

DOCUMENTACIÓN (requisito del evento)
8. Tu commit no actualizó AI_USAGE.md ni prompts/. Guarda tu prompt real y avísale a D, o súbelo tú. Debes poder explicar openPayments.ts línea por línea.
9. WALLETS.md y el cambio de README.md están sin commitear en un equipo. Decidan quién los sube y revisen que no tengan llaves.

Cuando tengas el punto 1, avísame: sin esa evidencia no damos el pago por probado.
~~~~

### Mensaje 2

~~~~text
continua
~~~~

### Mensaje 3 — respuesta a pregunta asíncrona

~~~~text
Ahorita B esta trabajando en eso. Dime quée le pregunto exactamente para quée tengas toda la info
~~~~

### Mensaje 4 — archivo pegado

~~~~text
Edited server.ts
Ran command: Run typecheck, op:test, and check git status (`(command -v graphify >/dev/null 2>&1 && graphify update . || true) && npm run typecheck && npm run op:test && git status --short`)
[...]
~~~~

Archivo pegado: `/Users/juanjosezapatamoreno/.codex/attachments/02a725fe-6bbf-477b-b4fa-f00643f5c65b/Texto pegado.txt`. Reporte de B sobre f004f3e; archivos referidos: src/db.ts, src/server.ts, src/seed.ts y prompts/03-backend-reglas-y-libro.md. El extracto anterior es el inicio literal del archivo, no un prompt que yo redacté.

### Mensaje 5 — registro largo pegado directamente

~~~~text
Edited server.ts
Ran command: Test concurrent callbacks, update graphify, and run typecheck (`rm -f /tmp/test-circulos.db /tmp/test-circulos.db-shm /tmp/test-circulos.db-wal && DB_PATH=/tmp/test-circulos.db PORT=3199 npx tsx -e '
[...]
~~~~

Registro pegado directamente en el mensaje, referido a `src/server.ts` y commit 2fe9999. Archivo adjunto independiente: **no consta**. Se omite el resto del comando largo, que contiene estado de prueba y valores de tokens de fixtures. No se afirma haber ejecutado ese comando de B.

### Mensaje 6 — archivo pegado

~~~~text
Edited server.ts
Ran command: Test overlapping callbacks during slow finishPayment await (`rm -f /tmp/test-circulos.db /tmp/test-circulos.db-shm /tmp/test-circulos.db-wal && DB_PATH=/tmp/test-circulos.db PORT=3199 npx tsx -e '
[...]
~~~~

Archivo pegado: `/Users/juanjosezapatamoreno/.codex/attachments/e5239c18-aad1-4283-97ef-6771b56f9c7d/Texto pegado.txt`. Reporte de B sobre 8802148, src/server.ts y latencia simulada. No se afirma haber ejecutado esos comandos pegados.

### Mensaje 7

~~~~text
Revisé tu evidencia en docs/open-payments-evidence.md: ambos sentidos y el flujo con la app están, y el mensaje de cotización vencida es claro. Voy a armar la interfaz con un stepper de pago (Solicitud -> Autorización -> Pago -> Listo), y necesito de ti:

1. ROBUSTEZ DE LA TESTNET: en la evidencia hay un `fetch failed` al crear el incoming payment en el segundo intento. Para la demo necesitamos que cualquier error de red salga con un mensaje comprensible en español ("No pudimos conectar con la billetera de prueba, intenta de nuevo") y que un reintento funcione sin dejar basura. ¿Puedes revisar si conviene un reintento automático (1 o 2 veces) en startPayment cuando falle la red, no cuando falle la autorización?
2. LISTA DE ERRORES REALES: dame los mensajes de error que ya viste y que el usuario puede encontrar (cotización vencida, pago rechazado, billetera sin fondos, hash inválido, red caída). Con eso escribo el texto de pantalla para cada caso, sin inventarlos.
3. TIEMPOS: ¿cuánto tarda startPayment (de pulsar Aportar a tener redirectUrl) y cuánto dura la cotización (expiresAt - ahora)? Lo uso para skeletons, textos de espera y el aviso "autoriza antes de las HH:MM".
4. ¿Debito vs recibe? Vimos 0.01 USD por 10.00 COP (redondeo de la testnet). Confirma si es esperado para que no se vea raro en el video.
5. ENSAYO: antes de grabar el video, hagan un aporte completo de punta a punta con la app (no solo op:pay) y guarden la captura como respaldo.
No cambies la forma de lo que devuelve startPayment/finishPayment sin avisarme.
~~~~

### Mensaje 8

~~~~text
haz esto con el sistema actualizado `git pull`, `npm run seed` (base nueva) y `npm run dev`.

1. Abre `http://localhost:3000/?circle=1`, elige a Juan en “Estoy viendo como” y pulsa **Pagar mi aporte**.
2. Revisa el resumen (COP → USD), pulsa **Continuar a mi billetera**, autoriza y confirma que vuelve a “¡Listo!” con el aporte en el libro.
3. Prueba también **rechazar** el pago y **dejar vencer** la cotización. Ahí deben salir los textos de error.
4. Haz una captura de cada pantalla. Sirven de respaldo para el video.

Si algo falla, pégame el error y lo arreglo.
~~~~

### Mensaje 9

~~~~text
Puedes abrirlo como servidor para que los demas del equipo loprueben y vayan probando los cambios?
~~~~

### Mensaje 10

~~~~text
reinicia el servidor para ver los cambios
~~~~

### Mensaje 11

~~~~text
A, lee docs/contrato-api-v2.md (secciones 2 y 3). Vamos a hacer entregas reales: pagos DESDE la caja hacia la billetera de un miembro. Hoy solo hay pagos de un miembro hacia la caja.

1. startPayout: nueva función en openPayments.ts. Origen = billetera de la caja; destino = billetera del miembro. La diferencia con startPayment: la cotización se hace por monto a DEBITAR (debitAmount), no por monto a recibir. La caja paga exactamente X en su moneda y la billetera destino recibe lo que resulte en la suya. El incoming payment en el destino va SIN monto fijo.
   - Firma sugerida: startPayout({ potWallet, memberWallet, debitValue, finishUri }) con debitValue en unidades mínimas del activo de la caja.
   - Debe devolver el mismo tipo de estado que startPayment (redirectUrl, state con debit, receive, expiresAt, nonce, etc.) para reutilizar finishPayment sin cambios. Si finishPayment necesita algo distinto, avísame y lo acordamos.
2. Errores tipados: que los errores de startPayment, startPayout y finishPayment lleven un `code`: 'expired' | 'rejected' | 'network' | 'hash' | 'other'. B arma el mensaje en español según el contexto (aporte o entrega). Mantén los mensajes actuales.
3. Aportes con monto libre: verifica que startPayment funcione con cualquier receiveValue entero positivo (hoy B pasa siempre el fijo). Valida que sea un entero positivo y lanza un error claro si no.
4. Pruebas REALES con las dos billeteras de prueba, en los dos sentidos y con monedas distintas:
   - Caja USD (receptor_op) paga a un miembro COP (emisor_op).
   - Caja COP (emisor_op) paga a un miembro USD (receptor_op).
   - Anota en docs/open-payments-evidence.md: debit, receive, expiresAt, tiempos y el outgoing id. Prueba también rechazo y cotización vencida en una entrega.
   - Extiende npm run op:pay con un modo para entrega (por ejemplo --debit), para probar sin la app.
5. Verifica y deja escrito: quién tiene que autorizar la entrega. Debe ser el dueño de la billetera de la caja (el que tiene la sesión de esa Test Wallet). Confirma que la autorización de una billetera NO se puede hacer con la sesión de otra.
6. Prueba offline: agrega a op:test un caso del hash y de errores tipados.
7. No cambies las firmas de startPayment y finishPayment ya existentes. Corre npm run typecheck y npm run op:test, guarda tu prompt en prompts/ y avísame el commit.
~~~~

### Mensaje 12 — respuesta a pregunta asíncrona

~~~~text
Sí, sí las tengo, pero pruébese prueba con las que sabes que funcionan, pues que las tenemos nosotros, porque pues para que seas independiente de eso. Sin embargo, ahorita pues es que lo tenemos con unas wallets diferentes para probar que sí funcionen con otras cuentas y que funcione tenga toda la funcionalidad para el momento en que también hagamos el el video.
~~~~

### Mensaje 13

~~~~text
Puedes encender el servidor? 
~~~~

### Mensaje 14

~~~~text
Como hago para abrirla desde el cel 
~~~~

### Mensaje 15

~~~~text
Necesito esto si ya lo tienes damelo si no pasamelo La carpeta `proyectos/hackathon-convite/recursos/grabaciones-reales/` ya existe y está vacía. Dentro dejé un `LEEME.md` con lo que hay que capturar.

**Qué capturar**, del mismo pago COP → USD que sale en el video:

- `juan-antes` y `juan-despues`: la billetera de Juan (COP). Que se vea el saldo y, si hay, el historial con el pago saliente.
- `caja-antes` y `caja-despues`: la billetera que recibe (la caja, USD). Que se vea el saldo y, si hay, el pago entrante de USD 10,00.

**Cómo hacerlo**

- Haz las capturas antes de pagar y después, para que se note el cambio.
- Sirven PNG o una grabación corta (MOV o MP4).
- Evita que salgan contraseñas, claves o tu correo.

Cuando estén ahí, avísame. Con ellas cambio el tramo de «libro y comprobante» por «se refleja en Interledger», para que la demo siga en unos 40 s. Si algo no se ve claro (por ejemplo, un saldo que no cambia), te lo digo en vez de forzarlo.
~~~~

### Mensaje 16

~~~~text
el editor me dice esto Para que quede con el mismo formato, hay un problema que cambia el plan: **no se puede repetir la misma cifra**. La pantalla de Accept solo aparece mientras el permiso está pendiente (unos 5 min), y la cotización cambia en cada intento. El pago de 31.750,27 ya pasó, así que esa pantalla ya no existe. Pegar el texto yo mismo sobre otra captura sería falsear justo lo que Interledger pide ver, así que no lo haría.

**Lo que sí sirve:** un pago nuevo y completo, con todas las capturas del mismo intento. Yo actualizo las cifras del video a ese pago. Son ocho pantallas, en este orden:

1. `juan-antes`: saldo de Juan antes de pagar.
2. `caja-antes`: saldo de la caja antes de pagar.
3. `pago-resumen`: «Revisa tu aporte» en Convite, con la cifra de ese pago.
4. **`wallet-accept`**: la pantalla de Accept, con «Juan Pérez is requesting access to COP …».
5. `pago-listo`: «¡Listo! Tu aporte llegó».
6. `juan-despues`: saldo de Juan después.
7. `caja-despues`: saldo de la caja después.
8. `juan-movimiento` y `caja-movimiento`: «Transaction Details» de cada billetera, abiertos desde el historial.

**Para el mismo formato**

- Haz las capturas del mismo modo que las anteriores de saldo y movimiento: ancho **723 px**, con la ventana angosta (la vista de celular de la Test Wallet), no pantalla completa.
- La de Accept debe verse igual que la de `05-billetera.png`: el logo y la ilustración arriba, la línea de petición completa y los botones Accept y Decline. No pulses Accept hasta tener el pantallazo.
- Usa **una sola autorización a la vez**: no abras otra solicitud mientras tanto.
- Que no salgan contraseñas, claves ni tu correo.
- Déjalas en `grabaciones-reales/`, en una subcarpeta nueva `toma-2/`, con esos nombres.
- Anota el resultado de «Transaction Details» como en la `TOMA-2026-10-17.md` anterior. Si el saldo en USD vuelve a no cuadrar al centavo, lo muestro tal cual y no digo que cuadra.

Cuando estén, actualizo la demo con la pantalla de Accept completa, con tu nombre y tu cifra, sin tapar nada.&#x20;



puedes si puedes ahorrarte todo de 0 ayudaría
~~~~

### Mensaje 17

~~~~text
Hay una cosa que me recomendaron, no usar la transacción individual, sino mostrar la lista de transacciones. Eso fue por parte de uno de los de interledger que están ahí.
~~~~

### Mensaje 18 — solicitud de este registro

~~~~text
Necesito que documentes tu trabajo en este proyecto para el requisito de uso de IA de la hackathon ("cada integrante debe entender lo que entrega" y "guardar el prompt real"). Responde con DOS bloques. No inventes nada: si no consta en la conversación, escribe "no consta".

BLOQUE 1: contenido de un archivo nuevo prompts/NN-<mi-rol>-<tema>.md (NN = el siguiente número libre en prompts/). Debe tener:
1. Herramienta y modelo exactos que estás usando (por ejemplo "Codex", "Gemini en Antigravity", "Claude Code") y el rol del equipo (A: src/openPayments.ts, B: src/db.ts, src/server.ts y src/seed.ts, C: public/, D: documentos y entrega).
2. Fechas (de a), en hora local.
3. Los mensajes del usuario de esta conversación, LITERALES y en orden, numerados. No los resumas ni los corrijas, ni siquiera los errores de dictado. Si uno es muy largo (un archivo pegado), escribe el inicio, "[...]" y a qué archivo corresponde. No incluyas llaves, tokens, .env ni private.key.
4. Qué produjiste: tabla con archivo, qué cambia y el commit (hash corto). Solo lo que hiciste tú.
5. Qué verificaste TÚ con pruebas que corriste (comandos y resultado). Distingue pruebas con billeteras simuladas de pruebas reales contra la testnet.
6. Qué NO pudiste verificar y debe confirmar una persona.
7. Decisiones que tomó el equipo y tú aplicaste.

BLOQUE 2: un párrafo de máximo 8 líneas, listo para pegar en AI_USAGE.md bajo mi rol, con herramienta, qué se hizo con IA, qué validó el equipo a mano y los límites conocidos.

Reglas: no edites AI_USAGE.md ni README.md (otra persona los integra). Guarda solo tu archivo prompts/NN-*.md. No hagas commit ni push. Avísame la ruta del archivo que creaste.

De este y lo que consideres de las otras conversaciones. 
~~~~

## 4. Lo que produje o hice yo

| Archivo/artefacto | Trabajo propio y límites de atribución | Commit |
|---|---|---|
| src/openPayments.ts | Guardas de cotización vencida antes/después de continuar grant; traducción de transporte; PaymentError y sus cinco códigos; validación positiva uint64 con BigInt; startPayout debit-only e incoming sin monto; preparación compartida y medición de tiempos. Firmas existentes conservadas. | a3dcf69, b95203d, 3b456df |
| src/opPayCli.ts | Espera ampliada de 5 a 10 min para probar vencimientos; modo --debit, tiempos y errores con code. El CLI base ya existía. | a3dcf69, 3b456df |
| src/opSelfTest.ts | Casos de callback vencido, traducción de red, códigos y validación de montos; extensión del hash offline existente. No se atribuye el vector inicial. | a3dcf69, b95203d, 3b456df |
| src/opFlowSelfTest.ts | SDK simulado con clave efímera: aportes de varios montos, incoming/quote de entrega, origen del grant y finishPayment reutilizado; errores de hash/red/rechazo. | 3b456df |
| scripts/test-op-network.mts | Fallo de incoming inyectado, no replay automático de POST, registro failed sin pending_json y reintento manual válido con SQLite temporal. | b95203d |
| docs/open-payments-evidence.md | Salidas reales, IDs, monedas, tiempos, vencimiento, rechazo y coordinación/revisión de B, distinguiendo creación de outgoing y liquidación. | a3dcf69, 75331c6, b95203d, 3b456df |
| docs/open-payments-walkthrough.md | Guía de lectura del módulo, límites e incorporación de entregas/errores tipados. No certifica comprensión humana línea por línea. | a3dcf69, 3b456df |
| docs/payment-ui-handoff.md | Contrato de errores para C, mediciones, criterio de no repetir POST y límites de redondeo/saldo. | b95203d |
| docs/app-confirmed.png; docs/app-rehearsal-20261016.png | Capturas reales de aportes confirmados en la app. | a3dcf69; b95203d |
| WALLETS.md | Actualizaciones propias de evidencia y límites del seed. La mayor parte del archivo ya estaba sin seguimiento; no la redacté en esta ejecución. | a3dcf69, 75331c6 |
| README.md | Incluí en a3dcf69 cuatro líneas preexistentes al iniciar; su redacción no se atribuye a mí. No lo edito para este registro. | a3dcf69 |
| AI_USAGE.md | Entradas históricas propias de pruebas, robustez y entregas. La redacción/integración posterior de otros roles no se atribuye a mí. No se edita para este registro. | a3dcf69, b95203d, 3b456df |
| prompts/02-verificacion-open-payments.md; 04-robustez-y-ensayo.md; 05-entregas-reales.md | Guardé los prompts reales de esas tareas. | a3dcf69; b95203d; 3b456df |
| docs/demo-ui-20261016/ y docs/demo-ui-20261016.zip | 14 capturas de UI, resultados, error invalid session y estados de vencimiento; pago nuevo, rechazo y vencimiento aislado. | Sin commit en esta conversación |
| /Users/juanjosezapatamoreno/01_Trabajo/Videos/proyectos/hackathon-convite/recursos/grabaciones-reales/ | Primera serie antes/después, movimientos, resumen, éxito e informe; discrepancia visible de USD 0,01 anotada. | Fuera del repo; sin commit |
| La misma carpeta, toma-2/ | 9 PNG 723×900 del mismo nuevo pago, Accept capturado antes de aceptar, informe y estado; luego juan-lista.png/caja-lista.png del mismo pago. No se alteraron cifras ni se hicieron pagos nuevos para obtener las listas. | Fuera del repo; sin commit |
| Este archivo prompts/08-A-registro-real-pagos-pruebas-y-capturas.md | Registro solicitado; único archivo escrito en esta tarea. | Sin commit ni push, por instrucción |

Operación sin archivo de aplicación: ejecuté/reinicié npm run dev, comprobé HTTP, configuré el servicio de usuario com.laucaux.team-dev con launchctl y BASE_URL de la LAN; preservé la base habitual usando bases temporales para ensayos. Cambios de dirección comprobados: 192.168.1.145 y después 172.19.0.194. No implementé scripts/lan.mjs ni los endpoints/columnas de B o el diseño de C. No hice push.

## 5. Pruebas que ejecuté yo

### 5.1 Offline y con billeteras simuladas

| Comando/operación | Resultado observado | Alcance |
|---|---|---|
| npm run typecheck | Pasó en las verificaciones finales de los cuatro commits propios y al revisar f004f3e, 2fe9999 y 8802148. El primer intento del nuevo opFlowSelfTest tuvo errores TS2352 en mocks; los corregí y volví a pasar typecheck. | Compilación de tipos, no pagos |
| npm run op:test | Pasó: hash y URL, hash inválido, vencido antes de red, transporte, errores tipados, enteros positivos uint64 y contratos de aporte/entrega con SDK simulado. | Sin testnet ni fondos reales |
| npx tsx scripts/test-op-network.mts | Pasó: HTTP 500 español al fallo inyectado; aporte failed sin estado pendiente; segundo POST manual obtiene HTTP 200 y redirect válido. | Cliente simulado y SQLite temporal; HTTP local |
| git diff --check | Pasó en los cierres documentados. | Formato de diff, no comportamiento funcional |
| PIL Image.open/verificación y conversión sips a PNG | Imágenes legibles revisadas visualmente; los 9 PNG de toma-2 y las dos listas tienen 723×900 px. | Artefactos, sin montaje de texto ni modificación de cifras |

Los comandos de B para callbacks concurrentes, latencia de 150+50 ms y recuperación se recibieron pegados. Los revisé y contrasté con el código; **no consta** que los haya ejecutado yo. No atribuyo esos resultados a mis pruebas. La primera prueba pegada con grant_rejected no entraba en finishPayment; se lo señalé y B aportó después la prueba solapada.

### 5.2 Pruebas reales contra la testnet (saldo ficticio)

| Flujo que ejecuté | Resultado real e identificador |
|---|---|
| npm run op:pay -- https://ilp.interledger-test.dev/emisor_op https://ilp.interledger-test.dev/receptor_op 1000 | 31.766,58 COP → 10 USD; outgoing c0901faa-e022-4dde-afd6-310c247c1960. |
| npm run op:pay -- https://ilp.interledger-test.dev/receptor_op https://ilp.interledger-test.dev/emisor_op 1000 | 0,01 USD → 10 COP; outgoing 68cd47a4-377e-45a9-a8cb-9c0e2b57e643. |
| npm run seed, npm run dev; Aportar como Juan y Accept | Libro confirmed; outgoing e4842bc9-0f35-448a-918e-62a365fcfa5b; 10 USD recibidos indicados. |
| Ensayo separado: seed/dev en puerto 3198, Aportar/Accept | Preparación 3976 ms, 299590 ms de vigencia restante; 31.769,80 COP → 10 USD; outgoing cb072fc8-1e74-47a6-9fd1-3666a941f6ac. Otra solicitud midió 3596 ms y se rechazó. |
| git pull, base nueva con DB_PATH=/tmp/laucaux-ui-20261016-fresh.db npm run seed y dev en 3000 | Pull Already up to date; UI nueva: Juan → resumen → Accept → ¡Listo! → libro Confirmado. 31.769,80 COP → 10 USD; outgoing 20164265-5415-4cb9-8607-7ced232c9dd0. |
| Decline desde la app | Pantalla «El miembro rechazó el pago. No se te cobró nada»; fila failed, sin outgoing. |
| Cotización vencida con CLI anterior aún cargado | Se esperó expiresAt; resultado real del proveedor: Error making Open Payments POST request / invalid quote. El primer CLI de 5 min agotó su espera antes del callback; por eso amplié a 10 min. |
| Vencimiento en UI nueva, primero con dos interacciones abiertas | La testnet devolvió invalid_request / invalid session, sin regresar al callback. API marcó expired/failed. La causa interna exacta no se verificó. |
| Repetición aislada de vencimiento en UI | Tras esperar expiresAt y aceptar, volvió con «La cotización venció, vuelve a intentar. No se te cobró nada»; failed sin outgoing. |
| npm run op:pay -- --debit https://ilp.interledger-test.dev/receptor_op https://ilp.interledger-test.dev/emisor_op 100 | 1 USD → 3176,97 COP; preparación 3408 ms, finalización 1842 ms, expiresAt 2026-10-17T01:41:10.668Z; outgoing 74c5141e-f549-4785-9cd3-892a24abbb7f. |
| npm run op:pay -- --debit https://ilp.interledger-test.dev/emisor_op https://ilp.interledger-test.dev/receptor_op 10000 | 100 COP → 0,03 USD; preparación 3259 ms, finalización 1690 ms, expiresAt 2026-10-17T01:42:34.296Z; outgoing 76af2572-bc00-4d31-8936-e46e115b35d2. |
| Decline de entrega USD → COP | ERROR [rejected]: El dueño de la billetera rechazó el pago; salida 1, sin outgoing. |
| Entrega USD → COP autorizada después de expiresAt | expiresAt 2026-10-17T01:43:54.082Z; callback real y ERROR [expired]: La cotización venció, vuelve a intentar; salida 1, sin outgoing. |
| Capturas 17-oct, nuevo aporte real desde la app en 3198 | Outgoing 1104fef9-5187-4cb7-b837-fe7835f00518. Juan 682.257,51 → 650.507,24 COP, débito 31.750,27; caja 58,99 → 68,98 USD. Historial entrante +10 USD COMPLETED, pero diferencia de saldo visible 9,99: lo anoté sin forzarlo. |
| Toma-2, un único aporte nuevo real desde la misma app | Outgoing 08335407-0cc0-4aa7-a4ab-405fdfd0fc45. Juan 650.507,24 → 618.756,97 COP; caja 68,98 → 78,98 USD. Listo y ambos historiales COMPLETED. Accept fue capturado antes de autorizar. |
| Listas de transacciones, después de toma-2 | Capturé las listas del mismo pago, sin otro pago. Saliente 09:27, −31.750,27 COP; entrada 09:26, +10 USD, ambos COMPLETED. La entrada se solicitó antes de autorizar la salida; no alteré las horas. |

Los IDs abreviados de la tabla son el último segmento de las URL completas guardadas en docs/open-payments-evidence.md y en los informes de capturas. Crear outgoing/confirmed local no acredita por sí solo liquidación final. Solo en las capturas posteriores contrasté además los historiales reales COMPLETED y los saldos visibles.

También comprobé con curl/lsof que página y API respondían HTTP 200 por localhost y por las IP de LAN indicadas después de arrancar o reiniciar. **No consta** una prueba mía desde el celular de otra persona ni desde otra red. No ejecuté yo una entrega completa mediante los nuevos endpoints v2 de la app: mis entregas reales fueron mediante CLI.

## 6. Lo que debe confirmar una persona

- **Comprensión línea por línea:** generé la guía; no consta que cada integrante la haya explicado o revisado manualmente. Deben hacerlo antes de entregar.
- **Validación humana:** el usuario dijo que revisó el commit inicial y la evidencia de pagos. Eso es un reporte humano, no una certificación de revisión manual de todo mi código. No consta aprobación manual de cada commit propio, ejecución humana de cada comando ni revisión de todos los píxeles.
- **Otra cuenta dueña:** las wallets Emisor y Receptor estaban en la misma cuenta de usuario de Test Wallet. La misma sesión puede autorizar ambas. Revisé el código público que comprueba belongsToUser/NO_ACCESS, pero no probé con otro dueño. El usuario pidió seguir con las wallets conocidas y dejó las otras cuentas para el ensayo del equipo. La prueba negativa real queda pendiente.
- **Código público y despliegue:** no consta que la revisión main de Test Wallet leída sea exactamente la desplegada. No se afirma una auditoría de seguridad.
- **Recuperación:** no verifiqué recuperación de una caída después de consumir el grant o crear outgoing y antes de persistir el resultado. La reserva/reinicio que agregó B no demuestra reconciliación remota ni garantía de exactamente una ejecución.
- **Red:** no se garantizó limpieza de recursos remotos si se creó incoming/quote/grant y se perdió la respuesta. Los reintentos automáticos de POST se evitaron. Se observaron fetch failed reales; el reintento limpio se comprobó con fallo inyectado.
- **Saldos:** no se explicó el centavo de diferencia visible de la primera toma; no se inventó una comisión. En toma-2 la diferencia visible sí fue exactamente 10 USD. No se certifica saldo remoto con el libro local.
- **Saldo insuficiente:** no se capturó un rechazo real por falta de fondos; mensaje exacto del proveedor: no consta.
- **Redondeo/cambio:** se observaron 0,01 USD por 10 COP y los importes de las entregas, pero no se verificó el algoritmo exacto del despliegue ni una tasa de mercado estable.
- **Alcance:** entrega desde UI v2, login de usuarios ajenos, red móvil de otro dispositivo, accesibilidad integral y versión final del video revisada por Interledger: no consta verificación propia. La recomendación de mostrar listas fue transmitida por el usuario, no recibida directamente de Interledger por mí.

## 7. Decisiones del equipo aplicadas

1. Rol A centrado en Open Payments; conservar firmas de startPayment/finishPayment y entregar el mismo estado para startPayout. Se aplicó el contrato v2 leído, no se diseñaron aquí las reglas de negocio de B/C.
2. Aporte fija receiveAmount; entrega fija debitAmount de la caja e incoming sin monto fijo. El dueño del origen autoriza; la identidad firmante del cliente no reemplaza ese permiso.
3. Mantener mensajes y agregar code para que B contextualice aporte/entrega. El rechazo que llega como result=grant_rejected debe mapearlo B antes de finishPayment.
4. Coordinar sin pisar B/C: revisé sus reportes, señalé la carrera antes del await, dejé preguntas/contrato y no me atribuí sus arreglos. Los tres perfiles que comparten wallet son simulación de personas, no tres autorizadores independientes.
5. Continuar con las wallets conocidas; pruebas reales con otras cuentas quedan para el equipo por instrucción del usuario.
6. Una autorización a la vez tras observar invalid session con flujos paralelos; no atribuí definitivamente su causa interna. Se repitió el caso aislado.
7. No fabricar evidencia para el video: pago nuevo cuando faltaba el antes/Accept, todas las imágenes del mismo intento, ancho 723 px, sin correo/contraseñas/llaves, y discrepancias escritas. La nueva cotización pudo coincidir legítimamente con la cifra anterior; no se montó texto.
8. Reutilizar app/sesión y base separada para las capturas; no rehacer el proyecto ni modificar el círculo cerrado del servidor compartido.
9. Sustituir en la edición los detalles por listas, según la recomendación transmitida por el usuario; conservar los detalles como respaldo sin nuevos pagos.
10. Esta tarea de documentación: escribir solo este archivo nuevo. No editar AI_USAGE.md ni README.md, ni hacer commit/push. Los cambios preexistentes de otras personas se preservan.
