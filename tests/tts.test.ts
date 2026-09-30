import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { pcmToWav, googleVoiceFor, ttsEngines } from "@/lib/tts/server";
import { VOICES } from "@/lib/voices";

describe("tts servidor", () => {
  it("las 4 voces son distintas en Google y en Gemini", () => {
    expect(new Set(VOICES.map((v) => v.google.name)).size).toBe(4);
    expect(new Set(VOICES.map((v) => v.gemini.voice)).size).toBe(4);
  });

  it("deduce el idioma del nombre de voz y admite sobrescribirla por .env", () => {
    expect(googleVoiceFor("young_brother").languageCode).toBe("es-US");
    process.env.VOICE_DEEP_CALM_GOOGLE = "es-ES-Chirp3-HD-Algenib";
    expect(googleVoiceFor("deep_calm")).toMatchObject({ name: "es-ES-Chirp3-HD-Algenib", languageCode: "es-ES" });
    delete process.env.VOICE_DEEP_CALM_GOOGLE;
  });

  it("orden de motores: Google, luego Gemini", () => {
    delete process.env.GOOGLE_TTS_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(ttsEngines()).toEqual([]);
    process.env.GEMINI_API_KEY = "AIza-real-gemini";
    process.env.GOOGLE_TTS_API_KEY = "AIza-real-google";
    expect(ttsEngines()).toEqual(["google", "gemini"]);
    delete process.env.GOOGLE_TTS_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it("envuelve PCM de 24 kHz en una cabecera WAV válida", () => {
    const wav = Buffer.from(pcmToWav(new Uint8Array(480), 24_000));
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt32LE(40)).toBe(480);
    expect(wav.length).toBe(524);
  });
});
