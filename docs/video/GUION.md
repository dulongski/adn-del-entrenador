# Coach DNA · guion del video (≈ 4 min 40 s)

Léelo con tu voz y tu ritmo; no hace falta que sea palabra por palabra. Lo importante es **decir las frases que abren cada escena** (las de **negritas**): con ellas sincronizo la app con tu voz.

Cómo grabar: una sola toma o varias, en `.m4a` o `.wav`, en un cuarto sin eco. Deja un segundo de silencio entre escenas. Si quieres salir en cámara, graba también el video de tu cara (lo pongo en una esquina en la intro y el cierre).

---

### 1 · Intro (0:00, 25 s) · En pantalla: logo de Coach DNA y la portada

**Hola, soy Sebastian Dulong y voy a presentar Coach DNA, mi solución para el Hackathon del Club América.**
Quería construir una herramienta que respondiera cómo juega un entrenador, cuáles son sus ideas, qué tan consistente es según el rival, cómo ajusta de acuerdo con el marcador y el minuto, cómo usa a sus jugadores, qué hace a balón parado. Todo con métricas propias, un marco claro y simulación. Para esto, es importante entender ¿qué parte de ese estilo es del entrenador y qué parte es de sus jugadores?

### 2 · Método (0:25, 45 s) · En pantalla: Método, el diagrama del flujo y la gráfica de cuánto pesa cada pieza

**Para separarlo me basé en un método de economía laboral.**
Abowd, Kramarz y Margolis lo publicaron en Econometrica en 1999 para separar lo que gana un trabajador por mérito propio de lo que gana por la empresa en la que está, siguiendo a la gente que cambia de trabajo. En 2018, Muehlheusser y sus coautores lo usaron para medir a los entrenadores de la Bundesliga por sus resultados. Yo lo apliqué al estilo de juego: los DTs que cambian de club y los jugadores que pasan por varios DTs permiten separar a uno del otro. A eso le sumé a los jugadores que están en la cancha en cada momento, como se hace en el básquetbol para medir a cada jugador. Y lo estimé con estadística bayesiana: si los datos no alcanzan, al DT no se le inventa un estilo.
También, en esta gráfica podemos ver el resultado para toda la liga: el DT explica cerca del 14% de las diferencias de estilo. Decide cómo se juega; cuánto peligro sale de ahí depende más de los jugadores.

### 3 · Mapa de estilos (1:10, 15 s) · En pantalla: la portada, zoom suave

**Esta es la portada: la liga según el estilo propio de cada DT, ya sin su plantilla.**
En este mapa, cada punto es un entrenador y los que están cerca tienen ideas parecidas. Desde aquí se abre cualquier DT.

### 4 · Resumen de Almada (1:25, 20 s) · En pantalla: buscar «Almada», abrir su resumen

**Abro a Guillermo Almada.**
En esta sección está su resumen: las ideas que más lo distinguen, cada una con su número contra la liga y su lugar entre todos los DTs. En el caso de Almada son tres: presión intensa, roba en campo rival y su portero juega largo.

### 5 · ¿DT o plantilla? (1:45, 25 s) · En pantalla: «DT vs plantilla» y su nota «¿Este estilo viaja de club en club?»

**Aquí respondemos si el estilo es suyo o de sus jugadores.**
En esta sección cada rasgo se reparte entre el DT, la plantilla, el club, el rival y el contexto. Por ejemplo, de su salida larga el 37% es de Almada; el resto lo explican el club, sus porteros y los partidos que le tocaron. También podemos ver si su estilo viaja con él: escondimos sus partidos en América y el modelo lo reconoce primero entre 70 entrenadores.

### 6 · Cómo juega (2:10, 30 s) · En pantalla: «Estilo y zonas», «Según el partido», «A lo largo del tiempo»

**Esta sección explica cómo juega, con y sin balón.**
Primero están sus zonas: dónde progresa, dónde presiona y dónde recupera, siempre comparado con la liga. Luego, según el partido, vemos cómo cambia con el marcador, el minuto, la localía y el rival: cuando va ganando, Almada sigue presionando mucho más que la liga, y del minuto 60 al 75 contragolpea más. Y a lo largo del tiempo podemos ver que es de los DTs más consistentes: cada torneo se parece al resto de su carrera.

### 7 · Jugadores (2:40, 20 s) · En pantalla: «Jugadores» y «Jugadores a su medida»

**En esta sección vemos cómo usa a sus jugadores.**
Está su dibujo base, el 4-2-3-1, quiénes juegan en cada línea, cuánto rota, cuándo hace sus cambios y qué cambia cuando entran. También, como el modelo mide a cada jugador sin su entrenador, la app sugiere a quién fichar: los que más empujan su estilo.

### 8 · Balón parado (3:00, 20 s) · En pantalla: córners en 2D y 3D, saques de banda, «Cómo defiende»

**Aquí está todo el balón parado, a favor y en contra.**
En esta sección hay córners en 2D y en 3D, tiros libres y saques de banda: a dónde los manda, cuánto peligro generan y quién los cobra. Y en defensa, con las fotos 360 medimos si marca al hombre o en zona: Almada es de los que más marcan al hombre en toda la liga.

### 9 · Laboratorio (3:20, 25 s) · En pantalla: «Rejugar partidos» y «Simulador de liga»

**En el laboratorio usamos la simulación para explicar resultados.**
En esta sección rejugamos cada partido 5,000 veces con el xG de cada jugada, para separar mérito de suerte: sus equipos sumaron 284 puntos y su juego merecía 270. También podemos llevarlo a otro club, o jugar lo que falta del Apertura y ver en qué posición media terminaría su equipo.

### 10 · Cara a cara (3:45, 30 s) · En pantalla: «1 vs 1», «Cómo jugarle», «Plan contra un rival»

**Y lo más útil para un cuerpo técnico: el cara a cara.**
En esta sección lo comparo con cualquier entrenador, veo cómo jugarle según la situación del partido y armo el plan contra su próximo rival. Para cada partido dice dónde puede ganar, qué tiene que cubrir, qué hacer en la cancha y qué mirar durante el juego, con los números que lo respaldan.

### 11 · Golito e informe (4:15, 10 s) · En pantalla: abrir Golito con una pregunta; menú «Informe»

**Golito responde preguntas con los datos de la app.**
Y cualquier sección sale como informe en PDF.

### 12 · Cierre (4:25, 15 s) · En pantalla: Método (pruebas) y la portada

**Todo está probado.**
Con datos simulados, escondiendo clubes enteros y siguiendo los cambios de club. Coach DNA te dice qué parte del estilo es del entrenador y qué hacer con eso. Gracias.
