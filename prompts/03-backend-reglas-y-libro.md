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
