import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import HomeScreenV2, {
  type HomeBullet,
  type HomeLocationCard,
  type HomeMetric,
  type HomeMonitoringCard,
  type HomeOutlookItem,
  type HomeStatusBanner,
} from "@/components/home/HomeScreenV2";
import QuickSwitchModal from "@/components/quickSwitchModal";
import {
  formatCityState,
  setSelectedLocation,
  usePropertyLocation,
  useSavedLocations,
  useSelectedLocation,
} from "@/data/locationStore";
import { getSharedCurrentAndHourlyWeather } from "@/data/weatherStore";
import { getActiveAlertsForLocation } from "@/services/nws";
import type { TomorrowHourlyForecastEntry } from "@/services/tomorrow";
import {
  getWydotRoadReport,
  type WydotOfficialRoadStatus,
  type WydotRoadReport,
} from "@/services/wydot";
import { formatTime24Hour, formatUpdatedTimeLabel } from "@/utils/dateTime";
import {
  evaluateSuggestions,
  getSuggestionPresentation,
  SuggestionCode,
  type RuleMatch,
  type SuggestionDecision,
  type SuggestionInput,
} from "@/utils/suggestions";
import { celsiusToFahrenheit, metersPerSecondToMph } from "@/utils/weather";

function getConditionLabel(weatherCode?: number) {
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

function isHomeWintryConditionLabel(label: string) {
  const normalized = label.toLowerCase();

  return normalized.includes("snow") || normalized.includes("freezing");
}

function getNextHomePrecipSignal(hourlyEntries: TomorrowHourlyForecastEntry[]) {
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

function formatRoundedNumber(value?: number | null, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return `${Math.round(value)}${suffix}`;
}

type PropertyRisk = "High" | "Moderate" | "Low" | "Unavailable";

type HomeCurrentWeatherSnapshot = {
  hasWeatherData: boolean;
  temperatureF: number | null;
  windSpeedMph: number | null;
  precipProbability: number | null;
  humidity: number | null;
  weatherCode: number | null;
  conditionLabel: string;
  sourceTimestamp: string | null;
  refreshFallbackLabel: string | null;
};

type HomeAlertSummary = {
  status: "loading" | "none" | "active" | "unavailable";
  event: string | null;
  area: string | null;
};

type HomeViewModel = {
  updatedLabel: string;
  nextPrecipSignal: ReturnType<typeof getNextHomePrecipSignal>;
  metrics: HomeMetric[];
  statusBanner: HomeStatusBanner;
  monitoringCard: HomeMonitoringCard;
  monitoredLocationCard: HomeLocationCard;
};

type UseHomeScreenDataResult = {
  currentWeather: HomeCurrentWeatherSnapshot;
  hourlyForecast: TomorrowHourlyForecastEntry[];
  alertSummary: HomeAlertSummary;
  propertyRisk: PropertyRisk;
  propertyForecastLowF: number | null;
  roadReport: WydotRoadReport | null;
  homeSuggestionsReady: boolean;
};

const INITIAL_CURRENT_WEATHER: HomeCurrentWeatherSnapshot = {
  hasWeatherData: false,
  temperatureF: null,
  windSpeedMph: null,
  precipProbability: null,
  humidity: null,
  weatherCode: null,
  conditionLabel: "Current conditions",
  sourceTimestamp: null,
  refreshFallbackLabel: null,
};

const INITIAL_ALERT_SUMMARY: HomeAlertSummary = {
  status: "loading",
  event: null,
  area: null,
};
const HOME_WEATHER_REFRESH_INTERVAL_MS = 60 * 1000;

const EMPTY_HOME_WYDOT_OFFICIAL_STATUS: WydotOfficialRoadStatus = {
  hasOfficialStatus: false,
  type: "none",
  impact: "none",
  title: "",
  description: "",
  source: "wydot",
  lastUpdated: null,
};

function isThinHomeWeatherSnapshot(snapshot: HomeCurrentWeatherSnapshot) {
  return (
    !snapshot.hasWeatherData &&
    snapshot.precipProbability === null &&
    snapshot.humidity === null &&
    snapshot.weatherCode === null &&
    snapshot.sourceTimestamp === null
  );
}

function hasValidHomeWeatherSnapshot(
  snapshot: HomeCurrentWeatherSnapshot,
  hourlyEntries: TomorrowHourlyForecastEntry[],
) {
  return (
    snapshot.hasWeatherData &&
    snapshot.temperatureF !== null &&
    snapshot.sourceTimestamp !== null &&
    hourlyEntries.length > 0
  );
}

function hasUsableHomeRoadObservation(report: WydotRoadReport | null) {
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

function buildHomeWeatherSnapshotFromRoadReport(
  report: WydotRoadReport | null,
  fallbackLabel: string | null,
): HomeCurrentWeatherSnapshot | null {
  const observation = report?.primaryStationObservation;

  if (!observation || !hasUsableHomeRoadObservation(report)) {
    return null;
  }

  const windSpeedMph = observation.windAvgMph ?? observation.windGustMph;

  return {
    hasWeatherData:
      typeof observation.airTempF === "number" ||
      typeof windSpeedMph === "number",
    temperatureF: observation.airTempF,
    windSpeedMph,
    precipProbability: null,
    humidity: null,
    weatherCode: null,
    conditionLabel: "Road station observation",
    sourceTimestamp: observation.observedAt ?? report?.fetchedAt ?? null,
    refreshFallbackLabel: observation.observedAt ? null : fallbackLabel,
  };
}

function getHomeWeatherSnapshotKey(location: {
  latitude: number;
  longitude: number;
}) {
  return `${location.latitude},${location.longitude}`;
}

function formatClockLabel(value: string | Date) {
  return formatTime24Hour(value);
}

function formatUpdatedLabel(
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

function formatHourLabel(value: string) {
  const formatted = formatClockLabel(value);
  return formatted ?? "Time unavailable";
}

function formatTemperatureValue(value?: number | null) {
  return value === null || value === undefined || Number.isNaN(value)
    ? "--"
    : `${Math.round(value)}°F`;
}

function getHomeForecastLowFFromHourlyEntries(
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

function getHomePropertyRiskFromLowF(lowF: number | null): PropertyRisk {
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

function sameHomeLocation(
  first: { latitude: number; longitude: number } | null | undefined,
  second: { latitude: number; longitude: number } | null | undefined,
) {
  if (!first || !second) {
    return false;
  }

  return getHomeWeatherSnapshotKey(first) === getHomeWeatherSnapshotKey(second);
}

function formatPercentValue(value?: number | null) {
  return value === null || value === undefined || Number.isNaN(value)
    ? "--"
    : `${Math.round(value)}%`;
}

function formatWindValue(value?: number | null, direction?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  const baseValue = `${Math.round(value)} mph`;
  return direction ? `${baseValue} ${direction}` : baseValue;
}

function getTopTitle(report: WydotRoadReport | null, fallback: string) {
  if (report) {
    return `${report.routeCode} ${report.townGroup}`;
  }

  return fallback;
}

function formatHomeAlertAreaSubtitle(area: string | null) {
  if (!area) {
    return "Affects nearby areas";
  }

  const primaryArea = area
    .split(";")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find((part) => part.length > 0);

  if (!primaryArea) {
    return "Affects nearby areas";
  }

  return `${primaryArea} & surrounding travel areas`;
}

function hasMeaningfulHomeText(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return (
    normalized !== "" &&
    normalized !== "none" &&
    normalized !== "none reported" &&
    normalized !== "unavailable"
  );
}

function hasMeaningfulHomeSurfaceCondition(report: WydotRoadReport | null) {
  const condition = report?.primarySegment.officialCondition ?? null;

  return (
    condition !== null &&
    hasMeaningfulHomeText(condition) &&
    condition.trim().toLowerCase() !== "dry"
  );
}

function getHomeOfficialRoadStatus(report: WydotRoadReport | null) {
  return (
    report?.primarySegment.officialRoadStatus ??
    EMPTY_HOME_WYDOT_OFFICIAL_STATUS
  );
}

function hasHomeOfficialWydotStatus(status: WydotOfficialRoadStatus) {
  return status.hasOfficialStatus && status.type !== "none";
}

function getHomeObservedConditionTitle(
  currentWeather: HomeCurrentWeatherSnapshot,
) {
  if (hasMeaningfulHomeText(currentWeather.conditionLabel)) {
    return currentWeather.conditionLabel;
  }

  if (currentWeather.windSpeedMph !== null) {
    return `Observed wind: ${Math.round(currentWeather.windSpeedMph)} mph`;
  }

  return "Current weather observation";
}

function getHomeMonitoredImpactLabel(params: {
  alertSummary: HomeAlertSummary;
  roadReport: WydotRoadReport | null;
  suggestionDecision: SuggestionDecision | null;
}) {
  const { alertSummary, roadReport, suggestionDecision } = params;

  const officialRoadStatus = getHomeOfficialRoadStatus(roadReport);

  if (hasHomeOfficialWydotStatus(officialRoadStatus)) {
    return "Official WYDOT status";
  }

  if (
    suggestionDecision?.secondary.find(
      (match) => match.code === SuggestionCode.FREEZE_RISK_TONIGHT,
    )
  ) {
    return "Forecast outlook";
  }

  const restriction = roadReport?.primarySegment.restriction ?? null;
  const advisory = roadReport?.primarySegment.advisory ?? null;

  if (hasMeaningfulHomeText(restriction) || hasMeaningfulHomeText(advisory)) {
    return "WYDOT update";
  }

  if (
    alertSummary.status === "active" &&
    hasMeaningfulHomeText(alertSummary.event)
  ) {
    return "Official alert";
  }

  if (
    suggestionDecision?.primary?.code ===
    SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS
  ) {
    return "Current conditions";
  }

  return suggestionDecision?.primary ? "Observed conditions" : "Awaiting data";
}

function getHomeStatusTitle(
  primarySuggestion: RuleMatch,
  params: {
    alertSummary: HomeAlertSummary;
    currentWeather: HomeCurrentWeatherSnapshot;
    propertyForecastLowF: number | null;
    roadReport: WydotRoadReport | null;
  },
): string {
  const { alertSummary, currentWeather, propertyForecastLowF, roadReport } =
    params;
  const restriction = roadReport?.primarySegment.restriction ?? null;
  const advisory = roadReport?.primarySegment.advisory ?? null;
  const surfaceCondition = roadReport?.primarySegment.officialCondition ?? null;
  const officialRoadStatus = getHomeOfficialRoadStatus(roadReport);

  switch (primarySuggestion.code) {
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
      return hasHomeOfficialWydotStatus(officialRoadStatus)
        ? officialRoadStatus.title
        : hasMeaningfulHomeText(restriction)
          ? "WYDOT restriction"
          : "No active WYDOT restriction reported";
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
      return hasHomeOfficialWydotStatus(officialRoadStatus)
        ? officialRoadStatus.title
        : hasMeaningfulHomeText(advisory)
          ? "WYDOT advisory"
          : "No active WYDOT advisory reported";
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return hasMeaningfulHomeText(alertSummary.event)
        ? (alertSummary.event ?? "Official alert reported")
        : "Official alert reported";
    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return propertyForecastLowF !== null
        ? `Tonight low: ${Math.round(propertyForecastLowF)}°F`
        : "Tonight forecast low";
    case SuggestionCode.HIGH_WIND_CAUTION:
      return currentWeather.windSpeedMph !== null
        ? `Observed wind: ${Math.round(currentWeather.windSpeedMph)} mph`
        : getHomeObservedConditionTitle(currentWeather);
    case SuggestionCode.USE_CAUTION:
    case SuggestionCode.DRIFTING_CONCERN:
      if (hasMeaningfulHomeSurfaceCondition(roadReport) && surfaceCondition) {
        return surfaceCondition;
      }

      return getHomeObservedConditionTitle(currentWeather);
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
      return "WYDOT road data unavailable";
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return "Weather data unavailable";
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return "No active WYDOT restriction or advisory reported";
  }
}

function getHomeStatusSubtitle(
  primarySuggestion: RuleMatch,
  params: {
    alertSummary: HomeAlertSummary;
    currentWeather: HomeCurrentWeatherSnapshot;
    propertyForecastLowF: number | null;
    propertyLocationName: string | null;
    propertyRisk: PropertyRisk;
    roadReport: WydotRoadReport | null;
  },
) {
  const {
    alertSummary,
    currentWeather,
    propertyForecastLowF,
    propertyLocationName,
    propertyRisk,
    roadReport,
  } = params;

  const officialRoadStatus = getHomeOfficialRoadStatus(roadReport);

  switch (primarySuggestion.code) {
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
      return hasHomeOfficialWydotStatus(officialRoadStatus)
        ? officialRoadStatus.description
        : roadReport
          ? `${roadReport.routeCode} near ${roadReport.townGroup}`
          : (primarySuggestion.whyBullets[0] ?? "Road guidance is active");
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return formatHomeAlertAreaSubtitle(alertSummary.area);
    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return propertyForecastLowF !== null
        ? `${propertyLocationName ?? "Property location"} forecast low: ${Math.round(propertyForecastLowF)}°F`
        : propertyRisk === "High"
          ? `${propertyLocationName ?? "Property location"} forecast low is in the freeze-risk range.`
          : `${propertyLocationName ?? "Property location"} forecast low is near the freeze threshold.`;
    case SuggestionCode.HIGH_WIND_CAUTION:
      return `Condition: ${currentWeather.conditionLabel}`;
    case SuggestionCode.USE_CAUTION:
      return hasMeaningfulHomeSurfaceCondition(roadReport)
        ? `Surface: ${roadReport?.primarySegment.officialCondition}`
        : "Weather may affect travel";
    case SuggestionCode.DRIFTING_CONCERN:
      return hasMeaningfulHomeSurfaceCondition(roadReport)
        ? `Surface: ${roadReport?.primarySegment.officialCondition}`
        : "Wind and wintry conditions may affect travel";
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return (
        primarySuggestion.whyBullets[0] ??
        "Data for this location is limited right now."
      );
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return roadReport
        ? `${roadReport.routeCode} near ${roadReport.townGroup}`
        : "No active restrictions or alerts reported.";
  }
}

function getHomeRecommendationText(
  primarySuggestion: RuleMatch | null,
  params: {
    alertSummary: HomeAlertSummary;
    currentWeather: HomeCurrentWeatherSnapshot;
    propertyForecastLowF: number | null;
    propertyLocationName: string | null;
    roadReport: WydotRoadReport | null;
  },
): string {
  if (!primarySuggestion) {
    return "Checking road, weather, and forecast signals for this location.";
  }

  const {
    alertSummary,
    currentWeather,
    propertyForecastLowF,
    propertyLocationName,
    roadReport,
  } = params;
  const restriction = roadReport?.primarySegment.restriction ?? null;
  const advisory = roadReport?.primarySegment.advisory ?? null;
  const surfaceCondition = roadReport?.primarySegment.officialCondition ?? null;
  const officialRoadStatus = getHomeOfficialRoadStatus(roadReport);

  switch (primarySuggestion.code) {
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
      return hasHomeOfficialWydotStatus(officialRoadStatus)
        ? `${officialRoadStatus.title}: ${officialRoadStatus.description}.`
        : hasMeaningfulHomeText(restriction)
          ? `WYDOT restriction: ${restriction}.`
          : "No active WYDOT restriction is reported near this location.";
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
      return hasHomeOfficialWydotStatus(officialRoadStatus)
        ? `${officialRoadStatus.title}: ${officialRoadStatus.description}.`
        : hasMeaningfulHomeText(advisory)
          ? `WYDOT advisory: ${advisory}.`
          : "No active WYDOT advisory is reported near this location.";
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return hasMeaningfulHomeText(alertSummary.event)
        ? `Official alert: ${alertSummary.event ?? "Active alert"}.`
        : "Official weather guidance is active for this location.";
    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return propertyForecastLowF !== null
        ? `${propertyLocationName ?? "Property location"} forecast low is ${Math.round(propertyForecastLowF)}°F tonight.`
        : "Tonight's forecast low is near the freeze threshold.";
    case SuggestionCode.HIGH_WIND_CAUTION:
      return currentWeather.windSpeedMph !== null
        ? `Observed wind: ${Math.round(currentWeather.windSpeedMph)} mph.`
        : `Current weather observation: ${currentWeather.conditionLabel}.`;
    case SuggestionCode.USE_CAUTION:
    case SuggestionCode.DRIFTING_CONCERN:
      return hasMeaningfulHomeText(surfaceCondition)
        ? `Current road surface: ${surfaceCondition}. Weather may still affect travel.`
        : `Current weather: ${currentWeather.conditionLabel}. Continue monitoring conditions.`;
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
      return "Road-specific guidance is limited right now. Check again before travel.";
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return "Weather-based guidance is limited right now. Check again before travel.";
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
      return "No active WYDOT restrictions, advisories, or official alerts are posted right now.";
    default:
      return "Checking road, weather, and forecast signals for this location.";
  }
}

function getHomeMonitoringCard(
  decision: SuggestionDecision | null,
  params: {
    currentWeather: HomeCurrentWeatherSnapshot;
    propertyForecastLowF: number | null;
    propertyLocationName: string | null;
    propertyRisk: PropertyRisk;
    roadReport: WydotRoadReport | null;
    alertSummary: HomeAlertSummary;
  },
): HomeMonitoringCard {
  if (!decision) {
    return {
      title: "Collecting current guidance",
      body: "Checking road, weather, and forecast signals for this location.",
    };
  }

  const freezeSuggestion =
    decision.primary?.code === SuggestionCode.FREEZE_RISK_TONIGHT
      ? decision.primary
      : (decision.secondary.find(
          (match) => match.code === SuggestionCode.FREEZE_RISK_TONIGHT,
        ) ?? null);

  if (freezeSuggestion) {
    return {
      title:
        params.propertyForecastLowF !== null
          ? `Tonight low: ${Math.round(params.propertyForecastLowF)}°F`
          : "Tonight forecast low",
      body:
        params.propertyForecastLowF !== null
          ? `${params.propertyLocationName ?? "Property location"} forecast low is ${Math.round(params.propertyForecastLowF)}°F tonight.`
          : params.propertyRisk === "High"
            ? `${params.propertyLocationName ?? "Property location"} forecast low supports freeze protection planning.`
            : `${params.propertyLocationName ?? "Property location"} forecast low is close enough to freezing to keep under watch.`,
    };
  }

  const focusSuggestion = decision.secondary[0] ?? decision.primary ?? null;

  if (!focusSuggestion) {
    return {
      title: params.propertyLocationName
        ? "No active source signal"
        : "No property location set",
      body: params.propertyLocationName
        ? `No active WYDOT restrictions, advisories, or official alerts are posted for ${params.propertyLocationName} right now.`
        : "Set a saved property location when you want freeze-sensitive monitoring on Home.",
    };
  }

  const focusTitle = getHomeStatusTitle(focusSuggestion, {
    alertSummary: params.alertSummary,
    currentWeather: params.currentWeather,
    propertyForecastLowF: params.propertyForecastLowF,
    roadReport: params.roadReport,
  });
  const monitoringTitle =
    focusSuggestion.code === SuggestionCode.USE_CAUTION ||
    focusSuggestion.code === SuggestionCode.DRIFTING_CONCERN
      ? "Road Conditions"
      : focusTitle;

  return {
    title: monitoringTitle,
    body: getHomeRecommendationText(focusSuggestion, {
      alertSummary: params.alertSummary,
      currentWeather: params.currentWeather,
      propertyForecastLowF: params.propertyForecastLowF,
      propertyLocationName: params.propertyLocationName,
      roadReport: params.roadReport,
    }),
  };
}

function buildHomeViewModel(params: {
  currentWeather: HomeCurrentWeatherSnapshot;
  hourlyForecast: TomorrowHourlyForecastEntry[];
  alertSummary: HomeAlertSummary;
  propertyForecastLowF: number | null;
  propertyRisk: PropertyRisk;
  propertyLocationName: string | null;
  roadReport: WydotRoadReport | null;
  suggestionDecision: SuggestionDecision | null;
  topTitle: string;
}): HomeViewModel {
  const {
    currentWeather,
    hourlyForecast,
    alertSummary,
    propertyForecastLowF,
    propertyRisk,
    propertyLocationName,
    roadReport,
    suggestionDecision,
    topTitle,
  } = params;
  const observation = roadReport?.primaryStationObservation;
  const surfaceCondition =
    roadReport?.primarySegment.officialCondition &&
    !["None"].includes(roadReport.primarySegment.officialCondition)
      ? roadReport.primarySegment.officialCondition
      : null;
  const windMetric = observation?.windDirection
    ? formatWindValue(observation.windAvgMph, observation.windDirection)
    : formatWindValue(currentWeather.windSpeedMph);
  const metrics: HomeMetric[] = [
    {
      label: "Air Temp",
      value: formatTemperatureValue(currentWeather.temperatureF),
    },
    {
      label: "Road Temp",
      value: formatRoundedNumber(observation?.surfaceTempF, "°F"),
    },
    { label: "Wind", value: windMetric },
    {
      label: "Gusts",
      value: formatRoundedNumber(observation?.windGustMph, " mph"),
    },
    {
      label: "Precip Prob",
      value: formatPercentValue(currentWeather.precipProbability),
    },
    { label: "Humidity", value: formatPercentValue(currentWeather.humidity) },
  ];

  const updatedLabel = formatUpdatedLabel(
    currentWeather.sourceTimestamp,
    currentWeather.refreshFallbackLabel,
  );

  const nextPrecipSignal = getNextHomePrecipSignal(hourlyForecast);

  const statusBanner: HomeStatusBanner = (() => {
    if (!suggestionDecision?.primary) {
      return {
        title: "Collecting current guidance",
        subtitle:
          "Checking road, weather, and forecast signals for this location.",
        statusLabel: "Loading",
        statusTone: "neutral",
        actionLabel: "Monitor",
      };
    }

    const primarySuggestion = suggestionDecision.primary;
    const presentation = getSuggestionPresentation(primarySuggestion);
    const statusTitle = getHomeStatusTitle(primarySuggestion, {
      alertSummary,
      currentWeather,
      propertyForecastLowF,
      roadReport,
    });
    const statusSubtitle = getHomeStatusSubtitle(primarySuggestion, {
      alertSummary,
      currentWeather,
      propertyForecastLowF,
      propertyLocationName,
      propertyRisk,
      roadReport,
    });
    const shouldUsePrecipSignalFallback =
      nextPrecipSignal &&
      primarySuggestion.code === SuggestionCode.USE_CAUTION &&
      statusTitle === "Current conditions";

    return {
      title: shouldUsePrecipSignalFallback
        ? "Weather-based road caution"
        : statusTitle,
      subtitle: shouldUsePrecipSignalFallback
        ? `${nextPrecipSignal.conditionLabel} possible around ${nextPrecipSignal.timeLabel}`
        : statusSubtitle,
      statusLabel: presentation.levelLabel,
      statusTone: presentation.homeTone,
      actionLabel: presentation.actionLabel,
    };
  })();

  const baseMonitoringCard = getHomeMonitoringCard(suggestionDecision, {
    alertSummary,
    currentWeather,
    propertyForecastLowF,
    propertyLocationName,
    propertyRisk,
    roadReport,
  });
  const monitoringCard =
    nextPrecipSignal &&
    isHomeWintryConditionLabel(nextPrecipSignal.conditionLabel)
      ? {
          title: `${nextPrecipSignal.conditionLabel} possible`,
          body: `Around ${nextPrecipSignal.timeLabel}, precipitation probability is near ${nextPrecipSignal.probability}%. Current road surface: ${surfaceCondition ?? "unknown"}.`,
        }
      : baseMonitoringCard;

  const bullets: HomeBullet[] = [];

  if (currentWeather.temperatureF !== null) {
    bullets.push({
      id: "air-temp",
      text: `Air temp: ${formatTemperatureValue(currentWeather.temperatureF)}`,
    });
  }

  if (surfaceCondition) {
    bullets.push({
      id: "surface",
      text: `Surface: ${surfaceCondition === "Dry" ? "Dry" : surfaceCondition}`,
    });
  }

  if (alertSummary.status === "active" && alertSummary.event) {
    bullets.push({
      id: "alert",
      text: `Alert: ${alertSummary.event}`,
    });
  } else if (windMetric !== "--") {
    bullets.push({
      id: "wind",
      text: `Wind: ${windMetric}`,
    });
  } else if (currentWeather.precipProbability !== null) {
    bullets.push({
      id: "precip-prob",
      text: `Precip prob: ${formatPercentValue(currentWeather.precipProbability)}`,
    });
  }

  const monitoredLocationCard: HomeLocationCard = {
    title: topTitle,
    bullets: bullets.slice(0, 3),
    statusLabel: suggestionDecision?.primary
      ? getSuggestionPresentation(suggestionDecision.primary).levelLabel
      : "Unavailable",
    statusTone: suggestionDecision?.primary
      ? getSuggestionPresentation(suggestionDecision.primary).homeTone
      : "neutral",
    impactLabel: getHomeMonitoredImpactLabel({
      alertSummary,
      roadReport,
      suggestionDecision,
    }),
  };

  return {
    updatedLabel,
    nextPrecipSignal,
    metrics,
    statusBanner,
    monitoringCard,
    monitoredLocationCard,
  };
}

function buildOutlookItems(params: {
  hourlyEntries: TomorrowHourlyForecastEntry[];
}): HomeOutlookItem[] {
  const { hourlyEntries } = params;

  if (hourlyEntries.length === 0) {
    return [
      {
        id: "hourly-unavailable",
        time: "Hourly",
        temperature: "--",
        condition: "Unavailable",
      },
    ];
  }

  const currentHour = new Date();
  currentHour.setMinutes(0, 0, 0);

  const futureOrCurrentEntries = hourlyEntries.filter((entry) => {
    const entryDate = new Date(entry.time);

    if (Number.isNaN(entryDate.getTime())) {
      return true;
    }

    return entryDate.getTime() >= currentHour.getTime();
  });

  const visibleEntries =
    futureOrCurrentEntries.length > 0 ? futureOrCurrentEntries : hourlyEntries;

  return visibleEntries.slice(0, 6).map((entry, index) => ({
    id: `${entry.time}-${index}`,
    time: formatHourLabel(entry.time),
    temperature:
      typeof entry.values.temperature === "number"
        ? `${Math.round(celsiusToFahrenheit(entry.values.temperature))}°`
        : "--",
    condition: (() => {
      const label =
        typeof entry.values.weatherCode === "number"
          ? getConditionLabel(entry.values.weatherCode)
          : "Unavailable";
      const precipProbability =
        typeof entry.values.precipitationProbability === "number"
          ? entry.values.precipitationProbability
          : null;

      if (
        label === "Current conditions" &&
        typeof precipProbability === "number" &&
        precipProbability > 0
      ) {
        return "Precip possible";
      }

      return label;
    })(),
  }));
}

function getHomeSuggestionRoute(code?: SuggestionCode | null) {
  switch (code) {
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return "/alerts";
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
    case SuggestionCode.DRIFTING_CONCERN:
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
      return "/road";
    case SuggestionCode.HIGH_WIND_CAUTION:
    case SuggestionCode.USE_CAUTION:
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
    case SuggestionCode.FREEZE_RISK_TONIGHT:
    default:
      return "/conditions";
  }
}

function useHomeScreenData(
  selectedLocation: ReturnType<typeof useSelectedLocation>,
  propertyLocation: ReturnType<typeof usePropertyLocation>,
): UseHomeScreenDataResult {
  const [currentWeather, setCurrentWeather] =
    useState<HomeCurrentWeatherSnapshot>(INITIAL_CURRENT_WEATHER);
  const [hourlyForecast, setHourlyForecast] = useState<
    TomorrowHourlyForecastEntry[]
  >([]);
  const [alertSummary, setAlertSummary] = useState<HomeAlertSummary>(
    INITIAL_ALERT_SUMMARY,
  );
  const [propertyRisk, setPropertyRisk] = useState<PropertyRisk>("Unavailable");
  const [propertyForecastLowF, setPropertyForecastLowF] = useState<
    number | null
  >(null);
  const [roadReport, setRoadReport] = useState<WydotRoadReport | null>(null);
  const [homeSuggestionsReady, setHomeSuggestionsReady] = useState(false);
  const [weatherSnapshotLocationKey, setWeatherSnapshotLocationKey] = useState<
    string | null
  >(null);
  const [
    lastSuccessfulHomeWeatherFetchAtMs,
    setLastSuccessfulHomeWeatherFetchAtMs,
  ] = useState<number | null>(null);
  const currentWeatherRef = useRef(currentWeather);
  const hourlyForecastRef = useRef(hourlyForecast);
  const weatherSnapshotLocationKeyRef = useRef(weatherSnapshotLocationKey);
  const lastSuccessfulHomeWeatherFetchAtMsRef = useRef(
    lastSuccessfulHomeWeatherFetchAtMs,
  );

  useEffect(() => {
    currentWeatherRef.current = currentWeather;
    hourlyForecastRef.current = hourlyForecast;
    weatherSnapshotLocationKeyRef.current = weatherSnapshotLocationKey;
    lastSuccessfulHomeWeatherFetchAtMsRef.current =
      lastSuccessfulHomeWeatherFetchAtMs;
  }, [
    currentWeather,
    hourlyForecast,
    weatherSnapshotLocationKey,
    lastSuccessfulHomeWeatherFetchAtMs,
  ]);

  useEffect(() => {
    let isActive = true;

    async function loadHome() {
      setHomeSuggestionsReady(false);

      if (!selectedLocation) {
        setCurrentWeather(INITIAL_CURRENT_WEATHER);
        setHourlyForecast([]);
        setAlertSummary(INITIAL_ALERT_SUMMARY);
        setPropertyRisk("Unavailable");
        setPropertyForecastLowF(null);
        setRoadReport(null);
        setWeatherSnapshotLocationKey(null);
        setLastSuccessfulHomeWeatherFetchAtMs(null);
        console.log("[Home] No selected location; using initial empty state.");
        return;
      }

      const selectedLocationWeatherKey =
        getHomeWeatherSnapshotKey(selectedLocation);
      const latestCurrentWeather = currentWeatherRef.current;
      const latestHourlyForecast = hourlyForecastRef.current;
      const latestWeatherSnapshotLocationKey =
        weatherSnapshotLocationKeyRef.current;
      const latestLastSuccessfulHomeWeatherFetchAtMs =
        lastSuccessfulHomeWeatherFetchAtMsRef.current;
      const hasValidWeatherSnapshotForLocation =
        latestWeatherSnapshotLocationKey === selectedLocationWeatherKey &&
        hasValidHomeWeatherSnapshot(latestCurrentWeather, latestHourlyForecast);
      const hasFreshHomeWeatherSnapshot =
        hasValidWeatherSnapshotForLocation &&
        latestLastSuccessfulHomeWeatherFetchAtMs !== null &&
        Date.now() - latestLastSuccessfulHomeWeatherFetchAtMs <
          HOME_WEATHER_REFRESH_INTERVAL_MS;
      const shouldFetchWeather = !hasFreshHomeWeatherSnapshot;

      console.log("[Home] Starting data fetches", {
        selectedLocation: {
          id: selectedLocation.id,
          name: selectedLocation.name,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        },
        propertyLocation: propertyLocation
          ? {
              id: propertyLocation.id,
              name: propertyLocation.name,
            }
          : null,
        pendingRequests: [
          ...(shouldFetchWeather ? ["currentAndHourlyWeather"] : []),
          "alerts",
          ...(process.env.EXPO_OS === "web" ? [] : ["roadReport"]),
        ],
      });

      const roadReportRequest =
        process.env.EXPO_OS === "web"
          ? Promise.resolve<WydotRoadReport | null>(null)
          : getWydotRoadReport(selectedLocation);

      const [weatherResult, alertsResult, roadResult] =
        await Promise.allSettled([
          shouldFetchWeather
            ? getSharedCurrentAndHourlyWeather(selectedLocation)
            : Promise.resolve(null),
          getActiveAlertsForLocation(
            selectedLocation.latitude,
            selectedLocation.longitude,
          ),
          roadReportRequest,
        ]);

      if (!isActive) {
        return;
      }

      console.log("[Home] Data fetches resolved", {
        currentAndHourlyWeather: weatherResult.status,
        alerts: alertsResult.status,
        roadReport: roadResult.status,
      });

      const resolvedRoadReport =
        roadResult.status === "fulfilled" ? roadResult.value : null;
      let reusedWeatherSnapshot = false;
      let promotedCombinedWeatherToScreenState = false;
      let weatherRejectedReason: string | null = null;
      let resolvedHourlyEntriesForPropertyRisk = latestHourlyForecast;

      if (hasFreshHomeWeatherSnapshot) {
        reusedWeatherSnapshot = true;
      } else if (weatherResult.status === "fulfilled" && weatherResult.value) {
        const values = weatherResult.value.currentWeather.data.values;
        const temperatureF =
          typeof values.temperature === "number"
            ? celsiusToFahrenheit(values.temperature)
            : null;
        const windSpeedMph =
          typeof values.windSpeed === "number"
            ? metersPerSecondToMph(values.windSpeed)
            : null;
        const precipProbability =
          typeof values.precipitationProbability === "number"
            ? Math.round(values.precipitationProbability)
            : null;
        const weatherCode = values.weatherCode;
        const sourceTimestamp =
          typeof weatherResult.value.currentWeather.data.time === "string"
            ? weatherResult.value.currentWeather.data.time
            : null;
        const fallbackLabel = sourceTimestamp
          ? null
          : formatClockLabel(new Date());

        const nextWeatherState: HomeCurrentWeatherSnapshot = {
          hasWeatherData: temperatureF !== null || windSpeedMph !== null,
          temperatureF,
          windSpeedMph,
          precipProbability,
          humidity:
            typeof values.humidity === "number"
              ? Math.round(values.humidity)
              : null,
          weatherCode: typeof weatherCode === "number" ? weatherCode : null,
          conditionLabel: getConditionLabel(weatherCode),
          sourceTimestamp,
          refreshFallbackLabel: fallbackLabel,
        };
        const fallbackWeatherState = buildHomeWeatherSnapshotFromRoadReport(
          resolvedRoadReport,
          fallbackLabel,
        );
        const promotedWeatherState =
          !nextWeatherState.hasWeatherData && fallbackWeatherState
            ? fallbackWeatherState
            : nextWeatherState;

        setCurrentWeather((previousWeatherState) => {
          if (
            previousWeatherState.hasWeatherData &&
            isThinHomeWeatherSnapshot(promotedWeatherState)
          ) {
            console.log(
              "[Home] Skipping thin weather overwrite; preserving previous snapshot",
              {
                previousWeatherState,
                nextWeatherState: promotedWeatherState,
              },
            );

            return {
              ...previousWeatherState,
              refreshFallbackLabel:
                promotedWeatherState.refreshFallbackLabel ??
                previousWeatherState.refreshFallbackLabel,
            };
          }

          return promotedWeatherState;
        });

        const hourlyEntries =
          weatherResult.value.hourlyForecast.timelines?.hourly ?? [];
        resolvedHourlyEntriesForPropertyRisk = hourlyEntries;
        setHourlyForecast(hourlyEntries);
        setWeatherSnapshotLocationKey(selectedLocationWeatherKey);
        setLastSuccessfulHomeWeatherFetchAtMs(Date.now());
        promotedCombinedWeatherToScreenState = true;

        console.log("[Home] Current weather result", {
          emptyTemperature: temperatureF === null,
          emptyWind: windSpeedMph === null,
          emptyPrecipProbability: precipProbability === null,
          emptyHumidity: typeof values.humidity !== "number",
          emptyWeatherCode: typeof weatherCode !== "number",
          missingSourceTimestamp: sourceTimestamp === null,
        });
        console.log("[Home] Hourly forecast result", {
          entryCount: hourlyEntries.length,
          firstEntryMissingTemp:
            hourlyEntries[0] &&
            typeof hourlyEntries[0].values.temperature !== "number",
          firstEntryMissingCondition:
            hourlyEntries[0] &&
            typeof hourlyEntries[0].values.weatherCode !== "number",
        });
      } else {
        weatherRejectedReason =
          weatherResult.status === "rejected"
            ? weatherResult.reason instanceof Error
              ? weatherResult.reason.message
              : String(weatherResult.reason)
            : "Combined weather response was empty";
        const fallbackLabel = formatClockLabel(new Date());
        const fallbackWeatherState = buildHomeWeatherSnapshotFromRoadReport(
          resolvedRoadReport,
          fallbackLabel,
        );

        if (
          latestWeatherSnapshotLocationKey === selectedLocationWeatherKey &&
          latestCurrentWeather.hasWeatherData
        ) {
          setCurrentWeather({
            ...latestCurrentWeather,
            refreshFallbackLabel:
              latestCurrentWeather.refreshFallbackLabel ?? fallbackLabel,
          });
          reusedWeatherSnapshot = true;
        } else if (fallbackWeatherState) {
          setCurrentWeather(fallbackWeatherState);
          setHourlyForecast([]);
          setWeatherSnapshotLocationKey(selectedLocationWeatherKey);
        } else {
          setCurrentWeather({
            ...INITIAL_CURRENT_WEATHER,
            hasWeatherData: false,
            conditionLabel: "Weather unavailable",
          });
          setHourlyForecast([]);
          setWeatherSnapshotLocationKey(null);
        }

        setLastSuccessfulHomeWeatherFetchAtMs(null);
      }

      console.log("[Home] Weather decision", {
        selectedLocationWeatherKey,
        weatherSnapshotLocationKey: latestWeatherSnapshotLocationKey,
        priorSnapshotMatchesLocation:
          latestWeatherSnapshotLocationKey === selectedLocationWeatherKey,
        reusingSnapshot: reusedWeatherSnapshot,
        skippedDueToFreshness: hasFreshHomeWeatherSnapshot,
        retryingDueToMissingData: !hasValidWeatherSnapshotForLocation,
        weatherFetchRequested: shouldFetchWeather,
        weatherFetchStatus: shouldFetchWeather
          ? weatherResult.status
          : "skipped",
        weatherFetchRejected: weatherRejectedReason !== null,
        weatherFetchRejectedReason: weatherRejectedReason,
        combinedWeatherPromotedToScreenState:
          promotedCombinedWeatherToScreenState,
        priorHasWeatherData: latestCurrentWeather.hasWeatherData,
        priorTemperatureF: latestCurrentWeather.temperatureF,
        priorSourceTimestamp: latestCurrentWeather.sourceTimestamp,
        priorHourlyCount: latestHourlyForecast.length,
        lastSuccessfulHomeWeatherFetchAtMs:
          latestLastSuccessfulHomeWeatherFetchAtMs,
      });

      const shouldUseSelectedForecastForPropertyRisk = sameHomeLocation(
        propertyLocation,
        selectedLocation,
      );
      const nextPropertyForecastLowF = shouldUseSelectedForecastForPropertyRisk
        ? getHomeForecastLowFFromHourlyEntries(
            resolvedHourlyEntriesForPropertyRisk,
          )
        : null;
      const nextPropertyRisk = getHomePropertyRiskFromLowF(
        nextPropertyForecastLowF,
      );

      console.log("[Home] Property forecast resolved on Home", {
        hasPropertyLocation: !!propertyLocation,
        propertyLocationName: propertyLocation?.name ?? null,
        usingSelectedLocationForecast: shouldUseSelectedForecastForPropertyRisk,
        hourlyEntriesAvailable: resolvedHourlyEntriesForPropertyRisk.length,
        propertyForecastLowF: nextPropertyForecastLowF,
        propertyRisk: nextPropertyRisk,
      });
      setPropertyRisk(nextPropertyRisk);
      setPropertyForecastLowF(nextPropertyForecastLowF);

      if (alertsResult.status === "fulfilled") {
        const features = alertsResult.value.features ?? [];

        if (features.length === 0) {
          setAlertSummary({
            status: "none",
            event: null,
            area: formatCityState(selectedLocation),
          });
        } else {
          const firstAlert = features[0];
          const event = firstAlert.properties?.event ?? "Active alert";
          const area =
            firstAlert.properties?.areaDesc ??
            formatCityState(selectedLocation);
          setAlertSummary({
            status: "active",
            event,
            area,
          });
        }

        console.log("[Home] Alerts result", {
          alertCount: features.length,
          firstAlertEvent: features[0]?.properties?.event ?? null,
        });
      } else {
        console.log("[Home] Alerts request failed", {
          reason:
            alertsResult.reason instanceof Error
              ? alertsResult.reason.message
              : String(alertsResult.reason),
        });
        setAlertSummary({
          status: "unavailable",
          event: null,
          area: null,
        });
      }

      if (roadResult.status === "fulfilled") {
        setRoadReport(resolvedRoadReport);
        console.log("[Home] Road report result", {
          hasRoadReport: !!resolvedRoadReport,
          routeCode: resolvedRoadReport?.routeCode ?? null,
          townGroup: resolvedRoadReport?.townGroup ?? null,
          hasPrimaryObservation:
            !!resolvedRoadReport?.primaryStationObservation,
        });
      } else {
        console.log("[Home] Road report request failed", {
          reason:
            roadResult.reason instanceof Error
              ? roadResult.reason.message
              : String(roadResult.reason),
        });
        setRoadReport(null);
      }

      setHomeSuggestionsReady(true);
      console.log("[Home] Finished loadHome; suggestions ready.");
    }

    void loadHome();

    return () => {
      isActive = false;
    };
  }, [selectedLocation, propertyLocation]);

  return {
    currentWeather,
    hourlyForecast,
    alertSummary,
    propertyRisk,
    propertyForecastLowF,
    roadReport,
    homeSuggestionsReady,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();
  const savedLocations = useSavedLocations();
  const propertyLocation = usePropertyLocation();

  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const {
    currentWeather,
    hourlyForecast,
    alertSummary,
    propertyRisk,
    propertyForecastLowF,
    roadReport,
    homeSuggestionsReady,
  } = useHomeScreenData(selectedLocation, propertyLocation);

  const topTitle = useMemo(() => {
    if (!selectedLocation) {
      return null;
    }

    return getTopTitle(roadReport, selectedLocation.name);
  }, [roadReport, selectedLocation]);
  const suggestionInput = useMemo<SuggestionInput | null>(() => {
    if (!selectedLocation || !homeSuggestionsReady) {
      return null;
    }

    const observation = roadReport?.primaryStationObservation ?? null;
    const effectiveWeatherTemperatureF =
      currentWeather.temperatureF ?? observation?.airTempF ?? null;
    const effectiveWeatherWindSpeedMph =
      currentWeather.windSpeedMph ??
      observation?.windAvgMph ??
      observation?.windGustMph ??
      null;
    const effectiveWeatherObservedAt =
      currentWeather.sourceTimestamp ??
      observation?.observedAt ??
      roadReport?.fetchedAt ??
      null;

    return {
      road: {
        available: !!roadReport,
        mapped: !!roadReport,
        restriction: roadReport?.primarySegment.restriction ?? null,
        advisory: roadReport?.primarySegment.advisory ?? null,
        officialCondition: roadReport?.primarySegment.officialCondition ?? null,
        fetchedAt: roadReport?.fetchedAt ?? null,
        stationObservedAt: observation?.observedAt ?? null,
        windAvgMph: observation?.windAvgMph ?? null,
        windGustMph: observation?.windGustMph ?? null,
        windDirection: observation?.windDirection ?? null,
        visibilityFt: observation?.visibilityFt ?? null,
        airTempF: observation?.airTempF ?? null,
        surfaceTempF: observation?.surfaceTempF ?? null,
      },
      weather: {
        available:
          currentWeather.hasWeatherData ||
          hasUsableHomeRoadObservation(roadReport),
        observedAt: effectiveWeatherObservedAt,
        temperatureF: effectiveWeatherTemperatureF,
        windSpeedMph: effectiveWeatherWindSpeedMph,
        windDirection: null,
        precipProbability: currentWeather.precipProbability,
        weatherCode: currentWeather.weatherCode,
      },
      alerts: {
        available: alertSummary.status !== "unavailable",
        hasActiveAlert: alertSummary.status === "active",
        primaryEvent: alertSummary.event,
        primarySeverity: null,
        primaryCertainty: null,
      },
      forecast: {
        available: !!propertyLocation && propertyForecastLowF !== null,
        dailyLowF: propertyForecastLowF,
      },
    };
  }, [
    alertSummary.event,
    alertSummary.status,
    currentWeather,
    homeSuggestionsReady,
    propertyForecastLowF,
    propertyLocation,
    roadReport,
    selectedLocation,
  ]);
  const suggestionDecision = useMemo<SuggestionDecision | null>(
    () => (suggestionInput ? evaluateSuggestions(suggestionInput) : null),
    [suggestionInput],
  );
  const homeViewModel = useMemo<HomeViewModel | null>(() => {
    if (!topTitle) {
      return null;
    }

    return buildHomeViewModel({
      currentWeather,
      hourlyForecast,
      alertSummary,
      propertyForecastLowF,
      propertyRisk,
      propertyLocationName: propertyLocation?.name ?? null,
      roadReport,
      suggestionDecision,
      topTitle,
    });
  }, [
    alertSummary,
    currentWeather,
    hourlyForecast,
    propertyForecastLowF,
    propertyLocation,
    propertyRisk,
    roadReport,
    suggestionDecision,
    topTitle,
  ]);

  useEffect(() => {
    console.log("[Home] Derived screen state", {
      hasSelectedLocation: !!selectedLocation,
      homeSuggestionsReady,
      hasTopTitle: !!topTitle,
      hasHomeViewModel: !!homeViewModel,
      currentWeather: {
        hasWeatherData: currentWeather.hasWeatherData,
        temperatureF: currentWeather.temperatureF,
        windSpeedMph: currentWeather.windSpeedMph,
        precipProbability: currentWeather.precipProbability,
        humidity: currentWeather.humidity,
        sourceTimestamp: currentWeather.sourceTimestamp,
        refreshFallbackLabel: currentWeather.refreshFallbackLabel,
      },
      hourlyCount: hourlyForecast.length,
      alertStatus: alertSummary.status,
      hasRoadReport: !!roadReport,
      propertyRisk,
      propertyForecastLowF,
      updatedLabel: homeViewModel?.updatedLabel ?? null,
      metrics: homeViewModel?.metrics.map((metric) => ({
        label: metric.label,
        value: metric.value,
      })),
      monitoredLocationCard: homeViewModel?.monitoredLocationCard,
      statusBanner: homeViewModel?.statusBanner,
      monitoringCard: homeViewModel?.monitoringCard,
    });
  }, [
    alertSummary.status,
    currentWeather,
    homeSuggestionsReady,
    homeViewModel,
    hourlyForecast.length,
    propertyForecastLowF,
    propertyRisk,
    roadReport,
    selectedLocation,
    topTitle,
  ]);
  const outlookItems = useMemo<HomeOutlookItem[]>(
    () =>
      buildOutlookItems({
        hourlyEntries: hourlyForecast,
      }),
    [hourlyForecast],
  );
  const statusActionRoute = useMemo(
    () => getHomeSuggestionRoute(suggestionDecision?.primary?.code),
    [suggestionDecision?.primary?.code],
  );

  async function handleQuickSwitch(locationId: string) {
    if (!selectedLocation) {
      setSwitchModalVisible(false);
      return;
    }

    const nextLocation = savedLocations.find(
      (location) => location.id === locationId,
    );

    if (!nextLocation || nextLocation.id === selectedLocation.id) {
      setSwitchModalVisible(false);
      return;
    }

    await setSelectedLocation(nextLocation);
    setSwitchModalVisible(false);
  }

  function handleStatusAction() {
    router.push(statusActionRoute);
  }

  function handleOpenMonitoredLocation() {
    router.push("/road");
  }

  if (!selectedLocation || !homeViewModel || !topTitle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
        <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderBottomWidth: 1,
              borderBottomColor: "#CAD5E2",
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 14,
            }}
          >
            <View
              style={{
                minHeight: 28,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: "#0F172B",
                  fontSize: 18,
                  fontWeight: "700",
                  lineHeight: 28,
                  letterSpacing: -0.44,
                }}
              >
                Home
              </Text>

              <Pressable onPress={() => router.push("/settings")}>
                <Ionicons name="settings-outline" size={24} color="#2F5DA8" />
              </Pressable>
            </View>
          </View>

          <View
            style={{
              flex: 1,
              paddingHorizontal: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: "#0F172B",
                fontSize: 22,
                fontWeight: "700",
                lineHeight: 30,
                textAlign: "center",
              }}
            >
              No active location selected
            </Text>
            <Text
              style={{
                color: "#556274",
                fontSize: 15,
                lineHeight: 22,
                textAlign: "center",
                marginTop: 8,
                maxWidth: 280,
              }}
            >
              Choose a location to see local conditions here.
            </Text>
            <Pressable
              onPress={() => router.push("/manage-locations")}
              style={{
                marginTop: 20,
                minHeight: 44,
                borderRadius: 12,
                backgroundColor: "#2E6FC7",
                paddingHorizontal: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: "600",
                  lineHeight: 20,
                }}
              >
                Manage Locations
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <HomeScreenV2
          topTitle={topTitle}
          updatedLabel={homeViewModel.updatedLabel}
          statusBanner={homeViewModel.statusBanner}
          metrics={homeViewModel.metrics}
          outlookItems={outlookItems}
          monitoringCard={homeViewModel.monitoringCard}
          monitoredLocationCard={homeViewModel.monitoredLocationCard}
          onPressSettings={() => router.push("/settings")}
          onPressSwitchLocation={() => setSwitchModalVisible(true)}
          onPressStatusAction={handleStatusAction}
          onPressMonitoredLocation={handleOpenMonitoredLocation}
          onPressPrimaryAction={() => router.push("/conditions")}
          onPressSecondaryAction={() => router.push("/road")}
        />
      </View>

      <QuickSwitchModal
        visible={switchModalVisible}
        title="Switch saved location"
        subtitle="Pick a saved place to refresh the Home snapshot."
        currentLocationId={selectedLocation.id}
        savedLocations={savedLocations}
        onClose={() => setSwitchModalVisible(false)}
        onSelectLocation={handleQuickSwitch}
        onManageLocations={() => {
          setSwitchModalVisible(false);
          router.push("/manage-locations");
        }}
      />
    </View>
  );
}
