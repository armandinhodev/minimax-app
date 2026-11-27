# MiniMax Studio — Paleta de Mesa de montaje

La navegación lateral en pizarra ubica al operador. El banco gris azulado separa las hojas claras de control, y el cobre oscuro identifica dónde actuar. La placa blanca conserva un fondo neutro para revisar texto, audio e imagen. El contenido generado puede tener cualquier color.

## Tokens semánticos

| Token | Hex | Rol | Par de referencia | Contraste |
|---|---|---|---|---:|
| `--transport` | `#293341` | Menú lateral global y cuerpo de reproductores. | `plate` | 12.77:1 |
| `--workspace` | `#E8EBEF` | Fondo continuo, orientación entre módulos. | `ink` | 11.99:1 |
| `--panel` | `#FAFBFC` | Superficie de composición. | `ink` | 13.84:1 |
| `--plate` | `#FFFFFF` | Resultado, campos e inverso sobre fondos oscuros. | `ink` | 14.34:1 |
| `--rule` | `#77828E` | Contorno de controles y delimitadores funcionales. | `panel` | 3.78:1 |
| `--ink` | `#202B38` | Títulos, cuerpo y valores. | `workspace` | 11.99:1 |
| `--muted` | `#506070` | Ayuda, metadatos y placeholders. | `workspace` | 5.41:1 |
| `--accent` | `#A33E12` | Cobre para acción primaria, selección y foco. | `plate` | 6.45:1 |
| `--accent-soft` | `#F8E8DE` | Selección suave, marcas temporales y ruta activa en el menú lateral. | `accent` | 5.40:1 |
| `--ok` | `#296546` | Confirmación y trabajo completado. | `panel` | 6.66:1 |
| `--run` | `#805700` | Espera y trabajo en curso. | `panel` | 6.18:1 |
| `--error` | `#A12C32` | Error y acción destructiva. | `panel` | 6.94:1 |

## Pares de uso

Relación de luminancia relativa sRGB, redondeada a dos decimales. El mínimo de diseño es 4,5:1 para texto normal y 3:1 para límites funcionales y foco.

| Primer plano | Fondo | Aplicación | Relación |
|---|---|---|---:|
| `ink` | `workspace` | Texto base | 11.99:1 |
| `ink` | `panel` | Texto base | 13.84:1 |
| `ink` | `plate` | Texto base | 14.34:1 |
| `muted` | `workspace` | Ayuda y metadatos | 5.41:1 |
| `muted` | `panel` | Ayuda y metadatos | 6.24:1 |
| `muted` | `plate` | Ayuda y metadatos | 6.47:1 |
| `plate` | `transport` | Navegación y reproducción | 12.77:1 |
| `plate` | `accent` | Acción primaria | 6.45:1 |
| `accent` | `accent-soft` | Selección con marca | 5.40:1 |
| `accent` | `panel` | Enlace o foco | 6.23:1 |
| `accent-soft` | `transport` | Fondo de la ruta activa sobre el lateral | 10.70:1 |
| `plate` | `error` | Confirmación destructiva | 7.19:1 |
| `ok` | `panel` | Etiqueta de estado | 6.66:1 |
| `ok` | `plate` | Etiqueta de estado | 6.90:1 |
| `run` | `panel` | Etiqueta de estado | 6.18:1 |
| `run` | `plate` | Etiqueta de estado | 6.40:1 |
| `error` | `panel` | Etiqueta de estado | 6.94:1 |
| `error` | `plate` | Etiqueta de estado | 7.19:1 |
| `rule` | `panel` | Borde funcional | 3.78:1 |

## Aplicación

- Una acción primaria cobre por formulario. La etiqueta conserva blanco opaco al pasar el puntero. El foco añade un contorno externo.
- Usar el mismo color semántico para el símbolo, el texto y el borde de cada estado. Para una alerta amplia, mezclar el estado al 6 % sobre blanco y mantener el texto en tinta.
- Derivar separadores decorativos con una mezcla del 35 % de regla sobre panel. Reservar la regla opaca para controles que dependen del contorno.
- El cobre y el rojo se distinguen también por verbo y contexto. Una eliminación siempre pasa por confirmación.

## Variables CSS

```css
:root {
  --transport: #293341;
  --workspace: #E8EBEF;
  --panel: #FAFBFC;
  --plate: #FFFFFF;
  --rule: #77828E;
  --ink: #202B38;
  --muted: #506070;
  --accent: #A33E12;
  --accent-soft: #F8E8DE;
  --ok: #296546;
  --run: #805700;
  --error: #A12C32;
}
```
