# Visor territorial de Yumbel

[Abrir el visor](https://visorjuntasdevecinos.github.io/visor-kmz/)

Mapa público de las juntas de vecinos, las unidades vecinales y el límite comunal de Yumbel. Funciona como sitio estático en GitHub Pages.

## Capas y controles

- Límite comunal, sin relleno y con borde destacado.
- 27 unidades vecinales con color por código y 50% de transparencia inicial, ajustable entre 0 y 100%.
- Juntas de vecinos del KMZ original, visibles también en la vista general. Conserva las fichas y el enlace a Google Maps.
- Controles independientes para cada capa y sus nombres. Las etiquetas evitan superposiciones y aparecen progresivamente al acercarse.
- Leyenda que puede ocultarse; cada unidad de la leyenda permite acercar el mapa a su territorio.
- Botones para ver toda la comuna o todas las juntas; panel plegable en celulares.

## Datos

Los GeoJSON de `data/` se exportaron desde las dos capas del proyecto QGIS abierto, conservando sus geometrías y atributos, en WGS 84 (EPSG:4326), con siete decimales y sin simplificación:

| Archivo | Capa de origen | Registros |
| --- | --- | ---: |
| `data/limite_yumbel.geojson` | Comuna de Yumbel | 1 |
| `data/unidades_vecinales.geojson` | unidades_vecinales_junio2026_v1, filtro `"t_com_nom" = 'YUMBEL'` | 27 |

Se conservan los nombres y códigos de origen. Las unidades con igual nombre se distinguen por código. Los campos adicionales `nombre`, `codigo`, `color`, `etiqueta_lat`, `etiqueta_lng` y `area_km2` sirven para representar y etiquetar el mapa. Las etiquetas se ubican dentro de los polígonos mediante el polo de inaccesibilidad calculado en UTM 18S.

`JuntasDeVecinos.kmz` se mantiene como fuente de las juntas y sus fichas. Los contenidos de las fichas corresponden al archivo original.

## Desarrollo

No requiere compilación. Servir esta carpeta por HTTP, por ejemplo con `python -m http.server 8765`, y abrir `http://localhost:8765/`. Requiere conexión para cargar Leaflet, JSZip, Omnivore y la cartografía de Esri.
