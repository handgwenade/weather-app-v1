import assert from "node:assert/strict";
import test from "node:test";

import {
  getHourlyForecastEntries,
  type RoadSignalHomeInitialResponse,
  type TomorrowHourlyForecastResponse,
} from "../services/tomorrow";
import { getValidForecastChartPoints } from "../utils/forecastChart";
import {
  buildHomeWeatherSnapshotFromInitialPayload,
  formatPercentValue,
} from "../utils/homeWeatherFormatting";

test("current weather snapshot preserves zero precipitation and humidity", () => {
  const payload: RoadSignalHomeInitialResponse = {
    location: {
      name: "I25 Wheatland",
      lat: 42.05,
      lon: -104.95,
    },
    current: {
      currentTemp: 54,
      feelsLike: 54,
      humidity: 52,
      windSpeed: 5,
      windGust: 6,
      precipProbability: 0,
      visibility: 10,
      weatherCode: 1000,
      condition: "Clear",
    },
    summary: {
      headline: "Clear",
      impactLevel: "Low",
      recommendation: "No major weather impacts.",
    },
    freshness: {
      weatherUpdatedAt: "2026-06-26T01:00:00Z",
      alertsUpdatedAt: null,
      roadUpdatedAt: null,
    },
    status: {
      current: "fresh",
      alerts: "loading",
      hourly: "loading",
      daily: "loading",
      roadRisk: "loading",
    },
  };

  const snapshot = buildHomeWeatherSnapshotFromInitialPayload(payload, "fresh");

  assert.equal(snapshot.precipProbability, 0);
  assert.equal(snapshot.humidity, 52);
  assert.equal(formatPercentValue(snapshot.precipProbability), "0%");
  assert.equal(formatPercentValue(snapshot.humidity), "52%");
});

test("hourly forecast normalization accepts app contract shape", () => {
  const response: TomorrowHourlyForecastResponse = {
    hourlyForecast: [
      {
        time: "2026-06-26T01:00:00Z",
        temp: 54,
        windSpeed: 5,
        windGust: 6,
        precipProbability: 0,
        weatherCode: 1000,
        precipType: null,
      },
    ],
    updatedAt: "2026-06-26T01:00:00Z",
  };

  assert.deepEqual(getHourlyForecastEntries(response), response.hourlyForecast);
});

test("legacy provider hourly cache normalizes into app contract without dropping zero", () => {
  const response: TomorrowHourlyForecastResponse = {
    timelines: {
      hourly: [
        {
          time: "2026-06-26T01:00:00Z",
          values: {
            temperature: 12.2,
            windSpeed: 2.2,
            windGust: 2.7,
            precipitationProbability: 0,
            weatherCode: 1000,
          },
        },
      ],
    },
  };

  assert.deepEqual(getHourlyForecastEntries(response), [
    {
      time: "2026-06-26T01:00:00Z",
      temp: 54,
      windSpeed: 4.9,
      windGust: 6,
      precipProbability: 0,
      weatherCode: 1000,
      precipType: null,
    },
  ]);
});

test("raw timeline response nesting normalizes into app hourly contract", () => {
  const response: TomorrowHourlyForecastResponse = {
    data: {
      timelines: [
        {
          timestep: "1h",
          intervals: [
            {
              startTime: "2026-06-26T01:00:00Z",
              values: {
                temperature: 12.2,
                windSpeed: 2.2,
                windGust: 2.7,
                precipitationProbability: 0,
                weatherCode: 1000,
              },
            },
          ],
        },
      ],
    },
  };

  assert.deepEqual(getHourlyForecastEntries(response), [
    {
      time: "2026-06-26T01:00:00Z",
      temp: 54,
      windSpeed: 4.9,
      windGust: 6,
      precipProbability: 0,
      weatherCode: 1000,
      precipType: null,
    },
  ]);
});

test("twelve normalized hourly entries produce chart points", () => {
  const hourly = Array.from({ length: 12 }, (_, index) => ({
    time: `2026-06-26T${String(index).padStart(2, "0")}:00:00Z`,
    temp: 50 + index,
    windSpeed: 5 + index,
    windGust: 8 + index,
    precipProbability: index === 0 ? 0 : index * 5,
    weatherCode: 1000,
    precipType: null,
  }));

  const chartHourly = hourly.map((entry) => ({
    time: entry.time,
    temperature: entry.temp,
    windSpeed: entry.windSpeed,
    windGust: entry.windGust,
    precipitationProbability: entry.precipProbability,
    weatherCode: entry.weatherCode,
  }));

  assert.equal(getValidForecastChartPoints(chartHourly, "temperature").length, 12);
  assert.equal(
    getValidForecastChartPoints(chartHourly, "precipitationProbability").length,
    12,
  );
  assert.equal(getValidForecastChartPoints(chartHourly, "windSpeed").length, 12);
});
