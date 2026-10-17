# Prompts reales — Sistema de diseño e interfaz de "Convite" (Claude Design + Rol C)

Este archivo reúne los prompts principales enviados a **Claude Design** y a **Claude Code (Rol C: `public/`)** para diseñar y construir el sistema de diseño de Convite (`public/tokens.css`, `public/components.css`, `public/guia.html`, `public/index.html`) y el material visual del demo.

---

## 1. Prompt inicial de Claude Design: Guía de diseño completa (v1)

Necesito una guía de diseño completa (design system) para "Convite", una app web móvil para natilleras, cadenas y círculos solidarios digitales en Colombia. Un grupo de personas que ya se conocen aporta cada ronda un monto fijo a una caja común desde su propia billetera digital (cada una puede tener una moneda distinta). Todos ven un libro público de aportes, los desembolsos requieren varias aprobaciones, y el círculo tiene una reputación calculada del libro. La app coordina, no custodia dinero. Funciona sobre Open Payments (Interledger) con billeteras de prueba.

PÚBLICO: personas no técnicas, muchas mayores de 35 años, que usan el celular (390px de ancho es el diseño principal; escritorio es secundario). Textos en español claro y sin jerga financiera.

PERSONALIDAD: cálida, comunitaria y confiable. Como una reunión de vecinos de confianza, no como un banco frío. Esquinas redondeadas, mucho aire, tono cercano. Evitar el aspecto de cripto/fintech genérico.

ENTREGABLES:
1. Marca: propón el wordmark "Convite" (y un símbolo simple que evoque reunirse en círculo), con versión clara y oscura.
2. Paleta: propón 2 alternativas de color principal y recomienda una. Para la elegida entrega escalas completas (primario, secundario/acento, neutros) y colores semánticos: éxito, advertencia, error, información, y los estados de un aporte (esperando autorización, confirmado, falló). Da los valores hex y la relación de contraste de cada par texto/fondo.
3. Modo claro y modo oscuro, ambos completos, con los mismos nombres de token.
4. Design tokens con nombres semánticos (por ejemplo --color-fondo, --color-superficie, --color-texto, --color-primario, --color-exito...), no solo nombres de color. Incluye tokens de: color, tipografía, espaciado (escala de 4px), radios, sombras/elevación, bordes, tamaños mínimos de toque (44px), duraciones de animación y z-index. Entrégalos como variables CSS (:root y [data-theme="dark"]).
5. Tipografía: una familia legible y amable (de Google Fonts, con fallback a system-ui). Escala tipográfica móvil con tamaño, peso e interlineado. Cifras tabulares para los montos.
6. Componentes con todos sus estados (normal, hover, foco, presionado, deshabilitado, cargando, error): botón primario/secundario/peligro/fantasma, tarjeta, chip de estado, fila del libro de aportes, avatar de miembro, selector "Estoy viendo como", campo de formulario, aviso/toast (éxito, error, info), diálogo de confirmación, estado vacío, y barra de progreso de aprobaciones ("1 de 2").
7. Componente stepper del flujo de pago con 4 pasos: Solicitud → Autorización → Pago → Listo. Con estados: pendiente, activo, completado, error. Es el momento más importante de la demo, debe leerse a la primera.
8. Skeletons: para tarjeta de reputación, lista de miembros, filas del libro y desembolsos. Con animación sutil que respete prefers-reduced-motion.
9. Pantallas de ejemplo a 390px en claro y oscuro: (a) Inicio del círculo (tarjeta "Tu próximo paso", reputación, miembros, libro de aportes, desembolsos), (b) Resumen antes de pagar ("Se te cobrará X en tu moneda y tu círculo recibe Y"), (c) Pago en curso con el stepper, (d) Éxito, (e) Error comprensible, (f) Estado de carga con skeletons, (g) Estado vacío.
10. Accesibilidad (WCAG 2.2 AA): contraste mínimo 4.5:1 en texto y 3:1 en componentes, anillo de foco visible, objetivos de 44px, no depender solo del color (los estados llevan ícono y texto), soporte de prefers-reduced-motion y de zoom del texto al 200%, lectura por lector de pantalla (roles ARIA sugeridos para stepper, toasts y barra de progreso).
11. Microcopy: 10 ejemplos de textos del producto en tono cálido y claro (botones, errores, estados vacíos, confirmaciones).

RESTRICCIONES TÉCNICAS: la implementación será HTML y CSS planos con JavaScript simple, SIN framework ni librerías de estilos. Por eso todo debe poder expresarse con variables CSS y clases simples. Íconos como SVG en línea. Sin imágenes pesadas.

FORMATO DE SALIDA: la guía visual navegable, y aparte un bloque de CSS con todos los tokens listo para copiar, más una lista de los componentes con el nombre de clase sugerido.

---

## 2. Prompt de ampliación v2 (1/3): Tipos de círculo, aporte libre y la caja

Amplía el sistema de diseño "Convite" que ya existe. Mantén exactamente los mismos tokens, el prefijo cv-, la nomenclatura BEM en español, modo claro y oscuro, 390px primero, HTML y CSS planos sin librerías, y los criterios de accesibilidad WCAG 2.2 AA. No cambies nada de lo que ya está; solo agrega. Si necesitas un token nuevo, dilo y justifícalo (prefiero reutilizar los existentes).

CONTEXTO DE PRODUCTO
Convite tiene tres tipos de círculo con reglas distintas:
- Cadena: todos aportan el mismo monto fijo cada ronda; en cada ronda una persona recibe toda la caja, por turnos.
- Natillera: cada persona aporta lo que quiera (montos distintos). La plata se queda en la caja y al cierre se reparte en proporción a lo aportado.
- Círculo solidario: cada persona aporta lo que quiera. Cualquiera puede pedir una ayuda con monto y motivo, y el grupo la aprueba.
Siempre mostrar montos con moneda y puntos de miles ("USD 12,35", "COP 50.000"). Voz de "tú", frases cortas, vocabulario: aporte, caja, libro, entrega, ronda, billetera. Nunca "desembolso", "wallet", "pool".

AGREGAR (cada uno con todos sus estados: normal, hover, foco, presionado, deshabilitado, cargando, error, en claro y oscuro):
1. TipoCirculo: tres tarjetas seleccionables (radio) para elegir Cadena, Natillera o Círculo solidario, cada una con ícono, nombre, una frase de qué es y una línea de "cómo se aporta" y "cómo se recibe". Con foco visible y estado seleccionado que no dependa solo del color. Variante compacta para usarla como chip de tipo en listas y encabezados.
2. PantallaCrearCirculo (390px): nombre, selector de tipo (componente anterior), billetera de la caja, aprobaciones (1 a 4), y el campo "Aporte por ronda" que SOLO aparece si el tipo es Cadena. Muestra las tres variantes de la pantalla (una por tipo) y un estado de error por campo.
3. PantallaCirculos: lista "Tus círculos" con tarjetas (nombre, chip de tipo, cantidad de miembros, ronda), estado vacío con botón "Crear un círculo", y estado de carga con skeletons.
4. PantallaQuien: "¿Quién eres en este círculo?" con la lista de personas (avatar, nombre, moneda de su billetera) y una tarjeta "¿No estás en la lista?" con el botón "Crear mi usuario". Más la pantalla del formulario "Crear mi usuario" (nombre y dirección de billetera, con ejemplo "$ilp.interledger-test.dev/camila" y errores de campo).
5. CampoMonto: campo de monto con la moneda como prefijo fijo, ayuda con ejemplo, validación ("Escribe solo números mayores que cero, por ejemplo 10.") y estado de error. Úsalo en "Pagar mi aporte" para natillera y círculo solidario.
6. PantallaAporteLibre: pantalla previa al resumen de pago, "¿Cuánto vas a aportar?", con el CampoMonto, atajos opcionales de monto, y una línea "Antes de pagar verás cuánto sale de tu billetera". Debe verse bien cuando el aporte es fijo (cadena: el monto aparece sin campo editable).
7. ResumenCaja: tarjeta "La caja" con saldo grande, y debajo Aportado, Entregado y Reservado (entregas ya aprobadas que aún no salen), y "Libre para entregar". Con una barra o medidor simple. Estados: caja vacía, con saldo, con reservas.
8. PartesCaja (natillera): lista "Así se repartiría hoy" con una fila por persona (avatar, nombre, % de la caja, monto que le tocaría y barra proporcional), ordenada de mayor a menor, y resaltada la fila de "tú". Con aria-valuetext legible. Incluye una nota: "Es una estimación: el reparto real se hace al cierre."
9. Skeletons para los componentes nuevos (tarjetas de círculo, ResumenCaja, PartesCaja).

Entrega el HTML de cada componente en su vista previa, la lista de clases nuevas, y los textos (microcopy) de los estados de error y vacío.

---

## 3. Prompt de ampliación v2 (2/3): Entregas reales desde la caja

Continúa ampliando el sistema Convite. Mismas reglas del prompt anterior (no cambies lo existente, mismos tokens, claro y oscuro, accesible).

CONTEXTO
Una entrega es plata que sale de la caja hacia la billetera de una persona. Pasa por estados: Pedida → Aprobada → Enviando → Entregada (o Falló). Primero la aprueban M personas; luego se envía. Para enviar, el dueño de la billetera de la caja debe autorizar en su billetera (como cuando alguien paga un aporte). Por eso cualquier persona puede pulsar "Enviar la entrega", pero la autorización la hace quien tiene la billetera de la caja. La entrega sale con un monto fijo de la caja y la billetera de la persona que recibe lo recibe en SU moneda según la cotización.
Textos de error ya definidos que debes usar tal cual:
- "La caja no tiene saldo suficiente para esta entrega."
- "Faltan aportes de esta ronda: todavía no se puede entregar."
- "La cotización venció, vuelve a intentar."
- "La billetera de la caja rechazó el pago."
- "No pudimos conectar con la billetera de prueba, intenta de nuevo."

AGREGAR (todos los estados, claro y oscuro):
1. EstadoEntrega: chips para Pedida, Aprobada, Enviando, Entregada y Falló, siempre con ícono y palabra.
2. TarjetaEntrega: reemplaza a la tarjeta de entrega actual. Muestra a quién va, el motivo (opcional), el monto, la barra de aprobaciones existente, el chip de estado, y la acción que corresponda: "Aprobar esta entrega" (si te falta votar), "Enviar la entrega" (si está aprobada) o nada. Debajo de "Enviar la entrega", una nota: "La autoriza quien tiene la billetera de la caja." En estado Entregada muestra "Ver comprobante". En Falló, el motivo y "Intentar de nuevo". Variantes: cadena (muestra "Te toca recibir" o "Turno de Marta"), círculo solidario (con motivo) y reparto de natillera (una persona de varias).
3. PedirEntrega: formulario del círculo solidario con CampoMonto, motivo (opcional, máximo 80 caracteres) y mensaje de saldo libre ("Hay COP 120.000 libres en la caja"). Estados: error por monto mayor que el saldo libre, y botón deshabilitado con su explicación.
4. AvisoCadena: aviso "Faltan aportes de esta ronda" con la lista de quién falta, y la versión "Ya están todos los aportes: la entrega se puede pedir".
5. LineaTurnos (cadena): línea de tiempo horizontal u orden vertical con los turnos; ya recibió (check), le toca ahora (resaltado), siguen (pendiente). Accesible con lista ordenada y texto.
6. StepperEntrega: variante de StepperPago para entregas, con 4 pasos: Solicitud, Autorización de la caja, Envío, Listo; mismos estados (pendiente, activo, completado, error) y detalle en cada paso, por ejemplo "Abre la billetera de la caja y aprueba el envío". Versión compacta.
7. Pantallas 390px en claro y oscuro, con el flujo completo de una entrega:
   a. PantallaEntregaResumen: "Sale de la caja USD 30,00" y "Recibe Mamá COP 95.300" (monto y moneda de cada lado), el aviso "Convite no guarda tu plata", y el botón "Continuar a la billetera de la caja".
   b. PantallaEntregaPago: StepperEntrega en Autorización, con "Te esperamos aquí".
   c. PantallaEntregaExito: "¡Listo! La entrega salió", con el resumen y "Ver comprobante".
   d. PantallaEntregaError: una por cada error de la lista, con "qué pasó, si salió plata y qué hacer". Solo afirma "no salió plata de la caja" cuando el error ocurre antes de crear el pago.
8. ComprobanteEntrega: variante de Comprobante: "Entrega de la caja", quién recibió, fecha y hora, salió de la caja, llegó a su billetera, billetera de la caja y de destino, referencia (en monoespaciada) y el pie "Este comprobante sale del libro público. Convite no guarda el dinero."
9. Skeletons para TarjetaEntrega y LineaTurnos.

Entrega el HTML de cada componente en su vista previa, las clases nuevas, y el microcopy de los nuevos estados.

---

## 4. Prompt de ampliación v2 (3/3): Rondas y cierre de natillera

Último bloque para el sistema Convite. Mismas reglas de siempre.

CONTEXTO
En natillera y círculo solidario las rondas (por ejemplo, meses) se abren a mano: nadie recibe por ronda. La natillera termina con un CIERRE: la caja se reparte entre todas las personas en proporción a lo que aportó cada una. El cierre lo propone alguien, lo aprueban M personas, y luego se envía una entrega a cada persona (una autorización por cada una en la billetera de la caja). Cuando todas salen, la natillera queda cerrada.

AGREGAR (todos los estados, claro y oscuro):
1. TarjetaRonda: tarjeta "Ronda 3" con el botón "Abrir la ronda siguiente" y su explicación ("Empieza un nuevo mes. Los aportes anteriores se conservan en el libro."), más un estado deshabilitado en cadena con el texto "En una cadena la ronda cambia sola cuando se paga la entrega".
2. ReputacionPorTipo: la tarjeta de reputación con el texto que corresponda: cadena ("18 de 20 aportes llegaron a tiempo"), natillera y círculo solidario ("7 de 8 personas aportaron en esta ronda"). Sin cambiar la forma de la tarjeta actual.
3. PantallaProponerCierre (natillera): resumen de la caja, la lista PartesCaja con lo que recibiría cada persona, la advertencia "Al cerrar se envía una entrega a cada persona y la natillera termina", y los botones "Proponer el cierre" y "Todavía no". Estado deshabilitado cuando la caja está vacía.
4. TarjetaCierre: seguimiento del cierre con tres momentos: Propuesto (barra de aprobaciones), Aprobado (lista de repartos con botón "Enviar" por persona) y Enviando. Cada fila de reparto muestra avatar, nombre, monto, EstadoEntrega y "Enviar" o "Ver comprobante". Resumen "2 de 3 entregas enviadas" con progreso.
5. PantallaCierreCompleto: "Tu natillera se cerró", resumen de lo repartido por persona, total, y "Ver el libro". Debe verse como un cierre cálido, sin confeti ni emojis.
6. PantallaCierreProgreso (390px): el cierre a mitad de camino, con una persona enviada, una en curso y una pendiente.
7. Estados de error y avisos para cierre (saldo insuficiente, cierre ya propuesto, falló un envío con "Intentar de nuevo" sin afectar los ya enviados).
8. Skeletons para TarjetaCierre.

Para terminar: una versión de escritorio (hasta 1200px) de la pantalla de Inicio que reúna ResumenCaja, PartesCaja, TarjetaEntrega, LineaTurnos, TarjetaRonda y TarjetaCierre según el tipo de círculo, indicando qué bloques aparecen en cada tipo. Y una sección nueva en la guía, "Cómo cambia la interfaz según el tipo de círculo", con una tabla de qué ve cada tipo.

---

## 5. Prompt para diapositivas y piezas visuales del video ("Entra, se ve, sale")

Crea una presentación corta de Convite, usando el mismo sistema de diseño (paleta marea, esmeralda y coral; tipografía Figtree; modo claro y oscuro; voz de "tú", frases cortas). 16:9, texto grande y legible en un video.

Convite: círculos de confianza (natilleras, círculos solidarios) donde cada persona aporta desde su propia billetera, en su propia moneda, sobre Open Payments (Interledger). La app coordina; no guarda dinero. Solo billeteras de prueba.

Diapositivas:
1. Apertura: logo y "Cuentas claras entre quienes se confían".
2. El problema: ahorrar y apoyarse entre conocidos funciona por confianza, pero las cuentas viven en un cuaderno o un chat; y si parte de la familia está en otro país, en otra moneda, es peor.
3. La idea: esquema de tres pasos, "Entra, se ve, sale", con íconos de billetera, libro y caja, y la nota "Convite no guarda la plata".
4. Cómo se hace un pago: Solicitud, Autorización, Ejecución, Éxito, como línea de pasos (mismo estilo del stepper de la app).
5. Cómo sale la plata: aprobación por proporción del grupo (la mitad, la mayoría o todos), envío desde la caja y llegada a la billetera de la persona en su moneda.
6. Qué viene después: custodia con una entidad vigilada (Decreto 1357/2018), intereses y préstamos, verificación de identidad, y habeas data. Presentarlos como siguientes pasos, no como funciones actuales.
7. Cierre: logo, nombre del equipo y enlace del repositorio.

Además, un marco de celular de 390 px (claro y oscuro) para pegar capturas, y etiquetas pequeñas ("1 Solicitud", "2 Autorización", "3 Ejecución", "4 Éxito") para superponer sobre la grabación.
