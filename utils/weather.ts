export function celsiusToFahrenheit(celsius: number) {
  return Math.round((celsius * 9) / 5 + 32);
}

const MIN_PLAUSIBLE_TEMPERATURE_F = -80;
const MAX_PLAUSIBLE_TEMPERATURE_F = 140;

export function isPlausibleTemperatureF(
  value: number | null | undefined,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_PLAUSIBLE_TEMPERATURE_F &&
    value <= MAX_PLAUSIBLE_TEMPERATURE_F
  );
}

export function normalizeTemperatureF(
  value: number | null | undefined,
): number | null {
  return isPlausibleTemperatureF(value) ? value : null;
}

export function metersPerSecondToMph(metersPerSecond: number) {
  return Math.round(metersPerSecond * 2.237);
}

export function getFreezeRiskLabel(lowF: number) {
  if (lowF <= 32) {
    return 'High';
  }

  if (lowF <= 36) {
    return 'Moderate';
  }

  return 'Low';
}

export function getRoadCautionMessage(temperatureF: number, windSpeedMph: number) {
  if (temperatureF <= 32) {
    return 'Use caution: freezing temperatures';
  }

  if (temperatureF <= 40) {
    return 'Use caution: temps near freezing';
  }

  if (windSpeedMph >= 25) {
    return 'Use caution: windy conditions';
  }

  return 'Road conditions look okay right now';
}
