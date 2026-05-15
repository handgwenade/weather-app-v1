export type ForecastChartMetric =
  | "temperature"
  | "precipitationProbability"
  | "windSpeed";

export type ForecastChartUnits = {
  temperature: "F" | "C";
  windSpeed: "mph";
};

export type ForecastChartHour = {
  time: string;
  temperature?: number | null;
  windSpeed?: number | null;
  windGust?: number | null;
  precipitationProbability?: number | null;
  weatherCode?: number | null;
};

export type ForecastChartValuePoint = {
  index: number;
  time: string;
  value: number;
};

export function getForecastMetricValue(
  hour: ForecastChartHour,
  metric: ForecastChartMetric,
) {
  const value = hour[metric];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getValidForecastChartPoints(
  hourly: ForecastChartHour[],
  metric: ForecastChartMetric,
) {
  return hourly
    .map((hour, index) => {
      const value = getForecastMetricValue(hour, metric);

      if (value === null) {
        return null;
      }

      return {
        index,
        time: hour.time,
        value,
      };
    })
    .filter(
      (point): point is ForecastChartValuePoint => point !== null,
    );
}

export function getForecastYDomain(
  values: number[],
  metric: ForecastChartMetric,
) {
  if (metric === "precipitationProbability") {
    return [0, 100] as const;
  }

  if (values.length === 0) {
    return [0, 1] as const;
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const padding = Math.max(metric === "temperature" ? 2 : 3, range * 0.16);

  if (range === 0) {
    return [minValue - padding, maxValue + padding] as const;
  }

  return [minValue - padding, maxValue + padding] as const;
}

export function getNearestForecastPointIndex(
  rawIndex: number,
  points: ForecastChartValuePoint[],
) {
  if (points.length === 0) {
    return null;
  }

  return points.reduce((nearest, point) => {
    const nearestDistance = Math.abs(nearest.index - rawIndex);
    const pointDistance = Math.abs(point.index - rawIndex);

    return pointDistance < nearestDistance ? point : nearest;
  }, points[0]).index;
}

export function formatForecastChartValue(params: {
  value: number;
  metric: ForecastChartMetric;
  units: ForecastChartUnits;
}) {
  const roundedValue = Math.round(params.value);

  switch (params.metric) {
    case "temperature":
      return `${roundedValue}°${params.units.temperature}`;
    case "precipitationProbability":
      return `${roundedValue}%`;
    case "windSpeed":
    default:
      return `${roundedValue} ${params.units.windSpeed}`;
  }
}
