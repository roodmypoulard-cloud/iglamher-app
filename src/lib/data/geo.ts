// Distance helpers. PostGIS handles this in production (geography + ST_Distance);
// this TS implementation is the documented fallback and powers unit tests.
import type { GeoPoint } from "./model";

const EARTH_RADIUS_MI = 3958.7613;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in miles between two lat/lng points (haversine). */
export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Is the viewer reachable by this professional?
 * - in_salon: viewer travels to the studio, so always "reachable" (distance is informational).
 * - mobile / both: the pro travels, so the viewer must be within the service radius.
 */
export function isReachable(
  distanceMi: number,
  locationType: "mobile" | "in_salon" | "both",
  radiusMi: number,
): boolean {
  if (locationType === "in_salon") return true;
  return distanceMi <= radiusMi;
}
