---
name: flujo-tdd
description: Comprueba un comportamiento con una prueba que falle primero.
---

# Flujo TDD

1. Cargá `pruebas` y prepará la matriz de cobertura por criterio; elegí un caso observable que capture el comportamiento esperado, no la implementación interna. Incluí éxito, errores y límites pertinentes. Si hay alto impacto sin aprobación, seguí SDD y no edites ni tests.
2. Escribí y corré la prueba de regresión antes de tocar código de producción. Confirmá que falla por el motivo esperado; un error de setup no cuenta. Si no podés obtener ese fallo, reportalo y no edites código de producción como si estuviera verificado.
3. Implementá el cambio mínimo, corré la misma prueba y luego los checks pertinentes del repo. Refactorizá solo después del verde y repetí los checks si cambiás algo. Repetí el ciclo por comportamiento; no te limites al camino feliz ni debilites aserciones para obtener verde.
4. Actualizá la matriz de cobertura y reportá tests nuevos/actualizados/reutilizados, comandos, rojo y verde, huecos y lo que no pudiste verificar. No cierres como completo con criterios sin cobertura o pruebas obligatorias sin evidencia/excepción explícita. Entregá estos datos a la revisión independiente cuando corresponda.
