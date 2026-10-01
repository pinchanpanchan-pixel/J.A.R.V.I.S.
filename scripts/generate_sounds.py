"""Genera los sonidos ORIGINALES de J.A.R.V.I.S. (síntesis propia, sin samples de terceros).
Requiere: pip install lameenc   ->   python3 scripts/generate_sounds.py"""
import math, os, struct, random
import lameenc

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "sounds")
os.makedirs(os.path.join(OUT, "alerts"), exist_ok=True)

def env(i, n, a=0.004, r=0.05):
    t = i / SR
    dur = n / SR
    e = min(1.0, t / a) if a > 0 else 1.0
    if t > dur - r:
        e *= max(0.0, (dur - t) / r)
    return e

def tone(freq_fn, dur, vol=0.5, harmonics=((1, 1.0),), a=0.004, r=0.05):
    n = int(SR * dur)
    out = []
    phase = [0.0] * len(harmonics)
    for i in range(n):
        f = freq_fn(i / SR)
        s = 0.0
        for k, (h, amp) in enumerate(harmonics):
            phase[k] += 2 * math.pi * f * h / SR
            s += amp * math.sin(phase[k])
        out.append(s * vol * env(i, n, a, r))
    return out

def silence(d):
    return [0.0] * int(SR * d)

def mix(*tracks):
    n = max(len(t) for t in tracks)
    return [sum(t[i] if i < len(t) else 0.0 for t in tracks) for i in range(n)]

def echo(x, delay=0.09, fb=0.3, taps=3):
    d = int(SR * delay)
    y = list(x) + [0.0] * d * taps
    for k in range(1, taps + 1):
        g = fb ** k
        for i in range(len(x)):
            y[i + d * k] += x[i] * g
    return y

def save(name, samples, gain=0.9):
    peak = max(1e-9, max(abs(s) for s in samples))
    pcm = b"".join(struct.pack("<h", int(max(-1, min(1, s / peak * gain)) * 32767)) for s in samples)
    enc = lameenc.Encoder()
    enc.set_bit_rate(128); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    data = enc.encode(pcm) + enc.flush()
    with open(os.path.join(OUT, name), "wb") as f:
        f.write(data)
    print(f"{name}: {len(samples)/SR:.2f}s {len(data)//1024}KB")

H = ((1, 1.0), (2, 0.25), (3, 0.08))

# Activación (v2): campanita de cristal suave, dos notas en quinta (La5 → Mi6) que se solapan,
# con parciales de campana, ataque muy corto, caída exponencial y una cola de sala discreta.
def bell(freq, dur, vol=0.5, decay=6.0):
    n = int(SR * dur)
    parts = ((1.0, 1.0), (2.0, 0.18), (2.76, 0.10), (5.4, 0.03))
    out = []
    for i in range(n):
        t = i / SR
        e = min(1.0, t / 0.006) * math.exp(-decay * t)
        out.append(vol * e * sum(a * math.sin(2 * math.pi * freq * r * t) for r, a in parts))
    return out

def room(x, taps=((0.031, 0.22), (0.053, 0.16), (0.079, 0.11), (0.113, 0.07))):
    y = list(x) + [0.0] * int(SR * 0.2)
    for d, g in taps:
        k = int(SR * d)
        for i in range(len(x)):
            y[i + k] += x[i] * g
    return y

save("activate.mp3", room(mix(bell(880.0, 0.75, 0.42, 7.0), silence(0.075) + bell(1318.5, 0.7, 0.38, 6.5))), gain=0.6)

# Desactivación: una sola nota suave que baja (Mi6 → La5), más corta y discreta.
save("deactivate.mp3", room(bell(1318.5, 0.18, 0.3, 14.0) + bell(880.0, 0.4, 0.28, 9.0)), gain=0.45)

# Alertas WorldMonitor
siren = tone(lambda t: 750 + 450 * (0.5 + 0.5 * math.sin(2 * math.pi * 1.6 * t)), 3.0, 0.7, ((1, 1), (2, 0.4), (3, 0.2)), 0.02, 0.2)
save("alerts/siren.mp3", siren)

pulse = []
for k in range(6):
    pulse += tone(lambda t: 988, 0.16, 0.7, ((1, 1), (3, 0.3)), 0.003, 0.03) + silence(0.09)
    if k % 2 == 1:
        pulse += silence(0.18)
save("alerts/pulse.mp3", pulse)

chime = []
for f in (1318.5, 1046.5, 1568.0, 2093.0):
    chime += tone(lambda t, f=f: f, 0.35, 0.5, ((1, 1), (2, 0.5), (4.2, 0.15)), 0.002, 0.3)[: int(SR * 0.22)]
save("alerts/chime.mp3", echo(chime, 0.12, 0.35, 3))

klaxon = []
for k in range(4):
    klaxon += tone(lambda t: 420 if int(t * 40) % 2 == 0 else 440, 0.45, 0.8, ((1, 1), (2, 0.8), (3, 0.6), (5, 0.4)), 0.01, 0.05) + silence(0.2)
save("alerts/klaxon.mp3", klaxon)

sonar = []
for k in range(3):
    sonar += tone(lambda t: 1480, 0.9, 0.6, ((1, 1), (2, 0.1)), 0.001, 0.8)
save("alerts/sonar.mp3", echo(sonar, 0.25, 0.3, 2))
