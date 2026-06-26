import assert from "node:assert/strict";
import test from "node:test";

import {
  toAppCurrentWeatherResponse,
  toAppDailyForecastResponse,
  toAppHourlyForecastResponse,
  withWeatherDebug,
} from "../backend/src/weatherContract";

test("hourly weather contract excludes raw timelines by default", () => {
  const response = toAppHourlyForecastResponse([
    {
      startTime: "2026-06-26T07:00:00Z",
      values: {
        temperature: 11.1,
        windSpeed: 2.6,
        windGust: 4.3,
        precipitationProbability: 0,
        weatherCode: 1000,
        precipitationType: 0,
      },
    },
  ]);

  assert.equal(response.updatedAt, "2026-06-26T07:00:00Z");
  assert.deepEqual(response.hourlyForecast, [
    {
      time: "2026-06-26T07:00:00Z",
      temp: 52,
      windSpeed: 5.8,
      windGust: 9.6,
      precipProbability: 0,
      weatherCode: 1000,
      precipType: 0,
    },
  ]);
  assert.equal("timelines" in response, false);
  assert.equal("data" in response, false);
});

test("debug weather contract includes raw provider payload only when requested", () => {
  const clean = toAppHourlyForecastResponse([]);
  const raw = { timelines: { hourly: [{ values: { temperature: 11.1 } }] } };

  assert.equal("debug" in withWeatherDebug(clean, {
    includeDebug: false,
    provider: "tomorrow",
    raw,
  }), false);
  assert.deepEqual(withWeatherDebug(clean, {
    includeDebug: true,
    provider: "tomorrow",
    raw,
  }), {
    ...clean,
    debug: {
      provider: "tomorrow",
      raw,
    },
  });
});

test("current weather contract is normalized only by default", () => {
  const response = toAppCurrentWeatherResponse({
    startTime: "2026-06-26T07:00:00Z",
    values: {
      temperature: 11.1,
      temperatureApparent: 11.1,
      humidity: 52,
      windSpeed: 2.6,
      windGust: 4.3,
      visibility: 16.1,
      precipitationProbability: 0,
      weatherCode: 1000,
    },
  });

  assert.equal(response.currentTemp, 52);
  assert.equal(response.feelsLike, 52);
  assert.equal(response.precipProbability, 0);
  assert.equal(response.updatedAt, "2026-06-26T07:00:00Z");
  assert.equal("data" in response, false);
});

test("daily weather contract is normalized only by default", () => {
  const response = toAppDailyForecastResponse({
    timelines: {
      daily: [
        {
          time: "2026-06-26T00:00:00Z",
          values: {
            temperatureMax: 21.1,
            temperatureMin: 8.9,
            precipitationProbabilityAvg: 0,
            weatherCodeMax: 1000,
          },
        },
      ],
    },
  });

  assert.deepEqual(response, {
    dailyForecast: [
      {
        date: "2026-06-26T00:00:00Z",
        highTemp: 70,
        lowTemp: 48,
        precipProbability: 0,
        weatherCode: 1000,
      },
    ],
    updatedAt: "2026-06-26T00:00:00Z",
  });
});
