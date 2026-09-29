import { describe, it, expect } from "vitest";
import { parseMapsLink, haversineKm, isShortMapsLink } from "@/lib/geo";
import { findBundledCity, nearestBundledPlace, guessTimezone, bundledRegions } from "@/lib/geoRegions";

describe("parseMapsLink", () => {
  it.each([
    ["https://www.google.com/maps/place/Puerta+del+Sol/@40.4168,-3.7038,17z/data=!3m1!4b1", 40.4168, -3.7038],
    ["https://www.google.com/maps/place/X/@40.1,-3.1,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d40.4169!4d-3.7035", 40.4169, -3.7035],
    ["https://maps.google.com/?q=6.2442,-75.5812", 6.2442, -75.5812],
    ["https://www.google.com/maps?ll=19.4326,-99.1332&z=12", 19.4326, -99.1332],
    ["https://www.google.com/maps/search/?api=1&query=-34.6037,-58.3816", -34.6037, -58.3816],
    ["https://www.google.com/maps/search/4.7110,+-74.0721", 4.711, -74.0721],
    ["https://www.google.com/maps/dir/?api=1&destination=10.3910%2C-75.4794", 10.391, -75.4794],
    ["geo:37.3891,-5.9845", 37.3891, -5.9845],
    ["  40.4168, -3.7038 ", 40.4168, -3.7038],
  ])("%s", (url, lat, lng) => {
    expect(parseMapsLink(url)).toEqual({ lat, lng });
  });

  it("rechaza enlaces sin coordenadas o inválidos", () => {
    expect(parseMapsLink("https://www.google.com/maps/place/Madrid")).toBeNull();
    expect(parseMapsLink("https://maps.google.com/?q=200,10")).toBeNull();
    expect(parseMapsLink("")).toBeNull();
  });

  it("detecta enlaces cortos", () => {
    expect(isShortMapsLink("https://maps.app.goo.gl/abc123")).toBe(true);
    expect(isShortMapsLink("https://www.google.com/maps/@1,2,3z")).toBe(false);
  });
});

describe("geo", () => {
  it("haversine Madrid-Barcelona ~505 km", () => {
    const d = haversineKm({ lat: 40.4168, lng: -3.7038 }, { lat: 41.3874, lng: 2.1686 });
    expect(d).toBeGreaterThan(495);
    expect(d).toBeLessThan(515);
  });
  it("regiones y ciudades incluidas", () => {
    expect(bundledRegions("CO")).toContain("Antioquia");
    expect(findBundledCity("CO", "Antioquia", "medellin")).toEqual({ lat: 6.2442, lng: -75.5812 });
    expect(findBundledCity("ES", "Comunidad de Madrid", "")).toEqual({ lat: 40.4168, lng: -3.7038 });
  });
  it("lugar más cercano y zona horaria", () => {
    const p = nearestBundledPlace({ lat: 40.42, lng: -3.7 });
    expect(p?.city).toBe("Madrid");
    expect(p?.timezone).toBe("Europe/Madrid");
    expect(guessTimezone("US", 34.05, -118.24)).toBe("America/Los_Angeles");
    expect(guessTimezone("US", 40.71, -74.0)).toBe("America/New_York");
  });
});
