import assert from "node:assert/strict";
import test from "node:test";
import { formatTime24Hour } from "../utils/dateTime";

import {
    formatRoadConditionValue,
    formatSelectedRoadConditionTime,
    getNearestRoadConditionPointIndex,
    getRoadConditionLineSegments,
    getRoadConditionYDomain,
    getValidRoadConditionPoints,
    isRoadConditionSegmentObserved,
    type RoadConditionChartPoint,
} from "../utils/roadConditionChart";

const roadPoints: RoadConditionChartPoint[] = [
  {
    time: "2026-05-14T12:00:00Z",
    roadTemp: 66,
    airTemp: 63,
    windSpeed: 8,
    confidence: "observed",
    sourceProvider: "wydot",
  },
  {
    time: "2026-05-14T13:00:00Z",
    precipitationProbability: 20,
    airTemp: 65,
    windSpeed: 10,
    confidence: "forecast",
    sourceProvider: "tomorrow",
  },
  {
    time: "2026-05-14T14:00:00Z",
    roadTemp: Number.NaN,
    precipitationProbability: 40,
    airTemp: null,
    windSpeed: undefined,
    confidence: "estimated",
    sourceProvider: "tomorrow",
  },
  {
    time: "2026-05-14T15:00:00Z",
    roadTemp: 70,
    precipitationProbability: 55,
    airTemp: 68,
    windSpeed: 18,
    confidence: "forecast",
    sourceProvider: "tomorrow",
  },
];

test("road chart filters missing metric values without inventing placeholders", () => {
  assert.deepEqual(
    getValidRoadConditionPoints(roadPoints, "roadTemp").map((point) => ({
      index: point.index,
      value: point.value,
      confidence: point.confidence,
    })),
    [
      { index: 0, value: 66, confidence: "observed" },
      { index: 3, value: 70, confidence: "forecast" },
    ],
  );
});

test("road chart returns no values when a selected metric is unavailable", () => {
  const unavailablePoints: RoadConditionChartPoint[] = roadPoints.map(
    (point) => ({
      ...point,
      roadTemp: null,
    }),
  );

  assert.deepEqual(
    getValidRoadConditionPoints(unavailablePoints, "roadTemp"),
    [],
  );
});

test("road and air temperature domains auto-scale with vertical padding", () => {
  assert.deepEqual(getRoadConditionYDomain([60, 70], "roadTemp"), [58, 72]);
  assert.deepEqual(getRoadConditionYDomain([65], "airTemp"), [63, 67]);
});

test("precipitation uses fixed 0 to 100 y-axis domain", () => {
  assert.deepEqual(
    getRoadConditionYDomain([20, 40, 55], "precipitationProbability"),
    [0, 100],
  );
});

test("wind domain starts at zero unless high narrow values need readability", () => {
  assert.deepEqual(getRoadConditionYDomain([5, 20], "windSpeed"), [0, 22.7]);
  assert.deepEqual(getRoadConditionYDomain([30, 33], "windSpeed"), [28, 35]);
});

test("road scrubber snaps to the nearest available real point", () => {
  const points = getValidRoadConditionPoints(
    roadPoints,
    "precipitationProbability",
  );

  assert.equal(getNearestRoadConditionPointIndex(1.2, points), 1);
  assert.equal(getNearestRoadConditionPointIndex(2.6, points), 3);
});

test("road chart segments split gaps and expose observed versus fallback style", () => {
  const windPoints = getValidRoadConditionPoints(roadPoints, "windSpeed");
  const segments = getRoadConditionLineSegments(windPoints);

  assert.deepEqual(
    segments.map((segment) => segment.map((point) => point.index)),
    [[0], [1], [3]],
  );
  assert.equal(isRoadConditionSegmentObserved(segments[0]), true);
  assert.equal(isRoadConditionSegmentObserved(segments[1]), false);
});

test("road tooltip values use product formatting", () => {
  assert.equal(
    formatRoadConditionValue({
      value: 40,
      metric: "precipitationProbability",
      units: { temperature: "F", windSpeed: "mph" },
    }),
    "40%",
  );
  assert.equal(
    formatRoadConditionValue({
      value: 65,
      metric: "airTemp",
      units: { temperature: "F", windSpeed: "mph" },
    }),
    "65°",
  );
  assert.equal(
    formatRoadConditionValue({
      value: 15,
      metric: "windSpeed",
      units: { temperature: "F", windSpeed: "mph" },
    }),
    "15 mph",
  );
});

test("observed WYDOT selected point shows current observation label", () => {
  assert.equal(
    formatSelectedRoadConditionTime({
      time: "2026-05-14T12:00:00Z",
      sourceProvider: "wydot",
      confidence: "observed",
    }),
    "Current observation",
  );
});

test("forecast selected point shows formatted selected hour label", () => {
  assert.equal(
    formatSelectedRoadConditionTime({
      time: "2026-05-14T14:00:00Z",
      sourceProvider: "tomorrow",
      confidence: "forecast",
    }),
    `Selected ${formatTime24Hour("2026-05-14T14:00:00Z")}`,
  );
});

test("invalid forecast selected time falls back safely", () => {
  assert.equal(
    formatSelectedRoadConditionTime({
      time: "invalid-time",
      sourceProvider: "tomorrow",
      confidence: "forecast",
    }),
    "Selected hour unavailable",
  );
});
