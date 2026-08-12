# CESMCYL — Nueva web con panel de edición (Decap CMS)

Esta carpeta contiene la web reconstruida con Eleventy (mismo diseño que la
actual) más el panel de edición visual protegido por contraseña.

## Qué hay en cada carpeta

- `src/` → el código de la web (páginas, noticias, estilos)
- `worker-proxy/` → el "guardia de seguridad" que protege el panel con la
  contraseña compartida y habla con GitHub en vuestro nombre
- `eleventy.config.js` → configuración de cómo se genera la web

## PASO 1 — Subir la web a GitHub

1. Abre GitHub Desktop, ve a tu repositorio `cesmcyl-web`
2. Borra todo el contenido antiguo de la carpeta (o mueve estos archivos
   nuevos encima, sustituyendo lo que ya había)
3. Copia dentro el contenido de esta carpeta: `src/`, `eleventy.config.js`,
   `package.json`, `.gitignore` — **NO** copies la carpeta `worker-proxy`
   aquí, esa va a un sitio distinto (Paso 3)
4. Commit: "Migrar web a Eleventy con panel de edición"
5. Push origin

## PASO 2 — Configurar Cloudflare Pages para que use Eleventy

Ahora mismo Cloudflare Pages sirve los archivos tal cual, sin "construir"
nada. Con Eleventy hay que decirle que ejecute un paso de construcción:

1. Ve a tu proyecto en Cloudflare Pages → Settings → Build configuration
2. **Build command**: `npm install && npx eleventy`
3. **Build output directory**: `_site`
4. Guarda y espera a que se dispare un nuevo build

## PASO 3 — Crear un token de GitHub para el Worker

Este token es el que permite que el panel guarde cambios en vuestro nombre,
sin que cada persona necesite su propia cuenta de GitHub.

1. En GitHub, ve a tu foto de perfil → **Settings**
2. Baja hasta **Developer settings** (al final del menú izquierdo)
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
4. Nombre: `cesmcyl-cms-proxy`
5. Repository access: **Only select repositories** → elige `cesmcyl-web`
6. Permissions → **Contents**: Read and write
7. Genera el token y **cópialo en un sitio seguro ahora mismo** (solo se
   muestra una vez)

## PASO 4 — Desplegar el Worker de Cloudflare

Necesitas tener Node.js instalado en tu ordenador para este paso. Si no lo
tienes, dímelo y buscamos otra vía.

1. Abre una terminal (símbolo del sistema) dentro de la carpeta `worker-proxy`
2. Ejecuta: `npm install`
3. Ejecuta: `npx wrangler login` (te pedirá iniciar sesión en Cloudflare
   desde el navegador, con la cuenta que ya usáis)
4. Ejecuta: `npx wrangler deploy`
5. Al terminar, te dará una URL parecida a:
   `https://cesmcyl-cms-proxy.TU-SUBDOMINIO.workers.dev`
   **Guarda esta URL**, la necesitas en el Paso 6

## PASO 5 — Configurar los secretos del Worker

Todavía en la terminal, dentro de `worker-proxy`:

1. `npx wrangler secret put PANEL_PASSWORD`
   → te pedirá que escribas la contraseña compartida que queréis usar
2. `npx wrangler secret put GITHUB_TOKEN`
   → pega aquí el token que creaste en el Paso 3
3. `npx wrangler secret put TOKEN_SECRET`
   → escribe cualquier frase larga y aleatoria (por ejemplo, una contraseña
   robusta generada al azar) — esta no la usa nadie para entrar, solo la usa
   el Worker internamente para firmar los tokens de sesión

## PASO 6 — Conectar la web con el Worker

1. Abre el archivo `src/static/admin/config.yml`
2. Busca la línea `proxy_url: "https://cesmcyl-cms-proxy.TU-SUBDOMINIO.workers.dev"`
3. Sustitúyela por la URL real que te dio Wrangler en el Paso 4
4. Abre también `src/static/admin/index.html`
5. Busca la línea `const PROXY_URL = "https://cesmcyl-cms-proxy.TU-SUBDOMINIO.workers.dev";`
6. Sustitúyela igualmente por tu URL real
7. Guarda ambos archivos, haz commit y push a GitHub (esto disparará un
   nuevo build de Cloudflare Pages automáticamente)

## PASO 7 — Probarlo

1. Espera 1-2 minutos a que termine el build
2. Ve a `https://cesmcyl-web.pages.dev/admin/` (o tu dominio real)
3. Escribe la contraseña compartida que pusiste en el Paso 5
4. Deberías ver el panel de edición con Noticias, Aviso urgente y Página de huelga

---

Si te atascas en cualquier paso, dime exactamente en cuál estás y qué ves
en pantalla, y seguimos desde ahí con calma.
