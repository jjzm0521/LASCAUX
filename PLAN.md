# Plan para 4 personas (Vie 16 oct → entrega Sáb 17 oct 11:00)
> Documento histórico: es el plan inicial. La aprobación por proporción del grupo ([contrato v2, §1b](docs/contrato-api-v2.md)) reemplazó a «M aprobaciones»; el estado final está en [README.md](README.md) y [AI_USAGE.md](AI_USAGE.md).

- **A – Open Payments**: src/openPayments.ts. Meta: primer pago extremo a extremo entre 2 billeteras de prueba ANTES de las 14:00 vie. Verificar formato de private.key, monedas disponibles, hash del callback.
- **B – Backend/DB**: src/db.ts, server.ts. Turnos, desembolso con M aprobaciones, reputación.
- **C – Frontend**: public/index.html. Vista previa de la cotización ("se debitan X, el círculo recibe Y"), estados claros, diseño móvil.
- **D – Demo/entrega**: billeteras de prueba en varias monedas, seed, repo público, AI_USAGE.md, prompts/, video, slides, ensayo del pitch (5 min).

Cronograma: Vie 14:00 pago E2E · 18:00 UI+libro+aprobaciones · Sáb 7–9 desembolso+reputación+pulido · 9–10:30 video/slides/repo · 10:30 congelar · 11:00 entregar.
Demo obligatoria: solicitud de pago → autorización → ejecución → éxito.
