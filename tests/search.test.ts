import { describe, it, expect } from "vitest";
import { searchItems } from "@/lib/search";

const items = [
  { id: 1, title: "Cumpleaños de mamá", content: "El 12 de marzo. Le gustan las orquídeas.", tags: ["familia"] },
  { id: 2, title: "Viaje a Medellín", content: "Hotel en El Poblado, vuelo el viernes", tags: ["viajes"] },
  { id: 3, title: "Ideas negocio", content: "App de hermano mayor con IA", tags: ["trabajo"] },
];

describe("searchItems", () => {
  it("ignora acentos y mayúsculas", () => {
    expect(searchItems(items, "MEDELLIN").map((i) => i.id)).toEqual([2]);
    expect(searchItems(items, "cumpleanos mama").map((i) => i.id)).toEqual([1]);
  });
  it("prioriza etiquetas y títulos", () => {
    expect(searchItems(items, "familia")[0].id).toBe(1);
  });
  it("todos los términos deben aparecer", () => {
    expect(searchItems(items, "hotel orquideas")).toEqual([]);
  });
  it("consulta vacía devuelve todo", () => {
    expect(searchItems(items, "  ")).toHaveLength(3);
  });
});
