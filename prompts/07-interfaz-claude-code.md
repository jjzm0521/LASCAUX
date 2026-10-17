# Prompts reales: sesión de Claude Code (Rol C, interfaz e integración)

- **Herramienta:** Claude Code (modelo Claude Sonnet 5.5) dentro de la app de escritorio de Claude, más Claude Design para el sistema de diseño.
- **Quién escribió los prompts:** la persona del Rol C. Los mensajes se dictaron por voz y se conservan **tal como se enviaron**, con sus errores de transcripción. Solo se omitió el texto pegado de `CLAUDE.md` (está en el repo) y las salidas pegadas de otros agentes (están en `prompts/02` a `05`).
- **Fechas:** 16 y 17 de octubre de 2026.
- Los prompts que Claude Code redactó para Claude Design están en [`06-sistema-diseno-convite.md`](./06-sistema-diseno-convite.md). Los pedidos que redactó para los Roles A y B están, resumidos, en `05-entregas-reales.md` y `03-backend-reglas-y-libro.md`.

## 1. Mensajes del usuario, en orden

1. `Estamos trabajando 4 personas ahorita` *(después de pegar las instrucciones de `CLAUDE.md`)*
2. `agregaselo pero no lo mandes al repo. solo para local. Dime quée se espera quée haga cada persona de trabajo para quée decidamos aca`
3. `Me encargaré del C por ahora. mientras avanzan con lo del OpenPayments, que recomendación nos das para la interfaz`
4. `Listo el espeleta que tenemos realmente es. solo un inicio para que pudiera tener todo como muy organizado necesitamos empezar hacer la propuesta iniciemos con la parte cómo se van a ver hagamos una guía de diseño donde guardemos la relación de los colores Paleta de color, tipografía, componentes para tener una idea de cómo se ve esta pantalla. Los desing tokens, skeletons, la accesibilidad. Todo muy profesional. Empecemos con eso y empieza a hacerme preguntas o dame un promt con el quée pueda pasar a Claude Desing y esa info pasarla aca. Como lo recomiendes`
5. `por que sin librerias de estilo?`
6. `Bueno, quée empiece asi y luego vamos mejjorando entonces`
7. `cual uso de estas` *(con una captura de las opciones de Claude Design)*
8. `Listo, acabe de descargar uba actualización del Main. Puedes evaluar como va el estatus del aporte del miembro A`
9. `Dime que instrucciones le digo para que mejore la implente estos cambios`
10. `Pero añadele esos pendientes`
11. `No, me refiero en el mensaje que le envie`
12. `Imagina quée be no sabe nada del pryecto. Dale toda la info`
13. `Listo. Mira ahora como va el sistema`
14. `Ya acabe con el desing. Dime que les digo a A y B antes de pasar`
15. `Parece que ya`
16. `Puedes ver este artefacto? https://claude.ai/artifact/2v3FNtTzrha4mxKZ1QVjPw`
17. `Si, arranca ahora con eso` *(montar el sistema de diseño solo para móvil y el flujo de la demo)*
18. `Quiero poder añadir wallets para que los demas del equipo puedan usar sus walltes o ingresar una nueva wallet para la prueba del video. Puedes hacerlo`
19. `Hazlo pensando en que pienso abrir un servidor en este pc para que los demas prueben y se conecten`
20. `Si, veo un problema y es que solo puedo ver un circulo. No como se crea un circulo ni se accede ni quée pasa si tengo mas de uno`
21. `No veo la opción ni de crear círculos ni de crear más usuarios. ¿Me podrías colaborar con eso?`
22. `Y la opcion de crear un nuevo usuario donde esta? Para la muestra y quée ellos creen y agreguen sus wallets`
23. `Pero Exacto, estoy creando un círculo y noté que me, me piden diferentemente del tipo, siempre pedir el monto por mes. En algunas cosas, por ejemplo, el círculo solidario, por lo que ya nos comentamos, cada uno hace un aporte diferente, incluso en la natillera. Entonces, pues es más fácil saber de ese círculo cuánta proporción de plata me queda a mí. Entiendo que en la cadena sea uno continuo. Y para solucionar la discusión, me podrías enviar un mensaje diciéndome cuál es la diferencia entre las tres.`
24. `No, yo creo que deberíamos dejarlo todo completo. Pues es que tenemos el tiempo suficiente como para ponerlo y implementarlo. Entonces, dime qué le pido a A y qué le pido a B y qué haces tú en la integración.`
25. `Solo dame las indicaciones a mí de la live para yo ir sabiendo. Pero solo agregar esos cosas.` *(los prompts para Claude Design de la ampliación, sin tocar el proyecto)*
26. `Ya lo agregó https://claude.ai/artifact/2v3FNtTzrha4mxKZ1QVjPw`
27. `Puedes hacer quée no sea por cantidad de aprobaciones si no por proporción de aprobaciones`
28. `Sí, haz push de los commits pendientes.` *(varias veces, una por cada grupo de commits)*
29. `acaba y montas push`
30. `Dame un guion de lo quée deberiamos mostrr en el video que se entrega. Con lo que ya se sabe y lo quée pide el reto para el video`
31. `Y le dije otra cosa que no se iba a mencionar, la de las cadenas y después. O sea, no, al menos en el principio, que la entrada sea otra. En las otras sí pueden propuestas de ahorrar, de financiar proyectos, de todo, pero no como de introducción.`
32. `Nio pongas solo el ejemplio de la ntillera, SI no en general quée pasa con la plata`
33. `y que diseño?`
34. `Listo, eh, ya creé el video, ya miremos qué falta y hay que montar la parte de AI Use y los prompts. Eh, puedes hacerlo, puedes ir agregándolo tú y dame para yo sacar de las otras conversaciones, dame un prompt para yo extraerlas o que ellos lo monten, los agentes.`

## 2. Qué produjo la IA a partir de esos prompts

Archivos y commits, para poder revisarlos:

| Entregable | Dónde | Commits |
|---|---|---|
| Sistema de diseño y pantallas (tokens, componentes, stepper, comprobantes, caja, entregas, cierre, guía viva) | `public/tokens.css`, `public/components.css`, `public/app.css`, `public/index.html`, `public/guia.html`, `public/fonts/` | `47c25eb` a `ad8f3d3` (varios) |
| Lista y creación de círculos en el backend (`GET` y `POST /api/circles`) y columnas de moneda de la caja | `src/server.ts`, `src/db.ts` | `84175d8` |
| Contrato de producto y API v2 (tres tipos, aprobación por proporción, entregas, cierre) | `docs/contrato-api-v2.md` | `6f65554`, `c11620d` |
| Verificación de contraste de los tokens | `scripts/contraste.mjs` | `8b1cd8f` |
| Ayudante para abrir el servidor en la red local | `scripts/lan.mjs` | `58114c0` |
| Guion del video | solo en la conversación (no está en el repo) | |

## 3. Qué verificó la IA y qué no

**Verificado por Claude Code, con pruebas que corrió él mismo:**
- `npm run typecheck`, `npm run op:test` y la sintaxis del script de `public/index.html`.
- La interfaz en un navegador, en móvil (420 px), escritorio (1100 px) y modo claro y oscuro, contra el backend real con una base temporal.
- El flujo de aportes libres, entregas, cierre de natillera, cadena y círculo solidario con **billeteras simuladas** (no con la testnet).
- Contraste de 28 pares de color en claro y oscuro (`node scripts/contraste.mjs`).
- Un recorrido de teclado (selector y diálogo), desborde horizontal y objetivos táctiles de 44 px.

**No verificado por Claude Code (lo debe confirmar una persona):**
- Un pago real o una entrega real desde la interfaz contra la testnet. Los pagos reales con `op:pay` los probó el Rol A (ver `docs/open-payments-evidence.md`).
- Que la Test Wallet acepte el redirect de vuelta a una IP local (`BASE_URL=http://IP:3000`).
- Lectores de pantalla reales (VoiceOver o TalkBack), «Guardar como PDF» y «Compartir» en un dispositivo real.

## 4. Decisiones del equipo que la IA aplicó

- Sin librerías de estilo ni frameworks (regla del proyecto).
- Tres tipos de círculo con reglas distintas, no un monto fijo para todos.
- Aprobación por proporción del grupo en lugar de un número fijo.
- La caja es la billetera de una persona: las aprobaciones son una regla del grupo, no un candado criptográfico. Se dice así en el video y en la interfaz.
- Intereses, préstamos, custodia y autenticación quedan como siguientes pasos.
