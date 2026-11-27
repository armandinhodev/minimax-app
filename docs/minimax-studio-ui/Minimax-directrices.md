# MiniMax Studio — Mesa de montaje

Una mesa de edición mantiene la orden de trabajo junto a su resultado para que el operador pueda ajustar, despachar y revisar sin perder de vista lo que pidió. La firma visual es la **placa de reproducción**. En audio lleva una forma de onda y una regla de tiempo sobre pizarra. En video la regla se acopla al fotograma. En imagen deja toda la superficie al contenido y lleva dimensiones, formato y descarga al pie. El cobre se reserva para la próxima acción y la selección actual.

## Cómo leer las láminas

Las láminas 01–19 siguen el orden del inventario de rutas. Las 20–22 muestran adaptación a móvil y tablet. Las 23–26 cubren cover, voces propias, render en curso y disponibilidad local. El contenido y los valores de muestra son ilustrativos. Modelos, tamaños válidos, voces y plantillas deben salir de los datos actuales de la app. Todos los rótulos que llegan al operador están en inglés.

## Tipografía

Usar **Nimbus Sans** para la interfaz y **Liberation Mono** para parámetros técnicos. Son las familias empleadas para renderizar las láminas. Si el paquete web necesita sustitución local, mantener una reserva genérica sans-serif o monospace. Ajustar el corte de línea de prompts y resultados a 76–80 caracteres por renglón, preservando saltos de letras y subtítulos.

| Rol | Tamaño / interlínea | Peso | Tracking | Uso |
|---|---|---:|---:|---|
| Título de área | 46 / 48 px, móvil 34 / 37 | 700 | −1,8 px, móvil −1 px | Una vez por ruta |
| Título de panel | 23 / 29 px | 700 | −0,55 px | Formulario o resultado |
| Subtítulo | 17 / 24 px | 700 | 0 | Grupo de voces, nombre de asset |
| Cuerpo | 16 / 23 px | 400 | 0 | Entradas y prosa |
| Etiqueta y botón | 14 / 20 px | 700 | 0 | Verbo o nombre breve |
| Ayuda | 13 / 19 px | 400 | 0 | Restricciones junto al control |
| Dato técnico | 13 / 20 px | 400 | 0 | ID, tiempo, cantidad, tamaño y estado |
| Lectura principal | 26 / 31 px | 700 mono | 0 | Conteos del dashboard y Library |

Aplicar numerales tabulares. El ID completo puede partirse en pantallas estrechas y se copia íntegro. Reservar sentence case para la UI. Preservar marcas, siglas, extensiones y nombres reales de modelo.

## Shell y composición

- **1440 px.** Barra lateral izquierda fija de 220 px. La marca y Overview llevan al dashboard. Las ocho áreas comparten un orden estable. Las subrutas se despliegan debajo del área activa cuando hay varias; la página actual lleva fondo suave, marca vertical y aria-current. Sign out queda al pie. El acceso conserva su hoja centrada.
- **Banco de trabajo.** Ancho útil de 1152 px para rutas estándar y todo el ancho restante en Image, Music y Video. Composición y resultado ocupan 7 y 5 fracciones con 16 px de separación. Speech usa dos mitades porque ambos paneles producen audio. La leyenda técnica del resultado sigue al contenido.
- **Paneles.** Borde de separación derivado de regla, radio exterior 10 px, interiores de 5 px y cabecera integrada con pictograma y propósito. Padding de 20–22 px en escritorio y 16 px en móvil. La jerarquía se construye con superficie y agrupación, sin sombras. Alinear etiquetas arriba para que el largo del nombre no desplace una columna. Combinar dos campos cortos solo cuando sean comparables.
- **Placa.** Fijar con sticky únicamente cuando su altura completa quepa bajo la navegación. Si el contenido crece, dejar que se desplace con la página. La reproducción y la descarga pertenecen a la misma placa.
- **Anchos intermedios.** Entre 900 y 1199 px la barra ocupa 190 px. Por debajo de 1100 px el resultado se apila tras los parámetros. Por debajo de 900 px la navegación se abre con Menu en un cajón desde la izquierda. La lámina 22 muestra el estado cerrado a 820 px.
- **390 px.** Margen de 18 px, una columna, chips que saltan de línea, botones de al menos 44 px y métricas de a dos. Orden de trabajo: componer, despachar, leer estado y retirar. Al despachar desde una hoja larga, anunciar el estado y ofrecer acceso al resultado. No mover el foco durante el streaming. En cajón abierto, mostrar las subrutas del área activa y permitir desplazamiento vertical interno.

### Wireframes de estructura

El lateral y el área de trabajo forman dos columnas de la página. Las filas siguientes muestran la distribución interna de cada ruta.

```text
Dashboard
| Overview [active] | Studio overview                          |
| Speech            | Generations / Completed / Assets         |
| Other areas       | Areas index          | Recent creations  |

Speech /tts
| Speech            | Speech generation                        |
|   Generate audio* | Generate audio       | Streaming TTS     |
|   Voice gallery   | Text / voice / model | Transport / voice |
|   Clone voice     | Generate / player    | Start streaming   |
|   Design voice    | Download audio       | Live playback     |

Image /image
| Image             | Image generation                         |
|   Generation*     | Creative brief       | Results           |
|   Image to image  | Prompt / model       | Image preview     |
| Other areas       | Format / Generate    | Specs / Download  |

Library /library
| Production areas  | Library                                  |
| Library [active]  | Totals / type filters                    |
|                   | Asset / specs        | Asset / player    |

Mobile / closed                  Mobile / open
| Menu   MiniMax Studio |        | MiniMax Studio   Close |    |
| Area title            |        | Overview               |    |
| Parameters / Generate |        | Areas / active branch  |    |
| Result / Download     |        | Sign out               |    |
```

## Controles e interacción

| Elemento | Tratamiento y comportamiento |
|---|---|
| Primario | Cobre sólido, texto blanco, verbo concreto. Durante el envío, bloquear envíos duplicados y mantener ancho y foco. |
| Secundario / ghost | Contorno de regla para copiar, abrir o descargar. Ghost para navegación contextual, subrayado visible al enfocar. |
| Destructivo | Borde rojo y verbo explícito. En el diálogo, nombrar el elemento, explicar qué se quita y ofrecer Cancel como foco inicial. Confirmación roja sólida con texto blanco. |
| Deshabilitado | Superficie workspace, texto secundario, icono o explicación asociada. En cover, explicar por qué el modo instrumental está inactivo. |
| Campo / textarea | Label persistente, borde funcional, error debajo. Contador alineado al campo. Un asterisco al lado del label y una leyenda “Fields marked * are required.” por hoja que la necesite. Aplicar required y aria-required según el control. |
| Select y dropdown | Permitir flechas, Enter y Escape. En voces, buscar por nombre o ID y anunciar idioma y conteo. Restaurar el foco al disparador al cerrar. |
| Tabs / selección | Ruta activa con línea y peso. En elecciones excluyentes, añadir marca de selección y exponer aria-checked o aria-selected según el patrón. |
| Switch / slider | Estado del switch por posición y texto accesible. En slider mostrar el valor y su unidad, permitir flechas y edición precisa si el parámetro lo requiere. |
| Dropzone / progreso | “Choose file” accesible por teclado y alternativa de arrastre. Mostrar nombre, progreso real y waveform o miniatura cuando se haya leído el archivo. Error junto al archivo y opción de reemplazar. |
| Badge / aviso | Estado con símbolo y palabra. La alerta indica qué ocurrió y qué puede hacer el operador. Usar texto seleccionable para IDs y detalles de API. |
| Audio / video | Play/Pause, posición y duración tabulares, búsqueda por teclado y descarga disponible tras éxito. Conservar los controles nativos equivalentes para volumen y accesibilidad. Proveer subtítulos cuando estén disponibles. |
| Resultado largo | Texto seleccionable, preformateado si es JSON o SRT. Ajuste de línea y acción Copy con confirmación discreta. |
| Carga | Skeleton estático que reserva el tamaño final. Mostrar progreso numérico solo si lo devuelve el servicio. Mantener el resultado previo identificado durante una nueva ejecución. |
| Menú móvil / diálogo | Atrapar foco, Escape para cerrar, fondo inerte y foco restaurado. En un error de formulario, enfocar el primer campo inválido y asociar el mensaje mediante aria-describedby. |

## Estados de trabajo

| Estado API | Etiqueta y señal | Acción o contenido |
|---|---|---|
| queued | Queued, reloj, run | Mostrar ID y espera. |
| preparing | Preparing, preparación, run | Conservar fuentes y parámetros visibles. |
| running | Running, círculo parcial, run | Mostrar etapa y cancelación cuando esté disponible. |
| processing | Processing, círculo parcial, run | Mostrar detalle real de procesamiento. |
| succeeded | Succeeded, tilde, ok | Habilitar reproducción, copia o descarga según resultado. |
| failed | Failed, cruz, error | Conservar entradas y explicar cómo corregir o reintentar. |
| cancelled | Cancelled, cuadrado, muted | Conservar referencia de la tarea y permitir nueva composición. |

JobStrip presenta Compose, Dispatch, Render y Retrieve. Marcar pasos completados con tilde, actual con borde superior grueso y aria-current="step". El backend decide la etapa efectiva. Cancelled y Failed retienen la última etapa alcanzada. Un resultado vacío explica dónde se verá la salida. Ante cero coincidencias, ofrecer limpiar filtros. Si venció un TTL, mantener metadatos y explicar cómo recrear el recurso. Ante falta de clave de sesión, usar el acceso existente en /login.

## Movimiento y accesibilidad

Mover únicamente aquello que confirma una acción del operador. El switch y la apertura del cajón pueden transicionar 120–160 ms. Desactivar transiciones con prefers-reduced-motion. El cursor de reproducción sigue el tiempo real. El indicador de carga queda estático. Enviar cambios de estado a una región aria-live="polite" al cambiar de etapa, agrupar fragmentos de streaming y reservar alertas inmediatas para errores que requieren intervención. El contador TTL se anuncia al vencer, sin leer cada segundo.

Para foco sobre fondo claro, usar anillo cobre de 3 px separado del componente por 2 px blancos. Sobre transporte, anillo blanco. Distinguir links en párrafos mediante subrayado. Usar la tabla de pares de la paleta para texto y controles. En implementación, probar teclado completo, zoom, lector de pantalla, foco tras confirmación y reducción de movimiento. Los PNG documentan estados visuales estáticos.

## Decisiones por ruta

| Lámina y ruta | Decisión de composición y comportamiento |
|---|---|
| 01 /login | Hoja centrada sin navegación. Solicitar únicamente Access key. Mostrar “Invalid access key” junto al campo si falla. |
| 02 / | Reunir los tres totales en una banda y las ocho áreas en un índice con propósito y conteo. Library muestra assets. En Recent creations, una vista previa y filas con fecha. Si está vacío, “Generate your first asset” enlaza con un motor. |
| 03 /tts | Dos hojas independientes. El clip final conserva reproductor y descarga. Streaming ofrece transporte, voz y reproducción en vivo. Su aviso de persistencia es permanente. Texto hasta 10.000 caracteres. |
| 04 /voices | Agrupar voces de sistema por idioma, nombre de idioma y bandera. En My voices mostrar tipo, creación, vencimiento y confirmación de Delete. Distinguir “No system voices available” de “No saved voices yet”. |
| 05 /voices/clone | El archivo pasa de zona de carga a waveform. En éxito, el ID de voz y el TTL de 7 días quedan juntos, con accesos a TTS y galería. Error de formato o duración junto al archivo, error de API junto al envío. |
| 06 /voices/design | La primera salida es una prueba. Separar Accept and save de Regenerate. Tras guardar, confirmar, indicar 7 días y ofrecer Use in TTS y Open voice gallery. |
| 07 /asr | Formato y timestamps comparten grupo. Listar JSON, JSON verbose con hablantes, SRT y VTT, y granularidad de segmento, oración o palabra. La placa adapta texto, copia y descarga al formato real. Vacío: “The transcription appears here once MiniMax finishes.” |
| 08 /text | Agrupar modelo y superficie upstream antes del mensaje. Usar You y Assistant en el transcript. Mantener razonamiento colapsado si existe. Durante respuesta, Thinking...; vacío: “Send a message to start.” |
| 09 /image | Alinear prompt y contador, modelos de calidad/velocidad, proporciones y parámetros de salida. El tamaño válido se deriva de área, relación o tamaño personalizado. Cantidad 1–10. En batch, una descarga por imagen y conteo de aciertos/fallos. Vacío “No result yet” con indicación de generar. |
| 10 /image/image-to-image | Las referencias preceden al prompt. Mostrar miniaturas y contador hasta 16, con acción de quitar accesible por referencia. Reutilizar el panel Results de Image. |
| 11 /music | El modelo controla los campos. music-3.0 ofrece instrumental. music-cover pide Cover feature ID, cambia el label de estilo y el verbo a Generate cover. El aviso del servicio convive con la ficha MP3. |
| 12 /music/lyrics | Write pide un prompt y Edit muestra letras existentes. Conservar saltos de línea y tags de estructura. Copiar y pasar a generación musical desde la placa. |
| 13 /music/cover-preprocess | Un selector excluyente elige URL o archivo. Validar únicamente la fuente activa. Permitir letras opcionales. En éxito, ID copiable y TTL de 24 h junto a Use in cover generation. |
| 14 /video/generation | Modelo determina resolución, duración y opciones disponibles. Expansión solo en Max. Distinguir primer/último frame de las referencias generales. Task ID y JobStrip preceden al resultado. Ofrecer Cancel task durante fases cancelables y Download al recuperar el clip. |
| 15 /video/context-ir | Mantener duración y aspecto con el contexto de entrada. La salida enriquecida es texto de solo lectura con estado y cinta. |
| 16 /video/regeneration | Elegir ID o URL de fuente 768P, después prompt y referencias. Mostrar resolución 2K e ID de la nueva tarea en el resultado. |
| 17 /video/tasks | Filtros de estado y tipo antes de la lista. Mostrar tipo, fecha, ID, estado y acciones válidas. “No video tasks yet” inicia generación. “No matching tasks” permite restablecer filtros. Retención visible de 7 días. |
| 18 /video-agent | El catálogo oficial determina campos y descripción. La maqueta usa una plantilla ilustrativa. Image URL y Text llevan asterisco cuando la plantilla los exige. Mantener el espacio del clip reservado en vacío. |
| 19 /library | Totales y filtros preceden a los assets. Cada ficha reúne fecha, tipo, disponibilidad, prompt y metadatos aplicables al medio. Audio y video descargan su propio formato. Un cover vigente ofrece Use in cover generation. Conservar datos del asset si venció el recurso remoto o falta el archivo local. Remove requiere confirmación. |
