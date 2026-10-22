"""Reporte HTML de entrega (ISAC 2026): la historia de Guillermo Almada, de punta a punta.

Lee sólo los resultados agregados que ya publica la app (web/public/data y web/src/boot.json), nunca los datos crudos,
y escribe un HTML autocontenido con gráficas SVG en línea.

  python docs/reporte/build.py   ->  docs/reporte/coach-dna-reporte.html  (+ cuerpo sin <head> para publicar)
"""
from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "web/public/data"
OUT = Path(__file__).resolve().parent
DT_ID = "2947"
APP_URL = "https://claude.ai/artifact/CrS1hEPKJXf3m21vWvRZzC"

boot = json.loads((ROOT / "web/src/boot.json").read_text())
G = boot["global"]
D = json.loads((DATA / f"dt_{DT_ID}.json").read_text())
PLAN = json.loads((DATA / "plan.json").read_text())["dts"][DT_ID]
TIEMPO = json.loads((DATA / "tiempo.json").read_text())
VALID = json.loads((DATA / "validacion.json").read_text())

esc = html.escape
N = "Almada"

# nombres llanos de los indicadores (los que se ven en el reporte)
LBL = {
    "posesion": "Posesión", "salida_corta": "Salida corta del portero", "pase_largo": "Pases largos",
    "construccion_exito": "Construcción que llega a campo rival", "pases_por_posesion": "Pases por posesión", "tempo": "Ritmo de pase",
    "verticalidad": "Verticalidad", "progresivos": "Acciones progresivas", "conduccion_prog": "Progresión en conducción",
    "progresion_banda": "Progresión por banda", "cambios_orientacion": "Cambios de orientación", "entradas_ultimo_tercio": "Entradas al último tercio",
    "xg_90": "xG a favor", "xg_por_tiro": "xG por tiro", "tiros_90": "Tiros por 90", "llegada_area": "Llegadas al área", "centros": "Centros",
    "obv_90": "OBV por 90", "ppda": "PPDA", "altura_presion": "Altura de la presión", "presion_alta": "Presiones en campo rival",
    "intensidad_presion": "Intensidad de presión", "contrapresion": "Contrapresión tras pérdida", "recuperaciones_altas_90": "Recuperaciones en campo rival",
    "altura_defensiva": "Altura de acciones defensivas", "linea_360": "Altura de la línea (360)", "compacidad_360": "Largo del bloque (360)",
    "posesion_rival_dur": "Duración de la posesión rival", "xg_contra_90": "xG en contra", "contraataque": "Contragolpes",
    "xg_transicion": "xG de contragolpe", "transicion_def": "Contragolpes concedidos", "field_tilt": "Field tilt", "xg_balon_parado_90": "xG tras balón parado",
}
COMP = [("coach", "DT", "dt"), ("player", "Plantilla", "pl"), ("club", "Club", "cl"), ("opp", "Rival", "op"), ("ctx", "Contexto", "cx")]


def f1(x, d=1):
    return f"{x:,.{d}f}"


def pct_txt(p, sign):
    """'más que 99 de cada 100 DTs' a partir del percentil del efecto propio."""
    v = min(p if sign > 0 else 100 - p, 99)
    return f"{round(v):.0f} de cada 100"


# ------------------------------------------------------------------ piezas SVG
def svg(w, h, body, label, cls="chart"):
    return f'<svg class="{cls}" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(label)}" preserveAspectRatio="xMidYMid meet">{body}</svg>'


def t(x, y, s, cls="lab", anchor="start", extra=""):
    return f'<text x="{x:.1f}" y="{y:.1f}" class="{cls}" text-anchor="{anchor}" {extra}>{esc(str(s))}</text>'


def rect(x, y, w, h, cls, tip=None, rx=3, style=""):
    tt = f"<title>{esc(tip)}</title>" if tip else ""
    st = f' style="{style}"' if style else ""
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{max(w, 0):.1f}" height="{h:.1f}" rx="{rx}" class="{cls}"{st}>{tt}</rect>'


def pitch(x0, y0, w, h, half=False):
    """Cancha StatsBomb 120x80 escalada a w x h (ataca hacia la derecha)."""
    sx, sy = w / (60 if half else 120), h / 80
    ox = 60 if half else 0
    X = lambda v: x0 + (v - ox) * sx
    Y = lambda v: y0 + v * sy
    p = [f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" class="pitch"/>']
    L = lambda a, b, c, d: p.append(f'<line x1="{X(a):.1f}" y1="{Y(b):.1f}" x2="{X(c):.1f}" y2="{Y(d):.1f}" class="pline"/>')
    R = lambda a, b, c, d: p.append(f'<rect x="{X(a):.1f}" y="{Y(b):.1f}" width="{(c - a) * sx:.1f}" height="{(d - b) * sy:.1f}" class="pline" fill="none"/>')
    if not half:
        L(60, 0, 60, 80)
        p.append(f'<circle cx="{X(60):.1f}" cy="{Y(40):.1f}" r="{10 * sx:.1f}" class="pline" fill="none"/>')
        R(0, 18, 18, 62); R(0, 30, 6, 50)
    R(102, 18, 120, 62); R(114, 30, 120, 50)
    return "".join(p), X, Y


# ------------------------------------------------------------------ gráficas
def chart_reparto():
    v = G["varianza_media"]
    parts = [("Plantilla", v["player"], "pl"), ("DT", v["coach"], "dt"), ("Club", v["club"], "cl"), ("Rival", v["opp"], "op"),
             ("Sin explicar", v["residual"] + v["ctx"], "rs")]
    W, H, x = 1000, 120, 0
    b = []
    for name, s, c in parts:
        w = s * W
        b.append(rect(x + 1, 18, w - 2, 46, f"f-{c}", f"{name}: {s * 100:.1f}%", rx=4))
        if w > 70:
            b.append(t(x + 10, 50, f"{s * 100:.0f}%", "barval" if c == "rs" else "barval inv"))
        b.append(t(x + 4, 92, name, "lab strong" if c == "dt" else "lab"))
        x += w
    return svg(W, H, "".join(b), "Reparto de las diferencias de estilo entre equipos")


def chart_familias():
    fam = {}
    for h in D["huella"]:
        if h["familia"] == "Arquetipos":
            continue
        fam.setdefault(h["familia"], []).append(G["varianza"][h["kpi"]]["coach"])
    rows = sorted(((k, sum(v) / len(v)) for k, v in fam.items()), key=lambda r: -r[1])
    W, rh, L = 1000, 38, 250
    mx = 0.3
    b = []
    for i, (k, s) in enumerate(rows):
        y = 10 + i * rh
        b.append(t(L - 14, y + 20, k, "lab", "end"))
        b.append(rect(L, y + 6, (W - L - 80) * s / mx, 20, "f-dt", f"{k}: el DT explica {s * 100:.0f}%"))
        b.append(t(L + (W - L - 80) * s / mx + 8, y + 21, f"{s * 100:.0f}%", "barval"))
    for g in (0, 0.1, 0.2, 0.3):
        gx = L + (W - L - 80) * g / mx
        b.insert(0, f'<line x1="{gx:.1f}" y1="6" x2="{gx:.1f}" y2="{10 + len(rows) * rh}" class="grid"/>')
        b.append(t(gx, 10 + len(rows) * rh + 18, f"{g * 100:.0f}%", "tick", "middle"))
    return svg(W, 10 + len(rows) * rh + 26, "".join(b), "Parte del estilo que explica el DT, por fase del juego")


def chart_etapas():
    et = D["etapas"]
    tot = sum(e["partidos"] for e in et)
    W = 1000
    ws = [max(e["partidos"] / tot, 0.2) for e in et]
    ws = [w / sum(ws) * W for w in ws]
    cls = {"Santos Laguna": "f-et1", "Pachuca": "f-et2", "América": "f-et3"}
    b, x = [], 0
    for e, w in zip(et, ws):
        b.append(rect(x + 1, 10, w - 2, 44, cls[e["club"]], f'{e["club"]}: {e["partidos"]} partidos', rx=4))
        b.append(t(x + 12, 38, e["club"], "barval inv"))
        yrs = e["desde"][:4] if e["desde"][:4] == e["hasta"][:4] else f'{e["desde"][:4]}–{e["hasta"][:4]}'
        b.append(t(x + 12, 76, f'{e["partidos"]} partidos · {yrs}', "lab"))
        x += w
    return svg(W, 90, "".join(b), "Etapas de Almada en Liga MX")


def chart_huella():
    rows = [h for h in D["huella"] if h["familia"] != "Arquetipos" and abs(h["alpha"]) >= 0.4]
    rows.sort(key=lambda h: h["alpha"])
    W, rh, L, R = 1000, 34, 300, 230
    mid = L + (W - L - R) / 2
    sc = (W - L - R) / 2 / 1.2
    b = [f'<line x1="{mid}" y1="0" x2="{mid}" y2="{len(rows) * rh + 8}" class="axis0"/>']
    for g in (-1, -0.5, 0.5, 1):
        gx = mid + g * sc
        b.append(f'<line x1="{gx:.1f}" y1="0" x2="{gx:.1f}" y2="{len(rows) * rh + 8}" class="grid"/>')
        b.append(t(gx, len(rows) * rh + 26, f"{g:+.1f}", "tick", "middle"))
    b.append(t(mid, len(rows) * rh + 26, "0", "tick", "middle"))
    b.append(t(mid - 8, len(rows) * rh + 46, "← menos que el DT típico", "tick", "end"))
    b.append(t(mid + 8, len(rows) * rh + 46, "más que el DT típico →", "tick"))
    for i, h in enumerate(rows):
        y = 6 + i * rh
        a, se = h["alpha"], h["se"]
        x1, x2 = sorted((mid, mid + a * sc))
        c = "f-dt" if a > 0 else "f-neg"
        b.append(t(L - 14, y + 19, LBL[h["kpi"]], "lab", "end"))
        b.append(rect(x1, y + 6, x2 - x1, 18, c, f'{LBL[h["kpi"]]}: efecto propio {a:+.2f} ± {1.96 * se:.2f}', rx=3))
        lo, hi = mid + (a - 1.96 * se) * sc, mid + (a + 1.96 * se) * sc
        b.append(f'<line x1="{lo:.1f}" y1="{y + 15}" x2="{hi:.1f}" y2="{y + 15}" class="whisk"/>')
        s = 1 if a > 0 else -1
        b.append(t(W - R + 16, y + 20, f'{"más" if s > 0 else "menos"} que {pct_txt(h["pct"], s)} DTs', "lab muted"))
    return svg(W, len(rows) * rh + 56, "".join(b), "Huella propia de Almada: rasgos más marcados una vez descontados sus jugadores")


def chart_reparto_rasgos(spec):
    A = {a["kpi"]: a for a in D["atribucion"]}
    W, rh, L = 1000, 46, 300
    lo_v, hi_v = -0.6, 1.8
    sc = (W - L - 30) / (hi_v - lo_v)
    X = lambda v: L + (v - lo_v) * sc
    b = []
    n = len(spec)
    for g in (-0.5, 0, 0.5, 1, 1.5):
        b.append(f'<line x1="{X(g):.1f}" y1="0" x2="{X(g):.1f}" y2="{n * rh + 4}" class="{"axis0" if g == 0 else "grid"}"/>')
        b.append(t(X(g), n * rh + 22, f"{g:+.1f}" if g else "0", "tick", "middle"))
    for i, (k, s, name) in enumerate(spec):
        a = A[k]
        y = 4 + i * rh
        b.append(t(L - 14, y + 18, name, "lab", "end"))
        dt_share = a["coach"] * s / (a["observado"] * s) if a["observado"] else 0
        b.append(t(L - 14, y + 35, f"lo pone el DT: {dt_share * 100:.0f}%" if dt_share > 0.05 else "lo pone el DT: casi nada", "tick", "end"))
        pos, neg = 0.0, 0.0
        for key, nm, c in COMP + [("residual", "Sin explicar", "rs")]:
            v = a[key] * s
            if abs(v) < 0.005:
                continue
            if v > 0:
                b.append(rect(X(pos) + 1, y + 8, v * sc - 2, 22, f"f-{c}", f"{nm}: {v:+.2f}", rx=2)); pos += v
            else:
                b.append(rect(X(neg + v) + 1, y + 8, -v * sc - 2, 22, f"f-{c}", f"{nm}: {v:+.2f}", rx=2)); neg += v
        ob = a["observado"] * s
        b.append(f'<line x1="{X(ob):.1f}" y1="{y + 2}" x2="{X(ob):.1f}" y2="{y + 36}" class="total"><title>Lo que se ve en sus partidos: {ob:+.2f}</title></line>')
    return svg(W, n * rh + 30, "".join(b), "Qué pieza empuja cada rasgo de Almada")


def chart_heat(key, label):
    m = D["mapas"][key]["dif"]
    mx = max(abs(v) for row in m for v in row) or 1
    W, H = 600, 400
    pl, X, Y = pitch(0, 0, W, H)
    cells = []
    nx, ny = len(m), len(m[0])
    cw, ch = W / nx, H / ny
    for i in range(nx):
        for j in range(ny):
            v = m[i][j]
            k = min(abs(v) / mx, 1) * 85
            var = "--div-pos" if v > 0 else "--div-neg"
            cells.append(f'<rect x="{i * cw:.1f}" y="{j * ch:.1f}" width="{cw:.1f}" height="{ch:.1f}" style="fill:color-mix(in oklab, var({var}) {k:.0f}%, transparent)"><title>{v:+.2f} por partido frente a la liga</title></rect>')
    arrow = f'<path d="M{W - 120} {H + 22} h90 m-10 -6 l10 6 l-10 6" class="arrow"/>' + t(W - 130, H + 27, "ataca", "tick", "end")
    return svg(W, H + 36, pl + "".join(cells) + arrow, label, "chart pitchsvg")


def chart_dumbbell(title, kpi, dim, flip, levels=None):
    c = D["contexto"]["curvas"][dim][kpi]
    rows = [r for r in c if not levels or r["nivel"] in levels]
    W, H, L, B = 340, 210, 40, 36
    vals = [r["dt"] * flip for r in rows] + [r["liga"] * flip for r in rows]
    lo, hi = min(vals + [-0.5]) - 0.2, max(vals + [0.5]) + 0.2
    Yp = lambda v: 16 + (hi - v) / (hi - lo) * (H - B - 16)
    step = (W - L - 20) / len(rows)
    b = [f'<line x1="{L}" y1="{Yp(0):.1f}" x2="{W - 10}" y2="{Yp(0):.1f}" class="axis0"/>', t(L - 8, Yp(0) + 4, "0", "tick", "end")]
    for g in (-1.5, -1, -0.5, 0.5, 1, 1.5):
        if lo < g < hi:
            b.append(f'<line x1="{L}" y1="{Yp(g):.1f}" x2="{W - 10}" y2="{Yp(g):.1f}" class="grid"/>')
            b.append(t(L - 8, Yp(g) + 4, f"{g:+.1f}", "tick", "end"))
    for i, r in enumerate(rows):
        cx = L + step * (i + 0.5)
        a, l = r["dt"] * flip, r["liga"] * flip
        b.append(f'<line x1="{cx:.1f}" y1="{Yp(a):.1f}" x2="{cx:.1f}" y2="{Yp(l):.1f}" class="link"/>')
        b.append(f'<circle cx="{cx:.1f}" cy="{Yp(l):.1f}" r="7" class="dot-liga"><title>Liga, {r["nivel"]}: {l:+.2f}</title></circle>')
        b.append(f'<circle cx="{cx:.1f}" cy="{Yp(a):.1f}" r="8" class="dot-dt"><title>{N}, {r["nivel"]}: {a:+.2f}</title></circle>')
        b.append(t(cx, H - 14, r["nivel"], "lab", "middle"))
    return f'<figure class="mini"><figcaption>{esc(title)}</figcaption>{svg(W, H, "".join(b), title)}</figure>'


def chart_tiempo():
    x = TIEMPO["dts"][DT_ID]
    ks = TIEMPO["kpis"]
    spec = [("recuperaciones_altas_90", 1, "Roba en campo rival"), ("posesion_rival_dur", -1, "Recupera rápido"),
            ("ppda", -1, "Presiona (menos PPDA)"), ("salida_corta", -1, "Saca largo"), ("conduccion_prog", 1, "Conduce para avanzar"),
            ("progresivos", 1, "Acciones progresivas"), ("cambios_orientacion", 1, "Cambia de orientación")]
    tor = x["torneos"]
    W, L, Tp = 1000, 230, 64
    cw = (W - L - 10) / len(tor)
    rh = 34
    b = []
    for j, tt in enumerate(tor):
        cx = L + cw * (j + 0.5)
        b.append(t(cx, 22, tt["id"], "lab strong", "middle"))
        b.append(t(cx, 40, tt["club"].replace("Santos Laguna", "Santos"), "tick", "middle"))
        b.append(t(cx, 54, f'{tt["n"]} p.', "tick", "middle"))
    for i, (k, s, name) in enumerate(spec):
        y = Tp + i * rh
        b.append(t(L - 12, y + rh / 2 + 5, name, "lab", "end"))
        ki = ks.index(k)
        for j in range(len(tor)):
            v = x["m"][j][ki] * s
            pc = min(abs(v) / 1.5, 1) * 90
            var = "--div-pos" if v > 0 else "--div-neg"
            b.append(f'<rect x="{L + cw * j + 2:.1f}" y="{y + 2}" width="{cw - 4:.1f}" height="{rh - 4}" rx="3" style="fill:color-mix(in oklab, var({var}) {pc:.0f}%, var(--surface-2))"><title>{name}, {tor[j]["nombre"]}: {v:+.2f}</title></rect>')
            b.append(t(L + cw * (j + 0.5), y + rh / 2 + 5, f"{v:+.1f}", "cellval", "middle"))
    return svg(W, Tp + len(spec) * rh + 6, "".join(b), "Rasgos de Almada torneo por torneo")


def chart_puntos():
    ps = D["simulacion"]["partidos"]
    n = len(ps)
    W, H, L, B = 1000, 300, 50, 34
    cum_r, cum_x, r, xx = [], [], 0, 0
    for p in ps:
        r += p["puntos"]; xx += p["xpts"]
        cum_r.append(r); cum_x.append(xx)
    mx = max(cum_r[-1], cum_x[-1]) * 1.05
    X = lambda i: L + i / (n - 1) * (W - L - 130)
    Y = lambda v: 10 + (1 - v / mx) * (H - B - 10)
    b = []
    for g in range(0, int(mx) + 1, 50):
        b.append(f'<line x1="{L}" y1="{Y(g):.1f}" x2="{W - 130}" y2="{Y(g):.1f}" class="grid"/>')
        b.append(t(L - 8, Y(g) + 4, g, "tick", "end"))
    acc = 0
    for e in D["etapas"]:
        x0, x1 = X(acc), X(min(acc + e["partidos"], n) - 1)
        b.append(t((x0 + x1) / 2, H - 8, e["club"].replace("Santos Laguna", "Santos"), "tick", "middle"))
        if acc:
            b.append(f'<line x1="{x0:.1f}" y1="10" x2="{x0:.1f}" y2="{H - B}" class="sep"/>')
        acc += e["partidos"]
    pr = " ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in enumerate(cum_r))
    px = " ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in enumerate(cum_x))
    b.append(f'<polyline points="{px}" class="ln-liga"/>')
    b.append(f'<polyline points="{pr}" class="ln-dt"/>')
    b.append(t(X(n - 1) + 10, Y(cum_r[-1]) - 2, f"Reales: {cum_r[-1]}", "lab strong"))
    b.append(t(X(n - 1) + 10, Y(cum_x[-1]) + 16, f"Merecidos: {cum_x[-1]:.0f}", "lab muted"))
    return svg(W, H, "".join(b), "Puntos acumulados reales contra puntos merecidos por xG")


def chart_cambios():
    c = D["jugadores"]["cambios_por_estado"]
    W, rh, L = 1000, 40, 150
    order = [("Más ofensivo", "dt"), ("Misma línea", "rs"), ("Más defensivo", "neg")]
    b = []
    for i, est in enumerate(["Perdiendo", "Empatando", "Ganando"]):
        y = 6 + i * rh
        tot = sum(c[est].values())
        b.append(t(L - 12, y + 20, est, "lab", "end"))
        x = L
        for k, cl in order:
            w = c[est][k] / tot * (W - L - 10)
            b.append(rect(x + 1, y + 4, w - 2, 24, f"f-{cl}", f"{est}: {k} {c[est][k] / tot * 100:.0f}%", rx=2))
            if w > 60:
                b.append(t(x + 8, y + 21, f"{c[est][k] / tot * 100:.0f}%", "barval inv" if cl != "rs" else "barval"))
            x += w
    return svg(W, 3 * rh + 10, "".join(b), "Para qué usa Almada sus cambios según el marcador")


def chart_formaciones():
    f = D["jugadores"]["formaciones"]
    tot = sum(f.values())
    items = sorted(f.items(), key=lambda kv: -kv[1])[:5]
    W, rh, L = 480, 34, 90
    b = []
    for i, (k, v) in enumerate(items):
        y = 4 + i * rh
        name = "-".join(k)
        b.append(t(L - 12, y + 19, name, "lab", "end"))
        w = v / tot * (W - L - 70)
        b.append(rect(L, y + 6, w, 18, "f-dt" if i == 0 else "f-rs", f"{name}: {v} partidos"))
        b.append(t(L + w + 8, y + 20, f"{v / tot * 100:.0f}%", "barval"))
    return svg(W, len(items) * rh + 8, "".join(b), "Dibujos con los que arranca Almada")


def chart_corner_zonas():
    o = D["balon_parado"]["ofensivo"]["corner_zonas"]
    lg = D["balon_parado"]["liga"]["corner_zonas"]
    zs = ["Primer palo", "Área chica", "Punto penal", "Segundo palo", "Corto"]
    W, rh, L = 480, 44, 120
    mx = 50
    b = []
    for i, z in enumerate(zs):
        y = 4 + i * rh
        b.append(t(L - 12, y + 22, z, "lab", "end"))
        w1, w2 = o[z] / mx * (W - L - 60), lg[z] / mx * (W - L - 60)
        b.append(rect(L, y + 6, w1, 14, "f-dt", f"{N}: {o[z]:.0f}%"))
        b.append(rect(L, y + 22, w2, 10, "f-rs", f"Liga: {lg[z]:.0f}%"))
        b.append(t(L + w1 + 6, y + 18, f"{o[z]:.0f}%", "barval"))
        b.append(t(L + w2 + 6, y + 32, f"{lg[z]:.0f}%", "tick"))
    return svg(W, len(zs) * rh + 6, "".join(b), "A dónde manda sus córners Almada frente a la liga")


def chart_corner_envios():
    env = D["balon_parado"]["ofensivo"]["envios"]
    W, H = 480, 640 * 480 / 480
    # media cancha vertical: el arco arriba
    W, H = 480, 420
    sx, sy = W / 80, H / 52
    X = lambda yy: yy * sx
    Y = lambda xx: (120 - xx) * sy
    b = [f'<rect x="0" y="0" width="{W}" height="{H}" class="pitch"/>',
         f'<rect x="{X(18):.1f}" y="0" width="{44 * sx:.1f}" height="{18 * sy:.1f}" class="pline" fill="none"/>',
         f'<rect x="{X(30):.1f}" y="0" width="{20 * sx:.1f}" height="{6 * sy:.1f}" class="pline" fill="none"/>',
         f'<circle cx="{X(40):.1f}" cy="{12 * sy:.1f}" r="2.5" class="pspot"/>']
    for x, y, s in env:
        if x < 68:
            continue
        b.append(f'<circle cx="{X(y):.1f}" cy="{Y(x):.1f}" r="{5 if s else 3.4}" class="{"dot-shot" if s else "dot-env"}"/>')
    return svg(W, H, "".join(b), "Dónde caen los córners de Almada", "chart pitchsvg")


def chart_tablero():
    rs = PLAN["tablero"]["rasgos"]
    W, rh, L = 1000, 40, 330
    lo, hi = -2.5, 2.5
    X = lambda v: L + (v - lo) / (hi - lo) * (W - L - 110)
    b = [f'<line x1="{X(0):.1f}" y1="0" x2="{X(0):.1f}" y2="{len(rs) * rh}" class="axis0"/>']
    for g in (-2, -1, 1, 2):
        b.append(f'<line x1="{X(g):.1f}" y1="0" x2="{X(g):.1f}" y2="{len(rs) * rh}" class="grid"/>')
        b.append(t(X(g), len(rs) * rh + 18, f"{g:+d}", "tick", "middle"))
    b.append(t(X(0), len(rs) * rh + 18, "liga", "tick", "middle"))
    for i, r in enumerate(rs):
        y = i * rh
        b.append(t(L - 12, y + 24, LBL.get(r["kpi"], r["etiqueta"]), "lab", "end"))
        b.append(rect(X(r["banda"][0]), y + 12, X(r["banda"][1]) - X(r["banda"][0]), 16, "f-band", "Rango normal de su carrera", rx=8))
        b.append(f'<line x1="{X(r["carrera"]):.1f}" y1="{y + 8}" x2="{X(r["carrera"]):.1f}" y2="{y + 32}" class="total"><title>Su nivel de carrera: {r["carrera"]:+.2f}</title></line>')
        b.append(f'<circle cx="{X(r["ultimos"]):.1f}" cy="{y + 20}" r="8" class="dot-dt"><title>Últimos 10 partidos: {r["ultimos"]:+.2f}</title></circle>')
        est = {"en_linea": "en línea", "arriba": "por encima", "abajo": "por debajo"}.get(r["estado"], r["estado"])
        b.append(t(W - 96, y + 25, est, "pill-t" if r["estado"] == "en_linea" else "pill-t up"))
    return svg(W, len(rs) * rh + 26, "".join(b), "Seguimiento: últimos 10 partidos de Almada en América contra su rango normal")


def chart_reconoce():
    tr = [x for x in D["transferencia"] if x["club"] == "América"][0]
    W, H, L = 1000, 130, 40
    X = lambda r: L + (r - 1) / 69 * (W - 2 * L)
    b = [f'<line x1="{X(1)}" y1="60" x2="{X(70)}" y2="60" class="axis0"/>']
    for r in (1, 10, 20, 30, 40, 50, 60, 70):
        b.append(f'<line x1="{X(r):.1f}" y1="55" x2="{X(r):.1f}" y2="65" class="axis0"/>')
        b.append(t(X(r), 84, f"{r}º", "tick", "middle"))
    marks = [(tr["rank_nulo"], "Al azar", "dot-liga", -1), (tr["rank_crudo"], "Con su estilo crudo", "dot-cl", -1),
             (tr["rank_ajustado"], "Con su huella propia", "dot-dt", 1)]
    for r, nm, cl, side in marks:
        b.append(f'<circle cx="{X(r):.1f}" cy="60" r="9" class="{cl}"><title>{nm}: {r:.0f}º de 70</title></circle>')
        yy = 34 if side < 0 else 112
        b.append(t(X(r) + (0 if r > 3 else 0), yy, f"{nm}: {r:.0f}º", "lab strong" if cl == "dot-dt" else "lab", "middle" if r > 8 else "start"))
    return svg(W, H, "".join(b), "En qué lugar pone el modelo a Almada entre 70 técnicos, viendo sólo sus partidos en América")


def chart_mapa():
    pts = boot["mapa"]["puntos"]
    xs, ys = [p["x"] for p in pts], [p["y"] for p in pts]
    W, H, P = 1000, 460, 30
    X = lambda v: P + (v - min(xs)) / (max(xs) - min(xs)) * (W - 2 * P)
    Y = lambda v: P + (max(ys) - v) / (max(ys) - min(ys)) * (H - 2 * P - 20)
    b = [f'<line x1="{X(0):.1f}" y1="{P - 10}" x2="{X(0):.1f}" y2="{H - P - 10}" class="grid"/>',
         f'<line x1="{P}" y1="{Y(0):.1f}" x2="{W - P}" y2="{Y(0):.1f}" class="grid"/>']
    ej = boot["mapa"]["ejes"]
    b.append(t(W - P, H - 4, ej["x"]["positivo"] + " →", "tick", "end"))
    b.append(t(P, H - 4, "← " + ej["x"]["negativo"], "tick"))
    b.append(t(X(0) + 8, P - 14, "↑ " + ej["y"]["positivo"], "tick"))
    b.append(t(X(0) + 8, H - 26, "↓ " + ej["y"]["negativo"], "tick"))
    names = boot["nombres"]
    for p in pts:
        if str(p["id"]) == DT_ID:
            continue
        nm = names.get(str(p["id"]), {}).get("corto", p["nombre"])
        cl = "dot-near" if p["grupo"] == 2 else "dot-map"
        b.append(f'<circle cx="{X(p["x"]):.1f}" cy="{Y(p["y"]):.1f}" r="5.5" class="{cl}"><title>{esc(nm)}</title></circle>')
    a = [p for p in pts if str(p["id"]) == DT_ID][0]
    near = sorted(pts, key=lambda q: (q["x"] - a["x"]) ** 2 + (q["y"] - a["y"]) ** 2)[1:4]
    for q in near:
        nm = names.get(str(q["id"]), {}).get("corto", q["nombre"])
        right = X(q["x"]) > X(a["x"])
        b.append(t(X(q["x"]) + (10 if right else -10), Y(q["y"]) - 8, nm, "tick", "start" if right else "end"))
    b.append(f'<circle cx="{X(a["x"]):.1f}" cy="{Y(a["y"]):.1f}" r="10" class="dot-dt"><title>Guillermo Almada</title></circle>')
    b.append(t(X(a["x"]), Y(a["y"]) + 30, "Almada", "lab strong", "middle"))
    return svg(W, H, "".join(b), "Mapa de estilos propios de los DTs de la liga")


# ------------------------------------------------------------------ bloques de texto
def kpi_tile(v, lab, sub=""):
    return f'<div class="tile"><b>{esc(v)}</b><span>{esc(lab)}</span>{f"<small>{esc(sub)}</small>" if sub else ""}</div>'


def legend(items):
    return '<div class="legend">' + "".join(f'<span><i class="sw {c}"></i>{esc(n)}</span>' for n, c in items) + "</div>"


INTRO = {
    "problema": "En esta sección planteamos la pregunta de fondo del reporte: cuando vemos a un equipo jugar de cierta forma, cuánto de eso decidió el entrenador y cuánto viene de los jugadores que tiene.",
    "marco": "En esta sección definimos los objetos con los que trabajamos (qué es una posesión, una transición, una fase de presión), los supuestos que tomamos y lo que el análisis sí y no puede ver. Todo lo que sigue se calcula a partir de estas definiciones.",
    "metodo": "En esta sección explicamos, sin fórmulas, cómo separamos al DT de su plantilla y de dónde viene la idea. También podemos ver qué tanto pesa el entrenador en el estilo de la liga en general.",
    "quien": "En esta sección presentamos a Guillermo Almada: por qué clubes pasó y en qué lugar del mapa de estilos de la liga cae comparado con los demás DTs.",
    "adn": "En esta sección están las ideas que más distinguen a Almada, cada una con su número contra la liga. También podemos ver su huella completa: todos sus rasgos marcados, ya sin el efecto de sus jugadores.",
    "suyo": "En esta sección repartimos cada rasgo de Almada entre las cinco piezas del modelo. Así podemos ver qué rasgos se lleva a cualquier club y cuáles dependían de los jugadores que tuvo.",
    "con": "En esta sección vemos qué hace su equipo con el balón: cómo sale desde atrás, cómo avanza y cómo genera ocasiones, con xG, OBV, acciones progresivas y field tilt. También podemos ver en qué zonas de la cancha progresa más que la liga.",
    "sin": "En esta sección vemos qué hace su equipo sin el balón: cuánto y dónde presiona, dónde recupera y qué pasa justo después de robar o de perder la pelota.",
    "contexto": "En esta sección comparamos cómo cambia su equipo según el marcador, el minuto y la localía, contra lo que hace un equipo promedio en la misma situación.",
    "tiempo": "En esta sección seguimos sus rasgos torneo por torneo, desde Santos hasta América, para ver si su identidad se mantiene o cambia con los años.",
    "jugadores": "En esta sección vemos cómo usa a sus jugadores: con qué dibujo arranca, cuánto rota, cuándo y para qué hace sus cambios, y quiénes son los que más minutos juegan con Almada.",
    "bp": "En esta sección está el balón parado, a favor y en contra: cuántos córners saca, a dónde los manda, cuánto peligro generan y cómo defiende los del rival.",
    "puntos": "En esta sección usamos la simulación para explicar sus resultados: rejugamos cada partido miles de veces con la calidad de cada ocasión y comparamos los puntos que sumó contra los que merecía.",
    "hacer": "En esta sección pasamos del análisis a las decisiones: qué puede vigilar y fichar América, y cómo le conviene jugar a un rival que enfrente a Almada.",
    "confianza": "En esta sección resumimos las pruebas que hicimos para saber si el modelo de verdad separa al DT de su plantilla.",
    "app": "En esta sección presentamos la app de la que sale este reporte, junto con sus límites y las referencias en las que nos basamos.",
}


def section(id_, num, eyebrow, title, body):
    intro = f'<p class="intro">{esc(INTRO[id_])}</p>' if id_ in INTRO else ""
    return f'<section id="{id_}" class="sec"><div class="sec-h"><p class="eyebrow"><span>{num}</span>{esc(eyebrow)}</p><h2>{esc(title)}</h2>{intro}</div>{body}</section>'


def build():
    M = G["muestra"]
    v = G["varianza_media"]
    H = {h["kpi"]: h for h in D["huella"]}
    A = {a["kpi"]: a for a in D["atribucion"]}
    S = D["simulacion"]
    bp_o, bp_d, bp_l = D["balon_parado"]["ofensivo"], D["balon_parado"]["defensivo"], D["balon_parado"]["liga"]
    tr_am = [x for x in D["transferencia"] if x["club"] == "América"][0]
    TR = G["transferencia_resumen"]
    sint = VALID["sintetico"]["realista"]
    ident = TIEMPO["dts"][DT_ID]["identidad"]
    tab = PLAN["tablero"]
    res10 = tab["resultados"]
    fich = PLAN["fichajes"]
    names = boot["nombres"]
    corto = lambda pid, full: names.get(str(pid), {}).get("corto", full)

    sal = A["salida_corta"]
    sal_share = sal["coach"] / sal["observado"]

    # ---------- portada
    hero = f'''
<header class="hero" id="inicio">
  <div class="wrap">
    <p class="kicker">Coach DNA · Hackathon ISAC 2026 · Club América</p>
    <h1>Guillermo Almada<span>Un estilo que viaja de club en club</span></h1>
    <p class="lede">Cómo juega el equipo de Almada, qué parte de ese estilo es suya y qué parte de sus jugadores, cómo cambia según el partido y qué puede hacer un cuerpo técnico con eso. Contado paso a paso con {M["partidos"]:,} partidos de Liga MX.</p>
    <div class="tiles">
      {kpi_tile(str(D["partidos_total"]), "partidos dirigidos", "Santos, Pachuca y América")}
      {kpi_tile("6", "rasgos que son suyos", "no de su plantilla")}
      {kpi_tile(f"{tr_am['rank_ajustado']}º de 70", "lo reconoce en América", "viendo sólo esos partidos")}
      {kpi_tile(f"{S['puntos']} vs {S['xpts']:.0f}", "puntos reales vs merecidos", "por el xG de cada ocasión")}
    </div>
    <p class="byline">Sebastian Dulong Salazar · octubre 2026 · <a href="{APP_URL}">Abrir la app</a></p>
  </div>
</header>'''

    # ---------- resumen ejecutivo
    resumen = section("resumen", "", "Resumen ejecutivo", "Almada presiona, roba arriba y saca largo, y lo hace con cualquier plantilla", f'''
<div class="exec">
  <div class="exec-col">
    <h3>Lo que encontramos</h3>
    <ol class="findings">
      <li><b>Su sello es sin balón.</b> Su equipo deja al rival {H["posesion_rival_dur"]["crudo"]:.1f} s con el balón (liga {H["posesion_rival_dur"]["liga"]:.1f} s) y roba {H["recuperaciones_altas_90"]["crudo"]:.1f} balones por partido en campo rival (liga {H["recuperaciones_altas_90"]["liga"]:.1f}). Sólo 1 de 76 técnicos empuja más el robo alto.</li>
      <li><b>Con balón, va directo.</b> Su portero sale corto {H["salida_corta"]["crudo"]:.0f}% de las veces (liga {H["salida_corta"]["liga"]:.0f}%) y su equipo avanza conduciendo más que con cualquier otro DT.</li>
      <li><b>Es suyo, no de sus jugadores.</b> Quitando lo que ponen la plantilla, el club y el rival, esos rasgos siguen ahí. Escondimos sus 11 partidos en América y el modelo lo identificó primero entre 70 técnicos.</li>
      <li><b>No afloja cuando gana.</b> Cuando un equipo va ganando, la liga suele soltar la presión. Almada no. Y entre el minuto 60 y el 75 su equipo contragolpea muy por encima de lo normal.</li>
      <li><b>Sumó más de lo que generó.</b> {S["puntos"]} puntos reales contra {S["xpts"]:.0f} merecidos por sus ocasiones; su equipo se queda con el {S["dominio_medio"]:.0f}% del xG de sus partidos.</li>
    </ol>
  </div>
  <div class="exec-col">
    <h3>Qué hacer con esto</h3>
    <ul class="actions">
      <li><span class="tag t-am">América</span> Vigilar seis rasgos con un tablero semanal. Hoy los seis están en su rango normal: el equipo ya juega como Almada.</li>
      <li><span class="tag t-am">América</span> Fichar para el estilo: perfiles que recuperan rápido, roban arriba y conducen. Dentro de la plantilla, Erick Sánchez es el que más encaja.</li>
      <li><span class="tag t-riv">Rival</span> Superar su presión con juego directo, cortar a sus conductores y cuidar la pérdida.</li>
      <li><span class="tag t-riv">Rival</span> En córners: vigilar el segundo palo en ataque y cargarle el área chica en defensa, donde concede más.</li>
    </ul>
  </div>
</div>''')

    # ---------- 1. el problema
    problema = section("problema", "01", "El problema", "El estilo de un equipo mezcla al DT con sus jugadores", f'''
<div class="prose">
<p>Cuando un equipo presiona arriba, ¿es por la idea del entrenador o porque tiene delanteros rápidos? Un perfil de equipo normal no lo puede decir: suma todo junto. Si Almada llega a un club con jugadores que ya presionaban, el dato lo hace ver más presionante de lo que es. Y si llega a un club sin esos jugadores, lo hace ver menos.</p>
<p>Por eso medimos dos cosas distintas para cada rasgo:</p>
</div>
<div class="duo">
  <div class="card"><p class="eyebrow">Lo que se ve</p><h4>El dato crudo</h4><p>Lo que hizo su equipo en sus partidos. Ejemplo: su portero sale corto {H["salida_corta"]["crudo"]:.0f}% de las veces, contra {H["salida_corta"]["liga"]:.0f}% de la liga.</p></div>
  <div class="card c-dt"><p class="eyebrow">Lo que pone Almada</p><h4>La huella propia</h4><p>Lo que queda al quitar a sus jugadores, al club, al rival y al contexto. En ese mismo rasgo, Almada pone el {sal_share * 100:.0f}% de la diferencia; el resto viene del club, de la plantilla y de los partidos que le tocaron.</p></div>
</div>''')

    # ---------- 2. marco analítico
    F = G["framework"]
    objetos = [
        ("Posesión", "Una posesión de StatsBomb en la que el equipo toca el balón al menos una vez (pase, conducción o tiro)."),
        ("Secuencia ofensiva", "Una posesión que llega al último tercio rival (x ≥ 80 en una cancha de 120)."),
        ("Acción progresiva", "Pase completado o conducción que acerca el balón al arco rival al menos 25% de la distancia que le faltaba."),
        ("Transición", "Posesión que empieza al recuperar el balón en juego. Es rápida si llega al último tercio en 10 s o menos."),
        ("Fase de presión", "Cadena de presiones del mismo equipo separadas por 5 s o menos. Es alta si ocurre en el tercio rival."),
        ("Línea defensiva (360)", "Con el balón en el rival, la altura media de los cuatro jugadores de campo más retrasados, medida en cada foto 360."),
        ("Balón parado", "Córner, tiro libre en campo rival o saque de banda en el último tercio, y la jugada que sigue."),
        ("Tramo", "Pedazo de partido sin cambios de jugadores ni de marcador, de al menos 5 minutos. Es la unidad del modelo."),
    ]
    obj_html = "".join(f"<tr><th>{esc(a)}</th><td>{esc(b)}</td></tr>" for a, b in objetos)
    marco = section("marco", "02", "Marco analítico", "Primero definimos cada objeto; todo lo demás sale de ahí", f'''
<div class="prose"><p>Antes de medir nada fijamos qué es cada cosa. Las {len(G["kpis"]) if isinstance(G["kpis"], list) else 34} métricas del reporte, sus gráficas y el modelo se calculan sobre estos mismos objetos y umbrales, así que un número en una sección coincide con el de otra.</p></div>
<div class="tablewrap"><table class="defs"><tbody>{obj_html}</tbody></table></div>
<div class="trio">
  <div class="card"><h4>Supuestos</h4><ul>
    <li>Cancha de StatsBomb: 120 × 80 yardas, el equipo ataca hacia la derecha.</li>
    <li>Un tramo de menos de 5 minutos se une al siguiente para no medir ruido.</li>
    <li>Si un DT tiene pocos datos, su huella se acerca a cero: no se le inventa un estilo.</li>
    <li>El rival se mide con su propio estilo, no sólo con su nombre.</li></ul></div>
  <div class="card"><h4>Qué mide</h4><ul>
    <li>Estilo con y sin balón, transiciones y balón parado.</li>
    <li>Cuánto de cada rasgo pone el DT, la plantilla, el club, el rival y el contexto.</li>
    <li>Cómo cambia según marcador, minuto, localía y rival, y a lo largo de los torneos.</li></ul></div>
  <div class="card"><h4>Qué queda fuera</h4><ul>
    <li>No hay tracking: las fotos 360 muestran posiciones sólo en el instante de cada evento.</li>
    <li>Antes de 2024 hay menos partidos con 360.</li>
    <li>Entrenamientos, lesiones y vestidor no están en los datos.</li>
    <li>Usamos los torneos de 2021/22 a 2026/27 disponibles en el API, incluido el Apertura 2026 en curso.</li></ul></div>
</div>''')

    # ---------- 3. método
    metodo = section("metodo", "03", "Cómo separamos al DT", "Usamos el método con el que en economía se separa a un directivo de su empresa", f'''
<div class="steps">
  <div class="step"><span>1</span><h4>Partimos cada partido en tramos</h4><p>{M["partidos"]:,} partidos en {M["segmentos"]:,} tramos en los que no cambian los 22 jugadores ni el marcador.</p></div>
  <div class="step"><span>2</span><h4>Repartimos cada rasgo en piezas</h4><p>DT, club, jugadores en cancha, rival y contexto. Lo que permite separarlos: {M["dts"]} DTs, muchos de ellos con varios clubes, y {M["jugadores_modelados"]} jugadores que pasaron por varios DTs.</p></div>
  <div class="step"><span>3</span><h4>Estimamos con estadística bayesiana</h4><p>Cada pieza empieza en cero y sólo se aleja si los datos lo justifican. Un DT con pocos partidos no recibe un estilo inventado.</p></div>
</div>
<div class="papers">
  <div class="card paper"><p class="eyebrow">La base</p><h4>Abowd, Kramarz y Margolis (1999), <i>Econometrica</i></h4><p>Separaron cuánto gana un trabajador por mérito propio y cuánto por la empresa en la que está, siguiendo a la gente que cambia de empleo. Es el método estándar de la economía laboral para separar dos efectos que siempre aparecen juntos.</p></div>
  <div class="card paper"><p class="eyebrow">El puente al futbol</p><h4>Muehlheusser, Schneemann, Sliwka y Wallmeier (2018), <i>Journal of Sports Economics</i></h4><p>Usaron la misma idea con los entrenadores de la Bundesliga que cambiaron de club, para medir cuánto aportan a los <b>resultados</b>. Nosotros la aplicamos al <b>estilo de juego</b>, rasgo por rasgo.</p></div>
  <div class="card paper"><p class="eyebrow">Los jugadores en cancha</p><h4>Sill (2010), MIT Sloan Sports Analytics Conference</h4><p>En el básquetbol se mide a cada jugador según quién está en la cancha en cada momento, con un ajuste bayesiano para no exagerar a los que juegan poco. Lo usamos para que el modelo sepa qué traía cada jugador.</p></div>
</div>
<figure><figcaption>En toda la liga, qué explica que dos equipos jueguen distinto</figcaption>{chart_reparto()}<p class="note">Promedio de los {sum(1 for h in D["huella"] if h["familia"] != "Arquetipos")} indicadores de estilo. «Sin explicar» incluye el contexto (marcador, minuto, localía), que en promedio aporta {v["ctx"] * 100:.0f}%: mueve el estilo dentro de un partido pero casi no distingue a un equipo de otro.</p></figure>
<figure><figcaption>Dónde pesa más el DT: la parte de cada fase que explica el entrenador</figcaption>{chart_familias()}<p class="note">El DT decide sobre todo el <b>cómo</b> (progresión, presión, transiciones). El xG y el OBV dependen mucho más de la calidad de los jugadores.</p></figure>''')

    # ---------- 4. quién es
    quien = section("quien", "04", "Guillermo Almada", "Tres clubes, una misma idea", f'''
<figure>{chart_etapas()}</figure>
<div class="prose">
<p>Almada dirigió {D["partidos_total"]} partidos de Liga MX en esta muestra: {D["etapas"][0]["partidos"]} con Santos Laguna, {D["etapas"][1]["partidos"]} con Pachuca y {D["etapas"][2]["partidos"]} con América en el Apertura 2026. Que haya cambiado de club es justo lo que permite separar su estilo del de sus jugadores.</p>
<p>Además, el {D["identificabilidad"]["conectividad"] * 100:.0f}% de los minutos de sus jugadores son de futbolistas que también jugaron con otros técnicos. Con eso el modelo sabe qué traía cada jugador antes de llegar con Almada. Su índice de separación es {D["identificabilidad"]["indice"]:.0f} sobre 100.</p>
</div>
<figure><figcaption>Dónde cae Almada en el mapa de estilos propios de los {len(boot["mapa"]["puntos"])} DTs</figcaption>{chart_mapa()}
{legend([("Almada", "dot-dt"), ("Su familia: presión alta y defensa adelantada", "dot-near"), ("Otros DTs", "dot-map")])}
<p class="note">Cada punto es un DT según su huella propia, no según su plantilla. Los más parecidos a Almada son Gago, Demichelis y Mohamed.</p></figure>''')

    # ---------- 5. ADN
    pr = D["narrativa"]["principios"]
    pr_html = "".join(f'<div class="princ"><h4>{esc(p["titulo"])}</h4><p>{esc(p["descripcion"])}</p><p class="ev">{esc(p["evidencia"].split(" Dato técnico")[0])}</p></div>' for p in pr)
    adn = section("adn", "05", "Su ADN", "Seis rasgos que Almada lleva a cualquier club", f'''
<div class="princs">{pr_html}</div>
<figure><figcaption>La huella propia de Almada: los rasgos más marcados una vez descontados sus jugadores, el club y el rival</figcaption>{chart_huella()}
<p class="note">Cada barra es el efecto propio de Almada en desviaciones típicas entre DTs (σ). La línea fina es el margen de error al 95%. A la derecha, cuántos DTs de la liga quedan por debajo.</p></figure>''')

    # ---------- 6. suyo o de la plantilla
    spec = [("salida_corta", -1, "Saca largo desde el portero"), ("ppda", -1, "Presiona (PPDA bajo)"), ("recuperaciones_altas_90", 1, "Roba en campo rival"),
            ("conduccion_prog", 1, "Avanza conduciendo"), ("altura_presion", 1, "Presiona muy arriba"), ("tiros_90", 1, "Tira mucho"),
            ("xg_balon_parado_90", 1, "Genera xG a balón parado")]
    suyo = section("suyo", "06", "¿Suyo o de la plantilla?", "Su presión es suya; su volumen de tiros y su balón parado vienen de sus jugadores", f'''
<div class="prose"><p>Cada barra reparte lo que se ve en sus partidos (la raya negra) entre las cinco piezas. Lo que empuja hacia la derecha suma al rasgo; lo que va a la izquierda lo frena.</p></div>
<figure>{legend([(n, f"f-{c}") for _, n, c in COMP] + [("Sin explicar", "f-rs")])}{chart_reparto_rasgos(spec)}
<p class="note">Valores en σ frente a la liga. Contexto: marcador, minuto, localía y expulsiones de cada tramo.</p></figure>
<div class="duo">
  <div class="card c-dt"><h4>Lo pone Almada</h4><p>La presión (PPDA), el robo alto, sacar largo y avanzar conduciendo. En el robo alto, Almada aporta {A["recuperaciones_altas_90"]["coach"]:+.2f} σ de los {A["recuperaciones_altas_90"]["observado"]:+.2f} σ que se ven. El contexto incluso le resta: sus equipos van ganando seguido y ganar suele bajar el robo alto.</p></div>
  <div class="card c-pl"><h4>Lo ponen sus jugadores</h4><p>La altura de la presión, el volumen de tiros y el xG a balón parado. En balón parado Almada aporta {A["xg_balon_parado_90"]["coach"]:+.2f} σ: el peligro viene de los cabeceadores que tuvo. Si cambian los jugadores, eso no viaja con Almada.</p></div>
</div>''')

    # ---------- 7. con balón
    con = section("con", "07", "Con balón", "Sale en largo y rompe líneas conduciendo", f'''
<div class="tiles small">
  {kpi_tile(f'{H["salida_corta"]["crudo"]:.0f}%', "salida corta del portero", f'liga {H["salida_corta"]["liga"]:.0f}%')}
  {kpi_tile(f'{H["conduccion_prog"]["crudo"]:.0f}%', "de su progresión es en conducción", f'liga {H["conduccion_prog"]["liga"]:.0f}%')}
  {kpi_tile(f'{H["progresivos"]["crudo"]:.1f}', "acciones progresivas por 100", f'liga {H["progresivos"]["liga"]:.1f}')}
  {kpi_tile(f'{H["field_tilt"]["crudo"]:.0f}%', "field tilt", f'liga {H["field_tilt"]["liga"]:.0f}%')}
</div>
<div class="prose">
<p>El equipo de Almada no elabora desde atrás: hace {H["pases_por_posesion"]["crudo"]:.1f} pases por posesión (liga {H["pases_por_posesion"]["liga"]:.1f}) y el portero busca el envío largo. Una vez en campo rival, rompe líneas con el balón en los pies y cambia de orientación más que casi nadie ({H["cambios_orientacion"]["crudo"]:.1f} por 100 pases, liga {H["cambios_orientacion"]["liga"]:.1f}).</p>
<p>Tira mucho ({H["tiros_90"]["crudo"]:.1f} por 90, liga {H["tiros_90"]["liga"]:.1f}) pero desde lejos: {H["xg_por_tiro"]["crudo"]:.2f} xG por tiro (liga {H["xg_por_tiro"]["liga"]:.2f}). El xG total queda apenas sobre la media ({H["xg_90"]["crudo"]:.2f} por 90) y su OBV por 90 es {H["obv_90"]["crudo"]:.2f} (liga {H["obv_90"]["liga"]:.2f}).</p>
</div>
<figure><figcaption>Dónde progresa el equipo de Almada más que la liga (por partido)</figcaption>{chart_heat("progresion", "Mapa de progresión de Almada frente a la liga")}
{legend([("Más que la liga", "f-dt"), ("Menos que la liga", "f-neg")])}</figure>''')

    # ---------- 8. sin balón
    sin = section("sin", "08", "Sin balón y transiciones", "Recupera rápido y lejos de su arco", f'''
<div class="tiles small">
  {kpi_tile(f'{H["ppda"]["crudo"]:.1f}', "PPDA (pases rivales por robo)", f'liga {H["ppda"]["liga"]:.1f}')}
  {kpi_tile(f'{H["posesion_rival_dur"]["crudo"]:.1f} s', "dura la posesión rival", f'liga {H["posesion_rival_dur"]["liga"]:.1f} s')}
  {kpi_tile(f'{H["recuperaciones_altas_90"]["crudo"]:.1f}', "robos en campo rival por 90", f'liga {H["recuperaciones_altas_90"]["liga"]:.1f}')}
  {kpi_tile(f'{H["contraataque"]["crudo"]:.0f}%', "de sus robos acaban en contragolpe", f'liga {H["contraataque"]["liga"]:.0f}%')}
</div>
<div class="duo-fig">
  <figure><figcaption>Dónde recupera más que la liga (recuperaciones e intercepciones)</figcaption>{chart_heat("recuperaciones", "Mapa de recuperaciones de Almada frente a la liga")}</figure>
  <figure><figcaption>Dónde presiona más que la liga</figcaption>{chart_heat("presion", "Mapa de presión de Almada frente a la liga")}</figure>
</div>
{legend([("Más que la liga", "f-dt"), ("Menos que la liga", "f-neg")])}
<div class="prose"><p>Sus acciones defensivas ocurren más arriba que con casi cualquier DT y el rival dura poco con el balón. Al robar, sale rápido: {H["contraataque"]["crudo"]:.0f}% de sus recuperaciones llegan al último tercio en 10 segundos o menos, y {H["xg_transicion"]["crudo"]:.0f}% de su xG nace de esas jugadas (liga {H["xg_transicion"]["liga"]:.0f}%). Al perder, contrapresiona en el {H["contrapresion"]["crudo"]:.0f}% de los casos y concede menos contragolpes que la media.</p></div>''')

    # ---------- 9. según el partido
    ctx = section("contexto", "09", "Según el partido", "Cuando gana, la liga suelta la presión; Almada no", f'''
<div class="prose"><p>Comparamos cada tramo con el nivel habitual del propio equipo. Cero es su nivel normal; los puntos grises son lo que hace un equipo promedio de la liga en la misma situación.</p></div>
{legend([(N, "dot-dt"), ("Liga en la misma situación", "dot-liga")])}
<div class="grid3">
  {chart_dumbbell("Intensidad de presión según el marcador", "ppda", "marcador", -1)}
  {chart_dumbbell("Contragolpes según el minuto", "contraataque", "minuto", 1)}
  {chart_dumbbell("Intensidad de presión en casa y fuera", "ppda", "localia", -1)}
</div>
<div class="trio">
  <div class="card"><h4>Marcador</h4><p>Empatando o ganando, la liga presiona menos. Almada mantiene la presión: no se mete atrás a cuidar el resultado. Su línea también baja menos que la de la liga cuando va arriba.</p></div>
  <div class="card"><h4>Minuto</h4><p>Entre el 60 y el 75 su equipo contragolpea {D["contexto"]["curvas"]["minuto"]["contraataque"][2]["dt"]:+.1f} σ sobre su nivel normal, cuando la liga apenas cambia. Es el tramo de sus cambios ofensivos y de rivales cansados de correr detrás.</p></div>
  <div class="card"><h4>Localía</h4><p>En casa presiona mucho más que la liga en casa. De visitante también presiona por encima de lo que hace un visitante promedio.</p></div>
</div>
<div class="prose"><p>Su estilo cambia de un partido a otro lo normal: más que el {D["identidad"]["dispersion_pct"]:.0f}% de los DTs. Viendo un solo partido, el modelo adivina que es Almada el {D["identidad"]["acierto"] * 100:.0f}% de las veces, {D["identidad"]["lift"]:.0f} veces más seguido que al azar.</p></div>''')

    # ---------- 10. en el tiempo
    tiempo = section("tiempo", "10", "A lo largo del tiempo", "Nueve torneos, la misma huella", f'''
<figure><figcaption>Sus rasgos torneo por torneo (en la dirección de su estilo, σ frente a la liga)</figcaption>{chart_tiempo()}
{legend([("En la dirección de su estilo", "f-dt"), ("En contra", "f-neg")])}</figure>
<div class="prose"><p>El robo alto y la recuperación rápida aparecen del mismo lado en los nueve torneos, con Santos, con Pachuca y con América. Su perfil de un torneo se parece al de los demás con una correlación de {ident["r"]:.2f}, más estable que el {ident["pct"]:.0f}% de los DTs. Lo único que cambió en América: más acciones progresivas y una recuperación todavía más rápida.</p></div>''')

    # ---------- 11. jugadores
    jug = D["jugadores"]
    top = []
    for ln in ("0", "1", "2", "3"):
        top += jug["mas_usados_por_linea"].get(ln, [])[:2]
    top = sorted(top, key=lambda p: -p["minutos"])[:6]
    top_html = "".join(f'<tr><th>{esc(corto(p["player_id"], p["nombre"]))}</th><td>{esc(p["posicion"])}</td><td class="num">{p["minutos"]:,.0f}</td><td class="num">{p["titularidades"]}</td></tr>' for p in top)
    jugadores = section("jugadores", "11", "Sus jugadores", "4-2-3-1, mucha rotación y cambios que cierran el partido", f'''
<div class="duo-fig">
  <figure><figcaption>Dibujo con el que arranca</figcaption>{chart_formaciones()}</figure>
  <div class="tiles small col">
    {kpi_tile(f'{jug["estabilidad_xi"]:.1f}', "titulares que cambia por partido", f'mediana de los DTs {PLAN and json.loads((DATA / f"jugadores_{DT_ID}.json").read_text())["mediana_dts"]["rotacion"]:.1f}')}
    {kpi_tile(f"min {jug['minuto_cambios']['1']:.0f}", "su primer cambio", f"liga min {jug['minuto_cambios_liga']['1']:.0f}")}
    {kpi_tile(f'{D["impacto_cambios"][7]["neto"]:+.1f} σ', "xG en contra tras sus cambios", "baja más que con la liga")}
  </div>
</div>
<figure><figcaption>Para qué usa sus cambios según el marcador</figcaption>{chart_cambios()}
{legend([("Más ofensivo (delantero por defensa o medio)", "f-dt"), ("Misma línea", "f-rs"), ("Más defensivo", "f-neg")])}</figure>
<div class="prose"><p>Cuando va perdiendo, uno de cada tres cambios es para atacar más. Y lo que más se mueve tras sus cambios es el xG en contra: baja {abs(D["impacto_cambios"][7]["neto"]):.1f} σ más de lo que baja con un DT promedio. Sus cambios ordenan al equipo más de lo que lo desordenan.</p></div>
<div class="tablewrap"><table class="list"><thead><tr><th>Los que más juegan con Almada</th><th>Posición</th><th class="num">Minutos</th><th class="num">Titular</th></tr></thead><tbody>{top_html}</tbody></table></div>''')

    # ---------- 12. balón parado
    bp = section("bp", "12", "Balón parado", "Córners al segundo palo y marcaje al hombre", f'''
<div class="tiles small">
  {kpi_tile(f'{bp_o["corners_por_partido"]:.1f}', "córners a favor por partido", f'liga {bp_l["corners_por_partido"]:.1f}')}
  {kpi_tile(f'{bp_o["corner_corto_pct"]:.0f}%', "los juega en corto", f'liga {bp_l["corner_corto_pct"]:.0f}%')}
  {kpi_tile(f'{bp_o["corner_primer_contacto_pct"]:.0f}%', "gana el primer contacto", f'liga {bp_l["corner_primer_contacto_pct"]:.0f}%')}
  {kpi_tile("51.6%", "de sus defensores marcan al hombre", "más que 99 de cada 100 DTs")}
</div>
<div class="duo-fig">
  <figure><figcaption>A dónde manda sus córners</figcaption>{chart_corner_zonas()}{legend([(N, "f-dt"), ("Liga", "f-rs")])}</figure>
  <figure><figcaption>Dónde caen (punto grande: acabó en remate)</figcaption>{chart_corner_envios()}</figure>
</div>
<div class="duo">
  <div class="card"><h4>En ataque</h4><p>Saca muchos córners y casi el doble en corto que la liga. Cuando centra, el {bp_o["corner_zonas"]["Segundo palo"]:.0f}% va al segundo palo (liga {bp_l["corner_zonas"]["Segundo palo"]:.0f}%). Gana más primeros contactos que la media, pero remata menos: el peligro depende de quién cabecea, no de la jugada.</p></div>
  <div class="card"><h4>En defensa</h4><p>Defiende al hombre más que casi todos. Cada 10 córners del rival concede {bp_d["corner_xg"] * 10:.2f} xG (liga {bp_l["corner_xg"] * 10:.2f}). Su punto débil es el área chica: ahí concede 0.052 xG por córner, contra 0.035 de la liga.</p></div>
</div>''')

    # ---------- 13. puntos
    puntos = section("puntos", "13", "¿Merecía esos puntos?", "Sus resultados se explican por su juego: 284 puntos reales y 270 merecidos", f'''
<figure><figcaption>Puntos acumulados en sus {D["partidos_total"]} partidos: reales contra los que merecía por sus ocasiones</figcaption>{chart_puntos()}
{legend([("Puntos reales", "ln-dt-sw"), ("Puntos merecidos por xG", "ln-liga-sw")])}</figure>
<div class="prose"><p>Rejugamos cada partido 5,000 veces con la calidad (xG) de cada ocasión de los dos equipos. Eso da los puntos que «merecía» por lo que generó y concedió: {S["xpts"]:.0f}, contra {S["puntos"]} reales. La diferencia es chica para {D["partidos_total"]} partidos y la línea real nunca se despega mucho de la esperada: sus resultados se explican por su juego. La simulación sirve para eso, para explicar, no para pronosticar.</p>
<p>En sus últimos {tab["n"]} partidos con América suma {res10["pts"][0]:.1f} puntos por partido, con {res10["xpts"][0]:.2f} merecidos y una diferencia de xG de {res10["xgd"][0]:+.2f} por partido.</p></div>''')

    # ---------- 14. qué hacer
    fases = PLAN_fases = json.loads((DATA / "plan.json").read_text())["fases"]
    orden = ["con", "sin", "trans", "bp", "partido"]
    acc = PLAN["acciones"]
    plan_cards = ""
    for f in orden:
        items = [a for a in acc if a["fase"] == f]
        if not items:
            continue
        lis = "".join(f'<li><b>{esc(a["titulo"].replace("{N}", N))}.</b> {esc(a["texto"].replace("{N}", N))}</li>' for a in items)
        plan_cards += f'<div class="card plan"><h4>{esc(fases[f]["es"].replace("{N}", N))}</h4><ul>{lis}</ul></div>'
    lig = "".join(f'<tr><th>{esc(corto(p["id"], p["nombre"]))}</th><td>{esc(p["pos"])}</td><td>{esc(p["club"])}</td><td class="num">{p["score"]:.1f}</td></tr>' for p in fich["liga"][:5])
    sum_ = ", ".join(corto(p["id"], p["nombre"]) for p in fich["suman"][:3])
    res_ = ", ".join(corto(p["id"], p["nombre"]) for p in fich["restan"][:2])
    hacer = section("hacer", "14", "Qué hacer con esto", "Tres decisiones para América y un plan para quien lo enfrente", f'''
<h3 class="sub">Para América</h3>
<figure><figcaption>Tablero de seguimiento: últimos {tab["n"]} partidos contra su rango normal de carrera</figcaption>{chart_tablero()}
{legend([("Últimos 10 partidos", "dot-dt"), ("Su nivel de carrera", "total-sw"), ("Rango normal", "f-band")])}
<p class="note">Valores en σ frente a la liga. Si un rasgo sale de su banda dos semanas seguidas, el equipo dejó de jugar como Almada en eso.</p></figure>
<div class="duo">
  <div class="card"><h4>Fichajes a la medida</h4><p>Jugadores de la liga cuyo propio aporte empuja los tres rasgos clave de Almada (recuperar rápido, robar arriba, conducir):</p>
  <div class="tablewrap"><table class="list"><thead><tr><th>Jugador</th><th>Pos.</th><th>Club</th><th class="num">Encaje</th></tr></thead><tbody>{lig}</tbody></table></div></div>
  <div class="card"><h4>Dentro de la plantilla</h4><p>Los que más suman a su idea: <b>{esc(sum_)}</b>. Los que menos encajan en lo que pide sin balón: {esc(res_)}. No es una lista de bajas: es a quién hay que acompañar para que cumpla esa tarea.</p>
  <h4>Qué vigilar</h4><p>Robos en campo rival, duración de la posesión rival y progresión en conducción. Son los tres rasgos más suyos y los más estables de su carrera.</p></div>
</div>
<h3 class="sub">Para el rival: cómo jugarle a Almada</h3>
<div class="plans">{plan_cards}</div>''')

    # ---------- 15. confianza
    conf = section("confianza", "15", "¿Podemos confiar en esto?", "Tres pruebas, en corto", f'''
<figure><figcaption>Escondimos sus {tr_am["partidos"]} partidos en América: ¿en qué lugar pone el modelo a Almada entre 70 técnicos?</figcaption>{chart_reconoce()}</figure>
<div class="trio">
  <div class="card"><h4>Su estilo viaja</h4><p>Repetimos la prueba con los {TR["etapas"]} cambios de club de la liga: con la huella propia, el DT real queda entre los 10 primeros el {TR["ajustado"]["top10"] * 100:.0f}% de las veces (al azar, {TR["azar"]["top10"] * 100:.0f}%).</p></div>
  <div class="card"><h4>Recupera lo que sembramos</h4><p>En datos simulados con un estilo de DT conocido, el modelo lo recupera con correlación {sint["modelo"]["media"]:.2f}; un perfil de equipo normal, {sint["ingenuo"]["media"]:.2f}. Si no hay efecto de DT, el modelo no lo inventa.</p></div>
  <div class="card"><h4>Un ajuste fino</h4><p>Los rasgos de un DT no son independientes: quien presiona alto suele defender adelantado. Un último paso de aprendizaje automático usa eso para afinar a los DTs con pocos partidos.</p></div>
</div>''')

    # ---------- 16. herramienta + límites + refs
    herr = section("app", "16", "La herramienta", "Lo mismo, para cualquiera de los 76 DTs, en una app", f'''
<div class="prose"><p>Todo este reporte sale de una app interactiva que hace lo mismo para cualquier DT de la liga, con los datos del día. Ocho vistas: Resumen, ¿DT o plantilla?, Cómo juega, Jugadores, Balón parado (con córners en 3D a partir de las fotos 360), Laboratorio (rejugar partidos o llevar al DT a otro club), Cara a cara (comparar y plan contra un rival) y Método. Tiene un asistente con IA que responde con los números del modelo y un informe PDF por vista.</p>
<p class="cta"><a href="{APP_URL}">Abrir Coach DNA</a></p></div>
<div class="duo">
  <div class="card"><h4>Límites</h4><ul>
    <li>Es una descomposición estadística, no un experimento: si un DT siempre elige jugadores de un tipo, parte de esa elección puede quedar en «plantilla».</li>
    <li>Sus 11 partidos en América son pocos; por eso los rasgos de América se leen junto con su carrera.</li>
    <li>El xG y el OBV vienen de StatsBomb; no los recalculamos.</li>
    <li>Se presentan resultados agregados, nunca los datos de eventos.</li></ul></div>
  <div class="card"><h4>Referencias</h4><ul class="refs">
    <li>Abowd, Kramarz y Margolis (1999). High wage workers and high wage firms. <i>Econometrica</i>.</li>
    <li>Muehlheusser, Schneemann, Sliwka y Wallmeier (2018). The contribution of managers to organizational success: evidence from German soccer. <i>Journal of Sports Economics</i>.</li>
    <li>Fernández-Navarro et al. (2016). Attacking and defensive styles of play in soccer. <i>Journal of Sports Sciences</i>.</li>
    <li>Sill (2010). Improved NBA adjusted +/- using regularization. MIT Sloan Sports Analytics Conference.</li>
    <li>Datos: Hudl StatsBomb, eventos y 360 de Liga MX.</li></ul></div>
</div>''')

    nav = [("resumen", "Resumen"), ("problema", "Problema"), ("marco", "Marco"), ("metodo", "Método"), ("quien", "Almada"), ("adn", "ADN"),
           ("suyo", "¿Suyo?"), ("con", "Con balón"), ("sin", "Sin balón"), ("contexto", "Contexto"), ("tiempo", "Tiempo"),
           ("jugadores", "Jugadores"), ("bp", "Balón parado"), ("puntos", "Puntos"), ("hacer", "Qué hacer"), ("confianza", "Confianza")]
    navh = '<nav class="toc" aria-label="Secciones"><div class="wrap">' + "".join(f'<a href="#{a}">{esc(b)}</a>' for a, b in nav) + "</div></nav>"
    body = hero + navh + '<main class="wrap">' + resumen + problema + marco + metodo + quien + adn + suyo + con + sin + ctx + tiempo + jugadores + bp + puntos + hacer + conf + herr + \
        '<footer><p>Coach DNA · Sebastian Dulong Salazar · Hackathon ISAC 2026 · Datos: Hudl StatsBomb. Se muestran resultados, no los datos.</p></footer></main>'
    return body


CSS = (OUT / "reporte.css").read_text()
HEAD = '<title>Coach DNA: Almada</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' \
       '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' \
       '<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">\n' \
       f"<style>{CSS}</style>\n"

if __name__ == "__main__":
    body = build()
    (OUT / "coach-dna-reporte.html").write_text(
        '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' + HEAD + "</head><body>" + body + "</body></html>")
    (OUT / "publicar.html").write_text(HEAD + body)
    print("ok", len(body) // 1024, "KB")
