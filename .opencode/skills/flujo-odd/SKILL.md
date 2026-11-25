---
name: flujo-odd
description: Planifica un cambio en pasos pequeños verificables.
---

# Flujo ODD

1. Explorá solo las áreas necesarias del repo y detectá restricciones.
2. Prepará una ficha: objetivo, fuera de alcance, criterios de aceptación, tareas pequeñas y checks. Cargá `pruebas` y prepará la matriz de cobertura con éxito, errores y límites pertinentes; crear cobertura también es parte de ODD.
3. Si el plan revela alto impacto, pasá a SDD y esperá aprobación antes de editar código, tests o configuración. Si falta una decisión relevante, preguntá en lugar de adivinar.
4. En Build creá o actualizá los tests necesarios junto con cada parte; identificá los existentes que cubran un criterio sin redundancia. Ejecutá los tests focalizados y luego los gates reales del repo. No alcanza con correr la suite anterior en verde.
5. Actualizá la matriz de cobertura con resultados y huecos. No cierres como completo con criterios sin cobertura, checks obligatorios sin evidencia o fallos sin excepción explícita. Para cambios relevantes, pedí revisión independiente del diff y la matriz.
