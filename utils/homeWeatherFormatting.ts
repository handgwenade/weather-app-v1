import type {
  RoadSignalHomeInitialResponse,
  TomorrowHourlyForecastEntry,
} from "@/services/tomorrow";
import type { WydotRoadReport } from "@/services/wydot";
import { formatTime24Hour, formatUpdatedTimeLabel } from "@/utils/dateTime";
import {
  getHomeCardStateLabel,
  type HomeCardDataState,
} from "@/utils/homePerformance";
import { celsiusToFahrenheit } from "@/utils/weather";

export type PropertyRisk = "High" | "Moderate" | "Low" | "Unavailable";
export type HomeDataState = HomeCardDataState;

export type HomeCurrentWeatherSnapshot = {
  hasWeatherData: boolean;
  temperatureF: number | null;
  feelsLikeF: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  precipProbability: number | null;
  humidity: number | null;
  visibilityMi: number | null;
  weatherCode: number | null;
  conditionLabel: string;
  sourceTimestamp: string | null;
  refreshFallbackLabel: string | null;
  dataState: HomeDataState;
};

export type HomeAlertSummary = {
  status: "loading" | "none" | "active" | "unavailable";
  event: string | null;
  area: string | null;
};

export const INITIAL_CURRENT_WEATHER: HomeCurrentWeatherSnapshot = {
  hasWeatherData: false,
  temperatureF: null,
  feelsLikeF: null,
  windSpeedMph: null,
  windGustMph: null,
  precipProbability: null,
  humidity: null,
  visibilityMi: null,
  weatherCode: null,
  conditionLabel: "Current conditions",
  sourceTimestamp: null,
  refreshFallbackLabel: null,
  dataState: "loading",
};

export const INITIAL_ALERT_SUMMARY: HomeAlertSummary = {
  status: "loading",
  event: null,
  area: null,
};

export function getConditionLabel(weatherCode?: number) {
  if (weatherCode === 1000) return "Clear";
  if (weatherCode === 1100) return "Mostly clear";
  if (weatherCode === 1101) return "Partly cloudy";
  if (weatherCode === 1102) return "Mostly cloudy";
  if (weatherCode === 1001) return "Cloudy";
  if (weatherCode === 4000) return "Drizzle";
  if (weatherCode === 4001) return "Rain";
  if (weatherCode === 4200) return "Light rain";
  if (weatherCode === 4201) return "Heavy rain";
  if (weatherCode === 5000) return "Snow";
  if (weatherCode === 5001) return "Flurries";
  if (weatherCode === 5100) return "Light snow";
  if (weatherCode === 5101) return "Heavy snow";
  if (weatherCode === 6000) return "Freezing drizzle";
  if (weatherCode === 6001) return "Freezing rain";
  if (weatherCode === 6200) return "Light freezing rain";
  if (weatherCode === 6201) return "Heavy freezing rain";
  if (weatherCode === 7000) return "Ice pellets";
  if (weatherCode === 7101) return "Heavy ice pellets";
  if (weatherCode === 7102) return "Light ice pellets";
  if (weatherCode === 8000) return "Thunderstorm";
  return "Current conditions";
}

function isHomeWetConditionLabel(label: string) {
  const normalized = label.toLowerCase();

  return (
    normalized.includes("rain") ||
    normalized.includes("drizzle") ||
    normalized.includes("snow") ||
    normalized.includes("freezing")
  );
}

export function isHomeWintryConditionLabel(label: string) {
  const normalized = label.toLowerCase();

  return normalized.includes("snow") || normalized.includes("freezing");
}

function formatHourLabel(value: string) {
  const formatted = formatClockLabel(value);
  return formatted ?? "Time unavailable";
}

export function getNextHomePrecipSignal(
  hourlyEntries: TomorrowHourlyForecastEntry[],
) {
  for (const entry of hourlyEntries.slice(0, 12)) {
    const conditionLabel =
      typeof entry.values.weatherCode === "number"
        ? getConditionLabel(entry.values.weatherCode)
        : null;
    const precipProbability =
      typeof entry.values.precipitationProbability === "number"
        ? entry.values.precipitationProbability
        : null;

    if (
      conditionLabel &&
      isHomeWetConditionLabel(conditionLabel) &&
      typeof precipProbability === "number" &&
      precipProbability > 0
    ) {
      return {
        conditionLabel,
        probability: Math.round(precipProbability),
        timeLabel: formatHourLabel(entry.time),
      };
    }
  }

  return null;
}

export function formatRoundedNumber(value?: number | null, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return `${Math.round(value)}${suffix}`;
}

function isThinHomeWeatherSnapshot(snapshot: HomeCurrentWeatherSnapshot) {
  return (
    !snapshot.hasWeatherData &&
    snapshot.precipProbability === null &&
    snapshot.humidity === null &&
    snapshot.weatherCode === null &&
    snapshot.sourceTimestamp === null
  );
}

export function hasUsableHomeRoadObservation(
  report: WydotRoadReport | null,
) {
  const observation = report?.primaryStationObservation;

  return Boolean(
    observation &&
      (observation.observedAt ||
        typeof observation.airTempF === "number" ||
        typeof observation.windAvgMph === "number" ||
        typeof observation.windGustMph === "number" ||
        typeof observation.surfaceTempF === "number"),
  );
}

export function buildHomeWeatherSnapshotFromInitialPayload(
  payload: RoadSignalHomeInitialResponse,
  dataState: HomeDataState,
): HomeCurrentWeatherSnapshot {
  return {
    hasWeatherData:
      typeof payload.current.currentTemp === "number" ||
      typeof payload.current.windSpeed === "number",
    temperatureF: payload.current.currentTemp,
    feelsLikeF: payload.current.feelsLike,
    windSpeedMph: payload.current.windSpeed,
    windGustMph: payload.current.windGust,
    precipProbability: payload.current.precipProbability,
    humidity: payload.current.humidity,
    visibilityMi: payload.current.visibility,
    weatherCode: payload.current.weatherCode,
    conditionLabel: payload.current.condition,
    sourceTimestamp: payload.freshness.weatherUpdatedAt,
    refreshFallbackLabel: null,
    dataState,
  };
}

export function mergeHomeWeatherSnapshot(
  previousWeatherState: HomeCurrentWeatherSnapshot,
  nextWeatherState: HomeCurrentWeatherSnapshot,
) {
  if (
    previousWeatherState.hasWeatherData &&
    isThinHomeWeatherSnapshot(nextWeatherState)
  ) {
    return {
      ...previousWeatherState,
      dataState:
        previousWeatherState.dataState === "fresh"
          ? "stale"
          : nextWeatherState.dataState,
      refreshFallbackLabel:
        nextWeatherState.refreshFallbackLabel ??
        previousWeatherState.refreshFallbackLabel,
    };
  }

  return nextWeatherState;
}

export function getHomeWeatherSnapshotKey(location: {
  latitude: number;
  longitude: number;
}) {
  return `${location.latitude},${location.longitude}`;
}

export function formatClockLabel(value: string | Date) {
  return formatTime24Hour(value);
}

export function formatUpdatedLabel(
  sourceTimestamp: string | null,
  fallbackLabel: string | null,
) {
  return formatUpdatedTimeLabel({
    sourceTimestamp,
    fallbackLabel,
    includePrefix: false,
    emptyLabel: "--",
  });
}

export function getHomeMetricFreshnessLabel(params: {
  state: HomeDataState;
  sourceTimestamp: string | null;
  fallbackLabel: string | null;
}) {
  const updatedLabel = formatUpdatedLabel(
    params.sourceTimestamp,
    params.fallbackLabel,
  );

  if (params.state === "loading") {
    return "Loading";
  }

  if (params.state === "unavailable") {
    return "Unavailable";
  }

  if (updatedLabel === "--") {
    return getHomeCardStateLabel(params.state);
  }

  return `${getHomeCardStateLabel(params.state)} - ${updatedLabel}`;
}

export function formatTemperatureValue(value?: number | null) {
  return value === null || value === undefined || Number.isNaN(value)
    ? "--"
    : `${Math.round(value)}°F`;
}

export function getHomeForecastLowFFromHourlyEntries(
  hourlyEntries: TomorrowHourlyForecastEntry[],
) {
  const temperatureValuesF = hourlyEntries
    .slice(0, 24)
    .map((entry) =>
      typeof entry.values.temperature === "number"
        ? celsiusToFahrenheit(entry.values.temperature)
        : null,
    )
    .filter((value): value is number => typeof value === "number");

  if (temperatureValuesF.length === 0) {
    return null;
  }

  return Math.min(...temperatureValuesF);
}

export function getHomePropertyRiskFromLowF(
  lowF: number | null,
): PropertyRisk {
  if (lowF === null) {
    return "Unavailable";
  }

  if (lowF <= 32) {
    return "High";
  }

  if (lowF <= 36) {
    return "Moderate";
  }

  return "Low";
}

export function sameHomeLocation(
  first: { latitude: number; longitude: number } | null | undefined,
  second: { latitude: number; longitude: number } | null | undefined,
) {
  if (!first || !second) {
    return false;
  }

  return getHomeWeatherSnapshotKey(first) === getHomeWeatherSnapshotKey(second);
}

export function formatPercentValue(value?: number | null) {
  return value === null || value === undefined || Number.isNaN(value)
    ? "--"
    : `${Math.round(value)}%`;
}

export function formatWindValue(value?: number | null, direction?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  const baseValue = `${Math.round(value)} mph`;
  return direction ? `${baseValue} ${direction}` : baseValue;
}

export function getTopTitle(report: WydotRoadReport | null, fallback: string) {
  if (report) {
    return `${report.routeCode} ${report.townGroup}`;
  }

  return fallback;
}
