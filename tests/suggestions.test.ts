import assert from "node:assert";
import { test } from "node:test";
import {
    evaluateSuggestions,
    getSuggestionPresentation,
    SuggestionCode,
    type SuggestionInput,
} from "../utils/suggestions";

test("visibility risk becomes primary when WYDOT station visibility is severely reduced", () => {
  const input: SuggestionInput = {
    road: {
      available: true,
      mapped: true,
      restriction: null,
      advisory: null,
      officialCondition: null,
      officialRoadStatus: {
        hasOfficialStatus: false,
        type: "none",
        impact: "none",
        title: "",
        description: "",
        source: "wydot",
        lastUpdated: null,
      },
      fetchedAt: "2026-01-01T00:00:00.000Z",
      stationObservedAt: "2026-01-01T00:00:00.000Z",
      windAvgMph: 5,
      windGustMph: 8,
      windDirection: "N",
      visibilityFt: 1200,
      airTempF: 32,
      surfaceTempF: 30,
    },
    weather: {
      available: true,
      observedAt: "2026-01-01T00:00:00.000Z",
      temperatureF: 32,
      windSpeedMph: 5,
      windDirection: "N",
      precipProbability: 0,
      weatherCode: null,
    },
    alerts: {
      available: true,
      hasActiveAlert: false,
      primaryEvent: null,
      primarySeverity: null,
      primaryCertainty: null,
    },
    forecast: {
      available: true,
      dailyLowF: 40,
    },
  };

  const decision = evaluateSuggestions(input);

  assert.equal(decision.primary?.code, SuggestionCode.VISIBILITY_RISK);
  assert.equal(
    getSuggestionPresentation(decision.primary!).levelLabel,
    "Moderate",
  );
});

test("visibility risk is blocked by an official active weather alert", () => {
  const input: SuggestionInput = {
    road: {
      available: true,
      mapped: true,
      restriction: null,
      advisory: null,
      officialCondition: null,
      officialRoadStatus: {
        hasOfficialStatus: false,
        type: "none",
        impact: "none",
        title: "",
        description: "",
        source: "wydot",
        lastUpdated: null,
      },
      fetchedAt: "2026-01-01T00:00:00.000Z",
      stationObservedAt: "2026-01-01T00:00:00.000Z",
      windAvgMph: 5,
      windGustMph: 8,
      windDirection: "N",
      visibilityFt: 1100,
      airTempF: 32,
      surfaceTempF: 30,
    },
    weather: {
      available: true,
      observedAt: "2026-01-01T00:00:00.000Z",
      temperatureF: 32,
      windSpeedMph: 5,
      windDirection: "N",
      precipProbability: 0,
      weatherCode: null,
    },
    alerts: {
      available: true,
      hasActiveAlert: true,
      primaryEvent: "Winter Storm Warning",
      primarySeverity: "Severe",
      primaryCertainty: "Observed",
    },
    forecast: {
      available: true,
      dailyLowF: 40,
    },
  };

  const decision = evaluateSuggestions(input);

  assert.equal(
    decision.primary?.code,
    SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE,
  );
});

/**
 * A moderate visibility signal should be surfaced before a generic use caution
 * signal when low visibility is present.
 */
test("visibility risk outranks generic use caution", () => {
  const input: SuggestionInput = {
    road: {
      available: true,
      mapped: true,
      restriction: null,
      advisory: null,
      officialCondition: null,
      officialRoadStatus: {
        hasOfficialStatus: false,
        type: "none",
        impact: "none",
        title: "",
        description: "",
        source: "wydot",
        lastUpdated: null,
      },
      fetchedAt: "2026-01-01T00:00:00.000Z",
      stationObservedAt: "2026-01-01T00:00:00.000Z",
      windAvgMph: 18,
      windGustMph: 22,
      windDirection: "N",
      visibilityFt: 2200,
      airTempF: 35,
      surfaceTempF: 34,
    },
    weather: {
      available: true,
      observedAt: "2026-01-01T00:00:00.000Z",
      temperatureF: 35,
      windSpeedMph: 18,
      windDirection: "N",
      precipProbability: 0,
      weatherCode: null,
    },
    alerts: {
      available: true,
      hasActiveAlert: false,
      primaryEvent: null,
      primarySeverity: null,
      primaryCertainty: null,
    },
    forecast: {
      available: true,
      dailyLowF: 40,
    },
  };

  const decision = evaluateSuggestions(input);

  assert.equal(decision.primary?.code, SuggestionCode.VISIBILITY_RISK);
  assert.notEqual(decision.primary?.code, SuggestionCode.USE_CAUTION);
});

test("high-profile vehicle wind risk outranks generic high wind caution", () => {
  const input: SuggestionInput = {
    road: {
      available: true,
      mapped: true,
      restriction: null,
      advisory: null,
      officialCondition: null,
      officialRoadStatus: {
        hasOfficialStatus: false,
        type: "none",
        impact: "none",
        title: "",
        description: "",
        source: "wydot",
        lastUpdated: null,
      },
      fetchedAt: "2026-01-01T00:00:00.000Z",
      stationObservedAt: "2026-01-01T00:00:00.000Z",
      windAvgMph: 32,
      windGustMph: 10,
      windDirection: "N",
      visibilityFt: 5000,
      airTempF: 45,
      surfaceTempF: 43,
    },
    weather: {
      available: true,
      observedAt: "2026-01-01T00:00:00.000Z",
      temperatureF: 45,
      windSpeedMph: 32,
      windDirection: "N",
      precipProbability: 0,
      weatherCode: null,
    },
    alerts: {
      available: true,
      hasActiveAlert: false,
      primaryEvent: null,
      primarySeverity: null,
      primaryCertainty: null,
    },
    forecast: {
      available: true,
      dailyLowF: 40,
    },
  };

  const decision = evaluateSuggestions(input);

  assert.equal(
    decision.primary?.code,
    SuggestionCode.HIGH_PROFILE_VEHICLE_RISK,
  );
  assert.notEqual(decision.primary?.code, SuggestionCode.HIGH_WIND_CAUTION);
});

test("visibility risk blocks high-profile vehicle wind risk", () => {
  const input: SuggestionInput = {
    road: {
      available: true,
      mapped: true,
      restriction: null,
      advisory: null,
      officialCondition: null,
      officialRoadStatus: {
        hasOfficialStatus: false,
        type: "none",
        impact: "none",
        title: "",
        description: "",
        source: "wydot",
        lastUpdated: null,
      },
      fetchedAt: "2026-01-01T00:00:00.000Z",
      stationObservedAt: "2026-01-01T00:00:00.000Z",
      windAvgMph: 45,
      windGustMph: 15,
      windDirection: "N",
      visibilityFt: 1200,
      airTempF: 45,
      surfaceTempF: 43,
    },
    weather: {
      available: true,
      observedAt: "2026-01-01T00:00:00.000Z",
      temperatureF: 45,
      windSpeedMph: 45,
      windDirection: "N",
      precipProbability: 0,
      weatherCode: null,
    },
    alerts: {
      available: true,
      hasActiveAlert: false,
      primaryEvent: null,
      primarySeverity: null,
      primaryCertainty: null,
    },
    forecast: {
      available: true,
      dailyLowF: 40,
    },
  };

  const decision = evaluateSuggestions(input);

  assert.equal(decision.primary?.code, SuggestionCode.VISIBILITY_RISK);
});

test("official active weather alert blocks high-profile vehicle wind risk", () => {
  const input: SuggestionInput = {
    road: {
      available: true,
      mapped: true,
      restriction: null,
      advisory: null,
      officialCondition: null,
      officialRoadStatus: {
        hasOfficialStatus: false,
        type: "none",
        impact: "none",
        title: "",
        description: "",
        source: "wydot",
        lastUpdated: null,
      },
      fetchedAt: "2026-01-01T00:00:00.000Z",
      stationObservedAt: "2026-01-01T00:00:00.000Z",
      windAvgMph: 45,
      windGustMph: 55,
      windDirection: "N",
      visibilityFt: 5000,
      airTempF: 45,
      surfaceTempF: 43,
    },
    weather: {
      available: true,
      observedAt: "2026-01-01T00:00:00.000Z",
      temperatureF: 45,
      windSpeedMph: 45,
      windDirection: "N",
      precipProbability: 0,
      weatherCode: null,
    },
    alerts: {
      available: true,
      hasActiveAlert: true,
      primaryEvent: "High Wind Warning",
      primarySeverity: "Severe",
      primaryCertainty: "Observed",
    },
    forecast: {
      available: true,
      dailyLowF: 40,
    },
  };

  const decision = evaluateSuggestions(input);

  assert.equal(
    decision.primary?.code,
    SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE,
  );
});

test("does not surface high-profile vehicle wind risk when no wind data is available", () => {
  const input: SuggestionInput = {
    road: {
      available: true,
      mapped: true,
      restriction: null,
      advisory: null,
      officialCondition: null,
      officialRoadStatus: {
        hasOfficialStatus: false,
        type: "none",
        impact: "none",
        title: "",
        description: "",
        source: "wydot",
        lastUpdated: null,
      },
      fetchedAt: "2026-01-01T00:00:00.000Z",
      stationObservedAt: null,
      windAvgMph: null,
      windGustMph: null,
      windDirection: null,
      visibilityFt: 5000,
      airTempF: 45,
      surfaceTempF: 43,
    },
    weather: {
      available: true,
      observedAt: "2026-01-01T00:00:00.000Z",
      temperatureF: 45,
      windSpeedMph: null,
      windDirection: "N",
      precipProbability: 0,
      weatherCode: null,
    },
    alerts: {
      available: true,
      hasActiveAlert: false,
      primaryEvent: null,
      primarySeverity: null,
      primaryCertainty: null,
    },
    forecast: {
      available: true,
      dailyLowF: 40,
    },
  };

  const decision = evaluateSuggestions(input);

  assert.notEqual(
    decision.primary?.code,
    SuggestionCode.HIGH_PROFILE_VEHICLE_RISK,
  );
});
