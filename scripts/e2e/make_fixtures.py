"""WAVs de prueba para el micrófono falso de Chromium (--use-file-for-fake-audio-capture)."""
import math, os, random, struct, wave
SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "fixtures")
os.makedirs(OUT, exist_ok=True)

def write(name, samples):
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples))

random.seed(7)
def noise(sec, amp=0.004):
    return [random.uniform(-amp, amp) for _ in range(int(SR * sec))]

def clap():
    # transitorio: ruido blanco con ataque instantáneo y caída exponencial (~40 ms)
    n = int(SR * 0.06)
    return [random.uniform(-1, 1) * 0.95 * math.exp(-i / (SR * 0.008)) for i in range(n)]

# 2 s de silencio, palmada, 350 ms, palmada, 4 s de silencio (el archivo se repite en bucle)
claps = noise(2.0) + clap() + noise(0.35) + clap() + noise(4.0)
write("claps.wav", claps)

# "voz": vocales sintéticas moduladas (energía de habla) 1.5 s + silencio
def vowel(sec, f0=140):
    n = int(SR * sec)
    return [0.25 * (math.sin(2 * math.pi * f0 * i / SR) + 0.5 * math.sin(2 * math.pi * 3 * f0 * i / SR)) * (0.6 + 0.4 * math.sin(2 * math.pi * 4 * i / SR)) for i in range(n)]
speech = noise(0.5) + vowel(1.5) + noise(3.0)
write("speech.wav", speech)
print("fixtures ok")
