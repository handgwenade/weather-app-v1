import assert from "node:assert/strict";
import test from "node:test";

import {
  formatForecastChartValue,
  getForecastYDomain,
  getNearestForecastPointIndex,
  getValidForecastChartPoints,
  type ForecastChartHour,
} from "../utils/forecastChart";

const hourly: ForecastChartHour[] = [
  {
    time: "2026-05-14T12:00:00Z",
    temperature: 61,
    windSpeed: 12,
    precipitationProbability: 0,
  },
  {
    time: "2026-05-14T13:00:00Z",
    windSpeed: 14,
    precipitationProbability: 20,
  },
  {
    time: "2026-05-14T14:00:00Z",
    temperature: 66,
    windSpeed: 18,
    precipitationProbability: 45,
  },
];

test("scrubber filters invalid values without inventing placeholders", () => {
  assert.deepEqual(
    getValidForecastChartPoints(hourly, "temperature").map((point) => ({
      index: point.index,
      value: point.value,
    })),
    [
      { index: 0, value: 61 },
      { index: 2, value: 66 },
    ],
  );
});

test("precipitation uses fixed 0 to 100 y-axis domain", () => {
  assert.deepEqual(getForecastYDomain([10, 20], "precipitationProbability"), [
    0,
    100,
  ]);
});

test("temperature and wind domains add vertical padding", () => {
  assert.deepEqual(getForecastYDomain([60, 70], "temperature"), [58, 72]);
  assert.deepEqual(getForecastYDomain([15], "windSpeed"), [12, 18]);
});

test("drag index snaps to the nearest valid hourly value", () => {
  const points = getValidForecastChartPoints(hourly, "temperature");

  assert.equal(getNearestForecastPointIndex(1.7, points), 2);
  assert.equal(getNearestForecastPointIndex(0.2, points), 0);
});

test("tooltip values respect metric units", () => {
  assert.equal(
    formatForecastChartValue({
      value: 72,
      metric: "temperature",
      units: { temperature: "F", windSpeed: "mph" },
    }),
    "72°F",
  );
  assert.equal(
    formatForecastChartValue({
      value: 40,
      metric: "precipitationProbability",
      units: { temperature: "F", windSpeed: "mph" },
    }),
    "40%",
  );
  assert.equal(
    formatForecastChartValue({
      value: 15,
      metric: "windSpeed",
      units: { temperature: "F", windSpeed: "mph" },
    }),
    "15 mph",
  );
});
