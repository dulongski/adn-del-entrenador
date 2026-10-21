"""Medios para la interfaz: logo de cada club y foto de cada DT (Wikidata/Wikimedia Commons),
más el club actual o más reciente de cada DT según los datos. Las imágenes NO se descargan:
la interfaz las enlaza desde Commons. Resultado: artifacts/media.json

  python -m pipeline.media
"""
from __future__ import annotations

import json
import time
import unicodedata
from pathlib import Path
from urllib.parse import quote

import pandas as pd
import requests
from pipeline.paths import DATA, PROC

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
UA = {"User-Agent": "coach-dna-isac-hackathon/0.1 (research; contact via github)"}

# títulos de Wikipedia en inglés de cada club (nombre StatsBomb -> página)
CLUB_PAGES = {
    "América": "Club América", "Atlante": "Atlante F.C.", "Atlas": "Atlas F.C.", "Atlético San Luis": "Atlético San Luis",
    "Cruz Azul": "Cruz Azul", "Guadalajara": "C.D. Guadalajara", "Juárez": "FC Juárez", "León": "Club León",
    "Mazatlán": "Mazatlán F.C.", "Monterrey": "C.F. Monterrey", "Necaxa": "Club Necaxa", "Pachuca": "C.F. Pachuca",
    "Puebla": "Club Puebla", "Pumas UNAM": "Club Universidad Nacional", "Querétaro": "Querétaro F.C.",
    "Santos Laguna": "Santos Laguna", "Tigres UANL": "Tigres UANL", "Tijuana": "Club Tijuana", "Toluca": "Deportivo Toluca F.C.",
}


CACHE_F = DATA / "media_cache.json"
_cache = json.load(open(CACHE_F)) if CACHE_F.exists() else {}


# escudos vigentes (SVG de en.wikipedia -> PNG transparente) cuando Wikidata tiene uno viejo o con fondo
CLUB_LOGO_OVERRIDE = {"Tigres UANL": "Tigres_UANL_logo_(crest).svg", "Santos Laguna": "Santos_Laguna_logo.svg",
                      "Pumas UNAM": "Club_Universidad_Nacional_logo.svg"}


# color principal de cada club (identidad; revisado con el usuario: Atlante rojo, Pumas oro, Juárez verde)
CLUB_COLORS = {"América": "#F2C500", "Atlante": "#C8102E", "Atlas": "#D71920", "Atlético San Luis": "#C8102E", "Cruz Azul": "#0B5FD1", "Guadalajara": "#D0103A", "Juárez": "#2FB24A", "León": "#00894F", "Mazatlán": "#6A3A9C", "Monterrey": "#2358B5", "Necaxa": "#E30613", "Pachuca": "#1F55B8", "Puebla": "#2A6FC9", "Pumas UNAM": "#C9A646", "Querétaro": "#2F5BD3", "Santos Laguna": "#00896A", "Tigres UANL": "#F5A623", "Tijuana": "#D71920", "Toluca": "#D2232A"}


def _get(url, **params):
    """GET con caché en disco y respeto del límite de peticiones (429 / Retry-After)."""
    key = url + "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    if key in _cache:
        return _cache[key]
    for i in range(8):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=30)
            if r.status_code == 200:
                out = r.json()
                _cache[key] = out
                CACHE_F.parent.mkdir(exist_ok=True)
                json.dump(_cache, open(CACHE_F, "w"))
                time.sleep(0.4)
                return out
            wait = float(r.headers.get("Retry-After", 0) or 0) or 4 * (i + 1)
        except (requests.RequestException, ValueError):
            wait = 3 * (i + 1)
        time.sleep(min(wait, 60))
    return {}


def commons_url(filename: str, width: int = 256) -> str:
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{quote(filename.replace(' ', '_'))}?width={width}"


def wikidata_claim(qid: str, prop: str) -> str | None:
    d = _get("https://www.wikidata.org/w/api.php", action="wbgetclaims", entity=qid, property=prop, format="json")
    cl = d.get("claims", {}).get(prop, [])
    # preferir el rango "preferred" (p.ej. logo vigente)
    cl = sorted(cl, key=lambda c: c.get("rank") != "preferred")
    for c in cl:
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, str):
            return v
    return None


def page_image(lang: str, title: str) -> str | None:
    """Imagen del infobox (incluye logos no libres alojados en la Wikipedia local)."""
    d = _get(f"https://{lang}.wikipedia.org/w/api.php", action="query", titles=title, prop="pageprops", redirects=1, format="json")
    for p in d.get("query", {}).get("pages", {}).values():
        return p.get("pageprops", {}).get("page_image")
    return None


def qid_of(lang: str, title: str) -> str | None:
    d = _get(f"https://{lang}.wikipedia.org/w/api.php", action="query", titles=title, prop="pageprops", redirects=1, format="json")
    for p in d.get("query", {}).get("pages", {}).values():
        return p.get("pageprops", {}).get("wikibase_item")
    return None


def _norm(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


# correcciones verificadas a mano (la búsqueda automática elegía a otra persona)
MANUAL = {"Sergio Bueno Rodríguez": ("Q551011", "Sergio Bueno"), "Gustavo Jose Da Silva Leal": ("Q120205928", "Gustavo Leal"),
          "Veljko Paunovic": ("Q612930", "Veljko Paunović"), "Martín Varini Di Zioli": ("Q106594336", "Martín Varini"),
          "Rafael Puente del Río": ("Q21573710", "Rafael Puente Jr.")}
# fotos que Wikidata no registra pero sí están (libres) en alguna Wikipedia: {nombre: (wiki, archivo)}
EXTRA_FOTOS = {"Nicolás Ricardo Larcamón": ("en", "Nicolás_Larcamón_2022.png")}

# retratos oficiales de ligamx.net verificados a mano: {nombre: {"url", "pagina"}}
_OF = ROOT / "pipeline" / "media_fotos_oficiales.json"
OFICIALES = json.load(open(_OF)) if _OF.exists() else {}

FOOT = ("fútbol", "futbol", "football", "soccer", "futbolista", "entrenador", "manager", "coach")


def find_person(name: str) -> tuple[str | None, str | None]:
    """Busca al DT en Wikidata (wbsearchentities) por nombre completo y por nombre corto;
    acepta el primer resultado cuya descripción sea futbolística y comparta apellido."""
    if name in MANUAL:
        return MANUAL[name]
    parts = name.split()
    surname = parts[-2] if len(parts) >= 4 else parts[-1] if len(parts) <= 2 else parts[2]
    queries = [name, f"{parts[0]} {surname}", " ".join(parts[:-1]) if len(parts) >= 3 else name]
    tokens = set(_norm(name).split())
    for q in dict.fromkeys(queries):
        for lang in ("es", "en"):
            d = _get("https://www.wikidata.org/w/api.php", action="wbsearchentities", search=q, language=lang, uselang=lang, limit=7, format="json")
            for h in d.get("search", []):
                desc = _norm(h.get("description", ""))
                label = _norm(h.get("label", "")).split()
                # todas las palabras de la etiqueta deben estar en el nombre completo del DT
                if len(label) >= 2 and set(label) <= tokens and any(_norm(k) in desc for k in FOOT):
                    return h["id"], h.get("label")
    return None, None


def coach_status(M: pd.DataFrame) -> dict:
    """Club más reciente de cada DT y si sigue: dirigió el último partido de ese club en la muestra."""
    rows = pd.concat([
        M[["match_id", "date", "home_id", "home", "home_coach_id"]].set_axis(["match_id", "date", "club_id", "club", "coach_id"], axis=1),
        M[["match_id", "date", "away_id", "away", "away_coach_id"]].set_axis(["match_id", "date", "club_id", "club", "coach_id"], axis=1),
    ]).dropna(subset=["coach_id"]).sort_values("date")
    last_club_match = rows.groupby("club_id").date.max()
    temporada_actual = M.season.max()
    clubes_actuales = set(M.loc[M.season == temporada_actual, "home_id"]) | set(M.loc[M.season == temporada_actual, "away_id"])
    out = {}
    for cid, g in rows.groupby("coach_id"):
        last = g.iloc[-1]
        out[int(cid)] = {"club": last.club, "club_id": int(last.club_id), "ultimo_partido": last.date,
                         # activo = dirigió el último partido de su club Y el club juega la temporada actual
                         "vigente": bool(last.date >= last_club_match[last.club_id] and last.club_id in clubes_actuales)}
    return out


def main():
    glob = json.load(open(ART / "global.json"))
    M = pd.read_parquet(PROC / "matches.parquet")
    media = {"clubes": {}, "dts": {}, "fuente": "Wikidata / Wikimedia Commons (enlazadas, no descargadas)"}
    for club, page in CLUB_PAGES.items():
        q = qid_of("en", page)
        f = wikidata_claim(q, "P154") if q else None
        logo = commons_url(f, 128) if f else None
        if club in CLUB_LOGO_OVERRIDE:
            logo = f"https://en.wikipedia.org/wiki/Special:FilePath/{quote(CLUB_LOGO_OVERRIDE[club])}?width=256"
        if not logo:
            pi = page_image("en", page)
            logo = f"https://en.wikipedia.org/wiki/Special:FilePath/{quote(pi)}?width=128" if pi else None
        media["clubes"][club] = {"logo": logo, "wikidata": q, "color": CLUB_COLORS.get(club)}
        print(club, q, f)
        time.sleep(0.2)
    status = coach_status(M)
    for d in glob["dts"]:
        q, title = find_person(d["nombre"])
        img = wikidata_claim(q, "P18") if q else None
        foto = commons_url(img, 300) if img else None
        if not foto and d["nombre"] in EXTRA_FOTOS:
            w, f = EXTRA_FOTOS[d["nombre"]]
            foto = f"https://{w}.wikipedia.org/wiki/Special:FilePath/{quote(f)}?width=300"
        oficial = OFICIALES.get(d["nombre"])  # retrato oficial de ligamx.net (preferido)
        if oficial:
            foto = oficial["url"]
        media["dts"][str(d["id"])] = {"foto": foto, "foto_fuente": oficial["pagina"] if oficial else None, "etiqueta_wikidata": title, "wikidata": q,
                                     **status.get(d["id"], {})}
        print(d["nombre"], "->", title, bool(img))
    json.dump(media, open(ART / "media.json", "w"), ensure_ascii=False, indent=1)




def download_local(out_dir: Path = ROOT / "web" / "public" / "media"):
    """Guarda logos y fotos en web/public/media para que la interfaz funcione sin internet.
    media.json conserva la URL original (campo *_origen) y apunta a la copia local."""
    import mimetypes
    media = json.load(open(ART / "media.json"))
    ok = fail = 0
    for kind, key, field, width in (("clubes", "clubes", "logo", 128), ("dts", "dts", "foto", 300)):
        (out_dir / kind).mkdir(parents=True, exist_ok=True)
        for name, v in media[key].items():
            url = v.get(f"{field}_origen") or v.get(field)
            if not url or not url.startswith("http"):
                continue
            for i in range(6):
                try:
                    r = requests.get(url, headers=UA, timeout=60)
                    if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/"):
                        ext = mimetypes.guess_extension(r.headers["content-type"].split(";")[0]) or ".png"
                        nombre = next((x["nombre"] for x in json.load(open(ART / "global.json"))["dts"] if str(x["id"]) == name), name) if kind == "dts" else name
                        slug = "".join(c if c.isalnum() else "-" for c in _norm(nombre)).strip("-")
                        f = out_dir / kind / f"{slug}{ext}"
                        f.write_bytes(r.content)
                        try:  # retratos a 400 px como máximo (la web queda ligera)
                            from PIL import Image
                            im = Image.open(f)
                            if max(im.size) > 400:
                                im.thumbnail((400, 400)); im.save(f, quality=85) if ext in (".jpg", ".jpeg") else im.save(f)
                        except Exception:
                            pass
                        v[f"{field}_origen"] = url
                        v[field] = f"/media/{kind}/{f.name}"
                        ok += 1
                        break
                    wait = float(r.headers.get("Retry-After", 0) or 0) or 3 * (i + 1)
                except requests.RequestException:
                    wait = 3 * (i + 1)
                time.sleep(min(wait, 30))
            else:
                fail += 1
                print("no se pudo descargar", name, url)
            time.sleep(0.3)
    # fotos agregadas a mano: web/public/media/manual/<slug-del-nombre-completo>.(jpg|png|webp)
    glob = json.load(open(ART / "global.json"))
    manual = out_dir / "manual"
    manual.mkdir(parents=True, exist_ok=True)
    for d in glob["dts"]:
        slug = "".join(c if c.isalnum() else "-" for c in _norm(d["nombre"])).strip("-")
        for ext in (".jpg", ".jpeg", ".png", ".webp"):
            if (manual / f"{slug}{ext}").exists():
                media["dts"][str(d["id"])]["foto"] = f"/media/manual/{slug}{ext}"
                print("foto manual:", d["nombre"])
    json.dump(media, open(ART / "media.json", "w"), ensure_ascii=False, indent=1)
    print(f"descargadas {ok}, fallidas {fail}")


if __name__ == "__main__":
    import sys
    if "--solo-descarga" not in sys.argv:
        main()
    download_local()
