"""Mapa de estilos: PCA (2D) sobre la huella PROPIA de cada DT (α del modelo, ya sin plantilla,
club, rival ni contexto) + grupos por k-means. Lee los artefactos ya construidos.

  python -m pipeline.models.stylemap   ->  artifacts/mapa.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "artifacts"

# frases cortas para nombrar ejes y grupos: (kpi, signo) -> frase
FRASE = {
    ("posesion", 1): "posesión", ("posesion", -1): "sin balón",
    ("pase_largo", 1): "juego directo", ("pase_largo", -1): "pase corto",
    ("verticalidad", 1): "verticalidad", ("verticalidad", -1): "paciencia",
    ("salida_corta", 1): "salida corta", ("salida_corta", -1): "saque largo",
    ("ppda", -1): "presión intensa", ("ppda", 1): "bloque que espera",
    ("altura_presion", 1): "presión alta", ("altura_presion", -1): "presión baja",
    ("linea_360", 1): "línea alta", ("linea_360", -1): "línea baja",
    ("contraataque", 1): "contragolpe", ("contraataque", -1): "pausa tras recuperar",
    ("centros", 1): "centros", ("centros", -1): "juego interior",
    ("progresion_banda", 1): "juego por bandas", ("progresion_banda", -1): "juego por dentro",
    ("field_tilt", 1): "dominio territorial", ("field_tilt", -1): "repliegue",
    ("xg_90", 1): "volumen ofensivo", ("xg_contra_90", -1): "solidez",
    ("recuperaciones_altas_90", 1): "robo alto", ("contrapresion", 1): "contrapresión",
    ("tempo", 1): "ritmo alto", ("conduccion_prog", 1): "conducción", ("cambios_orientacion", 1): "cambios de juego",
    ("pases_por_posesion", 1): "elaboración", ("pases_por_posesion", -1): "ataques cortos",
    ("posesion_rival_dur", -1): "recuperación rápida", ("altura_defensiva", 1): "defensa adelantada",
    ("altura_defensiva", -1): "defensa hundida", ("compacidad_360", -1): "bloque compacto",
    ("xg_balon_parado_90", 1): "balón parado", ("intensidad_presion", 1): "presión constante",
}


def phrase(kpi, sign):
    return FRASE.get((kpi, sign))


def top_phrases(vec: pd.Series, n=2, min_abs=0.35):
    out = []
    for k in vec.abs().sort_values(ascending=False).index:
        if abs(vec[k]) < min_abs:
            break
        p = phrase(k, 1 if vec[k] > 0 else -1)
        if p and p not in out:
            out.append(p)
        if len(out) == n:
            break
    return out


def main():
    glob = json.load(open(ART / "global.json"))
    kpis = [k for k in glob["kpis"] if not k.startswith("arq_")]
    rows, meta = {}, {}
    for d in glob["dts"]:
        art = json.load(open(ART / f"dt_{d['id']}.json"))
        rows[d["id"]] = {h["kpi"]: h["alpha"] for h in art["huella"] if h["kpi"] in kpis}
        meta[d["id"]] = d
    A_all = pd.DataFrame(rows).T[kpis].fillna(0.0)
    # el mapa (estandarización, PCA y familias) se ajusta SOLO con los DTs de perfil completo;
    # los preliminares (DTs actuales con pocos partidos) se proyectan sobre ese mismo mapa
    prelim = {d["id"] for d in glob["dts"] if d.get("preliminar")}
    A = A_all.loc[[i for i in A_all.index if i not in prelim]]
    mu, sd = A.mean(), A.std(ddof=0).replace(0, 1)
    Z = (A - mu) / sd
    pca = PCA(3, random_state=0).fit(Z)   # las 2 primeras componentes son las del mapa 2D
    XYZ = pca.transform(Z)
    XY = XYZ[:, :2]
    # ejes: qué indicadores empujan cada lado
    L = pd.DataFrame(pca.components_.T, index=kpis, columns=["x", "y", "z"])
    ejes = {}
    def side(ax, sgn):
        # indicadores con mayor carga absoluta; el lado sgn los empuja en la dirección sign(carga)*sgn
        out = []
        for k in L[ax].abs().sort_values(ascending=False).index:
            p = phrase(k, int(np.sign(L[ax][k]) * sgn))
            if p and p not in out:
                out.append(p)
            if len(out) == 2:
                break
        return out
    for i, ax in enumerate(("x", "y", "z")):
        pos, neg = side(ax, 1), side(ax, -1)
        ejes[ax] = {"positivo": " · ".join(pos), "negativo": " · ".join(neg),
                    "varianza": float(pca.explained_variance_ratio_[i])}
    # grupos: k-means sobre el MISMO plano 2D que se muestra (así las regiones de color coinciden con
    # lo que se ve); K entre 4 y 6 elegido por silueta
    best = None
    for k in range(4, 7):
        km = KMeans(k, n_init=20, random_state=0).fit(XY)
        s = silhouette_score(XY, km.labels_)
        if np.bincount(km.labels_).min() < 5:  # grupos de 1-4 DTs no son una "familia" de estilo
            continue
        if best is None or s > best[0]:
            best = (s, k, km)
    sil, K, km = best
    grupos = []
    used = set()
    cents = {g: A.loc[A.index[km.labels_ == g]].mean() for g in range(K)}
    for g in range(K):
        idx = A.index[km.labels_ == g]
        cen = cents[g]
        # contraste: lo que distingue a este grupo frente al promedio de los otros grupos
        contr = cen - pd.concat([cents[o] for o in range(K) if o != g], axis=1).mean(axis=1)
        ph = [p for p in top_phrases(contr, 6, 0.1) if p not in used][:2] or top_phrases(contr, 2, 0.0)
        name = " y ".join(ph).capitalize() if ph else f"Grupo {g + 1}"
        used.update(ph)
        grupos.append({"id": g, "nombre": name, "n": int(len(idx)),
                       "rasgos": [{"kpi": k, "efecto": float(contr[k])} for k in contr.abs().sort_values(ascending=False).index[:5]]})
    pts = []
    for i, cid in enumerate(A.index):
        d = meta[cid]
        pts.append({"id": int(cid), "nombre": d["nombre"], "partidos": d["partidos"], "x": float(XY[i, 0]), "y": float(XY[i, 1]),
                    "z": float(XYZ[i, 2]), "alpha": {k: round(float(A.loc[cid, k]), 3) for k in kpis},
                    "grupo": int(km.labels_[i]), "clubes": [c["club"] for c in d["clubes"]],
                    "rasgos": top_phrases(A.loc[cid], 3, 0.3)})
    if prelim:
        Zp = (A_all.loc[sorted(prelim)] - mu) / sd
        XYZp = pca.transform(Zp)
        cen = np.array([XY[km.labels_ == g].mean(0) for g in range(K)])
        for i, cid in enumerate(sorted(prelim)):
            d = meta[cid]
            gi = int(np.argmin(((cen - XYZp[i, :2]) ** 2).sum(1)))
            pts.append({"id": int(cid), "nombre": d["nombre"], "partidos": d["partidos"], "x": float(XYZp[i, 0]), "y": float(XYZp[i, 1]),
                        "z": float(XYZp[i, 2]), "alpha": {k: round(float(A_all.loc[cid, k]), 3) for k in kpis}, "grupo": gi,
                        "clubes": [c["club"] for c in d["clubes"]], "rasgos": top_phrases(A_all.loc[cid], 3, 0.3), "preliminar": True})
    out = {"puntos": pts, "grupos": grupos, "ejes": ejes, "k": K, "silueta": float(sil),
           "varianza_total": float(pca.explained_variance_ratio_[:2].sum()),
           "varianza_total_3d": float(pca.explained_variance_ratio_.sum()), "kpis": kpis,
           "metodo": "PCA de 2 componentes sobre la huella propia de cada DT (34 indicadores, α estandarizados entre DTs); grupos por k-means en el plano 2D (K de 4 a 6 elegido por silueta)."}
    json.dump(out, open(ART / "mapa.json", "w"), ensure_ascii=False, indent=1)
    print(f"K={K} silueta={sil:.2f} varianza 2D={out['varianza_total']:.0%}")
    for g in grupos:
        print(g["nombre"], g["n"])
    print(ejes)


if __name__ == "__main__":
    main()
