# Prompt real recibido — 2026-10-16 (Rol B: src/db.ts, src/server.ts, src/seed.ts)

Hola B. Te cuento todo el proyecto y lo que te toca.

== QUÉ ES ==
"Convite" (nombre tentativo): app de natilleras, cadenas y círculos solidarios digitales sobre Open Payments (Interledger). Los miembros de un círculo (que ya se conocen) aportan desde su propia billetera y su propia moneda; la caja del círculo recibe un monto fijo. Todos ven el libro de aportes, los desembolsos requieren M aprobaciones y la reputación del círculo se calcula del libro. La app COORDINA, NO custodia dinero. Solo usamos wallets de prueba (wallet.interledger-test.dev, dinero de juguete).

== EVENTO ==
Hackathon Interledger Open Payments, Ruta N, Medellín. ENTREGA: sábado 17-oct a las 11:00 (repo público, video de demo, diapositivas). Pitch de 5 min desde las 12:00. La demo debe mostrar: solicitud de pago, autorización, ejecución y éxito. Eso es lo que más puntúa. Reglas: el código se escribe durante el evento; se permite IA pero cada integrante debe entender lo que entrega.

== ROLES (un archivo por persona, para no chocar en git) ==
A = src/openPayments.ts (flujo de pago). B (tú) = src/db.ts, src/server.ts y src/seed.ts. C = public/ (interfaz). D = README, AI_USAGE.md, prompts/, video y diapositivas. Si necesitas tocar un archivo de otro, pídeselo.

== TUS PENDIENTES (en orden de prioridad) ==
1. API del libro: GET /api/circles/:id debe devolver en cada fila del ledger la moneda y escala del aporte (assetCode y assetScale del débito y del recibido), parseando debit_json. Hoy llega crudo y C no puede mostrar montos sin adivinar. Define la forma exacta del JSON y avísale a C.
2. seed.ts roto para la demo: hay 3 miembros (Mamá, Juan, Sofía) pero solo 2 wallets. "Sofía" lee WALLET_CO2, que no existe. Además la caja (POT_WALLET) es la wallet de Sofía, que también es miembro, o sea se pagaría a sí misma. Decide con el equipo (y A, que sabe qué combinaciones funcionan) qué miembro usa qué wallet y qué wallet es la caja. Variables: POT_WALLET, WALLET_US, WALLET_CO, WALLET_CO2 en .env.
3. Contribución del seed: contribution=1000 (10.00 en escala 2 de la caja). Verifica con A que el saldo de prueba de la wallet COP alcanza.
4. Aportes colgados: si el miembro abandona la autorización, el aporte queda 'pending' para siempre en el libro. Pásalo a 'failed' cuando venza (el state de pending_json trae expiresAt) o cuando el mismo miembro pida un aporte nuevo en la misma ronda.
5. Reglas de la cadena que faltan: un solo aporte por miembro por ronda; turnos (hoy cualquiera puede pedir desembolso; solo debe poder el miembro al que le toca); validar que POST /payouts y /approve no revienten con ids inexistentes (hoy payout null -> excepción); cierre de ronda.
6. Si queda tiempo: ejecución real del desembolso (segundo flujo de Open Payments, coordínalo con A).

Aclaración posterior del usuario:
"Preguntaste solo de cadenas, pero tienes en cuenta los demas aspectos como e tema de inspirarse en la coorporación fomentamos y sufuncionalidad?"
Acuerdo de diseño:
- Diferenciar por `circle.kind`: en `'cadena'` y `'natillera'` respetar el turno rotativo de la ronda; en `'circulo'` (modelo Círculos Solidarios de la Corporación Fomentamos) permitir que cualquier miembro del círculo solicite un desembolso/crédito solidario (con `purpose` y `amount` opcionales) respaldado por el aval solidario M-de-N de sus compañeros.
- En `seed.ts`, usar `POT_WALLET` (`receptor_op`, USD) como caja y `WALLET_CO` (`emisor_op`, COP) como wallet emisora cuando `WALLET_CO2` no exista o cuando `WALLET_US` coincida con `POT_WALLET`, evitando que un miembro se pague a la misma wallet de la caja.
- Concurrencia en `/api/contributions/:id/finish` (una instancia de servidor): reserva atómica con `status='processing'` antes del primer `await` conservando `pending_json` durante el vuelo y condicionando las escrituras finales a `status='processing'`.
- Límite documentado de recuperación: al reiniciar el servidor se restauran a `'pending'` las filas `'processing'` que conservan `pending_json`, lo cual cubre caídas previas a consumir `grant.continue`; si el proceso cae después de consumir el grant o de crear el `outgoing-payment` remoto antes de escribir en SQLite, no es reintentable con el mismo `continueToken` porque no se persiste el token intermedio.
- Solicitud de C (congelamiento de contrato e interfaz):
  - En `GET /api/circles/:id`: `members[]` incluye `hasContributed` y `canRequestPayout`; `payouts[]` incluye `approvedBy: number[]`.
  - Nuevo endpoint `GET /api/contributions/:id` para el stepper (`{ id, circleId, memberId, round, status, expiresAt, debit, receive, error? }`) respaldado por columnas `expires_at` y `error_msg`.
  - En `src/seed.ts`: Mamá usa `country: 'CO'` cuando comparte la wallet COP (`emisor_op`), y `'US'` solo si se configura un `WALLET_US` distinto de `POT_WALLET`.
  - Decisión de producto (punto 6): se permite solicitar/aprobar desembolso y cerrar la ronda sin exigir que los 3 miembros hayan aportado primero (para agilizar la demo en vivo con 1 pago real; la reputación refleja los aportes faltantes).
  - Campos para el Comprobante (solicitud adicional de C): se añadió `confirmed_at` en `contributions` (migración automática, poblada con `datetime('now')` en UTC al confirmar el callback) y se exponen `outgoingId` y `confirmedAt` en `GET /api/circles/:id` (`ledger[]`) y en `GET /api/contributions/:id` (`null` mientras no esté confirmado o en aportes previos sin `confirmed_at`).
  - Endpoint `POST /api/circles/:id/members` y `members[].assetCode`: migración de `asset_code` en `members`, validación de nombre (`1..40`), normalización con `toUrl`, protección SSRF con lista blanca de dominios (`ALLOWED_WALLET_HOSTS`, por defecto `.interledger-test.dev`), verificación de existencia con `client.walletAddress.get`, rechazo de `pot_wallet`, máximo 12 miembros por círculo y rate limit en memoria de 10 solicitudes/minuto por IP.
  - Contrato v2 (`docs/contrato-api-v2.md`):
    - **Fase 1**: diferenciación estricta de los tres tipos (`cadena` con monto fijo `contribution`; `natillera` y `circulo` con `contribution: null` y aportes variables convertidos a unidades mínimas con `BigInt` según `assetScale` de la caja), cálculo de `pot` (`contributed`, `paidOut`, `reserved`, `balance`, `free`, `shares[]` con residuo de redondeo asignado a quien más aportó), reputación por tipo, `POST /api/circles/:id/payouts` por tipo y `POST /api/circles/:id/rounds/next`.
    - **Fase 2**: ejecución real de entregas (`POST /api/payouts/:id/execute`, `GET /api/payouts/:id/finish`, `GET /api/payouts/:id`, usando `startPayout` y `finishPayment` de `src/openPayments.ts`), una sola entrega en `paying` por círculo, reserva atómica `status='processing_payout'`, vencimiento de entregas en `paying` que permite reejecución a `approved`, avance automático de ronda (`round + 1`) al quedar `paid` en `cadena`, y traducción de errores por `e.code`.
    - **Fase 3**: cierre y liquidación proporcional de natilleras (`POST /api/circles/:id/closing`, `POST /api/closings/:id/approve`, tablas `closings` y `closing_approvals`), creación de entregas `kind='reparto'` por cada miembro con `share > 0`, aprobación grupal que pasa el cierre y sus repartos a `approved`, y transición automática a `closing.status='done'` y `circle.status='closed'` al quedar pagados todos los repartos.
    - **Sección 1b (Umbral proporcional de aprobación)**: columna `approval_percent` (`1..100`) en `circles` con respaldo `min_approvals` para círculos anteriores; cálculo `needed = min(votantes, max(1, ceil(approval_percent * votantes / 100)))` (`votantes = miembros - 1` en entregas, `votantes = miembros` en cierres); congelamiento de `needed` en `payouts.needed` y `closings.needed` al crear la solicitud; bloqueo de entregas/cierres con menos de 2 miembros (`400 "Se necesitan al menos 2 personas en el círculo para entregar."`).
