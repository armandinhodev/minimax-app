# Brief de diseño — MiniMax Studio

Documento para una IA especializada en diseño de producto. Describe qué es la
app, qué pantallas existen hoy, cómo se comportan y qué necesitamos de vuelta.
No hace falta que conozcas el código: todo lo relevante está acá.

> **Cómo usar este documento:** pegalo completo en el pedido. La app ya existe y
> funciona; lo que buscamos es una **dirección visual nueva** (paleta + sistema +
> tratamiento de pantallas), no una reescritura funcional.
>
> **Estado:** este brief produjo la propuesta "Mesa de montaje" que hoy vive en
> [`docs/minimax-studio-ui/`](minimax-studio-ui/) y es la fuente de verdad del
> diseño. La sección 7 conserva la paleta de la iteración anterior como
> referencia histórica.

---

## 1. La app en 60 segundos

**MiniMax Studio** es una consola de producción para la API de MiniMax. Un
operador entra con una clave, elige un motor (voz, transcripción, chat, imagen,
video, video agent o música), compone parámetros, despacha un trabajo, sigue su
estado asíncrono y retira el resultado (audio, imagen, video o texto). Cada
trabajo que produce un asset se guarda en una **biblioteca local** con sus
metadatos.

- **Audiencia:** alguien que genera medios todo el día, no un visitante.
- **Trabajo principal:** componer → despachar → leer estado → retirar.
- **Ocho áreas:** Speech, Transcription, Chat, Image, Music, Video, Video Agent,
  Library.
- **Idioma de la interfaz:** inglés. La documentación interna está en español.
- **Autenticación:** una clave de acceso de la app (se guarda en
  `sessionStorage`) y una API key de MiniMax que **nunca llega al navegador**.
- **Estados reales de un trabajo:** `queued`, `running`, `processing`,
  `preparing`, `succeeded`, `failed`, `cancelled`.
- **TTL que el usuario ve:** IDs de cover 24 h; voces y tareas de video, 7 días.
- **Restricción del cliente:** **nada de fucsia ni magenta** en la paleta.

---

## 2. Restricciones que la propuesta debe respetar

1. **Accesibilidad AA:** texto normal ≥ 4.5:1, foco de teclado visible,
   estado que no dependa solo del color, `prefers-reduced-motion` respetado.
2. **Responsive:** escritorio 1440, tablet y móvil 390. Nada de scroll
   horizontal. La navegación superior colapsa a menú por debajo de 900 px.
3. **Densidad:** son formularios de operación, no landing pages. Los campos se
   comparan en columna; los valores numéricos y los IDs van en mono con
   numerales tabulares.
4. **Idioma:** la UI está en inglés y usa sentence case. Nada de etiquetas en
   mayúsculas, puntos medios entre valores, flechas en botones ni "(required)".
5. **La obligatoriedad se marca** con un asterisco junto a la etiqueta y una
   leyenda por hoja; el control lleva `required` y `aria-required`.
6. **La paleta se implementa como tokens semánticos**, no como colores sueltos.
   La propuesta tiene que mapear roles, no solo hex: transporte, superficie,
   panel, placa, regla, texto, texto secundario, acento interactivo, estados.
7. **Sin dependencias de un tema claro u oscuro obligatorio:** hoy conviven un
   chrome oscuro y un workspace claro; se puede proponer otro esquema si se
   justifica y se mantiene la legibilidad de formularios densos.

### Direcciones ya exploradas y descartadas

- Riel lateral grafito + banda oscura en cada pantalla + acento teal + Archivo /
  IBM Plex Mono. Descartada por el cliente.
- Papel frío verde-gris + acento ultramar + Bricolage Grotesque / DM Mono.
  Descartada por el cliente ("no me gusta la paleta").
- Actualmente la app usa papel cálido + verde bosque, paneles con cabecera
  tintada y costuras. **Es el estado actual, no una obligación**: la propuesta
  puede reemplazarlo.

---

## 3. Estructura del shell (hoy)

- **Transporte:** barra superior oscura de 52 px con el nombre del estudio, las
  8 áreas y `Sign out`. La ruta activa se marca con una línea de acento.
- **Subnav:** segunda fila clara con las rutas del área activa y una línea de
  qué hace esa área. Library no tiene subnav porque tiene una sola ruta.
- **Workspace:** fondo cálido con una retícula de puntos apenas visible.
  Contenido centrado a 1152 px, excepto Image, Music y Video, que usan todo el
  ancho.
- **Workbench:** dos columnas (7/12 parámetros, 5/12 resultado). Los paneles se
  tocan: sin gutter, con borde de 1 px, cabecera tintada y un borde de acento de
  3 px a la izquierda.
- **Placa:** superficie de resultado más clara que el panel, con caption de
  slots etiquetados en mono (modelo, duración, tamaño). En pantallas altas la
  placa queda sticky.
- **Cinta de trabajo:** en Video, cuatro etapas reales (Compose, Dispatch,
  Render, Retrieve) con la etapa actual marcada y el estado al lado.

La app abre en `/` con un panel de áreas y las creaciones recientes.

---

## 4. Inventario de pantallas

### 4.1 Acceso — `/login`

- Superficie clara, columna angosta centrada, sin navegación.
- Título "MiniMax Studio", una línea de contexto, campo `Access key` (password),
  botón `Sign in`, error inline si la clave no valida.
- No hay registro ni recuperación: la clave la provee el operador.

### 4.2 Dashboard — `/`

- Cabecera con título y descripción; readouts: generaciones totales, completadas,
  assets.
- Lista "Areas" con las 8 áreas, una línea de qué hace cada una y el conteo de
  generaciones.
- "Recent creations": filas con título, tipo y fecha.
- Estado vacío: invitación a generar.

### 4.3 Speech — `/tts`

Dos paneles lado a lado:

- **Generate audio:** texto (hasta 10.000 caracteres, contador), selector de voz
  con búsqueda y grupos por idioma, modelo (`speech-2.8-hd`, `speech-2.8`,
  `speech-01`), formato (`MP3`, `PCM`, `FLAC`, `WAV`, `Opus`), botón `Generate`.
  Resultado: reproductor con descarga. Aviso: "Best for finished clips...".
- **Streaming TTS:** switch `Enable streaming`, elección de transporte
  (`WebSocket` / server-sent events), texto y voz; reproduce en vivo y **no** se
  guarda en Library. Aviso de para qué sirve cada modo.

### 4.4 Voces — `/voices`

- Tabs `System voices` / `My voices (n)`. Buscador. Las voces del sistema se
  agrupan por idioma con bandera y conteo.
- Tarjeta de voz: nombre, `voiceId` en mono, badge de tipo (System / Cloned /
  Designed), fecha de creación, TTL en las voces propias, acciones `Use in TTS`
  y `Delete` (con confirmación).
- Vacíos distintos para "sin voces del sistema" y "sin voces propias".

### 4.5 Clonar voz — `/voices/clone`

- Dropzone de audio (arrastrar o elegir; muestra waveform y progreso), campo
  `Voice ID`, botón `Clone voice`.
- Éxito: panel con el voice ID, TTL de 7 días y accesos a TTS y a la galería.
- Errores de archivo, duración o API inline.

### 4.6 Diseñar voz — `/voices/design`

- `Prompt` (descripción en lenguaje natural), `Preview text`, botón
  `Design voice`.
- Vista previa: voice ID, audio de prueba, `Accept and save` / `Regenerate`.
- Guardado: confirmación y enlaces a TTS y a la galería. TTL de 7 días.

### 4.7 Transcripción — `/asr`

- Panel **Audio:** archivo, formato de salida (JSON plano, verbose con hablantes,
  SRT, VTT), granularidad de timestamps (segmento / oración / palabra), idioma
  (auto o uno de la lista), `Transcribe` y `Stream transcript` (SSE).
- Panel **Transcript:** duración, texto o subtítulos, copiar/descargar.
- Vacío: "The transcription appears here once MiniMax finishes."

### 4.8 Chat — `/text`

- Panel **Prompt:** modelo, superficie upstream (Native, OpenAI, Anthropic,
  Responses), system prompt, mensaje, `Send` (mientras responde: "Thinking...").
- Panel **Conversation:** transcript con etiquetas `You` / `Assistant`,
  razonamiento colapsable si el modelo lo devuelve, streaming.
- Vacío: "Send a message to start."

### 4.9 Imagen — `/image`

- Panel **Creative brief:** prompt (contador 0/32.000), tarjetas de modelo
  (`MiniMax-H3-Image` calidad / `MiniMax-H3-Image-Highspeed` velocidad), grilla
  de relación de aspecto (Auto, 1:1, 16:9, 4:3, 3:2, 2:3, 3:4, 9:16, 21:9),
  nivel de área (1K/2K/4K con tamaños), tamaño custom, cantidad (1–10), formato
  (JPEG/PNG/WEBP), compresión, switch "Disable prompt enhancement",
  `Generate images`.
- Panel **Results:** conteo de generadas/fallidas, relación usada, grilla de
  imágenes con descarga.
- Vacío: "No result yet" + invitación.

### 4.10 Imagen a imagen — `/image/image-to-image`

- Referencias (hasta 16 imágenes, upload), prompt, modelo, relación, área,
  tamaño, formato y compresión.
- Mismo panel de resultados y estados vacíos que `/image`.

### 4.11 Música — `/music`

- El modelo define el modo: `music-3.0` (texto a música) o `music-cover`
  (cover; requiere un cover feature ID).
- Switch `Instrumental mode` (deshabilitado en cover), campo `Cover feature ID`
  cuando aplica, `Style prompt` / `Target cover style`, `Lyrics` con tags de
  estructura (`[Verse]`, `[Chorus]`), modelo, ficha de audio (MP3 44.1 kHz
  256 kbps), `Generate music` / `Generate cover`.
- Aviso de disponibilidad del servicio.
- Panel **Track preview:** reproductor y `Download MP3`, o vacío.

### 4.12 Letras — `/music/lyrics`

- Panel **Lyric brief:** modo (escribir / editar), título, prompt o letras
  existentes, `Generate lyrics`.
- Panel **Generated lyrics:** letras, badges por tag de estilo, `Copy lyrics` y
  enlace para usar las letras en Music Generation.

### 4.13 Cover preprocess — `/music/cover-preprocess`

- Audio por URL **o** upload local (exactamente uno), letras formateadas
  opcionales, `Preprocess`.
- Resultado: cover feature ID, TTL de 24 h, `Copy ID` y acción para usarlo en
  cover generation.
- Errores de formato/duración y estados de carga.

### 4.14 Video — `/video/generation`

- **Parameters:** modelo (H3, Highspeed, Lite, Max, Max-Turbo, MG), resolución
  según modelo, duración, relación de aspecto (según escenario), prompt
  expansion (solo Max), prompt, referencias multimedia (primer/último frame,
  hasta 9 imágenes, 3 videos, 3 audios), `Generate video`.
- **Latest task:** estado, task id, reproductor, `Download`, `Cancel task`,
  cinta de etapas. Vacío si no hay tarea.

### 4.15 Context-IR — `/video/context-ir`

- Prompt, referencias multimedia, duración objetivo y relación.
- `Enhance prompt`; el prompt enriquecido aparece en un panel de resultado
  (texto read-only) con estado y cinta.

### 4.16 Regeneración 2K — `/video/regeneration`

- Fuente: task id **o** URL del video 768P, prompt usado, referencias.
- `Regenerate in 2K`; panel con la tarea y el resultado, cinta de etapas.

### 4.17 Tareas de video — `/video/tasks`

- Filtros por estado y por tipo de tarea; lista de tareas con id, tipo, estado,
  fechas y acciones `Open` / `Cancel task`.
- Nota: MiniMax conserva las tareas 7 días.
- Vacíos para "sin tareas" y "sin coincidencias".

### 4.18 Video Agent — `/video-agent`

- Selector de plantilla oficial (cada una con descripción y campos requeridos),
  `Image URL` y `Text` marcados con asterisco, leyenda "Fields marked * are
  required.", `Generate`.
- Panel **Result:** clip generado o vacío.

### 4.19 Biblioteca — `/library`

- Readouts: total, audio, imágenes, videos.
- Filtros: All, Audio, Music, Images, Videos, Cloned voices, Designed voices.
- Cada elemento es un panel con: tipo, fecha, badges (kind y estado de storage),
  cita del prompt, filas de datos (source, model, voice, file, aspect ratio,
  seed, prompt optimizer, format, duration, sample rate, bitrate, TTL) y
  acciones `Download audio` / `Download video` / `Open` / `Use in cover
  generation` / `Remove` (confirmación).
- Estados: vacío, sin coincidencias, TTL expirado, asset no guardado.

---

## 5. Componentes y patrones compartidos

- **Transporte y subnav** (desktop) / **menú + drawer** (móvil, con foco
  atrapado y restaurado).
- **AreaHeader:** título display, descripción, una nota de restricción, estado
  vivo, readouts y acciones.
- **Panel:** cabecera con título y una línea, contenido con formularios; borde y
  costura. **Placa:** resultado, caption de slots, sticky.
- **Spec / Field:** fila etiqueta–valor y fila etiqueta–control, columna fija.
- **StatusLamp:** punto + etiqueta mono sobre fondo suave del estado.
- **JobStrip:** 4 etapas con la actual marcada.
- **Badge, Alert, Button (solid / outline / ghost / destructive), Input,
  Textarea, Select con búsqueda y grupos, Tabs, Switch, Slider, Dialog de
  confirmación, Dropdown, Progress, Skeleton, TTL counter, dropzone de upload,
  reproductores de audio y video.**
- **Estados transversales:** carga, vacío, error, éxito, deshabilitado, TTL
  vencido, sin clave (redirección a login).

---

## 6. Qué necesitamos de la IA de diseño

Entregá **una propuesta**, no un menú de opciones. Si dudás entre dos caminos,
elegí uno y explicá por qué.

### 6.1 Concepto

- Un nombre y una tesis de una frase: qué hace que esta app se vea como una
  herramienta de producción de medios y no como un dashboard genérico.
- Qué elemento es el memorable (tipografía, superficie, color, estructura) y
  dónde se gasta la audacia. Todo lo demás queda disciplinado.

### 6.2 Paleta

- 8–12 tokens con hex y **rol semántico**: transporte, workspace, panel, placa,
  regla, texto, texto secundario, acento interactivo, fondo suave del acento,
  y los tres estados (ok, en curso, error).
- Tabla de contrastes para los pares que la app usa de verdad (texto sobre
  workspace, panel, placa y transporte; texto inverso sobre acento; estados
  sobre panel). Indicá el ratio.
- Sin fucsia ni magenta. Un solo acento interactivo.
- Decidí si el esquema es claro, oscuro o mixto, y justificalo para formularios
  densos y sesiones largas.

### 6.3 Tipografía

- Dos familias como máximo, claramente distintas, preferentemente disponibles en
  Google Fonts o con licencia clara.
- Roles: display, título de panel, cuerpo, etiqueta, mono para datos.
- Escala con tamaños, line-height, pesos y tracking; límite de 80 caracteres.

### 6.4 Shell y layout

- Cómo se navega entre las 8 áreas (mantené el transporte superior o proponé
  otro modelo, pero resolvé 8 áreas + subrutas + móvil).
- Cómo se lee un formulario denso al lado de un resultado.
- Tratamiento del panel y de la placa (bordes, cabecera, radios, sombras o
  costuras).
- Wireframes ASCII para: dashboard, `/tts`, `/image`, `/library` y móvil.

### 6.5 Componentes

- Botones (primario, secundario, destructivo, deshabilitado), campos, selects,
  tabs, badges, alertas, estados vacíos, carga, upload, reproductores.
- Cómo se marca el foco de teclado y el estado seleccionado sin depender del
  color.

### 6.6 Movimiento

- Una sola intención: qué se mueve y por qué. Nada que anime en carga por
  defecto; el movimiento responde a una acción y se apaga con
  `prefers-reduced-motion`.

### 6.7 Qué evitar

- El kit SaaS de tarjetas idénticas con sombra suave.
- Crema cálida + serif display + terracota; casi negro + acento ácido;
  broadsheet de hairlines; eyebrows en mayúsculas; puntos medios; flechas en
  botones.
- Fucsia/magenta.
- Color como única señal de estado.
- Una paleta que no se pueda mapear a los roles semánticos de arriba.

### 6.8 Formato de entrega

1. Concepto (1 párrafo + nombre).
2. Tabla de paleta (token, hex, rol, contraste).
3. Tipografía (familias, escala, roles).
4. Shell y layout, con wireframes.
5. Especificación de componentes y estados.
6. Movimiento y accesibilidad.
7. Notas por pantalla (qué cambia respecto de la estructura del punto 4).
8. Opcional: tokens en JSON con la forma `{ "color": { "token": "hex" } }`.

---

## 7. Anexo: implementación actual (referencia, no obligación)

- Tokens y tema: `src/components/ui/theme.ts`
- Sistema y reglas: `docs/design.md`
- Primitivas: `src/components/ui/` (`area-header`, `plate`, `job-strip`,
  `sheet`, `spec`, `status-lamp`, `badge`, `button`, `tabs`, `input`,
  `textarea`, `select`).
- Navegación: `src/components/navigation/`.
- Paleta actual: `ink #171A16`, `workspace #E9E4D8`, `sheet #FCFAF4`,
  `rail #EFE7D7`, `plate #FFFDF8`, `rule #CFC7B8`, `readout #6A645A`,
  `accent #1F5B45`; estados `ok #2C6E4A`, `run #A25F16`, `err #A8332B`.
- Tipografía actual: Bricolage Grotesque + DM Mono.
