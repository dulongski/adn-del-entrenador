"""Separa el nombre completo de cada DT en nombres y apellidos (artifacts/nombres.json).

Reglas: partículas (de, del, la, da, di, san…) se unen al apellido que sigue; 2 palabras =
nombre + apellido; 4+ = últimas 2 son apellidos; 3 = se desempata con la etiqueta de Wikidata
(«Nicolás Larcamón» => Larcamón es apellido). Lo que no se puede resolver queda marcado como
dudoso y se corrige a mano en config/nombres_manual.json.

  python -m pipeline.names
"""
from __future__ import annotations

import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
MANUAL = ROOT / "config" / "nombres_manual.json"
PARTICULAS = {"de", "del", "la", "las", "los", "da", "das", "do", "dos", "di", "san", "van", "von"}


def _n(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def tokens(name: str) -> list[str]:
    out, buf = [], []
    for w in name.split():
        buf.append(w)
        if _n(w) not in PARTICULAS:
            out.append(" ".join(buf)); buf = []
    if buf:
        out.append(" ".join(buf))
    return out


def split(name: str, label: str | None) -> tuple[list[str], list[str], bool]:
    t = tokens(name)
    if len(t) <= 2:
        return t[:1], t[1:], True
    if len(t) >= 4:
        return t[:-2], t[-2:], True
    # 3 palabras: ¿"nombre nombre apellido" o "nombre apellido apellido"?
    if label:
        lt = tokens(label)
        if len(lt) == 2:  # sólo etiquetas "Nombre Apellido" desempatan
            last = _n(lt[-1])
            if last == _n(t[1]):
                return t[:1], t[1:], True
            if last == _n(t[2]):
                return t[:2], t[2:], True
    return t[:1], t[1:], False  # lo más común en español; marcado como dudoso


def main():
    glob = json.load(open(ART / "global.json"))
    media = json.load(open(ART / "media.json"))
    manual = json.load(open(MANUAL)) if MANUAL.exists() else {}
    out = {}
    for d in glob["dts"]:
        name = d["nombre"]
        label = media["dts"].get(str(d["id"]), {}).get("etiqueta_wikidata")
        if name in manual:
            nombres, apellidos, ok = manual[name]["nombres"], manual[name]["apellidos"], True
        else:
            nom, ape, ok = split(name, label)
            nombres, apellidos = " ".join(nom), " ".join(ape)
        corto = f"{nombres.split()[0]} {tokens(apellidos)[0]}"
        # nombre corto = como se le conoce (etiqueta de Wikidata «Nombre Apellido»), con los acentos del nombre oficial
        if label and len(tokens(label)) == 2:
            official = {_n(w): w for w in name.split()}
            corto = " ".join(" ".join(official.get(_n(w), w) for w in tk.split()) for tk in tokens(label))
        out[str(d["id"])] = {"nombres": nombres, "apellidos": apellidos, "corto": corto, "seguro": ok}
    json.dump(out, open(ART / "nombres.json", "w"), ensure_ascii=False, indent=1)
    for v in out.values():
        print(("   " if v["seguro"] else "?? ") + f"{v['nombres']} | {v['apellidos']}   (corto: {v['corto']})")


if __name__ == "__main__":
    main()
