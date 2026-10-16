# Prompt real recibido — 2026-10-16

Revisé tu evidencia en docs/open-payments-evidence.md: ambos sentidos y el flujo con la app están, y el mensaje de cotización vencida es claro. Voy a armar la interfaz con un stepper de pago (Solicitud -> Autorización -> Pago -> Listo), y necesito de ti:

1. ROBUSTEZ DE LA TESTNET: en la evidencia hay un `fetch failed` al crear el incoming payment en el segundo intento. Para la demo necesitamos que cualquier error de red salga con un mensaje comprensible en español ("No pudimos conectar con la billetera de prueba, intenta de nuevo") y que un reintento funcione sin dejar basura. ¿Puedes revisar si conviene un reintento automático (1 o 2 veces) en startPayment cuando falle la red, no cuando falle la autorización?
2. LISTA DE ERRORES REALES: dame los mensajes de error que ya viste y que el usuario puede encontrar (cotización vencida, pago rechazado, billetera sin fondos, hash inválido, red caída). Con eso escribo el texto de pantalla para cada caso, sin inventarlos.
3. TIEMPOS: ¿cuánto tarda startPayment (de pulsar Aportar a tener redirectUrl) y cuánto dura la cotización (expiresAt - ahora)? Lo uso para skeletons, textos de espera y el aviso "autoriza antes de las HH:MM".
4. ¿Debito vs recibe? Vimos 0.01 USD por 10.00 COP (redondeo de la testnet). Confirma si es esperado para que no se vea raro en el video.
5. ENSAYO: antes de grabar el video, hagan un aporte completo de punta a punta con la app (no solo op:pay) y guarden la captura como respaldo.
No cambies la forma de lo que devuelve startPayment/finishPayment sin avisarme.
