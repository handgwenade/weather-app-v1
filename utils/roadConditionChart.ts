export type RoadConditionChartMetric =
  | "roadTemp"
  | "precipitationProbability"
  | "windSpeed"
  | "airTemp";

export type RoadConditionChartUnits = {
  temperature: "F";
  windSpeed: "mph";
};

export type RoadConditionConfidence =
  | "observed"
  | "forecast"
  | "estimated"
  | "unavailable";

export type RoadConditionSourceProvider =
  | "madis"
  | "mesowest"
  | "wydot"
  | "tomorrow";

export type RoadConditionChartPoint = {
  time: string;
  roadTemp?: number | null;
  precipitationProbability?: number | null;
  airTemp?: number | null;
  windSpeed?: number | null;
  windGust?: number | null;
  windDirection?: number | null;
  conditionCode?: string | null;
  weatherCode?: number | null;
  sourceProvider?: RoadConditionSourceProvider | null;
  sourceStationId?: string | null;
  confidence?: RoadConditionConfidence | null;
};

export type RoadConditionValuePoint = {
  index: number;
  time: string;
  value: number;
  confidence: RoadConditionConfidence;
  sourceProvider: RoadConditionSourceProvider | null;
};

export function getRoadConditionMetricValue(
  point: RoadConditionChartPoint,
  metric: RoadConditionChartMetric,
) {
  const value = point[metric];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getValidRoadConditionPoints(
  points: RoadConditionChartPoint[],
  metric: RoadConditionChartMetric,
) {
  return points
    .map((point, index) => {
      const value = getRoadConditionMetricValue(point, metric);

      if (value === null) {
        return null;
      }

      return {
        index,
        time: point.time,
        value,
        confidence: point.confidence ?? "unavailable",
        sourceProvider: point.sourceProvider ?? null,
      };
    })
    .filter(
      (point): point is RoadConditionValuePoint => point !== null,
    );
}

export function getRoadConditionYDomain(
  values: number[],
  metric: RoadConditionChartMetric,
) {
  if (values.length === 0) {
    return [0, 1] as const;
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;

  if (metric === "precipitationProbability") {
    return [0, 100] as const;
  }

  if (metric === "windSpeed") {
    const padding = Math.max(2, range * 0.18);
    const shouldStartAtZero = range > maxValue * 0.2 || minValue <= 8;

    return shouldStartAtZero
      ? ([0, maxValue + padding] as const)
      : ([Math.max(0, minValue - padding), maxValue + padding] as const);
  }

  const padding = Math.max(2, range * 0.16);

  if (range === 0) {
    return [minValue - padding, maxValue + padding] as const;
  }

  return [minValue - padding, maxValue + padding] as const;
}

export function getNearestRoadConditionPointIndex(
  rawIndex: number,
  points: RoadConditionValuePoint[],
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

export function isObservedRoadConditionPoint(point: RoadConditionValuePoint) {
  return point.confidence === "observed";
}

export function getRoadConditionLineSegments(points: RoadConditionValuePoint[]) {
  const segments: RoadConditionValuePoint[][] = [];

  points.forEach((point) => {
    const currentSegment = segments[segments.length - 1];
    const previousPoint = currentSegment?.[currentSegment.length - 1];

    if (
      !currentSegment ||
      !previousPoint ||
      point.index - previousPoint.index > 1 ||
      isObservedRoadConditionPoint(point) !==
        isObservedRoadConditionPoint(previousPoint)
    ) {
      segments.push([point]);
      return;
    }

    currentSegment.push(point);
  });

  return segments;
}

export function isRoadConditionSegmentObserved(
  segment: RoadConditionValuePoint[],
) {
  return segment.every(isObservedRoadConditionPoint);
}

export function formatRoadConditionValue(params: {
  value: number;
  metric: RoadConditionChartMetric;
  units: RoadConditionChartUnits;
}) {
  const roundedValue = Math.round(params.value);

  if (params.metric === "precipitationProbability") {
    return `${roundedValue}%`;
  }

  if (params.metric === "windSpeed") {
    return `${roundedValue} ${params.units.windSpeed}`;
  }

  return `${roundedValue}°`;
}
