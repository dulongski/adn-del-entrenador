"""Distribuciones entre DTs para la web: para cada indicador, el efecto propio (α), su error y el valor
crudo en sus partidos de TODOS los DTs, más el efecto neto de sus cambios. Sólo reúne lo que ya está en
artifacts/dt_*.json (no ajusta nada).

  python -m pipeline.dist   ->  web/public/data/dist.json
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
OUT = ROOT / "web" / "public" / "data" / "dist.json"


def main():
    glob = json.load(open(ART / "global.json"))
    kpis: dict = {}
    cambios: dict = {}
    for d in glob["dts"]:
        art = json.load(open(ART / f"dt_{d['id']}.json"))
        cid = str(d["id"])
        for h in art["huella"]:
            k = kpis.setdefault(h["kpi"], {"etiqueta": h["etiqueta"], "familia": h["familia"], "liga": h["liga"], "a": {}, "se": {}, "v": {}})
            k["a"][cid] = round(h["alpha"], 4)
            k["se"][cid] = round(h["se"], 4)
            if h.get("crudo") is not None:
                k["v"][cid] = round(h["crudo"], 4)
        for c in art.get("impacto_cambios") or []:
            cambios.setdefault(c["kpi"], {})[cid] = round(c["neto"], 4)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    json.dump({"kpis": kpis, "cambios": cambios}, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"dist.json: {OUT.stat().st_size / 1024:.0f} KB, {len(kpis)} indicadores, {len(glob['dts'])} DTs")


if __name__ == "__main__":
    main()
