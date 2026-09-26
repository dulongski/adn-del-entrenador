"""Exporta la narrativa de un DT a un informe Markdown (docs/INFORME_<dt>.md).

  python -m pipeline.report.to_markdown --coach Almada
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "artifacts"


def fmt(x, d=2):
    return "—" if x is None else f"{x:+.{d}f}"


def render(art: dict, glob: dict) -> str:
    N = art["narrativa"]
    L = [f"# {art['nombre']}", "", f"*Informe generado automáticamente desde el modelo «ADN del Entrenador» — {glob['generado']}.*", ""]
    L += ["## Titular", "", f"**{N['titular']}**", ""]
    if N["principios"]:
        L += ["## Principios del entrenador", ""]
        for p in N["principios"]:
            L += [f"### {p['titulo']}", "", p["descripcion"], "", f"> {p['evidencia']}", ""]
    for s in N["secciones"]:
        L += [f"## {s['titulo']}", ""] + [f"{p}\n" for p in s["parrafos"]]
    L += ["## Anexo A — Huella completa (efecto propio del DT, σ entre equipos)", "",
          "| Familia | Indicador | Sus partidos | Liga | Efecto DT | ± EE | Percentil |", "|---|---|---:|---:|---:|---:|---:|"]
    for h in art["huella"]:
        if h["kpi"].startswith("arq_"):
            continue
        L.append(f"| {h['familia']} | {h['etiqueta']} | {h['crudo'] if h['crudo'] is None else round(h['crudo'], 2)} | {round(h['liga'], 2)} | "
                 f"{fmt(h['alpha'])} | {'' if h['se'] is None else round(h['se'], 2)} | {'' if h['pct'] is None else round(h['pct'])} |")
    L += ["", "## Anexo B — Prisma: de dónde sale cada rasgo (σ)", "",
          "| Indicador | Observado | DT | Plantilla | Club | Rival | Contexto | Residual |", "|---|---:|---:|---:|---:|---:|---:|---:|"]
    for a in art["atribucion"]:
        if a["kpi"].startswith("arq_"):
            continue
        L.append(f"| {glob['kpis'][a['kpi']]['etiqueta']} | {fmt(a['observado'])} | {fmt(a['coach'])} | {fmt(a['player'])} | {fmt(a['club'])} | {fmt(a['opp'])} | {fmt(a['ctx'])} | {fmt(a['residual'])} |")
    if art.get("transferencia"):
        L += ["", "## Anexo C — Prueba de transferencia", "", "| Etapa oculta | Partidos | Puesto ajustado | Puesto crudo | Azar | Candidatos |", "|---|---:|---:|---:|---:|---:|"]
        for t in art["transferencia"]:
            L.append(f"| {t['club']} | {t['partidos']} | {t['rank_ajustado']} | {t['rank_crudo']} | {t['rank_nulo']:.0f} | {t['n_clases']} |")
    L += ["", "---", "Metodología completa: [METODOLOGIA.md](METODOLOGIA.md). Los datos de StatsBomb son de uso exclusivo para ISAC 2026; aquí solo hay resultados agregados."]
    return "\n".join(L)


def main(coach: str):
    glob = json.load(open(ART / "global.json"))
    hits = [d for d in glob["dts"] if coach.lower() in d["nombre"].lower()]
    for d in hits:
        art = json.load(open(ART / f"dt_{d['id']}.json"))
        out = ROOT / "docs" / f"INFORME_{d['slug']}.md"
        out.write_text(render(art, glob))
        print("escrito", out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--coach", required=True)
    main(ap.parse_args().coach)
