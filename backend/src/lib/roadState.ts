export const ROAD_STATE_MAP: Record<number, string> = {
  0: "No report",
  1: "Dry",
  2: "Moist",
  3: "Moist and chemically treated",
  4: "Wet",
  5: "Wet and chemically treated",
  6: "Ice",
  7: "Frost",
  8: "Snow",
  9: "Snow/Ice Watch",
  10: "Snow/Ice Warning",
  11: "Wet Above Freezing",
  12: "Wet Below Freezing",
  13: "Absorption",
  14: "Absorption at Dewpoint",
  15: "Dew",
  16: "Black Ice Warning",
  17: "Other",
  18: "Slush",
};

export function roadStateLabel(code: number | null | undefined): string | null {
  if (code == null || Number.isNaN(code)) return null;
  return ROAD_STATE_MAP[code] ?? `Unknown (${code})`;
}
