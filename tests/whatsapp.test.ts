import { describe, it, expect } from "vitest";
import { parseWhatsApp, groupByDay, chatNameFromFile } from "@/lib/whatsapp/parser";

const IOS = `[28/09/26, 22:10:05] Laura: ¿Mañana cenamos?
[28/09/26, 22:11:30] Pancho: Claro 😄
Paso a por ti a las 9
[29/09/26, 13:45:12] Laura: ‎<adjunto: 00000012-PHOTO-2026-09-29-13-45-12.jpg>
[29/09/26, 13:46:00] Laura: Mira qué foto`;

const ANDROID = `9/29/26, 1:45 PM - Los mensajes y las llamadas están cifrados de extremo a extremo.
9/29/26, 1:45 PM - Mamá: Hola hijo
9/29/26, 1:47 PM - Pancho: IMG-20260929-WA0001.jpg (archivo adjunto)
9/29/26, 1:48 PM - Mamá: <Multimedia omitido>
9/30/26, 12:05 AM - Mamá: ¿Ya en casa?`;

describe("WhatsApp parser", () => {
  it("formato iOS con multilínea y adjuntos", () => {
    const c = parseWhatsApp(IOS);
    expect(c.messages).toHaveLength(4);
    expect(c.participants).toEqual(["Laura", "Pancho"]);
    expect(c.messages[1].text).toBe("Claro 😄\nPaso a por ti a las 9");
    expect(c.messages[2].media).toBe("00000012-PHOTO-2026-09-29-13-45-12.jpg");
    expect(c.messages[0].date.getFullYear()).toBe(2026);
    expect(c.messages[0].date.getMonth()).toBe(8);
    expect(c.messages[0].date.getDate()).toBe(28);
    expect(c.messages[0].date.getHours()).toBe(22);
  });

  it("formato Android mm/dd con AM/PM, sistema y multimedia omitida", () => {
    const c = parseWhatsApp(ANDROID);
    expect(c.dateOrder).toBe("mdy");
    expect(c.messages[0].author).toBeNull();
    expect(c.messages[1].date.getHours()).toBe(13);
    expect(c.messages[2].media).toBe("IMG-20260929-WA0001.jpg");
    expect(c.messages[3].media).toBe("(omitido)");
    expect(c.messages[4].date.getHours()).toBe(0);
    expect(c.messages[4].date.getDate()).toBe(30);
    expect(c.participants).toEqual(["Mamá", "Pancho"]);
  });

  it("agrupa por día manteniendo fechas originales", () => {
    const blocks = groupByDay(parseWhatsApp(IOS), "Laura");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].day).toBe("2026-09-28");
    expect(blocks[0].title).toContain("WhatsApp · Laura");
    expect(blocks[0].content).toContain("22:11 Pancho: Claro");
    expect(blocks[1].media).toEqual(["00000012-PHOTO-2026-09-29-13-45-12.jpg"]);
  });

  it("trocea días enormes", () => {
    const many = Array.from({ length: 300 }, (_, i) => `[01/01/26, 10:${String(i % 60).padStart(2, "0")}:00] A: mensaje número ${i} con algo de texto`).join("\n");
    const blocks = groupByDay(parseWhatsApp(many), "A", 2000);
    expect(blocks.length).toBeGreaterThan(3);
    expect(blocks.every((b) => b.content.length <= 2100)).toBe(true);
    expect(blocks.reduce((n, b) => n + b.messages, 0)).toBe(300);
  });

  it("nombre del chat desde el archivo", () => {
    expect(chatNameFromFile("WhatsApp Chat - Laura.zip")).toBe("Laura");
    expect(chatNameFromFile("Chat de WhatsApp con Mamá.txt")).toBe("Mamá");
  });
});
