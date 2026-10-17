# Contrato v2: tres tipos de círculo y entregas reales

Fuente de verdad para A (Open Payments), B (backend) y C (interfaz). Si algo cambia, se cambia aquí primero y se avisa.

## 1. Reglas de producto por tipo

| | Cadena | Natillera | Círculo solidario |
|---|---|---|---|
| Aporte | Monto fijo igual para todos, definido al crear | Cada persona escribe cuánto aporta cada vez | Cada persona escribe cuánto aporta cada vez |
| Quién recibe | Una persona por ronda, en orden de turno, toda la caja de esa ronda | Nadie por ronda. Al cierre se reparte en proporción a lo aportado | Cualquier miembro pide una ayuda con monto y motivo |
| Aprobación | Una proporción del grupo aprueba la entrega | Una proporción del grupo aprueba el cierre | Una proporción del grupo aprueba cada ayuda |
| Se puede entregar si | Todos aportaron en la ronda | Hay saldo en la caja | La ayuda no supera el saldo libre de la caja |
| Cierra la ronda | Al pagarse la entrega (ronda + 1) | A mano: "Abrir la ronda siguiente" (ronda + 1). El cierre reparte y termina el ciclo | A mano: "Abrir la ronda siguiente" |
| Reputación | aportes confirmados / aportes esperados | personas que aportaron en la ronda / personas | igual que la natillera |

Fuera de alcance (siguientes pasos en el pitch): intereses, préstamos con devolución, scoring individual, custodia. Decreto 1357/2018 y habeas data.

## 1b. Aprobación por proporción (reemplaza "M aprobaciones")

Se elige un porcentaje del grupo al crear el círculo: 50 (la mitad), 51 (mayoría), 67 (dos tercios) o 100 (todos). Cualquier entero de 1 a 100 es válido.

- `approval_percent` se guarda en `circles`. `min_approvals` queda como respaldo para círculos viejos (sin `approval_percent`).
- Votantes: en una entrega, todos los miembros MENOS el beneficiario (nadie aprueba su propia entrega). En un cierre o reparto, todos los miembros.
- `needed = min(votantes, max(1, ceil(approval_percent x votantes / 100)))`. Ejemplos con 50 %: 4 miembros, entrega a uno de ellos: 3 votantes, `needed = 2`. 5 miembros: 4 votantes, `needed = 2`. Con 100 %: `needed = votantes`.
- `needed` se CONGELA al crear la entrega o el cierre (columna `needed` en `payouts` y `closings`). Si después entra otra persona al círculo, las entregas ya pedidas no cambian su umbral.
- Si hay menos de 2 miembros no se puede pedir una entrega: 400 "Se necesitan al menos 2 personas en el círculo para entregar."
- Una entrega o cierre pasa a `approved` cuando `approvals >= needed`.

API:
- `POST /api/circles` acepta `approval_percent` (entero 1 a 100). Si viene, `min_approvals` es opcional (se guarda 2 como respaldo). Si no viene, se usa `min_approvals` (1 a 4) como hasta ahora.
- `GET /api/circles/:id`: `circle.approval_percent` y `circle.approvalPercent` (iguales, null en círculos viejos). `payouts[].needed` y `closing.needed` con el umbral congelado.
- `POST /api/payouts/:id/approve` y `POST /api/closings/:id/approve` responden `{ approvals, needed, status }`.
- La interfaz usa `needed` de cada entrega; si no viene, lo calcula con `approvalPercent` y los miembros actuales, y si tampoco, usa `min_approvals`.

## 2. Quién autoriza una entrega

La caja es una billetera de prueba normal. Para sacar plata de ahí, el dueño de esa billetera debe autorizar en su Test Wallet (grant interactivo), igual que cualquier aporte. La app no necesita el concepto de "tesorero": cualquier miembro pulsa "Enviar la entrega" y la billetera de la caja decide con su propia autorización.

## 3. Montos

- Todos los montos viajan como enteros en unidades mínimas del activo de la caja (`assetCode`, `assetScale`), como string en JSON.
- Lo que escribe una persona viaja como decimal en texto (`"10.5"`) y el servidor lo convierte con `assetScale`, sin números flotantes. Más decimales de los que admite el activo: 400 con la palabra "aporte" o "monto".
- Un aporte llega a la caja con monto fijo a recibir (`receiveAmount`), como hoy.
- Una entrega sale de la caja con monto fijo a DEBITAR (`debitAmount`): la caja paga exactamente X y la billetera destino recibe lo que resulte según la cotización, en su propia moneda.

## 4. API v2

Todo error: `{ "error": "texto en español" }` con el código HTTP correcto.

### Círculo
`POST /api/circles` body `{ name, kind, pot_wallet, approval_percent, min_approvals?, amount? }` (ver sección 1b)
- `amount` obligatorio solo si `kind === 'cadena'`. Para natillera y círculo solidario se ignora.

`GET /api/circles/:id` agrega:
```
circle: { ..., contribution: "1000" | null, status: "open" | "closed" }   // contribution solo en cadena
pot: { contributed: "3000", paidOut: "0", reserved: "0", balance: "3000", free: "3000",
       shares: [ { memberId, name, contributed: "1000", percent: 33.3, share: "1000" } ] }
```
- `contributed`: suma de aportes confirmados. `paidOut`: entregas pagadas. `reserved`: entregas aprobadas o en pago que aún no salen. `balance = contributed - paidOut`. `free = balance - reserved`.
- `shares`: parte de cada miembro (ordenadas de mayor a menor). `share = balance x percent`, entero; el resto de la división se asigna a quien más aportó.
- `reputation`: ver tabla de la sección 1.

### Aportes
`POST /api/circles/:id/contribute` body `{ memberId, amount? }`
- Cadena: `amount` no se acepta, se usa el fijo del círculo.
- Natillera y círculo solidario: `amount` obligatorio.
- La respuesta no cambia: `{ contributionId, redirectUrl, debit, receive, expiresAt }`.

### Rondas (natillera y círculo solidario)
`POST /api/circles/:id/rounds/next` body `{ memberId }` → `{ round }`. Cadena: 400 "En una cadena la ronda cambia sola al pagar la entrega".

### Entregas
`GET /api/circles/:id` → `payouts[]`:
```
{ id, member_id, name, amount: "1000", purpose, kind: "entrega" | "reparto", closingId: null | 1, needed: 2,
  status: "requested" | "approved" | "paying" | "paid" | "failed",
  approvals, approvedBy: [..], round, outgoingId: null | "https://...", paidAt: null | "YYYY-MM-DD HH:MM:SS",
  debit: null | {value,assetCode,assetScale}, receive: null | {value,assetCode,assetScale}, error: null | "texto" }
```
`POST /api/circles/:id/payouts` body `{ memberId, amount?, purpose? }` (crea una `entrega`)
- Cadena: solo el miembro del turno; el monto lo calcula el servidor (suma de aportes confirmados de la ronda); exige que todos hayan aportado; `amount` se ignora.
- Natillera: 400 "En una natillera la caja se reparte al cierre".
- Círculo solidario: cualquier miembro; `amount` obligatorio y `<= pot.free`.
- Una sola entrega abierta por ronda en cadena.

`POST /api/payouts/:id/approve` (ya existe). Al llegar a M pasa a `approved`.

`POST /api/payouts/:id/execute` body `{ memberId }` → `{ redirectUrl, debit, receive, expiresAt }`
- Solo si `status === 'approved'`. Pasa a `paying`. Una sola entrega en `paying` por círculo.
- Origen: billetera de la caja. Destino: billetera del miembro. Cotización por monto a debitar.

`GET /api/payouts/:id/finish` (callback de la billetera): verifica, crea el pago, `paid` o `failed`, y redirige a `/?circle=ID&payout=ok&p=PAYOUT_ID` o `/?circle=ID&payout=error&p=PAYOUT_ID&error=texto`.
- En cadena, al quedar `paid`: `round + 1`.

`GET /api/payouts/:id` → `{ id, circleId, status, expiresAt, debit, receive, error?, outgoingId?, paidAt? }` para el stepper y el comprobante.

Las entregas `paying` cuya cotización venció pasan a `failed` ("La cotización venció, vuelve a intentar") y se pueden volver a ejecutar: `failed` por vencimiento vuelve a `approved` al pedir execute de nuevo.

### Cierre de natillera
`GET /api/circles/:id` agrega `closing: null | { id, status: "proposed" | "approved" | "paying" | "done", needed: 2, approvedBy: [..], payouts: [ids] }`.

`POST /api/circles/:id/closing` body `{ memberId }`
- Solo natillera, con `pot.balance > 0` y sin cierre activo. Crea un `closing` y un payout `kind: "reparto"` por miembro con `share > 0` (monto = su `share`), todos en `requested`.

`POST /api/closings/:id/approve` body `{ memberId }`: un voto por miembro; al llegar a M, el cierre y sus repartos pasan a `approved`. Cada reparto se ejecuta con `POST /api/payouts/:id/execute` (una autorización por persona).
Cuando todos los repartos están `paid`: `closing.status = "done"`, `circle.status = "closed"`.

## 5. Mensajes en español (los usa la interfaz tal cual)

- Entrega sin saldo: "La caja no tiene saldo suficiente para esta entrega."
- Entrega en cadena sin todos los aportes: "Faltan aportes de esta ronda: todavía no se puede entregar."
- Cotización vencida en una entrega: "La cotización venció, vuelve a intentar."
- Entrega rechazada en la billetera de la caja: "La billetera de la caja rechazó el pago."
- Red caída: "No pudimos conectar con la billetera de prueba, intenta de nuevo."
