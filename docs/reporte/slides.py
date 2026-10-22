"""Reporte de entrega en láminas horizontales (16:9, 1600×900): qué hace Coach DNA y Guillermo Almada como ejemplo.

Lee sólo resultados agregados (web/public/data, web/src/boot.json), nunca datos crudos. Cada gráfica se dibuja en SVG al
tamaño real de su caja (1 unidad = 1 px de la lámina), así el texto conserva su tamaño; todo lo que tiene `data-tip`
muestra su dato al pasar el cursor.

  python docs/reporte/slides.py   ->  docs/reporte/coach-dna-reporte.html  (+ publicar.html sin <head>)
"""
from __future__ import annotations

import base64
import html
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "web/public/data"
OUT = Path(__file__).resolve().parent
DT_ID = "2947"
N = "Almada"
APP_URL = "https://claude.ai/artifact/CrS1hEPKJXf3m21vWvRZzC"

boot = json.loads((ROOT / "web/src/boot.json").read_text())
G = boot["global"]
D = json.loads((DATA / f"dt_{DT_ID}.json").read_text())
JX = json.loads((DATA / f"jugadores_{DT_ID}.json").read_text())
PLANF = json.loads((DATA / "plan.json").read_text())
PLAN = PLANF["dts"][DT_ID]
TIEMPO = json.loads((DATA / "tiempo.json").read_text())
VALID = json.loads((DATA / "validacion.json").read_text())
H = {h["kpi"]: h for h in D["huella"]}
ALL_H = {}
for _f in sorted(DATA.glob("dt_*.json")):
    _d = json.loads(_f.read_text())
    ALL_H[str(_d["id"])] = {h["kpi"]: h["alpha"] for h in _d["huella"]}
GRP_CLS = {0: "g0", 1: "g1", 2: "g2", 3: "g3", 4: "g4"}
KPI_TXT = {"altura_presion": "Presiona arriba", "altura_defensiva": "Defiende adelantado", "recuperaciones_altas_90": "Roba en campo rival",
           "posesion_rival_dur": "Recupera rápido", "linea_360": "Línea defensiva alta", "salida_corta": "Salida corta", "verticalidad": "Verticalidad",
           "pases_por_posesion": "Pases por posesión", "transicion_def": "Contragolpes concedidos", "posesion": "Posesión", "contrapresion": "Contrapresión",
           "intensidad_presion": "Intensidad de presión", "pase_largo": "Pase largo", "progresivos": "Acciones progresivas", "contraataque": "Contragolpes"}
A = {a["kpi"]: a for a in D["atribucion"]}
NAMES = boot["nombres"]
MEDIA = boot["media"]["clubes"]
esc = lambda s: html.escape(str(s), quote=True)
POS = {"EXT": "Extremo", "DC": "Delantero", "DFC": "Central", "MC": "Mediocampista", "LAT": "Lateral", "POR": "Portero", "MCO": "Mediapunta"}
COMP = [("coach", "DT", "dt"), ("player", "Plantilla", "pl"), ("club", "Club", "cl"), ("opp", "Rival", "op"), ("ctx", "Contexto", "cx"), ("residual", "Sin explicar", "rs")]
LBL = {"posesion_rival_dur": "Recupera rápido", "recuperaciones_altas_90": "Roba en campo rival", "conduccion_prog": "Avanza conduciendo",
       "progresivos": "Acciones progresivas", "cambios_orientacion": "Cambios de orientación", "intensidad_presion": "Intensidad de presión"}


def corto(pid, full):
    return NAMES.get(str(pid), {}).get("corto", full)


def short_player(full):
    p = full.split()
    return f"{p[0]} {p[-2] if len(p) >= 3 else p[-1]}" if len(p) >= 2 else full


_LOGO: dict[str, str] = {}


def logo(club, size=28):
    """Escudo del club incrustado (data URI), sólo de los clubes que aparecen."""
    m = MEDIA.get(club)
    if not m:
        return ""
    if club not in _LOGO:
        f = ROOT / "web/public" / m["logo"].lstrip("/")
        mime = "image/png" if f.suffix == ".png" else "image/jpeg"
        _LOGO[club] = f"data:{mime};base64,{base64.b64encode(f.read_bytes()).decode()}"
    return f'<img class="clogo" src="{_LOGO[club]}" alt="{esc(club)}" width="{size}" height="{size}">'


# ------------------------------------------------------------------ SVG
def svg(w, h, body, label):
    return f'<svg class="ch" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{esc(label)}">{body}</svg>'


def T(x, y, s, cls="t", anchor="start"):
    return f'<text x="{x:.1f}" y="{y:.1f}" class="{cls}" text-anchor="{anchor}">{esc(s)}</text>'


def R(x, y, w, h, cls, tip=None, rx=3, style=""):
    tp = f' data-tip="{esc(tip)}"' if tip else ""
    st = f' style="{style}"' if style else ""
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{max(w, 0):.1f}" height="{h:.1f}" rx="{rx}" class="{cls}"{tp}{st}/>'


def C(x, y, r, cls, tip=None, style=""):
    tp = f' data-tip="{esc(tip)}"' if tip else ""
    st = f' style="{style}"' if style else ""
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" class="{cls}"{tp}{st}/>'


def Ln(x1, y1, x2, y2, cls, tip=None):
    tp = f' data-tip="{esc(tip)}"' if tip else ""
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" class="{cls}"{tp}/>'


def mix(var, k, base="transparent"):
    return f"fill:color-mix(in oklab, var({var}) {k:.0f}%, {base})"


def pitch_h(w, h):
    """Cancha completa horizontal (120×80), ataca a la derecha."""
    sx, sy = w / 120, h / 80
    p = [f'<rect x="0" y="0" width="{w:.1f}" height="{h:.1f}" class="pitch"/>', Ln(60 * sx, 0, 60 * sx, h, "pl"),
         f'<circle cx="{60 * sx:.1f}" cy="{40 * sy:.1f}" r="{10 * sx:.1f}" class="pl" fill="none"/>']
    for x0 in (0, 102):
        p.append(f'<rect x="{x0 * sx:.1f}" y="{18 * sy:.1f}" width="{18 * sx:.1f}" height="{44 * sy:.1f}" class="pl" fill="none"/>')
    for x0 in (0, 114):
        p.append(f'<rect x="{x0 * sx:.1f}" y="{30 * sy:.1f}" width="{6 * sx:.1f}" height="{20 * sy:.1f}" class="pl" fill="none"/>')
    return "".join(p)


# ------------------------------------------------------------------ gráficas
def ch_problema():
    h, a = H["salida_corta"], A["salida_corta"]
    W, Hh = 740, 440
    b = [T(0, 22, "Salida corta del portero", "t b22")]
    sc = (W - 200) / 60
    for i, (nm, v, cl) in enumerate([(N, h["crudo"], "f-dt"), ("Liga", h["liga"], "f-rs")]):
        y = 40 + i * 54
        b.append(T(0, y + 30, nm, "t"))
        b.append(R(110, y + 8, v * sc, 32, cl, f"{nm}: {v:.1f}% de sus saques de portero son cortos", 4))
        b.append(T(110 + v * sc + 12, y + 32, f"{v:.0f}%", "t b22"))
    y0 = 196
    b.append(T(0, y0, f"¿De quién es la diferencia? ({h['liga'] - h['crudo']:.0f} puntos menos de salida corta)", "t b22"))
    parts = [(nm, -a[k], c) for k, nm, c in COMP if -a[k] > 0.004]
    tot = sum(v for _, v, _ in parts)
    x = 0
    for nm, v, c in parts:
        w = v / tot * W
        b.append(R(x + 1, y0 + 18, w - 2, 56, f"f-{c}", f"{nm}: {v:.2f} σ de {-a['observado']:.2f} σ, el {v / tot * 100:.0f}% de la diferencia", 4))
        if w > 56:
            b.append(T(x + 10, y0 + 54, f"{v / tot * 100:.0f}%", "t b22" + ("" if c == "rs" else " inv")))
        if w > 80:
            b.append(T(x + 4, y0 + 100, nm, "t s17"))
        x += w
    b.append(T(0, y0 + 156, f"Almada pone el {-a['coach'] / tot * 100:.0f}% de su salida larga.", "t b24"))
    b.append(T(0, y0 + 190, "El resto lo explican el club, sus porteros y los partidos que le tocaron.", "t m"))
    return svg(W, Hh, "".join(b), "Ejemplo: de quién es la salida larga de Almada")


def ch_reparto(W=1472):
    v = G["varianza_media"]
    parts = [("Plantilla", v["player"], "pl"), ("DT", v["coach"], "dt"), ("Club", v["club"], "cl"), ("Rival", v["opp"], "op"),
             ("Sin explicar (incluye contexto)", v["residual"] + v["ctx"], "rs")]
    x, b = 0, []
    for nm, s, c in parts:
        w = s * W
        b.append(R(x + 1, 0, w - 2, 56, f"f-{c}", f"{nm}: {s * 100:.1f}% de las diferencias de estilo entre equipos", 5))
        b.append(T(x + 14, 37, f"{s * 100:.0f}%", "t b24" + ("" if c == "rs" else " inv")))
        b.append(T(x + 4, 88, nm, "t b20" if c == "dt" else "t"))
        x += w
    return svg(W, 98, "".join(b), "Qué explica las diferencias de estilo en la liga")


def ch_transfer():
    tr = G["transferencia"]
    W, Hh, L, Rr = 1472, 250, 30, 30
    X = lambda r: L + (r - 1) / 69 * (W - L - Rr)
    base = 204
    b = [R(X(1) - 12, 8, X(10) - X(1) + 24, base - 8, "band-y", "Los 10 primeros lugares", 6), T(X(1), 34, "Top 10", "t b20"),
         Ln(X(35.5), 8, X(35.5), base, "azar"), T(X(35.5) + 10, 34, "Lugar esperado al azar: 36º", "t m"), Ln(L, base, W - Rr, base, "ax")]
    for r in (1, 10, 20, 30, 40, 50, 60, 70):
        b.append(Ln(X(r), base, X(r), base + 8, "ax"))
        b.append(T(X(r), base + 32, f"{r}º", "t s17 m", "middle"))
    stack: dict[int, int] = {}
    me_y = None
    for e in sorted(tr, key=lambda e: (e["rank_ajustado"], -e["partidos"])):
        r = e["rank_ajustado"]
        k = stack.get(r, 0)
        stack[r] = k + 1
        me = str(e["coach_id"]) == DT_ID and e["club"] == "América"
        y = base - 16 - k * 24
        if me:
            me_y = y
        b.append(C(X(r), y, 10.5 if me else 9, "d-me" if me else "d-tr",
                   f"{corto(e['coach_id'], e['dt'])} en {e['club']} ({e['partidos']} partidos): el modelo lo pone {r}º de {e['n_clases']} (con su estilo crudo, {e['rank_crudo']}º)"))
    if me_y is not None:
        b.append(T(X(1) + 22, me_y + 7, "← Almada en América: 1º", "t b20"))
    return svg(W, Hh, "".join(b), "Dónde pone el modelo al DT real en cada cambio de club")


def ch_mapa(W=880, Hh=420):
    pts = boot["mapa"]["puntos"]
    xs, ys = [p["x"] for p in pts], [p["y"] for p in pts]
    P = 26
    X = lambda v: P + (v - min(xs)) / (max(xs) - min(xs)) * (W - 2 * P)
    Y = lambda v: P + (max(ys) - v) / (max(ys) - min(ys)) * (Hh - 2 * P - 30)
    ej = boot["mapa"]["ejes"]
    b = [Ln(X(0), P, X(0), Hh - P - 30, "gr"), Ln(P, Y(0), W - P, Y(0), "gr"),
         T(W - P, Hh - 6, ej["x"]["positivo"] + " →", "t s16 m", "end"), T(P, Hh - 6, "← " + ej["x"]["negativo"], "t s16 m"),
         T(X(0) + 8, P - 8, "↑ " + ej["y"]["positivo"], "t s16 m")]
    grp = {g["id"]: g["nombre"] for g in boot["mapa"]["grupos"]}
    a = [p for p in pts if str(p["id"]) == DT_ID][0]
    for p in pts:
        if p is a:
            continue
        b.append(C(X(p["x"]), Y(p["y"]), 8, GRP_CLS[p["grupo"]] + (" fam" if p["grupo"] == a["grupo"] else " oth"),
                   f"{corto(p['id'], p['nombre'])} · familia «{grp[p['grupo']]}» · {p['partidos']} partidos"))
    for q in sorted(pts, key=lambda q: (q["x"] - a["x"]) ** 2 + (q["y"] - a["y"]) ** 2)[1:4]:
        right = X(q["x"]) > X(a["x"])
        b.append(T(X(q["x"]) + (12 if right else -12), Y(q["y"]) - 10, corto(q["id"], q["nombre"]), "t s16", "start" if right else "end"))
    b.append(C(X(a["x"]), Y(a["y"]), 14, "d-almada", f"Guillermo Almada · familia «{grp[a['grupo']]}»"))
    b.append(T(X(a["x"]), Y(a["y"]) + 38, "Almada", "t b22", "middle"))
    return svg(W, Hh, "".join(b), "Mapa de estilos propios de los DTs")



def fam_card():
    """La familia de estilo de Almada: qué la define y quiénes la forman."""
    pts = boot["mapa"]["puntos"]
    a = [p for p in pts if str(p["id"]) == DT_ID][0]
    g = [x for x in boot["mapa"]["grupos"] if x["id"] == a["grupo"]][0]
    miembros = sorted((p for p in pts if p["grupo"] == a["grupo"] and p is not a), key=lambda p: (p["x"] - a["x"]) ** 2 + (p["y"] - a["y"]) ** 2)
    W, rh = 520, 40
    b = []
    mx = max(abs(r["efecto"]) for r in g["rasgos"][:4]) or 1
    for i, r in enumerate(g["rasgos"][:4]):
        y = i * rh
        v = -r["efecto"] if r["kpi"] in ("posesion_rival_dur", "ppda", "transicion_def") else r["efecto"]
        b.append(T(0, y + 25, KPI_TXT.get(r["kpi"], r["kpi"]), "t"))
        w = abs(v) / mx * 190
        b.append(R(250, y + 9, w, 22, "f-dt" if v > 0 else "f-neg", f"La familia, en promedio: {v:+.2f} σ en {KPI_TXT.get(r['kpi'], r['kpi']).lower()} frente al DT típico", 3))
        b.append(T(250 + w + 10, y + 26, f"{v:+.2f} σ", "t s16"))
    chart = svg(W, 4 * rh, "".join(b), "Rasgos que definen la familia")
    nombres = ", ".join(corto(p["id"], p["nombre"]) for p in miembros[:8])
    return (f'<div class="card fam"><p class="ey">Su familia de estilo · {g["n"]} DTs</p><h4>{esc(g["nombre"])}</h4>{chart}'
            f'<p class="fam-m"><b>Los más cercanos:</b> {esc(nombres)}{" y otros " + str(len(miembros) - 8) if len(miembros) > 8 else ""}.</p></div>')

def rank_of(k, sign):
    """Lugar entre los DTs con perfil (1º = el que más lo empuja en esa dirección), del mismo percentil que usa la app."""
    n = len(boot["mapa"]["puntos"])
    p = H[k]["pct"] / 100
    return int(round((1 - p if sign > 0 else p) * (n - 1))) + 1, n


def ch_adn():
    spec = [("ppda", -1, "Presión intensa", "PPDA: pases rivales por cada robo", lambda v: f"{v:.1f}", "pases por robo", "menos pases = más presión"),
            ("recuperaciones_altas_90", 1, "Roba en campo rival", "Recuperaciones en campo rival por 90", lambda v: f"{v:.1f}", "robos por 90", ""),
            ("salida_corta", -1, "Saque largo del portero", "% de saques de portero en corto", lambda v: f"{v:.0f}%", "salida corta", "menos = juega más largo"),
            ("conduccion_prog", 1, "Avanza conduciendo", "% de su progresión que es conduciendo", lambda v: f"{v:.0f}%", "en conducción", ""),
            ("altura_defensiva", 1, "Defensa adelantada", "Altura media de sus acciones defensivas", lambda v: f"{v:.1f} yd", "altura", ""),
            ("field_tilt", 1, "Dominio territorial", "Field tilt: su % de pases en el último tercio", lambda v: f"{v:.0f}%", "field tilt", "")]
    W, rh, top = 1472, 82, 36
    c2, c3, cw = 470, 760, 600
    b = [T(16, 20, "RASGO Y MÉTRICA", "t s15 m caps"), T(c2, 20, "SU EQUIPO · LIGA", "t s15 m caps"),
         T(c3, 20, "EFECTO PROPIO DE CADA UNO DE LOS 76 DTS (SIN SU PLANTILLA) · ALMADA RESALTADO", "t s15 m caps")]
    for i, (k, s_, nm, metr, fm, unit, nota) in enumerate(spec):
        y = top + i * rh
        h = H[k]
        r, n = rank_of(k, s_)
        vals = [(dt, al[k] * s_) for dt, al in ALL_H.items() if k in al]
        lo, hi = min(v for _, v in vals), max(v for _, v in vals)
        X = lambda v: c3 + (v - lo) / (hi - lo) * cw
        b.append(R(0, y, W, rh - 8, "rowbg", None, 10))
        b.append(T(16, y + 32, nm, "t b24"))
        b.append(T(16, y + 58, metr, "t s16 m"))
        b.append(T(c2, y + 40, fm(h["crudo"]), "t big"))
        b.append(T(c2 + 130, y + 40, f"liga {fm(h['liga'])}", "t m"))
        b.append(T(c2, y + 62, nota or unit, "t s15 m"))
        mid = y + 36
        b.append(Ln(X(0), y + 12, X(0), y + rh - 20, "ax"))
        seen: dict[int, int] = {}
        for dt, v in sorted(vals, key=lambda t: t[1]):
            if dt == DT_ID:
                continue
            col = int((X(v) - c3) / 9)
            k_ = seen.get(col, 0)
            seen[col] = k_ + 1
            off = ((k_ + 1) // 2) * 9 * (1 if k_ % 2 else -1)
            b.append(C(X(v), mid + off, 4.6, "d-dist", f"{corto(dt, dt)}: {v:+.2f} σ"))
        a_ = h["alpha"] * s_
        b.append(C(X(a_), mid, 11, "d-almada", f"{N}: {h['alpha']:+.2f} σ (±{1.96 * h['se']:.2f}); {r}º de {n} DTs en esa dirección"))
        b.append(T(c3 + cw + 24, y + 34, f"{r}º", "t big"))
        b.append(T(c3 + cw + 24, y + 58, f"de {n}", "t s15 m"))
    b.append(T(c3, top + len(spec) * rh + 14, "← menos que el DT típico", "t s15 m"))
    b.append(T(c3 + cw, top + len(spec) * rh + 14, "más que el DT típico →", "t s15 m", "end"))
    return svg(W, top + len(spec) * rh + 20, "".join(b), "Los seis rasgos de Almada frente a la distribución de los 76 DTs")


def ch_suyo():
    spec = [("salida_corta", -1, "Saca largo desde el portero"), ("ppda", -1, "Presiona (PPDA bajo)"), ("recuperaciones_altas_90", 1, "Roba en campo rival"),
            ("conduccion_prog", 1, "Avanza conduciendo"), ("altura_presion", 1, "Presiona muy arriba"), ("tiros_90", 1, "Tira mucho"),
            ("xg_balon_parado_90", 1, "xG a balón parado")]
    W, rh, L = 1472, 62, 330
    lo, hi = -0.6, 1.8
    sc = (W - L - 90) / (hi - lo)
    X = lambda v: L + (v - lo) * sc
    n = len(spec)
    b = []
    for g in (-0.5, 0, 0.5, 1, 1.5):
        b.append(Ln(X(g), 0, X(g), n * rh, "ax" if g == 0 else "gr"))
        b.append(T(X(g), n * rh + 24, f"{g:+.1f} σ" if g else "0", "t s16 m", "middle"))
    for i, (k, s, nm) in enumerate(spec):
        a = A[k]
        y = i * rh
        share = a["coach"] / a["observado"] if a["observado"] else 0
        b.append(T(L - 18, y + 28, nm, "t b20", "end"))
        b.append(T(L - 18, y + 50, f"lo pone el DT: {share * 100:.0f}%" if share > 0.05 else "lo pone el DT: casi nada", "t s16 " + ("k-dt" if share > 0.5 else "m"), "end"))
        pos = neg = 0.0
        for key, cn, c in COMP:
            v = a[key] * s
            if abs(v) < 0.005:
                continue
            tip = f"{nm} · {cn}: {v:+.2f} σ"
            if v > 0:
                b.append(R(X(pos) + 1, y + 10, v * sc - 2, 36, f"f-{c}", tip, 3)); pos += v
            else:
                b.append(R(X(neg + v) + 1, y + 10, -v * sc - 2, 36, f"f-{c}", tip, 3)); neg += v
        ob = a["observado"] * s
        b.append(Ln(X(ob), y + 2, X(ob), y + 54, "tot", f"{nm}: lo que se ve en sus partidos, {ob:+.2f} σ frente a la liga"))
        b.append(T(X(max(ob, pos)) + 14, y + 35, f"{ob:+.2f} σ", "t b20"))
    return svg(W, n * rh + 32, "".join(b), "Qué pieza empuja cada rasgo de Almada")


def ch_heat(key, W=470):
    M = D["mapas"][key]
    dif, dt, lg = M["dif"], M["dt"], M["liga"]
    Hh = W * 80 / 120
    mx = max(abs(v) for row in dif for v in row) or 1
    nx, ny = len(dif), len(dif[0])
    cw, chh = W / nx, Hh / ny
    cells = []
    for i in range(nx):
        for j in range(ny):
            v = dif[i][j]
            cells.append(R(i * cw, j * chh, cw, chh, "cell", f"{N}: {dt[i][j]:.2f} por partido · liga {lg[i][j]:.2f} · diferencia {v:+.2f}", 0,
                           mix("--div-pos" if v > 0 else "--div-neg", min(abs(v) / mx, 1) * 88)))
    arrow = f'<path d="M{W - 110} {Hh + 22} h80 m-9 -6 l9 6 l-9 6" class="arrow"/>' + T(W - 122, Hh + 28, "ataca", "t s16 m", "end")
    return svg(W, Hh + 34, pitch_h(W, Hh) + "".join(cells) + pitch_lines_only(W, Hh) + arrow, f"Mapa de {key} frente a la liga")


def pitch_lines_only(w, h):
    return pitch_h(w, h).replace('class="pitch"', 'class="pitch-o"', 1)


def ch_dumb(kpi, dim, flip, W, Hh=330, title=""):
    rows = [r for r in D["contexto"]["curvas"][dim][kpi] if r["dt"] is not None and r["liga"] is not None]
    L, B = 58, 44
    vals = [r[k] * flip for r in rows for k in ("dt", "liga")]
    lo, hi = min(vals + [-0.6]) - 0.25, max(vals + [0.6]) + 0.25
    Y = lambda v: 14 + (hi - v) / (hi - lo) * (Hh - B - 14)
    step = (W - L - 10) / len(rows)
    b = [Ln(L, Y(0), W - 6, Y(0), "ax"), T(L - 10, Y(0) + 5, "0", "t s16 m", "end")]
    for g in (-1.5, -1, -0.5, 0.5, 1, 1.5):
        if lo < g < hi:
            b.append(Ln(L, Y(g), W - 6, Y(g), "gr"))
            b.append(T(L - 10, Y(g) + 5, f"{g:+.1f}", "t s16 m", "end"))
    for i, r in enumerate(rows):
        cx = L + step * (i + 0.5)
        a, l = r["dt"] * flip, r["liga"] * flip
        b.append(Ln(cx, Y(a), cx, Y(l), "lk"))
        b.append(C(cx, Y(l), 9, "d-liga", f"Liga, {r['nivel']}: {l:+.2f}"))
        b.append(C(cx, Y(a), 11, "d-me", f"{N}, {r['nivel']}: {a:+.2f} ({r['n_dt']} tramos) · frente a la liga {a - l:+.2f}"))
        b.append(T(cx, Hh - 12, r["nivel"].replace("Empatando", "Empate"), "t s17", "middle"))
    return svg(W, Hh, "".join(b), title)


def ch_formaciones(W=700):
    f = D["jugadores"]["formaciones"]
    tot = sum(f.values())
    items = sorted(f.items(), key=lambda kv: -kv[1])[:4]
    rh, L = 46, 110
    b = []
    for i, (k, v) in enumerate(items):
        y = i * rh
        nm = "-".join(k)
        w = v / tot * (W - L - 90)
        b.append(T(L - 14, y + 28, nm, "t b22", "end"))
        b.append(R(L, y + 8, w, 28, "f-dt" if i == 0 else "f-rs", f"{nm}: {v} de {tot} partidos", 4))
        b.append(T(L + w + 10, y + 30, f"{v / tot * 100:.0f}%", "t b20"))
    return svg(W, len(items) * rh, "".join(b), "Dibujo con el que arranca")


def ch_cambios(W=700):
    c = D["jugadores"]["cambios_por_estado"]
    rh, L = 52, 120
    order = [("Más ofensivo", "dt"), ("Misma línea", "rs"), ("Más defensivo", "neg")]
    b = []
    for i, est in enumerate(["Perdiendo", "Empatando", "Ganando"]):
        y = i * rh
        tot = sum(c[est].values())
        b.append(T(L - 14, y + 30, est, "t", "end"))
        x = L
        for k, cl in order:
            w = c[est][k] / tot * (W - L)
            b.append(R(x + 1, y + 6, w - 2, 36, f"f-{cl}", f"{est}: {k}, {c[est][k]} cambios ({c[est][k] / tot * 100:.0f}%)", 3))
            if w > 56:
                b.append(T(x + 10, y + 31, f"{c[est][k] / tot * 100:.0f}%", "t b20" + ("" if cl == "rs" else " inv")))
            x += w
    return svg(W, 3 * rh, "".join(b), "Para qué usa sus cambios según el marcador")


def ch_corners(W=560):
    """Zoom al área: burbujas por zona de caída (rejilla de 4 yd); tamaño = cuántos córners, color = % que acaba en remate."""
    y0, y1, xmin, cell = 10, 70, 96, 4
    env = [(x, y, s) for x, y, s in D["balon_parado"]["ofensivo"]["envios"] if x >= xmin and y0 <= y < y1]
    sx = W / (y1 - y0)
    top = 16
    Hh = (120 - xmin) * sx + top + 6
    X = lambda yy: (yy - y0) * sx
    Y = lambda xx: top + (120 - xx) * sx
    b = [f'<rect x="0" y="0" width="{W}" height="{Hh:.0f}" class="pitch"/>',
         f'<rect x="{X(18):.1f}" y="{top}" width="{44 * sx:.1f}" height="{18 * sx:.1f}" class="pl" fill="none"/>',
         f'<rect x="{X(30):.1f}" y="{top}" width="{20 * sx:.1f}" height="{6 * sx:.1f}" class="pl" fill="none"/>',
         Ln(0, top, W, top, "pl"), f'<rect x="{X(36):.1f}" y="{top - 8}" width="{8 * sx:.1f}" height="8" class="goal"/>',
         f'<circle cx="{X(40):.1f}" cy="{Y(108):.1f}" r="4" class="pspot"/>']
    bins: dict[tuple[int, int], tuple[int, int]] = {}
    for x, y, s in env:
        k = (int((120 - x) / cell), int((y - y0) / cell))
        n, sh = bins.get(k, (0, 0))
        bins[k] = (n + 1, sh + s)
    tot = len(env)
    mxn = max(n for n, _ in bins.values())
    for (r, c), (n, sh) in sorted(bins.items(), key=lambda kv: -kv[1][0]):
        if n < 2:
            continue
        cx, cy = X(y0 + (c + 0.5) * cell), Y(120 - (r + 0.5) * cell)
        rr = 4 + math.sqrt(n / mxn) * (cell * sx / 2 - 4)
        pr = sh / n
        b.append(C(cx, cy, rr, "bub", f"{n} córners caen aquí ({n / tot * 100:.0f}% de los que van al área) · {pr * 100:.0f}% acaban en remate",
                   f"fill:color-mix(in oklab, var(--blue) {15 + pr * 85:.0f}%, var(--white))"))
    return svg(W, Hh, "".join(b), "Dónde caen los córners de Almada")


def ch_zonas(W=500):
    o = D["balon_parado"]["ofensivo"]["corner_zonas"]
    lg = D["balon_parado"]["liga"]["corner_zonas"]
    zs = ["Primer palo", "Área chica", "Punto penal", "Segundo palo", "Corto"]
    rh, L = 56, 150
    sc = (W - L - 60) / 50
    b = []
    for i, z in enumerate(zs):
        y = i * rh
        b.append(T(L - 14, y + 27, z, "t", "end"))
        b.append(R(L, y + 6, o[z] * sc, 22, "f-dt", f"{N}: {o[z]:.0f}% de sus córners van a {z.lower()}", 3))
        b.append(R(L, y + 31, lg[z] * sc, 13, "f-rs", f"Liga: {lg[z]:.0f}% van a {z.lower()}", 3))
        b.append(T(L + o[z] * sc + 8, y + 24, f"{o[z]:.0f}%", "t b20"))
        b.append(T(L + lg[z] * sc + 8, y + 43, f"{lg[z]:.0f}%", "t s16 m"))
    return svg(W, len(zs) * rh, "".join(b), "A dónde manda sus córners")


def club_matches(e):
    return [p for p in D["simulacion"]["partidos"] if e["desde"] <= p["date"] <= e["hasta"]]


def ch_puntos_club(e, W=466, Hh=340):
    ps = club_matches(e)
    n = len(ps)
    L, B, Rr = 44, 34, 18
    cr, cx_ = [0], [0.0]
    for p in ps:
        cr.append(cr[-1] + p["puntos"]); cx_.append(cx_[-1] + p["xpts"])
    mx = max(cr[-1], cx_[-1]) * 1.08 or 1
    X = lambda i: L + i / max(n, 1) * (W - L - Rr)
    Y = lambda v: 10 + (1 - v / mx) * (Hh - B - 10)
    step = 10 if mx < 60 else 50
    b = []
    for g in range(0, int(mx) + 1, step):
        b.append(Ln(L, Y(g), W - Rr, Y(g), "gr"))
        b.append(T(L - 8, Y(g) + 5, g, "t s16 m", "end"))
    b.append(f'<polyline points="{" ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in enumerate(cx_))}" class="ln-x"/>')
    b.append(f'<polyline points="{" ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in enumerate(cr))}" class="ln-r"/>')
    for i, p in enumerate(ps, start=1):
        b.append(C(X(i), Y(cr[i]), 6 if n < 40 else 4.5, "d-pt",
                   f"{p['date']} · {'vs' if p['local'] else 'en'} {p['rival']} {p['gf']}-{p['gc']} · {p['puntos']} pts (merecía {p['xpts']:.1f}) · acumulado {cr[i]} reales, {cx_[i]:.0f} merecidos"))
    b.append(T(L, Hh - 6, f"partido 1 a {n}", "t s15 m"))
    return svg(W, Hh, "".join(b), f"Puntos reales contra merecidos en {e['club']}")


def ch_tablero(W=760):
    rs = PLAN["tablero"]["rasgos"]
    rh, L = 62, 250
    lo, hi = -2.5, 2.5
    X = lambda v: L + (v - lo) / (hi - lo) * (W - L - 124)
    b = [Ln(X(0), 0, X(0), len(rs) * rh, "ax")]
    for g in (-2, -1, 1, 2):
        b.append(Ln(X(g), 0, X(g), len(rs) * rh, "gr"))
        b.append(T(X(g), len(rs) * rh + 24, f"{g:+d}", "t s16 m", "middle"))
    b.append(T(X(0), len(rs) * rh + 24, "liga", "t s16 m", "middle"))
    for i, r in enumerate(rs):
        y = i * rh
        nm = LBL.get(r["kpi"], r["etiqueta"])
        b.append(T(L - 16, y + 37, nm, "t", "end"))
        b.append(R(X(r["banda"][0]), y + 19, X(r["banda"][1]) - X(r["banda"][0]), 24, "f-band", f"{nm}: rango normal de su carrera, {r['banda'][0]:+.1f} a {r['banda'][1]:+.1f} σ", 12))
        b.append(Ln(X(r["carrera"]), y + 12, X(r["carrera"]), y + 50, "tot", f"{nm}: su nivel de carrera, {r['carrera']:+.2f} σ"))
        b.append(C(X(r["ultimos"]), y + 31, 12, "d-me", f"{nm}: últimos 10 partidos {r['ultimos']:+.2f} σ (valor {r['sello']})"))
        est = {"en_linea": "en línea", "arriba": "por encima", "abajo": "por debajo"}.get(r["estado"], r["estado"])
        b.append(T(W - 108, y + 38, est, "t s17 ok" if r["estado"] == "en_linea" else "t s17 up"))
    return svg(W, len(rs) * rh + 32, "".join(b), "Seguimiento de seis rasgos")


# ------------------------------------------------------------------ láminas
SLIDES: list[str] = []


def tile(v, lab, sub=""):
    return f'<div class="tile"><b>{esc(v)}</b><span>{esc(lab)}</span>{f"<small>{esc(sub)}</small>" if sub else ""}</div>'


def legend(items):
    return '<div class="legend">' + "".join(f'<span><i class="sw {c}"></i>{esc(n)}</span>' for n, c in items) + "</div>"


def fig(cap, chart, extra="", cls=""):
    c = f"<figcaption>{cap}</figcaption>" if cap else ""
    return f'<figure class="fig {cls}">{c}{chart}{extra}</figure>'


def slide(id_, part, eyebrow, title, body, lede=""):
    head = f'<p class="eyebrow"><span>{esc(part)}</span>{esc(eyebrow)}</p>'
    SLIDES.append(f'<section class="slide" id="{id_}" aria-label="{esc(title)}"><header>{head}<h2>{esc(title)}</h2>'
                  f'{f"<p class=lede>{esc(lede)}</p>" if lede else ""}</header><div class="body">{body}</div></section>')


def fich_rows(ps):
    aps = {"posesion_rival_dur": "Recupera rápido", "recuperaciones_altas_90": "Roba arriba", "conduccion_prog": "Conduce"}
    out = ""
    for p in ps:
        bars = ""
        for a in p["aporta"]:
            z = a["z"]
            bars += (f'<span class="ap" data-tip="{esc(aps.get(a["kpi"], a["kpi"]))}: {z:+.1f} σ frente a la liga">'
                     f'<i class="{"pos" if z > 0 else "neg"}" style="width:{min(abs(z) / 5, 1) * 34 + 4:.0f}px"></i></span>')
        out += (f'<tr><th>{esc(short_player(p["nombre"]))}</th><td>{esc(POS.get(p["pos"], p["pos"]))}</td>'
                f'<td class="cl">{logo(p["club"], 24)}<span>{esc(p["club"])}</span></td><td class="num">{p["min"]:,}</td>'
                f'<td class="aps">{bars}</td><td class="num"><b>{p["score"]:.1f}</b></td></tr>')
    return out


def build():
    M = G["muestra"]
    TR = G["transferencia_resumen"]
    sint = VALID["sintetico"]["realista"]
    ident = TIEMPO["dts"][DT_ID]["identidad"]
    S = D["simulacion"]
    bp_o, bp_l = D["balon_parado"]["ofensivo"], D["balon_parado"]["liga"]
    tab, fich = PLAN["tablero"], PLAN["fichajes"]
    jug = D["jugadores"]
    cur = D["contexto"]["curvas"]

    SLIDES.append(f'''<section class="slide cover" id="inicio" aria-label="Portada">
  <div class="band"></div>
  <p class="kicker">Hackathon Club América · ISAC 2026</p>
  <h1>Coach <span>DNA</span></h1>
  <p class="cover-q">Qué parte del estilo de un equipo es del entrenador y qué parte es de su plantilla. Primero, cómo lo medimos; después, un ejemplo completo: Guillermo Almada.</p>
  <p class="byline">Sebastian Dulong Salazar · octubre 2026 · <a href="{APP_URL}">Abrir la app</a></p>
</section>''')

    qs = [("Estilo con y sin balón", "Construcción, progresión y ocasiones; presión, organización defensiva y transiciones, por zonas de la cancha.", ["adn", "juega"]),
          ("Identidad y contexto", "Si su idea se mantiene torneo a torneo y cómo cambia según rival, marcador, localía y minuto (tramos de 15).", ["contexto"]),
          ("Uso de jugadores", "Dibujo de inicio, roles por línea, rotación del once y qué cambia después de cada sustitución.", ["jugadores"]),
          ("Balón parado", "Córners, tiros libres y saques en zona de peligro; dónde rematan, cómo marcan y dónde sufren.", ["bp"]),
          ("Evidencia cuantitativa", "xG, OBV, acciones progresivas, PPDA y field tilt, más una métrica propia: la huella del DT sin su plantilla.", ["adn", "suyo"]),
          ("Marco explícito", "Cada objeto definido con sus umbrales, supuestos y límites; todas las vistas salen de las mismas definiciones.", ["marco"]),
          ("Simulación para explicar", "Rejugamos cada partido con el xG de cada ocasión para separar mérito de suerte, no para pronosticar.", ["puntos"]),
          ("Decisiones para el lunes", "Seguimiento semanal, fichajes a la medida y un plan para jugarle, cada uno con el dato que lo respalda.", ["america", "rival"])]
    qh = "".join(f'<div class="card q{" hl" if i == 4 else ""}"><h4>{esc(a)}</h4><p>{esc(b)}</p><p class="go">→ lámina {" y ".join("§" + k + "§" for k in ks)}</p></div>' for i, (a, b, ks) in enumerate(qs))
    slide("responde", "Coach DNA", "Qué responde", "Qué responde Coach DNA sobre cualquier entrenador", f'''
<div class="grid4q">{qh}</div>
<p class="note">Lo nuevo: medimos el estilo propio del DT, separado de su plantilla, con un método de economía laboral; y todo se ve en una app interactiva para los 76 DTs de la liga.</p>''',
          "En esta lámina están las preguntas que contesta la herramienta y en qué parte de este reporte se ve cada respuesta, con Guillermo Almada como ejemplo.")

    slide("problema", "Coach DNA", "El problema", "El problema: separar al DT de sus jugadores", f'''
<div class="split" style="grid-template-columns:1fr 740px">
  <div class="prose big">
    <p>Cuando un equipo presiona arriba, ¿es la idea del entrenador o son sus delanteros rápidos? Un perfil de equipo normal suma todo junto.</p>
    <p>Coach DNA separa cada rasgo en cinco piezas: <b class="k-dt">DT</b>, <b class="k-pl">plantilla</b>, <b class="k-cl">club</b>, <b class="k-op">rival</b> y <b class="k-cx">contexto</b>. Lo que queda del DT es su <b>huella propia</b>: lo que se lleva a cualquier club.</p>
  </div>
  {fig("", ch_problema())}
</div>''', "En esta lámina planteamos la pregunta de fondo con un ejemplo real: la salida larga de Almada.")

    objetos = [("Posesión", "Posesión de StatsBomb en la que el equipo toca el balón al menos una vez."),
               ("Secuencia ofensiva", "Posesión que llega al último tercio rival (x ≥ 80 de 120)."),
               ("Acción progresiva", "Pase completado o conducción que gana 25% o más de la distancia al arco."),
               ("Transición", "Posesión que empieza al recuperar; es rápida si llega al último tercio en 10 s."),
               ("Fase de presión", "Presiones encadenadas a 5 s o menos; alta si es en el tercio rival."),
               ("Línea defensiva", "Altura media de los cuatro jugadores más retrasados en cada foto 360."),
               ("Balón parado", "Córner, tiro libre en campo rival o saque en el último tercio, y lo que sigue."),
               ("Tramo y minuto", "Pedazo de partido sin cambios ni goles (5 min o más); el partido se lee en grupos de 15 minutos.")]
    tb = "".join(f"<tr><th>{esc(a)}</th><td>{esc(b)}</td></tr>" for a, b in objetos)
    slide("marco", "Coach DNA", "Marco analítico", "Definiciones y supuestos del análisis", f'''
<div class="split" style="grid-template-columns:1fr 440px">
  <table class="defs"><tbody>{tb}</tbody></table>
  <div class="stack">
    <div class="card"><h4>Supuestos</h4><ul><li>Cancha de 120 × 80; se ataca a la derecha.</li><li>Con pocos datos, la huella de un DT se acerca a cero.</li><li>El rival se mide por su propio estilo.</li></ul></div>
    <div class="card"><h4>Qué queda fuera</h4><ul><li>No hay tracking: el 360 es una foto por evento.</li><li>Entrenamientos, lesiones y vestidor.</li></ul></div>
  </div>
</div>''', "En esta lámina están las definiciones. Las 34 métricas, las gráficas y el modelo usan estos mismos objetos, así que no se contradicen.")

    slide("metodo", "Coach DNA", "Cómo separamos al DT", "Cómo estimamos la parte de cada pieza", f'''
<div class="grid3">
  <div class="card paper"><p class="ey">1 · La base</p><h4>Abowd, Kramarz y Margolis (1999), <i>Econometrica</i></h4><p>Separan cuánto gana un trabajador por mérito propio y cuánto por su empresa, siguiendo a quienes cambian de empleo. Aquí: los DTs que cambian de club.</p></div>
  <div class="card paper"><p class="ey">2 · El puente al futbol</p><h4>Muehlheusser et al. (2018), <i>J. of Sports Economics</i></h4><p>La misma idea con los entrenadores de la Bundesliga, para sus resultados. Nosotros la llevamos al <b>estilo</b>, rasgo por rasgo.</p></div>
  <div class="card paper"><p class="ey">3 · Jugadores en cancha</p><h4>Sill (2010), MIT Sloan Sports Analytics</h4><p>Del básquetbol: medir a cada jugador por quién está en la cancha, con un ajuste bayesiano que no inventa efectos con pocos datos.</p></div>
</div>
{fig("Resultado en toda la liga: qué explica que dos equipos jueguen distinto", ch_reparto(), '<p class="note">El DT pesa más en el <b>cómo</b> (16% en progresión, 15% en presión) que en el xG (7%), que depende más de los jugadores.</p>')}''',
          "En esta lámina explicamos la idea y los tres trabajos en los que nos basamos. Abajo, el resultado para toda la liga.")

    slide("prueba", "Coach DNA", "¿Funciona?", "La prueba: ¿reconoce el modelo al DT en un club nuevo?", f'''
<div class="pasos">
  <div><span>1</span><p><b>Estimamos</b> el estilo de cada DT sólo con sus partidos en <b>otros</b> clubes.</p></div>
  <div><span>2</span><p>Tomamos los partidos de su <b>club nuevo</b> y escondemos quién dirigía.</p></div>
  <div><span>3</span><p>Pedimos al modelo que <b>estime</b> quién es el DT, entre 70 posibles.</p></div>
  <div class="why"><p>Si el estilo fuera de los jugadores, fallaría: en el club nuevo los jugadores son otros.</p></div>
</div>
<div class="tiles three-row">{tile(f'{TR["ajustado"]["top10"] * 100:.0f}%', "de las veces el DT real queda en el top 10 de 70", f'al azar, {TR["azar"]["top10"] * 100:.0f}%')}{tile(f'{TR["ajustado"]["mediana"]:.0f}º', "lugar típico del DT real", f'al azar, {TR["azar"]["mediana"]:.0f}º')}{tile(f'{TR["ajustado"]["mitad_superior"]} de {TR["etapas"]}', "casos con el DT real en la mitad de arriba", "al azar, la mitad")}</div>
{fig(f"Resultado en los {TR['etapas']} cambios de club de la liga: cada punto es un DT, colocado en el lugar en que el modelo lo puso", ch_transfer())}
''',
          f"En esta lámina comprobamos que lo que estimamos sí es del DT: si un estilo es del entrenador, se reconoce aunque cambie de club y de jugadores. (Con datos simulados también recupera un estilo sembrado: correlación {sint['modelo']['media']:.2f}.)")

    et = D["etapas"]
    tot = sum(e["partidos"] for e in et)
    etb = "".join(f'<div class="et" style="flex:{max(e["partidos"] / tot, .2):.3f}" data-tip="{esc(e["club"])}: {e["partidos"]} partidos, {e["desde"]} a {e["hasta"]}">{logo(e["club"], 40)}<div><b>{esc(e["club"])}</b><span>{e["partidos"]} partidos · {e["desde"][:4]}{"" if e["desde"][:4] == e["hasta"][:4] else "–" + e["hasta"][:4]}</span></div></div>' for e in et)
    slide("almada", "Almada", "El ejemplo", "Guillermo Almada: trayectoria y familia de estilo", f'''
<div class="etapas">{etb}</div>
<div class="split" style="grid-template-columns:560px 1fr">
  {fam_card()}
  {fig("Mapa de estilos propios de los 76 DTs, por familia", ch_mapa(860, 360), legend([("Almada", "d-almada")] + [(f'{g["nombre"]} ({g["n"]})', GRP_CLS[g["id"]]) for g in boot["mapa"]["grupos"]]))}
</div>''', "En esta lámina presentamos a Almada: sus clubes y su familia de estilo, que agrupa a los DTs por su estilo propio, ya sin su plantilla.")

    slide("adn", "Almada", "Su ADN", "Sus seis rasgos más marcados frente a los 76 DTs", fig("", ch_adn()),
          "En esta lámina está cada rasgo con el dato de su equipo contra la liga, su lugar entre los 76 DTs y cuánto es propio una vez descontados sus jugadores.")

    slide("suyo", "Almada", "¿Suyo o de la plantilla?", "Qué parte de cada rasgo pone Almada y qué parte su plantilla",
          fig("", ch_suyo(), legend([(n, f"f-{c}") for _, n, c in COMP] + [("Lo que se ve en sus partidos", "tot-sw")])),
          "En esta lámina repartimos cada rasgo entre las piezas del modelo. Lo que va a la derecha suma al rasgo; a la izquierda, lo frena.")

    slide("juega", "Almada", "Cómo juega", "Cómo juega con y sin balón, y en qué zonas", f'''
<div class="tiles six">{tile(f'{H["ppda"]["crudo"]:.1f}', "PPDA", f'liga {H["ppda"]["liga"]:.1f}')}{tile(f'{H["posesion_rival_dur"]["crudo"]:.1f} s', "dura la posesión rival", f'liga {H["posesion_rival_dur"]["liga"]:.1f} s')}{tile(f'{H["contraataque"]["crudo"]:.0f}%', "robos que acaban en contragolpe", f'liga {H["contraataque"]["liga"]:.0f}%')}{tile(f'{H["salida_corta"]["crudo"]:.0f}%', "salida corta del portero", f'liga {H["salida_corta"]["liga"]:.0f}%')}{tile(f'{H["field_tilt"]["crudo"]:.0f}%', "field tilt", f'liga {H["field_tilt"]["liga"]:.0f}%')}{tile(f'{H["obv_90"]["crudo"]:.2f}', "OBV por 90", f'liga {H["obv_90"]["liga"]:.2f}')}</div>
<div class="grid3 pitches">
  {fig("Dónde <b>presiona</b> más que la liga", ch_heat("presion"))}
  {fig("Dónde <b>recupera</b> más que la liga", ch_heat("recuperaciones"))}
  {fig("Dónde <b>progresa</b> más que la liga", ch_heat("progresion"))}
</div>
{legend([("Más que la liga", "f-dt"), ("Menos que la liga", "f-neg")])}''',
          "En esta lámina están sus números clave con y sin balón y, en la cancha, dónde hace más y menos que un equipo promedio.")

    mn = cur["minuto"]["contraataque"]
    best = max((r for r in mn if r["dt"] is not None and r["liga"] is not None), key=lambda r: r["dt"] - r["liga"])
    slide("contexto", "Almada", "Según el partido", "Cómo cambia según el marcador, el minuto y la localía", f'''
<div class="grid3" style="grid-template-columns:420px 1fr 330px">
  {fig("Intensidad de presión según el marcador", ch_dumb("ppda", "marcador", -1, 392, title="Presión según el marcador"), cls="mini")}
  {fig("Contragolpes en cada tramo de 15 minutos", ch_dumb("contraataque", "minuto", 1, 640, title="Contragolpes por minuto"), cls="mini")}
  {fig("Presión en casa y fuera", ch_dumb("ppda", "localia", -1, 302, title="Presión por localía"), cls="mini")}
</div>
{legend([(N, "d-me"), ("Liga en la misma situación", "d-liga")])}
<div class="tiles three-row">{tile(best["nivel"], "el tramo en que más contragolpea", f'{best["dt"] - best["liga"]:+.1f} σ frente a la liga')}{tile(f'{ident["r"]:.2f}', "estabilidad de su estilo entre torneos", f'más estable que el {ident["pct"]:.0f}% de los DTs')}{tile(f'{D["identidad"]["dispersion_pct"]:.0f}%', "de los DTs varían menos que Almada entre partidos", "variabilidad normal")}</div>''',
          "En esta lámina comparamos su equipo con su propio nivel habitual (cero) según el marcador, el minuto y la localía, contra un equipo promedio en la misma situación.")

    top = []
    for ln in ("0", "1", "2", "3"):
        top += jug["mas_usados_por_linea"].get(ln, [])[:2]
    top = sorted(top, key=lambda p: -p["minutos"])[:5]
    th = "".join(f'<tr><th>{esc(short_player(p["nombre"]))}</th><td>{esc(p["posicion"])}</td><td class="num">{p["minutos"]:,.0f}</td><td class="num">{p["titularidades"]}</td></tr>' for p in top)
    slide("jugadores", "Almada", "Sus jugadores", "Dibujo, rotación y uso de los cambios", f'''
<div class="split" style="grid-template-columns:720px 1fr">
  <div class="stack">
    {fig("Dibujo con el que arranca", ch_formaciones())}
    {fig("Para qué usa sus cambios según el marcador", ch_cambios(), legend([("Más ofensivo", "f-dt"), ("Misma línea", "f-rs"), ("Más defensivo", "f-neg")]))}
  </div>
  <div class="stack">
    <div class="tiles three-row">{tile(f'{jug["estabilidad_xi"]:.1f}', "titulares que cambia por partido", f'mediana DTs {JX["mediana_dts"]["rotacion"]:.1f}')}{tile(f"min {jug['minuto_cambios']['1']:.0f}", "su primer cambio", f"liga, min {jug['minuto_cambios_liga']['1']:.0f}")}{tile(f'{D["impacto_cambios"][7]["neto"]:+.1f} σ', "xG en contra tras sus cambios", "baja más que en la liga")}</div>
    <div class="card"><h4>Los que más juegan con Almada</h4><table class="list"><thead><tr><th>Jugador</th><th>Posición</th><th class="num">Minutos</th><th class="num">Titular</th></tr></thead><tbody>{th}</tbody></table></div>
  </div>
</div>''', "En esta lámina vemos con qué dibujo arranca, cuánto rota y para qué hace sus cambios.")

    slide("bp", "Almada", "Balón parado", "Balón parado: córners a favor y en contra", f'''
<div class="split" style="grid-template-columns:560px 500px 1fr">
  {fig("Dónde caen sus córners <span class=m>· tamaño: cuántos · color: % que acaba en remate</span>", ch_corners())}
  {fig("A qué zona los manda", ch_zonas(), legend([(N, "f-dt"), ("Liga", "f-rs")]))}
  <div class="stack">
    {tile(f'{bp_o["corners_por_partido"]:.1f}', "córners a favor por partido", f'liga {bp_l["corners_por_partido"]:.1f}')}
    {tile(f'{bp_o["corner_corto_pct"]:.0f}%', "los juega en corto", f'liga {bp_l["corner_corto_pct"]:.0f}%')}
    <div class="card hl"><h4>En defensa</h4><p>Marca al hombre más que 99 de cada 100 DTs. Su punto débil es el área chica: 0.052 xG por córner que cae ahí (liga 0.035).</p></div>
  </div>
</div>''', "En esta lámina está su balón parado: a dónde manda los córners, cuánto peligro sale de cada zona y cómo defiende.")

    pc = ""
    for e in D["etapas"]:
        ps = club_matches(e)
        r, x = sum(p["puntos"] for p in ps), sum(p["xpts"] for p in ps)
        pc += fig(f'{logo(e["club"], 28)}<b>{esc(e["club"])}</b><span class="m"> · {r} reales vs {x:.0f} merecidos ({r - x:+.0f})</span>', ch_puntos_club(e), cls="mini")
    slide("puntos", "Almada", "¿Merecía sus puntos?", "Puntos reales contra puntos merecidos, club por club", f'''
<div class="grid3">{pc}</div>
{legend([("Puntos reales", "ln-r-sw"), ("Merecidos por el xG de cada ocasión", "ln-x-sw")])}
<p class="note">Rejugamos cada partido 5,000 veces con la calidad de cada ocasión de los dos equipos. Cada club arranca en cero. La simulación sirve para explicar, no para pronosticar.</p>''',
          "En esta lámina usamos la simulación para separar mérito de suerte, club por club. Pasa el cursor por los puntos para ver cada partido.")

    hd = "<thead><tr><th>Jugador</th><th>Posición</th><th>Club</th><th class=num>Minutos</th><th>Recupera · roba · conduce</th><th class=num>Encaje</th></tr></thead>"
    slide("america", "Almada", "Qué hacer: América", "Qué puede hacer América: seguimiento y fichajes", f'''
<div class="split" style="grid-template-columns:600px 1fr">
  {fig(f"Seguimiento: últimos {tab['n']} partidos contra su rango normal", ch_tablero(600), legend([("Últimos 10", "d-me"), ("Su nivel de carrera", "tot-sw"), ("Rango normal", "f-band")]))}
  <div class="stack">
    <div class="card"><h4>Fichajes de la liga que empujan su estilo</h4><table class="list fich">{hd}<tbody>{fich_rows(fich["liga"][:5])}</tbody></table></div>
    <div class="card"><h4>En la plantilla de América, los que más suman</h4><table class="list fich">{hd}<tbody>{fich_rows(fich["suman"][:3])}</tbody></table></div>
  </div>
</div>''', "En esta lámina pasamos a las decisiones de su club. Las barras dicen cuánto empuja cada jugador los tres rasgos clave de Almada, medido sin su entrenador.")

    fases = PLANF["fases"]
    cards = {}
    for f in ["con", "sin", "trans", "bp", "partido"]:
        items = [a for a in PLAN["acciones"] if a["fase"] == f]
        if not items:
            continue
        lis = ""
        for a in items:
            ev = a["evidencia"][0] if a["evidencia"] else {}
            if ev.get("sello") and ev.get("liga"):
                dato = f'{ev.get("etiqueta", "")}: {ev["sello"]} (liga {ev["liga"]})'
            elif ev.get("pegados_pct"):
                dato = f'{ev["pegados_pct"]:.0f}% de sus defensores marcan al hombre en córners'
            elif f == "partido" and re.search(r"\(([−-]?[\d.]+) desviaciones típicas, (\d+) tramos\)", a["texto"]):
                m_ = re.search(r"\(([−-]?[\d.]+) desviaciones típicas, (\d+) tramos\)", a["texto"])
                dato = f"{abs(float(m_.group(1).replace('−', '-'))):.1f} σ por encima de lo que hace la liga en ese tramo ({m_.group(2)} tramos)"
            else:
                txt = a["texto"].replace("{N}", N)
                partes = [x.strip() for x in txt.split(":")]
                con_num = [x for x in partes if any(ch.isdigit() for ch in x)]
                dato = (con_num[0] if con_num else "").rstrip(".")
                if len(dato) > 110:
                    dato = dato[:dato.rfind(" ", 0, 108)] + "…"
            viz = ""
            try:
                v1 = float(str(ev.get("sello", "")).replace("%", "").replace(" s", "")); v2 = float(str(ev.get("liga", "")).replace("%", "").replace(" s", ""))
                mxv = max(v1, v2) or 1
                pc = ev.get("pct")
                pill = f'<em>{"más" if pc >= 50 else "menos"} que el {min(pc if pc >= 50 else 100 - pc, 99):.0f}% de los DTs</em>' if pc is not None else ""
                viz = (f'<span class="mb" data-tip="{esc(ev.get("etiqueta", ""))}: {N} {esc(ev["sello"])} · liga {esc(ev["liga"])}">'
                       f'<i class="a" style="width:{v1 / mxv * 100:.0f}%"></i><i class="l" style="width:{v2 / mxv * 100:.0f}%"></i></span>{pill}')
                viz = f'<span class="vz">{viz}</span>'
            except (TypeError, ValueError):
                pass
            lis += f'<li><b>{esc(a["titulo"].replace("{N}", N))}</b>{f"<small>{esc(dato)}</small>" if dato else ""}{viz}</li>'
        cards[f] = f'<div class="card plan"><h4>{esc(fases[f]["es"].replace("{N}", N))}</h4><ul>{lis}</ul></div>'
    g = lambda *ks: "".join(cards.get(k, "") for k in ks)
    cols = f'<div class="stack">{g("con")}</div><div class="stack">{g("sin", "trans")}</div><div class="stack">{g("bp", "partido")}</div>'
    slide("rival", "Almada", "Qué hacer: el rival", "Cómo jugarle a Almada, por situación de juego", f'<div class="grid3 plans">{cols}</div>' + legend([(N, "f-dt"), ("Liga", "f-rs")]),
          "En esta lámina está el plan para quien lo enfrente. Cada punto sale de un rasgo propio de Almada que destaca contra la liga, con su dato.")

    SLIDES.append(f'''<section class="slide cover end" id="cierre" aria-label="Cierre">
  <div class="band"></div>
  <h1>Coach <span>DNA</span></h1>
  <p class="cover-q">Qué parte del estilo es del DT y qué parte de sus jugadores, para cualquier técnico de la liga, convertido en seguimiento, fichajes y un plan de partido.</p>
  <p><a class="cta" href="{APP_URL}">Abrir la app</a></p>
  <div class="grid2">
    <div class="card"><h4>Límites</h4><ul><li>Es una descomposición estadística, no un experimento.</li><li>Sus 11 partidos en América se leen junto con su carrera.</li><li>xG y OBV son de StatsBomb. Mostramos resultados, nunca los datos.</li></ul></div>
    <div class="card"><h4>Referencias</h4><ul><li>Abowd, Kramarz y Margolis (1999), <i>Econometrica</i>.</li><li>Muehlheusser, Schneemann, Sliwka y Wallmeier (2018), <i>J. of Sports Economics</i>.</li><li>Sill (2010), MIT Sloan Sports Analytics Conference.</li></ul></div>
  </div>
</section>''')


JS = r"""
(() => {
  const S = [...document.querySelectorAll('.slide')], n = S.length;
  const cnt = document.getElementById('cnt'), bar = document.getElementById('bar'), tip = document.getElementById('tip'), toc = document.getElementById('toc');
  document.documentElement.classList.add('js');
  let i = 0;
  const fit = () => document.documentElement.style.setProperty('--s', Math.max(Math.min(innerWidth / 1600, (innerHeight - 52) / 900), 0.2));
  const go = k => {
    i = Math.max(0, Math.min(n - 1, k));
    S.forEach((s, j) => { s.classList.toggle('on', j === i); s.setAttribute('aria-hidden', j === i ? 'false' : 'true'); });
    cnt.textContent = (i + 1) + ' / ' + n; bar.style.width = ((i + 1) / n * 100) + '%'; toc.value = i; hide();
    try { history.replaceState(null, '', '#' + S[i].id); } catch (e) {}
  };
  let cur = null;
  const show = (el, x, y) => {
    if (cur !== el) { cur && cur.classList.remove('hov'); cur = el; el.classList.add('hov'); tip.textContent = el.dataset.tip; }
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, x + 14)) + 'px';
    tip.style.top = (y - r.height - 14 < 8 ? y + 18 : y - r.height - 14) + 'px';
  };
  const hide = () => { tip.hidden = true; cur && cur.classList.remove('hov'); cur = null; };
  addEventListener('pointermove', e => { const el = e.target.closest && e.target.closest('.slide.on [data-tip]'); el ? show(el, e.clientX, e.clientY) : hide(); });
  addEventListener('pointerdown', e => { const el = e.target.closest && e.target.closest('.slide.on [data-tip]'); el ? show(el, e.clientX, e.clientY) : hide(); });
  addEventListener('resize', fit); fit();
  addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT') return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(i + 1); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(i - 1); }
    if (e.key === 'Home') go(0); if (e.key === 'End') go(n - 1);
  });
  document.getElementById('prev').onclick = () => go(i - 1);
  document.getElementById('next').onclick = () => go(i + 1);
  toc.onchange = e => go(+e.target.value);
  let x0 = null;
  addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60 && !e.target.closest('[data-tip]')) go(i + (dx < 0 ? 1 : -1)); x0 = null; });
  const h = location.hash.slice(1), k = S.findIndex(s => s.id === h);
  go(k >= 0 ? k : 0);
})();
"""


def main():
    build()
    ids = [s_.split('id="')[1].split('"')[0] for s_ in SLIDES]
    for k, s_ in enumerate(SLIDES):
        for j, i_ in enumerate(ids):
            s_ = s_.replace(f"§{i_}§", str(j + 1))
        SLIDES[k] = s_
    toc = "".join(f'<option value="{k}">{k + 1}. {esc(html.unescape(s.split("aria-label=")[1].split(chr(34))[1]))}</option>' for k, s in enumerate(SLIDES))
    lg = '<i class="logo logo-isac" role="img" aria-label="ISAC"></i><i class="logo logo-am" role="img" aria-label="Club América"></i>'
    slides = [s[: s.rindex("</section>")] + f'<footer class="sfoot">{lg}<span class="pg">{k + 1} / {len(SLIDES)}</span></footer></section>' for k, s in enumerate(SLIDES)]
    nav = (f'<nav class="ctrl" aria-label="Navegación"><button id="prev" type="button" aria-label="Lámina anterior">←</button>'
           f'<label class="sr" for="toc">Ir a la lámina</label><select id="toc">{toc}</select><span id="cnt"></span>'
           f'<button id="next" type="button" aria-label="Lámina siguiente">→</button><i class="prog"><i id="bar"></i></i></nav>')
    body = f'<main class="deck">{"".join(slides)}</main>{nav}<div id="tip" role="tooltip" hidden></div><script>{JS}</script>'
    uri = lambda p, m: f"url(data:{m};base64,{base64.b64encode(p.read_bytes()).decode()})"
    css = (OUT / "slides.css").read_text() + ":root{--logo-isac:" + uri(OUT / "logos/isac.svg", "image/svg+xml") + ";--logo-am:" + uri(OUT / "logos/america.png", "image/png") + "}"
    head = ('<title>Coach DNA: Almada</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            '<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">\n'
            f"<style>{css}</style>\n")
    (OUT / "coach-dna-reporte.html").write_text('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
                                                 + head + "</head><body>" + body + "</body></html>")
    (OUT / "publicar.html").write_text(head + body)
    print("ok", len(SLIDES), "láminas", len(body) // 1024, "KB")


if __name__ == "__main__":
    main()
