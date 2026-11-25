---
name: pruebas
description: Diseña, crea y verifica cobertura de los criterios de aceptación en cualquier flujo, sin confundir suites verdes con cobertura del cambio.
---

# Política de pruebas

Aplica a TDD, ODD y SDD. Build es responsable de crear o actualizar pruebas y ejecutarlas; `revisor` inspecciona cobertura y evidencia sin ejecutar comandos. No se requiere otro agente. Usá los comandos y herramientas reales del proyecto; esta skill no presupone lenguaje, framework, gestor de paquetes ni proveedor.

## 1. Matriz antes de implementar

Relacioná cada criterio de aceptación con escenarios observables y una prueba adecuada. Incluí éxito, error y límites cuando correspondan. Según el cambio, considerá validación, permisos/aislamiento, persistencia/compatibilidad, cancelación/timeouts/concurrencia y estados de UI. Marcá los escenarios que no aplican con un motivo, sin inventar casos ni exigir todas las categorías por rutina.

En Plan, la matriz se propone en el chat. En SDD, esperá aprobación explícita antes de editar código, pruebas o configuración; cargar esta skill o diseñar casos no autoriza esas ediciones. Un cambio material del alcance exige nueva aprobación.

| Criterio | Escenario y riesgo | Nivel | Archivo y caso de test | Comando y resultado | Estado / hueco |
|---|---|---|---|---|---|
| <criterio> | <éxito, error o límite relevante> | <unitario, integración, contrato o UI> | <ruta + nombre del caso; previsto en Plan> | <comando real, exit y evidencia; pendiente en Plan> | <Pendiente / Pasó / Falló / Bloqueado / No aplica con motivo> |

## 2. Crear cobertura, no solo ejecutar suites

Para comportamiento nuevo o modificado, creá o actualizá tests automatizados junto con el cambio, también en ODD y SDD aprobado. Cada bug deja una prueba de regresión que reproduce el fallo. No alcanza con que la suite existente esté verde. Si un caso ya está cubierto, identificá el archivo y el test existente y explicá por qué su aserción comprueba el criterio afectado; no agregues tests redundantes para cumplir una cuota.

Probá resultados observables y efectos relevantes, no solo que se llamó un mock ni que existe un archivo. No cambies expectativas para acomodar un bug. No elimines aserciones, marques pruebas como skip, reduzcas umbrales ni debilites tests existentes para obtener verde sin una justificación explícita y autorizada del cambio de contrato.

## 3. Ciclo de implementación

En TDD, verificá rojo → verde → refactor con la misma prueba y evidencia de ambas ejecuciones. En ODD o SDD aprobado, aplicá ese ciclo a los casos reproducibles y mantené la matriz al implementar cada parte. Un error de instalación, import o infraestructura no es un rojo de comportamiento. Primero resolvé el setup autorizado o reportá el bloqueo. Antes de aprobar SDD no escribas ni tests de regresión.

## 4. Nivel y aislamiento

Usá unitarios para lógica aislada; integración/contrato para límites entre componentes; pruebas de UI para interacciones relevantes. Elegí según el riesgo, no un porcentaje arbitrario. Una revisión manual o un recorrido de `review-ui` no reemplaza automáticamente una regresión automatizada necesaria. El porcentaje de coverage, si ya existe herramienta en el repo, ayuda a detectar huecos; no demuestra por sí solo que los criterios estén cubiertos. No inventes porcentajes ni agregues un umbral global sin acordarlo.

Los tests habituales deben ser deterministas, sin secretos ni llamadas pagas. Inyectá proveedores falsos y usá datos de prueba. Antes de usar DB, red, proveedores, micrófono o datos externos, verificá el alcance autorizado y el entorno; no arranques infraestructura, cambies credenciales ni consumas servicios por rutina. Separá fakes, integración real y dispositivo físico. Si falta autorización, conservá la cobertura local posible y reportá el nivel real como no ejecutado.

## 5. Ejecución y evidencia

Corré tests focalizados durante la implementación y la suite/gates documentados por el repo sobre el estado final. Tras corregir hallazgos, repetí los checks afectados. Reportá comando exacto, exit code, resultado, casos ejecutados y limitaciones. Compará contra un baseline observado cuando exista; no etiquetes un fallo como preexistente por intuición. Un veredicto de agente, un comando que no terminó, una conexión MCP o tipos/build correctos no son una ejecución de tests aprobada.

## 6. Cierre y revisión

Entregá `Cobertura:` con la matriz actualizada (o referencia al handoff), tests nuevos/actualizados/reutilizados y huecos pendientes. `No aplica` requiere justificación concreta para cambios sin comportamiento, como documentación; la dificultad de automatizar o un entorno ausente se marca `Bloqueado`, no `No aplica`. Si se usa una verificación alternativa, indicá qué prueba y qué sigue sin cubrir.

No cierres como completo si falta cobertura de un criterio de comportamiento, hay pruebas obligatorias fallidas/no ejecutadas o falta evidencia sin una excepción explícita del usuario. No conviertas la ausencia de autorización para pruebas reales en autorización implícita: informá el bloqueo o límite. Pasá a `revisor` criterios, matriz, diff exacto (incluidos tests nuevos), resultados y excepciones. Debe señalar como bloqueantes los huecos relevantes y la evidencia obligatoria ausente. Una suite verde no garantiza cobertura total ni equivale a CI obligatorio.
