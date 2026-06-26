import assert from "node:assert/strict";
import test from "node:test";

import type { TomorrowHourlyForecastEntry } from "../services/tomorrow";
import { buildHomeRoadHourlyPoints } from "../utils/homeRoadHourly";
import type { HomeCurrentWeatherSnapshot } from "../utils/homeWeatherFormatting";
import {
  getNearestRoadConditionPointIndex,
  getValidRoadConditionPoints,
} from "../utils/roadConditionChart";

const currentWeather: HomeCurrentWeatherSnapshot = {
  hasWeatherData: true,
  temperatureF: 54,
  feelsLikeF: 54,
  windSpeedMph: 4,
  windGustMph: 6,
  precipProbability: 0,
  humidity: 52,
  visibilityMi: 10,
  weatherCode: 1000,
  conditionLabel: "Clear",
  sourceTimestamp: "2026-06-26T00:00:00Z",
  refreshFallbackLabel: null,
  dataState: "fresh",
};

function buildHourlyForecast(): TomorrowHourlyForecastEntry[] {
  return Array.from({ length: 12 }, (_, index) => ({
    time: `2026-06-26T${String(index + 1).padStart(2, "0")}:00:00Z`,
    temp: 53 + index,
    windSpeed: 5 + index,
    windGust: 7 + index,
    precipProbability: 0,
    weatherCode: 1000,
    precipType: null,
  }));
}

test("home condition chart builds air temperature series from hourly forecast", () => {
  const points = buildHomeRoadHourlyPoints({
    currentWeather,
    hourlyEntries: buildHourlyForecast(),
    hourlyState: "fresh",
    roadReport: null,
  });
  const airTempPoints = getValidRoadConditionPoints(points, "airTemp");

  assert.equal(airTempPoints.length, 12);
  assert.equal(airTempPoints[0].value, 53);
  assert.equal(airTempPoints[11].value, 64);
});

test("home condition chart builds wind series from hourly forecast", () => {
  const points = buildHomeRoadHourlyPoints({
    currentWeather,
    hourlyEntries: buildHourlyForecast(),
    hourlyState: "fresh",
    roadReport: null,
  });
  const windPoints = getValidRoadConditionPoints(points, "windSpeed");

  assert.equal(windPoints.length, 12);
  assert.equal(windPoints[0].value, 5);
  assert.equal(windPoints[11].value, 16);
});

test("home condition chart keeps zero precipitation hourly values", () => {
  const points = buildHomeRoadHourlyPoints({
    currentWeather,
    hourlyEntries: buildHourlyForecast(),
    hourlyState: "fresh",
    roadReport: null,
  });
  const precipPoints = getValidRoadConditionPoints(
    points,
    "precipitationProbability",
  );

  assert.equal(precipPoints.length, 12);
  assert.deepEqual(
    precipPoints.map((point) => point.value),
    Array(12).fill(0),
  );
});

test("home condition chart falls back to one current observation when hourly is empty", () => {
  const points = buildHomeRoadHourlyPoints({
    currentWeather,
    hourlyEntries: [],
    hourlyState: "unavailable",
    roadReport: null,
  });

  assert.equal(getValidRoadConditionPoints(points, "airTemp").length, 1);
  assert.equal(getValidRoadConditionPoints(points, "windSpeed").length, 1);
  assert.equal(
    getValidRoadConditionPoints(points, "precipitationProbability")[0].value,
    0,
  );
});

test("home condition chart scrub target changes across hourly points", () => {
  const points = buildHomeRoadHourlyPoints({
    currentWeather,
    hourlyEntries: buildHourlyForecast(),
    hourlyState: "fresh",
    roadReport: null,
  });
  const windPoints = getValidRoadConditionPoints(points, "windSpeed");

  assert.equal(getNearestRoadConditionPointIndex(0.2, windPoints), 0);
  assert.equal(getNearestRoadConditionPointIndex(10.8, windPoints), 11);
});
