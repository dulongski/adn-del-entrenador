"""Exporta los artefactos para una web 100% estática (sin API):

  web/src/boot.json          global + mapa + media, empaquetado DENTRO del JS -> la portada carga al instante
  web/public/data/dt_<id>.json   perfil de cada DT (se descarga al abrirlo)
  web/public/data/sim_<id>.json  tiros por partido para rejugar partidos en el navegador

  python -m pipeline.export_static
Después: cd web && npm run build  ->  web/dist es desplegable tal cual (GitHub Pages, Netlify, Vercel...).
Sólo resultados agregados: el mismo contenido que ya muestra la interfaz.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
WEB = ROOT / "web"


def apodos_jugadores() -> dict:
    """Apodo oficial de cada jugador (player_nickname de las alineaciones StatsBomb), p.ej. «Alan Cervantes»."""
    import gzip
    f = ROOT / "data" / "processed" / "apodos.json"
    if f.exists():
        return json.load(open(f))
    out = {}
    for g in (ROOT / "data" / "lineups").glob("*.json.gz"):
        for team in json.load(gzip.open(g)):
            for p in team["lineup"]:
                if p.get("player_nickname"):
                    out[str(p["player_id"])] = p["player_nickname"]
    json.dump(out, open(f, "w"), ensure_ascii=False)
    return out


def main():
    glob = json.load(open(ART / "global.json"))
    mapa = json.load(open(ART / "mapa.json"))
    media = json.load(open(ART / "media.json"))
    nombres = json.load(open(ART / "nombres.json")) if (ART / "nombres.json").exists() else {}
    apodos = apodos_jugadores()
    json.dump({"global": glob, "mapa": mapa, "media": media, "nombres": nombres, "apodos": apodos}, open(WEB / "src" / "boot.json", "w"), ensure_ascii=False, separators=(",", ":"))

    out = WEB / "public" / "data"
    out.mkdir(parents=True, exist_ok=True)
    shots = pd.read_parquet(ROOT / "data" / "processed" / "shots.parquet")
    by_match = dict(tuple(shots.groupby("match_id")))
    # once inicial de cada partido (ambos equipos) para el partido animado
    L = pd.read_parquet(ROOT / "data" / "processed" / "lineups.parquet")
    L = L[(L.period == 1) & (L.ts == 0)]
    nombres = pd.read_parquet(ROOT / "data" / "processed" / "players.parquet").set_index("player_id").player.to_dict()
    xi_by = {k: [[int(r.player_id), r.position, apodos.get(str(int(r.player_id))) or nombres.get(r.player_id, "")] for r in g.itertuples()]
             for k, g in L.groupby(["match_id", "team_id"])}
    M = pd.read_parquet(ROOT / "data" / "processed" / "matches.parquet").set_index("match_id")
    for d in glob["dts"]:
        src = ART / f"dt_{d['id']}.json"
        shutil.copyfile(src, out / src.name)
        art = json.load(open(src))
        sims = {}
        for p in art["simulacion"]["partidos"]:
            s = by_match.get(p["match_id"])
            if s is None:
                continue
            # equipo del DT = el que suma el xG registrado en el artefacto
            teams = s.team_id.unique().tolist()
            own = min(teams, key=lambda t: abs(s[s.team_id == t].xg.sum() - p["xg"]))
            mrow = M.loc[p["match_id"]]
            own_team = mrow.home_id if mrow.home_coach_id == d["id"] else mrow.away_id
            opp_team = mrow.away_id if own_team == mrow.home_id else mrow.home_id
            sims[p["match_id"]] = {
                "t": [[round(float(r.x), 1), round(float(r.y), 1), round(float(r.xg), 4), int(r.team_id == own_team),
                       int(r.outcome == "Goal"), int(r.minute), int(r.poss)] for r in s.itertuples() if r.xg == r.xg],
                "xi": xi_by.get((p["match_id"], own_team), []), "xr": xi_by.get((p["match_id"], opp_team), []),
            }
        json.dump(sims, open(out / f"sim_{d['id']}.json", "w"), separators=(",", ":"))
    print(f"exportados {len(glob['dts'])} DTs a {out} y boot.json ({(WEB / 'src' / 'boot.json').stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
