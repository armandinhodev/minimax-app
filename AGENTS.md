# Flujo de desarrollo

Este workflow se implementa con instrucciones Markdown para OpenCode. Usa las herramientas existentes de cada proyecto; no requiere un runner propio, Python, una máquina de estados JSON ni hooks instalados por esta plantilla.

## Elegir la metodología

Para cada tarea nueva, elegí la primera regla aplicable y anunciá `Flujo: <nombre> — <motivo>` antes de editar. Si cambia el alcance, reclasificá.

1. **Consulta o análisis:** respondé sin modificar archivos.
2. **Alto impacto → SDD:** contratos públicos, compatibilidad, migraciones o datos persistentes, permisos sensibles o cambios difíciles de revertir. Cargá `flujo-sdd`. Prepará la especificación y esperá aprobación humana explícita antes de editar código, pruebas o configuración. Si hay dudas razonables sobre el impacto, no edites hasta aclararlas.
3. **Bug reproducible o comportamiento acotado → TDD:** cargá `flujo-tdd` y verificá una prueba que falle por la razón esperada antes de corregir o implementar.
4. **Otro cambio → ODD ligero:** cargá `flujo-odd`; explorá, fijá criterios y avanzá en partes verificables.

Los comandos explícitos eligen el flujo, pero no anulan el requisito de aprobación para alto impacto. TDD también puede usarse dentro de ODD y después de aprobar una especificación SDD. Al invocar `revisor` o `review-ui`, aplicá su contrato de revisión sin reclasificar ni implementar el ticket. Si una skill no está disponible, informalo y aplicá estas reglas sin bajar los controles.

## Reglas comunes

- Preservá cambios existentes y limitá el diff al pedido. Explorá con Plan o Explore cuando haga falta; Build implementa.
- Usá los checks documentados por el repo; no inventes comandos. Reportá cada check como pasó, falló o no se ejecutó, con el motivo si falta evidencia.
- Antes de cerrar cualquier cambio, evaluá su impacto en la documentación. Si cambia el uso, la configuración, un contrato público o la operación del proyecto, cargá `documentacion` y actualizá las guías, referencias o ejemplos afectados en el mismo cambio. Si la skill no está disponible, aplicá igual esta regla. Respetá la aprobación previa de SDD.
- En el cierre, incluí `Documentación:` con las rutas actualizadas o `No aplica` y un motivo concreto. Si una actualización necesaria queda bloqueada, indicá qué falta; no la marques como completa.
- Para cambios relevantes, delegá el diff final a `revisor` con criterios, resultados y el estado de la documentación. Esperá su informe y, si hay correcciones, repetí checks y revisión sobre el diff nuevo.
- No hagas commit, push, merge, deploy ni operaciones destructivas sin autorización. La aprobación del plan no autoriza esas acciones. Un dictamen del agente no sustituye CI ni aprobación humana.

## Política de pruebas para todos los flujos

- En TDD, ODD y SDD, cargá `pruebas` y prepará una matriz de cobertura: criterio → escenario/riesgo → nivel → archivo/caso → comando/resultado → hueco. Diseñala antes de implementar y actualizala al cerrar. En SDD, solo se propone en el chat antes de aprobar; no edites ni tests hasta la aprobación explícita.
- Build debe crear o actualizar tests automatizados para comportamiento nuevo o modificado, incluidos éxito, error y límites pertinentes. Cada bug deja una regresión. Si un test existente ya cubre un criterio, identificá su aserción y evidencia; correr la suite previa en verde no alcanza.
- Ejecutá pruebas focalizadas y los gates reales del repo. No debilites ni omitas tests para obtener verde. Un fallo de setup no es un rojo de comportamiento; tipos/build no sustituyen tests. Sin comportamiento afectado, justificá `No aplica`; falta de entorno, autorización o automatización es un bloqueo/hueco, no una exención silenciosa.
- Entregá `Cobertura:` con matriz, tests nuevos/actualizados/reutilizados, evidencia y pendientes. `revisor` comprueba esa trazabilidad y marca como bloqueantes huecos relevantes o pruebas obligatorias sin evidencia. No cierres como completo sin cobertura/evidencia obligatoria o una excepción explícita del usuario. El revisor no ejecuta tests ni usa shell.
- No se presupone stack ni comandos. DB, proveedores pagos y datos reales requieren entorno y autorización específicos. Estas son instrucciones de trabajo y revisión, no un bloqueo técnico de CI ni garantía de cobertura total.

## Revisión de interfaz web

- Si el cambio afecta una pantalla o interacción, Build delega a `review-ui` después de implementar. Pasale la URL local de la app en ejecución, el alcance, los criterios y los datos de prueba pertinentes. Esperá el informe y repetí la revisión afectada después de corregir hallazgos. `revisor` sigue revisando el diff por separado.
- En el cierre, indicá `UI: Verificada` con evidencia y alcance, `UI: Con hallazgos` o `UI: No verificada` con el motivo. Si falta Playwright MCP o la app no está disponible, no des por aprobada la interfaz. En cambios sin impacto en UI no invoques al subagente.

## Continuidad entre tareas

Conservá un handoff breve en Markdown con alcance, criterios, aprobación, cobertura, comandos/resultados observados y pendientes. Antes de cambiar de tarea, dejá explícito qué terminó y qué quedó bloqueado; no heredes aprobaciones ni autorización de publicación a otro alcance. Un cambio posterior exige repetir los checks y la revisión afectados.

## Datos del repo (completar al adoptar)

- Pruebas: pendiente de documentar.
- Lint, tipos y build: pendiente de documentar.
- Convenciones, restricciones y checks de CI obligatorios: pendiente de documentar.
