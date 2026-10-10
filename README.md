# Visor de estructuras de Minecraft

Visor 3D en el navegador para estructuras de **Bedrock** (`.mcstructure`) y **Java** (`.nbt`, `.schem`, `.litematic`), con lista de
materiales (nombres en español, cantidades, stacks, exportación a CSV) y bloques con su forma y orientación reales: escaleras,
losas, vallas, puertas, palancas, tolvas, rieles, redstone, repetidores, pistones, etc.

## Uso

```bash
python3 -m http.server 8000     # o: npm start
# abre http://localhost:8000
```

Los módulos ES necesitan un servidor local (no funcionan abriendo `index.html` con doble clic).

1. **Cargar texturas** (una sola vez; se guardan en tu navegador):
   - el `.zip` de [`bedrock-samples`](https://github.com/Mojang/bedrock-samples): aporta texturas, nombres en español y el índice de bloques;
   - o un resource pack de Java (`.zip`) / el `.jar` del juego.
2. **Subir estructura** (o arrastrarla a la ventana). Puede ir dentro de un `.zip`/`.mcpack`.
3. Panel lateral: capa máxima, origen de texturas, lista de materiales (clic en un bloque = ocultarlo), CSV.

## Qué hace con los datos de Bedrock

El zip de `bedrock-samples` se lee **en el navegador** y se convierte en un índice compacto:

| Origen en el zip | Para qué se usa |
|---|---|
| `resource_pack/blocks.json` | caras (arriba/abajo/lados) de cada bloque |
| `resource_pack/textures/terrain_texture.json` | clave de textura → archivo (con variantes) |
| `resource_pack/textures/blocks/*.png` y `*.tga` | atlas 3D (las `.tga` se decodifican en `js/textures/tga.js`) |
| `resource_pack/texts/es_ES.lang` + `metadata/vanilladata_modules/mojang-blocks.json` | nombres para la lista de materiales |

`data/aliases.json` traduce los nombres de Java a los ids de Bedrock (`grass_block` ⇄ `grass`, `sugar_cane` ⇄ `reeds`, `oak_door` ⇄
`wooden_door`, ...). Está verificado contra el `blocks.json` de la versión 1.26.50.4.

## Estructura

```
index.html            página
css/style.css
data/aliases.json     equivalencias Java <-> Bedrock (solo ids)
js/
  main.js             arranque y UI (archivos, packs, materiales)
  materials.js        lista de materiales, stacks, CSV
  formats/            nbt.js · model.js (rejilla de estados) · loaders.js (.mcstructure/.nbt/.schem/.litematic)
  blocks/             shapes.js (formas y conexiones) · orientation.js (caras por orientación)
                      bedrock.js (estados Bedrock -> Java) · colors.js (colores sin textura, tintes)
  render/             mesh.js (geometría, sin three.js) · scene.js (three.js, cámara) · math.js
  textures/           atlas.js · store.js (IndexedDB) · java.js · bedrock.js · tga.js
tests/run.mjs         pruebas en Node
```

## Pruebas

```bash
npm test                                          # formatos, geometría, conexiones, materiales
BEDROCK_SAMPLES=/ruta/bedrock-samples npm test    # además valida contra el pack real
```

Con `bedrock-samples 1.26.50.4`: 1331/1331 bloques de Bedrock con textura y 1311 con nombre en español; de los ids de Java,
1028/1043 con textura y 1017 con nombre (los que faltan son entidades/bloques técnicos: marcos, cultivos adjuntos, etc.).

## Aviso legal

Este repositorio contiene **solo código** y la tabla de ids `data/aliases.json`. No incluye texturas, textos ni otros recursos de
Minecraft. `bedrock-samples` se publica con la licencia *"(c) Mojang AB. All rights reserved"* sujeta al
[EULA de Minecraft](https://www.minecraft.net/en-us/eula), por eso el visor lo lee desde tu copia local y guarda el resultado únicamente
en tu navegador (el botón *Borrar texturas guardadas* lo elimina). Minecraft es una marca de Mojang AB / Microsoft.

## Limitaciones conocidas

- Bedrock: solo se interpretan orientación/estados de escaleras, losas, antorchas, redstone, rieles, palancas y bloques con
  `facing_direction`. Repetidores y comparadores de Bedrock aún no.
- Las palancas: el sentido de encendido y el de las de suelo/techo de Bedrock no está verificado con archivos reales
  (hay dos casillas en el panel para invertirlo).
- Camas, carteles, cabezas y otros bloques que Mojang dibuja con entidades se muestran como cubos/colores simples.
