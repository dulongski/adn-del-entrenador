"""Textos del plan de partido en tercera persona, sin «tú/él»: {N} = el técnico del que se habla
(la web lo cambia por su apellido); el rival es «el rival». Se aplica al final de pipeline/plan.py
y se puede correr sobre un plan.json ya hecho:  python -m pipeline.plan_textos plan.json"""
from __future__ import annotations

import json
import re
import sys

FIJOS = {
    "salida_corta_debil": ("Presionar la salida de {N} desde el portero", "{N} sale corto desde atrás, pero esas jugadas pocas veces llegan a campo rival: al rival le conviene presionar alto y emparejado sobre centrales y pivote.",
                           "Press {N}'s build-up from the keeper", "{N} builds short from the back, but few of those moves reach the opponent's half: pressing high and man-to-man on centre-backs and pivot pays off."),
    "salida_corta_buena": ("No regalarle a {N} la presión alta", "La salida corta de {N} funciona: una presión uno a uno la supera. Mejor un bloque medio que cierre los pases por dentro y saltar sólo con el pase atrás.",
                           "Don't gift {N} a high press", "{N}'s short build-up works: a man-to-man press gets beaten. Better a mid-block that shuts inside passes, jumping only on back passes."),
    "sale_largo": ("Ganar el primer balón y la segunda jugada", "El portero de {N} saca largo más que casi todos: el mejor cabeceador del rival en la zona de caída y la línea adelantada para quedarse el rebote.",
                   "Win the first and the second ball", "{N}'s keeper goes long more than almost anyone: the opponent's best header where it lands and the line pushed up to win the knock-down."),
    "bandas": ("Cerrarle las bandas a {N}", "{N} avanza por fuera más que la mayoría: doble marca en las bandas (lateral + extremo) para obligar a que el balón vuelva por dentro.",
               "Close the flanks on {N}", "{N} progresses down the wings more than most: double up out wide (full-back + winger) to force the ball back inside."),
    "centros": ("Defender el área por arriba", "{N} centra más que la mayoría: centrales fuertes en el juego aéreo, presión al que centra y alguien siempre en el segundo palo.",
                "Defend the box in the air", "{N} crosses more than most: strong aerial centre-backs, pressure on the crosser and someone always on the far post."),
    "conduce": ("Cortar a los conductores de {N}", "El equipo de {N} avanza conduciendo más que la mayoría: no dar metros al que lleva el balón, temporizar y cubrir la espalda del que sale.",
                "Stop {N}'s ball-carriers", "{N}'s team carries the ball forward more than most: give the carrier no space, delay him and cover behind whoever steps out."),
    "cambios_frente": ("Bascular rápido al lado débil", "{N} cambia de frente más que la mayoría para atacar el lado débil: el extremo del lado contrario tiene que cerrar y el bloque moverse junto.",
                       "Shift quickly to the weak side", "{N} switches play more than most to hit the weak side: the far-side winger must tuck in and the block move as one."),
    "posesion": ("Dejarle el balón a {N} y esperar el error", "{N} quiere tener la pelota: un bloque medio compacto y salidas rápidas tras robar rinden más que discutirle la posesión.",
                 "Let {N} have the ball and wait", "{N} wants the ball: a compact mid-block and fast breaks after winning it pay more than fighting for possession."),
    "tiro_lejano": ("Conceder tiros lejanos y proteger el área", "El equipo de {N} remata mucho pero desde lejos (poco xG por tiro): no conviene romper el bloque para salir a cada tiro; lo peligroso es lo que entra al área.",
                    "Concede long shots, protect the box", "{N}'s team shoots a lot but from distance (low xG per shot): do not break the block to close every shot; the danger is what gets into the box."),
    "presiona_alto": ("Superar la presión de {N} con juego directo", "{N} presiona y roba arriba: salir en largo o con un pivote extra, evitar pases horizontales en el propio tercio y buscar la espalda de su presión.",
                      "Beat {N}'s press with direct play", "{N} presses and wins it high: play long or add an extra pivot, avoid square passes in your own third and target the space behind the press."),
    "linea_alta": ("Atacar la espalda de la defensa de {N}", "{N} defiende con la línea adelantada: balones a la espalda de sus centrales y carreras en diagonal de los delanteros.",
                   "Attack the space behind {N}'s line", "{N} defends with a high line: balls in behind his centre-backs and diagonal runs from the forwards."),
    "linea_baja": ("Paciencia frente al bloque bajo de {N}", "{N} se repliega cerca de su área: el rival tendrá el balón; conviene moverlo rápido de lado a lado, centrar al segundo palo y probar de media distancia.",
                   "Patience against {N}'s low block", "{N} sits deep near his box: the opponent will have the ball; move it side to side quickly, cross to the far post and shoot from mid-range."),
    "bloque_largo": ("Jugar entre las líneas de {N}", "El bloque de {N} es largo (mucha distancia entre la primera y la última línea): el mediapunta rival tiene espacio para recibir de espaldas y girar.",
                     "Play between {N}'s lines", "{N}'s block is stretched (big gap between first and last line): the opposing number 10 has room to receive and turn."),
    "bloque_corto": ("Jugar por fuera del bloque de {N}", "El bloque de {N} es muy compacto: por dentro no hay sitio; conviene atacar con amplitud y cambios de orientación.",
                     "Go around {N}'s block", "{N}'s block is very compact: there's no room inside; attack with width and switches of play."),
    "contrapresion": ("Salir rápido tras robarle a {N}", "{N} contrapresiona en cuanto pierde: el primer pase tras recuperar tiene que ser vertical o largo, no al lado.",
                      "Get out fast after winning it from {N}", "{N} counter-presses as soon as he loses it: the first pass after a win-back must go forward or long, not sideways."),
    "concede_contras": ("Contragolpear a {N}", "A {N} le llegan rápido tras perder el balón: conviene tener dos atacantes listos para correr en cuanto se recupere.",
                        "Hit {N} on the counter", "Teams get at {N} quickly after he loses the ball: keep two attackers ready to run as soon as the ball is won."),
    "contragolpea": ("Cuidar la pérdida contra {N}", "{N} es peligroso al contragolpe: no perder el balón en salida y dejar siempre 2+1 atrás al atacar.",
                     "Protect against {N}'s counters", "{N} is dangerous on the break: don't lose it playing out and always keep 2+1 back when attacking."),
    "recupera_rapido": ("Mover el balón rápido", "{N} recupera el balón rápido: menos toques, apoyos cerca y no conducir en zonas con mucha gente.",
                        "Move the ball quickly", "{N} wins the ball back fast: fewer touches, close support and no dribbling in crowded areas."),
}
MARCA = {
    "hombre": ("Liberar al cabeceador con bloqueos", "{N} defiende los córners al hombre: cortinas y bloqueos legales para soltar al mejor rematador de su marcador.",
               "Free the header with screens", "{N} man-marks on corners: legal screens and blocks to free the best header from his marker."),
    "zonal": ("Atacar los huecos de la marca zonal de {N}", "{N} defiende los córners en zona: carreras desde atrás hacia los espacios entre sus defensores y bloqueos sobre el portero.",
              "Attack the gaps in {N}'s zonal marking", "{N} defends corners zonally: late runs into the gaps between his defenders and screens on the keeper."),
}


def fix(a: dict) -> dict:
    i = a["id"]
    if i in FIJOS:
        a["titulo"], a["texto"], a["titulo_en"], a["texto_en"] = FIJOS[i]
    elif i == "bp_marcaje":
        k = "hombre" if "cabeceador" in a["titulo"] or "header" in a["titulo_en"] else "zonal"
        a["titulo"], a["texto"], a["titulo_en"], a["texto_en"] = MARCA[k]
    elif i == "bp_vulnerable":
        a["titulo"] = re.sub(r"^Cárgale los córners al ", "Cargarle los córners a {N} al ", a["titulo"])
        a["texto"] = a["texto"].replace("Es donde más sufre:", "Es donde más sufre {N}:")
        a["titulo_en"] = re.sub(r"^Aim your corners at the (.+)$", r"Aim corners at the \1 against {N}", a["titulo_en"])
        a["texto_en"] = a["texto_en"].replace("It's where he suffers most:", "It's where {N} suffers most:")
    elif i == "contexto":
        t = a["titulo"]
        for pre in ("Cuando va ", "Con el empate, ", "En el tramo "):
            if t.startswith(pre):
                t = "Cuando {N} va " + t[len("Cuando va "):] if pre == "Cuando va " else (t.replace(", ", ", {N} ", 1))
        a["titulo"] = t
        a["titulo"] = a["titulo"].replace("en tu campo", "en campo rival")
        a["texto"] = a["texto"].replace("misma situación, ", "misma situación, {N} ").replace("Prepara ese escenario", "Conviene preparar ese escenario").replace("en tu campo", "en campo rival")
        a["titulo_en"] = a["titulo_en"].replace("your half", "the opponent's half")
        a["texto_en"] = a["texto_en"].replace("your half", "the opponent's half")
        w, _, v = a["titulo_en"].partition(", ")
        w = w.replace("When he is", "When {N} is")
        a["titulo_en"] = f"{w}, {'he ' if '{N}' in w else '{N} '}{v}"
        a["texto_en"] = a["texto_en"].replace("same situation, he ", "same situation, {N} ")
    elif i == "banca":
        a["titulo"] = a["titulo"].replace("Mueve el banco", "{N} mueve el banco").replace("Si va perdiendo", "Si {N} va perdiendo")
        a["texto"] = (a["texto"].replace("Su primer cambio llega", "El primer cambio de {N} llega").replace("ten tu respuesta lista", "conviene tener la respuesta lista")
                      .replace("tu banco puede adelantarse", "el banco rival puede adelantarse").replace("Cuando pierde,", "Cuando {N} pierde,")
                      .replace("espera más gente arriba y deja espacio a la espalda para contragolpear", "hay que esperar más gente arriba y aprovechar el espacio a la espalda para contragolpear"))
        a["titulo_en"] = a["titulo_en"].replace("He goes to the bench", "{N} goes to the bench").replace("When losing, he adds", "When losing, {N} adds")
        a["texto_en"] = (a["texto_en"].replace("His first sub comes", "{N}'s first sub comes").replace("have your answer ready", "have the answer ready")
                         .replace("your bench can get ahead", "the opposing bench can get ahead").replace("expect more bodies", "expect more bodies").replace("When behind, ", "When {N} is behind, "))
    elif i == "bp_sus_corners":
        a["titulo"] = re.sub(r"^En sus córners, vigila el ", "En los córners de {N}, vigilar el ", a["titulo"])
        a["texto"] = re.sub(r"^Manda el ", "{N} manda el ", a["texto"]).replace("tu mejor defensor aéreo", "el mejor defensor aéreo del rival")
        a["titulo_en"] = a["titulo_en"].replace("On his corners,", "On {N}'s corners,")
        a["texto_en"] = a["texto_en"].replace("He sends", "{N} sends").replace("your best aerial defender", "the best aerial defender")
    elif i == "bp_banda":
        a["titulo"] = "Ojo con los saques de banda de {N} al área"
        a["texto"] = a["texto"].replace("de sus saques de banda", "de los saques de banda de {N}").replace("trátalos como un córner", "hay que defenderlos como un córner")
        a["titulo_en"] = "Watch {N}'s long throws into the box"
        a["texto_en"] = a["texto_en"].replace("of his final-third", "of {N}'s final-third")
    return a


def apply(plan: dict) -> dict:
    for d in plan["dts"].values():
        d["acciones"] = [fix(a) for a in d["acciones"]]
    plan["fases"] = {"con": {"es": "Cuando {N} tiene el balón", "en": "When {N} has the ball"}, "sin": {"es": "Cuando su rival tiene el balón", "en": "When his opponent has the ball"},
                     "trans": {"es": "En las transiciones", "en": "In transitions"}, "bp": {"es": "A balón parado", "en": "At set pieces"}, "partido": {"es": "Durante el partido", "en": "During the match"}}
    plan["textos"] = "tercera_persona"
    return plan


if __name__ == "__main__":
    p = sys.argv[1]
    P = json.load(open(p))
    if P.get("textos") != "tercera_persona":
        json.dump(apply(P), open(p, "w"), ensure_ascii=False, separators=(",", ":"))
    import collections
    bad = collections.Counter(w for d in P["dts"].values() for a in d["acciones"] for w in re.findall(r"\b(tu|tú|te|ti|tus|él)\b", a["titulo"] + " " + a["texto"]))
    print("listo · restos de tú/él:", dict(bad))
