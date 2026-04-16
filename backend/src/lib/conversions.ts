function isMissing(v: number | null | undefined): boolean {
  if (v == null) return true;
  if (!Number.isFinite(v)) return true;

  // Common MADIS/netCDF fill or missing patterns
  if (v <= -32767) return true;
  if (Math.abs(v) >= 1e20) return true;

  return false;
}

function isValidNumber(v: number | null | undefined): v is number {
  return !isMissing(v);
}

export function cleanNumber(v: number | null | undefined): number | null {
  if (!isValidNumber(v)) return null;
  return v;
}

export function kelvinToF(k: number | null | undefined): number | null {
  if (!isValidNumber(k)) return null;
  const value = k;
  return ((value - 273.15) * 9) / 5 + 32;
}

export function msToMph(v: number | null | undefined): number | null {
  if (!isValidNumber(v)) return null;
  const value = v;
  return value * 2.2369362920544;
}

export function metersToMiles(v: number | null | undefined): number | null {
  if (!isValidNumber(v)) return null;
  const value = v;
  return value / 1609.344;
}

export function unixSecondsToIso(ts: number | null | undefined): string | null {
  if (!isValidNumber(ts)) return null;
  const value = ts;
  return new Date(value * 1000).toISOString();
}

export function cleanText(v: unknown): string {
  return String(v ?? "")
    .replace(/\u0000/g, "")
    .trim();
}
