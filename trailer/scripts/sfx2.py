"""Efectos afinados a la música (Inspirational Cinematic Piano, Re♭ mayor, 70 BPM).
Notas de la pentatónica de Re♭ (Re♭ Mi♭ Fa La♭ Si♭) para que cada cosa que aparece "suene" dentro de la canción.
  note0..7  marimba/cristal suave (tarjetas, etiquetas, llamadas)
  pop0..7   gota corta con barrido hacia la nota (puntos que caen, mosaicos)
  thud      golpe grave en Re♭1 (peso: fotos, ventanas, bloques de color)
  rise      soplo que sube (antes de un cambio de pestaña)
Uso: python scripts/sfx2.py  (escribe en public/sfx/)"""
import wave
import numpy as np

SR = 44100
OUT = 'public/sfx'
rng = np.random.default_rng(7)
PENTA = [61, 63, 65, 68, 70, 73, 75, 77]          # Re♭4 … Fa5 (MIDI)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)


def save(name, y, peak=0.8):
    y = y / max(1e-9, np.abs(y).max()) * peak
    with wave.open(f'{OUT}/{name}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype(np.int16).tobytes())


def room(y, t60=0.9, mix=0.18):
    """Reverberación corta: convolución con ruido que decae."""
    n = int(SR * t60)
    ir = rng.standard_normal(n) * np.exp(-6.9 * np.arange(n) / n)
    ir = np.convolve(ir, np.ones(8) / 8, 'same')                   # más oscura
    wet = np.pad(np.convolve(y, ir), (0, 1))[: len(y) + n] / np.sqrt(n) * 3
    out = np.concatenate([y, np.zeros(n)]) * (1 - mix) + wet * mix
    return out


def mallet(f, dur=1.4):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 5.5)
    y = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 9)
         + 0.12 * np.sin(2 * np.pi * 3.99 * f * t) * np.exp(-t * 16)) * env
    att = int(SR * 0.004); y[:att] *= np.linspace(0, 1, att)
    click = rng.standard_normal(int(SR * 0.006)) * np.exp(-np.arange(int(SR * 0.006)) / 60) * 0.25
    y[: len(click)] += click
    return room(y)


def pop(f, dur=0.45):
    t = np.arange(int(SR * dur)) / SR
    sweep = f * (0.55 + 0.45 * (1 - np.exp(-t * 90)))              # sube rápido hasta la nota
    ph = 2 * np.pi * np.cumsum(sweep) / SR
    y = np.sin(ph) * np.exp(-t * 14) + 0.25 * np.sin(2 * ph) * np.exp(-t * 30)
    att = int(SR * 0.002); y[:att] *= np.linspace(0, 1, att)
    return room(y, 0.6, 0.15)


def thud():
    t = np.arange(int(SR * 0.9)) / SR
    f = hz(37) * (1 + 1.2 * np.exp(-t * 28))                        # Re♭2 con caída de tono
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * 6)
    n = rng.standard_normal(len(t)) * np.exp(-t * 60) * 0.3
    n = np.convolve(n, np.ones(30) / 30, 'same')
    return room(y + n, 0.7, 0.12)


def rise():
    t = np.arange(int(SR * 0.7)) / SR
    n = rng.standard_normal(len(t))
    out = np.zeros_like(n); a = 0.0
    for i, c in enumerate(np.linspace(0.02, 0.35, len(t))):        # filtro paso bajo que se abre
        a += c * (n[i] - a); out[i] = a
    env = (t / t[-1]) ** 2 * np.exp(-np.maximum(0, t - 0.62) * 40)
    return out * env


if __name__ == '__main__':
    for i, m in enumerate(PENTA):
        save(f'note{i}', mallet(hz(m + 12)), 0.7)
        save(f'pop{i}', pop(hz(m + 12)), 0.7)
    save('thud', thud(), 0.9)
    save('rise', rise(), 0.6)
    print('ok')
