---
name: flujo-sdd
description: Especifica un cambio de alto impacto antes de implementar.
---

# Flujo SDD

1. Definí alcance, no objetivos, contratos y comportamiento esperado con ejemplos comprobables.
2. Identificá consumidores afectados, casos límite y riesgos. Incluí compatibilidad, estrategia de despliegue o migración y reversión cuando apliquen. Marcá explícitamente las decisiones pendientes. Cargá `pruebas` y proponé en el chat una matriz de cobertura por criterio con escenarios de éxito, error y límites, niveles de prueba y checks previstos.
3. Entregá la propuesta en el chat y esperá aprobación explícita antes de editar código, pruebas o configuración. No guardes la especificación en el repo mientras esperás. Después de aprobar, continuá la misma tarea en Build sin pedir la misma aprobación de nuevo; si cambia materialmente el alcance aprobado, volvé a pedir aprobación.
4. En Build implementá en etapas contra los criterios aprobados y creá o actualizá los tests de cada comportamiento afectado. Aplicá rojo → verde a los casos reproducibles. No alcanza con que la suite previa pase: identificá la cobertura de cada criterio, corré los checks reales y actualizá la matriz de cobertura con evidencia y huecos.
5. Solicitá revisión independiente del diff, la matriz y los resultados. No cierres como completo con criterios sin cobertura o pruebas obligatorias sin evidencia/excepción explícita. Nunca ejecutes despliegues, migraciones reales ni pruebas sobre servicios/datos externos sin su autorización correspondiente.
