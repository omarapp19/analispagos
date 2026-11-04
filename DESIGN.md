---
name: Galpón
description: Gestión de caja, ventas e inventario en dólares y bolívares, con un cascarón azul noche alrededor de una superficie de trabajo fría y clara.
colors:
  primary: "#2F64F5"
  primary-hover: "#2453D9"
  primary-soft: "#EBF1FF"
  brand-cyan: "#1FC0E8"
  shell: "#0A1128"
  shell-2: "#131D3B"
  shell-text: "#B4BDD8"
  shell-muted: "#9FB0DA"
  shell-faint: "#7F8BB0"
  shell-blue: "#6FA0FF"
  ink: "#0F1A33"
  ink-soft: "#3D475F"
  muted: "#5B6680"
  placeholder: "#8E98AE"
  ground: "#F4F6FA"
  surface: "#FFFFFF"
  surface-sunken: "#F7F8FB"
  fill: "#EEF1F6"
  line: "#E3E7F0"
  line-strong: "#C8CEDB"
  success: "#12B76A"
  success-soft: "#E7F7EE"
  danger: "#E5484D"
  danger-soft: "#FDECEC"
  warning: "#F5A524"
  warning-ink: "#B76E00"
  info: "#3E8BFF"
  selection: "#CFDDFF"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.5
    fontFeature: "\"cv11\", \"ss01\""
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.3
  figure-lg:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  figure-bs:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.3
    fontFeature: "\"tnum\""
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "16px"
  3xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.surface-sunken}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
  button-charge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    height: "56px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 14px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  balance-panel:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "28px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.shell-text}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
  rate-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "36px"
  modal-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.3xl}"
---

# Design System: Galpón

## Overview

**Creative North Star: "La caja en azul noche"**

Un cascarón de mando azul noche (barra lateral, panel de saldo, login) rodea una superficie de trabajo clara, fría y tranquila. Todo lo que se toca para actuar o lo que está seleccionado es de un solo azul eléctrico; el resto vive en neutros gris pizarra teñidos de azul, de modo que ningún gris es ajeno al mundo. La densidad es la de una herramienta de trabajo: filas de 40 px, campos de 44 px, tarjetas con borde fino y sombra casi imperceptible.

El dinero es el protagonista. Cada cifra clave se muestra en USD con su equivalente en bolívares debajo, a la tasa BCV, con numerales tabulares para que las columnas no bailen. El peso tipográfico es disciplinado: la cifra va en extrabold, la etiqueta en semibold y en minúsculas de oración; nada grita en mayúsculas.

El sistema rechaza el aspecto de plantilla Horizon-UI del que viene el código: mosaicos de íconos pastel, tarjetas con degradado, todo en negrita, violeta como acento. El degradado azul→cian existe, pero solo en el mosaico de la marca.

**Key Characteristics:**
- Cascarón azul noche (#0A1128) + superficie fría (#F4F6FA); el contraste entre ambos es la estructura.
- Un solo color de acción: azul #2F64F5, para botones primarios, selección y navegación activa.
- Pareja USD / Bs en cada cifra importante, con numerales tabulares.
- Barras de vencimiento cuya longitud codifica los días restantes.
- Bordes finos (#E3E7F0) y sombras suaves teñidas de tinta, nunca negras.
- Movimiento corto y de salida rápida; presión al 97 % en todo lo pulsable.

## Colors

Una paleta de azul noche, un azul eléctrico de acción y neutros gris pizarra que comparten el mismo matiz azul.

### Primary
- **Azul Eléctrico** (primary): botón primario, pestaña o método de pago seleccionado, ítem activo de la barra lateral, barra de vencimiento en plazo, enlaces de acción ("Ver calendario"), caret y anillo de foco. Hover a **Azul Profundo** (primary-hover).
- **Azul Bruma** (primary-soft): fondo del ítem seleccionado en superficies claras (filtro "En stock" activo, cliente elegido en el ticket, botón "+" del producto en reposo).

### Secondary
- **Cian de Marca** (brand-cyan): solo como segundo extremo del degradado del mosaico de la marca (135°, primary → brand-cyan) y como resplandor radial muy tenue (≤18 % de opacidad) sobre superficies del cascarón.

### Neutral
- **Azul Noche** (shell) y **Azul Noche Alto** (shell-2): barra lateral, cabecera del POS, panel de saldo del Resumen, fondo del login, avatar del usuario.
- **Texto del cascarón** (shell-text), **Bruma del cascarón** (shell-muted) y **Tenue del cascarón** (shell-faint): texto de navegación, etiquetas y cifras en Bs sobre azul noche, íconos inactivos. **Azul sobre noche** (shell-blue) marca el ícono del grupo activo y los acentos de texto del login.
- **Tinta** (ink): títulos, cifras, texto principal. **Tinta suave** (ink-soft): etiquetas de formulario en modales.
- **Gris pizarra** (muted): texto secundario, encabezados de tabla, subtítulos, la línea en Bs. **Marcador** (placeholder) solo para placeholders.
- **Suelo** (ground): fondo de la superficie de trabajo y campos deshabilitados. **Superficie** (surface): tarjetas, ticket, modales. **Superficie hundida** (surface-sunken): cabecera de tabla, hover de fila, día abierto en movimientos. **Relleno** (fill): pistas de barras, pestañas segmentadas, hover de botón fantasma, mosaicos de estado vacío.
- **Línea** (line): todo borde fino y divisor. **Línea fuerte** (line-strong): borde de campo y botón contorno en hover.

### Semánticos
- **Éxito** (success) con **fondo de éxito** (success-soft): entradas de caja, neto positivo, "Todo al día".
- **Peligro** (danger) con **fondo de peligro** (danger-soft): salidas, vencido, agotado, confirmación de cierre de sesión.
- **Aviso** (warning): solo como relleno (barra que vence en ≤2 días, borde de crédito). Como texto sobre claro se usa **tinta de aviso** (warning-ink), porque el ámbar no alcanza contraste.
- Sobre azul noche los semánticos se aclaran: neto positivo #3DDC97, negativo #FF8A8E.

### Named Rules
**La Regla de Una Sola Voz.** El azul eléctrico es el único color de acción y selección. Si algo está activo, seleccionado o es la acción principal, es azul; si no, es neutro.

**La Regla del Degradado de Marca.** El degradado lineal azul→cian vive solo en el mosaico del logotipo. Ningún botón, tarjeta ni texto lleva ese degradado. Sobre el cascarón se permiten resplandores radiales difusos de azul (≤45 %) y cian (≤18 %), nunca sobre la superficie clara.

**La Regla del Gris con Matiz.** Todo neutro pertenece a la escala gris pizarra teñida de azul; no se introducen grises neutros puros ni negros. Los velos de modal son tinta noche al 52 %, no negro.

## Typography

**Display Font:** Manrope (con ui-sans-serif, system-ui)
**Body Font:** Manrope (con ui-sans-serif, system-ui)

**Character:** Una sola grotesca geométrica y cálida, en pesos 500–800, con alternativas cv11/ss01 activas y numerales tabulares donde haya dinero. La jerarquía sale del peso y del tamaño, no de las mayúsculas.

### Hierarchy
- **Display** (800, 46 px; 40 px en móvil, interlineado 1, −0.03em): la cifra del saldo en el panel azul noche. El titular del login llega a 54 px con el mismo tratamiento.
- **Headline** (800, 26–28 px, −0.025em): título de página ("Resumen"). Los títulos de página heredados se igualan a 26 px / 800.
- **Title** (700, 16 px): título de tarjeta o sección ("Próximos pagos", "Movimientos de caja"); 18 px / 800 en cabeceras de modal.
- **Body** (500–600, 14–15 px): texto base 15 px; filas y nombres 13.5–14 px semibold; subtítulos 13–14.5 px en gris pizarra, con `text-wrap: pretty`.
- **Label** (600, 12.5–13 px, sin mayúsculas): etiquetas de dato, leyendas de gráfico, notas de vencimiento. Etiquetas de formulario 13–13.5 px / 600. Encabezados de tabla 11.5 px / 700, +0.04em, gris pizarra.
- **Cifras** (Money): xl 34 px / 800, lg 26 px / 800, md 17 px / 700, sm 14 px / 700; la línea en Bs debajo en 11.5–13 px / 600 gris pizarra.

### Named Rules
**La Regla de la Pareja USD/Bs.** Toda cifra clave muestra el monto en USD y, debajo, su equivalente en bolívares a la tasa BCV, más pequeño y en gris pizarra (o bruma del cascarón sobre azul noche). Si no hay tasa, se muestra solo el USD; nunca un Bs inventado.

**La Regla de las Cifras Quietas.** Tablas, campos y toda cifra de dinero usan numerales tabulares.

**La Regla de la Voz Baja.** Etiquetas en minúsculas de oración y peso 600; la mayúscula sostenida no forma parte del sistema. El 800 queda para cifras y títulos de página.

## Layout

Cascarón de dos columnas: barra lateral fija de 248 px (264 px como cajón en móvil) y una columna de trabajo con barra superior de 64 px (migas de pan, chip de tasa BCV/€, botón "Vender") y contenido centrado a un máximo de 1480 px, con márgenes de 16 px en móvil y 32 px desde md, y 20/28 px verticales.

El Resumen usa una rejilla de 12 columnas desde xl con separación de 20 px: panel de saldo en 8 columnas y "Próximos pagos" en 4; debajo, tasas (4) y movimientos (8). Bajo xl todo se apila.

El POS es un catálogo de 2→3→4 columnas de productos con un ticket fijo a la derecha de 380 px (420 px desde xl) que se queda pegado arriba; su bloque de cobro se pega abajo. En teléfono el ticket cae bajo el catálogo y una barra inferior fija lleva a él. El cajero ve el POS a pantalla completa, sin barra lateral.

Ritmo: pasos de 4/8/12/20/24/32 px. Tarjetas con 20–24 px de padding interior; filas de lista de 12–14 px verticales. Las tablas se desplazan en horizontal bajo 1024 px con un mínimo de 680 px.

## Elevation & Depth

Sistema híbrido de borde fino más sombra suave. Las superficies claras se separan del suelo por el borde (#E3E7F0) y una sombra de tarjeta casi plana; las capas superiores (menús, modales, ticket fijo) suben con sombras desplazadas y difusas teñidas de tinta (rgba(15,26,51,…)), nunca negras. Las únicas sombras de color son los resplandores azules del botón primario y del ítem de navegación activo. Sobre el cascarón, la profundidad la dan resplandores radiales azul/cian, no sombras.

### Shadow Vocabulary
- **Tarjeta** (`0 1px 2px rgba(15,26,51,0.04), 0 1px 0 rgba(15,26,51,0.02)`): tarjetas y ticket en reposo.
- **Media** (`0 4px 12px -2px rgba(15,26,51,0.08), 0 2px 4px rgba(15,26,51,0.04)`): hover de producto en el catálogo, contador del carrito.
- **Alta** (`0 12px 28px -8px rgba(15,26,51,0.16), 0 4px 8px rgba(15,26,51,0.04)`): tooltips y popovers.
- **Modal** (`0 32px 64px -24px rgba(10,17,40,0.45), 0 0 0 1px rgba(15,26,51,0.06)`): panel de modal.
- **Resplandor primario** (`0 8px 20px -6px rgba(47,100,245,0.45)`): botón primario.
- **Barra de acción** (`0 -10px 14px -12px rgba(15,26,51,0.18)`): borde superior de la barra de acciones pegada en modales y del bloque de cobro.

### Named Rules
**La Regla del Suelo Firme.** En una herramienta de trabajo las tarjetas no flotan: en hover cambian borde o sombra, nunca escala ni posición.

## Shapes

Esquinas tranquilas y consistentes: 6 px en foco y chips pequeños, 8 px en ítems de navegación, píldoras de método y esqueletos, 12 px en botones, campos, chip de tasa y celdas de imagen, 16 px en tarjetas, ticket y panel de saldo, 20 px en modales y la tarjeta del login. Los modales que se vuelven hoja inferior en teléfono redondean solo arriba y llevan un asa de 40×4 px. Las píldoras completas quedan para contadores, puntos de estado y barras de vencimiento (6 px de alto). Los bordes son siempre de 1 px; las imágenes dentro del contenido llevan un contorno interior de 1 px al 8 % para asentarse en cualquier superficie.

## Components

### Buttons
Firmes y compactos; responden a la presión, no al hover exagerado.
- **Shape:** esquinas de 12 px (rounded.xl), alto 40 px, texto 14 px / 700, ícono de 16 px con 8 px de separación.
- **Primary:** azul eléctrico con texto blanco y resplandor primario; hover a azul profundo.
- **Outline:** blanco con borde de línea y texto tinta; hover a superficie hundida y línea fuerte.
- **Ghost:** transparente con texto gris pizarra; hover a relleno con texto tinta. Se usa para paginación y acciones de cabecera de tarjeta.
- **Cobro (POS):** el primario a 56 px de alto, 16 px de texto, ancho completo, con el monto dentro del rótulo ("Cobrar $…").
- **Hover / Focus:** transiciones de 150 ms en color, fondo, borde y sombra; foco con contorno de 2 px azul a 2 px de distancia. **Active:** escala 0.97 con ease-out (cubic-bezier(0.23,1,0.32,1)). Deshabilitado al 50 %.

### Chips
- **Chip de tasa:** 36 px de alto, blanco con borde de línea, "BCV" en gris pizarra y la tasa en tinta tabular; la tasa en euros va dentro en una cápsula de relleno.
- **Píldora de estado sobre noche:** cápsula completa al 8 % de blanco con punto de 6 px verde o rojo ("Hoy").
- **Etiqueta de stock (POS):** 22 px, 8 px de radio, blanca al 90 %; stock bajo en ámbar pálido (#FFF4DB / #8A5A00), agotado en peligro sólido.
- **Selector segmentado:** contenedor de relleno con borde de línea y radio 16 px; opciones de 40 px con radio 12 px; la seleccionada pasa a azul sólido (métodos de pago) o a blanco elevado (pestañas).

### Cards / Containers
- **Corner Style:** 16 px.
- **Background:** superficie blanca sobre el suelo.
- **Shadow Strategy:** sombra de tarjeta en reposo (ver Elevation & Depth).
- **Border:** 1 px de línea.
- **Internal Padding:** 24 px por defecto; 20 px en tarjetas de dato y cabeceras de lista. Las tarjetas con lista usan padding 0 y divisores de línea.
- **Tarjeta de dato:** etiqueta 13 px / 600 gris pizarra arriba, cifra 26 px / 800 tabular, tendencia opcional en verde o rojo. Sin mosaico de ícono decorativo.

### Inputs / Fields
- **Style:** blanco, borde de línea de 1 px, radio 12 px, alto 44 px (48 px en login y búsqueda del POS), texto 14 px / 600 tinta, caret azul, padding 14 px.
- **Hover:** borde a línea fuerte.
- **Focus:** borde azul y anillo de 3 px rgba(47,100,245,0.14); sin contorno.
- **Disabled / solo lectura:** fondo suelo, texto gris pizarra oscuro (#556079).
- **Select:** apariencia nativa reemplazada por chevrón gris pizarra de 16 px a 10 px del borde.
- **Móvil:** 16 px de texto bajo 640 px para evitar el zoom de iOS.

### Navigation
- **Barra lateral:** azul noche, mosaico de marca de 32 px con el degradado azul→cian y el nombre de la tienda en 16 px / 800. Ítems de 40 px, 14 px / 600, texto del cascarón con ícono tenue de 18 px; hover al 6 % de blanco; activo en azul eléctrico sólido con resplandor azul.
- **Grupos plegables:** Ventas, Inventario, Compras y Finanzas. Solo uno abierto a la vez; el grupo de la ruta actual se abre solo. Se despliegan animando las filas de la rejilla (200 ms, ease-out) con el chevrón girando 180°. Los hijos (36 px, 13.5 px) cuelgan de una guía vertical al 9 % de blanco; el hijo activo es azul sólido y el ícono del grupo activo pasa a azul sobre noche.
- **Pie:** avatar con iniciales, rol, acceso a configuración y cierre de sesión con confirmación de dos toques (el botón pasa a peligro).
- **Móvil:** cajón desde la izquierda con ease de cajón (cubic-bezier(0.32,0.72,0,1)) y velo de tinta noche al 50 %.
- **Barra superior:** 64 px, suelo al 85 % con desenfoque y borde inferior de línea; migas "Sección › Página" en 14 px.

### Money (firma)
El componente de dinero apila el monto en USD sobre su equivalente en Bs a la tasa BCV compartida (una sola suscripción en tiempo real para toda la app). Tamaños xl/lg/md/sm; tono neutro, positivo (éxito) o negativo (peligro); signo "+ / −" opcional con el signo menos tipográfico. Se usa en tarjetas del Resumen, catálogo y total del ticket.

### Barras de vencimiento (firma)
Cada pago pendiente lleva una barra de 6 px sobre pista de relleno cuya longitud crece a medida que se acerca la fecha (llena a 0 días, mínima a 30+). Azul en plazo, ámbar a ≤2 días, rojo si está vencido; la nota debajo usa gris pizarra, tinta de aviso o peligro respectivamente.

### Panel de saldo
Superficie azul noche de 16 px de radio con dos resplandores radiales (azul arriba a la derecha, cian abajo), la cifra display con su Bs debajo, la píldora "Hoy", una columna de tres datos separada por una línea al 10 % de blanco y un gráfico de barras de 30 días (entradas #4F86FF, salidas #FF8A8E).

### Modales
Velo de tinta noche al 52 % con desenfoque de 3 px y entrada en fundido de 160 ms; el panel entra con "enter" (220–240 ms, ease-out, sube 6 px y escala desde 0.985). Radio 20 px, alto máximo de la ventana menos 32 px, desplazamiento propio. La última fila del formulario, la que contiene el envío, queda pegada abajo sobre blanco con la sombra de barra de acción; envío de 44 px. Bajo 640 px el modal se vuelve hoja inferior a ancho completo (radio 22 px arriba, alto máximo 94dvh, entrada de 320 ms con ease de cajón, asa superior), los botones de acción se reparten el ancho y las rejillas de tres columnas pasan a dos.

### Esqueletos y vacíos
Los esqueletos son un brillo lineal #EDF0F5→#F6F8FB de 1.3 s con radio 8 px. Los estados vacíos llevan un mosaico de relleno de 44 px con ícono gris, un título de 14.5 px / 700 y una línea de ayuda de 13 px en gris pizarra, siempre legibles, nunca desvanecidos.

## Do's and Don'ts

### Do:
- **Do** mostrar cada cifra clave con el componente de dinero: USD arriba, Bs debajo a la tasa BCV.
- **Do** usar el azul eléctrico (#2F64F5) como único color de acción y selección, con hover a #2453D9.
- **Do** separar superficies con borde de 1 px #E3E7F0 y la sombra de tarjeta; reservar sombras mayores para capas que flotan de verdad.
- **Do** teñir toda sombra y todo velo con la tinta noche, nunca con negro.
- **Do** usar numerales tabulares en tablas, campos y montos.
- **Do** dar presión de escala 0.97 a todo lo pulsable y usar ease-out cubic-bezier(0.23,1,0.32,1) en transiciones de 150–240 ms; respetar reduced-motion.
- **Do** usar el ámbar como relleno y #B76E00 cuando el aviso es texto sobre claro.
- **Do** mantener un solo grupo abierto en la barra lateral, el de la ruta actual.

### Don't:
- **Don't** usar el degradado azul→cian fuera del mosaico de la marca: ni botones, ni tarjetas, ni texto.
- **Don't** volver al aspecto Horizon-UI: mosaicos de íconos pastel, tarjetas con degradado, todo en negrita, violeta como acento.
- **Don't** escribir etiquetas en mayúscula sostenida ni poner rótulos pequeños sobre los títulos.
- **Don't** hacer flotar tarjetas en hover con escala o desplazamiento.
- **Don't** usar `transition: all` ni animaciones decorativas de rebote.
- **Don't** desvanecer texto secundario dos veces (color gris más opacidad).
- **Don't** usar vidrio esmerilado sobre el contenido; el desenfoque queda para la barra superior, la barra inferior del POS y los velos de modal.
