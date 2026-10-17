# Guía de lectura de src/openPayments.ts

Actualización v2: `startPayout` comparte la preparación con `startPayment` mediante un modo interno. Aporte fija receiveAmount y crea incoming con incomingAmount; entrega fija debitAmount con moneda/escala de la caja y omite incomingAmount. Ambos devuelven StartResult/PendingPayment y reutilizan finishPayment. Se validan unidades positivas uint64 antes de acceder a la red. PaymentError conserva el mensaje y agrega code (expired/rejected/network/hash/other); B decide el texto contextual. Firmas existentes sin cambios.

El módulo mueve un monto fijo a recibir. Todas las cantidades son cadenas de enteros en unidades mínimas; la escala del activo receptor determina cómo interpretar receiveValue.

1. Los imports de crypto generan nonces, calculan SHA-256 y comparan hashes sin salida temprana. Los imports del SDK crean el cliente y discriminan grants pendientes/finalizados.
2. `client` conserva una sola identidad firmante durante el proceso. No contiene la identidad del dueño de cada wallet; esa persona autoriza después.
3. `toUrl` quita espacios y convierte la notación `$host/ruta` en HTTPS.
4. `getClient` reutiliza el cliente, exige las tres variables de configuración y pasa al SDK la wallet de identidad, ruta de clave y keyId. No debe imprimirse el contenido de la clave.
5. `StartResult` separa el enlace de autorización del estado privado persistido. `PendingPayment` guarda nonces, origen, cotización, continuación y su token, auth server, montos y vencimiento. `continueToken` nunca debe enviarse a la UI ni al libro público.
6. `startPayment` obtiene metadatos de ambas wallets: id canónico, servidores y moneda/escala. La moneda origen puede diferir de la destino.
7. El grant incoming solicita únicamente crear un pago entrante en destino. El guard verifica que trae token utilizable; de lo contrario falla.
8. `receiveAmount` combina el entero solicitado con moneda y escala del receptor. Crear incoming registra la intención de recibir; todavía no transfiere fondos.
9. El grant quote permite crear y leer cotizaciones en origen. La cotización usa incoming.id como receptor y fija receiveAmount. El proveedor calcula débito, cambio y vencimiento.
10. Un UUID fresco vincula la solicitud con su callback. El grant outgoing pide crear/leer para sender.id y limita el débito al quote.debitAmount (moneda origen).
11. La interacción redirect entrega finishUri y nonce del cliente al servidor. Exigir isPendingGrant evita continuar sin la aprobación interactiva esperada.
12. Se devuelve redirectUrl para el navegador. Se persisten por separado el nonce cliente y el nonce finish del servidor, quoteId, continuación, authServer y montos del quote. expiresAt permite detectar autorizaciones tardías y aportes abandonados.
13. `canon` elimina padding Base64 y normaliza +/ a -_. `verifyHash` concatena los cuatro campos con saltos de línea, calcula SHA-256, normaliza ambas representaciones y verifica longitud antes de timingSafeEqual.
14. `finishPayment` reconstruye el hash con el authServer. Actualmente acepta su variante con y sin slash final. Un hash inválido detiene el pago antes de continuar el grant.
15. Con el hash verificado, rechaza una cotización vencida con «La cotización venció, vuelve a intentar». Obtiene metadatos del emisor y continúa el grant con el token privado e interact_ref. Exigir un grant finalizado confirma que se obtuvo el permiso necesario. Vuelve a revisar expiresAt después de continuar, por si esa llamada cruzó el vencimiento.
16. `outgoingPayment.create` consume quoteId con el token del grant finalizado. Devuelve el recurso outgoing al llamador; que exista no demuestra que se haya liquidado. Debe verificarse failed y, para liquidación final, consultar el estado remoto con permisos adecuados.

## Límites de integración

Actualización (commits `8802148` y `2fe9999`): server.ts reserva de forma atómica el intento (`UPDATE … SET status='processing' … WHERE … status IN ('pending','failed')`) antes del primer `await`, así que dos callbacks simultáneos ya no ejecutan dos pagos. Sigue sin resolverse una caída después de crear outgoing pero antes de guardar outgoing_id: al reiniciar, el servidor devuelve los intentos `processing` a `pending` conservando `pending_json`, y habría que reconciliar consultando el outgoing remoto. Requiere esa estrategia de reconciliación antes de producción.

La app marca confirmed al recibir la creación de outgoing y no consulta la liquidación final. Un recurso con failed=true no debería marcarse confirmed. Los tokens pendientes de aportes fallidos también requieren política de eliminación y retención.
