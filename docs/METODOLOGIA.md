# ADN del Entrenador — Metodología

**Reto ISAC 2026: «La Historia de un Entrenador a través de los Datos»**

> ¿Cómo juega este entrenador? Y, antes de eso, **¿qué parte de lo que vemos es del entrenador y qué parte es de sus jugadores?**

## 1. El problema

Un perfil de estilo hecho con los partidos de un equipo mezcla cinco cosas: las ideas del DT, la calidad y el perfil de sus jugadores, lo que es propio del club (estadio, altitud, cultura, directiva), el rival de cada partido y el contexto (marcador, minuto, localía, expulsiones). El DT y su plantilla aparecen siempre juntos: cada partido del DT es también un partido de sus jugadores. Por eso decir «el América de Almada presiona alto» no aclara si eso lo pone Almada o lo pone el plantel del América.

Nuestra respuesta: tratar la separación DT–plantilla como un **problema de identificación**. Tomamos de la economía laboral la técnica que se usa para separar el efecto del trabajador del efecto de la empresa, y la aplicamos al **estilo de juego**.

## 2. Fundamento académico

| Referencia | Qué tomamos |
|---|---|
| Abowd, Kramarz & Margolis (1999), *Econometrica* 67(2) — modelo **AKM** | Efectos fijos dobles (trabajador + empresa) identificados por la **movilidad** entre empresas. |
| Muehlheusser, Schneemann, Sliwka & Wallmeier (2018), *Journal of Sports Economics* 19(6), 786–819 | Aplican AKM a la Bundesliga: efectos fijos de DT + club, identificados porque los DTs cambian de club. Lo hacen sobre **resultados** (puntos) y además documentan que el DT influye en el estilo. |
| Macdonald (2011), *JQAS* 7(3); Macdonald (2012), arXiv:1201.0317 | *Adjusted plus-minus* con regresión ridge sobre quién está en cancha: aísla el efecto de cada jugador de sus compañeros y rivales. |
| Fernández-Navarro et al. (2016), *Journal of Sports Sciences* 34(24), 2195–2204 | Catálogo validado de indicadores de estilo ofensivo y defensivo. Es la base de nuestro vector de estilo. |
| Decroos & Davis (2019), *ECML-PKDD* — *Player Vectors* | NMF sobre mapas de calor de acciones para describir roles espaciales de jugadores. |
| Lundberg & Lee (2017), *NeurIPS* — SHAP | Explicación de los motores de variación partido a partido. |

**Nuestra aportación:** (1) usamos AKM para **estilo** en vez de resultados; (2) le sumamos **jugadores en cancha** al estilo RAPM, para aprovechar también la rotación y las sustituciones y no solo los cambios de club; (3) lo validamos con una **prueba de transferencia**, que comprueba si el modelo reconoce a un DT en un club que nunca vio.

## 3. Marco analítico (definición de objetos)

Todas las definiciones y umbrales viven en un solo archivo, [`config/framework.yaml`](../config/framework.yaml), y el código las implementa en [`pipeline/framework.py`](../pipeline/framework.py). Cada métrica, visualización y modelo se deriva de estos objetos.

Las coordenadas son las de StatsBomb: cancha de 120×80 yardas y el equipo que ejecuta la acción ataca siempre hacia x=120.

| Objeto | Definición |
|---|---|
| **Posesión** | Id de posesión de StatsBomb, cuando el equipo es el poseedor y hace al menos 1 acción con balón (pase, conducción, tiro o regate). |
| **Secuencia ofensiva** | Posesión que alcanza el último tercio (x ≥ 80). |
| **Acción progresiva** | Pase completado o conducción de ≥ 5 yd que reduce la distancia a la portería al menos un 25% y termina en x ≥ 48. Excluye balón parado. |
| **Transición ofensiva** | Posesión en juego abierto que empieza justo después de una posesión rival (recuperación). Es **rápida** si llega al último tercio en ≤ 10 s. |
| **Transición defensiva** | Pérdida en juego abierto tras la cual el rival llega a nuestro último tercio en ≤ 10 s. |
| **Fase de presión** | Cadena de eventos *Pressure* del mismo equipo separados por ≤ 5 s. Alta: x ≥ 80. Media: 40–80. Baja: < 40. |
| **Contrapresión** | Presión propia en los ≤ 5 s posteriores a una pérdida en juego abierto. |
| **PPDA** | Pases rivales en su 60% propio / acciones defensivas propias (entradas, intercepciones, faltas) en esa misma zona. |
| **Línea defensiva (360)** | Durante la posesión rival, media de la distancia a nuestra portería de los 4 jugadores de campo más retrasados que se ven en el freeze-frame (mínimo 3 visibles). |
| **Balón parado** | Córner, tiro libre en campo rival o saque de banda en el último tercio. Dura hasta 15 s o hasta el fin de la posesión. |
| **Stint** | Intervalo del partido sin cambios en los 22 jugadores en cancha ni en el marcador. |
| **Segmento** | Stints consecutivos unidos hasta sumar ≥ 5 minutos. Es la **unidad del modelo**: las covariables (exposición de jugadores, estado del marcador) se ponderan por tiempo. |

**Coherencia interna.** Cada uno de los 34 indicadores es un cociente *numerador/denominador* de contadores calculados por (stint, equipo). Cualquier agregación, sea segmento, partido, temporada o DT, se calcula igual: Σnum / Σden. Así un número del informe, uno del gráfico y uno del modelo siempre coinciden.

**Supuestos explícitos:**
- El DT de cada partido es el que registra StatsBomb.
- Las posesiones siguen la segmentación de StatsBomb.
- El 360 solo se usa en los partidos que lo tienen: los indicadores 360 tienen denominador 0 donde no hay datos y el modelo los pondera en consecuencia.
- Los segmentos de menos de 5 minutos se unen al siguiente.

## 4. Vector de estilo (34 indicadores + 8 jugadas tipo)

Familias según las fases que pide el reto (5.1): **Construcción** (posesión, salida corta del portero, pase largo, construcción exitosa, pases por posesión, tempo), **Progresión** (verticalidad, acciones progresivas, progresión por conducción y por banda, cambios de orientación, entradas al último tercio), **Ocasiones** (xG/90, xG por tiro, tiros/90, llegada al área, centros, OBV/90), **Presión** (PPDA, altura de presión, presión alta, intensidad, contrapresión, recuperaciones altas), **Organización defensiva** (altura de acciones defensivas, línea 360, longitud del bloque 360, duración de las posesiones rivales, xG en contra), **Transiciones** (transiciones rápidas, % del xG que nace de transiciones, transiciones concedidas), **Dominio** (field tilt) y **Balón parado** (xG/90).

**Jugadas tipo** (ML no supervisado): mezcla gaussiana de covarianza completa (K=8, en el codo del BIC entre 4 y 12) sobre seis descriptores de cada posesión en juego abierto: dónde empieza, avance máximo, duración (log), pases (log), verticalidad y peligro (ordinal: último tercio / área / remate). Los nombres salen de reglas explícitas sobre los centroides. La frecuencia de cada jugada tipo se vuelve un indicador más del vector de estilo y pasa por la misma descomposición.

## 5. Modelo central: Descomposición de Estilo

Para cada indicador *k* y cada fila *i* = (segmento, equipo):

```
z_ik = α_DT + φ_club + Σ_j β_j · exposición_ij + γ_rival×temporada + δ · contexto_i + ε_ik
```

- **z** es el indicador estandarizado con la media de la liga y la **desviación típica entre equipos-temporada**. +1σ equivale a «una desviación típica de lo que los equipos se diferencian entre sí». Los valores extremos se winsorizan al 1–99%.
- **Contexto:** local, fracción del tiempo perdiendo o ganando, superioridad numérica y minuto (lineal + cuadrático).
- **Estimación:** mínimos cuadrados ponderados (peso d/(d+mediana), creciente y acotado en el denominador del indicador) con **ridge por bloque** elegido por **validación cruzada agrupada por partido** (3 pliegues, 8 indicadores; rejilla DT {5…1000} × jugadores {20…2000} × club {20, 100}): DT 80, club 100, jugadores 200, rival 10, contexto 1. La superficie de error es plana cerca del óptimo. Advertencia: en la parte que los datos no pueden identificar, el ridge reparte la señal según estos pesos, que asignan más a la plantilla que al DT. Es una postura **conservadora**: al DT solo se le atribuye lo que los datos respaldan. Los jugadores con menos de 270 minutos se agrupan en «otros».
- **Identificación:** α_DT se separa de φ_club cuando el DT dirige más de un club o el club tiene varios DTs, y se separa de β_jugador cuando los mismos jugadores juegan con otros DTs, además de la rotación y las sustituciones. El ridge encoge hacia 0 (la media de la liga) lo que no se puede identificar, en lugar de inventarlo.
- **Incertidumbre:** bootstrap por conglomerados (remuestreo de partidos, 30 réplicas) para el error estándar de α.

**Salidas:**
1. **Huella del DT:** α por indicador con IC 95% y percentil entre DTs.
2. **Prisma (atribución):** para los partidos del DT, el valor observado se reparte en DT + plantilla + club + rival + contexto + residuo.
3. **Reparto de varianza en la liga:** cov(componente, observado)/var(observado) a nivel equipo-temporada.
4. **Índice de identificabilidad (0–100):** 35% movilidad (clubes dirigidos, con tope en 3), 40% conectividad (parte de sus minutos-jugador que corresponde a futbolistas con ≥ 450 min con otro DT) y 25% club compartido (parte de su tiempo en clubes que tuvieron otros DTs).

### Validación sintética ([`tests/test_decomposition.py`](../tests/test_decomposition.py))
Simulamos una liga de 10 clubes y 4 temporadas en la que **cada DT ficha jugadores a su imagen**: el estilo de los fichajes tiene correlación 0.8 con el del DT, que es justo la confusión del problema. El modelo recupera los efectos DT verdaderos con **correlación 0.95 y RMSE 0.40**. El promedio ingenuo por DT tiene **RMSE 1.02**, casi el triple.

## 6. Prueba de transferencia (el experimento central)

Para cada DT que dirigió ≥ 2 clubes (con ≥ 8 partidos en cada uno):
1. Se retiran de la muestra sus partidos en el club B.
2. Se reajusta toda la descomposición sin esos partidos, para que no haya fuga de información.
3. Se promedia el vector de estilo (34 indicadores, en σ) de los partidos ocultos, en dos versiones: **crudo** y **ajustado** (z menos club, jugadores, rival y contexto, usando los coeficientes del ajuste sin la etapa).
4. Se correlaciona ese perfil con el perfil medio de cada DT candidato (≥ 12 partidos) en el resto de la liga y se registra **en qué puesto queda el DT verdadero**. Para el DT oculto, su perfil sale solo de sus *otros* clubes.
5. **Azar:** con K candidatos, el puesto esperado es (K+1)/2 y la probabilidad de quedar en el top 5 es 5/K. Una prueba de signo contrasta cuántas etapas quedan en la mitad superior.

Si el DT queda arriba con otra plantilla, su estilo viajó con él. Si el ajuste mejora el puesto respecto al crudo, la descomposición está quitando ruido de plantilla y club. (Probamos también un clasificador multinomial por partido: el ruido de un solo partido y el desbalance de clases lo hacían menos informativo que la comparación de perfiles medios.)

## 7. Consistencia, contexto y evolución (5.2)

- **Fuerza de identidad:** validación cruzada agrupada por partido. Se mide qué probabilidad asigna el modelo al DT correcto en un solo partido, comparada con el azar.
- **Dispersión:** distancia media de cada partido (estilo ajustado) al centroide del DT, expresada como percentil entre DTs.
- **Curvas de reacción:** estilo ajustado por marcador, minuto, localía y fuerza del rival (terciles del xG diferencial del rival en la temporada), frente a la liga en la misma situación.
- **Motores (SHAP):** LightGBM poco profundo sobre los partidos del DT. Las variables son localía, fuerza del rival, diferencia de goles y el **estilo del DT rival** (sus α de PPDA, posesión y verticalidad).
- **Evolución:** serie por partido del estilo ajustado con media móvil de 5 y marcas en cada cambio de club.
- **A lo largo del tiempo** (`pipeline/tiempo.py`): estilo propio por torneo (Apertura jul–dic, Clausura ene–jun; ≥ 5 partidos) en los 34 indicadores, con su error estándar. **Estabilidad:** correlación entre el perfil de cada torneo y el del resto de su carrera (deja-uno-fuera), comparada con lo que se parece al perfil de los demás DTs (referencia ≈ 0) y con la de los demás entrenadores (percentil). **Cambios claros:** prueba z entre torneos seguidos con control de falsos positivos de Benjamini–Hochberg al 10% dentro de cada DT; lo mismo entre clubes.

## 8. Uso de jugadores (5.3)

- Dibujos (Starting XI), cambios tácticos (*Tactical Shift*) y rotación (titulares distintos entre partidos consecutivos).
- Sustituciones: minuto mediano del 1º al 5º cambio frente a la liga, y tipo de cambio (más ofensivo / misma línea / más defensivo según la línea posicional) cruzado con el marcador.
- **Impacto de los cambios:** Δz entre el stint anterior y el posterior a cada sustitución, menos el Δz medio de la liga tras un cambio, con error estándar.
- **Roles:** NMF (k=10) sobre mapas de calor 12×8 de acciones (Decroos & Davis). **Huella del jugador:** sus β del modelo, es decir, qué indicador mueve cuando está en cancha, ya descontado el DT.

## 9. Balón parado (5.4)

Córners, tiros libres en campo rival y saques de banda en el último tercio, a favor y en contra. Se mide:
- zonas de destino (corto, primer palo, área chica, punto penal, segundo palo),
- técnica (cerrado/abierto),
- quién hace el primer contacto,
- % de remate y xG por jugada,
- atacantes y defensores en el área en el momento del envío (360),
- mapas de envíos y de remates.

**Saques de banda** (`pipeline/bp_extra.py`): los del último tercio (x ≥ 80), reflejados a una banda; % que cae en el área, % que se retiene, remate y xG en los 15 s siguientes de la misma jugada, primer contacto en el área, quién los lanza; a favor y en contra, con percentil entre DTs.

**Marcaje en córners en contra** (`pipeline/marking.py`): en la foto 360 del momento del saque se toman los defensores dentro del área (sin el portero) y se emparejan uno a uno con los atacantes (asignación húngara). Un defensor a ≤ 2 yd (1.8 m) de su atacante está «pegado». La proporción de pegados clasifica al DT en zonal / mixto / al hombre según los tercios de los DTs de la liga (mínimo 15 córners con 360). Se descargan eventos y 360 del API, se extrae el córner y se descarta el resto.

**Zonas de vulnerabilidad:** córners en contra por zona de envío: % del total, quién gana el primer contacto y xG concedido por córner, frente a la liga.

## 10. Simulación (sección 6)

Monte Carlo por **posesión**: p(gol) = 1 − Π(1 − xG_tiro), con como máximo un gol por posesión y los penales incluidos con su xG. Cada partido se rejuega 5,000 veces (10,000–50,000 en el simulador interactivo) para obtener la probabilidad de victoria, empate y derrota, los **xPts**, los marcadores más probables y el dominio (cuota de xG). Sirve para **explicar** si el resultado reflejó el juego, no para predecir.

## 11. Mapa de estilos (portada)

La portada ubica a cada DT en un plano: un **PCA de 2 componentes sobre su huella propia**, es decir, los 35 α del modelo estandarizados entre DTs. Por eso la cercanía significa ideas de juego parecidas ya descontada la plantilla. Los dos ejes explican el 55% de la variación entre DTs (48% con la huella del ridge):
- **X:** repliegue / defensa hundida ↔ dominio territorial / defensa adelantada.
- **Y:** ataques cortos / verticalidad ↔ elaboración / paciencia.

Las familias salen de k-means sobre ese mismo plano: K entre 4 y 6 por silueta, con al menos 5 DTs por grupo. El resultado es K=5 con la huella latente (K=4 con la del ridge; silueta ≈ 0.37; ver sección 13: no supera al azar, así que las familias son una guía de lectura). Cada familia se nombra por los indicadores que la distinguen del resto. **Vista 3D:** un PCA de 3 componentes; las dos primeras son las del mapa 2D y juntas las tres explican el 56% de la variación. La tercera va de «juego por bandas · contrapresión» a «volumen ofensivo · balón parado». **Ejes a elegir:** en lugar del PCA, cada eje (X, Y y Z en 3D) puede ser cualquiera de los indicadores de estilo propio del DT (α en σ). Las familias conservan su color en todas las vistas. Para la visualización, las coordenadas se comprimen con arcsinh, lo que evita que unos pocos DTs atípicos amontonen al resto sin cambiar el orden en cada eje.

## 12. Plan de partido: lo accionable (`pipeline/plan.py`)

- **Cómo jugarle:** 18 reglas escritas de antemano traducen un rasgo claro del sello (|α| ≥ 0.25 y |α|/EE ≥ 1.64) en una recomendación para el rival, con su evidencia (valor con jugadores promedio, liga, percentil). Se suman la reacción al marcador más grande (curvas de 7), la zona más vulnerable y el tipo de marcaje en córners, sus córners a favor, sus saques al área y el momento de sus cambios. Se eligen las 6 más fuertes, como máximo 2 por fase; los rasgos poco confiables (sección 13) pesan menos.
- **Jugadores a su medida:** para sus 3 rasgos más claros (de familias distintas), se suman los β estandarizados de cada jugador con ≥ 900 minutos, activo en la última temporada. Lista de la liga y, en su plantilla actual, quién suma y quién resta. Son efectos encogidos por el ridge: sirven para una lista corta.
- **Seguimiento:** sus 6 rasgos más marcados con confiabilidad ≥ 0.5; banda esperada para el promedio de 10 partidos = media de carrera ± 1.64·sd/√10; se compara con los últimos 10 partidos. Más puntos, xPts y diferencia de xG.

## 13. Pruebas de robustez sobre el diseño real (`pipeline/validation.py`)

Nada de esto cambia el modelo publicado (el ajuste se reproduce con |Δα| ≤ 5·10⁻⁵).
- **Recuperación sintética:** sobre el diseño real (mismos segmentos, DTs, clubes, rivales, jugadores y pesos) se plantan efectos con magnitudes como las estimadas y residuos reales permutados por decil de peso; 30 réplicas. Escenarios: realista, plantilla a su medida (jugadores alineados con su DT principal, corr ≈ 0.6) y sin DT. Resultado: correlación con la verdad 0.58 (promedio crudo 0.39; DT+club sin jugadores 0.55); con plantilla a su medida 0.78 (0.69); sin DT el modelo inventa una dispersión de 0.19σ frente a 0.95σ del promedio crudo. Pendiente 0.37 (el tamaño sale encogido), 81% de aciertos de signo en los rasgos marcados como claros, cobertura de los IC95 por bootstrap del 62% (miden ruido, no encogimiento).
- **Confiabilidad mitad/mitad:** partidos al azar en dos mitades, 4 repeticiones, Spearman–Brown; media 0.68. Bajo 0.5: OBV, xG tras balón parado, xG de transiciones, xG en contra.
- **Fuera de muestra:** validación cruzada por partido (5 pliegues), R² a nivel partido: 0.291 completo, 0.285 sin DT, 0.271 sin jugadores.
- **Mapa:** la silueta para K = 2..8 (≈ 0.36–0.40) no supera a la de una nube sin estructura con la misma covarianza (media 0.37, p95 0.42) y el ARI por bootstrap es moderado: los estilos son un continuo; el mapa vale por las cercanías, los colores son una guía.

- **Huella latente** (`pipeline/lowrank.py`, `lowrank.json`): encogimiento empírico-bayesiano multitarea. La huella de cada DT se modela como α_c ~ N(0, Σ) con Σ = ΛΛᵀ + Ψ (análisis factorial, EM) y la estimación del ridge como α̂_c = α_c + ruido, con ruido medido comparando dos submuestras disjuntas de partidos; la huella final es E[α_c | α̂_c] = Σ(Σ + S_c)⁻¹α̂_c. Un rasgo mal separado de la plantilla (mucho ruido) se reconstruye con los rasgos correlacionados en los que ese DT sí está claro. Prueba mitad/mitad (Σ aprendida solo con la mitad A, 4 particiones): correlación con la otra mitad 0.548 (ridge) → 0.552 (encogimiento por rasgo) → 0.564 (2 factores); en DTs con identificabilidad < 80, 0.518 → 0.534. Mejora en las 4 particiones; lo que más gana son los rasgos ruidosos (xG de balón parado, llegadas al área, tiros, contraataques). Los 2 factores (52% de Σ) son «dónde defiende» y «cómo ataca». **Desde la v63 la huella publicada es la latente** (`pipeline/apply_latent.py`, sobre el ajuste ridge en caché): α de los 34 indicadores base = media a posteriori; `alpha_ridge` queda guardado en cada perfil y el respaldo completo en `~/coach-dna-work/artifacts_ridge`. El EE mostrado sigue siendo el del bootstrap del ridge (conservador). Con la huella latente el DT explica en promedio el 13.7% de las diferencias entre equipos (antes 14.6%), y el mapa de estilos explica el 55% con 2 ejes y la silueta elige K = 5. Los tipos de posesión (arq_*) no entran en este paso.

## 14. Alcance y límites

- **Captura:** estilo colectivo observable con eventos y 360, su parte atribuible al DT y cómo cambia con el contexto.
- **No captura:** tracking continuo (distancias, velocidades, forma del bloque en todo momento), interacciones DT×jugador (el modelo es aditivo), cuerpo técnico, entrenamiento ni información de vestuario.
- **Cuándo desconfiar:** en DTs con índice de identificabilidad bajo (un solo club, plantilla que no jugó con otros DTs), donde el ridge encoge α hacia la media. El índice acompaña a cada DT en la interfaz.
- **Datos:** uso exclusivo para la competencia. Los datos crudos se quedan en `data/` (ignorado por git) y solo se publican resultados agregados en `artifacts/`.

## 15. Reproducir

```bash
python -m pipeline.sb_client      # descarga a caché (credenciales en .env)
python -m pipeline.process        # tablas procesadas
python -m pipeline.build          # modelos + artefactos por DT (≈ 1 h con bootstrap y transferencia)
python -m pipeline.marking        # marcaje 360 en córners (≈ 40 min, descarga y descarta)
python -m pipeline.validation     # pruebas de robustez → validacion.json
python -m pipeline.lowrank        # huella latente (multitarea) → lowrank.json
python -m pipeline.apply_latent   # aplica la huella latente a artifacts/ (luego: stylemap, dist, regen_narrative, plan)
python -m pipeline.tiempo && python -m pipeline.bp_extra && python -m pipeline.plan
pytest                            # pruebas del marco y validación sintética
uvicorn api.main:app --port 8765  # API
cd web && npm run dev             # frontend en http://localhost:5199
```
