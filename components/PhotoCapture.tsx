"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useSync } from "@/components/providers/SyncProvider";
import { useProfile } from "@/hooks/useProfile";
import { apiJson } from "@/lib/api";
import { isMockMode } from "@/lib/env";
import { uuid } from "@/lib/ids";
import { getSupabaseBrowser } from "@/lib/supabase/client";

async function resize(file: File, max: number, quality: number): Promise<{ blob: Blob; dataUrl: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const blob = await (await fetch(dataUrl)).blob();
  return { blob, dataUrl };
}

/** Botón de memoria visual: foto → EXIF → Claude Vision → recuerdo. */
export function PhotoCapture({ autoOpen = false }: { autoOpen?: boolean }) {
  const { engine, kvFactory } = useSync();
  const { user, features } = useProfile();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpen && features.vision) input.current?.click();
  }, [autoOpen, features.vision]);

  const handle = async (file: File) => {
    if (!engine || !user) return;
    setBusy(true);
    setMsg(null);
    try {
      const exifr = (await import("exifr")).default;
      const exif = (await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "Make", "Model", "latitude", "longitude"] }).catch(() => null)) as {
        DateTimeOriginal?: Date;
        latitude?: number;
        longitude?: number;
        Make?: string;
        Model?: string;
      } | null;
      const big = await resize(file, 1568, 0.85);
      const thumb = await resize(file, 240, 0.6);
      const photoId = uuid();
      const path = `${user.id}/photos/${photoId}.jpg`;
      if (isMockMode) await kvFactory?.("photo-files").set(path, big.blob);
      else await getSupabaseBrowser()!.storage.from("photos").upload(path, big.blob, { contentType: "image/jpeg", upsert: true });

      const takenAt = exif?.DateTimeOriginal ? new Date(exif.DateTimeOriginal) : null;
      const context = [takenAt ? `tomada el ${takenAt.toLocaleString("es-ES")}` : "", exif?.latitude ? `en ${exif.latitude.toFixed(4)}, ${exif.longitude?.toFixed(4)}` : ""].filter(Boolean).join(" ");
      const keys = isMockMode ? (await engine.list("ai_provider_keys")).map((k) => ({ id: k.id, provider: k.provider, key_ciphertext: k.key_ciphertext, enabled: k.enabled })) : undefined;
      const { result } = await apiJson<{ result: { title: string; description: string; ocr_text: string; objects: string[]; faces_count: number; tags: string[] } }>("/api/vision", {
        method: "POST",
        body: JSON.stringify({ image: big.dataUrl.split(",")[1], mediaType: "image/jpeg", context, keys }),
      });
      const block = await engine.insert("memory_blocks", {
        title: result.title,
        content: [result.description, result.ocr_text ? `Texto: ${result.ocr_text}` : ""].filter(Boolean).join("\n\n"),
        tags: Array.from(new Set(["foto", ...result.tags])).slice(0, 8),
        source: "vision",
        original_date: takenAt?.toISOString() ?? null,
        metadata: { photo_id: photoId, storage_path: path, thumbnail: thumb.dataUrl, objects: result.objects, faces: result.faces_count },
      });
      await engine.insert("photos", {
        id: photoId,
        storage_path: path,
        description: result.description,
        ocr_text: result.ocr_text || null,
        objects: result.objects,
        faces_count: result.faces_count,
        exif: exif ? { make: exif.Make ?? null, model: exif.Model ?? null, taken_at: takenAt?.toISOString() ?? null } : {},
        lat: exif?.latitude ?? null,
        lng: exif?.longitude ?? null,
        taken_at: takenAt?.toISOString() ?? null,
        memory_block_id: block.id,
        status: "done",
      });
      setMsg(`Guardada: «${result.title}».`);
    } catch (e) {
      setMsg(e instanceof Error && e.message === "plan_required" ? "La memoria visual es de Pro, hermano." : "No he podido analizar la foto. Prueba otra vez.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <button onClick={() => input.current?.click()} disabled={busy} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-arc" aria-label="Memoria visual: añadir foto">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void handle(e.target.files[0])} aria-label="Foto" data-testid="photo-input" />
      {msg && (
        <div className="fixed inset-x-4 top-20 z-40 mx-auto max-w-sm rounded-full bg-navy-700 px-4 py-2 text-center text-sm" role="status" onAnimationEnd={() => undefined}>
          {msg}
        </div>
      )}
    </>
  );
}
