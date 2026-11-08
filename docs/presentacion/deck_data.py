"""Regenera data.json de la presentación desde los datos del repo (correr con PYTHONPATH=repo y el venv de trabajo)."""
import json, os, pickle
import numpy as np, pandas as pd

R = os.path.expanduser('~/coach-dna-work/repo/')
W = R + 'web/public/data/'
H = os.path.expanduser('~/coach-dna-data/')
S = os.path.dirname(os.path.abspath(__file__)) + '/'
D = json.load(open(S + 'data.json'))
K = json.load(open(R + 'web/src/boot.json'))['global']['kpis']
d = json.load(open(W + 'dt_2947.json')); HU = {h['kpi']: h for h in d['huella']}
v = json.load(open(W + 'dt_3746.json')); HV = {h['kpi']: h for h in v['huella']}

# mapa
m = json.load(open(R + 'artifacts/mapa.json'))
D['pts'] = [[p['id'], round(p['x'], 3), round(p['y'], 3), p['grupo']] for p in m['puntos']]
D['grupos'] = [g['nombre'] for g in m['grupos']]
ga = [p for p in m['puntos'] if p['id'] == 2947][0]['grupo']
D['fam'] = dict(n=[g['n'] for g in m['grupos'] if g['id'] == ga][0], total=len(m['puntos']), nombre=[g['nombre'] for g in m['grupos'] if g['id'] == ga][0])

# campanas
dist = json.load(open(W + 'dist.json'))['kpis']
bells = []
for k, t, lo, hi, inv in [('ppda', 'Presión', 'presiona poco', 'presiona mucho', True), ('recuperaciones_altas_90', 'Robos arriba', 'roba abajo', 'roba arriba', False), ('conduccion_prog', 'Avanza conduciendo', 'avanza pasando', 'avanza conduciendo', False), ('altura_defensiva', 'Defiende lejos de su arco', 'defiende atrás', 'defiende arriba', False)]:
    a = list(dist[k]['a'].values()); a = [-x for x in a] if inv else a
    me = -HU[k]['alpha'] if inv else HU[k]['alpha']; vu = -HV[k]['alpha'] if inv else HV[k]['alpha']
    bells.append(dict(k=k, t=t, lo=lo, hi=hi, a=[round(x, 3) for x in a], me=round(me, 3), vu=round(vu, 3), above=sum(1 for x in a if x > me), n=len(a), crudo=round(HU[k]['crudo'], 1), liga=round(HU[k]['liga'], 1)))
D['bells'] = bells

# juego / jugadores del América
j = json.load(open(W + 'juego_2947.json')); jg = j['jg']; P = j['partidos']; J = jg['jugadores']; nm = dict((a, b) for a, b in J)
SH = {415002: 'Dagoberto', 26400: 'Henry Martín', 43555: 'Erick Sánchez', 28522: 'Cota', 23428: 'C. Borja', 25458: 'Veiga', 36167: 'Ramón Juárez', 337757: 'Vázquez', 30736: 'Brian Rodríguez', 29265: 'Cervantes', 30500: 'Kevin Álvarez', 50763: 'Violante', 33126: 'Israel Reyes'}
short = lambda pid: SH.get(pid) or ' '.join(nm.get(pid, str(pid)).split()[:1] + nm.get(pid, str(pid)).split()[-2:-1])
am = jg['por_club']['América']
D['form'] = [dict(id=p['id'], n=short(p['id']), pos=p['pos'], con=p['con'][:2], sin=p['sin'][:2]) for p in am['formaciones']['jugadores']]
D['cats'] = am['ataque']['cats']
jp = json.load(open(W + 'jugadores_2947.json'))['por_club']['América']
D['mins'] = [[short(p[0]), round(p[1]), p[3]] for p in jp['jugadores'][:10]]
D['form_meta'] = dict(dibujo=jp['dibujo'], n=jp['partidos_dibujo'], partidos=jp['partidos'])
SHN = {'Paul Brian Rodríguez Bravo': 'Brian Rodríguez', 'Henry Josué Martín Mex': 'Henry Martín', 'Miguel Ángel Borja Hernández': 'Miguel Borja', 'Alejandro Zendejas Saavedra': 'Zendejas', 'Israel Reyes Romero': 'Israel Reyes', 'Carlos Álvarez Rivera': 'Carlos Álvarez', 'Erick Daniel Sánchez Ocegueda': 'Erick Sánchez'}
D['ex'] = [dict(seq=e['seq'], who=[SHN.get(J[a[0]][1], ' '.join(J[a[0]][1].split()[:2])) for a in e['acc']], rival=P[e['m']][1], min=e['min'], xg=e['xg']) for e in am['ataque']['ejemplos']['recup_alta']]
EXK = ['salida', 'medio', 'recup_alta', 'contra', 'largo']
D['exs'] = []
for kk in EXK:
    for e in am['ataque']['ejemplos'].get(kk, []):
        if e.get('fin') == 'gol':
            D['exs'].append(dict(k=kk, seq=e['seq'], who=[SHN.get(J[a_[0]][1], ' '.join(J[a_[0]][1].split()[:2])) for a_ in e['acc']], rival=P[e['m']][1], min=e['min'], xg=e['xg'])); break
n = len(P); D['shots'] = [[t[0], t[1], t[5], 1 if t[6] == 0 else 0] for t in j['tiros'] if t[10] >= n - am['partidos']]

# tiempo
t = json.load(open(W + 'tiempo.json')); ks = [k if isinstance(k, str) else k['kpi'] for k in t['kpis']]; a = t['dts']['2947']
D['tl'] = dict(torneos=[x['id'] for x in a['torneos']], clubes=[x['club'] for x in a['torneos']], lines=[])
for k, lab, inv in [('recuperaciones_altas_90', 'Robo alto', 0), ('ppda', 'Presión', 1), ('conduccion_prog', 'Conducción', 0), ('altura_defensiva', 'Defensa adelantada', 0), ('posesion', 'Posesión', 0), ('salida_corta', 'Salida corta', 0)]:
    i = ks.index(k); D['tl']['lines'].append(dict(l=lab, v=[round((-1 if inv else 1) * r[i], 2) for r in a['m']]))
D['evo'] = []
for k, lab, u in [('recuperaciones_altas_90', 'Robos en campo rival por partido', ''), ('ppda', 'Pases del rival por robo (menos = más presión)', ''), ('conduccion_prog', '% del avance conduciendo', '%')]:
    i = ks.index(k); mu = K[k]['media']; sd = K[k]['sd']
    D['evo'].append(dict(k=k, l=lab, u=u, liga=round(mu, 1), v=[round(mu + r[i] * sd, 1) for r in a['m']]))
D['ident'] = a['identidad']
D['presdt'] = d['mapas']['presion']['dt']; D['presdif'] = d['mapas']['presion']['dif']
dc = json.load(open(W + 'dist.json'))['kpis']['compacidad_360']
D['comp'] = dict(a=list(dc['a'].values()), vu=dc['a']['3746'], liga=dc['liga'])

# repetición: América-Monterrey
mm = [x for x in d['simulacion']['partidos'] if x['date'] == '2026-10-11'][0]
D['replay'] = dict(rival='Monterrey', fecha='11 oct 2026', gf=mm['gf'], gc=mm['gc'], v=mm['victoria'], e=mm['empate'], p=mm['derrota'], xg=mm['xg'], xgr=mm['xg_rival'], M=mm['marcadores'])

# fichajes y encaje
f = json.load(open(W + 'plan.json'))['dts']['2947']['fichajes']
D['fich'] = [dict(n=x['nombre'], club=x['club'], s=x['score'], pos=x['pos']) for x in f['liga'][:6]]
D['suman'] = [dict(n=x['nombre'], s=x['score'], pos=x['pos']) for x in f['suman'][:4]]

# club a club (atribución por club con el ajuste en caché)
from pipeline.models import decomposition as dec
o = pickle.load(open(H + 'cache/fit_base.pkl', 'rb')); seg, F = o['seg'], o['F']
names = {'Santos Laguna': 1299, 'Pachuca': 1298, 'América': 1229}
att = {c: dec.attribution(F, seg, (seg.coach_id == 2947) & (seg.team_id == tid)) for c, tid in names.items()}
rows = []
for k, tl, p, ic, ch in [('salida_corta', 'Salida corta del portero', '% de saques de portero en corto', 'glove', 1), ('verticalidad', 'Juego directo', '% de verticalidad', 'run', 1), ('compacidad_360', 'Bloque al defender', 'Metros del primero al último jugador', 'shield', 1), ('field_tilt', 'Territorio', '% de los pases en el último tercio', 'target', 1)]:
    mu, sd = K[k]['media'], K[k]['sd']
    vals = [round(mu + att[c].loc[k, 'observado'] * sd, 1) for c in names]
    rows.append(dict(k=k, t=tl, p=p, ic=ic, ch=ch, lg=round(mu, 1), v=vals, a=round(mu + HU[k]['alpha'] * sd, 1)))
for r in rows:
    if r['k'] == 'compacidad_360':  # viene en yardas; en la presentación va en metros
        r['v'] = [round(x * 0.9144, 1) for x in r['v']]; r['lg'] = round(r['lg'] * 0.9144, 1); r['a'] = round(r['a'] * 0.9144, 1)
D['rows'] = rows

# balón parado (toda su carrera): córners a favor por zona y cómo defiende los del rival
bp = d['balon_parado']; b2 = json.load(open(W + 'bp2.json')); mk = b2['dts']['2947']['marcaje']
pz = {z['zona']: z for z in b2['dts']['2947']['vulnerable']}
D['bp'] = dict(partidos=d['partidos_total'], zonas=bp['ofensivo']['corner_zonas'], zonas_liga=bp['liga']['corner_zonas'],
    cpp=round(bp['ofensivo']['corners_por_partido'], 1), cpp_liga=round(bp['liga']['corners_por_partido'], 1),
    corto=round(bp['ofensivo']['corner_corto_pct']), corto_liga=round(bp['liga']['corner_corto_pct']),
    pegados=round(mk['pegados_pct']), pegados_liga=round(b2['liga']['marcaje']['pegados_pct']), tipo=mk['tipo'],
    pp_gana=round(pz['Primer palo']['rival_gana_pct']), pp_gana_liga=round(pz['Primer palo']['rival_gana_liga']),
    xgc=round(bp['defensivo']['corner_xg'], 3), xgc_liga=round(bp['liga']['corner_xg'], 3),
    def_zonas=[dict(z=z['zona'], g=round(z['rival_gana_pct']), gl=round(z['rival_gana_liga'])) for z in b2['dts']['2947']['vulnerable'] if z['zona'] != 'Corto'],
    banda=round(bp['ofensivo']['banda_peligrosa_por_partido'], 1), banda_liga=round(bp['liga']['banda_peligrosa_por_partido'], 1),
    goles_c=bp['ofensivo']['corner_goles'], primer=round(bp['ofensivo']['corner_primer_contacto_pct']), primer_liga=round(bp['liga']['corner_primer_contacto_pct']))

# waterfall por club: liga + plantel + club + rivales + partido (contexto y resto) + Almada = lo que se vio
WF = [('salida_corta', 'Salida corta del portero', '%', 1), ('verticalidad', 'Juego directo', '%', 1), ('field_tilt', 'Territorio', '%', 1), ('recuperaciones_altas_90', 'Robos en campo rival', 'por partido', 1)]
D['wf'] = []
for k, tl, u, _ in WF:
    mu, sd = K[k]['media'], K[k]['sd']
    cl = []
    for c in names:
        a_ = att[c].loc[k]
        comp = dict(plantel=a_.player * sd, club=a_.club * sd, rivales=a_.opp * sd, partido=(a_.ctx + a_.residual) * sd, almada=a_.coach * sd)
        cl.append(dict(n=c, comp={x: round(v, 1) for x, v in comp.items()}, obs=round(mu + a_.observado * sd, 1)))
    D['wf'].append(dict(k=k, t=tl, u=u, mu=round(mu, 1), clubs=cl))
sd = K['salida_corta']['sd']; Pa, Am = att['Pachuca'].loc['salida_corta'], att['América'].loc['salida_corta']
D['stack'] = dict(total=round((Am.observado - Pa.observado) * sd, 1), plantel=round((Am.player - Pa.player) * sd, 1), club=round((Am.club - Pa.club) * sd, 1), rivales=round((Am.opp - Pa.opp) * sd, 1), contexto=round((Am.ctx - Pa.ctx) * sd, 1), resto=round((Am.residual - Pa.residual) * sd, 1))
sdr = K['recuperaciones_altas_90']['sd']; D['robos_ame'] = round(K['recuperaciones_altas_90']['media'] + att['América'].loc['recuperaciones_altas_90', 'observado'] * sdr, 1)

# mapa de OBV del América de Almada (valor positivo generado por zona, por partido)
A = pd.read_parquet(H + 'processed/actions.parquet', columns=['type', 'x', 'y', 'obv', 'team_id', 'match_id'])
M = pd.read_parquet(H + 'processed/matches.parquet')
mids = M[((M.home_coach_id == 2947) & (M.home == 'América')) | ((M.away_coach_id == 2947) & (M.away == 'América'))].match_id
X = A[(A.team_id == 1229) & A.match_id.isin(mids) & A.obv.notna() & A.x.notna()]
ix = np.clip((X.x.values / 10).astype(int), 0, 11); iy = np.clip((X.y.values / 10).astype(int), 0, 7)
G = np.zeros((12, 8)); np.add.at(G, (ix, iy), np.clip(X.obv.values, 0, None)); G /= len(mids)
D['xtgrid'] = np.round(G, 4).tolist()
json.dump(D, open(S + 'data.json', 'w'), ensure_ascii=False)
print('partidos América', len(mids), '| fam', D['fam'], '| rows', [(r['t'], r['v'], r['a']) for r in rows], '| stack', D['stack'], '| robos', D['robos_ame'])
print('bells', [(b['k'], b['above'], b['crudo'], b['liga']) for b in bells]); print('ident', D['ident']); print('ex', [(e['rival'], e['min'], e['who']) for e in D['ex']])
print('cats', {k: (c['share'], c['goles']) for k, c in D['cats'].items()}); print('mins', D['mins'][:6]); print('fich', D['fich']); print('suman', D['suman']); print('replay', {k: D['replay'][k] for k in 'gf gc v e p xg xgr'.split()}); print('form', D['form_meta'])
print('evo', [(e['k'], e['v']) for e in D['evo']], D['tl']['torneos'])
