# Uso de IA

2026-10-16 — Codex (OpenAI), rol A: startPayout con débito fijo e incoming sin monto; errores tipados conservando mensajes; validación de montos enteros positivos uint64; modo --debit del CLI y pruebas offline de ambos tipos de cotización. Ensayos reales y límites de autorización: docs/open-payments-evidence.md. Prompt real: prompts/05-entregas-reales.md. No se modificaron las firmas existentes de startPayment/finishPayment ni los archivos del backend/UI de otros roles.

2026-10-16 — Codex (OpenAI), robustez y entrega a UI: traducción de fallos de transporte, prueba offline de fallo y reintento manual sin pending huérfano, medición de dos solicitudes reales, ensayo completo y rechazo real desde la Test Wallet. Se mantuvieron los contratos de startPayment/finishPayment. Evidencia: docs/payment-ui-handoff.md; prompt: prompts/04-robustez-y-ensayo.md.
Herramienta: Claude (Anthropic). Usada para: ideación del concepto, investigación del contexto colombiano, andamiaje inicial del proyecto (estructura, módulo de Open Payments, API, UI mínima).
Lo que el equipo debe completar/validar: entender y probar src/openPayments.ts línea por línea, ajustar a la testnet real, decisiones de producto y pitch.
Prompts reales: carpeta /prompts. (Actualicen este archivo con lo que realmente hagan durante el evento.)

Codex (OpenAI): incorporación del ejemplo oficial de pago P2P, configuración de instalación automática con npm run setup, documentación y comprobación de tipos y carga de SQLite. No se ejecutaron pagos en estas tareas.

2026-10-16 — Codex (OpenAI): revisión del commit 0a74ca2, ejecución real de op:pay en ambos sentidos en testnet y del botón Aportar de la aplicación con autorización en la Test Wallet. Implementación del rechazo de cotizaciones vencidas en español, prueba offline del callback vencido y ampliación de la espera del CLI para permitir comprobar vencimientos. Evidencia y límites: docs/open-payments-evidence.md. Guía de lectura del módulo: docs/open-payments-walkthrough.md. Prompt de esta tarea: prompts/02-verificacion-open-payments.md. La creación de outgoing y el estado local confirmed no equivalen a verificar liquidación remota final.
