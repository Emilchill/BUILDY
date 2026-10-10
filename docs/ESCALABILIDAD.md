# Escalabilidad: de archivos a base de datos

Hoy el sitio guarda todo en archivos (`STORAGE=file`, "hardcode"). El código está en capas para que pasar a una base de datos sea
**escribir un adaptador nuevo**, sin tocar rutas, servicios ni interfaz.

```
navegador ──HTTP──▶ routes/*  ──▶ services/builds.js ──▶ store (contrato)  ──▶ FileStore (hoy) | PostgresStore + S3 (mañana)
                     (HTTP)         (reglas, permisos,      (async, sin HTTP)
                                     cuotas, rev)
```

| Capa | Archivos | Qué decide |
|---|---|---|
| Rutas | `server/routes/*.js`, `router.js`, `http.js` | HTTP: parámetros, cabeceras, ETag, códigos |
| Servicios | `server/services/builds.js`, `roles.js` | permisos, dueño, modo admin (`build:moderate`), cuotas, validación, concurrencia |
| Almacenamiento | `server/storage/*.js` | persistencia; **único** lugar que sabe de archivos/SQL |
| Configuración | `server/config.js` | límites y variables de entorno |

## Contrato del almacenamiento (`tests/store-contract.mjs`)

Todas las operaciones son `async`. Un adaptador nuevo es válido cuando pasa `runContract(...)`:

| Grupo | Métodos |
|---|---|
| Usuarios | `createUser` (lanza `EXISTS`; nombre único sin distinguir mayúsculas) · `getUserById` · `getUserByName` · `countUsersByRole` |
| Obras | `createBuild` · `getBuild` · `getBuildLite` (sin descripción, ruta caliente) · `updateBuild(id, patch, {expectRev})` (lanza `CONFLICT`/`NOT_FOUND`; sube `rev`; `patch.materials` va aparte) · `deleteBuild` · `getMaterials` |
| Listado | `listBuilds({status, ownerId, platform, category, size, q, sort, page, per})` → `{total, items}` · `countBuilds` · `purgeDrafts(antesDe)` · `version()` (ETag) |
| Archivos | `putBlob` · `openBlob` (`{size, stream()}`) · `readBlob` · `deleteBlob` · `renameBlob` |
| Texturas | `getTexIndex` · `putTexture` · `openTexPng` |
| Varios | `id()` · `secret()` · `stats()` · `close()` |

Para registrar el adaptador: crear `server/storage/postgres-store.js` y añadir un `case 'postgres'` en `server/storage/index.js`
(`STORAGE=postgres npm start`).

## Qué cambia en cada pieza al pasar a producción

| Hoy (archivos) | Producción | Notas |
|---|---|---|
| `users/<id>.json` | tabla `users` (`name_lower` UNIQUE) | `createUser` → `INSERT` y capturar violación de unicidad |
| `builds/<xx>/<id>/meta.json` + índice en memoria | tabla `builds` + índices | el listado pasa a SQL; ya no hay recorrido en memoria |
| `materials.json` | tabla `build_materials` | se lee solo en el detalle |
| `file.*`, `img-N.*` | almacén de objetos (S3/R2/GCS) | `openBlob` devuelve un stream; las imágenes ya llevan `?v=rev` (caché inmutable → CDN) |
| `textures/<kind>/` | `textures` (índice `jsonb`) + objeto del atlas | cambian muy poco |
| `rev` + cola por obra | `UPDATE … SET rev=rev+1 WHERE id=$1 AND rev=$2` | filas afectadas = 0 → `CONFLICT` |
| límites en memoria (`auth.js: limiter`) | Redis (`INCR` + `EXPIRE`) | misma firma `limiter(n, ms)(clave)` |
| sesión = cookie firmada con `sv` | igual (sin estado) | subir `users.sv` revoca todas las sesiones de un usuario |

### Esquema sugerido (PostgreSQL)

```sql
CREATE TABLE users(
  id char(12) PRIMARY KEY, name text NOT NULL, name_lower text NOT NULL UNIQUE, role text NOT NULL,
  sv int NOT NULL DEFAULT 1, salt text NOT NULL, hash text NOT NULL, created_at timestamptz NOT NULL);
CREATE TABLE builds(
  id char(12) PRIMARY KEY, owner_id char(12) NOT NULL REFERENCES users(id), title text NOT NULL, description text NOT NULL DEFAULT '',
  category text NOT NULL, tags text[] NOT NULL DEFAULT '{}', status text NOT NULL, rev int NOT NULL DEFAULT 1,
  platform text, format text, size text, dims_w int, dims_h int, dims_l int, total int, types int,
  file_name text, file_ext text, file_size bigint,
  created_at timestamptz NOT NULL, published_at timestamptz, updated_at timestamptz NOT NULL,
  search tsvector GENERATED ALWAYS AS (to_tsvector('spanish', title||' '||array_to_string(tags,' '))) STORED);
CREATE TABLE build_images(build_id char(12) REFERENCES builds(id) ON DELETE CASCADE, n smallint, ext text, PRIMARY KEY(build_id,n));
CREATE TABLE build_materials(build_id char(12) REFERENCES builds(id) ON DELETE CASCADE, block_id text, count int, PRIMARY KEY(build_id,block_id));
CREATE TABLE textures(kind text PRIMARY KEY, version bigint NOT NULL, index jsonb NOT NULL, atlas_key text NOT NULL);
CREATE INDEX builds_list    ON builds(status, published_at DESC);
CREATE INDEX builds_filters ON builds(status, platform, category, size, published_at DESC);
CREATE INDEX builds_owner   ON builds(owner_id, created_at DESC);
CREATE INDEX builds_search  ON builds USING gin(search);
```

Para listados muy grandes conviene paginación por cursor (`published_at, id`) en vez de `page` (el contrato ya admite añadirla sin cambiar la API pública).

## Migración archivos → base de datos

1. Detener escrituras (o modo mantenimiento corto).
2. Script: abrir `FileStore`, recorrer usuarios y obras (`listBuilds` por páginas + `getBuild` + `getMaterials`) y escribirlos con el adaptador nuevo;
   copiar `file.*` / `img-*` al almacén de objetos con `openBlob → putBlob`.
3. Ejecutar `runContract` contra el adaptador y comparar `stats()` entre ambos.
4. Cambiar `STORAGE=postgres` y arrancar. `storage/secret.key` pasa a una variable de entorno (para que todas las instancias compartan la firma de sesión).

## Escalar horizontalmente

Las instancias no guardan estado de sesión (cookie firmada), así que basta con varias réplicas detrás de un balanceador **una vez** que:
(1) el almacenamiento es compartido (base de datos + objetos), (2) los límites de uso están en Redis, (3) el secreto de sesión es común,
(4) los estáticos y las imágenes salen de un CDN. Ya está listo: ETag/304 en listados, caché inmutable en imágenes (`?v=`), gzip, scrypt asíncrono
(no bloquea el servidor al iniciar sesión), `GET /api/health` para el balanceador, cierre ordenado con SIGTERM y `TRUST_PROXY=1` para la IP real.

## Capacidad medida del almacén de archivos (`npm run bench`)

20 000 obras + 5 000 usuarios, un solo proceso: crear obras ≈ 2,9 s en total · reabrir/escanear ≈ 0,45 s · página del catálogo ≈ 22 ms · filtrada ≈ 7 ms ·
leer/actualizar una obra ≈ 1 ms · memoria ≈ 44 MB.
Límite conocido: cada escritura invalida el orden en memoria y el siguiente listado reordena (≈ 40 ms con 20 000 obras). Con mucha escritura
concurrente o cientos de miles de obras, es el momento de pasar a base de datos.

## Límites y cuotas (`server/config.js`)

Archivo 64 MB · imagen 5 MB · 6 imágenes · 5 borradores y 500 publicaciones por usuario · 120 escrituras / 10 min · 8 intentos de login por usuario y 10 por IP
cada 10 min · borradores sin publicar caducan a las 24 h.

## Cuenta admin y paso a producción

Hoy el admin es una cuenta más en `users` (`role='admin'`) con credenciales por defecto solo para desarrollo (`server/config.js: DEFAULT_ADMIN`). Al pasar a base de datos: define `ADMIN_USER`/`ADMIN_PASSWORD` como secretos del despliegue (el arranque falla en producción con la clave por defecto), y mueve el registro `MODERACIÓN …` (hoy en el log) a una tabla `audit_log(id, actor_id, action, build_id, at)` escrita desde `services/builds.js` (`own()`), el único punto por el que pasa toda acción del admin. `GET /api/admin/builds` ya pagina en el almacén (`listBuilds`), así que escala igual que el catálogo público.
