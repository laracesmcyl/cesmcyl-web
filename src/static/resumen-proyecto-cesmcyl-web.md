# Resumen del proyecto — Web CESM Valladolid / CESMCYL

Pega este documento (o súbelo como archivo) al principio de un chat nuevo con Claude para retomar el trabajo sin tener que explicar todo de cero.

## Qué es el proyecto

Migración de la web del sindicato de HTML suelto a **Eleventy (generador de sitios estáticos) + Decap CMS (panel de edición) + Cloudflare Workers**.

- **Web pública:** `https://cesmcyl.laracesmcyl.workers.dev/`
- **Panel de edición:** `https://cesmcyl.laracesmcyl.workers.dev/admin/`
- **Repositorio:** `github.com/laracesmcyl/cesmcyl-web`
- **Cuenta GitHub:** `laracesmcyl`
- **Cuenta Cloudflare:** vinculada a `laracesmcyl@gmail...`
- **Worker de la web:** `cesmcyl`
- **Worker del proxy del panel:** `cesmcyl-cms-proxy`

## Cómo se trabaja (flujo de cada cambio)

1. Pido un cambio a Claude.
2. Claude edita los archivos y me da descargas de los que han cambiado (normalmente `base.njk`, `index.njk` y/o `main.css`).
3. Subo cada archivo a su carpeta correspondiente en GitHub, sustituyendo al que hay, y pulso "Commit changes":
   - `base.njk` → `src/_includes/`
   - `index.njk` → `src/` (la raíz de esa carpeta)
   - `main.css` → `src/css/`
   - `eleventy.config.js` → la **raíz del repositorio** (no dentro de `src/`)
4. Espero a que el build termine en verde en Cloudflare (Workers & Pages → `cesmcyl` → pestaña **Deployments**).
5. Compruebo con Ctrl+Shift+R (o en incógnito, para evitar caché).

**Aviso importante:** varias veces GitHub ha dicho "no changes" o se ha quedado atascado en "Processing your file" al subir un archivo que sí había cambiado — normalmente porque el navegador reutilizaba una descarga vieja con el mismo nombre. Si pasa, comprobar directamente en GitHub (abrir el archivo y buscar con Ctrl+F un trozo de texto del cambio nuevo) antes de asumir que está subido.

## Estructura del sitio

- `src/_includes/base.njk` — plantilla base: barra superior (topbar), menú (nav), aviso urgente (ticker), pie de página. Incluye el JavaScript de la cabecera y el aviso.
- `src/index.njk` — la portada: hero, "Quiénes somos", Tablón, Servicios, Asesoría Jurídica, Noticias.
- `src/css/main.css` — todos los estilos.
- `src/_includes/noticia.njk` — plantilla de noticia individual.
- `src/noticias/*.md` — noticias.
- `src/static/` — archivos que se copian tal cual (admin del CMS, `aviso-urgente.json`, `huelga-info.json`).
- `eleventy.config.js` (en la raíz del repo) — filtros personalizados: `limit`, `sinFijar`, `excerpt`.

## Cambios hechos en esta sesión larga (por orden)

### Aviso urgente (banda amarilla / ticker)
- Rediseñado varias veces: "Leer más" con círculo dorado → pastilla con borde verde → tamaños ajustados.
- Se queda pegado (fijo) debajo del menú al hacer scroll, y se encoge (menos alto, letra más pequeña) pasado cierto punto de scroll.
- Se quitó el botón/flecha de "pliegue" para reabrirlo manualmente (ya no existe: el aviso simplemente se encoge, sin botón).
- Ancho igualado al del menú (mismo padding lateral, sin límite de ancho propio).
- Arreglado un bug de "vibración" (parpadeo) que aparecía al hacer scroll — la causa real era una animación de brillo infinita combinada con recalcular la posición constantemente.

### Cabecera (barra verde superior + menú)
- **Cambio de fondo importante:** la barra verde (topbar), el menú (nav) y el aviso ahora están **todos dentro de un único bloque con `position:fixed`** (`#cabecera-fija`), apilados de forma natural, en vez de tener cada uno su propia posición "sticky" calculada por separado. Esto se hizo para eliminar un bug grave de "vibración"/parpadeo infinito al hacer scroll (un bucle de recálculo de posición).
- Como están fuera del flujo normal de la página, el contenido de abajo necesita un margen superior calculado por JavaScript para no quedar tapado. Esto se hace con la función `ajustarEspacioContenido()` en `base.njk`, que mide la altura de `#cabecera-fija` y se la aplica como `margin-top` al contenedor `#contenido-pagina`.
- Se encoge (menos alto, logo más pequeño, letra más pequeña) al bajar la página, con dos umbrales de scroll distintos (uno para encoger, otro más arriba para volver a agrandar) para evitar parpadeos.
- **Pendiente / a vigilar:** hay un historial largo de ida y vuelta sobre si el contenido de la página debe "seguir" a la cabecera cuando se encoge (reajustarse) o quedarse completamente quieto. La versión que quedó al final de la sesión es: **el contenido NO se mueve** cuando la cabecera se encoge (solo las barras cambian de tamaño). La función de medición se hizo "a prueba de carrera" (siempre mide con la cabecera en tamaño normal, aunque en ese instante esté encogida) para evitar que el título quedara tapado por el aviso. **Este último cambio no se llegó a confirmar como subido/probado con éxito** — es el primer punto a revisar en el chat nuevo.
- Login Admin (botón de la topbar) ya enlaza a `/admin/` correctamente.
- Login Campus TISCYL-CESM enlaza a `https://www.cesmcyl.org/formacion-tiscyl-cesm/`. Se quitó el botón de "Login Campus CESM".

### Portada — primera pantalla (hero)
- Título cambiado de "médicos de CYL" a "**médicos de Valladolid**".
- Se sustituyó el párrafo de descripción y la barra de estadísticas (9 Provincias / +30 años / 1ª fuerza SACYL) por un bloque de **"Quiénes somos"** con: caja destacada, texto de introducción, lista de "Nuestros objetivos" (5 puntos), y la frase "Unión · Negociación · Defensa · Trabajo · Movilización". Contenido tomado de una captura que aporté yo (parecía venir de la web antigua).
- El menú "Quiénes somos" ahora enlaza a `/#inicio` (la propia primera pantalla), no a una sección aparte.
- El ancho de los bloques de texto de la izquierda está ligado a una variable CSS (`--tablon-ancho`) para que coincida con el ancho de la columna del Tablón.

### Tablón (columna derecha del hero)
- La lista de "Últimas noticias" se convirtió en un **carrusel vertical de 3 posiciones** (arriba/centro/abajo), con la del centro protagonista (borde dorado) y las de arriba/abajo más pequeñas pero legibles.
- Rota sola cada 30 segundos, y tiene **flechas manuales** (▲/▼) pegadas a la tarjeta central para pasar noticias a mano (al pulsarlas, reinicia el contador de 30s).
- Usa hasta 8 noticias (no solo 3) para el carrusel.

### Servicios (sección nueva)
- Categorías del menú desplegable "Servicios" cambiadas a: **Información, Asesoramiento Jurídico, Formación, Orientación Laboral, Acompañamiento** (antes eran Bolsa de empleo, OPEs CYL, etc.). Cambiado también en el pie de página.
- Se creó la sección "Servicios" en la portada con las 5 categorías en tarjetas.
- Se creó la sección **"Asesoría Jurídica"** justo debajo, con la tabla completa de tarifas (sacada de `cesmvalladolid.com`, reescrita con estilo propio) y las notas legales/condiciones de pago.

### ⚠️ Sección "Quiénes somos" y "Servicios" originales — investigar
En algún punto **muy temprano** de esta sesión (durante los primeros arreglos del `index.njk`), se descubrió que las secciones originales "Quiénes somos" y "Servicios" de la portada habían desaparecido del archivo — probablemente porque Claude reconstruyó `index.njk` sin tenerlas en cuenta al hacer una de las primeras ediciones. Se recuperaron/rehicieron parcialmente (ver más arriba: el bloque nuevo de "Quiénes somos" dentro del hero, y la sección "Servicios" nueva), pero **nunca se llegó a recuperar el contenido ORIGINAL exacto de "Quiénes somos"** desde el historial de Git (se pidió, pero la conversación siguió por otro lado con la captura que aporté yo). Si algo de esa sección original (aparte de lo ya reconstruido) se echa en falta, revisar el historial de commits de `index.njk` en GitHub (el primer commit, "Migrar web a Eleventy...").

## Cosas pendientes / para retomar

1. **Prioridad:** confirmar si el título de la portada se sigue tapando con el aviso al hacer scroll rápido justo después de cargar la página (último bug reportado, arreglo enviado pero no confirmado).
2. Decidir si hace falta recuperar algo más del contenido original de "Quiénes somos" desde el historial de Git.
3. Revisar cómo se ve todo en **móvil** en detalle (se hizo un primer pase para el aviso y algunos elementos, pero no una revisión completa).
4. Dominio propio (`cesmcyl.org` u otro) — pendiente de comprar; cuando se tenga, añadir en "Domains" del Worker `cesmcyl` en Cloudflare.
5. Regenerar el `GITHUB_TOKEN` del Worker `cesmcyl-cms-proxy` (apareció en una captura de pantalla en su momento, por seguridad).
6. Sopesar si se quiere devolver el brillo animado del aviso y el punto rojo "parpadeante" (se quitaron como prueba durante la depuración de un bug de vibración, y no se han vuelto a añadir).
