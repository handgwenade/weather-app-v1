export function celsiusToFahrenheit(celsius: number) {
  return Math.round((celsius * 9) / 5 + 32);
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