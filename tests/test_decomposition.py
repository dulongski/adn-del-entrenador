"""Prueba sintética: plantamos un efecto DT conocido en datos donde la calidad/estilo de los
jugadores está correlacionada con el DT (el problema de confusión) y verificamos que la
descomposición recupera el efecto DT mejor que el promedio ingenuo por DT."""
import numpy as np
import pandas as pd

from pipeline.models.decomposition import DEFAULT_LAMBDA, _solve, build_design


def simulate(seed=0, n_clubs=10, n_seasons=4, matches_per_season=17, segs=8):
    rng = np.random.default_rng(seed)
    coaches = {}
    cid = 0
    # cada club tiene 2 etapas de DT; algunos DTs se mueven entre clubes
    plan = {}
    for c in range(n_clubs):
        plan[c] = []
        for s in range(n_seasons):
            if s % 2 == 0:
                cid += 1
            plan[c].append(cid)
    # movilidad: el DT del club c en temporadas 2-3 fue el de club c-1 en temporadas 0-1
    for c in range(1, n_clubs, 2):
        plan[c][2] = plan[c][3] = plan[c - 1][0]
    all_coaches = sorted({x for v in plan.values() for x in v})
    alpha = {k: rng.normal(0, 1) for k in all_coaches}
    club_fx = {c: rng.normal(0, 0.7) for c in range(n_clubs)}
    # jugadores: plantilla por club que rota 30% por temporada; el DT ficha jugadores
    # "a su imagen": beta correlacionada con alpha del DT (confusión)
    pid = 0
    squads, beta = {}, {}
    for c in range(n_clubs):
        squad = []
        for s in range(n_seasons):
            coach = plan[c][s]
            keep = squad[: int(len(squad) * 0.7)] if squad else []
            new = []
            while len(keep) + len(new) < 18:
                pid += 1
                beta[pid] = 0.8 * alpha[coach] + rng.normal(0, 0.5)
                new.append(pid)
            squad = keep + new
            rng.shuffle(squad)
            squads[(c, s)] = list(squad)
    rows = []
    mid = 0
    for s in range(n_seasons):
        for c in range(n_clubs):
            for m in range(matches_per_season):
                mid += 1
                sq = squads[(c, s)]
                xi = list(rng.choice(sq, 11, replace=False))
                bench = [p for p in sq if p not in xi]
                opp = int(rng.integers(0, n_clubs))
                for g in range(segs):
                    if g >= 5 and rng.random() < 0.5 and bench:
                        xi[int(rng.integers(0, 11))] = bench.pop()
                    expo = {int(p): 1.0 for p in xi}
                    y = alpha[plan[c][s]] + club_fx[c] + np.mean([beta[p] for p in xi]) * 1.5 + rng.normal(0, 1.0)
                    rows.append({"match_id": mid, "seg": g, "coach_id": plan[c][s], "club_id": c,
                                 "opp_key": f"{opp}_{s}", "exposure": expo, "dur": 600.0, "home": m % 2,
                                 "w_losing": 0.0, "w_winning": 0.0, "w_manadv": 0.0, "w_tmid": 2700.0, "y": y})
    return pd.DataFrame(rows), alpha


def test_recovers_coach_effect_better_than_naive():
    seg, alpha = simulate()
    D = build_design(seg, min_player_minutes=0)
    lam = dict(DEFAULT_LAMBDA)
    lam_vec = np.array([lam[b] for b in D.block_of])
    lam_vec[D.index[("ctx", "intercept")]] = 1e-6
    beta = _solve(D.X, seg.y.values, np.ones(len(seg)), lam_vec)
    est = {c[1]: beta[j] for j, c in enumerate(D.cols) if c[0] == "coach"}
    truth = pd.Series(alpha)
    est = pd.Series(est).reindex(truth.index)
    naive = seg.groupby("coach_id").y.mean().reindex(truth.index)
    # el promedio ingenuo mezcla DT + jugadores + club: su escala está inflada
    # medimos error tras centrar (los efectos son relativos)
    err_model = np.sqrt((((est - est.mean()) - (truth - truth.mean())) ** 2).mean())
    err_naive = np.sqrt((((naive - naive.mean()) - (truth - truth.mean())) ** 2).mean())
    corr = np.corrcoef(est, truth)[0, 1]
    print(f"corr={corr:.2f} rmse_model={err_model:.2f} rmse_naive={err_naive:.2f}")
    assert corr > 0.7
    assert err_model < err_naive
