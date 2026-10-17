# 09 — Rol D (entrega): video de demo y presentación, hecho con IA

## 1. Herramienta, modelo y rol

- **Herramienta:** Claude Code, dentro de la app de escritorio de Claude (pestaña Code). Motor de video: Remotion 4.0.535 (React + TypeScript), que ya estaba en `~/01_Trabajo/Videos/motion-studio`.
- **Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`), según el prompt de sistema de la sesión.
- **Rol del equipo:** D (documentos y entrega): video de demo, subtítulos y material de presentación. **No se tocó código de la app** (`src/`, `public/`): el repo `LAUCAUX` solo se leyó, salvo este archivo.
- **Dónde está el trabajo:** carpeta aparte, fuera del repo: `~/01_Trabajo/Videos/proyectos/hackathon-convite/` (ver `CAMBIOS.md` y `GUION.md` allí).

## 2. Fechas (hora local, America/Bogota)

- Inicio: 16-oct-2026 ≈ 21:20 (carpeta del proyecto creada a las 21:23, según las marcas de los archivos).
- Último render y esta documentación: 17-oct-2026 ≈ 10:04.
- La hora exacta de cada mensaje no consta; solo las marcas de tiempo de los archivos generados.

## 3. Mensajes del usuario en esta conversación (literales, en orden)

1. Tengo que hacer un video para presentar ese proyecto de las CAUCs en la hackathon. Lo que quiero es que revisen la información, que vamos a mostrar la primera propuesta de lo que tenemos que mostrar y que coja los elementos que están ahí y los aproveches para hacer las animaciones, pero que lo haga sobre la carpeta de videos. Crees una nueva carpeta para, este, para la hackathon. Y sobre él hagas todas las animaciones y que puedas extraer los elementos, los assets  que están en la carpeta de, del repositorio. Ve revisando todo y organizando y te hago una propuesta
2. Propón tú duración y estructura del storyboard; yo apruebo. *(El mensaje traía además un guion pegado, en tabla, de 0:00 a 3:25 —logo, billeteras COP/USD, «Pagar mi aporte», redirección a la Test Wallet, «La caja», entrega, «Así se repartiría hoy», modo oscuro, cierre con próximos pasos— y terminaba con:)* esta fue la propuesta
3. Si quieres quieres que avance con alguna toma o algo me dices
4. Dale
5. prefiero la versión clara. y donde la instañaste? si en video ya estaban los repos de video... y Puedes hacer un motion desing mas profesional para la presentación. con mas animaciones, aprobechando lo que ya esta y mejores transiciones
6. Haz lo que uqede del video  yo lo reviso
7. ESTA casi Perfecta, algunos recuadros estan fuera de lugar cuando hacen focus, es decir el resaltados y si puedes poner algunos sonidos de animación porque ahorita sin audio queda raro. Y dame usa la voz quée acabamos de crear, solo para probar
8. Creo que cogiste el audio qué no era :((
9. era convite-gonzalo-continua.mp3
10. *(Captura de pantalla de Slack con el mensaje de Bradley Dow sobre los requisitos de entrega de la Guía de Supervivencia, p. 9, y este texto dictado:)* Ahorita me está gustando mucho el video. Mucho. ¿Qué pasa? La voz que tiene, pues la verdad no me gusta tan, esa fue generada. Sin embargo, creo que podemos encontrar mejores opciones. Segundo, eh, ya mandaron algún requisito sobre cómo tiene que ser más o menos el video. Y hay una cosa, y es que se tiene que mostrar bien la funcionalidad del pago. O sea, que realmente se vea como si salió la transacción, qué tales. En general, ¿cómo se ve ahí? Pues yo sé que es una animación, eh, se podría terminar de organizar para que se muestre el pago. Hay dos cosas. Uno, la pantalla de Interledgers eh, no está centrada. No sé si es donde llega y le aceptar y tales. No está muy centrada. ¿Qué, qué digamos? Entonces, eso se puede mejorar. El, por un lado. Y esa misma pantalla no muestra específicamente cuando ya el envío está aceptado. Eso me gustaría agregarlo. Bueno, o por lo menos que hay, bueno, sí, que parezca el aceptado, y también que la animación concuerde. Me explico. No, mentira, ya solo eso. O sea, que podría mejorar un poquito, es un poquito. Y... Y no sé, pues como mostrar de que también aparezca en celular. O sea, de que pase una pestaña y se... O sea, que cuando le dé ir la billetera se abra la otra pestaña. Pero queda raro así. Queda un poquito, un poquito raro. Eh, hay un par de cosas que ajustar, pues de posiciones, que son cortos más para arriba, más para abajo, qué tales. Pero en general va súper bien. Súper, súper bien. Me gusta muchísimo. Y te va a mandar la foto porque se, está muy bien, me gusta y quizás algunas cosas se pueden mostrar un poco más rápido.
11. Yo creo que lo cambiamos todo. Quisiera acoplar un poco eso, porque no nos han dicho que el video está malo. Sin embargo, centrarnos en eso es hacer esas correcciones, pero es para que tengan en cuenta como el fondo de lo que se espera mínimo del, del video.
12. Pero solo está reescribiendo la escena 7, es que yo veo muchas cosas. Y ten cuidado, pues deja como un registro o algo para que de pronto no se pierda eso, que la verdad no me parece mal. Hay que ajustarle cositas, pero no me parece mal.
13. Sigue con las correcciones que ya tienes en el registro y renderiza la v3.
14. Voz elegida y ajustes:
15. Ninguno. Voy a buscar una alternativa a todas esas. Pero hazme un favor. Muéstrame cómo quedó la animación. Muéstrame el video completo. Con lo que tenemos ahorita. Y luego miramos lo del audio.
16. Yo siento que los próximos pasos no, porque es una hackathon, ¿cierto? Se evalúa sobre ya lo que se tiene. Necesito que quede un poco más corto el video. La verdad, para las cosas que se muestran, yo siento que algunas cosas, o la mayoría de las cosas, casi que podrían ir en por dos. Siempre y cuando el audio lo permita ir en por dos. Yo siento que podemos hacerlo de tal manera en que queden por dos. Prácticamente. La, o sea, literalmente la mitad. Y me gustaría que me dieras un... Que miras como el guión de lo que tienes de la presentación ahorita, bien detallado.
17. ¿Sabes qué? Por si acaso, hagamos una versión ya la, ya pues crea otra versión distinta donde solo sea la demo, donde no expliques todo lo que hace la app, sino que solo muestre la funcionalidad del pago y que funcione el pago.
18. Hay una cosa. Asegúrate que la confirmación que muestras sea la oficial de la página. Porque pues realmente, al menos en la página de ellos, necesitamos que sea la misma. No nos podemos equivocar en eso. Porque en la demo de las personas que ganaron en México, sí vi que es de verdad muy sencillo en ese sentido. De hecho, muchas veces es literalmente grabar la aplicación y ya. Yo es que esto sabe que quiero que quede muy linda.
19. Sigo sin escuchar el audio, pero yo veo que el audio está bastante bien. No entendí con lo de si creas el flujo real, por eso. Si puedes, grábalo tú. Porque, ajá. Tú eres la que sabe cómo hacerlo bien. Y es rápido. Si quieres, pon a Sonnet a hacer lo que es un poco más rápido. Eh, a Haiku.
20. Nos hicieron 2 recomendaciones. depronto no habra un video bueno que muestres el proceso de que todos aprueben el pago y quée la persona se devuekve, pero no puede extenderse mas el video de la demo poraue la presentación completa es de 5 minutos
21. No, pero sabes que eh, sí se ve muy bien la parte de la solicitud. Eh, devuélvelo como estaba, porque acabó bastante más largo que antes, solo para esa cosa. El problema es que nos dijeron que nos recomendaban mostrar que efectivamente se hizo un cambio en las wallets desde Interledger. O sea, no solo mostrar la aprobación, sino mostrar que efectivamente se generó una transferencia de dinero.
22. Voy a capturar los saldos antes y después y los dejo en proyectos/hackathon-convite/recursos/grabaciones-reales/.
23. Listo
24. El audio está bastante bien, bastante centrado, solo hay un problema y es que cuando leen la aceptación de la wallet eh, ya no aparece el nombre, tiene que aparecer porque si no se nota que o sea, se haría entender de que no fue grabado. ¿Cómo solucionamos eso?
25. O si quieres, si me cales la pantalla, eso que necesitas. Yo creo que lo puedo pedir para volverlo a hacer. Y que solo necesito el pantallazo de la transacción por el mismo valor y con el mismo nombre, para que simplemente lo cambies ahí. Y dime cómo necesitas que lo haga para que quede exactamente con el mismo formato.
26. Pero puedo hacer que se reinicie, ¿no? Eh,
27. Ya puse todo como toma 2 (pero me recomendaron es usar la lista de transsacciones y no la individual)
28. Me recomendaron poner subtitulos en ingles porque hay gente de otras procedesncias. No se si dejarlo solo en ingles o poner los 2, haz lo que recomiendes
29. *(Este mensaje: «Necesito que documentes tu trabajo en este proyecto para el requisito de uso de IA de la hackathon […]», con el formato de dos bloques.)*

Notas: los mensajes 6, 7 y siguientes vienen tal cual llegaron (con sus errores de dictado). Algunos llegaron como respuesta a botones de la app («Propón tú duración…», «Sigue con las correcciones…», «Voy a capturar…»). No hay llaves ni `.env` en esta conversación.

## 4. Qué produje

Todo está fuera del repo `LAUCAUX`, en `~/01_Trabajo/Videos/`. **Commit: ninguno** (no hice commits ni push; `motion-studio` es un repo git y quedó con cambios sin commitear: `package.json`, `package-lock.json`, `tsconfig.json`, `src/Root.tsx`).

| Archivo (en `proyectos/hackathon-convite/`) | Qué es / qué cambia | Commit |
|---|---|---|
| `storyboard.md`, `GUION.md` (generado de `recursos/audio/plan.json`) | Storyboard de 10 escenas y guion detallado con tiempos reales | no consta |
| `composicion/*.tsx` (`ConviteHackathon`, `ConvitePago`, `Escena01–10`, `EscenaTitulo`, `EscenaInterledger`, `AppUi`, `Browser`, `ui`, `theme`, `Logo`) | Video en Remotion, 1920×1080, 30 fps, modo claro. La interfaz de Convite está **recreada en código** con los tokens de `public/tokens.css` | no consta |
| `audio/build-audio.mjs` | Corta la narración por frases, sintetiza efectos de sonido, mezcla, calcula velocidades por escena y escribe `composicion/vozCues.ts` / `pagoCues.ts`; traducciones al inglés (objeto `EN`) | no consta |
| `renders/convite-hackathon-v7-en.mp4` | Video completo, 1:54, con voz, efectos y subtítulos ES+EN | no consta |
| `renders/convite-demo-pago-v6-en.mp4` | Corte «solo demo del pago», 43 s: solicitud → autorización → éxito → «se refleja en Interledger» con capturas reales de la toma 2 | no consta |
| `recursos/` (logo SVG, capturas copiadas del repo, grabaciones de pantalla, fuentes de información) | Material extraído. **No copié** `.env`, `private.key`, `circulos.db` ni `WALLETS.md` | no consta |
| `CAMBIOS.md`, `versiones/*` | Registro de versiones y copias del código de cada versión importante | no consta |
| `~/01_Trabajo/Videos/motion-studio/src/Root.tsx` | Registra las composiciones del proyecto | no consta |
| `~/01_Trabajo/Videos/proyectos/node_modules` (enlace) | Se recreó el enlace a `motion-studio/node_modules` | no consta |

Instalé 370 paquetes npm en `motion-studio` y Remotion descargó Chrome Headless Shell (~170 MB) sin avisarte antes (la regla del proyecto pide avisar). Para elegir voz generé 8 muestras de 12 s con `edge-tts` (servicio en línea de Microsoft); solo envié una frase de prueba del guion.

Lo que **no hice yo**: la narración `convite-gonzalo-continua.mp3` (la generó otra sesión) y las capturas reales de las tomas 1 y 2 (las hizo el equipo/otra sesión; yo solo las usé).

## 5. Qué verifiqué yo

Todo con herramientas locales; **ninguna prueba de pago, ni simulada ni real**.

- `npx tsc --noEmit` en `motion-studio` tras cada cambio de código: sin errores al final de cada versión (en pasos intermedios hubo errores de variables sin usar y de tipos que corregí).
- `npx remotion still` / renders y revisión visual de fotogramas del MP4 resultante (contact sheets): escenas, subtítulos, solapes, posición de resaltados.
- `ffprobe` de los renders: v2 = 215 s, v3 = 189 s, v4–v7 completo = 114,5 s, demo = 39,6 / 43,0 s; 1920×1080, pista de audio AAC 48 kHz estéreo.
- `ffmpeg -af ebur128` de la mezcla v2: pico −3,5 dBFS (no hay recorte).
- `md5` de `convite-gonzalo-continua.mp3` comparado con la copia usada: idénticos.
- `mlx_whisper` local (modelo `whisper-large-v3-turbo`) para transcribir la narración y sacar el tiempo de cada frase.
- Lectura del código de la app (`public/index.html`, `src/server.ts`) para comprobar que «Abrir mi billetera» es un enlace en la misma pestaña y que tras Accept el servidor redirige a `…/finish` y luego a `?ok=1`.

## 6. Qué NO pude verificar (debe confirmar una persona)

- **Nunca escuché el audio.** Solo comprobé que existe y su duración. Niveles, sincronía voz-imagen y calidad de la voz las debe juzgar una persona.
- **Las traducciones al inglés son mías**: deben revisarse. «caja» quedó como «shared pot».
- **Fidelidad de la interfaz:** la UI de Convite del video es una recreación en código comparada a ojo con las capturas; no es grabación de la app. Las capturas oscuras reales (`pago-resumen`, `pago-listo`) existen pero no se usan.
- **Escenas 5–8** (caja, aprobación, entrega, reparto): son animación con **datos de ejemplo** (aportes USD 10/10/5, ayuda de USD 8,00, reparto 40/40/20). Nunca corrí el backend v2 ni vi esos flujos funcionando; solo leí textos del código. La pantalla de autorización de la caja (escena 7) es una representación (solo el encabezado de la billetera es real).
- **Direcciones de la barra del navegador** (`localhost:3198/?circle=1`, `wallet.interledger-test.dev`): puestas a mano, no verificadas en el video.
- **Pagos y saldos:** no ejecuté ningún pago. Todo lo real (31.750,27 COP → 10,00 USD, saldos antes/después, `COMPLETED`) viene de las capturas y de `TOMA-2026-10-17.md` del equipo. No verifiqué esas cifras contra la testnet.
- Intenté usar Claude in Chrome (no estaba conectado) y el navegador integrado (vi solo la pantalla de inicio de sesión de la Test Wallet; **no inicié sesión**). No pude grabar el flujo real yo misma.
- La prueba de voz clonada con IndexTTS **falló** (`mlx-indextts` no arranca); no se probó.
- Que el video cumple los requisitos del evento (guía de supervivencia, p. 9) y el límite de tiempo: lo conozco solo por el mensaje de Bradley Dow que pegó el usuario; no leí la guía.

## 7. Decisiones del equipo que apliqué

- Versión **clara** (no oscura) del video; fondo y animaciones más «profesionales», con transiciones.
- Usar la voz `convite-gonzalo-continua.mp3` solo como prueba; el audio definitivo lo decide el equipo.
- Quitar los «próximos pasos» y acortar: casi todo a ≈2× según lo que permite la voz (3:35 → 1:54).
- Crear una versión distinta de **solo demo del pago**; mantener la de ≈40 s (se descartó una de 56 s con aprobación y entrega).
- Mostrar el cambio real en las wallets de Interledger con capturas reales (toma 2), usando la **lista de transacciones** y no el detalle individual.
- Representar el flujo como lo hace la app: misma pestaña, sin pantalla «aceptado» inventada.
- Subtítulos **bilingües** (español arriba, inglés debajo) por el público internacional.
- Guardar un registro de versiones (`CAMBIOS.md`) y copias en `versiones/` para no perder lo que ya gustaba.

---

## BLOQUE 2 — párrafo para AI_USAGE.md (rol D)

2026-10-16/17 — Claude Code (Claude Sonnet 5.5), rol D: video de demo y presentación hechos con Remotion en `~/01_Trabajo/Videos/proyectos/hackathon-convite/` (fuera del repo). Con IA se armó el storyboard, la interfaz de Convite recreada en código, las animaciones y transiciones, los efectos de sonido, los subtítulos ES+EN y dos cortes: completo (1:54) y solo demo del pago (43 s) con capturas reales de la Test Wallet (toma 2). Prompt real: `prompts/09-D-video-demo-remotion.md`. El equipo decidió el guion, la voz de prueba, los cortes y el uso de capturas reales, y grabó las capturas; no se ejecutó ningún pago desde esta herramienta. Validó la IA solo con `tsc`, `ffprobe` y revisión de fotogramas. Límites: el audio no se escuchó, las traducciones al inglés y la fidelidad de la interfaz deben revisarse a mano, y las escenas de aprobación, entrega y reparto usan datos de ejemplo, no un flujo grabado.
