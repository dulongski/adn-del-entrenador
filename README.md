# ADN del Entrenador

**ISAC Hackathon 2026 — «La Historia de un Entrenador a través de los Datos».**

Un laboratorio que responde *¿cómo juega este entrenador?* separando primero **qué parte del estilo es del DT y qué parte es de su plantilla, su club, el rival y el contexto**.

- **Método:** descomposición AKM + RAPM del estilo, que es el modelo de efectos fijos DT/club de Muehlheusser et al. (2018) aplicado a 35 indicadores de estilo (y no a resultados) y ampliado con los jugadores en cancha.
- **Validación:** *prueba de transferencia*. Se oculta la etapa de un DT en un club y se comprueba si el modelo lo reconoce con otra plantilla.
- **ML:** jugadas tipo (GMM), roles espaciales (NMF), motores de variación (LightGBM + SHAP) y clasificación de DT (logística multinomial).
- **Cobertura del reto:** todas las secciones (5.1–5.6 y 6): fases ofensiva y defensiva, consistencia y contexto, uso de jugadores, balón parado, métricas propias, marco analítico y simulación.

Metodología completa en [docs/METODOLOGIA.md](docs/METODOLOGIA.md).

## Estructura

```
config/framework.yaml      marco analítico: TODOS los objetos y umbrales
pipeline/
  paths.py                 dónde viven los datos: ~/coach-dna-data (o $COACH_DNA_DATA_DIR), fuera del repo
  sb_client.py             API StatsBomb + caché local en la carpeta de datos
  framework.py             posesión, stint, acción progresiva, presión, resumen 360
  process.py               caché → tablas parquet (stints, posesiones, tiros, balón parado…)
  features/                indicadores de estilo, jugadores, balón parado
  models/                  decomposition (AKM+RAPM), transfer_test, archetypes, context, simulation
  report/                  narrativa en español + exportación a Markdown
  build.py                 orquestador → artifacts/*.json (solo resultados agregados)
api/main.py                FastAPI (artefactos + simulación bajo demanda)
web/                       React + Vite (Laboratorio del Entrenador)
tests/                     marco analítico + validación sintética de la descomposición
```

## Correrlo

Los datos **no** viven en el repositorio: van en `~/coach-dna-data` (fuera de git y de iCloud/Dropbox). Para otra ruta, `export COACH_DNA_DATA_DIR=/ruta`. Ahí quedan el caché del API (`events/`, `360/`, `lineups/`, `matches/`), las tablas (`processed/`), los cachés del modelo (`model_cache/`, `cache/`) y el marcaje 360 (`marking/`).

```bash
cp .env.example ~/coach-dna-data/.env     # SB_USER / SB_PASS (también vale ./.env)
python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt   # versiones exactas usadas
.venv/bin/python -m pipeline.sb_client    # descarga (≈1,780 partidos Liga MX 2021/22–2026/27)
.venv/bin/python -m pipeline.process      # ≈30 min
.venv/bin/python -m pipeline.build        # modelos + artefactos (--fast para saltar bootstrap/transferencia)
.venv/bin/python -m pipeline.models.stylemap   # mapa de estilos de la portada (PCA 2D + familias)
.venv/bin/python -m pipeline.media                 # logos de clubes y fotos de DTs (Wikidata, enlazadas) + club actual
.venv/bin/python -m pipeline.report.to_markdown --coach Almada
.venv/bin/python -m pipeline.whatif        # datos del simulador «¿Y si…?» (~2.5 min; lo hace build)
.venv/bin/python -m pipeline.names         # nombres/apellidos (config/nombres_manual.json para corregir)
.venv/bin/python -m pipeline.export_static # datos para la web estática (lo hace build al final)
.venv/bin/pytest
cd web && npm install && npm run dev      # http://localhost:5199
```

## Publicar la web

La web es **100% estática**:
- La portada (mapa, lista de DTs, medios) va empaquetada dentro del JavaScript (`web/src/boot.json`).
- Cada perfil se descarga de `data/dt_<id>.json`.
- El simulador rejuega los partidos **en el navegador** con `data/sim_<id>.json`.

```bash
cd web && npm run build                   # genera web/dist
python3 -m http.server 5300 --directory web/dist   # probarla localmente
```

`web/dist` se sube tal cual a GitHub Pages, Netlify o Vercel (usa rutas relativas y funciona en cualquier subcarpeta).

La API (`api/main.py`, FastAPI) queda como **opcional**, para funciones que requieran servidor, como el simulador «¿y si…?» o analizar un DT nuevo en línea:

```bash
.venv/bin/uvicorn api.main:app --port 8765
```

**El día del evento:** si ISAC entrega los partidos de un DT, se agregan al caché (misma API/formato) y se corren `process` y `build --coach "<nombre>"`. El DT aparece en el laboratorio junto con toda la liga como referencia.

## Uso de datos

Los datos de StatsBomb son de uso exclusivo para la competencia. El repositorio **no** contiene datos crudos: viven en `~/coach-dna-data`, fuera del repo (y `data/` sigue en `.gitignore` por si acaso) y `artifacts/` solo guarda resultados agregados, como el que permiten las bases del concurso («pueden presentar resultados pero no los datos»).
