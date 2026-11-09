# Presentación final (ISAC 2026)

Fuente del deck animado de la final (10 láminas, 1920×1080).

| Archivo | Qué es |
|---|---|
| `template.html` | El deck. Los marcadores `__DATA__`, `__IMGJS__`, `__I_<k>__`, `__ISAC__`, `__PIN__`, `__BALL__` y `__QR__` se sustituyen al armarlo. |
| `build.py` | Arma `coach-dna-final.html` (sin notas) y `coach-dna-notas.html` (con notas del speaker, tecla N). |
| `deck_data.py` | Regenera `data.json` desde los datos del repo: `PYTHONPATH=. python docs/presentacion/deck_data.py`. |
| `data.json` | Solo resultados agregados. No incluye datos crudos de StatsBomb. |
| `simres4.json`, `sim/` | Conteos y scripts de la simulación de 3,000 torneos. |
| `Guion_speaker.md` | El guion de 5 minutos. |

Los escudos y las fotos (`img.json`) son medios de terceros y **no** se versionan. Para armar el deck hace falta tener `img.json` en esta carpeta.

`grabar_demos.mjs` graba con Playwright los clips de la plataforma (`demo/*.mp4`) que abren cada pestaña del deck. Los clips no se versionan: muestran escudos y fotos de terceros.
