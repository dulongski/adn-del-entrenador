"""Efectos de sonido sintetizados (sin descargar nada): tecleo, obturador de cámara, clic de ratón y barrido."""
import numpy as np, wave, os
SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sfx')
rng = np.random.default_rng(7)

def save(name, x, gain=0.9):
    x = x / (np.max(np.abs(x)) + 1e-9) * gain
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

def t(sec): return np.arange(int(SR * sec)) / SR
def env(n, attack=0.0005, decay=0.02):
    tt = np.arange(n) / SR
    return np.minimum(1, tt / attack) * np.exp(-tt / decay)
def lp(x, a):  # filtro paso-bajo de un polo
    y = np.zeros_like(x); acc = 0.0
    for i, v in enumerate(x): acc += a * (v - acc); y[i] = acc
    return y
def hp(x, a): return x - lp(x, a)
def bp(x, lo, hi): return hp(lp(x, hi), lo)

# teclas: ruido filtrado + golpecito grave; 5 variantes de tono
for k in range(5):
    n = int(SR * 0.06)
    click = bp(rng.standard_normal(n), 0.08 + 0.02 * k, 0.55) * env(n, 0.0003, 0.008 + 0.002 * k)
    thump = np.sin(2 * np.pi * (180 + 25 * k) * t(0.06)) * env(n, 0.001, 0.012) * 0.5
    save(f'key{k}.wav', click + thump, 0.6)
# barra espaciadora: más grave y larga
n = int(SR * 0.09)
save('space.wav', bp(rng.standard_normal(n), 0.04, 0.3) * env(n, 0.0005, 0.018) + np.sin(2 * np.pi * 140 * t(0.09)) * env(n, 0.001, 0.02) * 0.6, 0.6)

# obturador: clic de espejo, chasquido de cortina y clic de cierre
n = int(SR * 0.22); x = np.zeros(n)
def burst(at, dur, lo, hi, dec, amp):
    i = int(at * SR); m = int(dur * SR)
    x[i:i + m] += bp(rng.standard_normal(m), lo, hi) * env(m, 0.0002, dec) * amp
burst(0.000, 0.04, 0.05, 0.6, 0.006, 1.0)
burst(0.012, 0.08, 0.02, 0.25, 0.025, 0.55)
burst(0.105, 0.05, 0.05, 0.7, 0.007, 0.9)
save('shutter.wav', x, 0.8)

# clic de ratón: dos clics cortos (bajar / soltar)
n = int(SR * 0.09); x = np.zeros(n)
for at, a in [(0, 1.0), (0.055, 0.6)]:
    i = int(at * SR); m = int(0.012 * SR)
    x[i:i + m] += hp(rng.standard_normal(m), 0.2) * env(m, 0.0001, 0.0025) * a
save('click.wav', x, 0.7)

# barrido (whoosh): ruido con filtro que sube y baja
d = 0.6; n = int(SR * d); noise = rng.standard_normal(n)
cut = 0.02 + 0.25 * np.sin(np.linspace(0, np.pi, n)) ** 2
y = np.zeros(n); acc = 0.0
for i in range(n): acc += cut[i] * (noise[i] - acc); y[i] = acc
save('whoosh.wav', y * np.sin(np.linspace(0, np.pi, n)) ** 1.5, 0.55)

# tic de plano (para trazos/llamadas): campanita muy corta
save('tick.wav', np.sin(2 * np.pi * 2400 * t(0.05)) * env(int(SR * 0.05), 0.0005, 0.01), 0.35)
print(sorted(os.listdir(OUT)))
