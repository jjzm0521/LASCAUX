# Prompt real — rol A, 16 de octubre de 2026

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
