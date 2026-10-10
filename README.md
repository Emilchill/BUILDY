# Catálogo de estructuras de Minecraft

Sitio web (catálogo/foro) para publicar y explorar estructuras de **Bedrock** y **Java**: fotos, filtros, ficha con **visor 3D opcional** y
**lista de materiales siempre en pilas** (con vista en **shulkers** cuando la obra es grande). Sin dependencias en producción: solo Node ≥ 18.

## Arrancar

```bash
npm start                                        # http://localhost:8000  ·  admin / admin12345 (solo desarrollo)
ADMIN_PASSWORD='una-clave-larga' npm start       # con tu propia clave de admin
```

- **Login admin "hardcode" (beta):** sin variables, la cuenta es `admin` / `admin12345`. En el login aparece un botón **Entrar como admin**,
  pero **solo si la clave es la de por defecto y la petición viene de localhost**. Con `NODE_ENV=production` o `SECURE_COOKIES=1` el servidor
  **se niega a arrancar** con la clave por defecto: hay que definir `ADMIN_PASSWORD`.
- La cuenta admin se crea la primera vez. Para cambiar su clave después, borra su archivo en `storage/users/` y reinicia.
- Variables: `PORT` (8000), `STORAGE_DIR` (`./storage`), `ADMIN_USER`, `ADMIN_PASSWORD`, `SECURE_COOKIES=1` (obligatorio detrás de HTTPS).
- Todo lo subido vive en `storage/` (usuarios, obras, imágenes, texturas). Haz copias de esa carpeta.

## Sitio estático (GitHub Pages) · modo local

Si subes el repositorio tal cual a GitHub Pages (`https://usuario.github.io/REPO/`) **no hay servidor Node**. La web lo detecta sola (`GET api/health` falla) y
arranca en **modo local**: las mismas rutas, servicios, roles y reglas que `server/`, pero sobre IndexedDB del navegador (`js/app/local/`). Se ve un aviso arriba.

- Login: `admin` / `admin12345` (botón **Entrar como admin** en el modal) o registra usuarios; todo funciona: subir, editar, borrar, moderar, texturas, visor 3D.
- **Los datos son de cada navegador**: lo que publica un visitante no lo ve otro. Es para probar/enseñar. Para que sea compartido hay que desplegar el servidor
  (`npm start` en un hosting con Node) y, para miles de usuarios, pasar a base de datos (docs/ESCALABILIDAD.md): el cliente no cambia, porque `js/app/api.js` solo usa rutas relativas.
- Fuerza el modo local aunque haya servidor con `?local` en la URL.
- Las contraseñas del modo local se guardan con PBKDF2, pero al ser todo cliente **no es seguridad real**: no pongas datos sensibles.

## Roles (beta)

El botón **Iniciar sesión (beta)** está arriba a la derecha. Con el admin dentro aparece la etiqueta **MODO ADMIN**, la franja morada en la cabecera y la sección **Moderación** (búsqueda por título/autor, filtro publicadas/borradores, paginada en servidor). Cada acción del admin sobre contenido ajeno se registra en la consola del servidor (`MODERACIÓN …`). Los permisos están en una sola tabla, `server/roles.js` (los de `build:*` solo se aplican a publicaciones propias):

| Rol | Puede | No puede |
|---|---|---|
| Visitante | ver el catálogo, fotos, visor 3D, materiales, descargar | publicar |
| **Usuario** (registro abierto) | **subir el archivo y las imágenes; editar y eliminar SUS publicaciones** | tocar publicaciones ajenas; actualizar texturas |
| **Administrador** (cuenta `admin`, **modo admin**) | **moderar: ver, editar y eliminar cualquier publicación (también borradores)** · **actualizar las texturas globales** | subir construcciones ni publicar por otros |

## Cómo funciona

- **Subida (Usuario):** crea la publicación → sube el archivo (el servidor lo analiza: plataforma, dimensiones, bloques y materiales) →
  sube 1 a 6 imágenes (PNG/JPG/WEBP reales, se reducen en el navegador si pesan mucho) → publica. Sin archivo e imagen no se publica.
- **Clasificación automática:** `.mcstructure` → **Bedrock**; `.nbt`, `.schem`, `.litematic` → **Java**. Tamaño por dimensión más larga:
  Pequeña ≤ 24 · Mediana 25–64 · Grande 65–128 · Enorme > 128. El **tipo de construcción** (casa, castillo, redstone, granja…) lo elige quien sube.
- **Filtros:** plataforma, tipo, tamaño, búsqueda (título, etiquetas, autor) y orden (recientes, más bloques, más grandes, A–Z).
- **Ficha:** galería, datos, **Ver en 3D** (se carga solo si lo pides), descarga y **materiales**: siempre en pilas (`3 × 64 + 12`; 16 para
  carteles/estandartes, 1 para camas/shulkers). Si ocupa más de 27 huecos, aparece **En shulkers** y reparte los ítems en cajas de 27.
- **Texturas globales (Admin):** sube el `.zip` de `bedrock-samples` (o un resource pack de Java). Se procesa **en el navegador del admin** y
  solo se envía el atlas (PNG + índice); todos los visitantes ven esas texturas y los nombres en español. Se actualiza sin tocar el código.

## Estructura

```
index.html · css/app.css        sitio (catálogo)
viewer.html · css/style.css     herramienta local de visor (sin servidor)
server/                         server.js (arranque) · app.js · config.js · router.js · http.js · auth.js · roles.js · analyze.js
  routes/                       auth · builds (+ moderación) · textures · static (solo HTTP)
  services/builds.js            reglas de negocio: permisos, dueño, cuotas, versiones
  storage/                      index.js (fábrica) · file-store.js (contrato async; reemplazable por base de datos)
js/app/                         main · router · auth · api · ui · textures-global · materials-view · viewer-panel · pages/{catalog,build,upload,mine,edit,moderate,admin}
docs/ESCALABILIDAD.md           cómo pasar a base de datos y escalar
js/catalog.js                   categorías, tamaños y clasificación (compartido cliente/servidor)
js/materials.js                 pilas, shulkers, CSV
js/formats · blocks · render · textures    núcleo del visor (ver abajo)
data/aliases.json               equivalencias Java ⇄ Bedrock (solo ids)
tests/                          local.mjs (interfaz sin servidor) · run.mjs (núcleo) · store.mjs + store-contract.mjs (contrato del almacén) · server.mjs (API, roles, límites) · ui.mjs (interfaz con jsdom) · bench.mjs
```

API principal: `GET /api/builds?platform&category&size&q&sort&page` · `GET /api/builds/:id` (+`/file`, `/images/:n`) ·
`POST /api/builds` → `PUT …/file?name=` → `PUT …/images/:n` → `POST …/publish` · edición: `PATCH /api/builds/:id` (con `rev`) · `DELETE /api/builds/:id` ·
`DELETE …/images/:n` · `POST …/images/:n/cover` · `GET /api/me/builds` · `GET /api/admin/builds?status&q&page` (moderación) · `GET /api/health` ·
`GET /api/textures` · `POST /api/admin/textures/:kind` · `/api/register` · `/api/login` · `/api/logout` · `/api/session`.

## Pruebas

```bash
npm install            # solo para las pruebas de interfaz (jsdom)
npm test               # núcleo + contrato del almacén + API/roles/límites + interfaz
npm run bench          # capacidad con 20 000 obras
BEDROCK_SAMPLES=/ruta/bedrock-samples node tests/run.mjs   # además contra el pack real
```

## Seguridad y límites de la beta

- Contraseñas con scrypt; sesión en cookie `HttpOnly` firmada; las peticiones que modifican datos exigen la cabecera `X-Requested-With`.
- Validación en servidor de formato, tamaño (archivo 64 MB, imagen 5 MB, descompresión máx. 400 MB, rejilla máx. 80 M celdas) y de que las imágenes
  sean imágenes reales. Límite de intentos de login/registro en memoria (se reinicia con el servidor).
- Cada usuario puede editar y eliminar solo lo suyo (la edición usa control de versión `rev`: si dos pestañas editan a la vez, la segunda recibe 409). Los borradores sin publicar se eliminan a las 24 h. La moderación del admin (editar/eliminar contenido ajeno) ya está; falta un historial persistente de auditoría (hoy solo va al log).
- Hoy el almacenamiento son archivos (`STORAGE=file`): probado con 20 000 obras y 5 000 usuarios en un proceso. Para más, ver **docs/ESCALABILIDAD.md** (contrato del almacén, esquema SQL, migración y escalado horizontal).
- Si lo publicas en internet: ponlo detrás de HTTPS (Caddy/nginx), usa `SECURE_COOKIES=1` y cambia la contraseña del admin.

## Aviso legal

El repositorio contiene **solo código**: ninguna textura, texto o recurso de Minecraft. Los recursos de Mojang (`bedrock-samples`, packs) están
sujetos a su licencia ("All rights reserved") y al [EULA](https://www.minecraft.net/en-us/eula). Al publicar texturas globales como administrador
las sirves a todos los visitantes: hazlo solo si tienes derecho a distribuirlas (p. ej. un pack propio) o mantén el sitio privado.
Minecraft es una marca de Mojang AB / Microsoft.

## Núcleo del visor

`js/formats` lee `.mcstructure`/`.nbt`/`.schem`/`.litematic` · `js/blocks` formas, conexiones y orientación (escaleras, palancas, tolvas, rieles,
redstone…) · `js/render` geometría y escena three.js · `js/textures` atlas, TGA, packs Java y Bedrock.
