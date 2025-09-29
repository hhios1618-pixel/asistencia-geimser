const EARTH_RADIUS_M = 6371000;

type Coordinates = {
  lat: number;
  lng: number;
};

type GeofenceCheck = {
  site: Coordinates;
  radius: number;
  point: Coordinates | null;
};

export type GeofenceStatus = 'ok' | 'warn' | 'fail';

const toRadians = (value: number): number => (value * Math.PI) / 180;

export const haversineMeters = (a: Coordinates, b: Coordinates): number => {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

export const isInsideRadius = (check: GeofenceCheck): boolean => {
  if (!check.point) {
    return false;
  }
  const distance = haversineMeters(check.site, check.point);
  return distance <= check.radius;
};

export const getGeofenceStatus = ({ site, point, radius }: GeofenceCheck): {
  status: GeofenceStatus;
  distance: number | null;
} => {
  if (!point) {
    return { status: 'fail', distance: null };
  }
  const distance = haversineMeters(site, point);
  if (distance <= radius) {
    return { status: 'ok', distance };
  }
  if (distance <= radius * 1.15) {
    return { status: 'warn', distance };
  }
  return { status: 'fail', distance };
};

