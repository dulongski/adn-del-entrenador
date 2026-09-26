"""Pruebas del marco analítico sobre partidos reales del caché (se omiten si no hay datos)."""
import gzip
import json

import numpy as np
import pytest

from pipeline import sb_client as sb
from pipeline.features.style_kpis import KPIS, aggregate, match_counters
from pipeline.framework import build_possessions, build_stints, flatten_events, is_progressive, starting_xis, summarize_360

files = sorted((sb.DATA / "events").glob("*.json.gz"))[:5]
pytestmark = pytest.mark.skipif(not files, reason="sin datos en caché")


def _load(f):
    raw = json.load(gzip.open(f))
    ev = flatten_events(raw)
    xis = starting_xis(raw)
    home, away = list(xis)
    return raw, ev, xis, home, away


@pytest.mark.parametrize("f", files)
def test_stints_cover_match(f):
    raw, ev, xis, h, a = _load(f)
    st = build_stints(ev, xis, h, a)
    assert abs(st.dur.sum() - ev.t.max()) < 1e-6          # los stints cubren todo el partido
    assert (st.t0.diff().dropna() > 0).all()               # sin traslapes
    assert st.home_players.map(len).between(7, 11).all()   # 11 menos expulsiones
    goals = ((ev.type == "Shot") & (ev.outcome == "Goal")).sum() + (ev.type == "Own Goal For").sum()
    last = st.iloc[-1]
    assert last.home_goals + last.away_goals <= goals


@pytest.mark.parametrize("f", files)
def test_possessions_match_statsbomb(f):
    raw, ev, *_ = _load(f)
    P = build_possessions(ev)
    sb_poss = ev[ev.team_id == ev.poss_team_id].poss.nunique()
    assert 0.8 * sb_poss <= len(P) <= sb_poss             # sólo filtramos posesiones sin acción con balón
    assert (P.dur >= 0).all()
    assert P.max_x.between(0, 120).all()
    assert not (P.fast_break & ~P.recovery_start).any()   # toda transición rápida nace de una recuperación


@pytest.mark.parametrize("f", files)
def test_kpis_in_range(f):
    raw, ev, xis, h, a = _load(f)
    st = build_stints(ev, xis, h, a)
    P = build_possessions(ev)
    s360 = summarize_360(None, ev)
    c = match_counters(ev, P, st, s360, h, a)
    k = aggregate(c, "team_id")
    assert np.allclose(k.posesion.sum(), 100)             # la posesión suma 100%
    assert np.allclose(k.field_tilt.sum(), 100)
    for col in ["salida_corta", "pase_largo", "presion_alta", "contrapresion", "contraataque"]:
        assert k[col].dropna().between(0, 100).all(), col
    assert set(k.columns) == set(KPIS)


def test_progressive_definition():
    import pandas as pd
    ev = pd.DataFrame({"type": ["Pass", "Pass", "Carry", "Pass"], "x": [40, 40, 60, 100], "y": [40, 40, 40, 40],
                       "end_x": [80, 50, 90, 110], "end_y": [40, 40, 40, 40], "outcome": [None, None, None, "Incomplete"],
                       "subtype": [None, None, None, None]})
    assert is_progressive(ev).tolist() == [True, False, True, False]
